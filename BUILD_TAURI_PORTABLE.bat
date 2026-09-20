@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where cargo >nul 2>nul || (echo [ERROR] Rust/Cargo가 필요합니다. GitHub Actions에서는 자동 설치됩니다.&pause&exit /b 1)
python web\prepare_pages.py || exit /b 1
pushd desktop
cargo tauri build --no-bundle
set ERR=%ERRORLEVEL%
popd
if not "%ERR%"=="0" exit /b %ERR%
echo Built: desktop\src-tauri\target\release\dividend-fire.exe
pause
