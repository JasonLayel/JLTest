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
echo [2/5] The Firebase tool.
where firebase >nul 2>nul
if not errorlevel 1 (
  echo       Already installed. Skipping.
  goto FIREBASERC
)
echo.
echo       This downloads several hundred small packages and takes
echo       anywhere from 2 to 10 minutes.
echo.
echo       You will see lines starting with "npm http fetch".
echo       They may stop for a minute at a time. That is still normal,
echo       it is unpacking. Do not close the window.
echo.
call npm install -g firebase-tools --loglevel=http
if errorlevel 1 goto FAILNPM
echo.
echo       Installed.
echo.

REM ---------- login ----------
:FIREBASERC
if not exist ".firebaserc" goto FBRCOK
findstr /i /c:"REPLACE-WITH" ".firebaserc" >nul 2>nul
if errorlevel 1 goto FBRCOK
echo       Clearing a leftover placeholder project id.
del ".firebaserc" >nul 2>nul
:FBRCOK
echo.

echo [3/5] Signing in to Google.
echo       A browser window will open. Pick the account your
echo       Firebase project is on, and allow access.
echo.
pause
call firebase login
if errorlevel 1 goto FAILGENERIC
echo.

if not exist ".firebaserc" goto PICKPROJECT
findstr /c:"projects" ".firebaserc" >nul 2>nul
if errorlevel 1 goto PICKPROJECT
findstr /c:"default" ".firebaserc" >nul 2>nul
if errorlevel 1 goto PICKPROJECT
echo       A project is already chosen. Skipping.
goto PROJECTOK

:PICKPROJECT
echo       Now pick your project from the list.
echo       Use the arrow keys, press Enter.
echo       When it asks for an alias, type:  default
echo.
pause
call firebase use --add
if errorlevel 1 goto FAILGENERIC
:PROJECTOK
echo.

REM ---------- secret ----------
echo [4/5] Your Anthropic API key.
echo.
echo       Ctrl+V does not reliably paste into a black console
echo       window, which is why this failed before. We will use
echo       Notepad instead, where paste definitely works.
echo.
echo       Notepad is about to open on an empty file. Do this:
echo         1. Paste your key     with Ctrl+V
echo         2. Save               with Ctrl+S
echo         3. Close Notepad      with the X
echo.
echo       Nothing else. No quotes, no spaces, no extra lines.
echo       This window carries on by itself once Notepad closes.
echo.
pause
if exist "anthropic-key.txt" del "anthropic-key.txt" >nul 2>nul
type nul > "anthropic-key.txt"
start /wait notepad "anthropic-key.txt"

powershell -NoProfile -Command "$k = Get-Content -Raw -ErrorAction SilentlyContinue 'anthropic-key.txt'; if ($k -eq $null) { $k = '' }; [IO.File]::WriteAllText('anthropic-key.txt', $k.Trim())"

for %%A in ("anthropic-key.txt") do set "KEYSIZE=%%~zA"
if "%KEYSIZE%"=="0" goto NOKEY
findstr /b /c:"sk-ant-" "anthropic-key.txt" >nul 2>nul
if errorlevel 1 goto BADKEY

echo       Key read. Saving it to Firebase.
call firebase functions:secrets:set ANTHROPIC_API_KEY --data-file "anthropic-key.txt"
set "SECRC=%ERRORLEVEL%"
del "anthropic-key.txt" >nul 2>nul
if not "%SECRC%"=="0" goto FAILSECRET
echo       Saved. The copy on your disk has been deleted.
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

:NOKEY
del "anthropic-key.txt" >nul 2>nul
echo.
echo The file was empty, so nothing was saved.
echo.
echo You need to paste the key into Notepad, press Ctrl+S to save,
echo and then close it. Closing without saving leaves it empty.
echo.
echo Run this file again when you have the key on your clipboard.
goto END

:BADKEY
del "anthropic-key.txt" >nul 2>nul
echo.
echo That did not look like an Anthropic key.
echo.
echo They begin with  sk-ant-
echo Check you copied the whole thing, with no quotes around it.
echo.
echo Run this file again to try once more.
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
echo.
echo If it said "Invalid project id", delete the file named
echo   .firebaserc
echo from this folder and run this again. It is a leftover
echo placeholder and it blocks every firebase command.
echo.
echo SETUP.md has a troubleshooting section at the bottom.
goto END

:END
echo.
pause
