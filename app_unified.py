from flask import Flask, render_template, request, jsonify, Response, send_from_directory
from flask_cors import CORS
import os
import socketserver
import threading
import queue
import json
import time
import random
import hashlib
import hmac
import secrets
import requests
from datetime import datetime
from threading import Lock
from config import (
    RANDOM_MESSAGES,
    API_CONFIG,
    PROTOCOL_CONFIG,
    SERVER_CONFIG,
    RAW_TAG_DATABASE_CONFIG,
    TIMING_CONFIG
)
import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup
import tinycss2
from urllib.parse import urljoin, urlparse
import logging


# Timing Database Class
class TimingDatabase:
    """Database handler for timing data"""
    
    def __init__(self):
        self.connection = None
        self.current_session_id = None
        self.location_cache = {}
        self.connect()
        
    def connect(self):
        """Establish database connection"""
        try:
            connection_string = (
                f"host={RAW_TAG_DATABASE_CONFIG['host']} "
                f"port={RAW_TAG_DATABASE_CONFIG['port']} "
                f"dbname={RAW_TAG_DATABASE_CONFIG['database']} "
                f"user={RAW_TAG_DATABASE_CONFIG['user']} "
                f"password={RAW_TAG_DATABASE_CONFIG['password']}"
            )
            
            self.connection = psycopg2.connect(connection_string)
            self.connection.autocommit = True
            print("✅ Connected to raw_tag_data database")
            
            if TIMING_CONFIG.get('auto_create_session', True):
                self.ensure_session()
                
            return True
        except Exception as e:
            print(f"❌ Timing database connection failed: {e}")
            return False
    
    def ensure_session(self, session_name=None):
        """Ensure we have an active timing session"""
        if not session_name:
            session_name = datetime.now().strftime(TIMING_CONFIG.get('session_name_format', 'Session_%Y%m%d_%H%M%S'))
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM timing_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"
                )
                result = cursor.fetchone()
                
                if result:
                    self.current_session_id = result[0]
                    print(f"✅ Using existing timing session ID: {self.current_session_id}")
                else:
                    cursor.execute(
                        """INSERT INTO timing_sessions (session_name, event_name, status) 
                           VALUES (%s, %s, 'active') RETURNING id""",
                        (session_name, race_name or 'Live Event')
                    )
                    self.current_session_id = cursor.fetchone()[0]
                    print(f"✅ Created new timing session ID: {self.current_session_id}")
                
                return self.current_session_id
                
        except Exception as e:
            print(f"❌ Error ensuring session: {e}")
            return None
    
    def get_or_create_location(self, location_name, reader_id=None):
        """Get or create timing location"""
        cache_key = f"{self.current_session_id}_{location_name}"
        if cache_key in self.location_cache:
            return self.location_cache[cache_key]
        
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id FROM timing_locations WHERE session_id = %s AND location_name = %s",
                    (self.current_session_id, location_name)
                )
                result = cursor.fetchone()
                
                if result:
                    location_id = result[0]
                else:
                    cursor.execute(
                        """INSERT INTO timing_locations (session_id, location_name, reader_id) 
                           VALUES (%s, %s, %s) RETURNING id""",
                        (self.current_session_id, location_name, reader_id)
                    )
                    location_id = cursor.fetchone()[0]
                    print(f"✅ Created timing location '{location_name}' with ID: {location_id}")
                
                self.location_cache[cache_key] = location_id
                return location_id
                
        except Exception as e:
            print(f"❌ Error getting/creating location: {e}")
            return None
    
    def store_timing_read(self, parsed_data):
        """Store timing read in database"""
        if not self.current_session_id:
            print("❌ No active session for storing timing data")
            return False
            
        try:
            location_id = self.get_or_create_location(
                parsed_data.get('location', 'unknown'), 
                parsed_data.get('tagcode')
            )
            
            if not location_id:
                return False
            
            time_str = parsed_data.get('time', '00:00:00.00')
            
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO timing_reads (
                        session_id, location_id, sequence_number, location_name,
                        tag_code, read_time, lap_count, reader_id, gator_number, raw_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id, sequence_number, location_name) DO UPDATE SET
                        processed_at = CURRENT_TIMESTAMP,
                        raw_data = EXCLUDED.raw_data
                """, (
                    self.current_session_id,
                    location_id,
                    int(parsed_data.get('sequence', 0)),
                    parsed_data.get('location', 'unknown'),
                    parsed_data.get('bib', 'unknown'),
                    time_str,
                    int(parsed_data.get('lap', 1)),
                    parsed_data.get('tagcode', ''),
                    int(parsed_data.get('gator', 0)),
                    json.dumps(parsed_data)
                ))
                
                if TIMING_CONFIG.get('debug_timing', False):
                    print(f"✅ Stored timing read: Bib {parsed_data.get('bib')} at {parsed_data.get('location')}")
                
                return True
                
        except Exception as e:
            print(f"❌ Error storing timing read: {e}")
            return False

# Global timing database instance
timing_db = None

def get_timing_db():
    """Get or create timing database instance"""
    global timing_db
    if timing_db is None and TIMING_CONFIG.get('store_to_database', False):
        timing_db = TimingDatabase()
    return timing_db


app = Flask(__name__, static_folder='static')

CORS(app)

# Fix JSON serialization for time objects
from datetime import time, datetime
import json

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif hasattr(obj, 'isoformat'):  # handles date objects
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

# Configure Flask to use our custom serializer
app.json.default = json_serial

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
roster_data = {}
data_queue = queue.Queue()
current_event_id = None
race_name = None

# TCP/IP Settings
HOST = '127.0.0.1'
PORT = 61611
BUFFER_SIZE = 1024

# Add after global variables
listener_lock = Lock()
listeners_started = False

# Add to global variables
AUTH_SECRETS = {}  # Store connection-specific secrets

# Track progress while loading roster data
login_progress = {
    'total_entries': 0,
    'loaded_entries': 0,
    'complete': False
}

# Directories for saved templates and uploaded images
TEMPLATE_DIR = os.path.join(app.root_path, 'saved_templates')
UPLOAD_DIR = os.path.join(app.static_folder, 'uploads')
os.makedirs(TEMPLATE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

def encode_password(password):
    """Encode password using SHA-1"""
    return hashlib.sha1(password.encode('utf-8')).hexdigest()

def fetch_roster_page(event_id, credentials, page=1):
    """Fetch a single page of roster data"""
    url = f"{API_CONFIG['BASE_URL']}/event/{event_id}/entry"
    
    # Use provided credentials or fall back to defaults
    user_id = credentials.get('user_id') or API_CONFIG.get('DEFAULT_USER_ID', '')
    password = credentials.get('user_pass') or API_CONFIG.get('DEFAULT_PASSWORD', '')
    
    # Encode the password with SHA-1 (only if not already encoded)
    if len(password) != 40:  # SHA-1 hash is 40 chars
        encoded_password = encode_password(password)
    else:
        encoded_password = password
    
    params = {
        'format': API_CONFIG['FORMAT'],
        'client_id': API_CONFIG['CLIENT_ID'],
        'user_id': user_id,
        'user_pass': encoded_password,
        'page': page,
        'size': 100,  # Increased page size to reduce number of requests
        'include_test_entries': 'true',
        'elide_json': 'false'
    }
    
    print(f"Requesting roster from: {url}")
    print(f"Request parameters: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"API Response status: {response.status_code}")
        print(f"API Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            print(f"API Error: {response.text}")
            return None, None
            
        response.raise_for_status()
        data = response.json()
        
        # Validate response structure
        if not isinstance(data, dict):
            print(f"Invalid response format: expected dict, got {type(data)}")
            return None, None
            
        if 'event_entry' not in data:
            print(f"Missing 'event_entry' in response: {data}")
            return None, None
            
        if not isinstance(data['event_entry'], list):
            print(f"Invalid 'event_entry' format: expected list, got {type(data['event_entry'])}")
            return None, None
            
        if len(data['event_entry']) > 0:
            print(f"Successfully fetched {len(data['event_entry'])} entries")
            # Log first entry for debugging
            print(f"First entry sample: {data['event_entry'][0]}")
        else:
            print(f"Response contained no entries. Response data: {data}")
            
        return data, response.headers
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None, None
    except ValueError as e:
        print(f"JSON parsing error: {e}")
        print(f"Response content: {response.text[:500]}...")
        return None, None
    except Exception as e:
        print(f"Error fetching roster page {page}: {e}")
        return None, None

def fetch_complete_roster(event_id, credentials):
    """Fetch all pages of roster data"""
    global roster_data, race_name, login_progress
    roster_data = {}

    # Reset progress tracking
    login_progress = {
        'total_entries': 0,
        'loaded_entries': 0,
        'complete': False
    }

    # Fetch first page to get total pages
    data, headers = fetch_roster_page(event_id, credentials, page=1)
    if not data:
        return False
    
    # Get pagination info from headers
    total_pages = int(headers.get('X-Ctlive-Page-Count', 1))
    total_rows = int(headers.get('X-Ctlive-Row-Count', 0))
    login_progress['total_entries'] = total_rows
    print(f"Total entries to fetch: {total_rows} across {total_pages} pages")
    
    # Process first page
    for entry in data['event_entry']:
        # Store all relevant runner information
        bib = entry.get('entry_bib')
        if not bib:  # If no bib, use entry_id as fallback
            bib = entry.get('entry_id')
            
        if bib:
            roster_data[bib] = {
                'name': entry.get('entry_name', ''),  # Full name
                'first_name': entry.get('athlete_first_name', ''),
                'last_name': entry.get('athlete_last_name', ''),
                'age': entry.get('entry_race_age', ''),
                'gender': entry.get('athlete_sex', ''),
                'city': entry.get('location_city', ''),
                'state': entry.get('location_region', ''),
                'country': entry.get('location_country', ''),
                'division': entry.get('bracket_name', ''),  # Age group/division
                'race_name': entry.get('race_name', ''),
                'reg_choice': entry.get('reg_choice_name', ''),  # Race category
                'wave': entry.get('wave_name', ''),
                'team_name': entry.get('team_name', ''),
                'entry_status': entry.get('entry_status', ''),
                'entry_type': entry.get('entry_type', ''),
                'entry_id': entry.get('entry_id', ''),
                'athlete_id': entry.get('athlete_id', '')
            }
            # Store race name (we'll get it from the first entry)
            if race_name is None:
                race_name = entry.get('race_name', '')
            login_progress['loaded_entries'] += 1
    
    # Fetch remaining pages
    for page in range(2, total_pages + 1):
        print(f"Fetching page {page} of {total_pages}")
        data, _ = fetch_roster_page(event_id, credentials, page)
        if data:
            for entry in data['event_entry']:
                bib = entry.get('entry_bib')
                if not bib:  # If no bib, use entry_id as fallback
                    bib = entry.get('entry_id')
                    
                if bib:
                    roster_data[bib] = {
                        'name': entry.get('entry_name', ''),
                        'first_name': entry.get('athlete_first_name', ''),
                        'last_name': entry.get('athlete_last_name', ''),
                        'age': entry.get('entry_race_age', ''),
                        'gender': entry.get('athlete_sex', ''),
                        'city': entry.get('location_city', ''),
                        'state': entry.get('location_region', ''),
                        'country': entry.get('location_country', ''),
                        'division': entry.get('bracket_name', ''),
                        'race_name': entry.get('race_name', ''),
                        'reg_choice': entry.get('reg_choice_name', ''),
                        'wave': entry.get('wave_name', ''),
                        'team_name': entry.get('team_name', ''),
                        'entry_status': entry.get('entry_status', ''),
                        'entry_type': entry.get('entry_type', ''),
                        'entry_id': entry.get('entry_id', ''),
                        'athlete_id': entry.get('athlete_id', '')
                    }
                    login_progress['loaded_entries'] += 1
    
    print(f"Total runners loaded: {len(roster_data)}")
    if len(roster_data) != total_rows:
        print(f"Warning: Expected {total_rows} entries but loaded {len(roster_data)}")

    login_progress['complete'] = True

    return True

def generate_auth_seed():
    """Generate a random authentication seed"""
    return secrets.token_hex(16)

def calculate_hmac(seed, password, method='sha1'):
    """Calculate HMAC digest"""
    if method == 'sha1':
        return hmac.new(password.encode(), seed.encode(), hashlib.sha1).hexdigest()
    elif method == 'md5':
        return hmac.new(password.encode(), seed.encode(), hashlib.md5).hexdigest()
    return None

class TimingHandler(socketserver.StreamRequestHandler):
    def write_command(self, *fields):
        """Write a command to the socket with proper formatting"""
        command = PROTOCOL_CONFIG['FIELD_SEPARATOR'].join(map(str, fields))
        print(">>", command)
        self.wfile.write((command + PROTOCOL_CONFIG['LINE_TERMINATOR']).encode())

    def read_command(self):
        """Read a command from the socket"""
        command = self.rfile.readline().strip().decode()
        if command:
            print("<<", command)
        return command

    def handle(self):
        print("-- Client connected --")

        # Consume the greeting
        greeting = self.read_command()

        # Send our response with settings
        settings = (
            "location=multi",
            "guntimes=true", 
            "newlocations=true",
            "authentication=none",
            "stream-mode=push",
            "time-format=iso"
        )
        
        # Send initial greeting with settings count
        self.write_command("RaceDisplay", "Version 1.0 Level 2024.02", len(settings))
        
        # Send each setting
        for setting in settings:
            self.write_command(setting)

        # Request event info and locations
        self.write_command("geteventinfo")
        self.write_command("getlocations")
        
        # Start the data feed
        self.write_command("start")

        # Process incoming data
        while True:
            line = self.read_command()
            if not line:
                break

            if line == 'ping':
                self.write_command("ack", "ping")
                continue

            # Handle initialization acknowledgments
            if line.startswith('ack~'):
                parts = line.split('~')
                if len(parts) >= 2:
                    ack_type = parts[1]
                    if ack_type == 'init':
                        # Accept any ack~init response
                        continue
                    elif ack_type == 'geteventinfo':
                        # Accept event info response
                        continue
                    elif ack_type == 'getlocations':
                        # Accept locations response
                        continue
                    elif ack_type == 'start':
                        # Accept start acknowledgment
                        continue

            # Process timing data
            processed_data = process_timing_data(line)
            if processed_data:
                data_queue.put(processed_data)

        print("-- Client disconnected --")

def monitor_data_feed():
    """Start the TCP server"""
    print(f"Starting TCP server on {PROTOCOL_CONFIG['HOST']}:{PROTOCOL_CONFIG['PORT']}")
    try:
        server = socketserver.ThreadingTCPServer(
            (PROTOCOL_CONFIG['HOST'], PROTOCOL_CONFIG['PORT']), 
            TimingHandler
        )
        print(f"Server listening on port {PROTOCOL_CONFIG['PORT']}")
        server.serve_forever()
    except Exception as e:
        print(f"Error in TCP server: {e}")
        raise

def start_listeners():
    """Start TCP listener"""
    global listeners_started
    
    with listener_lock:
        if listeners_started:
            print("Listener already running")
            return True
            
        try:
            # Start TCP listener
            tcp_thread = threading.Thread(target=monitor_data_feed)
            tcp_thread.daemon = False  # Make it a non-daemon thread
            tcp_thread.start()
            print("TCP server thread started")
            
            listeners_started = True
            return True
            
        except Exception as e:
            print(f"Failed to start listener: {e}")
            return False

def process_timing_data(line):
    """Process timing data in CT01_33 format:
    format_id~sequence~location~bib~time~gator~tagcode~lap
    Example: CT01_33~1~start~9478~14:02:15.31~0~0F2A38~1
    """
    print(f"Processing line: {line}")
    try:
        parts = line.split(PROTOCOL_CONFIG['FIELD_SEPARATOR'])
        print(f"Split parts: {parts}")
        
        if len(parts) >= 8 and parts[0] == PROTOCOL_CONFIG['FORMAT_ID']:
            data = {
                'format': parts[0],
                'sequence': parts[1],
                'location': parts[2],
                'bib': parts[3],
                'time': parts[4],
                'gator': parts[5],
                'tagcode': parts[6],
                'lap': parts[7]
            }
            print(f"Parsed data: {data}")
            
            if data['bib'] == 'guntime':
                print("Skipping guntime event")
                return None
                
            if data['bib'] in roster_data:
                print(f"Found bib {data['bib']} in roster")
                runner_data = roster_data[data['bib']]
                processed_data = {
                    'name': runner_data['name'],  # Use full name from entry_name
                    'first_name': runner_data['first_name'],
                    'last_name': runner_data['last_name'],
                    'age': runner_data['age'],
                    'gender': runner_data['gender'],
                    'city': runner_data['city'],
                    'state': runner_data['state'],
                    'country': runner_data['country'],
                    'division': runner_data['division'],
                    'race_name': runner_data['race_name'],
                    'reg_choice': runner_data['reg_choice'],
                    'wave': runner_data['wave'],
                    'team_name': runner_data['team_name'],
                    'message': random.choice(RANDOM_MESSAGES),
                    'timestamp': data['time'],
                    'location': data['location'],
                    'lap': data['lap'],
                    'bib': data['bib']
                }
                print(f"Runner found: {processed_data}")
                
                # Store in database
                db = get_timing_db()
                if db:
                    try:
                        db.store_timing_read(data)
                    except Exception as e:
                        print(f"Database storage error: {e}")
                
                return processed_data
            else:
                print(f"Bib {data['bib']} not found in roster. Available bibs: {list(roster_data.keys())[:5]}...")
                
                # Store unknown bib data anyway
                db = get_timing_db()
                if db:
                    try:
                        db.store_timing_read(data)
                        print(f"Stored unknown bib {data['bib']} in database")
                    except Exception as e:
                        print(f"Database storage error: {e}")
                
    except Exception as e:
        print(f"Error processing timing data: {e}")
        print(f"Line causing error: {line}")
    return None

@app.route('/old')
def old_index():
    default_credentials = {
        'user_id': API_CONFIG.get('DEFAULT_USER_ID', ''),
        'event_id': API_CONFIG.get('DEFAULT_EVENT_ID', ''),
        'password': API_CONFIG.get('DEFAULT_PASSWORD', '')
    }
    return render_template('old_index.html', credentials=default_credentials)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    # Don't serve React for API endpoints
    if path.startswith('api/'):
        from flask import abort
        abort(404)
    
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    file_path = os.path.join(dist_dir, path)
    if path != '' and os.path.exists(file_path):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')

@app.route('/api/test-connection', methods=['POST'])
def test_connection():
    """Test endpoint to verify API connectivity"""
    try:
        password = request.form['password']
        
        # If password field contains a SHA-1 hash (already encoded), use it directly
        if len(password) == 40 and all(c in '0123456789abcdef' for c in password.lower()):
            encoded_password = password
        else:
            # Otherwise encode it
            encoded_password = encode_password(password)
            
        credentials = {
            'user_id': request.form['user_id'],
            'user_pass': encoded_password,
            'event_id': request.form['event_id']
        }
        
        # Just test the connection to the API
        url = f"{API_CONFIG['BASE_URL']}/event/{credentials['event_id']}/entry"
        
        params = {
            'format': API_CONFIG['FORMAT'],
            'client_id': API_CONFIG['CLIENT_ID'],
            'user_id': credentials['user_id'],
            'user_pass': encoded_password,
            'page': 1,
            'size': 1  # Just request 1 entry to minimize data transfer
        }
        
        print(f"Testing connection to: {url}")
        print(f"With parameters: {params}")
        
        response = requests.get(url, params=params, timeout=10)
        
        result = {
            'status_code': response.status_code,
            'success': response.status_code == 200,
            'headers': dict(response.headers),
        }
        
        # If successful, include a sample of the data
        if response.status_code == 200:
            try:
                data = response.json()
                result['data_sample'] = {
                    'has_entries': 'event_entry' in data,
                    'entry_count': len(data.get('event_entry', [])),
                    'first_entry': data.get('event_entry', [{}])[0] if data.get('event_entry') else None
                }
            except ValueError:
                result['parse_error'] = 'Could not parse JSON response'
                result['response_text'] = response.text[:500]  # First 500 chars
        else:
            result['error_text'] = response.text
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        })

@app.route('/api/login', methods=['POST'])
def login():
    try:
        # Get credentials from request
        password = request.form['password']
        
        # If password field contains a SHA-1 hash (already encoded), use it directly
        if len(password) == 40 and all(c in '0123456789abcdef' for c in password.lower()):
            encoded_password = password
        else:
            # Otherwise encode it
            encoded_password = encode_password(password)
            
        credentials = {
            'user_id': request.form['user_id'],
            'user_pass': encoded_password,
            'event_id': request.form['event_id']
        }
        
        global current_event_id
        current_event_id = credentials['event_id']
        
        response = {
            "success": False,
            "status": "Authenticating...",
            "stage": 1,
            "total_stages": 4
        }
        
        # Fetch roster data
        if fetch_complete_roster(current_event_id, credentials):
            response.update({
                "status": "Roster loaded successfully",
                "stage": 2,
                "race_name": race_name,
                "runners_loaded": len(roster_data),
                "credentials_valid": True
            })
            
            if start_listeners():
                response.update({
                    "success": True,
                    "status": "Ready to receive timing data",
                    "stage": 3,
                    "middleware_connected": True,
                    "display_active": True
                })
                
        else:
            response.update({
                "error": "Failed to fetch roster",
                "stage": 2
            })
            
    except Exception as e:
        response = {
            "success": False,
            "error": f"Login failed: {str(e)}",
            "stage": 1
        }
    
    return jsonify(response)

@app.route('/api/login-progress')
def get_login_progress():
    """Return current roster loading progress"""
    return jsonify(login_progress)

@app.route('/stream')
def stream():
    def generate():
        while True:
            try:
                # Try to get data from the queue, timeout after 1 second
                data = data_queue.get(timeout=1)
                yield f"data: {json.dumps(data)}\n\n"
            except queue.Empty:
                # Send keepalive message if no data
                yield f"data: {json.dumps({'keepalive': True})}\n\n"
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

def is_valid_url(url):
    """Validate URL format and security"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception as e:
        logger.error("Failed to parse URL '%s': %s", url, e)
        return False

