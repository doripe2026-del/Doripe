# Doripe Figma 전체 화면 웹 프로토타입 설계

## 1. 목표

Figma `Doripe UI`의 node `446:33`을 유일한 디자인 기준으로 삼아 모든 화면을 웹 프로토타입으로 구현한다.

- Figma 화면을 눈대중이 아닌 실제 수치로 재현한다.
- 화면에 보이는 모든 버튼과 입력 요소가 작동한다.
- 실제 사용자 흐름과 전체 화면 검수 기능을 한 웹에서 제공한다.
- 화면별 검수 후 실제 Doripe 데이터와 API를 단계적으로 연결할 수 있어야 한다.

Figma 기준:

`https://www.figma.com/design/TfZAtv9JUy508otim4P23w/Doripe-UI?node-id=446-33`

## 2. 현재 상황

### Figma

- 전체 디자인 프레임은 약 75개다.
- 중복된 구버전 온보딩을 제외하면 실질 구현 후보는 약 59개다.
- 주요 그룹은 A 온보딩, B 장소 발견, C 저장, D 코스, E 프로필·설정이다.
- 실제 Figma Component와 Instance는 없다.
- Prototype reaction도 없다.
- 대부분의 요소가 `393×852` 프레임 안의 절대좌표로 배치되어 있다.
- 지도와 일부 사진은 placeholder 또는 mock 이미지다.

### 기존 웹 앱

- 기존 `/app`은 바닐라 JavaScript SPA다.
- 약 20개 화면 상태를 문자열 HTML로 렌더링한다.
- `public/app/styles.css`는 6,427줄이며 화면별 override가 누적되어 있다.
- 기존 Supabase 구조, 관리자 CRUD, 승인된 이미지·아이콘과 일부 상태·제스처 로직은 재사용할 수 있다.
- 기존 UI와 거대한 CSS는 새 프로토타입의 구현 기준으로 사용하지 않는다.

## 3. 범위

### 포함

- Figma 구현 대상 화면 전체
- 모든 visible action의 동작
- 데스크톱 검수 화면
- 모바일 전체 화면 실행
- 테스트용 fixture 데이터와 로컬 상태
- Figma node별 수치 기록
- 화면별 reference screenshot
- 자동 기능 테스트와 시각 비교
- 향후 실제 API를 연결할 수 있는 데이터 경계

### 제외

- Figma 디자인 개선 또는 재디자인
- 제품 범위 재검토
- 실제 머신러닝 추천 알고리즘
- 1차 화면 검수 이전의 전체 API 연결
- 1차 화면 검수 이전의 실제 지도·길찾기 API 연결
- 기존 `/app`에 대한 즉시 교체
- 직접 production 배포

## 4. 결과물 구조

### 데스크톱

브라우저 전체는 스크롤되지 않는다.

- 왼쪽: `393×852` 휴대폰 화면
- 오른쪽: A~E 화면 목록
- 오른쪽 목록만 세로 스크롤
- 목록에서 화면을 선택하면 왼쪽 화면이 즉시 변경
- 각 화면에 `미검토`와 `완료` 상태 제공
- `완료` 상태는 사용자가 직접 변경
- 테스트 데이터 초기화 제공

### 모바일

- 검수 목록을 숨기고 앱만 표시
- 기기 너비를 채움
- 상단·하단 safe area 반영
- 화면 내용이 기기 높이를 넘으면 해당 콘텐츠 영역만 스크롤
- 고정 CTA와 바텀시트는 화면 하단을 기준으로 배치
- 가로 스크롤과 요소 잘림을 허용하지 않음

## 5. 구현 구조

기존 `/app`과 분리된 `public/app-preview`를 만든다.

```text
public/app-preview/
  index.html
  main.js
  screen-registry.js
  transitions.js
  state.js
  fixtures.js
  api-adapter.js
  screens/
    onboarding.js
    discover.js
    saved.js
    route.js
    profile-settings.js
  styles/
    tokens.css
    shell.css
    components.css
    onboarding.css
    discover.css
    saved.css
    route.css
    profile-settings.css
  figma/
    screen-measurements.json
    visual-masks.json
  assets/
```

