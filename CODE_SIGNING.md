# Dividend FIRE 코드서명

공개 배포판의 기본 서명 방식은 **Azure Artifact Signing (구 Trusted Signing)** 입니다.

## 왜 이 방식인가

- Microsoft가 비-Store Windows 앱 배포용으로 권장하는 코드서명 서비스입니다.
- USB 토큰이나 PFX 개인키를 GitHub Secrets에 넣지 않고도 CI/CD에서 서명할 수 있습니다.
- GitHub Actions에서 OIDC 방식으로 인증할 수 있습니다.
- 앱 EXE와 Inno Setup 설치 EXE 둘 다 Authenticode 서명하고 RFC3161 타임스탬프를 붙입니다.

## 지역/신원 조건

Public Trust 기준:
- 조직(사업자/법인): 대한민국 지원
- 개인 개발자: 현재 미국/캐나다만 지원

따라서 대한민국에서 개인 명의만 사용할 경우에는 Azure Artifact Signing Public Trust 개인 검증을 사용할 수 없고,
Sectigo/DigiCert 같은 공개 코드서명 인증서 또는 승인된 Open Source signing 서비스가 필요합니다.

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
- `AZURE_ARTIFACT_SIGNING_ENDPOINT` = 예: `https://krc.codesigning.azure.net/`
- `AZURE_ARTIFACT_SIGNING_ACCOUNT` = Artifact Signing account 이름
- `AZURE_ARTIFACT_SIGNING_PROFILE` = Public Trust certificate profile 이름

## 파이프라인 동작

`.github/workflows/build-windows.yml`은:

1. PyInstaller ONEDIR 앱 생성
2. Azure 로그인(OIDC)
3. `DividendFIRE.exe` 서명
4. Inno Setup 설치파일 생성
5. 설치 EXE 서명
6. PowerShell `Get-AuthenticodeSignature`로 검증
7. 서명이 활성화된 상태에서 결과가 `Valid`가 아니면 Release 실패
8. ClamAV / 선택적 VirusTotal 검사 후 Release

타임스탬프:
`http://timestamp.acs.microsoft.com`

## 확인

Release의 `AUTHENTICODE.txt`에서 아래처럼 보여야 합니다.

```
Authenticode status: Valid
Signer: CN=...
```

또는 Windows에서 설치파일 → 우클릭 → 속성 → **디지털 서명** 탭으로 확인합니다.

## 주의

- Self-signed 인증서는 일반 사용자 공개 배포용으로 사용하지 않습니다.
- Defender/SmartScreen 경고를 피하려고 사용자에게 백신 예외 등록을 요구하지 않습니다.
- 개인키를 repo나 평문 파일에 커밋하지 않습니다.