def extract_colors_from_css(css_text):
    """Extract color values from CSS"""
    colors = set()
    rules = tinycss2.parse_stylesheet(css_text)
    
    # Common CSS color names and their hex values
    css_colors = {
        'black': '#000000', 'white': '#ffffff', 'red': '#ff0000',
        'green': '#00ff00', 'blue': '#0000ff', 'yellow': '#ffff00',
        'purple': '#800080', 'gray': '#808080', 'orange': '#ffa500'
    }
    
    for rule in rules:
        if rule.type == 'qualified-rule':
            for token in rule.content:
                if token.type == 'hash':
                    # Handle hex colors
                    colors.add(f'#{token.value}')
                elif token.type == 'function' and token.name in ['rgb', 'rgba']:
                    # Handle rgb/rgba colors
                    colors.add(token.serialize())
                elif token.type == 'ident' and token.value.lower() in css_colors:
                    # Handle named colors
                    colors.add(css_colors[token.value.lower()])
    
    return list(colors)

def extract_fonts_from_css(css_text):
    """Extract font families from CSS"""
    fonts = set()
    rules = tinycss2.parse_stylesheet(css_text)
    
    for rule in rules:
        if rule.type == 'qualified-rule':
            for token in rule.content:
                if token.type == 'function' and token.name == 'font-family':
                    fonts.add(token.serialize())
    
    return list(fonts)

