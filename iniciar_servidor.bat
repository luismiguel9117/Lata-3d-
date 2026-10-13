@echo off
title Servidor Local Three.js - Visor 3D Lata
echo ========================================================
echo    Iniciando Servidor Web Local para el Modelo 3D
echo ========================================================
echo.
echo Abriendo navegador en http://localhost:8080 ...
echo (Para detener el servidor, cierra esta ventana)
echo.

start http://localhost:8080/

python -m http.server 8080
if %ERRORLEVEL% NEQ 0 (
    echo Python no encontrado, intentando con Node.js...
    npx -y serve -p 8080 .
)
pause
