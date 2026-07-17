# Supabase 웹 MVP 전환 영향 보고서

## 한 줄 결론

현재 운영 DB는 백업 기준과 정확히 일치하지만, 저장소 migration을 그대로 적용할 수는 없다. 이름이 같은 핵심 테이블의 ID 형식이 달라서 staging에서 별도 bridge migration을 먼저 검증해야 한다.

## 자동 확인 결과

- 대상 project: `Doripe-app (dcyjrsxnpujslbxtitqj)`
- 읽기 전용 baseline 검사: 통과
- 원격 migration 9개: 백업과 일치
- 핵심 빈 테이블: 모두 0행 유지
- Storage: 176개 객체, 실제 이미지 174개, 153,392,247바이트 보존
- Production migration 승인: 안 됨

실행 명령:

```bash
npm run check:supabase-bridge-baseline
```

## 그대로 적용하면 실패하는 핵심 차이

| 대상 | 현재 운영 DB | 현재 저장소 migration | 영향 |
| --- | --- | --- | --- |
| `neighborhoods.id` | `uuid` | `text` | 새 `places` FK와 타입이 맞지 않음 |
| `places.id` | `uuid` | `text` | 코스·콘텐츠·저장 FK 생성 실패 |
| `place_photos.place_id` | `uuid` | `text` | 사진 연결 migration 충돌 |
| `place_tags.place_id` | `uuid` | `text` | taxonomy migration 충돌 |
| `shared_links.id` | `uuid` | 공유 slug용 `text` | 현재 API의 `ds_...` ID 저장 불가 |
| `tags` | 11개 기준 데이터 | 새 구조는 `content_tags` | ID를 보존한 명시적 backfill 필요 |

## 가장 안전한 bridge 방식

1. `web_mvp_bridge_baseline.sql`을 staging 복원본에서 먼저 실행한다.
2. 기존 핵심 테이블은 삭제하지 않고 `legacy_*_20260718` 이름으로 보존한다.
3. 현재 코드가 요구하는 canonical 테이블을 새 이름이 아니라 원래 공개 이름으로 생성한다.
4. `neighborhoods` 3개와 `tags` 11개는 기존 UUID를 문자열 ID 또는 새 taxonomy UUID로 명시적으로 옮긴다.
5. 현재 0행인 장소·사진 연결·코스·공유 테이블은 자동 추정 없이 빈 canonical 구조로 시작한다.
6. RLS, grant, RPC, trigger를 적용한 뒤 runtime 계약 검사를 실행한다.
7. bridge를 두 번 실행해도 중복·손상이 없는지 staging에서 확인한다.
8. 전체 Backend/API/E2E 테스트와 행 수·Storage checksum 비교를 통과한 뒤에만 production 적용을 검토한다.

## 지금 하지 않은 일

- Production DB 변경
- migration history 강제 수정
- 기존 테이블 삭제
- Storage 객체 변경
- 유료 Supabase staging branch 생성

이 작업들은 staging 복원과 사용자 승인 전에는 진행하지 않는다.
