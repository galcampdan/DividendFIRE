@echo off
setlocal
cd /d "%~dp0"

echo [1/2] Running shared tax/health core tests...
where node >nul 2>nul || (
  echo ERROR: Node.js is not installed or not on PATH.
  exit /b 1
)
node tests\simulation-core.test.js || exit /b 1

echo.
echo [2/2] Building the static Pages site...
where python >nul 2>nul || (
  echo ERROR: Python is not installed or not on PATH.
  exit /b 1
)
python web\prepare_pages.py || exit /b 1

echo.
echo PASS: 2026 tax/health core tests and static-site build completed.
echo Output: site\
pause
