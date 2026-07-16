# Brain → API 추적표

상태: 등록된 v1 계약과 공통 기반은 구현되어 있고, 프런트엔드·production은 미연결이다. 적합도·지도 경로처럼 미확정인 기능은 이 문서의 구현 완료 범위에 포함하지 않는다. 이 문서는 Doripe Brain의 백엔드 관련 행동을 OpenAPI `operationId`와 계약 테스트 ID로 연결한다. API 세부 형식의 단일 기준은 `docs/api/openapi.yaml`이다.

근거 우선순위는 canonical repository의 실제 상태, Doripe Brain의 `02 Product/06 Backend`, 기능·핵심 객체·분석 문서, 승인된 구현 사양 순이다. Brain이 정하지 않은 광고 과금·환불·보존 기간·피드 점수는 이 계약에서 새로 만들지 않는다.

## 인증과 시스템

| Brain 행동 | operationId 또는 외부 계약 | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 이메일 회원가입·로그인·인증·복구·로그아웃 | `supabase.auth.signUp`, `signInWithPassword`, callback code exchange, `resetPasswordForEmail`, `updateUser`, `signOut` | Supabase Auth 직접 연결 | M1 | `contract.auth.direct-flow` |
| 브라우저 공개 인증 설정 | `getAuthConfig` | public | M1 | `contract.auth.config` |
| 생존·준비 상태 | `getHealth`, `getReadiness` | public | M1 | `contract.system.health-readiness` |
| 지역·분류·태그·기능 플래그 | `getBootstrap` | public | M1 | `contract.bootstrap.public` |

## 탐색·장소·프로필

| Brain 행동 | operationId | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 피드 탐색과 다음 페이지 | `listFeed` | optional user | M1 | `contract.feed.cursor` |
| 장소 상세·연결 콘텐츠·비슷한 장소 | `getPlace`, `listPlaceContents`, `listRelatedPlaces` | public | M1 | `contract.place.discovery` |
| 콘텐츠 상세 | `getContent` | optional user | M2 | `contract.content.public-read` |
| 공개 프로필과 작성 콘텐츠 | `getPublicProfile`, `listProfileContents` | public | M2 | `contract.profile.public-read` |

## MY·개인 설정

| Brain 행동 | operationId | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 내 프로필 조회·수정 | `getMyProfile`, `updateMyProfile` | user | M1 | `contract.me.profile` |
| 내 계정 상태 확인 | `getMyAccount` | user | M1 | `contract.me.account-redaction` |
| 온보딩 취향 저장 | `putMyOnboarding` | user | M1 | `contract.me.onboarding-v1` |
| 알림 설정 조회·저장 | `getMyNotifications`, `putMyNotifications` | user | M1 | `contract.me.notifications-v1` |
| 회원 탈퇴 요청 | `requestMyWithdrawal` | user | M1 | `contract.me.withdrawal` |

온보딩·알림 설정의 `schema_version = 1`은 서버가 저장한다. 클라이언트 요청 필드로 받지 않는다.

## 저장·코스·공유

| Brain 행동 | operationId | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 저장 목록·저장·해제 | `listMySaves`, `putMySave`, `deleteMySave` | user | M1 | `contract.saves.retry-unsave` |
| 내 코스 목록·생성 | `listMyCourses`, `createCourse` | user | M1 | `contract.course.list-create` |
| 코스 상세·수정·삭제 | `getCourse`, `updateCourse`, `deleteCourse` | optional user / user | M1 | `contract.course.read-update-delete` |
| 코스 장소 추가·순서/메모 수정·삭제·교체 | `addCoursePlace`, `updateCoursePlace`, `deleteCoursePlace`, `replaceCoursePlace` | user | M1 | `contract.course.place-order-replace` |
| 공유 생성·공개 조회·취소 | `createShare`, `resolveShare`, `revokeShare` | user / public | M1 | `contract.share.lifecycle` |

M1 코스 생성은 `startPlaceId`가 필수다. M1 공유는 `place`, `course`와 `regionId`만 허용하며 콘텐츠 공유는 migration 이후 연다.

## 콘텐츠·소셜·미디어

| Brain 행동 | operationId | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 콘텐츠 초안 생성·내 목록·수정·제출 | `createContent`, `listMyContents`, `updateContent`, `submitContent` | user | M2 | `contract.content.draft-submit` |
| 큐레이터 팔로우·해제·내 팔로잉 | `followProfile`, `unfollowProfile`, `listMyFollowing` | user | M2 | `contract.social.follow` |
| 콘텐츠 좋아요·해제 | `likeContent`, `unlikeContent` | user | M2 | `contract.social.like` |
| 댓글 목록·생성·수정·삭제·좋아요 | `listContentComments`, `createComment`, `updateComment`, `deleteComment`, `likeComment`, `unlikeComment` | public / user | M2 | `contract.social.comments` |
| 업로드 준비·완료·삭제 | `createMediaUpload`, `completeMediaUpload`, `deleteMedia` | user | M2 | `contract.media.lifecycle` |

현재 이미지는 10 MiB 상한이다. 승인된 설정 전에는 다른 이미지 정책과 동영상을 비활성화한다.

## 문의·신고·분석

