# Dividend FIRE 코드서명

## 현재 배포 상태

현재 권장 공개 배포판은 `.github/workflows/build-tauri.yml`에서 생성하는 **Tauri Portable v2**입니다.

이 경로는 현재 Authenticode 코드서명을 적용하지 않으며, 대신 Release마다:

- `TAURI_SHA256.txt`
- `TAURI_SECURITY.txt`
- ClamAV security gate

를 제공합니다.

Windows SmartScreen에서는 코드서명되지 않은 정상 파일도 "알 수 없는 게시자" 경고가 표시될 수 있습니다.

아래 Azure Artifact Signing 설정은 현재 `.github/workflows/build-windows.yml`의 **PyInstaller + Inno Setup installer 경로**에 적용할 수 있도록 준비된 구성입니다. 향후 Tauri Portable에도 코드서명을 적용할 경우, ZIP 패키징 전에 `DividendFIRE.exe`를 서명하고 서명 검증 실패 시 Release를 중단하도록 workflow를 확장하는 것이 좋습니다.

## Azure Artifact Signing

Windows 설치형 배포판의 서명 방식으로 **Azure Artifact Signing (구 Trusted Signing)** 을 사용할 수 있습니다.

### 왜 이 방식인가

- Microsoft의 Windows 코드서명 서비스입니다.
- USB 토큰이나 PFX 개인키를 GitHub Secrets에 넣지 않고도 CI/CD에서 서명할 수 있습니다.
- GitHub Actions에서 OIDC 방식으로 인증할 수 있습니다.
- 앱 EXE와 Inno Setup 설치 EXE를 Authenticode 서명하고 RFC3161 타임스탬프를 붙일 수 있습니다.

## 지역/신원 조건

Public Trust 기준:

- 조직(사업자/법인): 대한민국 지원
- 개인 개발자: 지원 지역은 Microsoft의 최신 안내를 다시 확인해야 합니다.

서비스의 지역 및 신원 검증 조건은 변경될 수 있으므로 실제 적용 전에 Azure 공식 문서를 확인합니다. 조건에 맞지 않는 경우 Sectigo/DigiCert 같은 공개 코드서명 인증서 또는 승인된 Open Source signing 서비스를 검토할 수 있습니다.

## Azure 쪽에서 1회 설정

1. Azure 구독 준비
2. Artifact Signing 리소스 공급자 등록
3. Artifact Signing Account 생성
4. Identity Validation 완료
5. Public Trust Certificate Profile 생성
6. GitHub Actions용 App Registration / Service Principal 생성
7. 해당 Service Principal에 **Artifact Signing Certificate Profile Signer** 역할 부여
8. GitHub repo용 Federated Credential(OIDC) 추가

repo: `galcampdan/DividendFIRE`  
branch: `main`

## GitHub Secrets

Repository → Settings → Secrets and variables → Actions → Secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

## GitHub Variables

Repository → Settings → Secrets and variables → Actions → Variables:

- `AZURE_ARTIFACT_SIGNING_ENABLED` = `true`
- `AZURE_ARTIFACT_SIGNING_ENDPOINT`
- `AZURE_ARTIFACT_SIGNING_ACCOUNT`
- `AZURE_ARTIFACT_SIGNING_PROFILE`

## installer workflow 동작

`.github/workflows/build-windows.yml`은:

1. PyInstaller ONEDIR 앱 생성
2. Azure 로그인(OIDC)
3. Artifact Signing이 활성화된 경우 `DividendFIRE.exe` 서명
4. Inno Setup 설치파일 생성
5. Artifact Signing이 활성화된 경우 설치 EXE 서명
6. PowerShell `Get-AuthenticodeSignature`로 검증
7. 서명이 활성화된 상태에서 결과가 `Valid`가 아니면 실패
8. ClamAV 및 선택적 VirusTotal 검사

타임스탬프:

`http://timestamp.acs.microsoft.com`

## 확인

installer workflow 산출물의 `AUTHENTICODE.txt`에서 상태를 확인할 수 있습니다.

```text
Authenticode status: Valid
Signer: CN=...
```

또는 Windows에서 설치파일 → 우클릭 → 속성 → **디지털 서명** 탭으로 확인합니다.

## 주의

- Self-signed 인증서는 일반 사용자 공개 배포용으로 사용하지 않습니다.
- Defender/SmartScreen 경고를 피하려고 사용자에게 백신 예외 등록을 요구하지 않습니다.
- 개인키를 repo나 평문 파일에 커밋하지 않습니다.
