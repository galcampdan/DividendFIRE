# Dividend FIRE Simulator — Windows 공개 배포판 빌드 프로젝트

이 폴더는 기존 실험용 self-extracting EXE와 다릅니다.

## 일반 사용자가 받는 파일
빌드 후 아래 파일 **하나만 배포**하면 됩니다.

`release\DividendFIRE-Setup-v1.0.0.exe`

설치 사용자는:
- Python 설치 불필요
- 관리자 권한 불필요(기본 per-user 설치)
- 시작 메뉴 등록
- 선택적으로 바탕화면 바로가기 생성
- 제거 프로그램 제공

## 개발자 PC에서 한 번에 빌드
Windows에서:

`BUILD_PUBLIC_INSTALLER.bat`

더블클릭.

빌드 결과:
`release\DividendFIRE-Setup-v1.0.0.exe`

## GitHub에서 자동 빌드
프로젝트를 GitHub 저장소 루트에 올리면 `.github/workflows/build-windows.yml`이 동작합니다.

- Actions → Build Windows installer → Run workflow
- 또는 `v1.0.0` 같은 tag push
- Windows runner가 PyInstaller + Inno Setup으로 설치파일 생성
- 태그 빌드는 GitHub Release에도 자동 첨부

## 악성코드 오탐을 줄이기 위해 적용한 원칙
- PyInstaller **ONEDIR** 사용
- UPX 사용 안 함
- 코드 난독화/패킹 안 함
- Base64 payload를 EXE에 숨겨 푸는 커스텀 런처 사용 안 함
- PowerShell로 앱 payload를 설치하지 않음
- 다른 Python 프로세스를 검색/강제 종료하지 않음
- 설치는 표준 Inno Setup 사용
- 사용자 설정은 `%LOCALAPPDATA%\DividendFIRE\settings.json`만 사용

## 사용자 데이터
설치 프로그램과 분리되어 저장됩니다.

`%LOCALAPPDATA%\DividendFIRE\settings.json`

업데이트/재설치 시 설정을 덮어쓰지 않습니다.

## 주의
코드서명이 없으면 정상 프로그램이어도 SmartScreen 경고가 뜰 수 있습니다.
공개 배포 전 `CODE_SIGNING.md`를 참고하세요.
