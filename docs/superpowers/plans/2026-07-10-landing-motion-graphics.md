# Doripe Landing Motion Graphics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's four static visual areas with responsive advertising-style motion scenes that show social place discovery, nearby-place recommendation, course creation, sharing, and navigation without changing copy, CTA buttons, or `/notify`.

**Architecture:** Keep `public/home/index.html` as the canonical landing markup and mirror it to `public/index.html`. Put all motion presentation in a dedicated stylesheet and all lifecycle logic in a small ES module. Each scene is an independent `data-motion-scene` container controlled by `IntersectionObserver`; CSS owns the animation timelines and exposes stable final states for reduced-motion and JavaScript failure.

**Tech Stack:** Static HTML, CSS keyframes, ES modules, Web APIs (`IntersectionObserver`, `matchMedia`), Node built-in test runner, existing Figma-derived PNG assets.

## Global Constraints

- Modify landing-page visual areas only.
- Do not change any landing-page copy.
- Do not change CTA buttons, CTA destinations, or `/notify`.
- Use current Figma UI as the source of truth.
- Use AI-generated assets only for photographic content and profiles, and only after a separate visual approval.
- Represent algorithm, sharing, and navigation with temporary advertising overlays, never permanent fake app controls.
- Support desktop and mobile widths from 320px upward.
- Respect `prefers-reduced-motion` and keep static fallbacks usable without JavaScript.
- Do not add a third-party animation dependency.

---

## File Structure

- Create `public/home/landing-motion.css`: all scene layout, keyframes, responsive rules, reduced-motion states, and static fallbacks.
- Create `public/home/landing-motion.js`: scene lifecycle only; no visual styling and no product/backend behavior.
- Create `scripts/check-landing-motion.mjs`: static contract checker for files, scene markup, protected copy/CTA behavior, and mirrored HTML.
- Create `scripts/sync-home-index.mjs`: copy canonical landing markup to `public/index.html` after every markup change.
- Create `tests/landing-motion-controller.test.mjs`: Node tests for scene-state decisions.
- Modify `package.json`: add motion sync, test, and check commands.
- Modify `public/home/index.html`: link shared assets and replace four visual containers with motion-scene markup.
- Modify `public/index.html`: generated mirror of `public/home/index.html`; do not edit independently.
- Reuse `public/img/figma-ui/*.png` and `public/app/assets/creator-photos/*.png`; do not duplicate or replace them in the first pass.

---

### Task 1: Shared Motion Infrastructure And Contracts

**Files:**
- Create: `public/home/landing-motion.css`
- Create: `public/home/landing-motion.js`
- Create: `scripts/check-landing-motion.mjs`
- Create: `scripts/sync-home-index.mjs`
- Create: `tests/landing-motion-controller.test.mjs`
- Modify: `package.json`
- Modify: `public/home/index.html`
- Modify: `public/index.html`

**Interfaces:**
- Produces: `resolveSceneState({ visible, reducedMotion }) -> "playing" | "paused" | "final"`
- Produces: `applySceneState(element, state) -> void`
- Produces: `initLandingMotion(documentRef, windowRef) -> { destroy() }`
- Produces: `[data-motion-scene][data-motion-state]` DOM contract consumed by all later scene tasks.

- [ ] **Step 1: Add failing controller tests**

Create `tests/landing-motion-controller.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveSceneState } from "../public/home/landing-motion.js";

test("reduced motion always resolves to the final state", () => {
  assert.equal(resolveSceneState({ visible: true, reducedMotion: true }), "final");
  assert.equal(resolveSceneState({ visible: false, reducedMotion: true }), "final");
});

test("visible scenes play and offscreen scenes pause", () => {
  assert.equal(resolveSceneState({ visible: true, reducedMotion: false }), "playing");
  assert.equal(resolveSceneState({ visible: false, reducedMotion: false }), "paused");
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node --test tests/landing-motion-controller.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `public/home/landing-motion.js`.

- [ ] **Step 3: Add the minimal controller**

Create `public/home/landing-motion.js`:

```js
export function resolveSceneState({ visible, reducedMotion }) {
  if (reducedMotion) return "final";
  return visible ? "playing" : "paused";
}

export function applySceneState(element, state) {
  element.dataset.motionState = state;
}

