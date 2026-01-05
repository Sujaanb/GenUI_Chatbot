#!/bin/bash
echo "Starting JIRA Issue Analyzer Frontend..."
echo

cd "$(dirname "$0")/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Start the dev server
echo
echo "Starting frontend at http://localhost:3000"
echo "Press Ctrl+C to stop"
echo
npm run dev
