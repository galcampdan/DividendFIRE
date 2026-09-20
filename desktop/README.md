# Tauri Desktop

localhost 없는 데스크톱 셸입니다.

- Python 서버를 실행하지 않습니다.
- 외부 브라우저를 열지 않습니다.
- 공용 UI와 `shared/simulation-core.js`를 Tauri WebView에 내장합니다.
- Windows 10/11의 WebView2를 사용합니다.

```powershell
python web/prepare_pages.py
cd desktop
cargo tauri build --no-bundle
```
