@echo off
echo Starting JIRA Issue Analyzer Backend...
echo.

cd /d "%~dp0backend"

REM Check if virtual environment exists and is working
if exist "venv\Scripts\python.exe" (
    echo Using existing virtual environment...
) else (
    echo Creating virtual environment...
    if exist "venv" rmdir /s /q venv
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate

REM Install/update dependencies
echo Installing dependencies...
pip install --upgrade pip -q
pip install -r requirements.txt

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies. Please check requirements.txt
    pause
    exit /b 1
)

REM Start the server
echo.
echo Starting server at http://localhost:8000
echo API Documentation at http://localhost:8000/docs
echo Press Ctrl+C to stop
echo.
python main.py

pause
