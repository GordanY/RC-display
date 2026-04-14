@echo off
title Museum OLED Display
echo.
echo ============================================================
echo   Museum OLED Display — Setup
echo ============================================================
echo.

:: Check for Python
where python >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [ok] Python found.
    goto :run
)

where python3 >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [ok] Python3 found.
    set PYTHON_CMD=python3
    goto :run_python3
)

:: Python not found — try to install
echo [setup] Python not found. Attempting to install...
echo.

:: Try winget first
where winget >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [setup] Installing Python via winget...
    winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    if %ERRORLEVEL% == 0 (
        echo [setup] Python installed. You may need to restart this script.
        echo [setup] If 'python' is still not found, close and reopen this window.
        pause
        goto :run
    )
)

:: Winget failed or not available
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
python "%~dp0start.py"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [error] Script exited with an error.
    pause
)
goto :eof

:run_python3
python3 "%~dp0start.py"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [error] Script exited with an error.
    pause
)
goto :eof
