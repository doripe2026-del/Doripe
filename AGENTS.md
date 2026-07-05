# Repository Rules

- Keep this repository scoped to Doripe web code only: homepage, admin, app, blog, and required backend/Supabase code.
- Do not re-add legacy mobile prototypes, local planning documents, Figma scratch exports, or the old standalone `doripe-admin` app.
- Static files are organized by site under `public/home`, `public/admin`, `public/app`, and `public/blog`.
- `doripe.kr/admin` is served from `public/admin` and `src/admin-*`.
- Keep `vercel.json` free of rewrites to the deprecated `doripe-admin.vercel.app`.
- Never commit `.env`, `.env.*`, `.vercel`, `node_modules`, or local-only generated files.

# Session Rules

- Do not work directly on `main`; use a `codex/*` branch.
- Do not run `vercel --prod`, `vercel deploy --prod`, `vercel alias set`, or `vercel promote` for normal work.
- Production changes go through GitHub PR, required checks, and `main`.
- Supabase schema changes must be committed as migration files under `supabase/migrations`.
- Before PR, run the relevant checks from `docs/ops/session-rules.md`.
