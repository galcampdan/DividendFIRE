# 코드서명 (공개 배포 권장)

이 프로젝트는 기본적으로 **서명되지 않은** 설치파일을 만듭니다.
표준 PyInstaller ONEDIR + Inno Setup을 사용하고, 커스텀 self-extractor/PowerShell payload/프로세스 강제종료를 사용하지 않아
이전 실험용 EXE보다 훨씬 정상적인 배포 구조입니다.

하지만 새로 만든 미서명 Windows 프로그램은 SmartScreen 경고가 뜰 수 있습니다.
공개 배포라면 Authenticode 코드서명 인증서를 사용하세요.

예시:
```bat
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f YOUR_CERT.pfx /p YOUR_PASSWORD dist\DividendFIRE\DividendFIRE.exe
signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f YOUR_CERT.pfx /p YOUR_PASSWORD release\DividendFIRE-Setup-v1.0.0.exe
```

중요:
- Defender/SmartScreen 경고를 우회시키기 위한 예외 등록을 사용자에게 요구하지 마세요.
- 바이러스 검사를 끄라고 안내하지 마세요.
- 배포 전 Windows Defender 및 VirusTotal로 결과물을 검사하세요.
- SHA-256 해시를 Release 페이지에 같이 공개하세요.