### 화면 Registry

각 화면은 다음 정보를 가진다.

```text
화면 ID
화면명
Figma node ID
그룹 A~E
렌더 함수
진입 가능한 이전 화면
버튼·입력 동작
reference screenshot
시각 비교 제외 영역
검수 상태
```

화면 registry는 실제 앱 흐름과 오른쪽 검수 목록이 함께 사용한다. 검수 화면만을 위한 별도 복제 UI는 만들지 않는다.

### 공통 UI

공통화는 Figma에서 동일한 수치가 반복되는 요소에만 적용한다.

- 브랜드 로고
- 뒤로가기 버튼
- 하단 내비게이션
- 기본 버튼
- 입력창
- 태그와 필터 칩
- 프로필 이미지
- 바텀시트 손잡이
- 공통 확인창과 상단 알림

Figma에서 미세한 수치가 다른 요소를 억지로 하나의 공통 컴포넌트로 합치지 않는다.

## 6. Figma 구현 절차

화면마다 다음 절차를 반복한다.

1. 구현 대상 frame과 node ID를 확정한다.
2. Figma Dev Mode 또는 Figma MCP에서 위치, 크기, 색상, 폰트, 행간, 모서리, 그림자와 자산을 읽는다.
3. 해당 화면의 reference screenshot을 저장한다.
4. 임시 Figma asset URL의 파일을 프로젝트 자산으로 보관한다.
5. `screen-measurements.json`에 핵심 수치와 node ID를 기록한다.
6. 화면을 구현한다.
7. `393×852`에서 구현 screenshot을 촬영한다.
8. reference와 자동 비교한다.
9. 차이를 수정한 뒤 사용자가 직접 완료 처리한다.

### 시각 검수 기준

- 요소 위치와 크기: 최대 1px 차이
- 색상: Figma 값과 동일
- 폰트 크기, 굵기, 행간: Figma 값과 동일
- 모서리와 그림자: Figma 값과 동일
- 전체 screenshot 차이: 동적 영역을 제외하고 2% 이하
- 사진, 영상, 지도처럼 내용이 바뀌는 영역은 mask 처리하되 컨테이너 위치와 크기는 비교
- 육안으로 보이는 겹침, 줄바꿈 차이, 잘림은 허용하지 않음

## 7. 버튼과 화면 연결

모든 visible action은 `transitions.js`에 기록한다.

```text
현재 화면 → 사용자 행동 → 조건 → 다음 화면 또는 상태 → 변경 데이터
```

동작 결정 순서는 다음과 같다.

1. Figma에 대응 화면이 있으면 해당 화면으로 연결한다.
2. 오류·선택·로딩처럼 같은 화면의 변형이면 상태를 변경한다.
3. 저장·좋아요·팔로우·태그 선택은 로컬 상태를 즉시 갱신한다.
4. 사진 넘기기, 스와이프, 바텀시트는 모바일 제스처와 애니메이션을 적용한다.
5. 공유는 Web Share API를 사용하고 미지원 환경에서는 링크 복사 알림을 표시한다.
6. 지도·길찾기는 1차 단계에서 Figma 지도 상태로 전환한다.
7. 삭제·로그아웃·탈퇴처럼 확인이 필요한 동작은 Figma 시각 언어를 사용한 공통 확인창을 표시한다.
8. 로그인·회원가입은 입력 검증과 성공·실패 상태까지 구현하고 실제 인증 연결은 이후 단계로 둔다.

목적지가 정해지지 않은 버튼을 무반응 상태로 두지 않는다. transition이 없는 action은 자동 검사에서 실패해야 한다.

## 8. 상태와 테스트 데이터

### 상태

- 현재 화면
- 화면 이동 기록
- 입력값과 입력 오류
- 선택한 태그와 필터
- 저장·좋아요·팔로우 상태
- 선택한 장소와 코스 순서
- 열린 팝업·확인창·바텀시트
- 로딩·빈 상태·오류 상태
- 화면별 검수 상태

### Fixture

- 장소
- 장소 사진과 영상
- 유저와 프로필
- 태그와 필터
- 댓글
- 저장 목록
- 코스와 포함 장소