| Brain 행동 | operationId | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 문의 접수·내 문의 상태 | `createInquiry`, `listMyInquiries` | user | M2 | `contract.support.inquiry` |
| 신고 접수·내 신고 상태 | `createReport`, `listMyReports` | user | M2 | `contract.support.report-redaction` |
| 분석 세션 생성 | `createAnalyticsSession` | optional user | M2 | `contract.analytics.session` |
| 이벤트 묶음 전송·중복 제거 | `createEvents` | optional user | M2 | `contract.analytics.batch-dedup` |

분석 속성은 OpenAPI allowlist만 받는다. 이메일·전화번호·토큰·자유 입력 본문은 분석 이벤트에 넣지 않는다.

## 웹 신청 폼

| Brain 행동 | operationId | 인증 | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 베타 신청 | `createBetaApplication` | public | M3 | `contract.forms.beta-dedup` |
| 큐레이터 신청 | `createCreatorApplication` | public | M3 | `contract.forms.creator-dedup` |
| 비즈니스 문의 | `createBusinessApplication` | public | M3 | `contract.forms.business-dedup` |
| 취향 서비스 알림 신청 | `createTasteNotificationRequest` | public | M3 | `contract.forms.taste-notify-dedup` |
| 이벤트 알림 신청 | `createEventNotificationRequest` | public | M3 | `contract.forms.event-notify-dedup` |

공개 쓰기는 durable rate limiter가 준비되지 않으면 production readiness가 실패해야 한다. 개인정보 원문은 분석 테이블에 복제하지 않는다.

## 운영자 공통

운영자 표시는 권한이 아니다. `getAdminMe`는 활성 `operator_accounts`와 DB에 저장된 scope를 반환하며, 각 요청에서 아래 scope를 다시 검사한다.

| Brain 운영 행동 | operationId | DB scope | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 내 운영 권한·대시보드 | `getAdminMe`, `getAdminDashboard` | active operator / `analytics:read` | M2 | `contract.admin.identity-dashboard` |
| 장소 목록·생성·상세·수정 | `listAdminPlaces`, `createAdminPlace`, `getAdminPlace`, `updateAdminPlace` | `content:write` | M2 | `contract.admin.places` |
| 콘텐츠 검수 목록·상세·상태 변경 | `listAdminContents`, `getAdminContent`, `updateAdminContent` | `content:write` | M2 | `contract.admin.contents` |
| 통합 검수 큐 | `listAdminModerationItems`, `getAdminModeration`, `updateAdminModeration` | `content:write` | M2 | `contract.admin.moderation` |
| 신고 검토 | `listAdminReports`, `getAdminReport`, `updateAdminReport` | `users:moderate` | M2 | `contract.admin.reports` |
| 사용자 관리 | `listAdminUsers`, `getAdminUser`, `updateAdminUser` | `users:moderate` | M2 | `contract.admin.users` |
| 큐레이터 관리 | `listAdminCurators`, `getAdminCurator`, `updateAdminCurator` | `users:moderate` | M2 | `contract.admin.curators` |
| 카테고리 목록·생성·수정 | `listAdminCategories`, `createAdminCategory`, `updateAdminCategory` | `content:write` | M2 | `contract.admin.categories` |
| 태그 목록·생성·수정 | `listAdminTags`, `createAdminTag`, `updateAdminTag` | `content:write` | M2 | `contract.admin.tags` |
| 미디어 목록·상세·상태 변경 | `listAdminMedia`, `getAdminMedia`, `updateAdminMedia` | `content:write` | M2 | `contract.admin.media` |
| 네이버 장소 가져오기 | `importAdminNaverPlace` | `content:write` | M2 | `contract.admin.naver-import` |

## 운영자 신청·비즈니스·감사

| Brain 운영 행동 | operationId | DB scope | 단계 | 계약 테스트 ID |
|---|---|---|---|---|
| 신청 목록·상세·상태 변경 | `listAdminIntake`, `getAdminIntake`, `updateAdminIntake` | kind별 `analytics:read`, `content:write`, `business:write` | M3 | `contract.admin.intake-scope-map` |
| 파트너십 목록·생성·상세·수정 | `listAdminPartnerships`, `createAdminPartnership`, `getAdminPartnership`, `updateAdminPartnership` | `business:write` | M3 | `contract.admin.partnerships` |
| 조직 목록·생성·상세·수정 | `listAdminOrganizations`, `createAdminOrganization`, `getAdminOrganization`, `updateAdminOrganization` | `business:write` | M3 | `contract.admin.organizations` |
| 캠페인 목록·생성·상세·수정 | `listAdminCampaigns`, `createAdminCampaign`, `getAdminCampaign`, `updateAdminCampaign` | `business:write` | M3 | `contract.admin.campaigns` |
| 집계 분석 | `getAdminAnalytics` | `analytics:read` | M3 | `contract.admin.analytics-redaction` |
| 변경 감사 로그 | `listAdminAudit` | `operators:manage` | M2 | `contract.admin.audit-immutable` |

모든 운영자 변경 요청은 이유와 예상 버전을 검증하고 감사 로그에 `operatorId`, 대상, 작업, 이유, `requestId`를 남긴다.

## 최종 게이트

- OpenAPI의 모든 HTTP 작업에는 고유 `operationId`, 인증 등급, operator scope, idempotency, pagination, 성공·오류 응답이 있어야 한다.
- 위 모든 `operationId`는 최소 하나의 계약 테스트 ID에 연결되어야 한다.
- 생성된 TypeScript client와 화면 adapter fixture가 typecheck를 통과해야 한다.
- Brain과 코드가 충돌하면 자동으로 정책을 만들지 않고 차이를 기록해 사용자 결정을 받는다.
