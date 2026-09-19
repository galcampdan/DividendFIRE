@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================================
echo   Dividend FIRE - public Windows installer builder
echo   Output: release\DividendFIRE-Setup-v1.0.0.exe
echo ======================================================

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3 was not found in PATH.
  pause
  exit /b 1
)

if not exist ".buildenv\Scripts\python.exe" (
  echo [1/5] Creating isolated build environment...
  python -m venv .buildenv
  if errorlevel 1 goto :FAIL
)

call ".buildenv\Scripts\activate.bat"

echo [2/5] Installing standard build tool...
python -m pip install --upgrade pip pyinstaller
if errorlevel 1 goto :FAIL

echo [3/5] Building standard PyInstaller ONEDIR app...
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul
python -m PyInstaller --clean --noconfirm DividendFIRE.spec
if errorlevel 1 goto :FAIL

echo [4/5] Locating Inno Setup...
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ISCC%" goto :HAVE_ISCC
set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%ISCC%" goto :HAVE_ISCC

where winget >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Inno Setup 6 is not installed and winget is unavailable.
  echo Install Inno Setup 6 from JRSoftware, then rerun this file.
  goto :FAIL
)
echo Installing Inno Setup 6 with winget...
winget install --id JRSoftware.InnoSetup -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :FAIL

set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" (
  echo [ERROR] Inno Setup installation completed but ISCC.exe was not found.
  goto :FAIL
)

:HAVE_ISCC
echo [5/5] Building installer...
if not exist release mkdir release
"%ISCC%" "installer\DividendFIRE.iss"
if errorlevel 1 goto :FAIL

echo.
echo ======================================================
echo [OK] Public installer created:
echo %CD%\release\DividendFIRE-Setup-v1.0.0.exe
echo ======================================================
echo.
echo General users DO NOT need Python.
echo Do not distribute files from the dist folder; distribute the Setup EXE.
pause
exit /b 0

:FAIL
echo.
echo [ERROR] Build failed. Read the error above.
pause
exit /b 1