export function initLandingMotion(documentRef = document, windowRef = window) {
  const scenes = [...documentRef.querySelectorAll("[data-motion-scene]")];
  const media = windowRef.matchMedia("(prefers-reduced-motion: reduce)");

  const updateAll = () => {
    if (!media.matches) return;
    scenes.forEach((scene) => applySceneState(scene, "final"));
  };

  const observer = new windowRef.IntersectionObserver((entries) => {
    for (const entry of entries) {
      applySceneState(entry.target, resolveSceneState({
        visible: entry.isIntersecting,
        reducedMotion: media.matches,
      }));
    }
  }, { threshold: 0.2 });

  scenes.forEach((scene) => {
    applySceneState(scene, media.matches ? "final" : "paused");
    observer.observe(scene);
  });
  media.addEventListener?.("change", updateAll);

  return {
    destroy() {
      observer.disconnect();
      media.removeEventListener?.("change", updateAll);
    },
  };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initLandingMotion();
}
```

- [ ] **Step 4: Add base scene CSS and the static final-state contract**

Create `public/home/landing-motion.css`:

```css
.landing-motion {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  contain: layout paint;
}

.landing-motion [data-motion-layer] {
  animation-play-state: paused;
}

.landing-motion[data-motion-state="playing"] [data-motion-layer] {
  animation-play-state: running;
}

.landing-motion[data-motion-state="paused"] [data-motion-layer] {
  animation-play-state: paused;
}

