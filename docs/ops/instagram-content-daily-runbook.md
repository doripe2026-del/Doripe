# Instagram 콘텐츠 일일 실행 가이드

이 문서는 반복 Codex 작업이 매일 08:00 Asia/Seoul에 실행할 순서다. 목표는 검수 가능한 Instagram 콘텐츠 package를 매일 최대 2개 만드는 것이다. Instagram 로그인이나 게시는 하지 않는다.

## 절대 규칙

- 조사 대상은 대한민국 국내만 허용한다. 해외이거나 국내 여부를 공식 자료로 확인할 수 없으면 제외한다.
- 실제 웹 사진만 사용한다. AI 이미지 금지이며 `imagegen을 호출하지 않는다`.
- `rightsStatus: "restricted"` 사진은 즉시 제외한다.
- 원본 사진을 Git에 커밋하지 않는다. 다운로드와 중간 작업은 저장소 밖의 임시 폴더에서만 한다.
- Instagram 로그인 금지, Instagram 자동 게시 금지다. 최종 결과는 사람이 검수할 package일 뿐이다.
- 기준을 만족한 결과가 부족해도 점수 기준을 낮추지 않는다.

## 0. 실행 경로 준비

canonical 저장소에서 시작한다.

```bash
cd /Users/cityboy/.config/superpowers/worktrees/Doripe/codex-governance-ci

RUN_DATE="$(TZ=Asia/Seoul date +%F)"
OUTPUT_ROOT="/Users/cityboy/Desktop/Doripe/Instagram Content"
WORK_ROOT="/tmp/doripe-instagram-content/$RUN_DATE"

CANDIDATES_JSON="$WORK_ROOT/candidates.json"
HISTORY_JSON="$OUTPUT_ROOT/history.json"
PERFORMANCE_CSV="$OUTPUT_ROOT/performance.csv"
SELECTED_JSON="$WORK_ROOT/selected.json"

mkdir -p "$WORK_ROOT" "$OUTPUT_ROOT"

if [ ! -f "$HISTORY_JSON" ]; then
  printf '[]\n' > "$HISTORY_JSON"
fi
```

`history.json`은 최근 30일의 package 기록을 담는 JSON 배열이다. 처음 실행해 파일이 없을 때만 `[]`로 만든다. `performance.csv`가 없거나 비어 있으면 CLI는 성과 가산점 없이 진행한다. 이 경우 최종 보고에 성과 데이터가 없었다고 적는다.

## 1. 기준 문서 읽기

작업 전에 아래 파일을 순서대로 읽는다. 내용을 임의로 수정하지 않는다.

1. `/Users/cityboy/Desktop/Doripe/Brain/Doripe Docs/00 Home/Doripe 브레인.md`
2. `/Users/cityboy/Desktop/Doripe/Brain/Doripe Docs/07 Marketing/01. 브랜드와 핵심 메시지.md`
3. `/Users/cityboy/Desktop/Doripe/Brain/Doripe Docs/07 Marketing/04. 콘텐츠 운영.md`
4. `/Users/cityboy/Desktop/Doripe/Brain/Doripe Docs/03 Content/03 Standards/03. 콘텐츠 권리 기준.md`
5. `docs/instagram-content/template-contract.json`
6. 30일 history.json인 `$HISTORY_JSON`
7. 성과 기록인 `$PERFORMANCE_CSV`

canonical 템플릿 계약을 먼저 검사한다.

```bash
npm run instagram:content -- check-template docs/instagram-content/template-contract.json
```

이 명령이 실패하면 그날 작업을 중단하고 오류를 보고한다.

## 2. 국내 후보 최소 6개 조사

현재 운영 중인 장소·코스·행사를 웹에서 조사한다. 공식 출처 우선 순서는 정부·지자체·공공기관, 장소나 행사 공식 홈페이지, 공식 보도자료다. 블로그나 SNS만으로 국내 위치나 운영 사실을 확정하지 않는다.

각 source에는 URL, 제목, 발행처와 ISO 8601 형식의 확인 시각(`checkedAt`)을 기록한다. 모든 후보는 다음 조건을 만족해야 한다.

- `countryCode: "KR"`
- `domesticEvidenceSourceId`가 후보의 `kind: "official"` source ID와 정확히 일치
- 대한민국 위치와 현재 운영 사실을 공식 source가 뒷받침
- 서로 다른 `placeIds`와 실제 장소 정보
- 최소 2개의 실질적인 편집 요소를 만들 수 있음

해외·위치 미확인·공식 증거가 없는 후보를 먼저 제거한 뒤 유효 후보를 최소 6개 확보한다. 6개를 확보하지 못하면 사실을 꾸미지 말고 작업을 중단해 후보 부족을 보고한다.

각 후보의 다음 8개 점수를 0~5로 기록한다. 콜론 뒤 숫자는 CLI가 100점 환산에 사용하는 고정 가중치다.

