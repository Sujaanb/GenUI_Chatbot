#!/bin/bash
echo "Starting JIRA Issue Analyzer Backend..."
echo

cd "$(dirname "$0")/backend"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt -q

# Start the server
echo
echo "Starting server at http://localhost:8000"
echo "Press Ctrl+C to stop"
echo
python main.py
