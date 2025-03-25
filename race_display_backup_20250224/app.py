from flask import Flask, render_template, request, jsonify, Response
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

app = Flask(__name__, static_folder='static')

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

def encode_password(password):
    """Encode password using SHA-1"""
    return hashlib.sha1(password.encode('utf-8')).hexdigest()

def fetch_roster_page(event_id, credentials, page=1):
    """Fetch a single page of roster data"""
    url = f"{API_CONFIG['BASE_URL']}/event/{event_id}/entry"
    
    # Encode the password with SHA-1
    encoded_password = encode_password(credentials['user_pass'])
    
    params = {
        'format': API_CONFIG['FORMAT'],
        'client_id': API_CONFIG['CLIENT_ID'],
        'user_id': credentials['user_id'],
        'user_pass': encoded_password,
        'page': page,
        'size': 50,
        'include_test_entries': 'true',
        'elide_json': 'false'
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json(), response.headers
    except Exception as e:
        print(f"Error fetching roster page {page}: {e}")
        return None, None

def fetch_complete_roster(event_id, credentials):
    """Fetch all pages of roster data"""
    global roster_data, race_name
    roster_data = {}
    
    # Fetch first page to get total pages
    data, headers = fetch_roster_page(event_id, credentials)
    if not data:
        return False
    
    total_pages = int(headers.get('X-Ctlive-Page-Count', 1))
    print(f"Total pages to fetch: {total_pages}")
    
    # Process first page
    for entry in data['event_entry']:
        # Store only the fields we need
        bib = entry.get('entry_bib')
        if bib:
            roster_data[bib] = {
                'first_name': entry.get('athlete_first_name', ''),
                'last_name': entry.get('athlete_last_name', ''),
                'city': entry.get('location_city', '')
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
                if bib:
                    roster_data[bib] = {
                        'first_name': entry.get('athlete_first_name', ''),
                        'last_name': entry.get('athlete_last_name', ''),
                        'city': entry.get('location_city', '')
                    }
    
    print(f"Total runners loaded: {len(roster_data)}")
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
                    'name': f"{runner_data['first_name']} {runner_data['last_name']}",
                    'city': runner_data['city'],
                    'message': random.choice(RANDOM_MESSAGES),
                    'timestamp': data['time'],
                    'location': data['location'],
                    'lap': data['lap']
                }
                print(f"Runner found: {processed_data}")
                return processed_data
            else:
                print(f"Bib {data['bib']} not found in roster. Available bibs: {list(roster_data.keys())[:5]}...")
                
    except Exception as e:
        print(f"Error processing timing data: {e}")
        print(f"Line causing error: {line}")
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/login', methods=['POST'])
def login():
    try:
        # Get credentials from request
        credentials = {
            'user_id': request.form['user_id'],
            'user_pass': request.form['password'],
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

if __name__ == '__main__':
    app.run(
        debug=SERVER_CONFIG['DEBUG'],
        host=SERVER_CONFIG['HOST'],
        port=SERVER_CONFIG['PORT'],
        use_reloader=False
    )