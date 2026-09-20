# Contributing

추후 오픈소스 전환을 고려한 개발 규칙입니다.

- 계산식 변경: `shared/simulation-core.js`와 `tests/`를 함께 수정
- 공통 UI 변경: `app/static/`
- 플랫폼별 코드: `web/`, `desktop/`
- 생성물, 인증서, API key, 개인 설정은 커밋 금지

```bash
node tests/simulation-core.test.js
python web/prepare_pages.py
```

오픈소스 공개 전 라이선스를 별도로 확정합니다.
