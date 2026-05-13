@echo off
chcp 65001 >nul
title DMS - API Only

echo [*] Starting API Server only...
echo     URL: http://localhost:3000
echo.

cd /d "%~dp0"
npm run dev:api
