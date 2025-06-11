# Read the current app.py
with open('app.py', 'r') as f:
    content = f.read()

# Find the main block and add automatic listener startup
main_block = '''if __name__ == '__main__':
    app.run(host=SERVER_CONFIG['HOST'], port=SERVER_CONFIG['PORT'], debug=SERVER_CONFIG['DEBUG'])'''

new_main_block = '''if __name__ == '__main__':
    # Start TCP listener automatically when app starts
    print("Starting timing system...")
    try:
        if start_listeners():
            print("✅ TCP listener started successfully on port 61611")
        else:
            print("❌ Failed to start TCP listener")
    except Exception as e:
        print(f"❌ Error starting TCP listener: {e}")
    
    # Start Flask web server
    print(f"Starting Flask web server on {SERVER_CONFIG['HOST']}:{SERVER_CONFIG['PORT']}")
    app.run(host=SERVER_CONFIG['HOST'], port=SERVER_CONFIG['PORT'], debug=SERVER_CONFIG['DEBUG'])'''

# Replace the main block
content = content.replace(main_block, new_main_block)

# Write the updated content
with open('app.py', 'w') as f:
    f.write(content)

print("✅ Modified app.py to start TCP listener automatically")
