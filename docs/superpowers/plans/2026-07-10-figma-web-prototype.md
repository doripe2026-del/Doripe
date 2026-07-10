# Doripe Figma Web Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figma `Doripe UI`의 node `446:33`에 있는 최종 A~E 화면을 수치 그대로 재현하고, 모든 화면과 보이는 동작을 검수할 수 있는 독립 웹 프로토타입을 만든다.

**Architecture:** 기존 `public/app`의 UI와 6,427줄 CSS는 수정하지 않고 `public/app-preview`를 독립 바닐라 JavaScript 앱으로 만든다. 화면 registry, transition registry, 결정적 fixture, 로컬 상태를 분리해 실제 앱 흐름과 데스크톱 검수판이 같은 화면 구현을 공유하게 한다. Figma Dev Mode 측정값과 reference screenshot을 화면별로 보관하고 Playwright screenshot 비교로 픽셀 차이를 관리한다.

**Tech Stack:** HTML5, CSS, vanilla ES modules, Node.js `node:test`, Playwright, localStorage, existing Pretendard font and approved image assets.

## Global Constraints

- 유일한 디자인 기준은 `https://www.figma.com/design/TfZAtv9JUy508otim4P23w/Doripe-UI?node-id=446-33`이다.
- 제품 범위와 Figma 디자인을 임의로 개선하거나 재디자인하지 않는다.
- 모든 위치, 크기, 색상, 폰트, 행간, 모서리, 그림자와 자산은 Figma node에서 직접 읽는다. 눈대중 값은 금지한다.
- 기준 화면 크기는 `393×852`이며 요소 위치와 크기 허용 차이는 최대 `1px`이다.
- 동적 사진·영상·지도 mask를 제외한 전체 screenshot 차이는 `2%` 이하여야 한다.
- 모바일 검증 viewport는 `393×852`, `375×667`, `430×932`다.
- 데스크톱 문서 전체는 스크롤되지 않는다. 오른쪽 검수 목록만 스크롤된다.
- 모바일에서는 검수 목록을 숨기고 앱 화면만 기기 너비 전체로 표시한다.
- 모든 visible action은 transition 또는 state action을 가져야 한다. 무반응 action은 테스트 실패다.
- 1차는 fixture adapter를 사용한다. 실제 Supabase, 인증, 지도와 길찾기 API는 화면 승인 뒤 별도 작업으로 연결한다.
- 기존 `public/app`은 교체하거나 UI 기준으로 재사용하지 않는다.
- production 직접 배포는 금지한다. PR, required checks, `main` merge, Vercel Git integration 순서를 따른다.
- 모든 작업은 `codex/*` 브랜치에서 수행하고 Supabase 변경은 migration 파일로 남긴다.

---

## File Map

```text
public/app-preview/
  index.html                         # desktop review shell + mobile app entry
  main.js                            # boot, URL routing, delegated events
  screen-registry.js                 # every A~E screen definition
  transitions.js                    # every visible action contract
  state.js                          # deterministic local state + persistence
  fixtures.js                       # places, media, users, tags, comments, routes
  api-adapter.js                    # fixture/API boundary
  components.js                     # only repeated, measurement-identical UI
  screens/
    onboarding.js                   # Flow A renderers
    discover.js                     # Flow B renderers
    saved.js                        # Flow C renderers
    route.js                        # Flow D renderers
    profile-settings.js             # Flow E renderers
  styles/
    tokens.css                      # Figma colors, type, radii, shadows
    shell.css                       # review board and 393×852 phone
    components.css                  # shared exact components
    onboarding.css
    discover.css
    saved.css
    route.css
    profile-settings.css
  figma/
    screen-inventory.json           # screen ID/name/node/group/reference
    screen-measurements.json        # node-derived geometry and typography
    visual-masks.json               # dynamic media/map diff masks
  assets/
    fonts/PretendardVariable.woff2
    icons/
    images/
    references/                     # Figma PNG per screen
tests/app-preview/
  registry.test.mjs
  state.test.mjs
  transitions.test.mjs
  fixtures.test.mjs
  shell.spec.mjs
  onboarding.spec.mjs
  discover.spec.mjs
  saved.spec.mjs
  route.spec.mjs
  profile-settings.spec.mjs
  visual.spec.mjs
scripts/
  check-app-preview.mjs
  serve-app-preview.mjs
playwright.app-preview.config.mjs
```

---

### Task 1: Preview Test Harness and Isolated Route

