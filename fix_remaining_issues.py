# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Fix the JSON serializer to handle date objects too
old_serializer = '''def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    elif isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")'''

new_serializer = '''def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif hasattr(obj, 'isoformat'):  # handles date objects
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")'''

content = content.replace(old_serializer, new_serializer)

# Fix the route ordering - move sessions endpoint before the catch-all
# Find the sessions endpoint
sessions_start = content.find("@app.route('/api/timing/sessions')")
if sessions_start != -1:
    # Find the end of the sessions function
    sessions_end = sessions_start
    brace_count = 0
    in_function = False
    
    lines = content[sessions_start:].split('\n')
    end_line = 0
    
    for i, line in enumerate(lines):
        if line.strip().startswith('def '):
            in_function = True
        elif in_function and line and not line[0].isspace() and not line.startswith('@'):
            end_line = i
            break
    
    if end_line > 0:
        sessions_end = sessions_start + len('\n'.join(lines[:end_line]))
        sessions_function = content[sessions_start:sessions_end]
        
        # Remove it from current location
        content = content[:sessions_start] + content[sessions_end:]
        
        # Find where to insert it - before the React routes
        react_route = content.find("@app.route('/', defaults={'path': ''})")
        if react_route != -1:
            content = content[:react_route] + sessions_function + '\n\n' + content[react_route:]
            print("✅ Moved sessions route before React routes")

with open('app.py', 'w') as f:
    f.write(content)

print("✅ Fixed date serialization and route ordering")
