@echo off
echo Starting JIRA Issue Analyzer Frontend...
echo.

cd /d "%~dp0frontend"

REM Delete node_modules if it exists but is corrupted
if exist "node_modules\.package-lock.json" (
    echo Using existing node_modules...
) else (
    if exist "node_modules" rmdir /s /q node_modules
    echo Installing dependencies...
    npm install
    
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo Retrying with --legacy-peer-deps...
        npm install --legacy-peer-deps
    )
)

REM Start the dev server
echo.
echo Starting frontend at http://localhost:3000
echo Press Ctrl+C to stop
echo.
npm run dev

pause