**Files:**
- Modify: `package.json`
- Modify: `vercel.json`
- Create: `playwright.app-preview.config.mjs`
- Create: `scripts/serve-app-preview.mjs`
- Create: `scripts/check-app-preview.mjs`
- Create: `public/app-preview/index.html`
- Create: `tests/app-preview/shell.spec.mjs`

**Interfaces:**
- Produces: `http://127.0.0.1:4173/app-preview/`
- Produces: npm scripts `dev:app-preview`, `test:app-preview:unit`, `test:app-preview:e2e`, `test:app-preview`, `test:app-preview:update`
- Produces: DOM roots `#phone-root`, `#review-list`, `#review-reset`

- [ ] **Step 1: Add Playwright and the preview test scripts**

Run:

```bash
npm install --save-dev @playwright/test@^1.53.0
```

Add these scripts to `package.json`:

```json
{
  "dev:app-preview": "node scripts/serve-app-preview.mjs",
  "test:app-preview:unit": "node --test tests/app-preview/*.test.mjs",
  "test:app-preview:e2e": "playwright test -c playwright.app-preview.config.mjs",
  "test:app-preview:update": "playwright test -c playwright.app-preview.config.mjs --update-snapshots",
  "test:app-preview": "npm run test:app-preview:unit && npm run test:app-preview:e2e",
  "check:app-preview": "node scripts/check-app-preview.mjs"
}
```

- [ ] **Step 2: Write the failing shell test**

Create `tests/app-preview/shell.spec.mjs`:

```js
import { expect, test } from "@playwright/test";

test("desktop shell keeps page fixed and review list scrollable", async ({ page }) => {
  await page.goto("/app-preview/");
  await expect(page.locator("#phone-root")).toHaveCSS("width", "393px");
  await expect(page.locator("#phone-root")).toHaveCSS("height", "852px");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(page.locator("#review-list")).toHaveCSS("overflow-y", "auto");
});

test("mobile hides review controls", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/app-preview/");
  await expect(page.locator("#review-panel")).toBeHidden();
  await expect(page.locator("#phone-root")).toHaveCSS("width", "393px");
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
npx playwright install chromium
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/shell.spec.mjs
```

Expected: FAIL because the config, server and preview DOM do not exist.

- [ ] **Step 4: Add the static server, Playwright config and minimum shell**

Create `scripts/serve-app-preview.mjs` using `node:http`. It must map `/app-preview/` to `public/app-preview/index.html`, return the correct content type for `.html`, `.js`, `.css`, `.json`, `.svg`, `.png`, `.jpg`, `.woff2`, reject `..`, and listen on `process.env.PORT || 4173`.

Create `playwright.app-preview.config.mjs`:

```js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/app-preview",
  testMatch: ["**/*.spec.mjs"],
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  use: { baseURL: "http://127.0.0.1:4173", locale: "ko-KR", timezoneId: "Asia/Seoul" },
  webServer: {
    command: "node scripts/serve-app-preview.mjs",
    url: "http://127.0.0.1:4173/app-preview/",
    reuseExistingServer: true
  }
});
```

Create `public/app-preview/index.html` with a fixed `.review-shell`, a `393×852` `#phone-root`, a scrollable `#review-list`, and `#review-reset`. Load `/app-preview/main.js` as a module. The minimum mobile media query is:

```css
@media (max-width: 700px) {
  #review-panel { display: none; }
  #phone-root { width: 100vw; height: 100dvh; border-radius: 0; }
}
```

Add this rewrite before `/app` rewrites in `vercel.json`:

```json
{ "source": "/app-preview", "destination": "/app-preview/index.html" }
```

- [ ] **Step 5: Add the repository check and run all checks**

`scripts/check-app-preview.mjs` must assert the required file map exists, parse both JSON registries when added, and run `node --check` on every preview `.js` file. Until the registries are added, only assert the Task 1 files.

Run:

```bash
npm run check:app-preview
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/shell.spec.mjs
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vercel.json playwright.app-preview.config.mjs scripts/serve-app-preview.mjs scripts/check-app-preview.mjs public/app-preview/index.html tests/app-preview/shell.spec.mjs
git commit -m "test: add isolated app preview harness"
```

---

### Task 2: Figma Screen Inventory, Measurements and References

**Files:**
- Create: `public/app-preview/figma/screen-inventory.json`
- Create: `public/app-preview/figma/screen-measurements.json`
- Create: `public/app-preview/figma/visual-masks.json`
- Create: `public/app-preview/assets/references/*.png`
- Create: `tests/app-preview/figma-evidence.test.mjs`
- Modify: `scripts/check-app-preview.mjs`

