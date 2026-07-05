# Codex Session Rules

## Required Workflow

1. Start from latest `main`.
2. Create a task branch with prefix `codex/`.
3. Keep the task scoped to one area:
   - homepage / notify / blog
   - admin
   - app
   - api / backend
   - Supabase
   - docs / ops
4. Run verification commands before PR.
5. Open PR.
6. Merge only after required checks pass.

## Forbidden

- Working directly on `main`
- Local production deploys
- Adding new top-level folders without updating the repository guard
- Adding old scratch folders such as `doripe-app`, `doripe-admin`, `fusion-starter-*`
- Committing `.env`, `.vercel`, `node_modules`, exports, zips, or local screenshots

## Standard Verification

```bash
npm run guard:repo
npm run check:supabase
npm run typecheck
npm run build:admin
npm run check:mvp-app
```

## Production Verification

```bash
npm run check:ops
```
