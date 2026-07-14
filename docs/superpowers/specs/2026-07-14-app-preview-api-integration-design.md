# Doripe App Preview API Integration Design

## 1. 목적

현재 `public/app-preview`의 화면과 동작을 유지하면서, 화면이 fixture를 직접 읽는 구조를 제거한다. 이후 같은 화면 코드가 fixture와 Backend API v1 중 어느 쪽에서도 데이터를 받을 수 있게 만든다.

이 설계의 완료 기준은 다음과 같다.

- 화면 파일이 `PLACES`, `MEDIA`, `USERS`, `ROUTES`, `COMMENTS`, `TAGS`를 직접 import하지 않는다.
- fixture 모드에서 현재 시각 결과와 사용자 흐름이 유지된다.
- API 모드에서 staging Supabase 기반 `/api/v1` 응답을 같은 화면 모델로 변환한다.
- 읽기 실패, 쓰기 실패, 인증 만료, 미디어 URL 만료를 화면이 일관되게 처리한다.
- production 배포와 production migration 적용은 이번 범위에 포함하지 않는다.

## 2. 현재 상태

- 화면, transition, state가 fixture 배열과 배열 위치에 직접 의존한다.
- `api-adapter.js`는 일부 조회와 저장·팔로우만 감싸며 화면의 직접 fixture 접근을 막지 못한다.
- Backend API v1은 별도 `codex/backend-api` worktree에 작성되어 있고 현재 미리보기 브랜치에는 합쳐지지 않았다.
- Backend API와 migration은 production에 적용되지 않았고 staging 통합 검증도 끝나지 않았다.
- Brain 기준으로 장소·콘텐츠·코스·미디어·공개 프로필은 서로 다른 핵심 객체다.

## 3. 선택한 접근법

화면과 데이터 공급처 사이에 공통 데이터 계층을 둔다.

```text
Screen Renderer
    ↓
App Store / Use Case
    ↓
Repository Contract
    ↓
Fixture Adapter | HTTP API Adapter
    ↓
Fixture Data    | /api/v1 → staging Supabase
```

화면은 데이터가 fixture인지 API인지 알지 못한다. 두 adapter는 같은 repository contract를 구현하고, API 응답은 mapper를 거쳐 화면 전용 모델로 변환한다.

## 4. 모듈 경계

### 4.1 Screen Renderer

- 받은 화면 모델을 DOM으로 표현한다.
- 버튼 클릭을 action으로 전달한다.
- fixture, API endpoint, DB column을 알지 못한다.
- 표시용 정렬, 줄임표, 날짜 문구처럼 순수한 UI 변환만 수행한다.

### 4.2 App Store

- 현재 사용자, 선택 콘텐츠, 필터, 저장·팔로우 상태, 로딩·오류 상태를 관리한다.
- adapter에서 받은 데이터를 ID 기준으로 정규화한다.
- 화면 전환 시 필요한 데이터가 없으면 repository를 호출한다.
- 낙관적 업데이트가 실패하면 이전 상태로 되돌린다.

### 4.3 Repository Contract

화면이 필요로 하는 기능을 데이터 공급처와 무관한 메서드로 정의한다.

- `getBootstrap()`
- `getFeed(params)`
- `getContentDetail(contentId)`
- `getPlaceDetail(placeId)`
- `getCourseDetail(courseId)`
- `getPublicProfile(profileId)`
- `getSavedPlaces(params)`
- `getSavedCourses(params)`
- `savePlace(placeId)` / `unsavePlace(placeId)`
- `saveCourse(courseId)` / `unsaveCourse(courseId)`
- `followProfile(profileId)` / `unfollowProfile(profileId)`
- `likeContent(contentId)` / `unlikeContent(contentId)`
- `getComments(contentId)` / `createComment(contentId, body)`
- `createCourse(input)` / `updateCourse(courseId, input)`

### 4.4 Fixture Adapter

- 현재 fixture를 repository contract 형태로 제공한다.
- 테스트와 시각 검토의 기본 모드로 유지한다.
- 배열 순번이 아니라 ID로 데이터를 조회한다.
- API와 동일한 성공·빈 결과·실패 형태를 반환한다.

### 4.5 HTTP API Adapter

- `/api/v1` 호출, 인증 헤더, 오류 코드 변환을 담당한다.
- Backend 응답을 화면 전용 모델로 변환한다.
- Supabase를 화면에서 직접 호출하지 않는다. Supabase Auth session만 API 인증에 사용한다.

### 4.6 Mapper and Validator

- Backend response와 fixture를 동일한 화면 모델로 정규화한다.
- 필수 ID, 콘텐츠 유형, 1~5개 미디어, 장소·코스 관계를 검사한다.
- 계약에 맞지 않는 한 항목 때문에 전체 피드가 깨지지 않도록 잘못된 항목만 제외하고 기록한다.

## 5. 화면 전용 데이터 모델

### 5.1 FeedContent

- `id`
- `type`: `place` 또는 `course`
- `author`: 프로필 ID, 이름, 아바타, 공식 상태
- `media`: 1~5개의 이미지·영상과 크기, 표시 순서
- `place` 또는 `course`
- `tags`
- `counts`: 댓글·콘텐츠 좋아요 수
- `viewerState`: 저장·팔로우·콘텐츠 좋아요 여부

피드는 장소 배열이나 사진 배열이 아니라 `FeedContent[]`를 렌더링한다.

### 5.2 PlaceDetail

- 장소 ID, 이름, 주소, 좌표
- 카테고리와 태그
- 운영시간, 대표 메뉴, 가격 정보, 체류 시간
- 인근 역, 네이버 지도 링크
- 공식 장소 사진과 사용자 콘텐츠 미디어를 구분한 목록
- 댓글, 관련 장소, viewer 저장 상태

