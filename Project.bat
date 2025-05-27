@echo off

:: 1. Instala dependencias si no existen (solo la primera vez)
IF NOT EXIST "node_modules" (
  echo Instalando dependencias...
  call npm install express socket.io multer
)

:: 2. Ejecuta el script para arreglar el SVG (agrega IDs a los paises)
IF EXIST "add_ids_to_svg.js" (
  echo Corrigiendo SVG...
  call node add_ids_to_svg.js
)

:: 3. Arranca el servidor
echo Iniciando el servidor...
call node server.js

pause