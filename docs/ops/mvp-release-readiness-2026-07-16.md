# Doripe 웹 MVP 출시 준비 기록

- 확인일: 2026-07-17
- Git 브랜치: `codex/mvp-masterplan-implementation`
- 기준 커밋: `88e5e47`
- 검사한 Supabase project: `dcyjrsxnpujslbxtitqj`
- 문서상 `doripe.kr` 운영 project: `qfvirakzxtcgoerrqumh`
- 목적: 실제 DB 변경이나 배포 전에 현재 코드와 운영 환경의 차이를 복구 가능한 기록으로 남긴다.

## 한눈에 보기

| 영역 | 상태 | 확인 결과 |
| --- | --- | --- |
| 최신 앱 코드 | 준비됨 | 최신 55개 Figma 화면을 `/app`과 `/app-preview`가 같은 소스로 사용한다. |
| 자동 테스트 | 통과 | App unit 206, Backend 41, Ops 40, API contract 110, 화면·행동 E2E 238과 visual 3 통과 |
| 부스 데모 | 통과 | `/demo`에서 시작→사진 선택→장소 상세→코스 선택→완성을 로컬과 Vercel Preview에서 검증했다. |
| Preview 배포 | 검수 중 | 최신 Vercel Preview와 로컬 전체 검사는 통과했다. GitHub required Build는 최신 커밋에서 다시 통과해야 한다. |
| Git 백업 | 준비됨 | 작업 브랜치와 복구 태그를 GitHub 원격 저장소에 push했다. |
| Supabase 대상 | 결정 필요 | 검사한 별도 앱 project와 `doripe.kr` 운영 project가 다르다. 실제 웹 MVP 대상을 먼저 하나로 확정해야 한다. |
| Supabase 구조 | 출시 차단 | 원격 migration 9개, 저장소 migration 49개로 이력이 크게 다르다. |
| 실제 콘텐츠 | 출시 차단 | 공개 테이블 24개 모두 0행이다. |
| 사진 파일 | 확인 필요 | `place-photos-public`의 176개 object 중 실제 이미지는 174개지만 장소 사진이 아닌 제작본·시제품 사진이며, `place_photos`는 0행이다. |
| Vercel 환경 | 출시 차단 | Preview·Development 필수 Supabase 환경변수가 없고 Production 공개 key가 없다. |
| 운영 API | 출시 차단 | Preview API는 실행되지만 Supabase 환경변수가 없어 readiness가 503이다. Production `/api/v1/readiness`는 아직 404다. |

## 자동 검증 기록

```text
App unit              206 passed
Backend                41 passed
Ops                    40 passed
Server boundaries       8 passed
API contract          110 passed
Playwright             238 passed
Visual                   3 passed
```

자동 테스트는 fixture와 API 계약을 기준으로 통과한 결과다. 실제 Supabase 데이터와 권한이 준비됐다는 뜻은 아니다.

부스 데모 전용 검증은 unit 9개와 E2E 5개가 별도로 통과했다. Vercel Preview에서도 모바일 크기 브라우저로 같은 핵심 여정을 완료했다.

`npm audit --omit=dev`는 취약점 0개다. 전체 audit에 남은 경고는 Vercel CLI를 포함한 개발·배포 도구의 간접 의존성이다. 강제 업데이트는 API 경로를 깨뜨릴 수 있어 적용하지 않았고, Vercel 54 최신 호환 버전에서 실제 Preview API까지 다시 검증했다.

## 원격 Supabase 관찰 결과

