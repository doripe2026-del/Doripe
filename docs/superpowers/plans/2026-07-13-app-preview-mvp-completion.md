# Doripe App Preview MVP Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web MVP complete the Brain user journey from discovery through save, course creation, reuse, sharing, and settings, while remaining usable on common mobile screen sizes.

**Architecture:** Keep the existing semantic HTML screen renderers and central transition dispatcher. Introduce canonical saved-place and saved-route records in preview state, derive every list from those records, and make URL deep links restore the referenced content. Preserve Figma composition at the 393x852 reference size while replacing whole-frame mobile scaling with scrollable responsive layout and minimum touch targets.

**Tech Stack:** Vanilla ES modules, localStorage preview persistence, Playwright, Node test runner, existing CSS screen modules.

## Global Constraints

- Canonical repository and current `codex/figma-web-prototype-design` branch only; do not deploy.
- Preserve existing user changes and untracked assets.
- Figma remains the visual source of truth at 393x852.
- Brain user journey is `발견 -> 저장 -> 주변 장소 추가 -> 코스 구성 -> 길찾기 -> 저장/코스 재사용`.
- Bottom navigation destinations are `발견`, `저장`, `코스`, `MY`.
- Write a failing user-result test before each behavior change.
- Do not claim real network success for preview-only actions.

---

### Task 1: Canonical save and course state

**Files:**
- Modify: `public/app-preview/state.js`
- Modify: `public/app-preview/fixtures.js`
- Modify: `public/app-preview/transitions.js`
- Test: `tests/app-preview/state.test.mjs`
- Test: `tests/app-preview/transitions.test.mjs`

**Produces:** canonical `savedPlaceIds`, `savedRoutes`, `routeDraft`, and helpers that keep place and route IDs referentially valid.

- [ ] Add failing tests proving save/unsave is idempotent, a route contains its starting place, and a saved route survives reload.
- [ ] Run `node --test tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs` and verify the new assertions fail for missing behavior.
- [ ] Implement the minimum state normalization and transition changes.
- [ ] Re-run the focused tests and verify they pass.

### Task 2: Connect discovery, saved lists, and course creation

**Files:**
- Modify: `public/app-preview/screens/discover.js`
- Modify: `public/app-preview/screens/saved.js`
- Modify: `public/app-preview/screens/routes.js`
- Modify: `public/app-preview/transitions.js`
- Test: `tests/app-preview/discover.spec.mjs`
- Test: `tests/app-preview/saved.spec.mjs`
- Test: `tests/app-preview/routes.spec.mjs`

**Produces:** saving in B appears in C1 and D5, filtering changes visible records, D8 creates a route, and C2 reopens it.

- [ ] Add failing E2E tests for `B save -> C1`, `C3 filter -> changed list`, and `D4 -> D9 -> C2` user outcomes.
- [ ] Run the three focused Playwright files and verify the new tests fail for the expected missing data links.
- [ ] Render saved and route screens from canonical state instead of fixed lists.
- [ ] Re-run focused tests and verify all pass.

### Task 3: Route map, directions, and share restoration

**Files:**
- Modify: `public/app-preview/main.js`
- Modify: `public/app-preview/screens/saved.js`
- Modify: `public/app-preview/screens/routes.js`
- Modify: `public/app-preview/transitions.js`
- Test: `tests/app-preview/saved.spec.mjs`
- Test: `tests/app-preview/routes.spec.mjs`
- Test: `tests/app-preview/shell.spec.mjs`

**Produces:** visible C5-equivalent route map, external directions containing route stops, and place/route deep links that restore the referenced record.

- [ ] Add failing tests for visible route-map output and deep-link restoration by `type` and `id`.
- [ ] Verify the focused tests fail before implementation.
- [ ] Implement visible map-state rendering, destination-aware external URLs, and URL startup restoration.
- [ ] Verify native-share cancel does not report success and all focused tests pass.

### Task 4: Navigation, onboarding, settings, and honest preview states