@app.route('/api/fetch-styles', methods=['POST'])
def fetch_styles():
    url = request.json.get('url')
    
    if not url or not is_valid_url(url):
        return jsonify({'error': 'Invalid URL'}), 400
    
    try:
        # Fetch the webpage
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; RaceDisplay/1.0)'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract styles
        styles = {
            'colors': set(),
            'fonts': set(),
            'backgrounds': set()
        }
        
        # Process external stylesheets
        for link in soup.find_all('link', rel='stylesheet'):
            href = link.get('href')
            if href:
                css_url = urljoin(url, href)
                try:
                    css_response = requests.get(css_url, headers=headers, timeout=5)
                    if css_response.ok:
                        styles['colors'].update(extract_colors_from_css(css_response.text))
                        styles['fonts'].update(extract_fonts_from_css(css_response.text))
                except requests.RequestException as e:
                    logger.warning("Failed to fetch CSS %s: %s", css_url, e)
                    continue
        
        # Process inline styles
        for style in soup.find_all('style'):
            styles['colors'].update(extract_colors_from_css(style.string or ''))
            styles['fonts'].update(extract_fonts_from_css(style.string or ''))
        
        # Extract main background
        body = soup.find('body')
        if body:
            bg_color = body.get('style', '').split('background-color:')[-1].split(';')[0].strip()
            if bg_color:
                styles['backgrounds'].add(bg_color)
        
        # Convert sets to lists for JSON serialization
        styles = {k: list(v) for k, v in styles.items()}
        
        # Add some metadata
        styles['title'] = soup.title.string if soup.title else ''
        styles['url'] = url
        
        return jsonify(styles)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Template and asset management endpoints
