# 의존성·비밀키 보안 기준선

- 확인일: 2026-07-18
- 기준 커밋: `f26c69a`
- 범위: npm 의존성, Git에 추적된 환경 파일과 대표적인 Supabase token 형태

## 결론

| 검사 | 결과 | 판단 |
| --- | --- | --- |
| 실제 서비스 의존성 `npm audit --omit=dev` | 취약점 0건 | 출시 코드 기준 통과 |
| 전체 의존성 `npm audit` | high 18, moderate 11, low 2 | 개발용 Vercel 도구 계열에 집중됨 |
| 추적된 비밀키 형태 | 0건 | 통과 |
| 추적된 env 형태 파일 | `supabase/functions/.env.example`만 존재 | 예시 파일이며 실제 키 없음 |

## 개발 의존성 경고 판단

직접 경고 대상은 개발용 `@vercel/node@5.8.26`, `vercel@54.21.1`과 그 하위 패키지다. 실제 브라우저 서비스 의존성만 검사하면 취약점은 0건이다.

`npm audit`의 자동 수정안은 현재 버전보다 낮은 `vercel@54.17.3` 또는 큰 버전 변경인 `@vercel/node@4.0.0`을 제안한다. 2026-07-18 확인 시점의 npm 최신 버전도 `@vercel/node@5.8.26`, `vercel@56.3.1`이라 단순 자동 수정으로 안전성이 입증되지 않는다.

따라서 현재는 다음 원칙을 지킨다.

1. `npm audit fix --force`를 실행하지 않는다.
2. Vercel CLI를 신뢰할 수 없는 저장소나 입력에 사용하지 않는다.
3. Vercel이 관련 advisory를 해결한 버전을 배포하면 별도 PR에서 업데이트한다.
4. 업데이트 PR에서 build, API, 전체 Playwright 검사를 다시 통과시킨다.

## 재검사 시점

- Vercel 또는 `@vercel/node` 버전 변경 전후
- production 병합 전
- 월 1회 정기 점검

이 기록은 현재 관찰 결과이며, Vercel 개발 도구 경고를 무시하거나 production 변경을 승인한다는 뜻이 아니다.
