@echo off
chcp 65001 >nul
REM Kinntore App - local server launcher
REM Double-click this file to start a local server and open the app in your browser.

cd /d "%~dp0"

echo Starting local server...

start "" cmd /c "timeout /t 2 >nul && start http://localhost:5173"

call "%~dp0node_modules\.bin\serve.cmd" -l 5173 .

pause