fixture는 같은 입력에 항상 같은 화면을 만들도록 고정한다. 브라우저 새로고침 후에도 검수 상태와 주요 사용자 상태는 유지한다. 초기화 버튼을 누르면 기준 fixture로 복원한다.

## 9. API 연결 경계

화면 코드는 데이터를 직접 가져오지 않는다. `api-adapter.js`만 데이터 공급 방식을 결정한다.

### 1차

- fixture adapter 사용
- 인터넷 연결 없이 모든 화면과 버튼 검수 가능

### 2차

승인된 화면부터 실제 API adapter로 교체한다.

1. 장소·사진·태그
2. 사용자·로그인
3. 저장·좋아요·팔로우
4. 코스 생성·공유
5. 지도·길찾기

API 실패 시 앱 전체가 멈추지 않고 해당 화면의 Figma 오류 상태를 표시한다.

## 10. 오류 처리

- 이메일과 비밀번호는 입력 즉시 검증
- 서버 연결 전에는 fixture 기반 성공·실패 시나리오 제공
- 로딩이 끝나지 않는 상태에 시간 제한과 복구 동작 제공
- 빈 결과에는 필터 초기화 또는 이전 화면 이동 제공
- 존재하지 않는 화면 ID는 첫 화면이 아니라 검수용 오류 안내로 이동
- transition이 없는 버튼은 테스트 실패
- 이미지 로딩 실패 시 동일 크기의 대체 영역을 표시해 레이아웃 이동 방지
- 사용자에게 보이는 오류는 Figma의 확인창·상단 알림 형태로 통일

## 11. 테스트

### 구조 검사

- registry의 모든 화면에 유효한 ID와 Figma node ID가 존재
- 중복 화면 ID가 없음
- 모든 visible action에 transition 또는 state action이 존재
- 모든 transition의 목적지 화면이 registry에 존재

### 흐름 검사

- 온보딩 시작부터 완료까지 진행
- 발견 피드에서 장소 상세 진입
- 저장·좋아요·팔로우 반영
- 저장 화면에서 장소·코스 확인
- 코스 시작, 후보 선택, 생성, 완료
- 프로필·설정·로그아웃·탈퇴·문의 동작
- 뒤로가기 시 직전 상태 복원

### 화면 검사

- 모든 화면 직접 진입 screenshot 생성
- `393×852` reference diff
- `375×667` 작은 기기 겹침·잘림 검사
- `430×932` 큰 기기 겹침·잘림 검사
- 긴 한글 텍스트와 긴 장소명 검사
- 바텀시트·팝업·키보드 노출 상태 검사

## 12. 작업 순서

1. Figma 화면 inventory와 node ID 확정
2. 대표 복잡 화면 1개로 수치 추출·asset·screenshot diff probe
3. 데스크톱 검수 shell과 모바일 full-screen shell 구현
4. screen registry와 transition registry 구현
5. 공통 UI와 fixture/state 구현
6. A~E 화면을 그룹별로 구현
7. 모든 visible action 연결
8. 전체 visual regression과 모바일 viewport 검사
9. 사용자 화면별 검수와 완료 처리
10. 승인 화면부터 실제 API adapter 연결
11. 기존 `/app` 교체를 별도 변경으로 진행

## 13. 완료 조건

- 모든 구현 대상 Figma 화면이 registry에 존재한다.
- 오른쪽 목록에서 모든 화면을 열 수 있다.
- 왼쪽 앱에서 주요 사용자 흐름을 끝까지 진행할 수 있다.
- visible action 중 무반응 요소가 없다.
- 모든 화면이 Figma 수치 기반으로 구현되어 있다.
- 모든 화면에 reference와 구현 screenshot이 존재한다.
- 시각 차이가 검수 기준을 통과한다.
- 세 가지 viewport에서 겹침과 잘림이 없다.
- 한 화면 수정이 다른 화면을 변경하지 않는다.
- 사용자가 모든 화면의 완료 상태를 직접 관리할 수 있다.
- fixture 상태에서 기능·시각 자동 검사가 통과한다.
- 실제 API 연결 전후에 화면 구조와 transition 계약이 바뀌지 않는다.
