from flask import Flask, render_template, request, jsonify, Response, send_from_directory
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
    SERVER_CONFIG
)
from bs4 import BeautifulSoup
import tinycss2
from urllib.parse import urljoin, urlparse
import logging

app = Flask(__name__, static_folder='static')

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
    global roster_data, race_name
    roster_data = {}
    
    # Fetch first page to get total pages
    data, headers = fetch_roster_page(event_id, credentials, page=1)
    if not data:
        return False
    
    # Get pagination info from headers
    total_pages = int(headers.get('X-Ctlive-Page-Count', 1))
    total_rows = int(headers.get('X-Ctlive-Row-Count', 0))
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
    
    print(f"Total runners loaded: {len(roster_data)}")
    if len(roster_data) != total_rows:
        print(f"Warning: Expected {total_rows} entries but loaded {len(roster_data)}")
    
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

            # Process timing data
            processed_data = process_timing_data(line)
            if processed_data:
                data_queue.put(processed_data)

        print("-- Client disconnected --")

def monitor_data_feed():
    """Start the TCP server"""
    server = socketserver.ThreadingTCPServer(
        (PROTOCOL_CONFIG['HOST'], PROTOCOL_CONFIG['PORT']), 
        TimingHandler
    )
    print(f"Server listening on port {PROTOCOL_CONFIG['PORT']}")
    server.serve_forever()

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
            tcp_thread.daemon = True
            tcp_thread.start()
            
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
                return processed_data
            else:
                print(f"Bib {data['bib']} not found in roster. Available bibs: {list(roster_data.keys())[:5]}...")
                
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
    
    return Response(generate(), mimetype='text/event-stream')

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

if __name__ == '__main__':
    app.run(
        debug=SERVER_CONFIG['DEBUG'],
        host=SERVER_CONFIG['HOST'],
        port=SERVER_CONFIG['PORT'],
        use_reloader=False
    )
