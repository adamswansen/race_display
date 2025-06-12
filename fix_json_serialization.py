import re

# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Add json serialization handler for time objects
json_fix = """import json
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
app.json = json"""

# Find where to insert this - after the Flask app creation
flask_app_line = "app = Flask(__name__, static_folder='static')"
insert_point = content.find(flask_app_line)

if insert_point != -1:
    insert_point = content.find('\n', insert_point) + 1
    content = content[:insert_point] + '\n' + json_fix + '\n' + content[insert_point:]
    
    with open('app.py', 'w') as f:
        f.write(content)
    print("✅ Fixed JSON serialization")
else:
    print("❌ Could not find Flask app line")
