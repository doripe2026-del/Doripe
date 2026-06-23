# Doripe Web

This repository tracks only the code used for the Doripe web properties.

- `doripe.kr`
- `doripe.kr/admin`
- `doripe.kr/app`
- `doripe.kr/blog`

## Structure

- `public/home`: `doripe.kr`, `/business`, `/company`, `/notify`, `/privacy`, `/terms`
- `public/admin`: `doripe.kr/admin`
- `public/app`: `doripe.kr/app`
- `public/blog`: `doripe.kr/blog`
- `api`: Vercel API routes
- `src/admin-ui`: admin React source
- `src/admin-routes`: admin API handlers
- `src/admin-server`: admin server helpers
- `supabase`: migrations and Edge Functions

## Commands

```bash
npm install
npm run typecheck
npm run check:mvp-app
git diff --check
```

Use `npm run build:admin` only when intentionally rebuilding the committed admin bundle.

## Out of Scope

- legacy mobile app prototypes
- local strategy documents
- Figma exports and design scratch files
- deprecated `doripe-admin` standalone deployment