# ---------------------------------------------------------------------------

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """Handle image uploads from the editor"""
    logger.info("Received upload request")
    logger.info("Request files: %s", request.files)
    logger.info("Request form: %s", request.form)
    
    # Try different possible field names for files
    files = (request.files.getlist('files[]') or 
             request.files.getlist('files') or 
             request.files.getlist('file'))
             
    if not files:
        logger.error("No files found in request")
        return jsonify({'error': 'No files uploaded'}), 400
        
    urls = []
    for f in files:
        logger.info("Processing file: %s", f.filename)
        fname = ''.join(c for c in f.filename if c.isalnum() or c in ('_', '-', '.'))
        path = os.path.join(UPLOAD_DIR, fname)
        try:
            f.save(path)
            urls.append(f'/static/uploads/{fname}')
            logger.info("Successfully saved file to: %s", path)
        except Exception as e:
            logger.error("Failed to save file: %s", str(e))
            return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
            
    return jsonify({'data': urls})


@app.route('/api/templates', methods=['GET', 'POST'])
def manage_templates():
    """Save a template or list available templates"""
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        name = data.get('name')
        html = data.get('html')
        if not name or not html:
            return jsonify({'error': 'Missing name or html'}), 400
        safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
        with open(os.path.join(TEMPLATE_DIR, f'{safe}.html'), 'w', encoding='utf-8') as fp:
            fp.write(html)
        return jsonify({'success': True})

    templates = [f[:-5] for f in os.listdir(TEMPLATE_DIR) if f.endswith('.html')]
    return jsonify(templates)


