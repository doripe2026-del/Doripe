# 프런트엔드 연동 기준

상태: 백엔드 구현 완료, 프런트엔드 미연결. API의 단일 기준은 `docs/api/openapi.yaml`이다.

## 1. 연결 원칙

- 로그인·회원가입·이메일 인증·비밀번호 재설정·세션 갱신은 프런트엔드가 **Supabase Auth에 직접** 요청한다.
- Doripe API에는 Supabase `access_token`만 `Authorization: Bearer <token>`으로 보낸다. `refresh_token`은 보내지 않는다.
- 브라우저는 시작 시 `GET /api/v1/auth/config`에서 공개 가능한 Supabase URL, publishable key, 허용 callback URL을 받는다.
- `service_role` 키는 서버 전용이다. 브라우저 코드, 문서 예시, 로그, 분석 이벤트에 절대 넣지 않는다.
- API 응답은 성공 시 `{ data, meta }`, 실패 시 `{ error: { code, message, requestId, details } }` 형식이다.

## 2. 환경 변수 경계

| 값 | 위치 | 설명 |
|---|---|---|
| `PUBLIC_SITE_URL` | 프런트 빌드/서버 | 현재 사이트의 공개 주소. callback 생성 기준 |
| `SUPABASE_URL` | Doripe 서버 | `/auth/config`가 공개값으로 변환해 전달 |
| `SUPABASE_PUBLISHABLE_KEY` | Doripe 서버 → 브라우저 공개 가능 | RLS를 전제로 한 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Doripe 서버만 | 브라우저 노출 금지 |
| `AUTH_ALLOWED_CALLBACK_URLS` | Doripe 서버만 | 정확히 허용할 callback URL 목록 |

실제 키 값은 저장소에 넣지 않는다. 프런트가 `service_role`, DB 비밀번호, JWT 서명 비밀값을 요구하면 설계 오류다.

## 3. Supabase Auth 흐름

### 앱 시작

1. `getAuthConfig`를 호출한다.
2. 받은 `supabaseUrl`, `publishableKey`로 Supabase client를 한 번 만든다.
3. `getSession()`으로 저장된 세션을 복구한다.
4. 로그인 여부와 관계없이 `getBootstrap`으로 지역·카테고리·태그·기능 플래그를 받는다.

```ts
const configResponse = await fetch('/api/v1/auth/config').then(r => r.json())
const { supabaseUrl, publishableKey } = configResponse.data

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true }
})
```

### 회원가입과 로그인

- 회원가입: `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`
- 로그인: `supabase.auth.signInWithPassword({ email, password })`
- `emailRedirectTo`는 `/auth/config`의 `allowedCallbackUrls` 중 정확히 일치하는 값만 사용한다.
- callback 화면은 URL의 인증 코드를 Supabase SDK로 교환한 뒤, 성공하면 앱으로 이동한다. 토큰 자체를 URL이나 로그에 남기지 않는다.

### 비밀번호 재설정

1. `resetPasswordForEmail(email, { redirectTo })`를 호출한다.
2. 허용된 recovery callback에서 세션을 만든다.
3. `updateUser({ password })`로 새 비밀번호를 저장한다.
4. 성공 후 기존 민감 입력값과 오류 상세를 화면 상태에서 지운다.

### 세션 갱신과 로그아웃

- 일반 갱신은 Supabase SDK의 `autoRefreshToken`과 `onAuthStateChange`에 맡긴다.
- Doripe API가 `401`을 반환하면 `refreshSession()`을 한 번만 실행하고 원 요청을 한 번만 재시도한다.
- 두 번째 `401`이면 세션을 삭제하고 로그인 화면으로 보낸다. 무한 재시도하지 않는다.
- 로그아웃은 `supabase.auth.signOut()` 후 프런트 캐시의 `/me/*`, 저장, 코스, 문의 데이터를 제거한다.

```ts
async function doripeFetch(path: string, init: RequestInit = {}) {
  let { data: { session } } = await supabase.auth.getSession()

  const send = () => fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {})
    }
  })

  let response = await send()
  if (response.status !== 401) return response

  const refreshed = await supabase.auth.refreshSession()
  session = refreshed.data.session
  if (!session) return response
  return send()
}
```

