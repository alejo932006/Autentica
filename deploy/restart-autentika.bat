@echo off
title Reiniciar Autentika Backend
echo Reiniciando autentika-backend...
pm2 restart autentika-backend
if %errorlevel% neq 0 (
    echo Error al reiniciar. Verifica que PM2 este corriendo.
    pause
    exit /b 1
)
echo.
echo Listo.
pm2 list
pause
