@echo off
setlocal
cd /d "%~dp0"
title Hearth - first time setup

echo =============================================
echo   HEARTH - ONE TIME SETUP
echo =============================================
echo.
echo This window does the whole thing. It will stop and ask you
echo a few times. Read what it says, answer, and it carries on.
echo.
echo Before you start you need:
echo   1. A Firebase project, on the Blaze plan, with Firestore
echo      created. That is steps 1 to 3 of SETUP.md, all web pages.
echo   2. An Anthropic API key from console.anthropic.com
echo.
pause
echo.

REM ---------- Node ----------
where node >nul 2>nul
if errorlevel 1 goto NONODE
for /f "delims=" %%v in ('node --version') do set "NODEV=%%v"
echo [1/5] Node is installed (%NODEV%). Good.
echo.

REM ---------- firebase-tools ----------
echo [2/5] Installing the Firebase tool. This can take a few minutes.
echo       Lots of text will scroll past. That is normal.
echo.
call npm install -g firebase-tools
if errorlevel 1 goto FAILNPM
echo.
echo       Installed.
echo.

REM ---------- login ----------
echo [3/5] Signing in to Google.
echo       A browser window will open. Pick the account your
echo       Firebase project is on, and allow access.
echo.
pause
call firebase login
if errorlevel 1 goto FAILGENERIC
echo.

echo       Now pick your project from the list.
echo       Use the arrow keys, press Enter.
echo       When it asks for an alias, type:  default
echo.
pause
call firebase use --add
if errorlevel 1 goto FAILGENERIC
echo.

REM ---------- secret ----------
echo [4/5] Your Anthropic API key.
echo       Copy it from console.anthropic.com first.
echo       When it asks, paste it and press Enter.
echo       NOTHING APPEARS ON SCREEN while you paste. That is normal
echo       and does not mean it failed.
echo.
pause
call firebase functions:secrets:set ANTHROPIC_API_KEY
if errorlevel 1 goto FAILSECRET
echo.

REM ---------- deploy ----------
echo [5/5] Deploying. The first one takes a few minutes.
echo       If it asks permission to enable Google APIs, say yes.
echo.
pause
call firebase deploy --only functions,hosting
if errorlevel 1 goto FAILDEPLOY
echo.
echo =============================================
echo   DONE
echo =============================================
echo.
echo Scroll up a little and find the line saying "Hosting URL".
echo It looks like  https://something.web.app
echo.
echo That is your app. Open it, go to Settings, and click
echo "Run voice check" before anything else.
echo.
echo From now on, use "Deploy Hearth.bat" to push changes.
goto END

:NONODE
echo [1/5] Node.js is NOT installed, and this needs it.
echo.
echo   1. Go to  https://nodejs.org
echo   2. Download the big green LTS button, Windows version.
echo   3. Install it. Accept every default.
echo   4. Close this window, then double click this file again.
goto END

:FAILNPM
echo.
echo FAILED while installing the Firebase tool.
echo.
echo Most likely fix: close this window, right click this file,
echo choose "Run as administrator", and try again.
goto END

:FAILSECRET
echo.
echo FAILED while saving the API key.
echo.
echo If it said something about billing or Blaze, your project is
echo still on the free plan. Do step 2 of SETUP.md, then run this again.
goto END

:FAILDEPLOY
echo.
echo FAILED during deploy. The reason is in the text above.
echo.
echo Common ones:
echo  - "Firestore" or "database" in the message: the database was not
echo    created, or not named (default). See step 3 of SETUP.md.
echo  - "billing" or "Blaze": the project is on the free plan. Step 2.
echo  - "permission": see the troubleshooting part of SETUP.md.
goto END

:FAILGENERIC
echo.
echo That step did not finish. The reason is in the text above.
echo SETUP.md has a troubleshooting section at the bottom.
goto END

:END
echo.
pause
