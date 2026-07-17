# Supabase staging bridge 실행 순서

이 문서는 비개발자도 현재 상태와 다음 행동을 구분할 수 있게 만든 실행 순서다. **현재 운영 Supabase에는 적용하지 않는다.**

## 먼저 필요한 것

1. production과 분리된 Supabase staging 프로젝트
2. staging 생성 비용 또는 branch 비용에 대한 사용자 확인
3. staging project ref와 URL
4. 현재 백업을 복원할 수 있는 DB 자격증명

현재 production project ref `dcyjrsxnpujslbxtitqj`와 legacy ref `qfvirakzxtcgoerrqumh`는 staging 대상으로 사용할 수 없다.

## 1. 대상 확인

로컬 비밀 환경변수에 staging 값만 넣는다. 실제 값은 Git에 저장하지 않는다.

```bash
export DORIPE_STAGING_SUPABASE_PROJECT_ID="<staging-project-ref>"
export DORIPE_STAGING_SUPABASE_URL="https://<staging-project-ref>.supabase.co"
export DORIPE_STAGING_CONFIRMATION="I_UNDERSTAND_STAGING_ONLY"
npm run check:supabase-staging-target
```

production·legacy ref, 잘못된 URL, 확인 문구 누락 중 하나라도 있으면 실패한다. 이 검사가 통과해도 migration 실행 승인을 뜻하지 않는다.

## 2. 기준선 복원과 비교

1. `docs/ops/backups/2026-07-18`의 DB 구조·기준 데이터를 staging에 복원한다.
2. Storage 백업 174개 파일을 staging 전용 bucket에 복원한다.
3. `supabase/preflight/web_mvp_bridge_baseline.sql`을 읽기 전용으로 실행한다.
4. `npm run check:supabase-bridge-baseline`을 실행한다.
5. 행 수, migration 9개, Storage 객체 수와 SHA-256이 기준선과 같지 않으면 중단한다.

## 3. bridge 작성·적용

1. `supabase-bridge-execution-plan.json`의 분류 순서대로 forward-only bridge를 작성한다.
2. 기존 테이블이나 Storage 파일을 삭제하지 않는다.
3. staging에 한 번 적용하고 전체 테스트를 실행한다.
4. 같은 bridge를 다시 적용해도 중복·손상이 없는지 확인한다.
5. 적용 전후 행 수와 Storage checksum을 비교한다.

## 4. 보안 검증

1. Security Advisor를 다시 실행한다.
2. `place-photos-public`의 공개 파일 목록 policy는 제거하되 이미지 URL 표시는 유지되는지 확인한다.
3. `notify_taste_events`, `notify_taste_results`는 비공개 보존 또는 명시적 최소 policy 중 하나로 결정한다.
4. Security WARN이 0건이 아니면 production 전환을 중단한다.

현재 기준선은 `supabase-advisor-baseline-2026-07-18.md`에 있다.

## 5. 앱 검증

```bash
npm run check:supabase
npm run check:supabase-runtime
npm run test:ops
npm run test:backend
npm run check:api-contract
npm run test:app-preview:unit
npm run test:app-preview:e2e:ci
npm run build
```

그다음 실제 휴대폰에서 피드, 장소 상세, 저장, 코스, 댓글, 공유, 새로고침 유지, 로그아웃·재로그인 복구를 확인한다.

## 6. production 전환 조건

- staging bridge 2회 적용이 무해하다.
- 자동 검사와 실제 사용자 여정이 모두 통과한다.
- 기존 DB 행과 Storage 파일이 모두 보존된다.
- Security WARN이 0건이다.
- 사용자 승인과 GitHub PR 검토가 끝났다.

조건을 모두 충족하기 전에는 production migration, `main` 병합, 직접 Vercel production 배포를 하지 않는다.