## 4. API 사용 규칙

### 커서 페이지네이션

목록 응답의 `meta.nextCursor`를 다음 요청의 `cursor`로 그대로 보낸다. 커서를 해석하거나 수정하지 않는다. 필터가 바뀌면 이전 커서를 버리고 첫 페이지부터 요청한다.

```json
{
  "data": { "items": [] },
  "meta": {
    "requestId": "00000000-0000-4000-8000-000000000000",
    "nextCursor": null
  }
}
```

### 중복 요청 방지

OpenAPI에서 `Idempotency-Key`가 필수인 생성 요청은 사용자 행동 한 번마다 UUID 등 충돌하지 않는 값을 만들고, 네트워크 재시도 때는 같은 값을 재사용한다. 저장은 `PUT/DELETE /me/saves/{targetType}/{targetId}` 자체가 자연스럽게 중복 안전하다.

### 오류 처리

```json
{
  "error": {
    "code": "validation_failed",
    "message": "요청 값을 확인해 주세요.",
    "requestId": "00000000-0000-4000-8000-000000000000",
    "details": { "fieldErrors": [{ "field": "email", "code": "invalid" }] }
  }
}
```

- 사용자에게는 `message`와 필드 오류만 보여준다.
- 문의·장애 추적에는 `requestId`를 사용한다.
- 원본 예외, SQL, 토큰, 개인정보를 브라우저 로그나 분석 이벤트에 남기지 않는다.
- `409`는 최신 데이터를 다시 읽고 충돌 안내, `429`는 `Retry-After` 이후 재시도, `503`은 준비되지 않은 기능으로 처리한다.

## 5. 화면별 연결표

| 화면/기능 | 주 operationId |
|---|---|
| 시작·공통 데이터 | `getAuthConfig`, `getHealth`, `getReadiness`, `getBootstrap` |
| 둘러보기·피드 | `listFeed`, `getPlace`, `listPlaceContents`, `listRelatedPlaces`, `getContent` |
| 공개 프로필 | `getPublicProfile`, `listProfileContents`, `followProfile`, `unfollowProfile` |
| 저장 | `listMySaves`, `putMySave`, `deleteMySave` |
| 코스 | `listMyCourses`, `createCourse`, `getCourse`, `updateCourse`, `deleteCourse`, 코스 장소 4개 작업 |
| MY·프로필 | `getMyProfile`, `updateMyProfile`, `getMyAccount`, `putMyOnboarding` |
| 알림 설정·탈퇴 | `getMyNotifications`, `putMyNotifications`, `requestMyWithdrawal` |
| 콘텐츠·소셜 | 콘텐츠 생성/수정/제출, 좋아요, 댓글, 팔로우 operationId |
| 문의·신고 | `createInquiry`, `listMyInquiries`, `createReport`, `listMyReports` |
| 공유 | `createShare`, `resolveShare`, `revokeShare` |
| 웹 신청 폼 | `createBetaApplication`, `createCreatorApplication`, `createBusinessApplication`, 알림 신청 2개 |
| 운영자 웹 | `getAdminMe` 후 `/admin/*` operationId. 화면 노출이 아니라 서버의 DB scope가 최종 권한 판단 |

## 6. 현재 호환성 메모

- 온보딩과 알림 설정 요청에는 `schemaVersion`을 보내지 않는다. 서버가 현재 DB 기준인 `schema_version = 1`로 저장하고, 조회 응답에서 버전을 알려준다.
- 코스 생성은 `startPlaceId`와 최소 2개의 `placeIds`가 필요하다. `startPlaceId`는 `placeIds`에 포함되어야 한다.
- Milestone 1 공유 생성은 `place`, `course`만 허용하며 현재 DB 호환을 위해 `regionId`가 필수다. 콘텐츠 공유는 후속 migration과 함께 연다.
- 현재 이미지 업로드 상한은 10 MiB다. 그 밖의 이미지 정책과 동영상 업로드는 승인된 설정이 생기기 전까지 비활성화한다.
