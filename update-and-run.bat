@echo off
title Museum OLED Display - Auto Update
echo.
echo ============================================================
echo   Museum OLED Display - Checking for updates...
echo ============================================================
echo.

:: Navigate to project directory
cd /d "%~dp0"

:: Check if Git is available
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [warning] Git not found - skipping update check.
    goto :start_docker
)

:: Pull latest changes from GitHub
echo [update] Pulling latest from GitHub...
git pull origin master
if %ERRORLEVEL% neq 0 (
    echo [warning] Git pull failed - starting with current version.
)
echo.

:start_docker
:: Wait for Docker to be ready
echo [docker] Waiting for Docker Desktop...
:wait_docker
docker info >nul 2>nul
if %ERRORLEVEL% neq 0 (
    timeout /t 5 /nobreak >nul
    goto :wait_docker
)
echo [docker] Docker is ready.
echo.

:: Build and start in detached mode
echo [docker] Building and starting...
docker compose up --build -d

if %ERRORLEVEL% neq 0 (
    echo.
    echo [error] Docker failed to start.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Museum display is running!
echo.
echo   Kiosk:  http://localhost:8080
echo   Admin:  http://localhost:8080/admin
echo ============================================================
echo.

:: Wait a moment for the server to start, then open browser
timeout /t 3 /nobreak >nul
start http://localhost:8080

:: Keep window open to show logs
echo [info] Showing container logs (Ctrl+C to stop)...
echo.
docker compose logs -f
