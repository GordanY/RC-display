@echo off
title Museum OLED Display
echo.
echo ============================================================
echo   Museum OLED Display - Docker Launcher
echo ============================================================
echo.

:: Check if Docker is running
docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [error] Docker is not running.
    echo.
    echo   Please start Docker Desktop first, then run this again.
    echo   Download: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

echo [ok] Docker is running.
echo [ok] Building and starting the museum display...
echo.

docker compose up --build

echo.
echo [info] Server stopped.
pause
