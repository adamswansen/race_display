# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Remove the problematic JSON line that's breaking Flask
content = content.replace('app.json = json', '')

# Fix the JSON encoder approach - use proper Flask method
if 'TimeAwareJSONEncoder' in content:
    # Remove the old JSON encoder
    old_encoder = '''
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
    content = content.replace(old_encoder, '')

# Add proper JSON encoder after Flask app creation
flask_app_line = "CORS(app)"
insert_point = content.find(flask_app_line)
if insert_point != -1:
    insert_point = content.find('\n', insert_point) + 1
    new_encoder = '''
# Fix JSON serialization for time objects
from datetime import time, datetime
import json

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, time):
        return obj.strftime('%H:%M:%S')
    elif isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

# Configure Flask to use our custom serializer
app.json.default = json_serial
'''
    content = content[:insert_point] + new_encoder + content[insert_point:]
    print("✅ Fixed JSON encoder")

# Write the fixed content
with open('app.py', 'w') as f:
    f.write(content)

print("✅ Fixed all JSON issues")