.landing-motion[data-motion-state="final"] [data-motion-layer] {
  animation: none !important;
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .landing-motion [data-motion-layer] {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 5: Link the shared files without changing existing content**

In `public/home/index.html`, add this after the existing stylesheets:

```html
<link rel="stylesheet" href="/home/landing-motion.css" />
```

Add this before `</body>`:

```html
<script type="module" src="/home/landing-motion.js"></script>
```

- [ ] **Step 6: Add the mirror script**

Create `scripts/sync-home-index.mjs`:

```js
import { copyFile } from "node:fs/promises";

await copyFile("public/home/index.html", "public/index.html");
console.log("Landing index mirror updated.");
```

- [ ] **Step 7: Add the initial static contract checker**

Create `scripts/check-landing-motion.mjs`:

```js
import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const required = [
  "public/home/landing-motion.css",
  "public/home/landing-motion.js",
  "public/home/index.html",
  "public/index.html",
];

for (const file of required) assert(existsSync(file), `missing ${file}`);

const home = readFileSync("public/home/index.html", "utf8");
const mirror = readFileSync("public/index.html", "utf8");
assert(home === mirror, "public/index.html must mirror public/home/index.html");
assert(home.includes('/home/landing-motion.css'), "missing motion stylesheet link");
assert(home.includes('/home/landing-motion.js'), "missing motion module link");
assert(home.includes('href="/notify"'), "notification CTA must remain linked to /notify");
assert(home.includes("오늘 어디 갈지,"), "hero copy changed unexpectedly");
assert(home.includes("검색어 대신 분위기로 찾아요."), "Discover copy changed unexpectedly");
assert(home.includes("나중에 다시 찾기 쉬운 방식으로 저장해요."), "Save copy changed unexpectedly");
assert(home.includes("나만의 코스를 만들고, 떠나보세요."), "Go copy changed unexpectedly");

console.log("Landing motion contracts passed.");
```

- [ ] **Step 8: Add package scripts**

Add these entries to `package.json` scripts:

```json
"sync:home": "node scripts/sync-home-index.mjs",
"test:landing-motion": "node --test tests/landing-motion-controller.test.mjs",
"check:landing-motion": "node scripts/check-landing-motion.mjs"
```

- [ ] **Step 9: Sync and run the infrastructure checks**

Run:

```bash
npm run sync:home
npm run test:landing-motion
npm run check:landing-motion
npm run typecheck
```

Expected: all commands PASS.

- [ ] **Step 10: Commit**

```bash
git add package.json public/home/index.html public/index.html public/home/landing-motion.css public/home/landing-motion.js scripts/check-landing-motion.mjs scripts/sync-home-index.mjs tests/landing-motion-controller.test.mjs
git commit -m "test: add landing motion infrastructure"
```

---

### Task 2: Hero Full-Story Motion

**Files:**
- Modify: `public/home/index.html`
- Modify: `public/home/landing-motion.css`
- Modify: `scripts/check-landing-motion.mjs`
- Modify: `public/index.html` via `npm run sync:home`

**Interfaces:**
- Consumes: `[data-motion-scene]` state contract from Task 1.
- Produces: `#landingMotionHero` with layers `ugc`, `selection`, `nearby`, `course`, `share`, and `navigation`.

- [ ] **Step 1: Extend the contract checker before changing markup**

Append to `scripts/check-landing-motion.mjs`:

```js
for (const marker of [
  'id="landingMotionHero"',
  'data-motion-layer="ugc"',
  'data-motion-layer="selection"',
  'data-motion-layer="nearby"',
  'data-motion-layer="course"',
  'data-motion-layer="share"',
  'data-motion-layer="navigation"',
]) {
  assert(home.includes(marker), `hero motion missing ${marker}`);
}
assert(!home.includes('class="phone-stage reveal"'), "legacy hero orbit still present");
```

- [ ] **Step 2: Run the checker and verify it fails**

Run `npm run check:landing-motion`.

Expected: FAIL with `hero motion missing id="landingMotionHero"`.

- [ ] **Step 3: Replace only the current `.phone-stage` hero visual**

Replace the existing hero visual block with:

```html
<div
  id="landingMotionHero"
  class="landing-motion landing-motion--hero reveal"
  data-motion-scene
  data-motion-state="final"
  role="img"
  aria-label="유저와 큐레이터의 장소 콘텐츠가 주변 장소 추천과 하루 코스로 이어지는 Doripe 흐름"
>
  <div class="motion-ugc-stack" data-motion-layer="ugc" aria-hidden="true">
    <figure class="motion-ugc-card motion-ugc-card--one">
      <img src="/img/figma-ui/hero-discover-feed.png" alt="" />
      <figcaption><img src="/app/assets/creator-photos/creator-01.png" alt="" />도리데이</figcaption>
    </figure>
    <figure class="motion-ugc-card motion-ugc-card--two">
      <img src="/img/figma-ui/discover-photo-next.png" alt="" />
      <figcaption><img src="/app/assets/creator-photos/creator-02.png" alt="" />주말의연남</figcaption>
    </figure>
  </div>
  <div class="motion-selected-place" data-motion-layer="selection" aria-hidden="true">
    <img src="/img/figma-ui/discover.png" alt="" />
  </div>
  <div class="motion-nearby" data-motion-layer="nearby" aria-hidden="true">
    <span class="motion-nearby-card">카페 · 도보 6분</span>
    <span class="motion-nearby-card">소품샵 · 도보 8분</span>
    <span class="motion-nearby-card">식당 · 도보 11분</span>
  </div>
  <div class="motion-course" data-motion-layer="course" aria-hidden="true">
    <img src="/img/figma-ui/route-plan-generated.png" alt="" />
    <svg viewBox="0 0 320 180"><path d="M38 138 C92 58 186 142 278 42" /></svg>
  </div>
  <div class="motion-share-card" data-motion-layer="share" aria-hidden="true">
    <strong>연남 하루 코스</strong><span>3곳 · 친구에게 공유</span>
  </div>
  <div class="motion-navigation" data-motion-layer="navigation" aria-hidden="true">길찾기 시작 ↗</div>
</div>
```

- [ ] **Step 4: Add the eight-second hero timeline**

Append these exact timing contracts to `public/home/landing-motion.css`:

```css
.landing-motion--hero {
  min-height: 660px;
  border-radius: 42px;
  background: rgba(255,255,255,.42);
}

.landing-motion--hero [data-motion-layer] { position: absolute; }
.motion-ugc-stack { inset: 8% 52% 16% 3%; animation: heroUgc 8s ease-in-out infinite; }
.motion-selected-place { inset: 16% 34% 14% 34%; animation: heroSelection 8s ease-in-out infinite; }
.motion-nearby { inset: 12% 4% 16% 58%; animation: heroNearby 8s ease-in-out infinite; }
.motion-course { inset: 12% 4% 12% 58%; animation: heroCourse 8s ease-in-out infinite; }
.motion-share-card { right: 4%; bottom: 10%; animation: heroShare 8s ease-in-out infinite; }
.motion-navigation { right: 5%; top: 8%; animation: heroNavigation 8s ease-in-out infinite; }

@keyframes heroUgc {
  0%, 4% { opacity: 0; transform: translateX(-22px); }
  12%, 34% { opacity: 1; transform: none; }
  45%, 100% { opacity: .34; transform: scale(.9); }
}
@keyframes heroSelection {
  0%, 20% { opacity: 0; transform: scale(.86); }
  30%, 54% { opacity: 1; transform: none; }
  64%, 100% { opacity: .45; transform: translateX(-14%); }
}
@keyframes heroNearby {
  0%, 42% { opacity: 0; transform: scale(.84); }
  52%, 68% { opacity: 1; transform: none; }
  76%, 100% { opacity: 0; transform: scale(.94); }
}
@keyframes heroCourse {
  0%, 60% { opacity: 0; transform: translateY(18px); }
  72%, 92% { opacity: 1; transform: none; }
  100% { opacity: 0; }
}
@keyframes heroShare {
  0%, 72% { opacity: 0; transform: translateY(12px) scale(.92); }
  82%, 95% { opacity: 1; transform: none; }
  100% { opacity: 0; }
}
@keyframes heroNavigation {
  0%, 82% { opacity: 0; transform: translateX(-8px); }
  90%, 96% { opacity: 1; transform: none; }
  100% { opacity: 0; }
}
```

Add the supporting card/image sizing in the same file. Keep animated properties limited to `transform` and `opacity`:

```css
.motion-ugc-stack { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.motion-ugc-card { overflow:hidden; margin:0; border:1px solid rgba(18,32,24,.08); border-radius:22px; background:#fff; box-shadow:0 18px 48px rgba(24,42,32,.14); }
.motion-ugc-card--two { transform:translateY(18%); }
.motion-ugc-card > img,
.motion-selected-place > img,
.motion-course > img { display:block; width:100%; height:100%; object-fit:cover; }
.motion-ugc-card > img { aspect-ratio:3/4; }
.motion-ugc-card figcaption { display:flex; align-items:center; gap:8px; padding:10px 12px; color:#18231d; font-size:.78rem; font-weight:700; }
.motion-ugc-card figcaption img { width:24px; height:24px; flex:0 0 24px; border-radius:50%; object-fit:cover; }
.motion-selected-place,
.motion-course { overflow:hidden; border:1px solid rgba(18,32,24,.08); border-radius:28px; background:#fff; box-shadow:0 22px 60px rgba(24,42,32,.16); }
.motion-nearby { display:grid; align-content:center; gap:12px; }
.motion-nearby-card,
.motion-share-card,
.motion-navigation { border:1px solid rgba(18,202,107,.22); border-radius:16px; background:rgba(255,255,255,.94); box-shadow:0 14px 34px rgba(24,42,32,.12); }
.motion-nearby-card { padding:12px 14px; color:#143322; font-size:.84rem; font-weight:700; }
.motion-course svg { position:absolute; inset:0; width:100%; height:100%; }
.motion-course path { fill:none; stroke:#12ca6b; stroke-width:7; stroke-linecap:round; }
.motion-share-card { display:grid; gap:3px; min-width:190px; padding:14px 16px; }
.motion-share-card span { color:#68736d; font-size:.76rem; }
.motion-navigation { padding:11px 14px; color:#0aa95a; font-size:.82rem; font-weight:800; }
```

- [ ] **Step 5: Set a complete static final state**

Add:

```css
.landing-motion--hero[data-motion-state="final"] .motion-ugc-stack { opacity: .48; transform: scale(.9); }
.landing-motion--hero[data-motion-state="final"] .motion-selected-place { opacity: .72; transform: translateX(-14%); }
.landing-motion--hero[data-motion-state="final"] .motion-nearby { opacity: 0; }
.landing-motion--hero[data-motion-state="final"] .motion-course,
.landing-motion--hero[data-motion-state="final"] .motion-share-card,
.landing-motion--hero[data-motion-state="final"] .motion-navigation { opacity: 1; }
```

- [ ] **Step 6: Sync and verify**

Run:

```bash
npm run sync:home
npm run check:landing-motion
npm run test:landing-motion
```

Expected: PASS, and `public/index.html` matches the canonical landing page.

- [ ] **Step 7: Commit**

```bash
git add public/home/index.html public/index.html public/home/landing-motion.css scripts/check-landing-motion.mjs
git commit -m "feat: add landing hero product story motion"
```

---

### Task 3: Social Discovery Scene

**Files:**
- Modify: `public/home/index.html`
- Modify: `public/home/landing-motion.css`
- Modify: `scripts/check-landing-motion.mjs`
- Modify: `public/index.html` via sync

**Interfaces:**
- Produces: `#motionSceneDiscovery` with creator profile, media, video indicator, reaction, and selected-place layers.

- [ ] **Step 1: Add a failing markup contract**

Add to `scripts/check-landing-motion.mjs`:

```js
for (const marker of [
  'id="motionSceneDiscovery"',
  'data-motion-layer="creator-posts"',
  'data-motion-layer="creator-reaction"',
  'data-motion-layer="place-selection"',
]) assert(home.includes(marker), `discovery scene missing ${marker}`);
```

Run `npm run check:landing-motion` and expect FAIL for `motionSceneDiscovery`.

- [ ] **Step 2: Replace only the first `.journey-phone` visual**

Use this structure inside the existing `.journey-visual`:

```html
<div id="motionSceneDiscovery" class="landing-motion landing-motion--discovery" data-motion-scene data-motion-state="final" role="img" aria-label="유저와 큐레이터의 사진과 영상으로 장소를 발견하는 화면">
  <div class="discovery-ui" data-motion-layer="creator-posts" aria-hidden="true">
    <img src="/img/figma-ui/hero-discover-feed.png" alt="" />
  </div>
  <div class="creator-reaction" data-motion-layer="creator-reaction" aria-hidden="true">
    <img src="/app/assets/creator-photos/creator-03.png" alt="" />
    <span>여기 분위기 좋아</span>
  </div>
  <div class="video-indicator" data-motion-layer="creator-posts" aria-hidden="true">▶</div>
  <div class="place-selection" data-motion-layer="place-selection" aria-hidden="true">♥</div>
</div>
```

- [ ] **Step 3: Add a five-second discovery timeline**

```css
.landing-motion--discovery { min-height: 620px; }
.landing-motion--discovery .discovery-ui { position:absolute; inset:4% 16%; animation:discoveryFeed 5s ease-in-out infinite; }
.landing-motion--discovery .creator-reaction { position:absolute; left:8%; bottom:15%; animation:discoveryReaction 5s ease-in-out infinite; }
.landing-motion--discovery .video-indicator { position:absolute; right:18%; top:16%; animation:discoveryVideo 5s ease-in-out infinite; }
.landing-motion--discovery .place-selection { position:absolute; right:16%; bottom:14%; animation:discoverySelect 5s ease-in-out infinite; }
@keyframes discoveryFeed { 0%,100%{transform:translateY(0)} 48%,72%{transform:translateY(-4%)} }
@keyframes discoveryReaction { 0%,14%{opacity:0;transform:translateY(10px)} 26%,84%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes discoveryVideo { 0%,20%{opacity:0;transform:scale(.8)} 32%,78%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes discoverySelect { 0%,58%{opacity:0;transform:scale(.7)} 68%,90%{opacity:1;transform:scale(1.12)} 100%{opacity:0} }
```

- [ ] **Step 4: Sync, test, and commit**

Run:

```bash
npm run sync:home
npm run check:landing-motion
npm run test:landing-motion
```

Expected: PASS.

```bash
git add public/home/index.html public/index.html public/home/landing-motion.css scripts/check-landing-motion.mjs
git commit -m "feat: animate social place discovery"
```

---

### Task 4: Nearby-Place Algorithm Scene

**Files:**
- Modify: `public/home/index.html`
- Modify: `public/home/landing-motion.css`
- Modify: `scripts/check-landing-motion.mjs`
- Modify: `public/index.html` via sync

**Interfaces:**
- Produces: `#motionSceneNearby` with one anchor place, four candidate places, walking-time overlays, and a course tray.

- [ ] **Step 1: Add a failing markup contract**

```js
for (const marker of [
  'id="motionSceneNearby"',
  'data-motion-layer="anchor-place"',
  'data-motion-layer="nearby-candidates"',
  'data-motion-layer="course-tray"',
]) assert(home.includes(marker), `nearby scene missing ${marker}`);
```

Run `npm run check:landing-motion` and expect FAIL for `motionSceneNearby`.

- [ ] **Step 2: Replace only the second `.journey-phone` visual**

```html
<div id="motionSceneNearby" class="landing-motion landing-motion--nearby" data-motion-scene data-motion-state="final" role="img" aria-label="선택한 장소 주변에서 함께 갈 장소를 추천하는 화면">
  <article class="anchor-place" data-motion-layer="anchor-place" aria-hidden="true">
    <img src="/img/figma-ui/discover.png" alt="" />
  </article>
  <div class="nearby-candidates" data-motion-layer="nearby-candidates" aria-hidden="true">
    <span style="--x:-42%;--y:-34%">카페 · 6분</span>
    <span style="--x:46%;--y:-24%">소품샵 · 8분</span>
    <span style="--x:-40%;--y:42%">식당 · 11분</span>
    <span style="--x:44%;--y:38%">바 · 13분</span>
  </div>
  <div class="course-tray" data-motion-layer="course-tray" aria-hidden="true">
    <span>1</span><span>2</span><span>3</span><strong>코스 후보</strong>
  </div>
</div>
```

- [ ] **Step 3: Add the algorithm advertising overlay motion**

```css
.landing-motion--nearby { min-height:620px; }
.landing-motion--nearby .anchor-place { position:absolute; inset:24% 30%; animation:anchorFocus 5.5s ease-in-out infinite; }
.landing-motion--nearby .nearby-candidates { position:absolute; inset:10%; animation:candidateReveal 5.5s ease-in-out infinite; }
.landing-motion--nearby .nearby-candidates span { position:absolute; left:50%; top:50%; transform:translate(var(--x),var(--y)); }
.landing-motion--nearby .course-tray { position:absolute; left:12%; right:12%; bottom:8%; animation:courseTray 5.5s ease-in-out infinite; }
@keyframes anchorFocus { 0%,10%{opacity:0;transform:scale(.88)} 24%,100%{opacity:1;transform:none} }
@keyframes candidateReveal { 0%,28%{opacity:0;transform:scale(.8)} 44%,74%{opacity:1;transform:none} 88%,100%{opacity:.35;transform:translateY(-8%)} }
@keyframes courseTray { 0%,66%{opacity:0;transform:translateY(14px)} 78%,94%{opacity:1;transform:none} 100%{opacity:0} }
```

The candidate chips are advertising overlays. They must not use tab, button, or settings styling that implies permanent UI.

- [ ] **Step 4: Sync, test, and commit**

Run `npm run sync:home && npm run check:landing-motion && npm run test:landing-motion`.

Expected: PASS.

```bash
git add public/home/index.html public/index.html public/home/landing-motion.css scripts/check-landing-motion.mjs
git commit -m "feat: visualize nearby place recommendations"
```

---

### Task 5: Course Sharing And Navigation Scene

**Files:**
- Modify: `public/home/index.html`
- Modify: `public/home/landing-motion.css`
- Modify: `scripts/check-landing-motion.mjs`
- Modify: `public/index.html` via sync

**Interfaces:**
- Produces: `#motionSceneCourse` with place cards, route line, share card, recipient profile, and navigation handoff.

- [ ] **Step 1: Add a failing markup contract**

```js
for (const marker of [
  'id="motionSceneCourse"',
  'data-motion-layer="route-places"',
  'data-motion-layer="route-line"',
  'data-motion-layer="share-card"',
  'data-motion-layer="recipient"',
  'data-motion-layer="navigation-handoff"',
]) assert(home.includes(marker), `course scene missing ${marker}`);
```

Run `npm run check:landing-motion` and expect FAIL for `motionSceneCourse`.

- [ ] **Step 2: Replace only the third `.journey-phone` visual**

```html
<div id="motionSceneCourse" class="landing-motion landing-motion--course" data-motion-scene data-motion-state="final" role="img" aria-label="장소가 하루 코스로 연결되고 친구에게 공유되어 길찾기로 이어지는 화면">
  <div class="route-places" data-motion-layer="route-places" aria-hidden="true">
    <span><img src="/img/figma-ui/discover.png" alt="" />1</span>
    <span><img src="/img/figma-ui/discover-photo-next.png" alt="" />2</span>
    <span><img src="/img/figma-ui/route-plan-generated.png" alt="" />3</span>
  </div>
  <svg class="route-line" data-motion-layer="route-line" viewBox="0 0 320 420" aria-hidden="true">
    <path d="M72 92 C242 118 80 250 246 326" />
  </svg>
  <div class="share-card" data-motion-layer="share-card" aria-hidden="true"><strong>연남 하루 코스</strong><span>3곳 · 1시간 40분</span></div>
  <div class="recipient" data-motion-layer="recipient" aria-hidden="true"><img src="/app/assets/creator-photos/creator-04.png" alt="" /><span>친구가 코스를 열었어요</span></div>
  <div class="navigation-handoff" data-motion-layer="navigation-handoff" aria-hidden="true">길찾기 시작 ↗</div>
</div>
```

- [ ] **Step 3: Add the course transformation timeline**

```css
.landing-motion--course { min-height:620px; }
.landing-motion--course .route-places { position:absolute; inset:10% 14%; animation:placeOrder 6s ease-in-out infinite; }
.landing-motion--course .route-line { position:absolute; inset:12% 14%; width:72%; height:72%; }
.landing-motion--course .route-line path { fill:none; stroke:#12ca6b; stroke-width:7; stroke-linecap:round; stroke-dasharray:700; animation:drawCourse 6s ease-in-out infinite; }
.landing-motion--course .share-card { position:absolute; right:8%; bottom:16%; animation:shareCourse 6s ease-in-out infinite; }
.landing-motion--course .recipient { position:absolute; left:8%; bottom:8%; animation:openCourse 6s ease-in-out infinite; }
.landing-motion--course .navigation-handoff { position:absolute; right:8%; top:8%; animation:startNavigation 6s ease-in-out infinite; }
@keyframes placeOrder { 0%,12%{opacity:0;transform:scale(.9)} 28%,86%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes drawCourse { 0%,28%{stroke-dashoffset:700} 58%,92%{stroke-dashoffset:0} 100%{stroke-dashoffset:-700} }
@keyframes shareCourse { 0%,54%{opacity:0;transform:translateY(14px) scale(.9)} 68%,88%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes openCourse { 0%,68%{opacity:0;transform:translateX(-12px)} 78%,92%{opacity:1;transform:none} 100%{opacity:0} }
@keyframes startNavigation { 0%,78%{opacity:0;transform:translateX(-8px)} 88%,95%{opacity:1;transform:none} 100%{opacity:0} }
```

- [ ] **Step 4: Sync, test, and commit**

Run `npm run sync:home && npm run check:landing-motion && npm run test:landing-motion`.

Expected: PASS.

```bash
git add public/home/index.html public/index.html public/home/landing-motion.css scripts/check-landing-motion.mjs
git commit -m "feat: animate course sharing and navigation"
```

---

### Task 6: Mobile, Reduced Motion, Failure Fallback, And Performance

**Files:**
- Modify: `public/home/landing-motion.css`
- Modify: `public/home/landing-motion.js`
- Modify: `tests/landing-motion-controller.test.mjs`
- Modify: `scripts/check-landing-motion.mjs`

**Interfaces:**
- Consumes: all four scene containers.
- Produces: stable behavior for 320px+ widths, reduced-motion final states, offscreen pause, and image-failure fallback classes.

- [ ] **Step 1: Add controller tests for state application**

Append to `tests/landing-motion-controller.test.mjs`:

```js
import { applySceneState } from "../public/home/landing-motion.js";

test("applySceneState updates only the scene state attribute", () => {
  const element = { dataset: { motionState: "paused" } };
  applySceneState(element, "playing");
  assert.equal(element.dataset.motionState, "playing");
});
```

Run `npm run test:landing-motion` and expect PASS after Task 1's implementation.

- [ ] **Step 2: Add image error fallback handling**

In `initLandingMotion`, after scene discovery, add:

```js
for (const image of documentRef.querySelectorAll("[data-motion-scene] img")) {
  image.addEventListener("error", () => image.closest("figure, article, div")?.classList.add("is-media-missing"));
}
```

Add:

```css
.landing-motion .is-media-missing {
  background: linear-gradient(145deg,#f3f6f4,#e7eeea);
}
.landing-motion .is-media-missing img { visibility:hidden; }
```

- [ ] **Step 3: Add mobile simplification rules**

Add:

```css
@media (max-width: 900px) {
  .landing-motion--hero { min-height:500px; }
  .motion-ugc-card--two,
  .landing-motion--nearby .nearby-candidates span:nth-child(n+4) { display:none; }
  .landing-motion--discovery,
  .landing-motion--nearby,
  .landing-motion--course { min-height:500px; }
}

@media (max-width: 390px) {
  .landing-motion--hero { min-height:440px; }
  .motion-ugc-card--one { transform:scale(.86); transform-origin:left center; }
  .landing-motion .creator-reaction,
  .landing-motion .share-card { max-width:calc(100% - 32px); }
}
```

Do not use viewport-width font scaling. Use fixed `rem` sizes with mobile overrides where text cannot fit.

- [ ] **Step 4: Add explicit reduced-motion final compositions**

Add these rules so each scene exposes its last meaningful state and transitional layers do not overlap:

```css
@media (prefers-reduced-motion: reduce) {
  .landing-motion--hero .motion-ugc-stack { opacity:.38; transform:scale(.88); }
  .landing-motion--hero .motion-selected-place { opacity:.68; transform:translateX(-14%); }
  .landing-motion--hero .motion-nearby { display:none; }
  .landing-motion--hero .motion-course,
  .landing-motion--hero .motion-share-card,
  .landing-motion--hero .motion-navigation { opacity:1; transform:none; }

  .landing-motion--discovery .discovery-ui,
  .landing-motion--discovery .creator-reaction,
  .landing-motion--discovery .video-indicator,
  .landing-motion--discovery .place-selection,
  .landing-motion--nearby .anchor-place,
  .landing-motion--nearby .nearby-candidates,
  .landing-motion--nearby .course-tray,
  .landing-motion--course .route-places,
  .landing-motion--course .route-line,
  .landing-motion--course .share-card,
  .landing-motion--course .recipient,
  .landing-motion--course .navigation-handoff { opacity:1; transform:none; }

  .landing-motion--course .route-line path { stroke-dashoffset:0; }
}
```

Confirm that the hero shows UGC, the selected place, completed course, share card, and navigation handoff simultaneously without overlap.

- [ ] **Step 5: Extend static checks for protected surfaces and accessibility**

Append to `scripts/check-landing-motion.mjs`:

```js
const motionCss = readFileSync("public/home/landing-motion.css", "utf8");
const motionJs = readFileSync("public/home/landing-motion.js", "utf8");
assert(motionCss.includes("prefers-reduced-motion: reduce"), "missing reduced-motion CSS");
assert(motionCss.includes("@media (max-width: 390px)"), "missing narrow-mobile rules");
assert(motionJs.includes("IntersectionObserver"), "offscreen pause observer missing");
assert(motionJs.includes("is-media-missing"), "media failure fallback missing");
assert(!motionJs.includes("fetch("), "landing motion must not call backend APIs");
assert(!motionJs.includes("/notify"), "landing motion must not control notify navigation");
```

- [ ] **Step 6: Run all automated checks**

```bash
npm run sync:home
npm run test:landing-motion
npm run check:landing-motion
npm run check:mvp-app
npm run typecheck
git diff --check
```

Expected: all commands PASS and no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add public/home/landing-motion.css public/home/landing-motion.js tests/landing-motion-controller.test.mjs scripts/check-landing-motion.mjs
git commit -m "fix: harden landing motion fallbacks"
```

---

### Task 7: Visual QA And Final Product Review

**Files:**
- Modify only if QA finds defects: `public/home/landing-motion.css`, `public/home/index.html`, `public/index.html`
- Do not change: copy, CTA markup, `/notify`, backend files

**Interfaces:**
- Produces: approved desktop and mobile visual behavior with no clipping, blank canvases, or misleading permanent controls.

- [ ] **Step 1: Start the local Vercel preview**

Run:

```bash
npm run dev
```

Expected: Vercel dev server prints a local URL and the homepage loads without console errors.

- [ ] **Step 2: Verify desktop behavior at 1440x900**

Check:

- hero completes the full story in one loop;
- only one dominant action is emphasized at a time;
- all three lower scenes start when scrolled into view;
- offscreen scenes remain paused;
- copy and CTA positions match the pre-change landing page;
- no conceptual overlay resembles a permanent navigation tab or settings control.

- [ ] **Step 3: Verify mobile behavior at 390x844, 360x800, and 320x568**

Check:

- no horizontal scrolling;
- essential cards and route lines remain inside each visual container;
- profile names and overlay labels do not clip;
- simplified mobile scenes preserve the same three-stage story;
- the notification CTA remains visible and clickable.

- [ ] **Step 4: Verify reduced-motion mode**

Emulate `prefers-reduced-motion: reduce` and confirm all four scenes show stable final compositions with no animation.

- [ ] **Step 5: Verify failure fallback**

Temporarily change one local image URL to a nonexistent file in browser developer tools. Confirm the card keeps its dimensions and shows the neutral fallback shell. Revert the temporary browser-only change.

- [ ] **Step 6: Decide whether AI photo replacement is necessary**

Compare current Figma photographs and creator assets as a set. If their tone is coherent, keep them. If they visibly clash, stop and request a separate user approval for a replacement set of place photos/profile images before generating anything. Do not generate AI UI or text.

- [ ] **Step 7: Run final checks after any QA fixes**

```bash
npm run sync:home
npm run test:landing-motion
npm run check:landing-motion
npm run check:mvp-app
npm run typecheck
git diff --check
git status --short
```

Expected: all checks PASS; status contains only intended landing-motion files.

- [ ] **Step 8: Commit QA fixes if any**

```bash
git add public/home/index.html public/index.html public/home/landing-motion.css public/home/landing-motion.js
git commit -m "fix: polish responsive landing motion"
```

Skip this commit if visual QA required no file changes.

---

## Final Delivery Gate

- Push the `codex/*` implementation branch.
- Open a GitHub pull request against `main`.
- Wait for required checks and Vercel preview to pass.
- Review the Vercel preview on desktop and mobile before merge.
- Merge through GitHub only; never run a direct Vercel production deployment command.
