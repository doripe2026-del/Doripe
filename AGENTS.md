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
- Run `npm run setup:guards` once after cloning or creating a worktree. It installs Git hooks and a local deployment shell guard.
- The deployment shell guard blocks direct production Vercel commands in Doripe contexts and forces the GitHub PR → checks → main merge → Vercel Git integration path.

# Doripe Slash Commands

## `/인스타공장`

When a user message starts with `/인스타공장`, treat it as the Instagram feed factory trigger.

Syntax:

```text
/인스타공장 <absolute-post-folder>
/인스타공장 --all <absolute-factory-folder>
```

Rules:

- Follow `docs/superpowers/specs/2026-07-06-instagram-factory-command-design.md`.
- One post folder contains `input.xlsx` and numeric images such as `1.jpg`, `2.jpg`, `3.png`.
- Do not generate captions, hashtags, or upload to Instagram.
- Use the Figma pages `Source` and `Instagram`.
- Never mutate `Source`; copy from `Source` into `Instagram`, then replace `title` and `photo_1` through `photo_10`.
- If Figma access, the template page, or required layers are missing, stop and report the exact missing requirement.
