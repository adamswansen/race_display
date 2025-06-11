# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Check if sessions endpoint already exists
if '@app.route(\'/api/timing/sessions\')' in content:
    print("Sessions endpoint already exists")
else:
    # Find where to insert it - after the other timing endpoints
    insert_point = content.find('@app.route(\'/api/timing/database-status\')')
    if insert_point != -1:
        # Find the end of that function
        next_route = content.find('@app.route(', insert_point + 1)
        if next_route == -1:
            next_route = content.find('if __name__ == \'__main__\':')
        
        sessions_endpoint = '''
@app.route('/api/timing/sessions')
def get_timing_sessions():
    """Get timing sessions"""
    db = get_timing_db()
    if not db or not db.connection:
        return jsonify({'error': 'Database not connected'}), 500
    
    try:
        with db.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT 
                    s.*,
                    COUNT(tr.id) as total_reads,
                    COUNT(DISTINCT tr.tag_code) as unique_tags,
                    COUNT(DISTINCT tr.location_name) as location_count
                FROM timing_sessions s
                LEFT JOIN timing_reads tr ON s.id = tr.session_id
                GROUP BY s.id
                ORDER BY s.created_at DESC
                LIMIT 10
            """)
            sessions = cursor.fetchall()
            
        return jsonify({
            'success': True,
            'sessions': [dict(session) for session in sessions]
        })
        
    except Exception as e:
        print(f"Error fetching timing sessions: {e}")
        return jsonify({'error': str(e)}), 500

'''
        
        content = content[:next_route] + sessions_endpoint + content[next_route:]
        print("Added sessions endpoint")
    else:
        print("Could not find insertion point")

# Fix JSON serialization for time objects
if 'TimeAwareJSONEncoder' not in content:
    # Add custom JSON encoder
    json_fix = '''
import json
from datetime import time, datetime

# Custom JSON encoder to handle time objects
class TimeAwareJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, time):
            return obj.strftime('%H:%M:%S')
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

app.json_encoder = TimeAwareJSONEncoder
'''
    
    # Insert after CORS setup
    cors_line = content.find('CORS(app)')
    if cors_line != -1:
        insert_point = content.find('\n', cors_line) + 1
        content = content[:insert_point] + json_fix + content[insert_point:]
        print("Added JSON encoder")

# Write the updated content
with open('app.py', 'w') as f:
    f.write(content)

print("✅ Fixed timing endpoints and JSON serialization")