### 5.3 CourseDetail

- 코스 ID, 이름, 작성자
- 순서가 있는 장소 목록
- 직접 입력된 구간 이동시간과 전체 합계
- 콘텐츠 미디어와 태그
- viewer 저장 상태

### 5.4 PublicProfile

- 프로필 ID, 이름, 소개, 아바타, 공식 상태
- 팔로워·팔로잉·콘텐츠 수
- viewer 팔로우 상태
- 공개 콘텐츠 목록

Backend에 없는 저장 장소·코스 수와 공개 코스 목록은 API가 보완되기 전까지 표시하지 않는다.

## 6. 고정 UI와 동적 데이터 구분

### 고정 UI

- 화면 제목과 버튼 문구
- `주소`, `영업시간`, `대표 메뉴` 같은 label
- 빈 화면·오류·재시도 문구
- 레이아웃, 색상, 아이콘, motion

### API 데이터

- 장소·코스·프로필·태그·사진·영상
- 댓글과 수치
- 저장·팔로우·좋아요 상태
- 운영시간, 주소, 메뉴, 외부 지도 링크

### 화면 임시 상태

- 현재 미디어 번호
- 열린 sheet와 높이
- 선택된 filter
- 입력 중인 댓글과 코스 이름

## 7. Backend 계약 차이 처리

API 연결 전에 다음 차이를 명시적으로 해결한다.

1. 장소형 콘텐츠는 장소를 정확히 1개만 허용하도록 Backend 계약을 맞춘다.
2. 코스형 콘텐츠의 각 미디어가 어느 장소에 속하는지 저장할 수 있도록 계약과 migration을 보완한다.
3. UI의 하트는 장소·미디어가 아니라 Backend가 지원하는 콘텐츠 좋아요로 연결한다.
4. 영상 업로드가 비활성화된 동안 영상 등록 UI는 숨기고, 승인된 영상 조회만 API가 제공할 때 표시한다.
5. 사용자 거리, 추천 점수·이유, 경로선, 자동 이동시간은 v1에서 표시하지 않는다.
6. 공개 프로필에 없는 저장 수와 공개 코스 목록은 임시 수치로 꾸미지 않는다.

## 8. 로딩과 오류 처리

- 첫 진입: 화면 구조 skeleton을 표시한다.
- 추가 피드: 기존 콘텐츠를 유지하고 하단에 작은 로딩 상태를 표시한다.
- 빈 결과: 오류가 아니라 해당 화면의 empty state를 표시한다.
- 읽기 실패: 현재 데이터가 있으면 유지하고 상단 alert와 재시도를 제공한다.
- 쓰기 실패: 낙관적으로 바꾼 저장·팔로우·좋아요 상태를 원복하고 alert를 표시한다.
- 인증 만료: session 갱신 1회 후 실패하면 로그인 화면으로 이동한다.
- signed media URL 만료: URL을 다시 발급받아 1회 재시도하고 실패하면 미디어 placeholder를 표시한다.

## 9. 단계별 전환

### Phase 1. UI 데이터 격리

- repository contract와 화면 모델을 만든다.
- fixture adapter를 확장한다.
- 화면·state·transition의 직접 fixture import를 제거한다.
- fixture 모드의 시각 결과와 사용자 흐름을 회귀 테스트한다.

### Phase 2. Backend 통합 준비

- `codex/backend-api` 변경을 별도 PR 검증 흐름으로 통합한다.
- 제품 기준과 다른 Backend 계약 6가지를 수정한다.
- clean migration reset, RLS, API contract test를 통과시킨다.

### Phase 3. Staging 읽기 연결

- staging Supabase를 준비하고 안전한 seed 데이터를 넣는다.
- HTTP API adapter를 구현한다.
- bootstrap → feed → 콘텐츠 상세 → 장소·코스 상세 → 프로필 순으로 연결한다.

### Phase 4. Staging 쓰기 연결

- 저장 → 코스 → 팔로우 → 콘텐츠 좋아요 → 댓글 순으로 연결한다.
- 각 기능에 낙관적 업데이트와 원복을 적용한다.

### Phase 5. 통합 검증

- fixture와 API 모드의 동일 화면 계약을 검사한다.
- 사용자 여정, 모바일 반응형, 접근성, 시각 회귀, 인증·RLS를 검증한다.
- production 연결 조건을 별도 체크리스트로 남긴다.

## 10. 테스트 전략

- Contract test: fixture adapter와 HTTP adapter가 같은 결과 형태를 반환하는지 검사한다.
- Mapper test: 누락 필드, 잘못된 콘텐츠 관계, 1~5개 미디어 규칙을 검사한다.
- Store test: loading, empty, error, 낙관적 업데이트와 원복을 검사한다.
- Screen test: 화면이 fixture를 직접 import하지 않는지와 주요 interaction을 검사한다.
- E2E test: 온보딩, 피드, 상세, 저장, 코스, 댓글, 팔로우 여정을 검사한다.
- Visual test: API 전환 전후의 승인된 화면 screenshot 차이를 검사한다.
- Backend test: migration clean reset, RLS, OpenAPI contract, 인증 경계를 검사한다.

## 11. 완료 조건

- 모든 app-preview 화면에서 fixture 직접 import가 0건이다.
- fixture 모드에서 기존 승인 화면과 핵심 동작이 유지된다.
- staging API 모드에서 핵심 사용자 여정이 새로고침 후에도 유지된다.
- UI에 Backend가 지원하지 않는 가짜 수치나 관계가 표시되지 않는다.
- fixture와 API adapter contract test, 사용자 여정 test, 시각 회귀 test가 통과한다.
- production 명령이나 production migration은 실행하지 않는다.
