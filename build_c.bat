@echo off
REM Build script for C Dijkstra implementation (Windows)
echo 🔨 Building C Dijkstra program...

cd /d "%~dp0\TamilNadu_Router\pbf-map-router\src\backend"

REM Compile C program
gcc -o dijkstra_c.exe dijkstra_c.c -lm -O3

if %ERRORLEVEL% EQU 0 (
    echo ✅ C program compiled successfully!
    echo 📍 Executable: src/backend/dijkstra_c.exe
) else (
    echo ❌ Compilation failed!
    exit /b 1
)

echo 🚀 Ready to use C implementation!
