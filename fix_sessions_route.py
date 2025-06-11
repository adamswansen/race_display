# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Find and extract the sessions route function
sessions_start = content.find("@app.route('/api/timing/sessions')")
if sessions_start == -1:
    print("Sessions route not found")
    exit()

# Find the end of the sessions function by looking for the next @app.route or EOF
next_route = content.find("@app.route", sessions_start + 1)
if next_route == -1:
    next_route = content.find("if __name__ == '__main__':")
if next_route == -1:
    next_route = len(content)

sessions_function = content[sessions_start:next_route].rstrip() + '\n\n'
print(f"Found sessions function: {len(sessions_function)} characters")

# Remove it from current location
content = content[:sessions_start] + content[next_route:]

# Insert it right after the database-status endpoint
db_status_end = content.find("return jsonify(status)")
if db_status_end != -1:
    # Find the end of that function
    insert_point = content.find('\n\n', db_status_end)
    if insert_point != -1:
        content = content[:insert_point] + '\n\n' + sessions_function + content[insert_point:]
        print("✅ Moved sessions route after database-status")
    else:
        print("Could not find insertion point")
else:
    print("Could not find database-status endpoint")

with open('app.py', 'w') as f:
    f.write(content)

print("✅ Fixed sessions route placement")
