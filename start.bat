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

:: Install Node.js - try winget first, then direct download
echo       [!!] Not found. Installing...

:: Try winget
where winget >nul 2>nul
if %ERRORLEVEL% neq 0 goto :try_download_node
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements >nul 2>nul
if exist "%PROGRAMFILES%\nodejs\npm.cmd" (
    set "PATH=%PROGRAMFILES%\nodejs;%PATH%"
    echo       [ok] Installed via winget.
    goto :node_ok
)

:try_download_node
:: Download Node.js portable via PowerShell
echo       [setup] Downloading Node.js...
set "NODE_DIR=%~dp0.node"
set "NODE_URL=https://nodejs.org/dist/v20.18.3/node-v20.18.3-win-x64.zip"
set "NODE_ZIP=%TEMP%\node.zip"

powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%' -UseBasicParsing; Write-Host 'DOWNLOAD_OK' } catch { Write-Host 'DOWNLOAD_FAIL' }" 2>nul | findstr "DOWNLOAD_OK" >nul
if %ERRORLEVEL% neq 0 (
    echo       [error] Download failed.
    goto :fail_node
)

echo       [setup] Extracting...
powershell -Command "try { Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%NODE_DIR%' -Force; Write-Host 'EXTRACT_OK' } catch { Write-Host 'EXTRACT_FAIL' }" 2>nul | findstr "EXTRACT_OK" >nul
if %ERRORLEVEL% neq 0 (
    echo       [error] Extract failed.
    goto :fail_node
)
del "%NODE_ZIP%" >nul 2>nul

:: Find extracted folder and add to PATH
for /d %%D in ("%NODE_DIR%\node-*") do (
    set "PATH=%%D;%PATH%"
    echo       [ok] Node.js ready at %%D
    goto :node_ok
)
goto :fail_node

:fail_node
echo.
echo   ERROR: Cannot install Node.js automatically.
echo   Please install manually from https://nodejs.org/
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
