# doripe.kr 페이지 구조 정리

확인일: 2026-07-04

## 전체 구조

`doripe.kr`는 현재 B2C 앱 소개/알림신청과 로컬 공간 운영자용 SEO 콘텐츠가 함께 있는 구조다.

- `/`: 일반 유저용 Doripe 앱 소개
- `/notify`: 베타 알림 신청 및 유저 설문
- `/company`: Doripe 팀/회사 소개
- `/blog`: 로컬 공간 운영자 대상 B2B 콘텐츠 블로그
- `/admin`: 내부 운영용 admin 앱

## 인프라/배포 구조

확인 기준:

- 실제 `doripe.kr` 페이지 응답 헤더: `server: Vercel`
- Git remote: `https://github.com/doripe2026-del/Doripe.git`
- 현재 로컬 브랜치: `codex/doripe-mvp-flow`
- 최근 커밋: `1a67104 feat: add app-like web interactions`
- 로컬 워크트리는 `origin/main` 대비 `ahead 13, behind 11` 상태

역할 분리:

- Vercel: `doripe.kr` 정적 페이지, Vercel serverless API, `/admin` rewrite, `/app` rewrite, 공유 링크 라우팅 담당
- Supabase: 장소/사진/카테고리/지역/공유링크/공개 앱 이벤트/저장 상태 등 앱 데이터 저장 담당
- Vercel Postgres: 기존 알림신청/이벤트/캠페인 통계 일부가 아직 사용되는 구조
- GitHub: 현재 로컬 remote 기준 코드 저장소는 `doripe2026-del/Doripe`

관련 위치:

- Vercel 프로젝트 코드: `startup-reference/doripe`
- 정적 페이지: `startup-reference/doripe/public`
- Vercel 설정: `startup-reference/doripe/vercel.json`
- Vercel API: `startup-reference/doripe/api`
- admin API 라우트 원본: `startup-reference/doripe/src/admin-routes/admin`
- Supabase 마이그레이션: `supabase/migrations`
- Supabase Edge Function: `supabase/functions/tally-photo-ingest`
- 공개 앱 보조 API 일부: `doripe-admin/app/api/public/app`

Vercel rewrite:

- `/admin` -> `https://doripe-admin.vercel.app/admin`
- `/admin/:path*` -> `https://doripe-admin.vercel.app/admin/:path*`
- `/app` -> `/app/index.html`
- `/app/:path*` -> `/app/index.html`
- `/p/:shareId` -> `/api/share?type=place&shareId=:shareId`
- `/r/:shareId` -> `/api/share?type=route&shareId=:shareId`
- `/s/:shareId` -> `/share.html`
- `/open` -> `/share.html`
- `/` -> `/index.html`

환경변수:

- Supabase admin 접근: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Admin 인증: `DORIPE_ADMIN_PASSWORD` 또는 `ADMIN_PASSWORD`
- Admin 쿠키 secret: `DORIPE_ADMIN_COOKIE_SECRET` 또는 `ADMIN_PASSWORD`
- Vercel Postgres legacy 통계: `POSTGRES_URL` 또는 `DATABASE_URL`
- Naver place import: `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET`

## 데이터/백엔드 구조

Supabase에서 관리되는 주요 데이터:

- 장소 메타: `regions`, `neighborhoods`, `categories`, `places`, `place_photos`
- 유저 저장/루트: `saved_places`, `saved_routes`
- 공유 링크: `shared_links`
- 공개 웹앱 이벤트: `app_anonymous_users`, `app_sessions`, `app_events`, `app_saved_places`, `app_routes`
- 사진 제출/크리에이터: `photo_submissions`, `photo_submission_files`, `creator_profiles`, `creator_place_submissions`, `creator_submission_photos`

Vercel Postgres에서 관리되는 것으로 확인된 데이터:

- legacy `events`
- legacy `signups`
- `notify_v2_signups`
- `notify_v2_events`
- `notify_v2_campaign_labels`

주의:

