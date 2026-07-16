# Place photo mapping preflight

기존 Storage object를 canonical 장소·제공자·사진 metadata와 연결하기 전에 로컬에서 CSV를 검사한다. 이 명령은 파일을 읽고 정렬된 JSON 계획만 출력하며 Supabase, Storage, Vercel, 로컬 파일을 변경하지 않는다.

## 준비

1. `place-photo-mapping.template.csv`를 복사해 mapping CSV를 작성한다.
2. `photo_id`, `place_id`, `provider_id`에는 새 canonical UUID를 넣는다. 기존 문자열 ID는 넣지 않는다.
3. 필요하면 Storage·장소·제공자 inventory를 example JSON 형식으로 준비한다.

허용 상태는 다음과 같다.

- `source_type`: `team`, `owner`, `creator`, `licensed`, `naver`
- `rights_status`: `pending`, `approved`, `rejected`
- `publish_status`: `draft`, `active`, `published`, `inactive`
- `photo_type`: `cover`, `gallery`, `original`, `rights`

`active`와 `published` 사진은 권리가 `approved`여야 하고 `cover` 또는 `gallery`만 가능하며, 장소당 합계는 최대 5장이다. 상태와 무관하게 cover는 장소당 최대 1장이고 `sort_position`은 장소 안에서 중복될 수 없다. `licensed` 공개 사진은 `license_note`도 필요하다.

## 실행

manifest 없이 검사:

```bash
npm run preflight:place-photos -- --mapping ./mapping.csv
```

로컬 inventory와 함께 검사:

```bash
npm run preflight:place-photos -- \
  --mapping ./mapping.csv \
  --storage-manifest ./storage.json \
  --place-manifest ./places.json \
  --provider-manifest ./providers.json
```

성공 시 `valid: true`와 결정적으로 정렬된 `summary`, `plan`이 출력된다. 오류가 있으면 `valid: false`, 빈 `plan`, 행별 `errors`를 출력하고 종료 코드 1을 반환한다. 패키지 명령에는 `--dry-run`이 고정되어 있으며 CLI에도 쓰기 모드는 없다.
