# Instagram Factory Command Design

## Goal

Doripe 인스타그램 피드 제작을 반복 가능한 공장으로 만든다.

사용자는 콘텐츠 폴더를 만들고 제목 엑셀과 숫자 이미지 파일만 넣는다. 이후 Codex에게 slash command와 폴더 경로를 보내면, Codex가 Figma 파일 안에서 `Source` 페이지의 템플릿을 `Instagram` 페이지로 복사하고, 제목과 사진을 교체한다.

캡션 생성은 범위에서 제외한다.

## Command

단일 게시물:

```text
/인스타공장 /absolute/path/to/post-folder
```

여러 게시물:

```text
/인스타공장 --all /absolute/path/to/factory-folder
```

## Trigger Rule

Codex가 Doripe repository context에서 아래 형태의 메시지를 받으면 별도 설명 없이 이 문서의 작업으로 해석한다.

```text
/인스타공장 ...
```

즉 `/인스타공장`은 채팅용 slash command다. 터미널 명령어가 아니다.

## Input Folder

1개 폴더는 1개 인스타 게시물이다.

```text
001_object_yeonnam/
  input.xlsx
  1.jpg
  2.jpg
  3.jpg
```

## Excel Schema

`input.xlsx`에는 제목만 둔다.

| column | required | description |
|---|---:|---|
| title | yes | 커버/게시물 대표 문구 |

예시:

```text
title
연남에서 조용히 머물기 좋은 공간
```

## Image Rules

| rule | value |
|---|---|
| 파일명 | 숫자만 사용 |
| 순서 | `1.jpg`, `2.jpg`, `3.jpg` 순 |
| 최대 개수 | 10장 |
| 지원 확장자 | `.jpg`, `.jpeg`, `.png` |
| 누락 슬롯 | Figma에서 숨김 처리 |

예시:

```text
1.jpg -> photo_1
2.jpg -> photo_2
3.jpg -> photo_3
photo_4 ~ photo_10 -> hidden
```

## Figma File Structure

같은 Figma 파일 안에 두 페이지를 둔다.

```text
Source
Instagram
```

### Source Page

원본 템플릿 페이지다.

규칙:
- 직접 결과물을 만들지 않는다.
- 템플릿 수정은 `Source`에서만 한다.
- 자동화는 매번 `Source`의 템플릿을 복사해서 사용한다.

필수 레이어명:

```text
title
photo_1
photo_2
photo_3
photo_4
photo_5
photo_6
photo_7
photo_8
photo_9
photo_10
```

### Instagram Page

실제 업로드용 결과물 페이지다.

규칙:
- 매번 `Source`에서 복사된 결과물만 둔다.
- 사용자가 export/download 후 페이지를 비운다.
- 다음 실행 때 다시 새 결과물을 만든다.

## Processing Flow

단일 게시물 명령어:

```text
/인스타공장 /path/to/001_object_yeonnam
```

처리 순서:

1. 폴더 존재 여부 확인
2. `input.xlsx` 존재 여부 확인
3. `title` 읽기
4. 숫자 이미지 파일 정렬
5. 이미지 개수 1~10장 검증
6. Figma `Source` 페이지 템플릿 복사
7. 복사본을 `Instagram` 페이지에 배치
8. `title` 레이어 교체
9. `photo_1`부터 순서대로 이미지 교체
10. 없는 `photo_*` 슬롯 숨김
11. 완료 상태 보고

여러 게시물 명령어:

```text
/인스타공장 --all /path/to/instagram_factory
```

처리 순서:

1. 하위 폴더를 이름순으로 정렬
2. 각 폴더를 단일 게시물 규칙으로 처리
3. `Instagram` 페이지에는 여러 게시물이 순서대로 쌓임

## Validation

실패 조건:

| condition | message |
|---|---|
| 폴더 없음 | `폴더를 찾을 수 없습니다.` |
| `input.xlsx` 없음 | `input.xlsx가 없습니다.` |
| `title` 없음 | `input.xlsx에 title 컬럼이 없습니다.` |
| 이미지 없음 | `1장 이상의 이미지가 필요합니다.` |
| 이미지 10장 초과 | `이미지는 최대 10장까지 지원합니다.` |
| 숫자가 아닌 이미지 파일명 | `이미지 파일명은 1.jpg, 2.jpg 형식이어야 합니다.` |
| `Source` 페이지 없음 | `Figma Source 페이지를 찾을 수 없습니다.` |
| `Instagram` 페이지 없음 | `Figma Instagram 페이지를 찾을 수 없습니다.` |
| 필수 레이어 없음 | `필수 레이어가 없습니다: <layer_name>` |

## Non-Goals

- 캡션 생성
- 해시태그 생성
- 인스타그램 자동 업로드
- 사진 보정
- 사진 저작권 검증
- 장소 위치/출처 자동 입력
- Figma 템플릿 자동 디자인

## Acceptance Criteria

- [ ] 사용자가 `/인스타공장 <폴더경로>`를 보내면 해당 폴더의 제목과 사진이 Figma `Instagram` 페이지에 반영된다.
- [ ] 사진 파일명 숫자 순서가 Figma 사진 순서와 일치한다.
- [ ] 사진이 없는 `photo_*` 슬롯은 보이지 않는다.
- [ ] `Source` 페이지는 수정되지 않는다.
- [ ] `Instagram` 페이지에만 결과물이 생긴다.
- [ ] 입력 오류가 있으면 어떤 파일/컬럼/레이어가 문제인지 명확히 알려준다.

## Open Implementation Decision

Figma 조작 방식은 구현 전에 결정해야 한다.

| option | description | note |
|---|---|---|
| Figma MCP | Codex에서 Figma 파일을 직접 조작 | 현재 대화 흐름에 가장 자연스러움 |
| Figma Plugin | Figma 내부 플러그인으로 폴더/엑셀을 읽어 치환 | 안정적이지만 별도 플러그인 개발 필요 |
| Local Script + Figma API | 로컬 스크립트가 Figma API로 페이지/노드 수정 | 토큰/노드 ID 관리 필요 |

추천:

초기에는 Figma MCP 또는 Figma API로 작게 검증한다. 성공하면 반복 실행용 로컬 스크립트로 고정한다.