**Interfaces:**
- Consumes: Figma file key `TfZAtv9JUy508otim4P23w`, root node `446:33`
- Produces: `ScreenEvidence = { id, name, group, nodeId, width, height, reference, masks }`
- Produces: exact inventory used by every later renderer and test

- [ ] **Step 1: Write the failing evidence test**

Create `tests/app-preview/figma-evidence.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };

test("every final screen has complete Figma evidence", () => {
  assert.ok(inventory.length >= 50);
  assert.equal(new Set(inventory.map((item) => item.id)).size, inventory.length);
  for (const screen of inventory) {
    assert.match(screen.id, /^[a-e]\d+[a-z0-9-]*$/);
    assert.match(screen.nodeId, /^\d+:\d+$/);
    assert.ok(["A", "B", "C", "D", "E"].includes(screen.group));
    assert.equal(measurements[screen.id].frame.width, 393);
    assert.equal(measurements[screen.id].frame.height, 852);
    assert.equal(screen.reference, `/app-preview/assets/references/${screen.id}.png`);
    assert.ok(Array.isArray(masks[screen.id] ?? []));
  }
});
```

- [ ] **Step 2: Run the evidence test and verify it fails**

Run:

```bash
node --test tests/app-preview/figma-evidence.test.mjs
```

Expected: FAIL because the three JSON files do not exist.

- [ ] **Step 3: Build the inventory from Figma, not from visual guesses**

Use Figma `get_metadata` on node `446:33`. Include only visible final frames inside the five sections named `Flow / A Onboarding`, `Flow / B ...`, `Flow / C ...`, `Flow / D ...`, and `Flow / E ...`. Exclude row labels, notes, hidden frames, image references and obsolete duplicate frames. Preserve the Figma frame name and node ID exactly.

For every retained frame, use `get_design_context` and `get_screenshot`. Download the screenshot as `public/app-preview/assets/references/<screen-id>.png`. Record these required measurement keys:

```json
{
  "a1": {
    "nodeId": "446:34",
    "frame": { "width": 393, "height": 852 },
    "elements": {
      "action/start": { "x": 36, "y": 735, "width": 321, "height": 50 }
    },
    "typography": {},
    "colors": {},
    "radii": {},
    "shadows": {},
    "assets": []
  }
}
```

The `a1` values above are already confirmed from Figma metadata. Other screens must use their own Figma results rather than copying `a1`.

- [ ] **Step 4: Mark only genuinely dynamic areas as masks**

`visual-masks.json` entries use `{ "x", "y", "width", "height", "reason" }`. Allowed reasons are `photo`, `video`, `map`, and `user-generated-text`. Buttons, typography, sheet geometry, cards and fixed icons are never masked.

Run:

```bash
node --test tests/app-preview/figma-evidence.test.mjs
npm run check:app-preview
```

Expected: PASS and at least 50 final screen records.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/figma public/app-preview/assets/references tests/app-preview/figma-evidence.test.mjs scripts/check-app-preview.mjs
git commit -m "chore: capture Figma screen evidence"
```

---

### Task 3: Screen Registry and Review Board

**Files:**
- Create: `public/app-preview/screen-registry.js`
- Create: `public/app-preview/state.js`
- Create: `public/app-preview/main.js`
- Create: `public/app-preview/styles/shell.css`
- Create: `tests/app-preview/registry.test.mjs`
- Create: `tests/app-preview/state.test.mjs`
- Modify: `public/app-preview/index.html`
- Modify: `tests/app-preview/shell.spec.mjs`

**Interfaces:**
- Produces: `getScreen(id: string): ScreenDefinition | null`
- Produces: `listScreens(group?: "A"|"B"|"C"|"D"|"E"): ScreenDefinition[]`
- Produces: `navigate(screenId: string, options?: { replace?: boolean }): void`
- Produces: `setReviewStatus(screenId: string, status: "unreviewed"|"complete"): void`
- Produces: URL contract `?screen=<id>`

- [ ] **Step 1: Write failing registry and persistence tests**

The registry test imports `screen-inventory.json` and asserts every inventory item has exactly one renderer, valid group, unique ID, Figma node, reference, and actions array. The state test injects a memory storage adapter and verifies current screen, navigation history, review state and reset survive a reload.

Required state shape:

```js
export const DEFAULT_STATE = Object.freeze({
  currentScreenId: "a1",
  history: [],
  reviewStatus: {},
  form: {},
  selections: {},
  savedPlaceIds: [],
  likedMediaIds: [],
  followedUserIds: [],
  routePlaceIds: [],
  overlays: [],
  toast: null
});
```

- [ ] **Step 2: Run the unit tests and verify they fail**

Run:

```bash
node --test tests/app-preview/registry.test.mjs tests/app-preview/state.test.mjs
```

Expected: FAIL because registry and state modules do not exist.

- [ ] **Step 3: Implement the registry, state and review board**

Each registry entry must have this exact shape:

```js
{
  id: "a1",
  name: "A1 / 시작",
  group: "A",
  figmaNodeId: "446:34",
  reference: "/app-preview/assets/references/a1.png",
  render: renderA1,
  actions: ["start", "login"]
}
```

`main.js` reads `?screen`, renders the selected screen into `#phone-root`, builds grouped A~E review buttons, changes the URL with `history.pushState`, responds to `popstate`, and allows the user alone to toggle `미검토/완료`. `완료` is never set automatically.