**Files:**
- Modify: `public/app-preview/components.js`
- Modify: `public/app-preview/screens/onboarding.js`
- Modify: `public/app-preview/screens/settings.js`
- Modify: `public/app-preview/transitions.js`
- Test: `tests/app-preview/onboarding.spec.mjs`
- Test: `tests/app-preview/settings.spec.mjs`
- Test: `tests/app-preview/transitions.test.mjs`

**Produces:** reachable top-level destinations, onboarding data used by discovery, E2 reachable from E1, logout clears session state, and preview-only submissions do not falsely claim server completion.

- [ ] Add failing tests for all four top-level destinations, E1 -> E2, logout, and honest offline submission feedback.
- [ ] Verify failures, then implement shared navigation and corrected transitions.
- [ ] Re-run focused unit and E2E tests.

### Task 4B: Supabase email authentication boundary

**Files:**
- Create: `public/app-preview/auth-client.js`
- Create: `api/app-auth-config.ts`
- Modify: `public/app-preview/main.js`
- Modify: `public/app-preview/screens/onboarding.js`
- Modify: `public/app-preview/screens/settings.js`
- Test: `tests/app-preview/auth-client.test.mjs`
- Test: `tests/app-preview/onboarding.spec.mjs`
- Test: `tests/app-preview/settings.spec.mjs`

**Produces:** real email sign-in/sign-up/reset/sign-out when public Supabase configuration is available, with no password persisted by preview state and an explicit offline-preview result when configuration is absent.

- [ ] Add failing tests proving passwords never enter localStorage, authenticated requests use the configured Supabase boundary, and unavailable configuration never reports server success.
- [ ] Verify RED before implementing a small auth client with bounded inputs and normalized errors.
- [ ] Connect onboarding and MY actions to the auth boundary while preserving local visual review mode.
- [ ] Verify focused tests and security-sensitive logout/session behavior.

### Task 5: Responsive layout, typography, touch targets, and icon consistency

**Files:**
- Modify: `public/app-preview/styles/shell.css`
- Modify: `public/app-preview/styles/components.css`
- Modify: `public/app-preview/styles/discover.css`
- Modify: `public/app-preview/styles/saved.css`
- Modify: `public/app-preview/styles/routes.css`
- Modify: `public/app-preview/styles/settings.css`
- Modify: screen files only where text glyphs must become existing SVG icons
- Test: `tests/app-preview/responsive.spec.mjs`
- Test: `tests/app-preview/visual.spec.mjs`

**Produces:** no clipped primary CTA at 375x667, usable filter overflow, continuous B3 masonry content, 44px hit areas, readable body/supporting text, and one icon treatment.

- [ ] Add failing viewport assertions at 393x852, 375x667, and 360x800 for CTA visibility, horizontal overflow, and minimum hit regions.
- [ ] Add visual assertions for B3 content continuity and representative B/C/D/E screens.
- [ ] Replace whole-frame scaling with responsive scrolling and safe-area-aware fixed actions.
- [ ] Normalize typography and touch hit areas without changing the 393x852 Figma composition more than necessary.
- [ ] Replace text-symbol controls with the existing SVG icon set.
- [ ] Re-run responsive and visual tests.

### Task 6: Full journey verification and regression repair

**Files:**
- Modify: `tests/app-preview/user-journey.spec.mjs`
- Modify: affected production files only for failures found by the journey test

**Produces:** one automated journey from onboarding through discovery, save, course creation, route reopening, sharing, and logout plus regression coverage for empty/loading/error states.

- [ ] Write the full user-result journey test and verify it catches at least one pre-existing incomplete behavior before the final fixes.
- [ ] Implement only the missing behavior needed for the journey to pass.
- [ ] Run `npm run test:app-preview:unit`.
- [ ] Run `npm run test:app-preview:e2e`.
- [ ] Run `npm run check:app-preview` and `npm run typecheck`.
- [ ] Perform final code review and mobile screenshot inspection.