읽기 전용 Supabase 도구로 `dcyjrsxnpujslbxtitqj`를 확인했다. 원격에는 migration 9개와 공개 테이블 24개가 있다. 이 project를 웹 MVP에 사용할지, 문서상 운영 project인 `qfvirakzxtcgoerrqumh`를 사용할지는 아직 확정되지 않았다.

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
- 총 용량은 153,392,247바이트이며, 정렬된 파일 이름 목록의 체크섬은 `fe2807c3a1615b657acb106a8bdaa3eb`다. 원격 변경 전후에 이 값을 비교하면 파일 누락 여부를 빠르게 감지할 수 있다.
- 파일은 Instagram PNG 제작본 57개, Instagram JPG 제작본 57개, prototype Unsplash JPEG 60개, 빈 폴더 표시 2개로 나뉜다.
- 실제 장소 ID를 기준으로 정리된 폴더는 없으므로 이 174개 이미지를 `place_photos`에 자동 연결하면 안 된다.
- `manifest:place-photos` 읽기 전용 검사로 prototype 폴더의 실제 이미지 60개를 직접 내려받아 signature, 끝 구조, 용량, SHA-256을 확인했다. 60개 모두 통과했고 폴더 표시 1개만 자동 제외됐다.
- 버킷은 공개 상태이며 이미지 형식은 JPEG, PNG, WebP, 파일 제한은 10MB다.
- DB의 `place_photos`가 0행이라 파일과 장소의 연결 정보가 없다.
- 파일을 삭제하거나 다시 올리기 전에 176개 객체의 경로와 출처를 별도로 내보내야 한다. 실제 장소 연결용 사진은 장소 ID·권리·제공자 정보와 함께 별도 폴더로 준비해야 한다.

## 보안 점검 결과

Supabase Security Advisor가 다음을 알렸다.

1. `place-photos-public`의 광범위한 SELECT policy 때문에 버킷 파일 목록이 노출될 수 있다.
2. `notify_taste_events`, `notify_taste_results`는 RLS가 켜져 있지만 policy가 없다.

첫 번째 문제를 막는 로컬 migration은 존재하지만 아직 원격 적용 여부가 다르다. 두 번째는 서버 전용 접근이 의도인지 먼저 확인한 뒤 policy를 결정한다.

2026-07-17 재확인 결과도 동일하다. 원격 프로젝트는 `ACTIVE_HEALTHY`지만 공개 테이블은 모두 0행이며, 로컬 runtime 계약 기준 테이블 28개와 함수 18개가 없다. 빈 테이블이라는 이유로 기존 migration을 바로 적용하지 않는다.

## Vercel Preview 검증 결과

- 검증 Preview: `https://doripe-d8sw4rosv-cityboy7648-9647s-projects.vercel.app`
- `/demo`: HTTP 200, 부스 데모 핵심 여정 완료
- `/booth-demo`: HTTP 200
- `/app`: HTTP 200
- `/app-preview`: HTTP 200
- `/api/v1/health`: HTTP 200
- `/api/v1/readiness`: HTTP 503, API 실행은 정상이나 Supabase 연결 설정 없음
- GitHub Draft PR: `https://github.com/doripe2026-del/Doripe/pull/28`
- 최근 원격 복구 태그: `mvp-checkpoint-2026-07-17-8703454`

Preview URL은 임시 주소다. Production 배포 또는 `main` 병합을 뜻하지 않는다.

## 안전한 다음 순서

1. 웹 MVP가 사용할 Supabase project를 `dcyjrsxnpujslbxtitqj`와 `qfvirakzxtcgoerrqumh` 중 하나로 확정한다.
2. 확정한 원격 DB와 Storage의 읽기 전용 백업 목록을 만든다.
3. 구 구조에서 보존해야 할 데이터가 있는지 확인한다.
4. 49개 migration을 그대로 적용하지 않고, 확정한 원격 구조에서 새 구조로 가는 전용 migration 계획을 만든다.
5. 빈 Supabase branch 또는 별도 staging 환경에 먼저 적용한다.
6. Backend/API/보안 테스트와 Advisor를 다시 실행한다.
7. 실제 베타 콘텐츠를 넣고 `/api/v1/readiness`와 전체 사용자 여정을 검수한다.
8. 검수가 끝난 뒤에만 Production에 적용한다.

## 이번 기록에서 하지 않은 것

- Supabase migration 적용
- 테이블·파일 삭제 또는 수정
- Vercel Production 직접 배포
- 실제 사용자 데이터 생성

이 문서는 관찰 결과만 기록한다.