An unknown `?screen` value renders a review-only error panel containing the invalid ID and a `첫 화면으로 돌아가기` action. It must not silently replace the ID with `a1`.

The reset button restores `DEFAULT_STATE`, clears the preview storage key `doripe_app_preview_v1`, returns to `a1`, and re-renders.

- [ ] **Step 4: Run unit and shell tests**

Run:

```bash
node --test tests/app-preview/registry.test.mjs tests/app-preview/state.test.mjs
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/shell.spec.mjs
```

Expected: PASS; desktop list scrolls without moving the page, mobile list is hidden, and direct `?screen=a1` entry works.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/index.html public/app-preview/main.js public/app-preview/screen-registry.js public/app-preview/state.js public/app-preview/styles/shell.css tests/app-preview/registry.test.mjs tests/app-preview/state.test.mjs tests/app-preview/shell.spec.mjs
git commit -m "feat: add preview registry and review board"
```

---

### Task 4: Transition Contract, Fixtures and API Boundary

**Files:**
- Create: `public/app-preview/transitions.js`
- Create: `public/app-preview/fixtures.js`
- Create: `public/app-preview/api-adapter.js`
- Create: `tests/app-preview/transitions.test.mjs`
- Create: `tests/app-preview/fixtures.test.mjs`
- Modify: `public/app-preview/main.js`

**Interfaces:**
- Produces: `dispatchAction(screenId: string, actionId: string, payload?: unknown): ActionResult`
- Produces: `ActionResult = { state: PreviewState, nextScreenId?: string, effect?: "share"|"copy"|"none" }`
- Produces: `createFixtureAdapter(): { getPlaces, getUsers, getTags, getRoutes, savePlace, followUser }`
- Produces: `createFailingFixtureAdapter(): FixtureAdapter`
- Produces: `getAdapter(mode = "fixture")`

- [ ] **Step 1: Write failing transition coverage tests**

`tests/app-preview/transitions.test.mjs` must flatten every `screen.actions` entry and assert `TRANSITIONS[screen.id][actionId]` is a function. It must also assert every returned `nextScreenId` exists in the screen registry.

Add explicit tests for:

```js
assert.equal(dispatchAction("b1", "save-place", { placeId: "place-1" }).state.savedPlaceIds[0], "place-1");
assert.equal(dispatchAction("e1", "toggle-follow", { userId: "user-1" }).state.followedUserIds[0], "user-1");
assert.equal(dispatchAction("b4", "open-share", { type: "place", id: "place-1" }).effect, "share");
assert.equal(dispatchAction("b1", "unknown-action").state.toast.kind, "error");
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test tests/app-preview/transitions.test.mjs tests/app-preview/fixtures.test.mjs
```

Expected: FAIL because transition and fixture modules do not exist.

- [ ] **Step 3: Implement deterministic fixtures and action dispatch**

Fixtures must contain at least 12 places, 30 media items, 6 users, all visible Figma tags, 6 comments and 3 routes. IDs are stable strings. Every place references existing media/user/tag IDs; every route references existing place IDs. The fixture test rejects orphan references and duplicate IDs.

`api-adapter.js` defaults to fixture mode and exposes a deterministic failure mode for visual error-state tests:

```js
export function getAdapter(mode = "fixture") {
  if (mode === "fixture-error") return createFailingFixtureAdapter();
  if (mode !== "fixture") throw new Error(`Unsupported preview adapter: ${mode}`);
  return createFixtureAdapter();
}
```

`dispatchAction` looks up `TRANSITIONS[screenId][actionId]` and updates state immutably. Share actions call `navigator.share` only in a DOM effect handler; unsupported or rejected sharing copies the canonical preview URL and sets a Figma-style toast.

- [ ] **Step 4: Connect delegated events**

All interactive markup uses `data-action` and optional `data-id`. `main.js` owns one click handler, one input handler, keyboard Escape handling, and pointer gesture listeners. Renderers do not attach global listeners.

Run:

```bash
node --test tests/app-preview/transitions.test.mjs tests/app-preview/fixtures.test.mjs
npm run check:app-preview
```

Expected: PASS and zero registry actions without handlers.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/transitions.js public/app-preview/fixtures.js public/app-preview/api-adapter.js public/app-preview/main.js tests/app-preview/transitions.test.mjs tests/app-preview/fixtures.test.mjs
git commit -m "feat: add preview state transitions and fixtures"
```

