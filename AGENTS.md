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

# Doripe Brain Rules

- Before starting any Doripe task, read `/Users/cityboy/Desktop/Doripe/Brain/Doripe Docs/00 Home/Doripe 브레인.md` and then read the Brain documents relevant to the task.
- Treat Doripe Brain as the source of truth for current product, user, curator, content, business, marketing, IR, and team decisions. Treat this repository as the source of truth for the implemented code.
- If the code and Brain conflict, do not silently choose one. Follow the user's latest explicit direction and report the mismatch.
- Do not edit Doripe Brain automatically because code, design, strategy, metrics, or plans changed.
- When a task creates a Brain mismatch, explain which Brain files should change and request the user's approval before editing them.
- A direct user request to edit Doripe Brain counts as approval only for the requested scope. Do not expand the update to unrelated Brain documents without additional approval.
