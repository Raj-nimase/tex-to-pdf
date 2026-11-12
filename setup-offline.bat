@echo off
cd /d "%~dp0"
echo ====================================================
echo  Setting up LaTeX to PDF Engine for OFFLINE Use
echo ====================================================
node scripts/setup-offline.js
pause