---

### Task 5: Exact Shared Components and Design Tokens

**Files:**
- Create: `public/app-preview/components.js`
- Create: `public/app-preview/styles/tokens.css`
- Create: `public/app-preview/styles/components.css`
- Create: `public/app-preview/assets/fonts/PretendardVariable.woff2`
- Create: `public/app-preview/assets/icons/*`
- Create: `tests/app-preview/components.test.mjs`
- Modify: `public/app-preview/index.html`

**Interfaces:**
- Produces: `icon(name, options)`, `primaryButton(options)`, `backButton(options)`, `bottomNav(options)`, `chip(options)`, `avatar(options)`, `sheetHandle()`, `toast(options)`, `confirmDialog(options)`
- Consumes: only measurements proven identical across two or more Figma frames

- [ ] **Step 1: Write failing component contract tests**

Test semantic HTML, `data-action`, accessible names, disabled state, selected state, and that icons use local SVG assets. The test must reject inline hand-drawn SVG paths and missing `aria-label` on icon-only buttons.

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
node --test tests/app-preview/components.test.mjs
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Extract exact shared values from measurements**

Populate tokens only when the Figma values are repeated. Required categories are color, typography, spacing, radius, shadow, transition duration and z-index. Copy Pretendard from `public/app/assets/fonts/PretendardVariable.woff2`. Export Figma icons to local SVG without modifying their geometry.

Do not merge similar-looking controls if any measured value differs. Give a differing control a screen-specific class.

- [ ] **Step 4: Implement and test shared components**

Every icon-only button has a stable square touch target of at least `44×44` without changing the visible icon size. Motion respects `prefers-reduced-motion: reduce`.

The phone root uses `padding-top: env(safe-area-inset-top)` and `padding-bottom: env(safe-area-inset-bottom)` only in the mobile full-screen mode; the fixed `393×852` desktop review frame uses the Figma coordinates without extra safe-area padding.

Run:

```bash
node --test tests/app-preview/components.test.mjs
npm run check:app-preview
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/components.js public/app-preview/styles/tokens.css public/app-preview/styles/components.css public/app-preview/assets public/app-preview/index.html tests/app-preview/components.test.mjs
git commit -m "feat: add measured preview components"
```

---

### Task 6: Flow A Onboarding, Login and Profile Setup

**Files:**
- Create: `public/app-preview/screens/onboarding.js`
- Create: `public/app-preview/styles/onboarding.css`
- Create: `tests/app-preview/onboarding.spec.mjs`
- Modify: `public/app-preview/screen-registry.js`
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/figma/screen-measurements.json`

**Interfaces:**
- Produces: one renderer per visible final Flow A frame in inventory
- Produces: validated form state `email`, `password`, `nickname`, `birthYear`, `gender`, `source`, `habit`, `neighborhoodId`
- Produces: complete Flow A transition chain ending at the first Flow B screen

- [ ] **Step 1: Write the failing Flow A E2E tests**

Tests must cover start, login, signup, email format error, already-used email, password rules, password mismatch, nickname duplicate, birth-year selection, gender selection, source/habit questions, neighborhood selection, loading/transition states, back navigation and direct entry to every A screen.

For every screen, assert the title, primary action, current Figma node ID in `data-figma-node`, and a screenshot at `393×852`.

- [ ] **Step 2: Run the Flow A test and verify it fails**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/onboarding.spec.mjs
```

Expected: FAIL on the first unimplemented A renderer.

- [ ] **Step 3: Implement Flow A one frame at a time**

For each A inventory frame, follow this exact cycle before moving to the next frame:

