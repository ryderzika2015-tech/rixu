@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Install Node.js LTS, then reopen this window.
 pause
 exit /b 1
)
echo Open http://127.0.0.1:4173/ after the server starts.
echo Stop the old server first. Keep this window open.
node tools/serve.mjs
pause
