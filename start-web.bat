@echo off
chcp 65001 >nul
title DMS - Web Only

echo [*] Starting Web Frontend only...
echo     URL: http://localhost:5173
echo.

cd /d "%~dp0"
npm run dev:web