1. Call Figma `get_design_context` for that frame node.
2. Compare its local reference PNG and `screen-measurements.json`.
3. Add only that frame renderer and screen-specific CSS.
4. Add all its visible `data-action` values to `transitions.js`.
5. Run the direct-entry E2E assertion and screenshot.
6. Fix geometry until the non-masked screenshot diff is at most `2%` and no measured element differs by more than `1px`.

Do not reuse the current `public/app` onboarding markup. Use the exact A frame copy and positions.

- [ ] **Step 4: Verify the complete A flow in all viewports**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/onboarding.spec.mjs --project=chromium
node --test tests/app-preview/transitions.test.mjs tests/app-preview/registry.test.mjs
```

Expected: PASS for every A screen and transition; no skipped screenshot assertions.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/screens/onboarding.js public/app-preview/styles/onboarding.css public/app-preview/screen-registry.js public/app-preview/transitions.js public/app-preview/figma/screen-measurements.json tests/app-preview/onboarding.spec.mjs
git commit -m "feat: implement Figma onboarding flow"
```

---

### Task 7: Flow B Discover Feed and Place Detail

**Files:**
- Create: `public/app-preview/screens/discover.js`
- Create: `public/app-preview/styles/discover.css`
- Create: `tests/app-preview/discover.spec.mjs`
- Modify: `public/app-preview/screen-registry.js`
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/state.js`

**Interfaces:**
- Produces: every final Flow B renderer
- Produces: media masonry/feed, photo pagination, place detail sheet, user link, like/comment/save/share/follow, filter and map states
- Produces: pointer gesture result only after distance/velocity threshold; canceled drag never changes cards

- [ ] **Step 1: Write failing Discover tests**

Cover direct entry to all B screens, tab/filter changes, feed scroll, photo previous/next, media index dots, place detail open/close, sheet drag states, user profile navigation, like/comment/save/share/follow, map state, loading/error/empty states and browser back.

Add a canceled-drag regression test: move less than the configured threshold, release, and assert the current place/media ID is unchanged.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/discover.spec.mjs
```

Expected: FAIL because Flow B renderers are absent.

- [ ] **Step 3: Implement every B frame with the per-frame Figma cycle**

Use the same six-step Figma cycle from Task 6. Preserve original media aspect ratios in the masonry feed. Image containers reserve measured dimensions before load. Preload the next two visible media files and show a same-size skeleton on cache miss.

The place sheet supports its Figma-defined collapsed/expanded positions. Touch targets may grow invisibly, but visible geometry must remain exact.

Every image reserves its measured box before loading. A failed image receives a local same-size fallback class without changing layout. A simulated fixture timeout after `8,000ms` changes to the matching Figma error state and exposes a retry action.

- [ ] **Step 4: Verify interaction and screenshots**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/discover.spec.mjs
node --test tests/app-preview/transitions.test.mjs tests/app-preview/fixtures.test.mjs
```

Expected: PASS; no visible B action lacks a handler.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/screens/discover.js public/app-preview/styles/discover.css public/app-preview/screen-registry.js public/app-preview/transitions.js public/app-preview/state.js tests/app-preview/discover.spec.mjs
git commit -m "feat: implement Figma discover flow"
```

---

### Task 8: Flow C Saved Places and Saved Routes

**Files:**
- Create: `public/app-preview/screens/saved.js`
- Create: `public/app-preview/styles/saved.css`
- Create: `tests/app-preview/saved.spec.mjs`
- Modify: `public/app-preview/screen-registry.js`
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/state.js`

**Interfaces:**
- Produces: every final Flow C renderer
- Produces: saved-place/route tabs, filter popover, detail, long-press selection, select-all, delete/cancel, share and empty/no-result states

- [ ] **Step 1: Write failing Saved tests**

Cover place/route tabs, empty states, filter selection and reset, no results, place detail, long press without accidental click, single/multi/select-all, cancel, delete confirmation, route card/detail and share fallback.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/saved.spec.mjs
```

Expected: FAIL because Flow C renderers are absent.

- [ ] **Step 3: Implement every C frame with exact measurements**

Use the Task 6 per-frame Figma cycle. Saved cards must use the Figma image and information-overlay geometry, not the current `/app` card. Long press opens the exact selection frame; checked markers change only the marker state and never shift card layout.

- [ ] **Step 4: Verify state integrity and screenshots**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/saved.spec.mjs
node --test tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs
```

Expected: PASS; deleting a saved item does not reset the session or review state.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/screens/saved.js public/app-preview/styles/saved.css public/app-preview/screen-registry.js public/app-preview/transitions.js public/app-preview/state.js tests/app-preview/saved.spec.mjs
git commit -m "feat: implement Figma saved flow"
```

