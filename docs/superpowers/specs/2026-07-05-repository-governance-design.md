# Repository Governance Design

## Goal

Multiple Codex sessions must not be able to accidentally break `doripe.kr`, `doripe.kr/admin`, `doripe.kr/app`, or Supabase schema work by pushing directly to `main` or by adding random project structures.

## Design

GitHub is the source of truth. `main` is protected and every change must pass through a pull request. Vercel production should follow `main`; local production deploys are not part of the normal workflow.

The repository gets lightweight enforcement:

- A repository guard script blocks unexpected top-level folders, deprecated standalone apps, local exports, secrets, and `.vercel`/`.env` files.
- A Supabase guard script checks migration filename order, duplicate timestamps, and forbidden committed secrets.
- GitHub Actions run guard checks, typecheck, admin build, and MVP app checks on every PR and `main` push.
- A pull request template forces each session to record changed area, verification, deployment impact, and follow-ups.

## Scope

This does not reorganize the app code. It adds enforcement around the existing structure:

- `public/**`
- `api/**`
- `src/**`
- `scripts/**`
- `supabase/**`
- `docs/**`

## Success Criteria

- `main` cannot be updated directly.
- PRs must pass repository guard and build checks before merge.
- New random top-level directories fail CI.
- Supabase changes are visible as migration files.
- Every PR records what changed and how it was verified.
