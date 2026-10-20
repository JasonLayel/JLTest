@echo off
REM Deploys Hearth. Run the one-time setup in SETUP.md first.
cd /d "%~dp0"
echo Deploying Hearth from %cd%
echo.
call firebase deploy --only functions,hosting
echo.
if errorlevel 1 (
  echo Deploy FAILED. Scroll up for the reason. SETUP.md has the common ones.
) else (
  echo Done. Open the Hosting URL above, then Settings, then Run voice check.
)
echo.
pause