---

### Task 9: Flow D Route Creation and Route Detail

**Files:**
- Create: `public/app-preview/screens/route.js`
- Create: `public/app-preview/styles/route.css`
- Create: `tests/app-preview/route.spec.mjs`
- Modify: `public/app-preview/screen-registry.js`
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/state.js`

**Interfaces:**
- Produces: every final Flow D renderer
- Produces: candidate filtering, ordered selection, minimum-count disabled state, loading, generated route, route edit/share/start and failure states

- [ ] **Step 1: Write failing Route tests**

Cover empty start, candidate list, filter popover, route-place selection, selection summary, disabled/enabled CTA, selected order, loading progress, generated route, edit title/place, save/share/start, map placeholder, unsupported-route failure and back navigation without scroll jump.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/route.spec.mjs
```

Expected: FAIL because Flow D renderers are absent.

- [ ] **Step 3: Implement every D frame with exact measurements**

Use the Task 6 per-frame Figma cycle. Route order follows selection order. Selecting a place preserves the list scroll position. Loading progress is monotonic from `0` to `100` once and then transitions exactly once. Static map placeholders retain the Figma container and pin geometry and are replaceable through `api-adapter.js` later.

- [ ] **Step 4: Verify route behavior and screenshots**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/route.spec.mjs
node --test tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs
```

Expected: PASS; every selected route place remains valid fixture data and no click jumps the panel to the top.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/screens/route.js public/app-preview/styles/route.css public/app-preview/screen-registry.js public/app-preview/transitions.js public/app-preview/state.js tests/app-preview/route.spec.mjs
git commit -m "feat: implement Figma route flow"
```

---

### Task 10: Flow E Profile, Settings and Account Actions

**Files:**
- Create: `public/app-preview/screens/profile-settings.js`
- Create: `public/app-preview/styles/profile-settings.css`
- Create: `tests/app-preview/profile-settings.spec.mjs`
- Modify: `public/app-preview/screen-registry.js`
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/state.js`

**Interfaces:**
- Produces: every final Flow E renderer
- Produces: profile/feed/following, edit profile, account, terms/privacy links, feedback, logout and withdrawal confirmation states

- [ ] **Step 1: Write failing profile/settings tests**

Cover profile tabs, feed item navigation, follow toggle, edit profile validation, settings rows, external policy links, feedback category/text, confirmation dialogs, logout cancellation/confirmation, withdrawal cancellation/confirmation and browser back.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/profile-settings.spec.mjs
```

Expected: FAIL because Flow E renderers are absent.

- [ ] **Step 3: Implement every E frame with exact measurements**

Use the Task 6 per-frame Figma cycle. External links use real `/terms` and `/privacy` URLs. Fixture logout returns to the exact A login/start state defined by Figma. Fixture withdrawal clears only user-domain state after confirmation and does not clear review status.

- [ ] **Step 4: Verify profile/settings behavior and screenshots**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/profile-settings.spec.mjs
node --test tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/screens/profile-settings.js public/app-preview/styles/profile-settings.css public/app-preview/screen-registry.js public/app-preview/transitions.js public/app-preview/state.js tests/app-preview/profile-settings.spec.mjs
git commit -m "feat: implement Figma profile settings flow"
```

---

### Task 11: Complete Action Coverage and Cross-Flow Navigation

**Files:**
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/main.js`
- Modify: `tests/app-preview/transitions.test.mjs`
- Create: `tests/app-preview/full-flow.spec.mjs`

**Interfaces:**
- Consumes: complete A~E registry
- Produces: zero dead visible actions and deterministic browser-back behavior

- [ ] **Step 1: Add a failing complete-flow test**

The test starts at `a1`, completes onboarding, enters Discover, opens a place, saves it, sees it in Saved, adds places to a route, creates the route, shares it, opens Profile/Settings, logs out and returns to the intended A screen. It then iterates every registry screen and clicks or state-tests every declared action.

