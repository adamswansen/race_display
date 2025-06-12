#!/usr/bin/env python3
"""
Script to add timing database functionality to existing app.py
"""

# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Check if timing database is already added
if 'RAW_TAG_DATABASE_CONFIG' in content:
    print("✅ Timing database code already exists in app.py")
    exit(0)

# Find where to insert the imports
import_section = """from config import (
    RANDOM_MESSAGES,
    API_CONFIG,
    PROTOCOL_CONFIG,
    SERVER_CONFIG
)"""

new_import_section = """from config import (
    RANDOM_MESSAGES,
    API_CONFIG,
    PROTOCOL_CONFIG,
    SERVER_CONFIG,
    RAW_TAG_DATABASE_CONFIG,
    TIMING_CONFIG
)
import psycopg2
import psycopg2.extras"""

# Replace the import section
content = content.replace(import_section, new_import_section)

# Add the timing database class after imports
timing_db_class = '''
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

'''

# Insert the timing database class after the imports
insert_point = content.find('app = Flask(__name__, static_folder=\'static\')')
if insert_point == -1:
    print("❌ Could not find Flask app initialization")
    exit(1)

content = content[:insert_point] + timing_db_class + '\n' + content[insert_point:]

# Add database storage to process_timing_data function
old_return = '''                print(f"Runner found: {processed_data}")
                return processed_data'''

new_return = '''                print(f"Runner found: {processed_data}")
                
                # Store in database
                db = get_timing_db()
                if db:
                    try:
                        db.store_timing_read(data)
                    except Exception as e:
                        print(f"Database storage error: {e}")
                
                return processed_data'''

content = content.replace(old_return, new_return)

# Add database storage for unknown bibs too
old_unknown = '''            else:
                print(f"Bib {data['bib']} not found in roster. Available bibs: {list(roster_data.keys())[:5]}...")'''

new_unknown = '''            else:
                print(f"Bib {data['bib']} not found in roster. Available bibs: {list(roster_data.keys())[:5]}...")
                
                # Store unknown bib data anyway
                db = get_timing_db()
                if db:
                    try:
                        db.store_timing_read(data)
                        print(f"Stored unknown bib {data['bib']} in database")
                    except Exception as e:
                        print(f"Database storage error: {e}")'''

content = content.replace(old_unknown, new_unknown)

# Add timing API endpoints before the main section
timing_endpoints = '''
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

'''

# Insert timing endpoints before the main section
main_section = "if __name__ == '__main__':"
main_index = content.find(main_section)
if main_index == -1:
    print("❌ Could not find main section")
    exit(1)

content = content[:main_index] + timing_endpoints + '\n' + content[main_index:]

# Write the updated content
with open('app.py', 'w') as f:
    f.write(content)

print("✅ Successfully added timing database functionality to app.py")
