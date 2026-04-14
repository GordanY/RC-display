@echo off
title Museum OLED Display
echo.
echo ============================================================
echo   Museum OLED Display - Setup
echo ============================================================
echo.

:: Try "py" launcher first - most reliable on Windows
:: (never confused with the Windows Store stub)
py -3 --version >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [ok] Python found via py launcher.
    echo [ok] Running start.py ...
    echo.
    py -3 "%~dp0start.py" 2>&1
    echo.
    echo [info] start.py exited with code: %ERRORLEVEL%
    echo.
    pause
    goto :eof
)

:: Try "python" but verify it ACTUALLY runs (not just the Store stub)
:: The Store stub returns 9009 when you try to run a real script
python -c "import sys; sys.exit(0)" >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [ok] Python found.
    echo [ok] Running start.py ...
    echo.
    python "%~dp0start.py" 2>&1
    echo.
    echo [info] start.py exited with code: %ERRORLEVEL%
    echo.
    pause
    goto :eof
)

:: Nothing works - Python is not really installed
echo.
echo ============================================================
echo   Python is NOT installed (or only the Microsoft Store
echo   stub exists, which does not work).
echo.
echo   To fix this:
echo.
echo   1. Go to https://www.python.org/downloads/
echo   2. Click "Download Python 3.12"
echo   3. Run the installer
echo   4. CHECK THE BOX: "Add Python to PATH" (at the bottom!)
echo   5. Click "Install Now"
echo   6. At the end, click "Disable path length limit"
echo   7. Close this window and double-click start.bat again
echo.
echo   Do NOT use the Microsoft Store version of Python.
echo ============================================================
echo.
pause
exit /b 1
