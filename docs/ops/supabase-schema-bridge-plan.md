# Supabase 구조 전환 안전 계획

이 문서는 `Doripe-app`의 기존 Supabase 구조를 현재 Doripe 웹 MVP 구조로 옮길 때 지켜야 할 순서를 기록한다. 실제 원격 DB를 변경하는 실행 문서가 아니라, 변경 전에 실패와 데이터 손실을 막는 체크리스트다.

## 현재 결론

- 웹 MVP 대상은 `Doripe-app (dcyjrsxnpujslbxtitqj)`이다.
- 저장소에는 migration 50개가 있지만 원격 프로젝트에는 9개만 기록돼 있다.
- 같은 이름이지만 구조가 다른 기존 테이블이 있어 50개를 그대로 적용하면 충돌할 수 있다.
- 원격 Storage에는 사진 176개가 있지만 `place_photos` 연결 행은 없다.
- 따라서 기존 migration 일괄 적용, migration history 강제 수정, 원격 테이블 삭제를 하면 안 된다.

## 확정된 대상

| 항목 | 현재 기준 | 실행 전 조건 |
| --- | --- | --- |
| 웹 MVP Supabase | `dcyjrsxnpujslbxtitqj` | 코드·Vercel 환경변수·운영 문서가 모두 동일해야 함 |
| 이전 문서의 project | `qfvirakzxtcgoerrqumh` | legacy 기록으로만 보존하고 명시적 승인 없이 사용 금지 |
| 현재 읽기 전용 스냅샷 | `dcyjrsxnpujslbxtitqj` | 원격 변경 전후 비교 기준으로 보존 |

대상은 확정됐지만 백업과 staging 검증이 끝나기 전에는 schema나 Storage를 수정하지 않는다.

## 안전한 전환 순서

1. 대상 프로젝트의 테이블, 컬럼, 제약조건, RLS, 함수, trigger, grant와 정확한 행 수를 읽기 전용으로 내보낸다.
2. DB custom-format 백업과 Storage 176개 파일의 실제 사본을 만든다.
3. 원격 migration 9개의 실제 SQL을 확보해 현재 원격 구조의 기준선으로 보존한다.
4. production과 같은 staging 프로젝트를 만들고 백업을 복원한다.
5. 기존 구조를 삭제하지 않는 forward-only bridge migration을 작성한다.
6. staging에서 bridge를 적용하고, 같은 migration을 두 번 실행해도 데이터가 중복되거나 손상되지 않는지 확인한다.
7. 테이블 수만 아니라 컬럼 타입, PK/FK, RLS, grant, 함수 인자와 `search_path`까지 비교한다.
8. `/readiness`, 인증, 피드, 저장, 코스, 댓글, 미디어, 관리자 API 전체 테스트를 실행한다.
9. 적용 전후 DB 행 수와 Storage 객체 수 및 checksum이 같은지 비교한다.
10. staging 검수가 끝난 뒤에만 GitHub PR과 승인된 배포 흐름으로 production 적용을 진행한다.

## Bridge migration 구성

| 순서 | 역할 |
| --- | --- |
| 1 | 예상한 원격 구조와 다르면 즉시 중단하는 preflight |
| 2 | `places`, `place_photos`, taxonomy 구조를 보존하며 확장 |
| 3 | 사용자 계정, 프로필, 운영자 구조 생성 |
| 4 | `auth.users` 기준의 idempotent 사용자 backfill |
| 5 | 코스, 저장, 분석, 공유, rate limit 구조 생성 |
| 6 | 콘텐츠, 미디어, 소셜, 문의, 운영 감사 구조 생성 |
| 7 | 승인된 legacy 데이터만 새 구조로 backfill |
| 8 | FK/check를 추가한 뒤 데이터 검증 |
| 9 | RLS, grant, RPC, trigger 적용 |
| 10 | Storage 공개 목록 차단과 private bucket 보안 적용 |

## 기존 구조 처리 원칙

- 제자리 확장 우선: `neighborhoods`, `places`, `place_photos`, `shared_links`
- 이름을 보존한 뒤 새 구조 생성: 기존 `place_tags`
- 승인된 매핑 후 이관: 기존 tag, route, app event, place action, onboarding 데이터
- 자동 이관 금지: `app_users`와 `auth.users` 사이에 확실한 대응 근거가 없는 사용자 데이터
- 그대로 유지: 알림 신청, 화면 검수, 기존 discovery 관련 데이터

## 금지 사항

- production에서 `supabase db push`를 먼저 실행하기
- schema 준비 전에 migration history를 applied로 강제 표시하기
- 백업 없이 기존 테이블이나 Storage 객체를 삭제하기
- dashboard에서만 변경하고 migration 파일을 남기지 않기
- 이름이 같다는 이유만으로 기존 테이블이 호환된다고 가정하기

## 완료 기준

- 대상 project ref `dcyjrsxnpujslbxtitqj`가 코드, Vercel, 운영 문서에서 일치한다.
- staging 복원과 bridge 적용이 성공한다.
- 두 번째 bridge 실행이 무해하다.
- runtime 계약의 테이블, 컬럼, 제약조건, RLS, grant, 함수가 모두 일치한다.
- 기존 행 수와 Storage 176개 객체가 보존된다.
- 전체 자동 테스트와 핵심 사용자 여정 검수가 통과한다.
