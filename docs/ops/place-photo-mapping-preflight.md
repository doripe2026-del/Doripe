# Place photo mapping preflight

기존 Storage object를 `place_photos` 행과 연결하기 전에 로컬에서 CSV를 검사한다. 이 명령은 로컬 파일만 읽고 정렬된 JSON 계획만 출력한다. Supabase나 Storage에 접속하지 않고 파일도 변경하지 않는다.

## 입력 파일

다음 세 파일이 필요하다.

1. `place-photo-mapping.template.csv` 형식의 mapping CSV
2. `place-photo-mapping-storage-manifest.example.json` 형식의 Storage object 목록
3. `place-photo-mapping-place-manifest.example.json` 형식의 장소 목록

CSV 열은 다음 순서와 이름을 정확히 사용한다.

```text
photo_id,storage_bucket,storage_path,place_id,source_type,permission_status,photo_type,display_order,rights_holder_name,credit_text,usage_scope,license_note
```

- `photo_id`: UUID
- `place_id`: 영문자·숫자로 시작하고 영문자·숫자·`_`·`-`만 사용하는 최대 80자 장소 ID
- `source_type`: `team`, `owner`, `creator`, `licensed`, `naver`
- `permission_status`: `pending`, `approved`, `rejected`
- `photo_type`: `cover`, `gallery`, `original`, `rights`
- `display_order`: `0..10000` 정수

`provider_id`, `publish_status`, `rights_status`, `sort_position`, `public_url`은 입력하지 않는다. `public_url`은 실제 반영 단계에서 공개 bucket과 path로부터 생성해야 한다. CSV의 `storage_bucket`은 DB 반영 시 `place_photos.bucket_id`에 대응한다.

## 검증 규칙

- `cover`, `gallery`는 `place-photos-public`만 사용한다.
- `original`, `rights`는 `place-photo-originals`만 사용한다.
- 공개 사진은 `permission_status=approved`이고 `usage_scope`가 있어야 한다.
- `licensed` 사진은 `license_note`가 있어야 한다.
- 공개 사진은 장소당 최대 5장이다. `cover`는 `display_order=0`, `gallery`는 `display_order=1..4`만 허용한다.
- 공개 사진의 `display_order`는 `01`과 `1`처럼 숫자로 바꾼 뒤 같은 값이면 중복으로 처리한다.
- 공개·비공개 사진 모두 `display_order` 최댓값은 `10000`이다.
- Storage object는 manifest에 같은 bucket과 같은 path로 존재해야 하며 `byte_size`, `mime_type`, `checksum_sha256`, `signature_validated`가 필요하다.
- 모든 장소는 place manifest에 존재해야 한다.
- 공개 사진의 장소는 공개 직전 조건인 `status=ready`, `qa_status=ready`여야 한다. 기존 `photo_qa_status`는 `pending` 또는 `rejected`여도 된다.

### Storage 검증 계약

- `place-photos-public`: 1 byte 이상 10 MiB 이하, `image/jpeg`, `image/png`, `image/webp`
- `place-photo-originals`: 1 byte 이상 50 MiB 이하, 위 이미지 MIME 또는 `application/pdf`
- `checksum_sha256`: object 전체 byte의 64자리 SHA-256 hex
- `signature_validated`: manifest 생성기가 같은 object byte와 `mime_type`을 사용해 아래 signature를 직접 확인한 경우에만 JSON boolean `true`
  - JPEG: `FF D8 FF`
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - WebP: 0..3 byte가 `RIFF`, 8..11 byte가 `WEBP`
  - PDF: `%PDF-`

Storage 목록 API의 MIME metadata만 확인해서 `signature_validated=true`로 만들면 안 된다. Manifest 생성 중 object를 읽어 signature를 검사하고, 같은 byte에서 SHA-256을 계산해야 한다. 사전검사 계획은 이 크기·MIME·hash 값을 `object_validation`에 남겨 실제 반영 직전 동일 object인지 다시 확인할 수 있게 한다.

### Storage manifest 생성

아래 명령은 Supabase Storage를 읽기만 하며 DB 행이나 object를 변경하지 않는다. 각 object를 실제로 내려받아 signature, 실제 byte 크기, SHA-256을 계산한다. 결과 파일이 이미 있으면 덮어쓰지 않고 실패한다.

```bash
npm run manifest:place-photos -- \
  --bucket place-photos-public \
  --prefix <검사할 폴더> \
  --output ./outputs/place-photo-storage-manifest.json
```

`.env.local`의 `SUPABASE_URL` 또는 `NEXT_PUBLIC_SUPABASE_URL`과 서버 전용 `SUPABASE_SERVICE_ROLE_KEY`를 사용한다. service role key는 브라우저 코드, 문서, Git에 넣지 않는다. 공개 key는 보안 정책 적용 후 Storage 목록을 읽을 수 없으므로 이 운영 명령에 사용하지 않는다. object가 0개면 권한 또는 prefix 오류일 수 있어 실패하며, 스캔 중 목록이나 수정 시간이 달라져도 실패한다. Supabase의 `.emptyFolderPlaceholder`는 `ignored`에 기록하고 자동 제외한다. `rejected`가 한 건이라도 있으면 종료 코드 1을 반환하므로, `objects`만 보고 성공으로 오해하면 안 된다. Instagram 게시물 제작본이나 prototype asset처럼 실제 장소카드 원본이 아닌 폴더는 mapping 대상으로 사용하지 않는다.

### 반영 후 장소 동기화

공개 사진이 있는 장소마다 계획 끝에 `sync_place_photos` 작업을 하나 만든다. 모든 `map_place_photo` 작업을 반영한 뒤 관리자 업로드와 같은 방식으로 승인된 `cover`·`gallery`를 `display_order` 순서로 최대 5장 읽고 다음 값을 함께 갱신해야 한다.

- `cover_photo_id`: 첫 사진 ID
- `cover_image_url`: 첫 사진의 생성된 공개 URL
- `image_urls`: 순서대로 생성된 공개 URL 목록
- `photo_qa_status`: 사진이 있으면 `approved`, 없으면 `pending`

따라서 반영 전에 장소 사진 QA가 이미 `approved`일 필요가 없다. 공개 URL은 CSV에 넣지 않고 실제 반영 단계에서 `place-photos-public` bucket과 path로 생성한다.

## 실행

```bash
npm run preflight:place-photos -- \
  --mapping ./mapping.csv \
  --storage-manifest ./storage.json \
  --place-manifest ./places.json
```

성공하면 `valid: true`와 `summary`, `plan`을 출력한다. `plan`은 정렬된 `map_place_photo` 작업 뒤에 장소별 `sync_place_photos` 작업을 둔다. 입력이나 검증에 문제가 있으면 항상 `valid: false`, `summary`, `errors`, 빈 `plan`을 JSON으로 출력하고 종료 코드 1을 반환한다. 여러 manifest를 읽지 못해도 모든 오류를 field 순으로 한 번에 반환한다. 이 CLI에는 쓰기 모드가 없다.
