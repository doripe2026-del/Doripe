# App Preview API Integration Plan

> **Goal:** Replace the normal app-preview fixture runtime with the Doripe `/api/v1` backend, establish a reproducible Supabase schema and seed path, and update the Doripe Brain with verified implementation status.

## Ground Rules

- `?static=1` remains a deterministic visual-review mode backed by fixture data.
- Normal `/app-preview/` uses `/api/v1`; it never silently falls back to fixture data.
- API responses are transformed at one repository boundary instead of leaking backend field shapes into screen renderers.
- Writes are optimistic in the UI, persisted through the repository, and rolled back with a visible error when the API fails.
- Supabase changes are migration-backed and checked for RLS, foreign keys, uniqueness, and orphan rows.
- Brain documents describe verified status only after code, migration, and tests agree.

## Task 1: Consolidate Backend v1

1. Bring the existing, locally tested `/api/v1` route and backend domain modules into this canonical branch.
2. Bring the OpenAPI contract, backend tests, database tests, and inventory tooling with them.
3. Add only the required package scripts and dependency.
4. Run backend contract and Node tests before changing the preview.

## Task 2: Add the App API Repository

1. Add a fetch client for the standard `{ data, meta }` and `{ error }` envelopes.
2. Add API-to-preview mappers for profiles, places, media, tags, comments, courses, and contents.
3. Implement bootstrap hydration from `/bootstrap`, `/feed`, and the required detail endpoints.
4. Cache the last successful API snapshot for temporary network failures.
5. Keep fixture mode only for `?static=1` and tests.

## Task 3: Connect Reads and Writes

1. Select API mode for normal preview and fixture mode for static review.
2. Connect feed, place detail, course detail, profiles, saves, and comments.
3. Connect save, follow, like, comment, and course mutations through shared repository methods.
4. Add loading, empty, retry, and API-error states without replacing the Figma-aligned layout.

## Task 4: Reconcile Supabase

1. Capture the current remote schema and migration history as read-only evidence.
2. Create a forward-only bridge migration instead of applying conflicting historical migrations blindly.
3. Create the API-required tables, constraints, indexes, RLS policies, buckets, and RPCs in dependency order.
4. Seed the minimum verified beta catalog through migration/seed tooling, not browser fixture code.
5. Run integrity queries, database tests, and Supabase security/performance advisors.

## Task 5: Verify the Product Path

1. Run backend, repository, unit, and Playwright user-journey tests.
2. Verify normal mode reads API data and static mode remains deterministic.
3. Check mobile viewports, loading, cached-offline recovery, and mutation rollback.
4. Keep the local preview server running for review.

## Task 6: Update Doripe Brain

Update only the related implementation documents:

- `03. 데이터 연결.md`
- `05. 백엔드 구현 상태.md`
- `04. 기존 데이터와 전환 상태.md`
- `02. 공개·앱 API.md` only when the verified contract changes

Each update must distinguish local implementation, remote Supabase state, and production deployment.