- 현재 코드상 `/notify`의 설문/알림 신청 통계는 Supabase가 아니라 Vercel Postgres 계열 테이블을 보는 구조다.
- 반면 `/app` 공개 MVP와 장소/사진/공유링크 쪽은 Supabase를 보는 구조다.

## /

URL: https://doripe.kr/

역할: B2C 앱 랜딩페이지.

핵심 문구:

- `오늘 어디 갈지, 떠오르는 곳이 없다면.`
- `검색어가 없어도 괜찮아요. 오늘의 분위기에 맞는 카페, 식당, 술집, 샵을 가볍게 넘겨보세요.`
- `저장해두고 잊던 장소, 이제 갈 때 다시 꺼내세요.`

주요 내용:

- Doripe를 "분위기로 고르고 다시 꺼내 쓰는 장소 앱"으로 소개한다.
- 문제 상황은 장소를 모르는 것이 아니라, 지금 갈 만한 후보가 바로 떠오르지 않는 것.
- 기능 흐름은 `Discover -> Save -> Go`.
- 앱 목업 이미지가 메인 비주얼로 들어간다.
- CTA는 `/notify` 알림신청으로 연결된다.
- 신청자 수 카운트와 캠페인 코드 `?c=` 트래킹이 들어가 있다.

판단:

- 현재 메인 랜딩은 B2C 알림신청 전환용이다.
- 메시지는 "장소 발견 + 저장 장소 재활용 + 루트" 쪽에 맞춰져 있다.

## /notify

URL: https://doripe.kr/notify

역할: 장소 취향 테스트 기반 베타 알림신청 페이지.

핵심 흐름:

- 사진 2장 중 더 끌리는 장소를 10번 선택한다.
- 이메일만 입력하면 장소 취향 캐릭터를 바로 확인한다.
- 결과 링크를 공유할 수 있다.
- 공유 링크로 들어온 친구가 테스트를 완료하면 원 공유자와의 장소 궁합 점수를 볼 수 있다.

수집 항목:

- 이메일
- 10개 선택값
- 산출된 캐릭터
- 공유 링크 slug
- 친구 유입 ref slug

저장 위치:

- 새 결과/이벤트: Supabase `notify_taste_results`, `notify_taste_events`
- 기존 `signups`, `events`, `notify_v2_signups`, `notify_v2_events`, `notify_v2_campaign_labels`는 수정하지 않는다.

주요 기능:

- `/api/notify-taste`로 결과 생성/조회.
- `/api/notify-taste-event`로 퍼널 이벤트 기록.
- `navigator.share()` 기반 공유.
- Web Share API 미지원 브라우저는 링크 복사 fallback.

## /company

URL: https://doripe.kr/company

역할: 팀/회사 소개 페이지.

핵심 문구:

- `Doripe Company - 연세대학교 창업학회에서 시작한 로컬 광고 프로젝트`
- `작은 가게도, 좋은 손님을 만날 수 있어야 하니까.`

주요 내용:

- Doripe는 연세대학교 창업학회에서 시작했다고 설명한다.
- 출발점은 친구들과 약속 장소를 정할 때 저장한 곳은 많지만 오늘 갈 만한 곳이 떠오르지 않는 문제.
- 이후 로컬 가게의 광고비, 콘텐츠 제작, 노출 경쟁 문제까지 확장했다.
- CTA는 별도 파일럿 페이지가 아니라 서비스 소개/알림신청 중심으로 정리한다.

판단:

- 신뢰 형성용 페이지다.
- B2C보다는 B2B 파트너 설득에 가까운 톤이다.

## /blog

URL: https://doripe.kr/blog

역할: B2B SEO 콘텐츠 블로그.

핵심 문구:

- `Doripe Blog - 식당·카페·샵 운영자를 위한 손님 유입 가이드`
- `식당, 카페, 샵, 바, 전시공간 운영자가 손님에게 더 잘 발견되고 방문 후보가 되기 위해 바로 점검할 수 있는 로컬 마케팅 가이드`

주요 내용:

