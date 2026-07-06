@echo off
title Reiniciar Autentika Tunnel
echo Reiniciando autentika-tunnel...
pm2 restart autentika-tunnel
if %errorlevel% neq 0 (
    echo Error al reiniciar. Verifica que PM2 este corriendo.
    pause
    exit /b 1
)
echo.
echo Listo.
pm2 list
pause
