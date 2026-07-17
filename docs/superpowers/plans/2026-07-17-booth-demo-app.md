# Doripe Booth Demo App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a touch-first Doripe booth demo at `/demo` that lets a visitor discover a place from an image feed, add nearby places, and complete a course within 60 seconds.

**Architecture:** Add an isolated static app under `public/booth-demo/` using plain HTML, CSS, and JavaScript modules. A small pure state module owns screen transitions and selection rules; the DOM layer renders the feed, detail, course builder, completion screen, inactivity reset, and animations without calling any API.

**Tech Stack:** HTML5, CSS, browser JavaScript modules, Node test runner, Playwright, Vercel static rewrites

## Global Constraints

- Public route is exactly `/demo`.
- Use no external CDN, API, authentication, Supabase, UI framework, or runtime dependency.
- Use the existing repository asset `public/instagram-pinned-feed/assets/doripe-logo-black.png`; its SHA-256 exactly matches `/Users/cityboy/Desktop/Doripe Assets/black doripe-removed.png`.
- Use Doripe green `#10c76f`, warm white, dark ink, and the existing local Pretendard font.
- The discovery feed contains no location controls, filters, tags, or text overlays.
- One or more additional selected places enables the floating `코스 완성하기` button.
- Reset to the welcome screen after 60 seconds without input.
- Optimize for iPad portrait, a minimum 52px touch target, safe-area insets, and `prefers-reduced-motion`.
- Production goes only through GitHub PR → required checks → `main` merge → Vercel Git integration.

---

## File Structure

- `public/booth-demo/index.html`: semantic app shell and local asset loading.
- `public/booth-demo/styles.css`: Doripe visual system, feed layout, animations, tablet responsiveness, and reduced motion.
- `public/booth-demo/places.js`: immutable demo place and image metadata.
- `public/booth-demo/demo-state.js`: pure screen transition and selection functions.
- `public/booth-demo/app.js`: DOM rendering, event delegation, feed extension, animation coordination, and inactivity reset.
- `public/booth-demo/assets/place-01.png` through `place-08.png`: rights-safe, locally stored demo photography.
- `tests/app-preview/booth-demo-state.test.mjs`: pure state and content contract tests.
- `tests/app-preview/booth-demo.spec.mjs`: full touch journey, reset, accessibility, and route tests.
- `scripts/serve-app-preview.mjs`: local `/demo` rewrite for Playwright.
- `scripts/check-mvp-app.mjs`: production rewrite and required file guard.
- `vercel.json`: production `/demo` rewrite.

### Task 1: Route, shell, and local asset contract

**Files:**
- Create: `public/booth-demo/index.html`
- Create: `tests/app-preview/booth-demo-state.test.mjs`
- Modify: `scripts/serve-app-preview.mjs`
- Modify: `scripts/check-mvp-app.mjs`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: existing `/app-preview/assets/fonts/PretendardVariable.woff2` and `/instagram-pinned-feed/assets/doripe-logo-black.png`.
- Produces: public route `/demo`, DOM root `#demo-app`, and module entry `/booth-demo/app.js`.