- 로컬 공간 운영자를 위한 글 목록이 있다.
- 주제는 첫 방문, 재방문, 저장, 검색 전환, 인스타그램, 네이버 플레이스, 공간 브랜딩, 커뮤니티 등이다.
- 글 목록은 B2B001부터 B2B099 계열로 구성되어 있다.
- CTA는 `/notify` 알림신청으로 연결된다.

판단:

- 일반 유저용 콘텐츠가 아니라 사장님/운영자용 콘텐츠다.
- Doripe의 B2B 인바운드/SEO 채널로 쓰이는 구조다.

## /admin

URL: https://doripe.kr/admin

역할: 내부 운영용 admin 앱.

확인 내용:

- `<title>Doripe Admin</title>`
- `robots`는 `noindex,nofollow`.
- `/admin/admin.css`, `/admin/admin.js`를 불러오는 React 앱 shell 구조.
- 공개 HTML만으로는 로그인 이후 상세 기능은 확인할 수 없다.

판단:

- 외부 마케팅 페이지가 아니라 내부 운영 도구다.
- 검색 노출 대상이 아니며, 일반 유저 플로우와 분리되어 있다.
- `doripe.kr/admin` 요청은 `vercel.json`에서 `https://doripe-admin.vercel.app/admin`으로 rewrite된다.
- admin API 원본은 `startup-reference/doripe/src/admin-routes/admin`에 있다.
- admin API는 Vercel API adapter를 통해 `api/admin/[...path].ts`에서 라우팅된다.
- 장소/사진/카테고리/태그/네이버 장소 import/사진 제출/크리에이터 제출은 Supabase service role로 처리한다.
- admin 통계는 `src/admin-server/legacyStats.ts`에서 Vercel Postgres legacy 테이블을 조회한다.

## /app

URL: https://doripe.kr/app

역할: 공개 웹 MVP 앱.

확인 내용:

- `vercel.json`에서 `/app`과 `/app/:path*`가 `/app/index.html`로 rewrite된다.
- 앱 설정은 `startup-reference/doripe/public/app/config.js`에 있다.
- API base는 `/admin/api/public/app`.
- 공개 앱은 `bootstrap`, `events`, `share-links` API를 호출한다.

데이터 흐름:

- `/admin/api/public/app/bootstrap`: Supabase에서 장소/지역/카테고리 데이터를 읽어 앱 초기 데이터를 구성한다.
- `/admin/api/public/app/events`: anonymous user/session/app event를 Supabase에 기록한다.
- `/admin/api/public/app/share-links`: Supabase `shared_links`에 장소/루트 공유 링크를 만든다.
- `/p/:shareId`, `/r/:shareId`: Vercel API `/api/share`가 공유 메타를 만들고 `/app?shareType=...&shareId=...`로 이동시킨다.

판단:

- `/app`은 랜딩이 아니라 실제 앱 MVP에 가깝다.
- 장소 데이터와 사용자 행동 이벤트는 Supabase를 쓰는 구조다.

## 현재 구조상 주의점

1. `doripe.kr/`와 `/notify`는 B2C 알림신청용이다.
2. `/company`, `/blog`는 B2B/운영자 설득 쪽에 가깝다.
3. 한 도메인 안에 B2C와 B2B 목적이 같이 섞여 있다.
4. 공개 페이지들의 canonical/OG URL이 `https://doripe.vercel.app/...`로 되어 있다.
5. 마케팅 캠페인에서 2030 알림신청을 목표로 한다면 `/notify` 중심으로 보내는 것이 맞다.
6. `/notify`가 호출하는 `notify-v2`, `track-v2`, `count` API 파일은 현재 로컬 코드에서 확인되지 않는다.
7. Supabase와 Vercel Postgres가 같이 쓰이고 있어, 알림신청/앱이벤트/장소데이터 저장소를 구분해서 봐야 한다.
8. `/admin`은 `doripe.kr` 내부 경로처럼 보이지만 실제로는 `doripe-admin.vercel.app`으로 rewrite된다.
