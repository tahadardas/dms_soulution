@echo off
chcp 65001 >nul
title DMS SOULUTION - نظام نقاط البيع

echo ╔════════════════════════════════════════════════════════════╗
echo ║          DMS SOULUTION - نظام نقاط البيع                  ║
echo ║          POS / Accounting / Inventory System              ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo [!] node_modules غير موجود. سيتم تثبيت الحزم...
    echo [!] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [X] فشل تثبيت الحزم!
        pause
        exit /b 1
    )
)

echo.
echo [*] جاري تشغيل النظام...
echo [*] Starting the system...
echo.
echo     API Server:     http://localhost:3000
echo     Web Frontend:   http://localhost:5173
echo.
echo     لإيقاف النظام اضغط Ctrl+C
echo     Press Ctrl+C to stop the system
echo.
echo ════════════════════════════════════════════════════════════
echo.

:: Run the dev command which starts API, Web, and Desktop concurrently
npm run dev
