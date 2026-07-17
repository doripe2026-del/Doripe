# Supabase Advisor 기준선

- 확인일: 2026-07-18
- 대상: `Doripe-app (dcyjrsxnpujslbxtitqj)`
- 방식: Supabase Advisor 읽기 전용 조회
- 목적: schema 전환 전에 현재 보안·성능 경고를 기록하고, staging 검증 항목으로 고정한다.

## 결론

| 구분 | 수 | 지금 판단 |
| --- | ---: | --- |
| Security WARN | 1 | staging bridge에서 수정 후 검증한다. |
| Security INFO | 2 | legacy 알림 테이블의 용도를 먼저 확인하고 정책을 명시한다. |
| Performance INFO | 36 | 실제 사용 데이터가 쌓이기 전에는 삭제하지 않는다. |

Advisor 결과만으로 운영 DB의 index나 policy를 바로 삭제·수정하지 않는다.

## Security

### 공개 사진 버킷의 파일 목록 노출

- 대상: Storage bucket `place-photos-public`
- 수준: `WARN`
- 현재 상태: public object URL 제공에 필요하지 않은 광범위한 `storage.objects` SELECT policy가 있어 파일 목록을 조회할 수 있다.
- staging 조치: public object URL은 유지하되 목록 조회 policy를 제거하고, 앱의 이미지 표시와 직접 URL 접근이 계속 작동하는지 확인한다.
- 참고: [Supabase public bucket listing 안내](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing)

### RLS는 켜졌지만 policy가 없는 legacy 테이블

- 대상: `public.notify_taste_events`, `public.notify_taste_results`
- 수준: `INFO` 2건
- 현재 상태: RLS는 켜져 있고 policy가 없어 일반 클라이언트 접근은 막힌다.
- staging 조치: 웹 MVP에서 사용하지 않는다면 계속 비공개로 보존한다. 사용한다면 필요한 역할과 동작만 허용하는 policy를 별도 migration으로 명시한다.
- 참고: [Supabase RLS policy 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Performance

36건 모두 `unused_index` INFO다. 현재 핵심 사용자·장소 데이터가 비어 있어 "사용되지 않는다"는 관찰 기간이 충분하지 않다.

| 테이블 | 미사용 index 수 |
| --- | ---: |
| `app_events` | 6 |
| `app_sessions` | 2 |
| `onboarding_answers` | 3 |
| `place_actions` | 2 |
| `place_photos` | 2 |
| `places` | 2 |
| `route_places` | 2 |
| `shared_links` | 3 |
| `routes` | 1 |
| `place_tags` | 1 |
| `discovery_runs` | 3 |
| `discovery_run_tags` | 1 |
| `discovery_run_places` | 1 |
| `notify_taste_results` | 3 |
| `notify_taste_events` | 3 |
| `screen_review_tasks` | 1 |

참고: [Supabase unused index 안내](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

## 재검사 시점

1. staging bridge 적용 직후
2. RLS·Storage policy 적용 직후
3. 실제 베타 데이터와 사용자 여정 검수 후
4. production 적용 전

완료 기준은 Security WARN 0건이다. Performance INFO는 실제 쿼리 사용량을 확인한 뒤 별도 최적화 작업에서 판단한다.
