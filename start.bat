@echo off
title Museum OLED Display
echo.
echo ============================================================
echo   Museum OLED Display - Setup
echo ============================================================
echo.

:: --- Try py launcher first (most reliable) ---
py -3 --version >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [ok] Python found via py launcher.
    goto :run_py
)

:: --- Try python with actual code execution ---
python -c "print('ok')" >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo [ok] Python found.
    goto :run_python
)

:: --- Python not in PATH - search common install locations ---
echo [setup] Python not in PATH. Searching common locations...

:: Check standard python.org install paths
for %%V in (313 312 311 310 39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        echo [ok] Found Python at: %LOCALAPPDATA%\Programs\Python\Python%%V\
        set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        goto :run_found
    )
)
for %%V in (313 312 311 310 39) do (
    if exist "C:\Python%%V\python.exe" (
        echo [ok] Found Python at: C:\Python%%V\
        set "PYTHON_EXE=C:\Python%%V\python.exe"
        goto :run_found
    )
)
for %%V in (313 312 311 310 39) do (
    if exist "%PROGRAMFILES%\Python%%V\python.exe" (
        echo [ok] Found Python at: %PROGRAMFILES%\Python%%V\
        set "PYTHON_EXE=%PROGRAMFILES%\Python%%V\python.exe"
        goto :run_found
    )
)

:: --- Not found anywhere - install it ---
echo [setup] Python not found. Attempting to install...
echo.

where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :manual_install

echo [setup] Installing Python via winget...
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if %ERRORLEVEL% neq 0 goto :manual_install

echo.
echo [setup] Python installed.
echo [setup] Please CLOSE this window and double-click start.bat again.
echo.
pause
exit /b 0

:manual_install
echo ============================================================
echo   Python could not be found or installed automatically.
echo.
echo   Please install from: https://www.python.org/downloads/
echo   IMPORTANT: Check "Add Python to PATH" during install!
echo ============================================================
echo.
pause
exit /b 1

:run_py
echo [ok] Running start.py ...
echo.
py -3 "%~dp0start.py"
goto :done

:run_python
echo [ok] Running start.py ...
echo.
python "%~dp0start.py"
goto :done

:run_found
echo [ok] Running start.py ...
echo.
"%PYTHON_EXE%" "%~dp0start.py"
goto :done

:done
echo.
echo [info] start.py exited with code: %ERRORLEVEL%
echo.
pause
