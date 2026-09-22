# Dividend FIRE Simulator — 배포 가이드

현재 권장 배포판은 **Tauri 기반 Windows Portable v2**와 **Web/PWA**입니다.

## 일반 사용자가 쓰는 주소 / 파일

### Web / PWA

**https://galcampdan.github.io/DividendFIRE/**

휴대폰 브라우저에서 접속한 뒤 **홈 화면에 추가**하면 앱처럼 사용할 수 있습니다.

### Windows

**[최신 Release](https://github.com/galcampdan/DividendFIRE/releases/latest)** 의 Assets에서 아래 형식의 파일을 받습니다.

`DividendFIRE-Tauri-Portable-vX.Y.Z.zip`

사용자는:

- ZIP 압축 해제
- `DividendFIRE.exe` 실행
- Python 설치 불필요
- 별도 설치 과정 불필요
- localhost 서버 불필요
- Windows 10/11의 Microsoft Edge WebView2 사용

## 버전 관리

현재 배포 버전의 기준은 저장소 루트의:

`RELEASE_VERSION`

입니다.

형식은 `vX.Y.Z`입니다. 새 버전을 배포할 때 이 파일의 버전을 올려 main에 반영합니다.

## GitHub Actions 자동 Release

`.github/workflows/build-tauri.yml`은 다음 순서로 동작합니다.

1. 공용 simulation core 테스트
2. Web 정적 frontend 생성
3. 모바일 E2E QA
4. Windows Tauri executable 빌드
5. 버전이 포함된 Portable ZIP 생성
6. SHA-256 생성
7. ClamAV 보안 gate
8. `RELEASE_VERSION`이 변경된 main push인 경우 GitHub Release 게시

Release에는 다음 파일이 포함됩니다.

- `DividendFIRE-Tauri-Portable-vX.Y.Z.zip`
- `TAURI_SHA256.txt`
- `TAURI_SECURITY.txt`

README에는 특정 Release 번호나 해시를 고정하지 않습니다. 검증할 때는 해당 Release에 함께 올라온 파일을 기준으로 합니다.

## 개발자 PC에서 Tauri Portable 빌드

Windows에서:

```bat
BUILD_TAURI_PORTABLE.bat
```

이 스크립트는 `RELEASE_VERSION`을 읽고:

- Tauri executable 빌드
- `release\DividendFIRE-Tauri-Portable-vX.Y.Z.zip` 생성
- `release\TAURI_SHA256.txt` 생성

까지 수행합니다.

필요 조건:

- Python
- Rust / Cargo
- Tauri CLI
- Windows WebView2

일반 사용자는 이 개발 도구들이 필요하지 않습니다.

## 코드서명 / SmartScreen

현재 권장 Tauri Portable Release는 Authenticode 코드서명 없이 배포되고 있습니다. 코드서명이 없으면 정상 프로그램이어도 Windows SmartScreen에서 "알 수 없는 게시자" 경고가 표시될 수 있습니다.

Release는 SHA-256과 ClamAV gate를 함께 제공합니다. 실제 악성코드 탐지가 표시되는 경우 실행하지 않습니다.

향후 코드서명을 적용할 때는 `CODE_SIGNING.md`를 참고합니다.

## Legacy Python / Installer 경로

Python + PyInstaller + Inno Setup 기반 배포 경로는 **legacy / 별도 유지보수용**입니다.

관련 파일:

- `BUILD_PUBLIC_INSTALLER.bat`
- `.github/workflows/build-windows.yml`
- `installer/DividendFIRE.iss`
- `DividendFIRE.spec`

이 경로를 사용할 경우에도 버전은 `RELEASE_VERSION`에서 읽도록 유지합니다.
