# Doripe Web

## 핵심 구조

- `public/index.html`: `doripe.kr` homepage
- `public/admin`: `doripe.kr/admin`
- `public/app`: `doripe.kr/app`
- `public/blog.html`, `public/blog`: `doripe.kr/blog`
- `src/admin-ui`: admin React UI source
- `src/admin-routes/admin`: admin API handlers
- `src/admin-server`: auth, Supabase, schema, response adapter
- `api/admin`: Vercel admin API entry
- `api/share.ts`: shared place/route link API

## 로컬 검증

```bash
npm install
npm run build:admin
npm run typecheck
git diff --check
```

## GitHub Sync Rule

site/admin/app/blog 수정 후에는 검증, commit, push까지 완료합니다.

```bash
git status --short
git add .
git commit -m "..."
git push origin main
```

비밀값은 `.env.local`에만 둡니다.
