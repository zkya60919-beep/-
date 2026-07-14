@echo off

REM Kill any existing node processes
for /f "tokens=2 delims=" %i in ('tasklist /FI "IMAGENAME eq node.exe" /FO TABLE') do (
    echo Killing process %i
    taskkill /F /PID %i >nul 2>&1
)

REM Wait a moment
echo Waiting for processes to terminate...
sleep 2 > nul

REM Change to project directory and start server
cd "C:\Users\microsoft\OneDrive\Documents\ØªØ¹Ø¯Ù_Ù_ Ù_Ù_ØµÙ_ Ø§Ù_Ø¨Ø§Ø³Ø· (3)\تعديل منصه الباسط\تعديل منصه الباسط\منصه الباسط\منصه الباسط"

REM Check if .env exists
if not exist ".env" (
    echo Copying .env.example to .env
    copy ".env.example" ".env"
)

REM Start server
echo Starting server...
node server.js
