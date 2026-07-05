# Repository Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub/Vercel/Supabase guardrails so multiple sessions can work without corrupting `main`.

**Architecture:** Keep enforcement in repository-owned scripts and GitHub Actions. Branch protection requires PRs and CI checks; Vercel production should follow protected `main`.

**Tech Stack:** GitHub Actions, Node.js scripts, npm scripts, existing TypeScript/admin build.

---

### Task 1: Repository Guard

**Files:**
- Create: `scripts/guard-repository.mjs`
- Modify: `package.json`

- [ ] Add a Node script that validates allowed top-level paths, blocks deprecated folders, blocks local-only artifacts, and scans tracked text files for secret patterns.
- [ ] Add `guard:repo` script to `package.json`.
- [ ] Run `npm run guard:repo`.

### Task 2: Supabase Guard

**Files:**
- Create: `scripts/check-supabase-migrations.mjs`
- Modify: `package.json`

- [ ] Add a Node script that validates migration naming, duplicate timestamps, and obvious committed Supabase secrets.
- [ ] Add `check:supabase` script to `package.json`.
- [ ] Run `npm run check:supabase`.

### Task 3: GitHub CI

**Files:**
- Create: `.github/workflows/repository-guard.yml`
- Create: `.github/workflows/build.yml`

- [ ] Add repository guard workflow for PR and `main` push.
- [ ] Add build workflow for typecheck, admin build, and MVP app check.
- [ ] Run equivalent commands locally.

### Task 4: PR Template and Ops Notes

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `docs/ops/repository-workflow.md`

- [ ] Add PR template requiring area, verification, deployment impact, and follow-ups.
- [ ] Add concise workflow doc for multiple sessions.
- [ ] Confirm no placeholders remain.

### Task 5: Push and Require Checks

**Files:**
- No file changes.

- [ ] Commit implementation branch.
- [ ] Push `codex/governance-ci`.
- [ ] Create PR.
- [ ] Update branch protection required checks to `repository-guard` and `build`.
