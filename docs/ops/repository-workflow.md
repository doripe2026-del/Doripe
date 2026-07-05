# Doripe Repository Workflow

## 원칙

- GitHub `main`이 기준이다.
- `main`은 직접 수정하지 않는다.
- 모든 세션은 별도 브랜치에서 작업하고 PR로 합친다.
- Vercel production은 `main` 기준으로만 반영한다.
- Supabase schema 변경은 migration 파일로만 남긴다.

## 세션별 작업 방식

1. 작업 시작 전에 최신 `main`에서 브랜치를 만든다.
2. 변경 범위는 한 사이트 또는 한 기능으로 제한한다.
3. 새 top-level 폴더를 만들지 않는다.
4. PR 본문에 변경 영역, 검증, 배포 영향, 후속 작업을 적는다.
5. CI가 통과한 PR만 merge한다.

## 허용 구조

- `public/home`: 홈페이지, notify, 회사/약관 페이지
- `public/admin`, `src/admin-*`, `api/admin`: 관리자 페이지
- `public/app`: 앱 웹 버전
- `public/blog`: 블로그
- `api`: Vercel API
- `supabase`: migrations/functions/seed
- `docs`: 제품/운영 문서

## 금지

- `doripe-admin`, `doripe-app`, `fusion-starter-*` 같은 과거 실험 폴더 재추가
- `.env`, `.vercel`, `node_modules`, 로컬 임시 산출물 commit
- 로컬에서 임의 production alias 변경
- Supabase dashboard에서 한 schema 변경을 migration 없이 끝내기
