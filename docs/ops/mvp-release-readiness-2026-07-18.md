# Doripe 웹 MVP 출시 준비 기록

- 확인일: 2026-07-18
- Git 브랜치: `codex/mvp-masterplan-implementation`
- 기능 기준: `mvp-checkpoint-2026-07-18-public-fixture-guard`
- 최신 복구 체크포인트: `mvp-checkpoint-2026-07-18-public-fixture-guard`
- 웹 MVP Supabase project: `dcyjrsxnpujslbxtitqj` (`Doripe-app`)
- 목적: 실제 DB 변경이나 Production 배포 전에 현재 코드와 운영 환경의 차이를 복구 가능한 기록으로 남긴다.

## 한눈에 보기

| 영역 | 상태 | 확인 결과 |
| --- | --- | --- |
| 최신 앱 코드 | 준비됨 | 최신 Figma 화면을 `/app`과 `/app-preview`가 같은 소스로 사용한다. |
| 자동 테스트 | 통과 | App unit 226, Backend 43, Ops 59, API contract 110, 화면·행동 E2E 254(시각 회귀 포함), server boundary 8 통과 |
| 미디어 데이터 경계 | 통과 | API 사진이 없거나 실패해도 로컬 fixture 사진을 실제 장소 사진처럼 대신 노출하지 않는다. 실제 썸네일이 있을 때만 같은 미디어의 대체 소스로 사용한다. |
| 검토 데이터 경계 | 통과 | 공개 `/app`은 URL에 `static=1`이 붙어도 실제 API 모드를 유지하며, fixture는 검토 전용 `/app-preview`에서만 허용된다. |
| Git 백업 | 준비됨 | 작업 브랜치와 복구 태그가 GitHub 원격 저장소에 있다. |
| GitHub PR | 통과 | Draft PR #28의 build, repository guard, Vercel Preview가 성공했고 merge 상태는 `CLEAN`이다. 출시 차단 요인이 남아 있어 병합하지 않는다. |
| 의존성 보안 | 운영 코드 통과 | 실제 서비스 의존성 취약점 0건, 커밋된 비밀키 형태 0건이다. 개발용 Vercel 도구 경고는 안전한 수정 버전을 기다린다. |
| Supabase 대상 | 확정 | 최신 Brain, 연결 가능한 Supabase 프로젝트, 앱 미디어 URL 모두 `dcyjrsxnpujslbxtitqj`를 가리킨다. |
| Supabase 구조 | 출시 차단 | 원격 migration 9개, 저장소 migration 50개로 이력이 크게 다르다. |
| 실제 콘텐츠 | 출시 차단 | 장소·사진·사용자·코스는 0행이다. 태그·동네·온보딩·화면 검수 기준 데이터만 일부 존재한다. |
| 사진 파일 | 확인 필요 | 공개 Storage에 176개가 있지만 `place_photos` 연결 행이 없고 베타 장소 데이터로 확정되지 않았다. |
| Vercel 환경 | 출시 차단 | Preview·Development 필수 Supabase 환경변수와 readiness 실서버 검증이 필요하다. |
| 실제 기기 검수 | 출시 차단 | 실제 Supabase 데이터와 휴대폰을 함께 사용한 전체 여정 검수가 없다. |
| 빈 DB 재구성 | 확인 필요 | Supabase CLI는 사용할 수 있지만 현재 로컬 환경에 Docker가 없어 `db reset`을 실행하지 못했다. 별도 staging 또는 Docker 환경에서 검증해야 한다. |

## 원격 Supabase 읽기 전용 관찰 결과

- project: `Doripe-app (dcyjrsxnpujslbxtitqj)`
- status: `ACTIVE_HEALTHY`
- PostgreSQL: `17.6.1.127`
- remote migration: 9개
- public table: 24개. 정확한 행 수는 태그 11, 태그 그룹 3, 동네 3, 사진 제공자 2, 온보딩 질문 2, 선택지 14, 화면 검수 화면 27이며 나머지는 0이다.
- public function: 10개
- Storage: `place-photos-public`, public, 176 objects, 153,392,247 bytes
- 상세 스냅샷: `supabase-production-schema-snapshot-2026-07-18.json`

`npm run check:supabase-runtime`은 현재 API 계약과 원격 스냅샷의 차이를 정확히 감지하므로 의도적으로 실패한다. 이는 검사 오류가 아니라 아직 원격 DB 전환이 끝나지 않았다는 출시 차단 신호다.

## 보안·성능 Advisor

Security Advisor:

1. 공개 Storage의 광범위한 SELECT policy가 파일 목록을 노출할 수 있다. `WARN` 1건이다.
2. `notify_taste_events`, `notify_taste_results`는 RLS가 켜져 있지만 policy가 없다. `INFO` 2건이다.

Performance Advisor는 사용되지 않은 index 36개를 INFO로 보고했다. 핵심 사용자 데이터와 장소 데이터가 비어 있어 삭제 근거로 사용하지 않는다.

상세 기준선은 `supabase-advisor-baseline-2026-07-18.md`에 기록했다. staging에서는 Security WARN 0건을 production 전환 조건으로 사용한다.

## 의존성·비밀키 검사

- `npm audit --omit=dev`: 취약점 0건
- 커밋된 대표 Supabase token·service role key 형태: 0건
- 개발 의존성 전체: Vercel CLI 계열 high 18, moderate 11, low 2

개발 도구 경고의 자동 수정안은 큰 버전 변경 또는 현재보다 낮은 버전을 요구해 적용하지 않았다. 상세 판단은 `dependency-security-baseline-2026-07-18.md`에 기록했다.

## 안전한 다음 순서

1. **부분 완료:** 원격 DB catalog·기준 데이터·앱 역할 grant·migration SQL 원문과 Storage 176개의 읽기 전용 백업을 만들었다. DB custom-format 백업은 별도 자격증명 확보 후 추가한다.
2. 현재 9개 migration을 기준선으로 보존한다.
3. 사용자 확인 후 별도 staging을 만들고 `npm run check:supabase-staging-target`으로 production·legacy project 오지정을 차단한다.
4. 빈 staging에 migration을 처음부터 적용해 동일한 구조가 만들어지는지 검증한다.
5. 기준선 복원본에는 기존 데이터를 지우지 않는 bridge migration을 적용한다.
6. staging에서 RLS, API, 중복 실행, 데이터 보존과 Security WARN 0건을 검증한다.
7. Vercel Preview·Development를 승인된 Supabase 환경에 연결한다.
8. 실제 베타 장소·사진·태그·제공자 데이터를 등록한다.
9. 실제 데이터와 휴대폰으로 전체 사용자 여정을 반복 검수한다.
10. 출시 차단 문제가 0개일 때만 PR을 `main`에 병합한다.

## 이번 기록에서 하지 않은 것

- Supabase schema 또는 데이터 변경
- Storage 파일 삭제·수정
- Vercel 환경변수 변경
- Vercel Production 직접 배포