- [ ] **Step 1: Write the failing route and shell contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("booth demo uses only local runtime assets", async () => {
  const html = await readFile(new URL("public/booth-demo/index.html", root), "utf8");
  assert.match(html, /id="demo-app"/);
  assert.match(html, /src="\/instagram-pinned-feed\/assets\/doripe-logo-black\.png"/);
  assert.match(html, /src="\/booth-demo\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs`

Expected: FAIL with `ENOENT` for `public/booth-demo/index.html`.

- [ ] **Step 3: Add the semantic shell**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#fffdf8">
    <title>Doripe 60초 코스</title>
    <link rel="stylesheet" href="/booth-demo/styles.css">
  </head>
  <body>
    <main id="demo-app" aria-live="polite"></main>
    <img class="asset-preload" src="/instagram-pinned-feed/assets/doripe-logo-black.png" alt="">
    <script type="module" src="/booth-demo/app.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Add local and production rewrites**

In `scripts/serve-app-preview.mjs`, resolve `/demo` and `/demo/` to `public/booth-demo/index.html`. In `vercel.json`, insert this rewrite before the root rewrite:

```json
{ "source": "/demo", "destination": "/booth-demo/index.html" }
```

In `scripts/check-mvp-app.mjs`, require `public/booth-demo/index.html` and assert:

```js
assert(rewriteBySource.get("/demo") === "/booth-demo/index.html", "vercel rewrite missing booth demo");
```

- [ ] **Step 5: Run the route and shell checks**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs && node scripts/check-mvp-app.mjs`

Expected: both commands PASS.

- [ ] **Step 6: Commit the route shell**

```bash
git add public/booth-demo/index.html tests/app-preview/booth-demo-state.test.mjs scripts/serve-app-preview.mjs scripts/check-mvp-app.mjs vercel.json
git commit -m "feat: add booth demo route"
```

### Task 2: Demo content and pure state machine

**Files:**
- Create: `public/booth-demo/places.js`
- Create: `public/booth-demo/demo-state.js`
- Modify: `tests/app-preview/booth-demo-state.test.mjs`

**Interfaces:**
- Produces: `PLACES`, `createInitialState()`, `startDiscovery(state)`, `openPlace(state, placeId)`, `browseNearby(state)`, `toggleAdditionalPlace(state, placeId)`, `completeCourse(state)`, and `resetState()`.
- State shape: `{ screen: "welcome" | "feed" | "detail" | "builder" | "complete", startPlaceId: string | null, selectedPlaceIds: string[] }`.

- [ ] **Step 1: Add failing state transition tests**

```js
import {
  browseNearby,
  completeCourse,
  createInitialState,
  openPlace,
  startDiscovery,
  toggleAdditionalPlace
} from "../../public/booth-demo/demo-state.js";

test("visitor completes a course after selecting one nearby place", () => {
  let state = startDiscovery(createInitialState());
  state = openPlace(state, "place-01");
  state = browseNearby(state);
  assert.equal(state.screen, "builder");
  assert.equal(state.startPlaceId, "place-01");
  assert.deepEqual(state.selectedPlaceIds, []);

  state = toggleAdditionalPlace(state, "place-02");
  assert.deepEqual(state.selectedPlaceIds, ["place-02"]);
  assert.equal(completeCourse(state).screen, "complete");
});

test("selection is unique and the starting place cannot be added twice", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-01"));
  assert.deepEqual(toggleAdditionalPlace(builder, "place-01").selectedPlaceIds, []);
  const selected = toggleAdditionalPlace(builder, "place-02");
  assert.deepEqual(toggleAdditionalPlace(selected, "place-02").selectedPlaceIds, []);
});

test("course cannot complete without an additional place", () => {
  const builder = browseNearby(openPlace(startDiscovery(createInitialState()), "place-01"));
  assert.throws(() => completeCourse(builder), /additional place/i);
});
```

- [ ] **Step 2: Run the state tests and verify they fail**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs`

Expected: FAIL because `demo-state.js` does not exist.

- [ ] **Step 3: Implement the immutable transition module**

```js
export function createInitialState() {
  return { screen: "welcome", startPlaceId: null, selectedPlaceIds: [] };
}

export const resetState = createInitialState;

export function startDiscovery() {
  return { screen: "feed", startPlaceId: null, selectedPlaceIds: [] };
}

export function openPlace(state, placeId) {
  if (state.screen !== "feed") throw new Error("Place can only open from feed");
  return { ...state, screen: "detail", startPlaceId: placeId, selectedPlaceIds: [] };
}

export function browseNearby(state) {
  if (state.screen !== "detail" || !state.startPlaceId) throw new Error("A starting place is required");
  return { ...state, screen: "builder" };
}

export function toggleAdditionalPlace(state, placeId) {
  if (state.screen !== "builder" || placeId === state.startPlaceId) return state;
  const selected = state.selectedPlaceIds.includes(placeId)
    ? state.selectedPlaceIds.filter((id) => id !== placeId)
    : [...state.selectedPlaceIds, placeId];
  return { ...state, selectedPlaceIds: selected };
}

export function completeCourse(state) {
  if (state.screen !== "builder" || state.selectedPlaceIds.length < 1) {
    throw new Error("At least one additional place is required");
  }
  return { ...state, screen: "complete" };
}
```

- [ ] **Step 4: Add eight immutable place records**

Each record in `PLACES` must use this exact interface and a local image:

```js
export const PLACES = Object.freeze([
  Object.freeze({ id: "place-01", name: "레이어드 연남", copy: "빛과 디저트가 머무는 공간", image: "/booth-demo/assets/place-01.png" }),
  Object.freeze({ id: "place-02", name: "오브젝트 연남", copy: "천천히 둘러보는 작은 취향", image: "/booth-demo/assets/place-02.png" }),
  Object.freeze({ id: "place-03", name: "갤러리 무아", copy: "빛과 여백이 흐르는 전시 공간", image: "/booth-demo/assets/place-03.png" }),
  Object.freeze({ id: "place-04", name: "이후북스", copy: "오래 머물고 싶은 작은 책방", image: "/booth-demo/assets/place-04.png" }),
  Object.freeze({ id: "place-05", name: "사운드 캐비닛", copy: "좋은 음악으로 채운 늦은 오후", image: "/booth-demo/assets/place-05.png" }),
  Object.freeze({ id: "place-06", name: "정원 식탁", copy: "초록 사이에서 즐기는 한 끼", image: "/booth-demo/assets/place-06.png" }),
  Object.freeze({ id: "place-07", name: "크림 아틀리에", copy: "작은 디저트가 완성되는 순간", image: "/booth-demo/assets/place-07.png" }),
  Object.freeze({ id: "place-08", name: "스튜디오 콤마", copy: "일상에 쉼표를 더하는 디자인", image: "/booth-demo/assets/place-08.png" })
]);
```

- [ ] **Step 5: Run unit tests**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs`

Expected: all booth demo unit tests PASS.

- [ ] **Step 6: Commit state and content**

```bash
git add public/booth-demo/places.js public/booth-demo/demo-state.js tests/app-preview/booth-demo-state.test.mjs
git commit -m "feat: add booth demo journey state"
```

### Task 3: Rights-safe photo set and Doripe visual system

**Files:**
- Create: `public/booth-demo/assets/place-01.png` through `public/booth-demo/assets/place-08.png`
- Create: `public/booth-demo/styles.css`
- Modify: `tests/app-preview/booth-demo-state.test.mjs`

**Interfaces:**
- Consumes: the eight image paths in `PLACES` and the existing exact-match logo asset.
- Produces: a two-column masonry feed, floating CTA, selected-card animation, completion animation, iPad portrait layout, and reduced-motion fallback.

- [ ] **Step 1: Add failing local-photo and CSS contract tests**

```js
import { access } from "node:fs/promises";
import { PLACES } from "../../public/booth-demo/places.js";

test("all demo places use available local booth assets", async () => {
  assert.equal(PLACES.length, 8);
  for (const place of PLACES) {
    assert.match(place.image, /^\/booth-demo\/assets\/place-\d{2}\.png$/);
    await access(new URL(`../../public${place.image}`, import.meta.url));
  }
});

test("booth CSS includes touch, safe area, and reduced motion rules", async () => {
  const css = await readFile(new URL("public/booth-demo/styles.css", root), "utf8");
  assert.match(css, /min-height:\s*52px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /#10c76f/i);
});
```

- [ ] **Step 2: Run the asset contract tests and verify they fail**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs`

Expected: FAIL because the local photos and CSS do not exist.

- [ ] **Step 3: Generate the cohesive local photo set**

Use the `imagegen` skill to create eight portrait or 4:5 images with this shared art direction:

```text
Editorial Seoul neighborhood place photography for a premium discovery app, natural daylight, warm neutral palette with subtle green accents, lived-in but no visible people, realistic Korean cafe/shop/gallery details, no readable brands, no text, no logos, vertical 4:5 crop, distinct composition from the other images.
```

Save the outputs as `public/booth-demo/assets/place-01.png` through `place-08.png`. Use a distinct subject for each: sunlit cafe, ceramics shop, small gallery, bookshop, listening bar, garden restaurant, dessert counter, and design store.

- [ ] **Step 4: Implement the CSS visual system**

Define local fonts and exact tokens:

```css
@font-face {
  font-family: "Doripe Pretendard";
  src: url("/app-preview/assets/fonts/PretendardVariable.woff2") format("woff2");
  font-display: swap;
}

:root {
  --green: #10c76f;
  --ink: #101714;
  --paper: #fffdf8;
  --muted: #6f7c74;
  --radius-card: 18px;
  --shadow-floating: 0 14px 36px rgb(7 81 43 / 26%);
}

.touch-target { min-height: 52px; min-width: 52px; }
.floating-action { bottom: calc(16px + env(safe-area-inset-bottom)); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
```

Use CSS columns or a two-column grid with deliberately varied image aspect ratios. Do not render captions, tags, or filters on feed photos.

- [ ] **Step 5: Run asset and CSS tests**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the visual system**

```bash
git add public/booth-demo/assets public/booth-demo/styles.css tests/app-preview/booth-demo-state.test.mjs
git commit -m "feat: add booth demo visual system"
```

### Task 4: Touch interaction, animation, and inactivity reset

**Files:**
- Create: `public/booth-demo/app.js`
- Create: `tests/app-preview/booth-demo.spec.mjs`
- Modify: `public/booth-demo/styles.css`

**Interfaces:**
- Consumes: all exports from `demo-state.js` and `PLACES` from `places.js`.
- Produces: `[data-screen]`, `[data-place-id]`, `[data-action]`, `.is-selected`, `.is-lifting`, `.floating-action`, and the 60,000ms inactivity reset.

- [ ] **Step 1: Write the failing Playwright journey**

```js
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

test("visitor builds a course from the photo feed", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "60초 코스 만들기" }).click();
  await expect(page.locator('[data-screen="feed"]')).toBeVisible();

  await page.locator('[data-place-id="place-01"]').first().click();
  await expect(page.getByRole("heading", { name: "레이어드 연남" })).toBeVisible();
  await page.getByRole("button", { name: "이 장소 주변 둘러보기" }).click();

  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await expect(page.locator(".floating-action")).toBeHidden();
  await page.locator('[data-place-id="place-02"]').first().click();
  await expect(page.locator(".floating-action")).toBeVisible();
  await page.getByRole("button", { name: /코스 완성하기/ }).click();
  await expect(page.getByRole("heading", { name: "우리의 코스 완성!" })).toBeVisible();
});
```

- [ ] **Step 2: Run the journey and verify it fails**

Run: `npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/booth-demo.spec.mjs`

Expected: FAIL because `app.js` and the rendered controls do not exist.

- [ ] **Step 3: Implement rendering and delegated actions**

Use one state value and one render boundary:

```js
import { PLACES } from "./places.js";
import {
  browseNearby,
  completeCourse,
  createInitialState,
  openPlace,
  startDiscovery,
  toggleAdditionalPlace
} from "./demo-state.js";

const root = document.querySelector("#demo-app");
let state = createInitialState();

function update(nextState) {
  state = nextState;
  render();
  armInactivityReset();
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-place-id]");
  if (!target) return;
  if (target.dataset.action === "start") update(startDiscovery(state));
  if (target.dataset.action === "browse-nearby") update(browseNearby(state));
  if (target.dataset.action === "complete") update(completeCourse(state));
  if (target.dataset.action === "reset") update(createInitialState());
  if (target.dataset.placeId && state.screen === "feed") update(openPlace(state, target.dataset.placeId));
  else if (target.dataset.placeId && state.screen === "builder") update(toggleAdditionalPlace(state, target.dataset.placeId));
});
```

Render only semantic buttons for selectable photos. In the builder, apply `aria-pressed`, `.is-selected`, and a local check icon. Render the floating CTA only when `state.selectedPlaceIds.length > 0`.

- [ ] **Step 4: Implement 60-second reset and feed continuation**

```js
let inactivityTimer;

function armInactivityReset() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => update(createInitialState()), 60_000);
}

for (const eventName of ["pointerdown", "touchstart", "keydown", "scroll"]) {
  window.addEventListener(eventName, armInactivityReset, { passive: true });
}
```

Use an `IntersectionObserver` sentinel to append another shuffled copy of the eight local place cards, while ensuring each button retains its original `data-place-id` and accessible label.

- [ ] **Step 5: Add E2E cases for reset, duplicate selection, and layout**

```js
test("builder selection toggles without duplicates", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "60초 코스 만들기" }).click();
  await page.locator('[data-place-id="place-01"]').first().click();
  await page.getByRole("button", { name: "이 장소 주변 둘러보기" }).click();
  const candidate = page.locator('[data-place-id="place-02"]').first();
  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-pressed", "true");
  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".floating-action")).toBeHidden();
});

test("inactivity resets the demo", async ({ page }) => {
  await page.clock.install();
  await page.goto("/demo");
  await page.getByRole("button", { name: "60초 코스 만들기" }).click();
  await page.clock.fastForward(60_001);
  await expect(page.locator('[data-screen="welcome"]')).toBeVisible();
});

test("primary controls fit the portrait tablet viewport", async ({ page }) => {
  await page.goto("/demo");
  const start = page.getByRole("button", { name: "60초 코스 만들기" });
  const startBox = await start.boundingBox();
  expect(startBox.height).toBeGreaterThanOrEqual(52);
  expect(startBox.x).toBeGreaterThanOrEqual(0);
  expect(startBox.x + startBox.width).toBeLessThanOrEqual(820);
});
```

- [ ] **Step 6: Run the focused checks**

Run: `node --test tests/app-preview/booth-demo-state.test.mjs && npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/booth-demo.spec.mjs`

Expected: unit and Playwright tests PASS.

- [ ] **Step 7: Commit the interactive demo**

```bash
git add public/booth-demo/app.js public/booth-demo/styles.css tests/app-preview/booth-demo.spec.mjs
git commit -m "feat: complete booth demo journey"
```

### Task 5: Full verification and Git delivery

**Files:**
- Modify only if verification exposes a booth-demo defect.

**Interfaces:**
- Produces: a verified PR Preview and the approved Git path to `doripe.kr/demo`.

- [ ] **Step 1: Run static and unit checks**

Run: `npm run check:mvp-app && npm run test:app-preview:unit && npm run typecheck`

Expected: every command exits 0.

- [ ] **Step 2: Run the booth journey three times**

Run:

```bash
for run in 1 2 3; do
  npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/booth-demo.spec.mjs
done
```

Expected: all three runs PASS.

- [ ] **Step 3: Run the full existing app E2E suite**

Run: `npm run test:app-preview:e2e:ci`

Expected: the full non-visual suite exits 0.

- [ ] **Step 4: Push the branch and create a PR**

Use the repository's authenticated GitHub workflow to push the current `codex/*` branch and open a PR. Do not merge until required checks and Vercel Preview pass.

- [ ] **Step 5: Verify Preview on the booth tablet**

Open the PR's Vercel Preview `/demo` URL in a private browser window, confirm it does not require Vercel authentication, and perform the full journey three times in portrait orientation.

- [ ] **Step 6: Merge through GitHub after approval**

Merge the PR into `main` only after required checks, Preview verification, and user approval. Confirm `https://doripe.kr/demo` after Vercel Git integration finishes.
