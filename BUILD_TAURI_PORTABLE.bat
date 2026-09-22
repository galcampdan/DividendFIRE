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

set "PORTABLE_NAME=DividendFIRE-Tauri-Portable-%RELEASE_TAG%.zip"

echo ======================================================
echo   Dividend FIRE - Tauri portable builder
echo   Version: %RELEASE_TAG%
echo   Output : release\%PORTABLE_NAME%
echo ======================================================

where python >nul 2>nul || (
  echo [ERROR] Python was not found in PATH.
  pause
  exit /b 1
)

where cargo >nul 2>nul || (
  echo [ERROR] Rust/Cargo is required.
  pause
  exit /b 1
)

cargo tauri --version >nul 2>nul || (
  echo [ERROR] Tauri CLI is required.
  echo Install it, for example: npm install --global @tauri-apps/cli@latest
  pause
  exit /b 1
)

echo [1/4] Building static frontend...
python web\prepare_pages.py
if errorlevel 1 goto :FAIL

echo [2/4] Building Tauri executable...
pushd desktop
cargo tauri build --no-bundle
set "ERR=%ERRORLEVEL%"
popd
if not "%ERR%"=="0" goto :FAIL

set "EXE_SOURCE=desktop\src-tauri\target\release\dividend-fire.exe"
if not exist "%EXE_SOURCE%" (
  echo [ERROR] Built executable was not found: %EXE_SOURCE%
  goto :FAIL
)

echo [3/4] Packaging portable ZIP...
if not exist "release" mkdir "release"
copy /y "%EXE_SOURCE%" "release\DividendFIRE.exe" >nul
(
  echo Dividend FIRE Simulator - Tauri Portable
  echo.
  echo DividendFIRE.exe를 실행하세요.
  echo 설치, Python, localhost 서버가 필요하지 않습니다.
  echo Windows 10/11의 Microsoft Edge WebView2를 사용합니다.
) > "release\PORTABLE_README.txt"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path 'release\DividendFIRE.exe','release\PORTABLE_README.txt' -DestinationPath 'release\%PORTABLE_NAME%' -CompressionLevel Optimal -Force"
if errorlevel 1 goto :FAIL

echo [4/4] Computing SHA-256...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$h=(Get-FileHash 'release\%PORTABLE_NAME%' -Algorithm SHA256).Hash; 'SHA256  ' + $h + '  %PORTABLE_NAME%' | Out-File 'release\TAURI_SHA256.txt' -Encoding ascii"
if errorlevel 1 goto :FAIL

echo.
echo ======================================================
echo [OK] Portable build created:
echo %CD%\release\%PORTABLE_NAME%
echo %CD%\release\TAURI_SHA256.txt
echo ======================================================
pause
exit /b 0

:FAIL
echo.
echo [ERROR] Build failed. Read the error above.
pause
exit /b 1
