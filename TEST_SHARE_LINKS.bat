@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================
echo   DividendFIRE - compact share link QA
echo ======================================================

where python >nul 2>nul || (
  echo [ERROR] Python was not found in PATH.
  pause
  exit /b 1
)
where npm >nul 2>nul || (
  echo [ERROR] Node.js / npm was not found in PATH.
  pause
  exit /b 1
)

echo [1/5] Preparing static site...
python web\prepare_pages.py
if errorlevel 1 goto :FAIL

echo [2/5] Installing JavaScript dependencies...
call npm install
if errorlevel 1 goto :FAIL

echo [3/5] Installing Playwright browsers...
call npx playwright install chromium webkit
if errorlevel 1 goto :FAIL

echo [4/5] Starting local test server on port 4173...
start "" /b python -m http.server 4173 --directory site >nul 2>&1
timeout /t 2 /nobreak >nul

echo [5/5] Running mobile + share-link E2E...
call npm run test:mobile
set "ERR=%ERRORLEVEL%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1

if not "%ERR%"=="0" goto :FAIL
echo.
echo [OK] Compact share-link QA passed.
pause
exit /b 0

:FAIL
echo.
echo [ERROR] QA failed. Read the error above.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
pause
exit /b 1
