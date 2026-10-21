@echo off
setlocal
cd /d "%~dp0"
title Hearth - fix the Firebase install
set "LOG=%~dp0setup-log.txt"

echo =============================================
echo   FIXING THE FIREBASE TOOL INSTALL
echo =============================================
echo.
echo Everything here is also written to:
echo   %LOG%
echo If this still fails, send that file to Claude.
echo.
pause
echo.

echo Hearth setup log > "%LOG%"
echo %DATE% %TIME% >> "%LOG%"
echo. >> "%LOG%"

echo [1/4] Checking what is installed.
echo --- versions --- >> "%LOG%"
call node -v >> "%LOG%" 2>&1
call npm -v >> "%LOG%" 2>&1
for /f "delims=" %%a in ('node -v 2^>nul') do echo       Node %%a
for /f "delims=" %%a in ('npm -v 2^>nul') do echo       npm  %%a
echo.

echo [2/4] Checking how npm reaches the internet.
echo       A proxy set here is the usual cause of a silent hang.
echo --- npm config --- >> "%LOG%"
call npm config get registry >> "%LOG%" 2>&1
call npm config get proxy >> "%LOG%" 2>&1
call npm config get https-proxy >> "%LOG%" 2>&1
call npm config get strict-ssl >> "%LOG%" 2>&1
for /f "delims=" %%a in ('npm config get registry 2^>nul') do echo       registry: %%a
for /f "delims=" %%a in ('npm config get proxy 2^>nul') do echo       proxy:    %%a
for /f "delims=" %%a in ('npm config get https-proxy 2^>nul') do echo       https:    %%a
echo.
echo       "null" for the proxies is correct and normal.
echo.

echo [3/4] Clearing the half-finished download.
echo --- cache clean --- >> "%LOG%"
call npm cache clean --force >> "%LOG%" 2>&1
echo       Done.
echo.

echo [4/4] Installing again, this time showing every file.
echo.
echo       You WILL see lines scrolling. If they stop for more than
echo       3 minutes, it has genuinely failed. Close the window and
echo       send setup-log.txt to Claude.
echo.
pause
echo --- install --- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm install -g firebase-tools --loglevel=http --no-audit --no-fund --fetch-timeout=60000 --fetch-retries=2 2>&1 | Tee-Object -FilePath '%LOG%' -Append"
echo.

echo --- where firebase --- >> "%LOG%"
call where firebase >> "%LOG%" 2>&1
where firebase >nul 2>nul
if errorlevel 1 goto STILLBAD

echo =============================================
echo   IT WORKED
echo =============================================
echo.
for /f "delims=" %%a in ('firebase --version 2^>nul') do echo   Firebase tool version %%a
echo.
echo   Now close this window and double-click
echo   "First Time Setup.bat" again.
echo   It will skip past this part quickly.
goto END

:STILLBAD
echo =============================================
echo   STILL NOT WORKING
echo =============================================
echo.
echo   Send this file to Claude:
echo     %LOG%
echo.
echo   It is in the same folder as this one. Attach it
echo   to the chat and it will say what went wrong.
goto END

:END
echo.
pause
