# Dividend FIRE Simulator

ETF 포트폴리오 기반 FIRE 시뮬레이터입니다.

## Windows 무설치판 v2 (추천)

**[⬇️ DividendFIRE-Tauri-Portable-v2.0.1.zip 다운로드](https://github.com/galcampdan/DividendFIRE/releases/download/v2.0.1/DividendFIRE-Tauri-Portable-v2.0.1.zip)**

1. ZIP 압축을 풉니다.
2. `DividendFIRE.exe`를 실행합니다.
3. 설치 과정이나 Python 설치가 필요하지 않습니다.
4. 외부 브라우저와 localhost 서버를 사용하지 않습니다.

v2 데스크톱판은 **Tauri + Windows WebView2** 기반이며 Web/PWA와 같은 JavaScript 시뮬레이션 코어를 사용합니다.

> 현재 배포파일은 코드서명되지 않았기 때문에 Windows SmartScreen에서 "알 수 없는 게시자" 경고가 표시될 수 있습니다. 실제 악성코드 탐지가 뜨는 경우에는 실행하지 마세요.

## 모바일 / Web PWA

모바일 대응 UI, Web App Manifest, Service Worker가 포함되어 있습니다. 휴대폰 브라우저에서 접속한 뒤 **홈 화면에 추가**하여 앱처럼 사용할 수 있습니다.

**[🌐 DividendFIRE Web/PWA 실행하기](https://galcampdan.github.io/DividendFIRE/)**

## 공용 계산 코어

```text
shared/simulation-core.js
        │
   ┌────┴────┐
   │         │
Web / PWA   Tauri Desktop
```

Web/PWA와 Windows v2가 같은 FIRE 계산 코어를 사용하도록 구조를 통합했습니다. deterministic 계산 테스트는 GitHub Actions에서 자동 실행됩니다.

## 보안 확인

v2.0.1 Portable ZIP SHA-256:

```text
D9391AEA8AEFD49EDB35A21BEBB74F119CBE5CBE0664BC4B1976EE46CF9CEE61
```

v2.0.1 Release에는 `TAURI_SHA256.txt`, `TAURI_SECURITY.txt`가 함께 제공되며 GitHub Actions의 ClamAV gate를 통과했습니다.

**[전체 최신 Release 보기](https://github.com/galcampdan/DividendFIRE/releases/latest)**

## Legacy v1

기존 Python/localhost 기반 v1.0.4도 이전 Release에서 계속 받을 수 있습니다.

**[v1.0.4 Release](https://github.com/galcampdan/DividendFIRE/releases/tag/v1.0.4)**

## 오픈소스 준비

향후 오픈소스 전환을 고려해 `ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `OPEN_SOURCE.md`를 정리해 두었습니다. 아직 오픈소스 라이선스는 확정하지 않았습니다.
