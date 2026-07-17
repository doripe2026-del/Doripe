# Supabase Environment Rules

## Web MVP Project

Doripe 웹 MVP가 사용하는 Supabase 프로젝트는 다음 하나로 통일한다.

- name: `Doripe-app`
- project ref: `dcyjrsxnpujslbxtitqj`
- role: 웹 MVP Preview와 향후 Production의 기준 프로젝트

Vercel Preview, Development, Production 환경변수는 모두 이 project ref를 가리켜야 한다. 실제 키를 저장소에 넣지 않는다.

## Legacy Project Record

과거 `doripe.kr` 운영 문서에는 다음 project ref가 남아 있었다.

- legacy project ref: `qfvirakzxtcgoerrqumh`

이 프로젝트는 현재 Supabase 연결에서 확인되지 않았고 최신 Doripe Brain의 앱 Backend 기준과도 다르다. 명시적인 재승인과 데이터 이관 계획 없이 웹 MVP에 연결하거나 migration을 적용하지 않는다.

## Required Rule

Schema changes must be committed as files under:

```text
supabase/migrations
```

Do not make dashboard-only schema changes and leave them undocumented.

원격 프로젝트를 변경하기 전에 현재 구조와 Storage를 읽기 전용으로 기록하고, 별도 staging에서 forward-only migration을 검증한다.

## Local Secrets

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- real database URLs
- `.env`
- `.env.local`
- `.env.production`

Use Vercel environment variables and Supabase dashboard secrets.

## Verification

Run:

```bash
npm run check:supabase
npm run test:ops
npm run guard:repo
```
