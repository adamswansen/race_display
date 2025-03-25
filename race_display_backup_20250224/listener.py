import socket
import sys
from datetime import datetime
import os

def play_system_sound():
    os.system("afplay /System/Library/Sounds/Glass.aiff")  # or Ping.aiff, Tink.aiff, etc.

def create_listener():
    HOST = '0.0.0.0'
    PORT = 61611
    
    print(f"Starting TCP listener on {HOST}:{PORT}", flush=True)
    
    # Test the sound
    print("Testing sound...", flush=True)
    play_system_sound()
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((HOST, PORT))
        s.listen()
        print(f"Listening for connections...", flush=True)
        
        try:
            while True:
                conn, addr = s.accept()
                print(f"Connection from {addr}", flush=True)
                
                with conn:
                    # Handle initial greeting
                    data = conn.recv(8192)
                    if not data:
                        print("Client disconnected during greeting", flush=True)
                        continue
                        
                    decoded = data.decode('utf-8').strip()
                    print(f"\nReceived greeting: {decoded!r}", flush=True)
                    
                    # Parse greeting
                    parts = decoded.split('~')
                    if len(parts) == 3:
                        client_name, client_version, protocol = parts
                        print(f"Client: {client_name} v{client_version} Protocol: {protocol}", flush=True)
                        
                        # Send server response requesting push mode
                        response = "RaceDisplay~1.0.0~2\r\n"  # 2 initialization requests
                        conn.sendall(response.encode('utf-8'))
                        print(f"Sent response: {response!r}", flush=True)
                        
                        # Send initialization requests
                        conn.sendall(b"stream-mode=push\r\n")
                        conn.sendall(b"pushmode-ack=true\r\n")
                        
                        # Send start command to begin receiving data
                        conn.sendall(b"start\r\n")
                        print("Sent start command", flush=True)
                        
                        # Handle subsequent data
                        while True:
                            data = conn.recv(8192)
                            if not data:
                                print("Client disconnected", flush=True)
                                break
                                
                            decoded = data.decode('utf-8').strip()
                            print(f"\nReceived: {decoded!r}", flush=True)
                            
                            # Handle tag observations
                            if decoded.startswith('TO~'):
                                parts = decoded.split('~')
                                if len(parts) >= 11:
                                    timestamp = datetime.fromtimestamp(float(parts[5]))
                                    print(f"""
Tag Observation:
  Sequence: {parts[1]}
  Tag: {parts[2]}
  Timer: {parts[3]}
  Event: {parts[4]}
  Time: {timestamp}
  Reader: {parts[6]} (Port {parts[7]})
  RSSI: {parts[8]} dB
  Reader Seq: {parts[9]}
  Type: {parts[10]}
  Read Count: {parts[11] if len(parts) > 11 else 'N/A'}
""", flush=True)
                                    # Play sound for tag detection
                                    try:
                                        play_system_sound()
                                    except Exception as e:
                                        print(f"Error playing sound: {e}", flush=True)
                                    
                                    # Send acknowledgment
                                    conn.sendall(b'OK\r\n')
                            
                            # Handle heartbeat
                            elif decoded == '8':
                                print("Heartbeat received", flush=True)
                                conn.sendall(b'8\r\n')
                            
                            # Handle other commands
                            elif decoded == 'geteventinfo':
                                conn.sendall(b'ack~geteventinfo~RACE2024~1~Test Race 2024\r\n')
                            elif decoded == 'getlocations':
                                conn.sendall(b'ack~getlocations~start~finish\r\n')
                            elif decoded == 'ping':
                                response = "ack~ping\r\n"
                                conn.sendall(response.encode('utf-8'))
                                print(f"Sent ping response: {response!r}", flush=True)
                    
        except KeyboardInterrupt:
            print("\nShutting down...", flush=True)
        except Exception as e:
            print(f"Error: {e}", flush=True)

if __name__ == "__main__":
    create_listener()