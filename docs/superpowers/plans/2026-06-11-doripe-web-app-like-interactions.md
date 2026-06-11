# Doripe Web App-Like Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `/app` MVP feel less like static slides and more like a mobile app, while keeping maps out of scope.

**Architecture:** Keep the current vanilla SPA structure. Add a small interaction layer around existing `commit()`/`render()` so screen changes use View Transitions when available, fallback CSS animations otherwise, and gesture logic remains isolated to the rendered card. Track app-use events at the same interaction boundaries.

**Tech Stack:** Static HTML/CSS/vanilla JS, Vercel rewrites, public admin API, Supabase-backed event ingestion.

---

### Task 1: Verification Coverage

**Files:**
- Modify: `startup-reference/doripe/scripts/check-mvp-app.mjs`

- [ ] **Step 1: Extend smoke checks**

Add checks for manifest registration, View Transition usage, pointer gesture usage, `discover_card_view`, `session_heartbeat`, `share_link_open`, and drag classes.

- [ ] **Step 2: Run verification**

Run: `cd startup-reference/doripe && npm run check:mvp-app`

Expected: fail until implementation is complete.

### Task 2: App Install Shell

**Files:**
- Modify: `startup-reference/doripe/public/app/index.html`
- Create: `startup-reference/doripe/public/app/manifest.webmanifest`
- Create: `startup-reference/doripe/public/app/sw.js`

- [ ] **Step 1: Add manifest and service worker registration**

Add the manifest link and minimal service worker registration so the page can behave like an installable mobile web app.

- [ ] **Step 2: Keep scope narrow**

The service worker only caches the app shell assets and lets API calls go to network.

### Task 3: Navigation and Metrics Layer

**Files:**
- Modify: `startup-reference/doripe/public/app/state.js`
- Modify: `startup-reference/doripe/public/app/main.js`

- [ ] **Step 1: Add transition-aware commit**

Wrap screen changes with `document.startViewTransition()` when supported. Store transition direction in root dataset for CSS fallback.

- [ ] **Step 2: Add exposure and dwell tracking**

Track `discover_card_view` when a card appears, `session_heartbeat` periodically, `share_link_open` when a shared link is loaded, and `error_shown` when an alert is displayed.

- [ ] **Step 3: Add animated card actions**

Delay save/skip state changes briefly so the current card can animate out instead of disappearing immediately.

### Task 4: Gesture Binding

**Files:**
- Modify: `startup-reference/doripe/public/app/render.js`
- Modify: `startup-reference/doripe/public/app/styles.css`

- [ ] **Step 1: Add card drag gesture**

Use Pointer Events on the active discover card. Horizontal drag moves the card with `transform`; release past threshold saves or skips; release below threshold springs back.

- [ ] **Step 2: Keep photo taps intact**

Suppress click only when a drag happened, so left/right photo tap zones still work.

### Task 5: Motion and App Feel

**Files:**
- Modify: `startup-reference/doripe/public/app/render.js`
- Modify: `startup-reference/doripe/public/app/styles.css`

- [ ] **Step 1: Add screen, sheet, image, tab, and popover motion**

Use `transform` and `opacity` only. Add reduced-motion handling.

- [ ] **Step 2: Improve mobile web shell**

Disable horizontal overflow, add touch action rules, preserve safe-area behavior, and keep bottom navigation steady.

### Task 6: Verify and Deploy

**Files:**
- Modify as needed based on verification.

- [ ] **Step 1: Run local checks**

Run: `cd startup-reference/doripe && npm run check:mvp-app && npm run typecheck`

- [ ] **Step 2: Verify live-like local preview**

Open `http://localhost:8083/app`, confirm region, tag setup, discover drag, photo tap, saved detail, route blocked, and sharing still work.

- [ ] **Step 3: Deploy**

Deploy to Vercel production and re-alias `doripe.kr` if needed.

---

## Self-Review

- Spec coverage: covers app-like web behavior, no-map MVP scope, interaction continuity, gestures, and measurement.
- Placeholder scan: no placeholders.
- Scope check: admin reporting is intentionally not in this plan; this plan focuses on the public web app interaction layer. Admin reporting should be a separate plan because it touches different UI/data contracts.