1. sendPotential: 20
2. saveValue: 15
3. brandFit: 15
4. timeliness: 15
5. photoQuality: 10
6. originalityPotential: 10
7. factCompleteness: 10
8. reusePermission: 5

이전 성과에서는 sends, saves, reach와 비팔로워 도달(`non_follower_reach_rate`)을 참고한다. 수치를 추측하지 않는다.

## 3. 실제 사진과 권리 확인

후보마다 출처 URL과 credit이 있는 실제 웹 사진만 수집한다. 사진 우선순위는 다음과 같다.

1. 재사용 허가가 명시된 공식 사진 또는 직접 받은 허가: `rightsStatus: "confirmed"`
2. 출처와 credit은 확인했지만 재사용 허가를 찾지 못함: `rightsStatus: "not_found"`
3. 재사용 금지 또는 제한 확인: `rightsStatus: "restricted"`

`confirmed`를 우선 사용한다. `not_found`는 package의 권리 경고에 반드시 남기고 게시 전 사람의 확인 대상으로 표시한다. `restricted`는 후보와 draft에서 사용하지 않는다. 얼굴·차량번호·연락처 등 개인정보도 확인하고 문제가 있으면 해당 사진을 제외한다.

사진은 `$WORK_ROOT/assets/` 아래에만 저장한다. 원본 사진을 Git에 커밋하지 않는다. 저장소의 `public/`이나 테스트 fixture로 복사하지 않는다.

## 4. 후보 점수 계산과 선택

후보 JSON과 history JSON을 준비한 뒤 다음 명령을 실행한다.

```bash
npm run instagram:content -- score "$CANDIDATES_JSON" "$HISTORY_JSON" "$PERFORMANCE_CSV" "$SELECTED_JSON"
```

CLI가 국내 계약을 다시 검사하고, 30일 중복을 제외하고, 70점 이상을 매일 최대 2개 선택한다. 가능한 후보 구성이라면 `place_event`, `collection`, `route` 중 가능하면 서로 다른 콘텐츠 유형을 선택한다. 다만 다양성을 만들기 위해 점수를 고치거나 70점 기준을 낮추지 않는다.

선택 결과가 1개 또는 0개면 그대로 다음 단계의 수를 줄이고 최종 보고에 부족 사유를 적는다.

## 5. draft 작성

선택된 후보마다 별도의 `draft.json`을 만든다. 다음을 모두 포함한다.

- 장소와 사용 상황이 드러나는 구체적인 hook
- send 또는 save 중 정확히 하나의 CTA
- 검색어 나열이 아닌 자연스러운 장소 키워드 2~6개
- 후보 source ID와 일치하는 `factSourceIds`
- 최소 2개의 editorialElements: 선택 이유, 비교, 추천 상황, 지도·코스, 실용 정보, 순서가 있는 이야기 중 선택
- Instagram 위치 태그 제안 1개

사진 위에 출처만 얹은 재게시물은 실패다. 큐레이터의 선택 이유와 구조가 있는지 원본성 검수를 한다. 하나의 게시물에는 하나의 핵심 메시지와 하나의 CTA만 둔다.

## 6. 승인된 Figma 템플릿 편집

Figma connector로 파일 `9btf9oUzIvw3JQq4OPyYEn`의 `Instagram Content Automation` 페이지를 열고, 후보 유형과 일치하는 root를 복제한다.

- `PLACE_EVENT: 28:14`
- `COLLECTION: 28:15`
- `ROUTE: 28:16`

복제본에서는 `slot:* 레이어만` 텍스트·사진·credit 값으로 교체한다. root 구조, 캔버스, safe area와 공통 스타일은 바꾸지 않는다. 사용하지 않는 선택 슬라이드는 숨긴다. 템플릿 계약의 최소·최대 슬라이드 수를 지킨다.

각 슬라이드를 스크린샷으로 확인한다.

- 사진 누락, 글자 잘림, 겹침, overflow가 없어야 한다.
- 핵심 내용은 좌우 34px safe inset 안에 있어야 한다.
- 어색한 줄바꿈이나 단어 중간 줄바꿈이 있으면 문구를 먼저 줄인다.
- 그래도 해결되지 않을 때만 해당 텍스트만 줄이며, `fontSize`는 `baseFontSize`의 90% 아래로 내리지 않는다.
- 수정 후 다시 스크린샷을 확인한다.

## 7. 전체 layout evidence 작성과 검증

CLI는 `docs/instagram-content/template-contract.json` 전체를 canonical `expectedTemplate`로 자동 로드한다. 임의의 템플릿이나 일부 계약으로 바꾸지 않는다.

`layout-evidence.json`에는 선택한 계약의 모든 slot을 정확히 한 번 기록한다. 빠진 slot과 추가 slot은 모두 실패다. 모든 slot은 `editable: true`여야 한다. 사진 slot을 제외한 모든 텍스트 slot에는 `overflows`, `midWordBreak`, `baseFontSize`, `fontSize`를 실제 검사값으로 기록한다.

