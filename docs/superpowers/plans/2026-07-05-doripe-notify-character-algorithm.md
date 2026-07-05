# Doripe Notify Character Algorithm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder B-count notify result with a 10-round, 6-character viral taste algorithm.

**Architecture:** Keep `/notify` static-first. The browser owns round metadata and preview rendering, while the API owns final scoring so stored results and shared links are authoritative. Store a legacy-compatible `character_key` if the production DB still has the old 2-key check constraint, and recover the real 6-character result from `character_name`.

**Tech Stack:** TypeScript Vercel functions, Supabase REST client, static HTML/CSS/JS.

---

### Task 1: Server Character Scoring

**Files:**
- Modify: `startup-reference/doripe/lib/notify-taste.ts`
- Modify: `startup-reference/doripe/lib/schema.ts`

- [ ] Add 6 notify characters with names, descriptions, tags, image paths, representative axes, and legacy storage keys.
- [ ] Add 10 round scoring metadata using only `A`/`B` choices.
- [ ] Replace `computeCharacter` with character score + axis tie-break logic.
- [ ] Keep payload validation compatible with 10 `A`/`B` choices.

### Task 2: Notify UI Round Data

**Files:**
- Modify: `startup-reference/doripe/public/notify.html`

- [ ] Add browser-side character metadata and 10 round definitions.
- [ ] Render each round with different labels, alt text, and subtle generated image data URIs.
- [ ] Render thumbnail row from the actual selected round option.
- [ ] Render result and match character images for all 6 characters.

### Task 3: Database Compatibility Migration

**Files:**
- Create: `supabase/migrations/20260705090000_notify_taste_six_characters.sql`

- [ ] Add migration that expands `notify_taste_results_character_key_valid` to all 6 new keys plus the 2 legacy keys.
- [ ] Do not require the migration for local UI verification because the runtime stores legacy-compatible keys until the migration is applied.

### Task 4: Verification

**Files:**
- Test through existing scripts.

- [ ] Run `npm run typecheck` in `startup-reference/doripe`.
- [ ] Reload local `http://127.0.0.1:4176/notify.html`.
- [ ] Click through 10 choices and confirm result changes based on choice pattern.
