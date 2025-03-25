# Race Display

A real-time race display system that shows runner information and timing data during races. This application connects to timing systems and displays runner information in a web interface.

## Features

- Real-time timing data display
- Runner information lookup
- Web-based interface
- TCP/IP connection to timing systems
- Support for multiple locations
- Gun times integration
- Authentication support

## Prerequisites

- Python 3.x
- Flask
- Required Python packages (see requirements.txt)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/race_display.git
cd race_display
```

2. Install the required packages:
```bash
pip install -r requirements.txt
```

3. Configure the application:
   - Copy `config.example.py` to `config.py`
   - Update the configuration settings in `config.py`

## Configuration

The application requires configuration in `config.py` for:
- API settings
- Protocol settings
- Server settings
- Random messages for display

## Usage

1. Start the application:
```bash
python app.py
```

2. Open a web browser and navigate to:
```
http://localhost:5000
```

3. Log in with your credentials and event ID

4. The display will automatically show runner information as timing data comes in

## Architecture

- Flask web server for the frontend interface
- TCP/IP server for receiving timing data
- Queue-based data processing
- Server-Sent Events (SSE) for real-time updates

## API Endpoints

- `/` - Main display page
- `/api/login` - Authentication endpoint
- `/stream` - SSE endpoint for real-time updates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 