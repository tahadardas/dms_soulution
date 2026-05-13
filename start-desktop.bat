@echo off
chcp 65001 >nul
title DMS - Desktop App

echo [*] Starting Electron Desktop App...
echo.

cd /d "%~dp0"
npm run dev:desktop
