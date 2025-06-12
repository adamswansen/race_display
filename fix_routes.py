# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Find the catch-all route and make it more specific
old_route = """@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    dist_dir = os.path.join(app.root_path, 'frontend', 'dist')
    file_path = os.path.join(dist_dir, path)
    if path != '' and os.path.exists(file_path):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, 'index.html')"""

new_route = """@app.route('/', defaults={'path': ''})
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
    return send_from_directory(dist_dir, 'index.html')"""

content = content.replace(old_route, new_route)

with open('app.py', 'w') as f:
    f.write(content)

print("✅ Fixed route handling")
