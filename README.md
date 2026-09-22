# Dividend FIRE Simulator

ETF 포트폴리오 기반 FIRE 시뮬레이터입니다.

## 모바일 / Web PWA

모바일 대응 UI, Web App Manifest, Service Worker가 포함되어 있습니다. 휴대폰 브라우저에서 접속한 뒤 **홈 화면에 추가**하여 앱처럼 사용할 수 있습니다.

**[🌐 DividendFIRE Web/PWA 실행하기](https://galcampdan.github.io/DividendFIRE/)**

## 설정 공유

Web/PWA와 데스크톱에서 **친구에게 공유** 버튼을 누르면 현재 입력 설정을 담은 고유 링크를 만들 수 있습니다.

- 서버나 계정 없이 compact schema를 Deflate로 압축해 URL의 `#s=v2...` 영역에 설정을 담습니다.
- 포트폴리오, 현금흐름/FIRE 가정, 연도별 적립금 설정을 함께 공유합니다.
- 링크를 받은 사람의 기존 설정은 자동으로 덮어쓰지 않으며, **이 설정 적용**을 눌러야 반영됩니다.
- 공유 링크에는 현재 나이, 투자자산, 월급 등 입력한 값이 포함될 수 있으므로 공개 게시 시 주의합니다.
- 기존 `#share=v1...` 링크도 계속 읽을 수 있어 이전 공유 링크가 깨지지 않습니다.\n- 시장 스냅샷이나 계산 결과 자체는 링크에 저장하지 않고, 받은 기기에서 같은 설정으로 다시 계산합니다.

## Windows 무설치판 v2 (추천)

최신 Windows 배포판은 GitHub Release에서 제공합니다.

**[⬇️ 최신 DividendFIRE Release 열기](https://github.com/galcampdan/DividendFIRE/releases/latest)**

1. Release의 **Assets**에서 `DividendFIRE-Tauri-Portable-vX.Y.Z.zip`을 받습니다.
2. ZIP 압축을 풉니다.
3. `DividendFIRE.exe`를 실행합니다.
4. 설치 과정이나 Python 설치가 필요하지 않습니다.
5. 외부 브라우저와 localhost 서버를 사용하지 않습니다.

v2 데스크톱판은 **Tauri + Windows WebView2** 기반이며 Web/PWA와 같은 JavaScript 시뮬레이션 코어를 사용합니다.

> 현재 Tauri Portable 배포파일은 Authenticode 코드서명되지 않았기 때문에 Windows SmartScreen에서 "알 수 없는 게시자" 경고가 표시될 수 있습니다. 실제 악성코드 탐지가 뜨는 경우에는 실행하지 마세요.

## 공용 계산 코어

```text
shared/simulation-core.js
        │
   ┌────┴────┐
   │         │
Web / PWA   Tauri Desktop
```

Web/PWA와 Windows v2가 같은 FIRE 계산 코어를 사용하도록 구조를 통합했습니다. deterministic 계산 테스트는 GitHub Actions에서 자동 실행됩니다.

## Release / 보안 확인

버전은 저장소의 `RELEASE_VERSION`에서 관리하며, 버전 변경이 main에 반영되면 Tauri Release workflow가 테스트·빌드·보안 검사를 거쳐 새 Release를 게시합니다.

각 Tauri Release에는 다음 파일이 함께 제공됩니다.

- `DividendFIRE-Tauri-Portable-vX.Y.Z.zip`
- `TAURI_SHA256.txt` — ZIP의 SHA-256
- `TAURI_SECURITY.txt` — ClamAV 검사 결과와 SHA-256

따라서 README에 특정 버전 번호나 해시를 고정하지 않고, 항상 **최신 Release의 검증 파일**을 기준으로 확인합니다.

**[전체 최신 Release 보기](https://github.com/galcampdan/DividendFIRE/releases/latest)**

## 로컬 빌드

Windows에서 Tauri Portable을 직접 빌드하려면:

```bat
BUILD_TAURI_PORTABLE.bat
```

스크립트는 `RELEASE_VERSION`을 읽어 버전이 포함된 ZIP과 SHA-256 파일을 `release\`에 생성합니다.

## Legacy v1

기존 Python/localhost 기반 v1.x는 이전 Release와 legacy 빌드 경로로 남겨 두었습니다.

**[v1.0.4 Release](https://github.com/galcampdan/DividendFIRE/releases/tag/v1.0.4)**

## 오픈소스 준비

향후 오픈소스 전환을 고려해 `ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `OPEN_SOURCE.md`를 정리해 두었습니다. 아직 오픈소스 라이선스는 확정하지 않았습니다.
