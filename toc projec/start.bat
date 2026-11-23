@echo off
echo ==========================================================
echo   Regular Expression to DFA Converter & Simulator (TOC)
echo ==========================================================
echo.
echo Opening interactive standalone visualizer in your browser...
start standalone.html
echo.
echo Starting local web server on http://localhost:5000 ...
echo (Press Ctrl+C to stop the server anytime)
start http://localhost:5000
node server.js
pause