ROUTE 6장 예시는 다음과 같다. 다른 유형은 canonical 계약의 `id`, `rootNodeId`, slide 범위와 slot 목록을 그대로 사용한다.

```json
{
  "templateId": "route",
  "rootNodeId": "28:16",
  "canvas": { "width": 1080, "height": 1350 },
  "slideCount": 6,
  "slots": [
    { "name": "slot:title", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 64, "fontSize": 64 },
    { "name": "slot:subtitle", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 40, "fontSize": 40 },
    { "name": "slot:photo:01", "editable": true },
    { "name": "slot:place:01", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 48, "fontSize": 48 },
    { "name": "slot:body:01", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 32, "fontSize": 32 },
    { "name": "slot:info:location", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 28, "fontSize": 28 },
    { "name": "slot:cta", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 30, "fontSize": 30 },
    { "name": "slot:credit", "editable": true, "overflows": false, "midWordBreak": false, "baseFontSize": 24, "fontSize": 24 }
  ]
}
```

후보별 경로를 지정하고 검증한다.

```bash
DRAFT_JSON="$WORK_ROOT/<candidate-id>/draft.json"
LAYOUT_JSON="$WORK_ROOT/<candidate-id>/layout-evidence.json"
VALIDATION_JSON="$WORK_ROOT/<candidate-id>/validation.json"

npm run instagram:content -- validate "$DRAFT_JSON" "$LAYOUT_JSON" "$VALIDATION_JSON"
```

originality, caption, sources, layout 네 결과가 모두 `ok: true`일 때만 export로 넘어간다.

## 8. PNG export와 package 생성

Figma 슬라이드를 순서대로 각각 1080 × 1350 PNG로 export한다. PNG 경로는 모두 달라야 하며 `exports.json`의 배열 순서가 게시 순서다.

```json
{
  "sequence": 1,
  "files": [
    "/tmp/doripe-instagram-content/YYYY-MM-DD/candidate-id/01.png",
    "/tmp/doripe-instagram-content/YYYY-MM-DD/candidate-id/02.png",
    "/tmp/doripe-instagram-content/YYYY-MM-DD/candidate-id/03.png",
    "/tmp/doripe-instagram-content/YYYY-MM-DD/candidate-id/04.png",
    "/tmp/doripe-instagram-content/YYYY-MM-DD/candidate-id/05.png",
    "/tmp/doripe-instagram-content/YYYY-MM-DD/candidate-id/06.png"
  ]
}
```

반드시 `exports.files.length === layoutEvidence.slideCount`여야 하고 모두 서로 다른 PNG 경로여야 한다. 개수가 다르거나 같은 경로가 중복되면 수정 후 다시 export한다.

```bash
EXPORTS_JSON="$WORK_ROOT/<candidate-id>/exports.json"

npm run instagram:content -- finalize "$DRAFT_JSON" "$LAYOUT_JSON" "$EXPORTS_JSON" "$OUTPUT_ROOT"
```

성공하면 최종 package는 `$OUTPUT_ROOT/YYYY-MM-DD/NN-candidate-id` 형태로 생성된다. 실제 기본 경로는 `/Users/cityboy/Desktop/Doripe/Instagram Content`다. `finalize`가 stdout에 출력한 절대 경로를 최종 경로로 사용한다. package 안의 순서별 PNG, `caption.txt`, `sources.txt`, `review.txt`, `manifest.json`을 확인한다.

## 9. 30일 history 갱신

`finalize`가 성공한 package만 history.json에 추가한다. 실패한 후보는 추가하지 않는다. 각 기록은 아래 두 값을 가진다.

```json
{
  "createdAt": "manifest.json의 createdAt",
  "placeIds": ["draft.candidate.placeIds의 값"]
}
```

새 기록을 추가한 뒤 실행 시각 기준 30일보다 오래된 기록을 제거한다. `$HISTORY_JSON`은 항상 유효한 JSON 배열이어야 하며 임시 파일에 완성본을 쓴 뒤 교체한다. 다음 실행의 중복 검사가 이 파일을 사용한다.

## 10. 완료 보고

다음 형식으로 짧게 보고한다.

- 실행 날짜와 조사 후보 수
- 선택 결과와 점수, 콘텐츠 유형
- 생성된 두 package 경로, 또는 통과 결과가 1개 또는 0개인 부족 사유
- 사용한 공식 사실 출처와 확인 시각
- `not_found` 사진의 권리 경고와 개인정보 확인 결과
- 성과 데이터 적용 여부
- Instagram에 로그인하거나 게시하지 않았다는 확인

후보 부족, 70점 미달, 권리 문제, 검증 실패가 있으면 그대로 기록한다. 결과 수를 맞추기 위해 후보를 조작하거나 점수 기준을 낮추지 않는다.
