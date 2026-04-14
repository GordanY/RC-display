@echo off
title Museum OLED Display
echo.
echo ============================================================
echo   Museum OLED Display - Setup
echo ============================================================
echo.

:: =============================================
:: STEP 1: Find or install Python
:: =============================================
echo [1/3] Checking Python...

py -3 --version >nul 2>nul
if %ERRORLEVEL% == 0 (
    set "PYTHON_CMD=py -3"
    echo       [ok] Found via py launcher.
    goto :python_ok
)

python -c "print('ok')" >nul 2>nul
if %ERRORLEVEL% == 0 (
    set "PYTHON_CMD=python"
    echo       [ok] Found in PATH.
    goto :python_ok
)

:: Search common install locations
for %%V in (313 312 311 310 39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        echo       [ok] Found at %LOCALAPPDATA%\Programs\Python\Python%%V\
        goto :python_ok
    )
)
for %%V in (313 312 311 310 39) do (
    if exist "C:\Python%%V\python.exe" (
        set "PYTHON_CMD=C:\Python%%V\python.exe"
        echo       [ok] Found at C:\Python%%V\
        goto :python_ok
    )
)
for %%V in (313 312 311 310 39) do (
    if exist "%PROGRAMFILES%\Python%%V\python.exe" (
        set "PYTHON_CMD=%PROGRAMFILES%\Python%%V\python.exe"
        echo       [ok] Found at %PROGRAMFILES%\Python%%V\
        goto :python_ok
    )
)

:: Install Python
echo       [!!] Not found. Installing via winget...
where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :fail_python
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if %ERRORLEVEL% neq 0 goto :fail_python

:: After install, find it
for %%V in (313 312 311 310) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        echo       [ok] Installed at %LOCALAPPDATA%\Programs\Python\Python%%V\
        goto :python_ok
    )
)
goto :fail_python

:fail_python
echo.
echo   ERROR: Cannot find or install Python.
echo   Install manually from https://www.python.org/downloads/
echo.
pause
exit /b 1

:python_ok
echo.

:: =============================================
:: STEP 2: Find or install Node.js
:: =============================================
echo [2/3] Checking Node.js...

:: Skip if frontend already built
if exist "%~dp0dist\index.html" (
    echo       [ok] Frontend already built, skipping Node.js.
    goto :node_ok
)

call npm --version >nul 2>nul
if %ERRORLEVEL% == 0 (
    echo       [ok] Found in PATH.
    goto :node_ok
)

:: Search common install locations
if exist "%PROGRAMFILES%\nodejs\npm.cmd" (
    set "PATH=%PROGRAMFILES%\nodejs;%PATH%"
    echo       [ok] Found at %PROGRAMFILES%\nodejs\
    goto :node_ok
)

:: Install Node.js
echo       [!!] Not found. Installing via winget...
where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :fail_node
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
if %ERRORLEVEL% neq 0 goto :fail_node

:: Add to PATH for this session
if exist "%PROGRAMFILES%\nodejs\npm.cmd" (
    set "PATH=%PROGRAMFILES%\nodejs;%PATH%"
    echo       [ok] Installed at %PROGRAMFILES%\nodejs\
    goto :node_ok
)
goto :fail_node

:fail_node
echo.
echo   ERROR: Cannot find or install Node.js.
echo   Install manually from https://nodejs.org/
echo.
pause
exit /b 1

:node_ok
echo.

:: =============================================
:: STEP 3: Run start.py
:: =============================================
echo [3/3] Starting application...
echo.

%PYTHON_CMD% "%~dp0start.py"

echo.
echo [info] Exited with code: %ERRORLEVEL%
echo.
pause
