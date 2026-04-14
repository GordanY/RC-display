@echo off
title Museum OLED Display
echo.
echo ============================================================
echo   Museum OLED Display - Setup
echo ============================================================
echo.

:: Check for Python
where python >nul 2>nul
if %ERRORLEVEL% == 0 goto :run

where python3 >nul 2>nul
if %ERRORLEVEL% == 0 goto :run_python3

:: Python not found - try to install
echo [setup] Python not found. Attempting to install...
echo.

where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :no_winget

echo [setup] Installing Python via winget...
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if %ERRORLEVEL% neq 0 goto :install_failed

echo.
echo [setup] Python installed successfully.
echo [setup] Please CLOSE this window and double-click start.bat again.
echo [setup] (PATH needs to refresh for the new Python installation)
echo.
pause
exit /b 0

:no_winget
:install_failed
echo.
echo ============================================================
echo   Python is not installed and could not be auto-installed.
echo.
echo   Please install Python manually:
echo     1. Go to https://www.python.org/downloads/
echo     2. Download and install Python 3.12+
echo     3. IMPORTANT: Check "Add Python to PATH" during install
echo     4. Re-run this script
echo ============================================================
echo.
pause
exit /b 1

:run
echo [ok] Python found.
python "%~dp0start.py"
if %ERRORLEVEL% neq 0 pause
goto :eof

:run_python3
echo [ok] Python3 found.
python3 "%~dp0start.py"
if %ERRORLEVEL% neq 0 pause
goto :eof