- [ ] **Step 2: Run and verify any gaps fail**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/full-flow.spec.mjs
node --test tests/app-preview/transitions.test.mjs
```

Expected: FAIL listing exact missing action IDs or incorrect destinations.

- [ ] **Step 3: Fix only missing contracts and navigation restoration**

Add no new visual design. Resolve each missing action using, in order: an existing Figma destination, an existing same-screen state, a Figma-styled overlay composed from existing elements, or a standard browser effect such as share/copy/external link. Preserve scroll position and local state when returning.

- [ ] **Step 4: Run complete action coverage**

Run:

```bash
npm run test:app-preview:unit
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/full-flow.spec.mjs
```

Expected: PASS with zero undeclared and zero unhandled actions.

- [ ] **Step 5: Commit**

```bash
git add public/app-preview/transitions.js public/app-preview/main.js tests/app-preview/transitions.test.mjs tests/app-preview/full-flow.spec.mjs
git commit -m "test: complete preview action coverage"
```

---

### Task 12: Visual Regression, Responsive QA and Final Guard

**Files:**
- Create: `tests/app-preview/visual.spec.mjs`
- Create: `tests/app-preview/visual.spec.mjs-snapshots/*`
- Modify: `playwright.app-preview.config.mjs`
- Modify: `scripts/check-app-preview.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/build.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: screenshot evidence for every registry screen at `393×852`
- Produces: overlap/crop checks at `375×667` and `430×932`
- Produces: CI command `npm run test:app-preview`

- [ ] **Step 1: Write the visual matrix test**

For each registry screen, open `?screen=<id>&fixture=baseline`, wait for `document.fonts.ready` and `data-preview-ready="true"`, apply only the masks in `visual-masks.json`, and compare the phone root screenshot. Add viewport projects named `base-393`, `small-375`, and `large-430`.

At all sizes, assert:

```js
const overflow = await page.locator("#phone-root").evaluate((root) => ({
  x: root.scrollWidth - root.clientWidth,
  bodyX: document.documentElement.scrollWidth - document.documentElement.clientWidth
}));
expect(overflow.x).toBeLessThanOrEqual(1);
expect(overflow.bodyX).toBeLessThanOrEqual(1);
```

Also inject a long Korean place name and long tag label and assert no interactive element overlaps its neighbor.

For form screens, focus every text field and repeat the overlap assertions while the mobile virtual-keyboard viewport is simulated. For overlays, capture bottom sheets, popovers, confirmation dialogs, toasts, loading, empty and error states directly rather than testing only their base screens.

- [ ] **Step 2: Run visual tests and collect failures**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/visual.spec.mjs
```

Expected: failures list exact screens with missing baselines or excessive diffs.

- [ ] **Step 3: Fix visual differences screen by screen**

Never change a Figma-derived value to make another screen pass. Fix shared tokens only when the same Figma measurement is proven across every affected screen; otherwise use the screen stylesheet. Regenerate baselines only after comparing against the Figma reference and confirming the `1px` and `2%` limits.

- [ ] **Step 4: Add CI and final checks**

Add `npm run check:app-preview` and `npm run test:app-preview` to `.github/workflows/build.yml`. Update README with local commands and the review URL. The guard must fail when inventory count differs from registry count, an action lacks a handler, a reference is missing, or a preview file contains an external temporary Figma asset URL.

Run:

```bash
npm run guard:repo
npm run check:session
npm run check:supabase
npm run typecheck
npm run check:mvp-app
npm run check:app-preview
npm run test:app-preview
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/app-preview/visual.spec.mjs tests/app-preview/visual.spec.mjs-snapshots playwright.app-preview.config.mjs scripts/check-app-preview.mjs package.json package-lock.json .github/workflows/build.yml README.md
git commit -m "test: verify Figma preview across viewports"
```

---

### Task 13: Manual Screen Approval and Pull Request

**Files:**
- No production file changes unless user review finds a discrepancy.

**Interfaces:**
- Consumes: completed review board
- Produces: user-owned `완료` marks and a PR with passing required checks

- [ ] **Step 1: Start the preview for user review**

Run:

```bash
npm run dev:app-preview
```

Open `http://127.0.0.1:4173/app-preview/`. The user selects screens on the right and alone changes `미검토` to `완료`.

- [ ] **Step 2: Address review findings one screen at a time**

For each user finding, re-read that frame with Figma `get_design_context`, update only its renderer/style or a proven shared component, run its direct screenshot test, then run the affected flow test. Do not mark it complete on behalf of the user.

- [ ] **Step 3: Run the full verification suite again**

Run:

```bash
npm run guard:repo && npm run check:session && npm run check:supabase && npm run typecheck && npm run check:mvp-app && npm run check:app-preview && npm run test:app-preview
```

Expected: all PASS.

- [ ] **Step 4: Push and create a PR without production deployment**

Run:

```bash
git status --short
git push -u origin codex/figma-web-prototype-design
gh pr create --title "Build Figma-accurate Doripe web prototype" --body-file .github/pull_request_template.md
```

Do not run any direct Vercel production command. Merge only after required checks pass and the user approves the screens.
