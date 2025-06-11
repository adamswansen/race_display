# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Remove any existing sessions endpoint that's not working
content = content.replace("@app.route('/api/timing/sessions')", "# REMOVED @app.route('/api/timing/sessions')")

# Add a simple sessions endpoint right after database-status
db_status_func = content.find("def timing_database_status():")
if db_status_func != -1:
    # Find the end of the database-status function
    next_def = content.find("\n@app.route", db_status_func)
    if next_def != -1:
        simple_sessions = '''
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
'''
        
        content = content[:next_def] + simple_sessions + content[next_def:]
        print("✅ Added simple sessions endpoint")

with open('app.py', 'w') as f:
    f.write(content)

print("✅ Fixed sessions endpoint")
