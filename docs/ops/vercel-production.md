# Vercel Production Rules

## Current Project

- Vercel project: `doripe`
- Project ID: `prj_X7eZo91o0Aw0HcodafbBKhPnEP2k`
- Team: `team_x4ATeutcmggg4kpLhjkZoJKA`
- Production domain: `doripe.kr`
- Output directory: `public`

## Required Rule

Production must be created from GitHub `main` after PR merge.

Do not use these commands for normal work:

```bash
vercel --prod
vercel deploy --prod
vercel alias set
vercel promote
```

Those commands bypass GitHub branch protection and CI.

## GitHub Connection Status

`vercel git connect https://github.com/doripe2026-del/Doripe` was attempted from CLI and failed with:

```text
Failed to connect doripe2026-del/Doripe to project.
```

This means the Vercel GitHub App is not currently authorized for the repo or the current Vercel account cannot connect that repo.

## One-Time Manual Action

Open Vercel Dashboard and connect:

1. Project: `doripe`
2. Settings
3. Git
4. Connect Git Repository
5. GitHub repo: `doripe2026-del/Doripe`
6. Production branch: `main`

After this is connected, every PR gets a preview deployment and every `main` merge creates production.

## Verification

Run:

```bash
npm run check:ops
```

Then confirm in Vercel Dashboard that the Git section shows:

- repository: `doripe2026-del/Doripe`
- production branch: `main`