@app.route('/api/templates/<name>', methods=['GET'])
def get_template(name):
    """Retrieve a saved template"""
    safe = ''.join(c for c in name if c.isalnum() or c in ('_', '-')).rstrip()
    path = os.path.join(TEMPLATE_DIR, f'{safe}.html')
    if not os.path.exists(path):
        return jsonify({'error': 'Template not found'}), 404
    with open(path, 'r', encoding='utf-8') as fp:
        html = fp.read()
    return jsonify({'html': html})


# Timing API Endpoints
@app.route('/api/timing/database-status')
def timing_database_status():
    """Check timing database connection status"""
    db = get_timing_db()
    
    status = {
        'database_enabled': TIMING_CONFIG.get('store_to_database', False),
        'connected': False,
        'current_session': None,
        'error': None
    }
    
    if db and db.connection:
        try:
            with db.connection.cursor() as cursor:
                cursor.execute("SELECT version()")
                version = cursor.fetchone()[0]
                status.update({
                    'connected': True,
                    'current_session': db.current_session_id,
                    'database_version': version[:50]
                })
        except Exception as e:
            status['error'] = str(e)
    
    return jsonify(status)





@app.route('/api/timing/sessions')
def get_timing_sessions_simple():
    """Get timing sessions - simple version"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    s.id,
                    s.session_name,
                    s.event_name,
                    s.status,
                    s.created_at,
                    COUNT(tr.id) as total_reads
                FROM timing_sessions s
                LEFT JOIN timing_reads tr ON s.id = tr.session_id
                GROUP BY s.id, s.session_name, s.event_name, s.status, s.created_at
                ORDER BY s.created_at DESC
                LIMIT 10
            """)
            sessions = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'sessions': [dict(session) for session in sessions]
        })
        
    except Exception as e:
        print(f"Error fetching sessions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/timing/stats')
def get_timing_stats():
    """Get timing statistics for dashboard"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_reads,
                    COUNT(DISTINCT tag_code) as unique_tags,
                    COUNT(DISTINCT location_name) as total_locations,
                    MIN(read_timestamp) as first_read,
                    MAX(read_timestamp) as last_read
                FROM timing_reads tr
                JOIN timing_sessions ts ON tr.session_id = ts.id
                WHERE ts.status = 'active'
            """)
            overall_stats = cursor.fetchone()
            
            cursor.execute("""
                SELECT 
                    tr.location_name,
                    COUNT(*) as read_count,
                    COUNT(DISTINCT tr.tag_code) as unique_tags,
                    MAX(tr.read_timestamp) as last_read
                FROM timing_reads tr
                JOIN timing_sessions ts ON tr.session_id = ts.id
                WHERE ts.status = 'active'
                GROUP BY tr.location_name
                ORDER BY read_count DESC
            """)
            location_stats = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'overall': dict(overall_stats) if overall_stats else {},
            'by_location': [dict(stat) for stat in location_stats],
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Error fetching timing stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/timing/recent-reads')
def get_recent_timing_reads():
    """Get recent timing reads"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        limit = int(request.args.get('limit', 50))
        
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    tr.*,
                    tl.description as location_description,
                    ts.session_name,
                    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tr.read_timestamp)) as seconds_ago
                FROM timing_reads tr
                JOIN timing_locations tl ON tr.location_id = tl.id
                JOIN timing_sessions ts ON tr.session_id = ts.id
                WHERE ts.status = 'active'
                ORDER BY tr.read_timestamp DESC
                LIMIT %s
            """, (limit,))
            reads = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'reads': [dict(read) for read in reads],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Error fetching recent reads: {e}")
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    # Start TCP listener automatically when app starts
    print("Starting timing system...")
    try:
        if start_listeners():
            print("✅ TCP listener started successfully on port 61611")
        else:
            print("❌ Failed to start TCP listener")
    except Exception as e:
        print(f"❌ Error starting TCP listener: {e}")
    
    # Start Flask web server
    print(f"Starting Flask web server on {SERVER_CONFIG['HOST']}:{SERVER_CONFIG['PORT']}")
    app.run(
        debug=SERVER_CONFIG['DEBUG'],
        host=SERVER_CONFIG['HOST'],
        port=SERVER_CONFIG['PORT'],
        use_reloader=False,
        threaded=True
    )
