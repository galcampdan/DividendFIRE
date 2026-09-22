@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not exist "RELEASE_VERSION" (
  echo [ERROR] RELEASE_VERSION was not found.
  pause
  exit /b 1
)

set /p RELEASE_TAG=<RELEASE_VERSION
if not defined RELEASE_TAG (
  echo [ERROR] RELEASE_VERSION is empty.
  pause
  exit /b 1
)
if /i not "%RELEASE_TAG:~0,1%"=="v" (
  echo [ERROR] RELEASE_VERSION must look like v2.0.9
  pause
  exit /b 1
)

set "APP_VERSION=%RELEASE_TAG:~1%"
set "INSTALLER_NAME=DividendFIRE-Setup-%RELEASE_TAG%.exe"

echo ======================================================
echo   Dividend FIRE - legacy Windows installer builder
echo   Version: %RELEASE_TAG%
echo   Output : release\%INSTALLER_NAME%
echo ======================================================

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3 was not found in PATH.
  pause
  exit /b 1
)

if not exist ".buildenv\Scripts\python.exe" (
  echo [1/6] Creating isolated build environment...
  python -m venv .buildenv
  if errorlevel 1 goto :FAIL
)

call ".buildenv\Scripts\activate.bat"

echo [2/6] Installing standard build tool...
python -m pip install --upgrade pip pyinstaller
if errorlevel 1 goto :FAIL

echo [3/6] Verifying distribution sources...
python verify_distribution.py
if errorlevel 1 goto :FAIL

echo [4/6] Building standard PyInstaller ONEDIR app...
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul
python -m PyInstaller --clean --noconfirm DividendFIRE.spec
if errorlevel 1 goto :FAIL

echo [5/6] Locating Inno Setup...
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
echo [6/6] Building installer...
if not exist release mkdir release
"%ISCC%" "/DMyAppVersion=%APP_VERSION%" "installer\DividendFIRE.iss"
if errorlevel 1 goto :FAIL

if not exist "release\%INSTALLER_NAME%" (
  echo [ERROR] Expected installer was not created: release\%INSTALLER_NAME%
  goto :FAIL
)

echo.
echo ======================================================
echo [OK] Legacy installer created:
echo %CD%\release\%INSTALLER_NAME%
echo ======================================================
echo.
echo General users DO NOT need Python.
echo The recommended public build is the Tauri Portable release.
pause
exit /b 0

:FAIL
echo.
echo [ERROR] Build failed. Read the error above.
pause
exit /b 1
