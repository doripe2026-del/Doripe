# Doripe Supabase 읽기 전용 백업

이 폴더는 `Doripe-app (dcyjrsxnpujslbxtitqj)`에 schema bridge를 적용하기 전 기준선을 보존한다. 캡처 과정에서는 원격 DB와 Storage를 수정하지 않았다.

## 포함 파일

| 파일 | 내용 |
| --- | --- |
| `dcyjrsxnpujslbxtitqj-schema.json` | public 테이블 컬럼, 제약조건, index, trigger |
| `dcyjrsxnpujslbxtitqj-security.json` | RLS 상태, policy, public 함수 정의 |
| `dcyjrsxnpujslbxtitqj-grants.json` | 앱 역할 `anon`, `authenticated`, `service_role`의 table·routine grant |
| `dcyjrsxnpujslbxtitqj-data.json` | 현재 행이 있는 기준 테이블의 실제 JSON 데이터 |
| `dcyjrsxnpujslbxtitqj-storage-inventory.json` | Storage bucket 설정과 176개 객체의 경로·크기·ETag |
| `dcyjrsxnpujslbxtitqj-storage-file-checksums.json` | 실제 다운로드한 174개 파일의 SHA-256과 검증 결과 |
| `dcyjrsxnpujslbxtitqj-remote-migrations.json` | 원격 migration 9개의 SQL 문장과 기록 |

정확한 전체 테이블 행 수와 요약 checksum은 상위의 `supabase-production-schema-snapshot-2026-07-18.json`에 있다.

## 별도 로컬 사본

Storage 실제 파일 사본은 Git에 넣지 않고 다음 위치에 저장한다.

`/Users/cityboy/Desktop/Doripe/Backups/2026-07-18-dcyjrsxnpujslbxtitqj-place-photos-public`

각 파일은 `_manifest.json`의 SHA-256과 비교할 수 있다. 이 사본은 Git 커밋이 아니라 로컬 재난 복구용이다.

같은 폴더의 `.tar.gz`와 `.tar.gz.sha256`은 이동·복사하기 쉬운 단일 압축 사본이다.

## 아직 남은 백업

- DB custom-format dump

원격 migration SQL과 앱 역할 grant는 확보했다. DB custom-format dump는 DB dump 자격증명을 확보한 뒤 추가한다. 이 항목과 staging 복원이 끝나기 전 production schema 변경은 금지한다.
