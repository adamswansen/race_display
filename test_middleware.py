import socket
import time
import random

def simulate_middleware():
    """Simulate the SimpleClient middleware behavior"""
    HOST = '127.0.0.1'
    PORT = 61611
    
    print("Starting middleware simulation...")
    
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((HOST, PORT))
            print("Connected to server")
            
            # Send greeting exactly as middleware does
            greeting = "SimpleClient~1.2.3~CTP01\r\n"
            s.send(greeting.encode('utf-8'))
            print(f"Sent greeting: {greeting.strip()}")
            
            # Get server response
            response = s.recv(1024).decode('utf-8')
            print(f"Received response: {response.strip()}")
            
            # If server sends init requests, get them
            num_requests = int(response.split('~')[2])
            print(f"Server expects {num_requests} init requests")
            
            for _ in range(num_requests):
                init_req = s.recv(1024).decode('utf-8')
                print(f"Got init request: {init_req.strip()}")
                s.send(b"ack~init\r\n")
            
            # Main data loop
            sequence = 1
            while True:
                try:
                    # Send ping
                    s.send(b"ping\r\n")
                    print("Sent ping")
                    
                    # Wait for ping ack
                    ack = s.recv(1024).decode('utf-8')
                    print(f"Got ack: {ack.strip()}")
                    
                    # Send test timing data
                    bib = str(random.randint(333, 337))  # Known good bibs
                    timestamp = time.strftime('%H:%M:%S.%f')[:-4]
                    timing_data = f"CT01_33~{sequence}~FINISH~{bib}~{timestamp}~0~TAG123~1\r\n"
                    s.send(timing_data.encode('utf-8'))
                    print(f"Sent timing data: {timing_data.strip()}")
                    sequence += 1
                    
                    # Wait between readings
                    time.sleep(5)
                    
                except Exception as e:
                    print(f"Error in data loop: {e}")
                    break
            
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    simulate_middleware() 