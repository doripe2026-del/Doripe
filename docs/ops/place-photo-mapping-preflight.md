# Place photo mapping preflight

기존 Storage object를 `place_photos` 행과 연결하기 전에 로컬에서 CSV를 검사한다. 이 명령은 로컬 파일만 읽고 정렬된 JSON 계획만 출력한다. Supabase나 Storage에 접속하지 않고 파일도 변경하지 않는다.

## 입력 파일

다음 세 파일이 필요하다.

1. `place-photo-mapping.template.csv` 형식의 mapping CSV
2. `place-photo-storage-manifest.example.json` 형식의 Storage object 목록
3. `place-photo-place-manifest.example.json` 형식의 장소 목록

CSV 열은 다음 순서와 이름을 정확히 사용한다.

```text
photo_id,storage_bucket,storage_path,place_id,source_type,permission_status,photo_type,display_order,rights_holder_name,credit_text,usage_scope,license_note
```

- `photo_id`: UUID
- `place_id`: 영문자·숫자로 시작하고 영문자·숫자·`_`·`-`만 사용하는 최대 80자 장소 ID
- `source_type`: `team`, `owner`, `creator`, `licensed`, `naver`
- `permission_status`: `pending`, `approved`, `rejected`
- `photo_type`: `cover`, `gallery`, `original`, `rights`
- `display_order`: 0 이상의 정수

`provider_id`, `publish_status`, `rights_status`, `sort_position`, `public_url`은 입력하지 않는다. `public_url`은 실제 반영 단계에서 공개 bucket과 path로부터 생성해야 한다. CSV의 `storage_bucket`은 DB 반영 시 `place_photos.bucket_id`에 대응한다.

## 검증 규칙

- `cover`, `gallery`는 `place-photos-public`만 사용한다.
- `original`, `rights`는 `place-photo-originals`만 사용한다.
- 공개 사진은 `permission_status=approved`이고 `usage_scope`가 있어야 한다.
- `licensed` 사진은 `license_note`가 있어야 한다.
- 공개 사진은 장소당 최대 5장, cover는 최대 1장이다.
- 공개 사진의 `display_order`는 `01`과 `1`처럼 숫자로 바꾼 뒤 같은 값이면 중복으로 처리한다.
- Storage object는 manifest에 같은 bucket과 같은 path로 존재해야 한다.
- 모든 장소는 place manifest에 존재해야 한다.
- 공개 사진의 장소는 `status=ready`, `qa_status=ready`, `photo_qa_status=approved`여야 한다.

## 실행

```bash
npm run preflight:place-photos -- \
  --mapping ./mapping.csv \
  --storage-manifest ./storage.json \
  --place-manifest ./places.json
```

성공하면 `valid: true`와 `summary`, `plan`을 출력한다. 입력이나 검증에 문제가 있으면 항상 `valid: false`, `summary`, `errors`, 빈 `plan`을 JSON으로 출력하고 종료 코드 1을 반환한다. 이 CLI에는 쓰기 모드가 없다.
