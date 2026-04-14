@echo off
title Museum OLED Display

:: Navigate to script directory
cd /d "%~dp0"

:: =============================================
:: LOG FILE SETUP
:: =============================================
if not exist "logs" mkdir "logs"

:: Generate locale-independent timestamp via PowerShell
for /f "usebackq delims=" %%T in (`powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"`) do set "TIMESTAMP=%%T"

:: Fallback if PowerShell failed
if not defined TIMESTAMP (
    set "TIMESTAMP=unknown"
)

set "LOG_FILE=%~dp0logs\start_%TIMESTAMP%.log"

call :LOG "============================================================"
call :LOG "  Museum OLED Display - Setup"
call :LOG "  Started: %DATE% %TIME%"
call :LOG "  Log: %LOG_FILE%"
call :LOG "============================================================"
call :LOG ""

:: =============================================
:: STEP 1: Find or install Python
:: =============================================
call :LOG "[1/3] Checking Python..."

py -3 --version >nul 2>nul
if %ERRORLEVEL% == 0 (
    set "PYTHON_CMD=py -3"
    call :LOG "      [ok] Found via py launcher."
    goto :python_ok
)

python -c "print('ok')" >nul 2>nul
if %ERRORLEVEL% == 0 (
    set "PYTHON_CMD=python"
    call :LOG "      [ok] Found in PATH."
    goto :python_ok
)

:: Search common install locations
for %%V in (313 312 311 310 39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        call :LOG "      [ok] Found at %LOCALAPPDATA%\Programs\Python\Python%%V\"
        goto :python_ok
    )
)
for %%V in (313 312 311 310 39) do (
    if exist "C:\Python%%V\python.exe" (
        set "PYTHON_CMD=C:\Python%%V\python.exe"
        call :LOG "      [ok] Found at C:\Python%%V\"
        goto :python_ok
    )
)
for %%V in (313 312 311 310 39) do (
    if exist "%PROGRAMFILES%\Python%%V\python.exe" (
        set "PYTHON_CMD=%PROGRAMFILES%\Python%%V\python.exe"
        call :LOG "      [ok] Found at %PROGRAMFILES%\Python%%V\"
        goto :python_ok
    )
)

:: Try installing via winget
call :LOG "      [--] Not found. Trying winget..."
where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :try_download_python

call :LOG "      [setup] Installing Python via winget..."
winget install Python.Python.3.12 --accept-package-agreements --accept-source-agreements >> "%LOG_FILE%" 2>&1
if %ERRORLEVEL% neq 0 goto :try_download_python

:: After winget install, find it
for %%V in (313 312 311 310) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        call :LOG "      [ok] Installed at %LOCALAPPDATA%\Programs\Python\Python%%V\"
        goto :python_ok
    )
)
goto :try_download_python

:try_download_python
:: Download Python installer directly from python.org
call :LOG "      [--] Downloading Python installer from python.org..."
set "PY_INSTALLER=%TEMP%\python-installer.exe"
set "PY_URL=https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe"

powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%PY_URL%' -OutFile '%PY_INSTALLER%' -UseBasicParsing } catch { exit 1 }" >> "%LOG_FILE%" 2>&1
if %ERRORLEVEL% neq 0 (
    call :LOG "      [error] Download failed. Check internet connection."
    goto :fail_python
)

call :LOG "      [setup] Installing Python silently (this may take a minute)..."
"%PY_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 >> "%LOG_FILE%" 2>&1
if %ERRORLEVEL% neq 0 (
    call :LOG "      [error] Python installer failed."
    del "%PY_INSTALLER%" >nul 2>nul
    goto :fail_python
)
del "%PY_INSTALLER%" >nul 2>nul

:: After download install, find it
for %%V in (313 312 311 310) do (
    if exist "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe" (
        set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        call :LOG "      [ok] Installed at %LOCALAPPDATA%\Programs\Python\Python%%V\"
        goto :python_ok
    )
)
goto :fail_python

:fail_python
call :LOG ""
call :LOG "  ERROR: Cannot find or install Python."
call :LOG "  Tried: PATH, common locations, winget, and direct download."
call :LOG "  Install manually from https://www.python.org/downloads/"
call :LOG "  See log: %LOG_FILE%"
call :LOG ""
pause
exit /b 1

:python_ok
call :LOG ""

:: =============================================
:: STEP 2: Find or install Node.js
:: =============================================
call :LOG "[2/3] Checking Node.js..."

:: Skip if frontend already built
if exist "%~dp0dist\index.html" (
    call :LOG "      [ok] Frontend already built, skipping Node.js."
    goto :node_ok
)

call npm --version >nul 2>nul
if %ERRORLEVEL% == 0 (
    call :LOG "      [ok] Found in PATH."
    goto :node_ok
)

:: Search common install locations
if exist "%PROGRAMFILES%\nodejs\npm.cmd" (
    set "PATH=%PROGRAMFILES%\nodejs;%PATH%"
    call :LOG "      [ok] Found at %PROGRAMFILES%\nodejs\"
    goto :node_ok
)

:: Extract bundled Node.js from tools/
call :LOG "      [--] Not found. Extracting bundled Node.js..."
set "NODE_DIR=%~dp0.node"
set "NODE_ZIP=%~dp0tools\node-v20.18.3-win-x64.zip"

:: Check if already extracted
for /d %%D in ("%NODE_DIR%\node-*") do (
    set "PATH=%%D;%PATH%"
    call :LOG "      [ok] Already extracted at %%D"
    goto :node_ok
)

:: Check bundled zip exists
if not exist "%NODE_ZIP%" (
    call :LOG "      [error] Bundled Node.js not found at tools\"
    goto :fail_node
)

call :LOG "      [setup] Extracting (this may take a moment)..."
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_DIR%' -Force" >> "%LOG_FILE%" 2>&1
if %ERRORLEVEL% neq 0 (
    call :LOG "      [error] Extract failed."
    goto :fail_node
)

:: Add extracted folder to PATH
for /d %%D in ("%NODE_DIR%\node-*") do (
    set "PATH=%%D;%PATH%"
    call :LOG "      [ok] Node.js ready at %%D"
    goto :node_ok
)
goto :fail_node

:fail_node
call :LOG ""
call :LOG "  ERROR: Cannot set up Node.js."
call :LOG "  Make sure tools\node-v20.18.3-win-x64.zip exists."
call :LOG "  See log: %LOG_FILE%"
call :LOG ""
pause
exit /b 1

:node_ok
call :LOG ""

:: =============================================
:: STEP 3: Run start.py
:: =============================================
call :LOG "[3/3] Starting application..."
call :LOG ""

%PYTHON_CMD% "%~dp0start.py" --log-file "%LOG_FILE%"
set "PYEXIT=%ERRORLEVEL%"

call :LOG ""
call :LOG "[info] Exited with code: %PYEXIT%"
if %PYEXIT% neq 0 (
    call :LOG "[info] See log: %LOG_FILE%"
)
call :LOG ""
pause
goto :eof

:: =============================================
:: LOG subroutine: echo to console AND append to file
:: =============================================
:LOG
echo %~1
>> "%LOG_FILE%" echo [%TIME%] %~1
goto :eof
