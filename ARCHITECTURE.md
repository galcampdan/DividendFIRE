# Architecture

Dividend FIRE 2.x는 **공용 계산 코어 + 플랫폼 어댑터 + 공용 UI** 구조입니다.

```
app/static/                 공용 UI
shared/simulation-core.js   플랫폼 독립 FIRE 계산
web/                        Web/PWA 어댑터와 시장 snapshot
desktop/src-tauri/          localhost 없는 Tauri 데스크톱 셸
tests/                      deterministic tests
```

계산식은 `shared/simulation-core.js` 한 곳에서 관리하고 Web/PWA와 Desktop이 같은 결과를 사용합니다. 시장 데이터와 설정 저장만 플랫폼 어댑터가 담당합니다. Python 서버 기반 v1.x는 마이그레이션 기간 동안 legacy 경로로 남깁니다.

Tauri는 정적 frontend를 실행 파일에 내장하므로 외부 브라우저나 localhost HTTP 서버를 시작하지 않습니다. Web 빌드는 manifest + service worker가 포함된 PWA입니다.
