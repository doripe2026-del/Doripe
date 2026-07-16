# Doripe 웹 MVP 출시 준비 기록

- 확인일: 2026-07-16
- Git 브랜치: `codex/mvp-masterplan-implementation`
- 기준 커밋: `2feea46`
- Supabase project: `dcyjrsxnpujslbxtitqj`
- 목적: 실제 DB 변경이나 배포 전에 현재 코드와 운영 환경의 차이를 복구 가능한 기록으로 남긴다.

## 한눈에 보기

| 영역 | 상태 | 확인 결과 |
| --- | --- | --- |
| 최신 앱 코드 | 준비됨 | 최신 55개 Figma 화면을 `/app`과 `/app-preview`가 같은 소스로 사용한다. |
| 자동 테스트 | 통과 | App unit 167, Backend 36, API contract 110, 화면·행동·픽셀 E2E 230 통과 |
| Git 백업 | 준비됨 | 작업 브랜치를 GitHub 원격 저장소에 push했다. |
| Supabase 구조 | 출시 차단 | 원격 migration 9개, 저장소 migration 49개로 이력이 크게 다르다. |
| 실제 콘텐츠 | 출시 차단 | 공개 테이블 24개 모두 0행이다. |
| 사진 파일 | 확인 필요 | `place-photos-public` 버킷에 파일 176개가 있으나 `place_photos`는 0행이다. |
| Vercel 환경 | 출시 차단 | Preview·Development 필수 Supabase 환경변수가 없고 Production 공개 key가 없다. |
| 운영 API | 출시 차단 | 배포된 `/api/v1/readiness`가 아직 404다. |

## 자동 검증 기록

```text
App unit              167 passed
Backend                32 passed
API contract          110 passed
Playwright CI         227 passed
Playwright + visual   230 passed
```

자동 테스트는 fixture와 API 계약을 기준으로 통과한 결과다. 실제 Supabase 데이터와 권한이 준비됐다는 뜻은 아니다.

## 원격 Supabase 관찰 결과

읽기 전용 Supabase 도구로 확인했다. 원격에는 migration 9개와 공개 테이블 24개가 있다.

동일한 조회 결과를 `supabase-production-schema-snapshot-2026-07-16.json`에 저장했다. `npm run check:supabase-runtime`을 실행하면 현재 API 계약과 이 스냅샷의 차이를 자동으로 다시 계산한다. 현재는 출시 차단 상태를 정확히 감지하므로 의도적으로 실패한다.

현재 API가 필요하지만 원격에 없는 핵심 구조의 예:

- 사용자: `user_accounts`, `public_profiles`, `user_onboarding`, `notification_preferences`
- 피드: `contents`, `content_media`, `content_places`, `media_assets`
- 소셜: `profile_follows`, `content_likes`, `comments`, `comment_likes`
- 코스·저장: `courses`, `course_places`, `saved_places`, `saved_courses`
- 운영 안정성: `analytics_sessions`, `analytics_events`, `idempotency_records`, `rate_limit_buckets`

원격에는 위 새 구조 대신 `app_users`, `routes`, `route_places`, `place_actions`, `app_events` 같은 이전 구조가 남아 있다. 같은 기능을 나타내는 구·신 구조가 섞여 있으므로 migration 파일 49개를 순서대로 바로 적용하면 안 된다.

## 데이터 연결 상태

- 공개 테이블은 현재 모두 0행이다.
- `place-photos-public` Storage 버킷에는 176개 파일이 있다.
- 버킷은 공개 상태이며 이미지 형식은 JPEG, PNG, WebP, 파일 제한은 10MB다.
- DB의 `place_photos`가 0행이라 파일과 장소의 연결 정보가 없다.
- 파일을 삭제하거나 다시 올리기 전에 176개 객체의 경로와 출처를 별도로 내보내야 한다.

## 보안 점검 결과

Supabase Security Advisor가 다음을 알렸다.

1. `place-photos-public`의 광범위한 SELECT policy 때문에 버킷 파일 목록이 노출될 수 있다.
2. `notify_taste_events`, `notify_taste_results`는 RLS가 켜져 있지만 policy가 없다.

첫 번째 문제를 막는 로컬 migration은 존재하지만 아직 원격 적용 여부가 다르다. 두 번째는 서버 전용 접근이 의도인지 먼저 확인한 뒤 policy를 결정한다.

## 안전한 다음 순서

1. 원격 DB와 Storage의 읽기 전용 백업 목록을 만든다.
2. 구 구조에서 보존해야 할 데이터가 있는지 확인한다.
3. 49개 migration을 그대로 적용하지 않고, 현재 원격 구조에서 새 구조로 가는 전용 migration 계획을 만든다.
4. 빈 Supabase branch 또는 별도 staging 환경에 먼저 적용한다.
5. Backend/API/보안 테스트와 Advisor를 다시 실행한다.
6. 실제 베타 콘텐츠를 넣고 `/api/v1/readiness`와 전체 사용자 여정을 검수한다.
7. 검수가 끝난 뒤에만 Production에 적용한다.

## 이번 기록에서 하지 않은 것

- Supabase migration 적용
- 테이블·파일 삭제 또는 수정
- Vercel Production 직접 배포
- 실제 사용자 데이터 생성

이 문서는 관찰 결과만 기록한다.
