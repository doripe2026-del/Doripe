# App Preview Data Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the current Doripe app-preview UI and interactions while removing every direct fixture dependency from screens, state, transitions, and main runtime.

**Architecture:** A synchronous screen renderer receives a normalized data snapshot loaded by an asynchronous app data store. A fixture repository supplies that snapshot now; a later HTTP repository will supply the same contract without changing screen code.

**Tech Stack:** Browser ES modules, Node.js test runner, Playwright, existing semantic DOM renderers, existing fixture assets.

## Global Constraints

- Work only in `/Users/cityboy/.config/superpowers/worktrees/Doripe/codex-governance-ci` on the existing `codex/figma-web-prototype-design` branch.
- Do not run production Vercel commands or apply production Supabase migrations.
- Do not modify Doripe Brain in this plan.
- Keep the approved Figma-derived geometry, copy, icons, and motion unchanged.
- Only repository modules may import `public/app-preview/fixtures.js`.
- The default preview mode remains deterministic fixture mode.
- Every task uses tests first and commits only its own files.

---

## File Structure

### New files

- `public/app-preview/data/contracts.js`: normalized snapshot shape and repository contract validation.
- `public/app-preview/data/selectors.js`: ID-based lookups used by screens, state, and transitions.
- `public/app-preview/data/fixture-repository.js`: the only app-preview runtime module that imports fixture collections.
- `public/app-preview/data/store.js`: bootstrap lifecycle and immutable data snapshot ownership.
- `tests/app-preview/data-contract.test.mjs`: snapshot, repository, and selector unit tests.
- `tests/app-preview/data-boundary.test.mjs`: static rule that rejects direct fixture imports outside the repository.

### Modified files

- `public/app-preview/api-adapter.js`: compatibility export that delegates to the fixture repository.
- `public/app-preview/main.js`: load data once and pass it into renderers, state, transitions, and shared-link validation.
- `public/app-preview/screen-registry.js`: renderer contract becomes `(state, data)`.
- `public/app-preview/state.js`: validate persisted IDs against an injected catalog.
- `public/app-preview/transitions.js`: resolve places, profiles, and courses from the injected data snapshot.
- `public/app-preview/screens/discover.js`: render feed, detail, comments, related places, and profiles from `data`.
- `public/app-preview/screens/saved.js`: render saved places and courses from `data`.
- `public/app-preview/screens/routes.js`: render course candidates and details from `data`.
- `public/app-preview/screens/settings.js`: render profile and media from `data`.
- Existing `tests/app-preview/*.test.mjs` and `*.spec.mjs`: pass the snapshot where a renderer or transition now requires it.

---

### Task 1: Define the normalized data contract and selectors

**Files:**
- Create: `public/app-preview/data/contracts.js`
- Create: `public/app-preview/data/selectors.js`
- Create: `tests/app-preview/data-contract.test.mjs`

**Interfaces:**
- Produces: `createEmptyDataSnapshot()`, `normalizeDataSnapshot(value)`, `assertRepositoryContract(repository)`.
- Produces: `byId(items, id)`, `placeById(data, id)`, `mediaById(data, id)`, `profileById(data, id)`, `tagById(data, id)`, `courseById(data, id)`, `contentById(data, id)`, `mediaForPlace(data, place)`, `tagsFor(data, item)`, `commentsForContent(data, contentId)`, `createDataCatalog(data)`.

- [x] **Step 1: Write the failing contract and selector tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRepositoryContract,
  createEmptyDataSnapshot,
  normalizeDataSnapshot
} from "../../public/app-preview/data/contracts.js";
import { createDataCatalog, mediaForPlace, placeById } from "../../public/app-preview/data/selectors.js";

test("normalized snapshots own cloned collections", () => {
  const places = [{ id: "place-1", mediaIds: ["media-1"], tagIds: [] }];
  const snapshot = normalizeDataSnapshot({ places, media: [{ id: "media-1" }] });
  assert.notEqual(snapshot.places, places);
  assert.deepEqual(snapshot.places, places);
  assert.deepEqual(createEmptyDataSnapshot().contents, []);
});

test("selectors resolve relationships by ID", () => {
  const data = normalizeDataSnapshot({
    places: [{ id: "place-1", mediaIds: ["media-1"], tagIds: [] }],
    media: [{ id: "media-1", placeId: "place-1" }]
  });
  assert.equal(placeById(data, "place-1").id, "place-1");
  assert.deepEqual(mediaForPlace(data, data.places[0]).map((item) => item.id), ["media-1"]);
  assert.equal(createDataCatalog(data).isKnownPlaceId("missing"), false);
});

test("repository contract rejects missing methods", () => {
  assert.throws(() => assertRepositoryContract({ getBootstrap() {} }), /getFeed/);
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/app-preview/data-contract.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `data/contracts.js`.

- [x] **Step 3: Implement the snapshot contract**

```js
const COLLECTION_KEYS = Object.freeze([
  "places", "media", "profiles", "tags", "comments", "courses", "contents"
]);

const REPOSITORY_METHODS = Object.freeze([
  "getBootstrap", "getFeed", "getContentDetail", "getPlaceDetail",
  "getCourseDetail", "getPublicProfile", "getSavedPlaces", "getSavedCourses",
  "savePlace", "unsavePlace", "saveCourse", "unsaveCourse",
  "followProfile", "unfollowProfile", "likeContent", "unlikeContent",
  "getComments", "createComment", "createCourse", "updateCourse"
]);

export function createEmptyDataSnapshot() {
  return Object.freeze(Object.fromEntries(COLLECTION_KEYS.map((key) => [key, Object.freeze([])])));
}

export function normalizeDataSnapshot(value = {}) {
  return Object.freeze(Object.fromEntries(COLLECTION_KEYS.map((key) => [
    key,
    Object.freeze(structuredClone(Array.isArray(value[key]) ? value[key] : []))
  ])));
}

export function assertRepositoryContract(repository) {
  for (const method of REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== "function") {
      throw new TypeError(`Repository is missing ${method}()`);
    }
  }
  return repository;
}
```

- [x] **Step 4: Implement ID-based selectors**

```js
export const byId = (items, id) => items.find((item) => item.id === id) || null;
export const placeById = (data, id) => byId(data.places, id);
export const mediaById = (data, id) => byId(data.media, id);
export const profileById = (data, id) => byId(data.profiles, id);
export const tagById = (data, id) => byId(data.tags, id);
export const courseById = (data, id) => byId(data.courses, id);
export const contentById = (data, id) => byId(data.contents, id);

export function mediaForPlace(data, place) {
  return (place?.mediaIds || []).map((id) => mediaById(data, id)).filter(Boolean);
}

export function tagsFor(data, item) {
  return (item?.tagIds || []).map((id) => tagById(data, id)).filter(Boolean);
}

export function commentsForContent(data, contentId) {
  return data.comments.filter((comment) => comment.contentId === contentId);
}

export function createDataCatalog(data) {
  const placeIds = new Set(data.places.map((item) => item.id));
  const courseIds = new Set(data.courses.map((item) => item.id));
  return Object.freeze({
    isKnownPlaceId: (id) => placeIds.has(id),
    isKnownCourseId: (id) => courseIds.has(id)
  });
}
```

- [x] **Step 5: Run the focused test and commit**

Run: `node --test tests/app-preview/data-contract.test.mjs`

Expected: 3 tests PASS.

```bash
git add public/app-preview/data/contracts.js public/app-preview/data/selectors.js tests/app-preview/data-contract.test.mjs
git commit -m "feat: define app preview data contract"
```

### Task 2: Build the fixture repository without changing visible data

**Files:**
- Create: `public/app-preview/data/fixture-repository.js`
- Modify: `public/app-preview/api-adapter.js`
- Modify: `tests/app-preview/fixtures.test.mjs`

**Interfaces:**
- Consumes: `normalizeDataSnapshot(value)`, `assertRepositoryContract(repository)`.
- Produces: `createFixtureRepository()`, `createFailingFixtureRepository()` and compatibility aliases from `api-adapter.js`.

- [x] **Step 1: Replace adapter tests with full contract expectations**

```js
const repository = createFixtureRepository();
const bootstrap = await repository.getBootstrap();
assert.equal(repository.mode, "fixture");
assert.deepEqual(bootstrap.places, PLACES);
assert.deepEqual(bootstrap.media, MEDIA);
assert.deepEqual(bootstrap.profiles, USERS);
assert.deepEqual(bootstrap.tags, TAGS);
assert.deepEqual(bootstrap.courses, ROUTES);
assert.ok(bootstrap.contents.some((item) => item.type === "place"));
assert.ok(bootstrap.contents.some((item) => item.type === "course"));
assert.deepEqual(await repository.getFeed(), bootstrap.contents);
```

- [x] **Step 2: Run the fixture test and verify it fails**

Run: `node --test tests/app-preview/fixtures.test.mjs`

Expected: FAIL because `createFixtureRepository` is not exported.

- [x] **Step 3: Implement fixture-to-domain mapping and all repository methods**

The repository must import all fixture constants, create one place content per place and one course content per course, convert fixture comments from `placeId` to `contentId`, return structured clones from reads, and return deterministic ID-based mutation results. Unknown IDs throw an error with `code = "FIXTURE_NOT_FOUND"`.

```js
const placeContentId = (placeId) => `content-${placeId}`;

function snapshotFromFixtures() {
  const contents = [
    ...PLACES.map((place) => ({
      id: placeContentId(place.id),
      type: "place",
      authorProfileId: place.userId,
      placeId: place.id,
      courseId: null,
      mediaIds: [...place.mediaIds],
      tagIds: [...place.tagIds]
    })),
    ...ROUTES.map((course) => ({
      id: `content-${course.id}`,
      type: "course",
      authorProfileId: course.userId,
      placeId: null,
      courseId: course.id,
      mediaIds: course.placeIds
        .map((placeId) => PLACES.find((place) => place.id === placeId)?.mediaIds?.[0])
        .filter(Boolean),
      tagIds: [...course.tagIds]
    }))
  ];
  return normalizeDataSnapshot({
    places: PLACES,
    media: MEDIA,
    profiles: USERS,
    tags: TAGS,
    courses: ROUTES,
    contents,
    comments: COMMENTS.map((comment) => ({
      ...comment,
      contentId: placeContentId(comment.placeId)
    }))
  });
}
```

Use these exact repository behaviors:

```js
const clone = (value) => structuredClone(value);
const findOrThrow = (items, id, resource) => {
  const item = items.find((candidate) => candidate.id === id);
  if (item) return item;
  throw Object.assign(new Error(`Unknown fixture ${resource}: ${id}`), {
    code: "FIXTURE_NOT_FOUND",
    resource,
    resourceId: id
  });
};

export function createFixtureRepository() {
  const data = snapshotFromFixtures();
  const repository = {
    mode: "fixture",
    async getBootstrap() { return clone(data); },
    async getFeed() { return clone(data.contents); },
    async getContentDetail(id) { return clone(findOrThrow(data.contents, id, "content")); },
    async getPlaceDetail(id) { return clone(findOrThrow(data.places, id, "place")); },
    async getCourseDetail(id) { return clone(findOrThrow(data.courses, id, "course")); },
    async getPublicProfile(id) { return clone(findOrThrow(data.profiles, id, "profile")); },
    async getSavedPlaces({ ids = [] } = {}) { return clone(data.places.filter((item) => ids.includes(item.id))); },
    async getSavedCourses({ ids = [] } = {}) { return clone(data.courses.filter((item) => ids.includes(item.id))); },
    async savePlace(placeId) { findOrThrow(data.places, placeId, "place"); return { placeId, saved: true }; },
    async unsavePlace(placeId) { findOrThrow(data.places, placeId, "place"); return { placeId, saved: false }; },
    async saveCourse(courseId) { findOrThrow(data.courses, courseId, "course"); return { courseId, saved: true }; },
    async unsaveCourse(courseId) { findOrThrow(data.courses, courseId, "course"); return { courseId, saved: false }; },
    async followProfile(profileId) { findOrThrow(data.profiles, profileId, "profile"); return { profileId, followed: true }; },
    async unfollowProfile(profileId) { findOrThrow(data.profiles, profileId, "profile"); return { profileId, followed: false }; },
    async likeContent(contentId) { findOrThrow(data.contents, contentId, "content"); return { contentId, liked: true }; },
    async unlikeContent(contentId) { findOrThrow(data.contents, contentId, "content"); return { contentId, liked: false }; },
    async getComments(contentId) { findOrThrow(data.contents, contentId, "content"); return clone(data.comments.filter((item) => item.contentId === contentId)); },
    async createComment(contentId, body) { findOrThrow(data.contents, contentId, "content"); return { id: "comment-local", contentId, body }; },
    async createCourse(input) { return { id: "saved-route-1", ...clone(input) }; },
    async updateCourse(courseId, input) { return { id: courseId, ...clone(input) }; }
  };
  return Object.freeze(assertRepositoryContract(repository));
}
```

`api-adapter.js` becomes a compatibility export only:

```js
export {
  createFixtureRepository as createFixtureAdapter,
  createFailingFixtureRepository as createFailingFixtureAdapter,
  getRepository as getAdapter
} from "./data/fixture-repository.js";
```

- [x] **Step 4: Run fixture and contract tests and commit**

Run: `node --test tests/app-preview/data-contract.test.mjs tests/app-preview/fixtures.test.mjs`

Expected: all tests PASS.

```bash
git add public/app-preview/data/fixture-repository.js public/app-preview/api-adapter.js tests/app-preview/fixtures.test.mjs
git commit -m "feat: add fixture data repository"
```

### Task 3: Add the data store and bootstrap lifecycle

**Files:**
- Create: `public/app-preview/data/store.js`
- Modify: `tests/app-preview/data-contract.test.mjs`
- Modify: `public/app-preview/main.js`
- Modify: `public/app-preview/screen-registry.js`

**Interfaces:**
- Consumes: a repository implementing `getBootstrap()`.
- Produces: `createAppDataStore({ repository })` with `load()`, `getState()`, and `getSnapshot()`.
- Changes renderer interface from `(state)` to `(state, data)`.

- [x] **Step 1: Write failing store lifecycle tests**

```js
test("data store exposes loading, ready, and retryable error states", async () => {
  const good = createAppDataStore({ repository: { getBootstrap: async () => ({ places: [{ id: "place-1" }] }) } });
  assert.equal(good.getState().status, "idle");
  await good.load();
  assert.equal(good.getState().status, "ready");
  assert.equal(good.getSnapshot().places[0].id, "place-1");

  const bad = createAppDataStore({ repository: { getBootstrap: async () => { throw new Error("offline"); } } });
  await assert.rejects(bad.load(), /offline/);
  assert.equal(bad.getState().status, "error");
  assert.equal(bad.getState().error.code, "DATA_BOOTSTRAP_FAILED");
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `node --test tests/app-preview/data-contract.test.mjs`

Expected: FAIL with missing `data/store.js`.

- [x] **Step 3: Implement the store**

```js
import { createEmptyDataSnapshot, normalizeDataSnapshot } from "./contracts.js";

export function createAppDataStore({ repository }) {
  let current = Object.freeze({ status: "idle", data: createEmptyDataSnapshot(), error: null });
  return Object.freeze({
    getState: () => current,
    getSnapshot: () => current.data,
    async load() {
      current = Object.freeze({ ...current, status: "loading", error: null });
      try {
        const data = normalizeDataSnapshot(await repository.getBootstrap());
        current = Object.freeze({ status: "ready", data, error: null });
        return data;
      } catch (cause) {
        const error = Object.assign(new Error("App data bootstrap failed", { cause }), {
          code: "DATA_BOOTSTRAP_FAILED"
        });
        current = Object.freeze({ ...current, status: "error", error });
        throw error;
      }
    }
  });
}
```

- [x] **Step 4: Wire bootstrap into main and renderer context**

`main.js` creates the fixture repository and store before state, awaits `load()`, and passes `dataStore.getSnapshot()` to state creation, renderers, transitions, and shared-link lookup. `screen-registry.js` preserves renderer functions but documents and forwards the second `data` argument.

```js
const repository = getAdapter("fixture");
const dataStore = createAppDataStore({ repository });
await dataStore.load();
const dataSnapshot = dataStore.getSnapshot();
const dataCatalog = createDataCatalog(dataSnapshot);
const state = createPreviewState({ catalog: dataCatalog });

// render path
const renderedScreen = screen.render(interactionState, dataSnapshot);

// action path
const payload = { state: interactionState, data: dataSnapshot };
```

- [x] **Step 5: Run unit and smoke tests and commit**

Run: `npm run test:app-preview:unit && npm run check:app-preview`

Expected: both commands exit 0.

```bash
git add public/app-preview/data/store.js public/app-preview/main.js public/app-preview/screen-registry.js tests/app-preview/data-contract.test.mjs
git commit -m "feat: bootstrap app preview data store"
```

### Task 4: Remove fixture knowledge from state, transitions, and shared links

**Files:**
- Modify: `public/app-preview/state.js`
- Modify: `public/app-preview/transitions.js`
- Modify: `public/app-preview/main.js`
- Modify: `tests/app-preview/state.test.mjs`
- Modify: `tests/app-preview/transitions.test.mjs`

**Interfaces:**
- Consumes: `catalog.isKnownPlaceId(id)`, `catalog.isKnownCourseId(id)`, and `payload.data`.
- Produces: persisted state normalization and transitions with no fixture import.

- [x] **Step 1: Add failing tests for injected catalog validation**

```js
const catalog = {
  isKnownPlaceId: (id) => ["place-a", "place-b"].includes(id),
  isKnownCourseId: (id) => id === "course-a"
};
const state = createPreviewState({ storage: createMemoryStorage(), catalog });
state.replace({ ...state.getState(), savedPlaceIds: ["place-a", "missing"] });
assert.deepEqual(state.getState().savedPlaceIds, ["place-a"]);
```

Add a transition test that supplies a minimal normalized `data` snapshot and confirms course selection resolves by ID without importing fixture constants.

- [x] **Step 2: Run focused tests and verify they fail**

Run: `node --test tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs`

Expected: FAIL because `createPreviewState` does not accept `catalog` and transitions still use fixtures.

- [x] **Step 3: Inject the catalog into all state normalization helpers**

Use a deny-by-default catalog when none is provided:

```js
const EMPTY_CATALOG = Object.freeze({
  isKnownPlaceId: () => false,
  isKnownCourseId: () => false
});

export function createPreviewState({
  storage = globalThis.localStorage,
  catalog = EMPTY_CATALOG
} = {}) {
  // load, normalize, replace, and persist all close over catalog
}
```

`normalizePlaceIds`, `normalizeSavedRoutes`, `normalizeRouteDraft`, `normalizePreviewState`, `savePlaceId`, and `unsavePlaceId` receive or close over the same catalog. No function imports `fixtures.js`.

- [x] **Step 4: Replace transition and shared-link fixture lookups with selectors**

Use `payload.data` with `placeById`, `courseById`, and `profileById`. Shared-link validation uses `dataCatalog`; a fixture course is now simply a course whose ID exists in the loaded snapshot. Saved local courses remain valid when their IDs exist in persisted state.

- [x] **Step 5: Run tests, confirm no fixture import, and commit**

Run:

```bash
node --test tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs
! rg -n 'from ["'"'].*fixtures' public/app-preview/state.js public/app-preview/transitions.js public/app-preview/main.js
```

Expected: tests PASS and `rg` returns no matches.

```bash
git add public/app-preview/state.js public/app-preview/transitions.js public/app-preview/main.js tests/app-preview/state.test.mjs tests/app-preview/transitions.test.mjs
git commit -m "refactor: inject app data into preview state"
```

### Task 5: Migrate every discovery screen to the data snapshot

**Files:**
- Modify: `public/app-preview/screens/discover.js`
- Modify: `tests/app-preview/discover.spec.mjs`
- Modify: `tests/app-preview/flow-b-evidence.test.mjs`

**Interfaces:**
- Consumes: renderer `(state, data)` and selectors from `data/selectors.js`.
- Produces: B1–B13 with no fixture import and unchanged DOM geometry.

- [x] **Step 1: Add a failing runtime test using a reordered snapshot**

Create a snapshot whose first place and profile differ from fixture ordering, render B4 and B12, and assert the selected IDs control the title and profile. This proves renderers no longer use `PLACES[0]` or `USERS[0]` fallback by array position.

```js
const data = normalizeDataSnapshot({
  places: [{ id: "place-b", name: "두 번째 장소", mediaIds: [], tagIds: [] }],
  profiles: [{ id: "profile-b", handle: "두번째" }]
});
const b4 = DISCOVER_RENDERERS.b4({ selections: { selectedPlaceId: "place-b" } }, data);
assert.match(b4.textContent, /두 번째 장소/);
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/app-preview/flow-b-evidence.test.mjs`

Expected: FAIL because discovery renderers accept only state and use fixture globals.

- [x] **Step 3: Replace discovery globals with context helpers**

Change each helper to receive data explicitly:

```js
const selectedPlace = (state, data) => placeById(data, state?.selections?.selectedPlaceId) || data.places[0] || null;
const selectedProfile = (state, data) => profileById(data, state?.selections?.selectedUserId) || data.profiles[0] || null;
const mediaForPlace = (data, place) => selectMediaForPlace(data, place);
const tagsForPlace = (data, place) => tagsFor(data, place);
```

Update B1–B13 so feed entries come from `data.contents`, place detail uses `data.places`, comments use `data.comments`, related places use `data.places`, and profile grids use `data.media`. `renderHours` receives the selected place and uses its hours, falling back to an empty-state sentence rather than a fabricated schedule.

- [x] **Step 4: Run Flow B semantic, interaction, and visual tests**

Run:

```bash
node --test tests/app-preview/flow-b-evidence.test.mjs
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/discover.spec.mjs
```

Expected: all Flow B tests PASS and approved visual thresholds remain unchanged.

- [x] **Step 5: Commit discovery migration**

```bash
git add public/app-preview/screens/discover.js tests/app-preview/discover.spec.mjs tests/app-preview/flow-b-evidence.test.mjs
git commit -m "refactor: render discovery from app data"
```

### Task 6: Migrate saved, course, and settings screens

**Files:**
- Modify: `public/app-preview/screens/saved.js`
- Modify: `public/app-preview/screens/routes.js`
- Modify: `public/app-preview/screens/settings.js`
- Modify: `tests/app-preview/saved.spec.mjs`
- Modify: `tests/app-preview/routes.spec.mjs`
- Modify: `tests/app-preview/settings.spec.mjs`

**Interfaces:**
- Consumes: renderer `(state, data)` and shared selectors.
- Produces: C, D, and E flows with no fixture import.

- [x] **Step 1: Add failing tests for ID-based rendering**

For each flow, render with a snapshot containing unique names and IDs, then assert those values appear. Add an empty collection case so screens show their designed empty state instead of falling back to the first fixture.

```js
await expect(gotoScreen(page, "c1")).toContainText("저장한 장소가 아직 없어요");
await expect(gotoScreen(page, "d1")).toContainText("저장한 장소가 필요해요");
```

- [x] **Step 2: Run the three focused specs and verify failure**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/saved.spec.mjs tests/app-preview/routes.spec.mjs tests/app-preview/settings.spec.mjs
```

Expected: at least one failure per flow because renderers still import fixture collections.

- [x] **Step 3: Migrate C flow**

Pass `data` into every renderer and helper. Saved place IDs resolve through `placeById(data, id)`, saved course IDs resolve through `courseById(data, id)` or persisted local courses, tags resolve through `tagsFor(data, item)`, and media resolve through `mediaForPlace(data, place)`.

```js
const courseFor = (state, data) => byId(state?.savedRoutes || [], state?.selections?.selectedRouteId)
  || courseById(data, state?.selections?.selectedRouteId)
  || data.courses[0]
  || null;
const placeFor = (state, data) => placeById(data, state?.selections?.selectedPlaceId)
  || data.places[0]
  || null;
const savedPlaces = (state, data) => (state?.savedPlaceIds || [])
  .map((id) => placeById(data, id))
  .filter(Boolean);
```

- [x] **Step 4: Migrate D flow**

Course candidates use `data.places`; author and media use shared selectors; default course IDs come from the selected course or state draft rather than `ROUTES[0]`. An empty saved-place collection produces the designed D1 empty state.

```js
const selectedCourse = (state, data) => courseById(data, state?.selections?.selectedRouteId)
  || byId(state?.savedRoutes || [], state?.selections?.selectedRouteId)
  || null;
const selectedCoursePlaceIds = (state, data) => selectedCourse(state, data)?.placeIds
  || state?.routeDraft?.placeIds
  || [];
const preferredSavedMedia = (place, state, data) => {
  const hidden = new Set(state?.hiddenMediaIds || []);
  return mediaForPlace(data, place).find((item) => !hidden.has(item.id)) || null;
};
```

- [x] **Step 5: Migrate E flow**

The current authenticated profile is selected by `state.profile.id` or `state.selections.selectedUserId`; its media and courses are filtered by profile ID from `data`. Empty profile media renders an empty gallery state.

```js
const currentProfile = (state, data) => profileById(
  data,
  state?.profile?.id || state?.selections?.selectedUserId
) || data.profiles[0] || null;
const profileMedia = (profile, data) => data.media.filter((item) => item.userId === profile?.id);
const profileCourses = (profile, data) => data.courses.filter((item) => item.userId === profile?.id);
```

- [x] **Step 6: Run flow tests and commit**

Run:

```bash
npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/saved.spec.mjs tests/app-preview/routes.spec.mjs tests/app-preview/settings.spec.mjs
```

Expected: all selected tests PASS.

```bash
git add public/app-preview/screens/saved.js public/app-preview/screens/routes.js public/app-preview/screens/settings.js tests/app-preview/saved.spec.mjs tests/app-preview/routes.spec.mjs tests/app-preview/settings.spec.mjs
git commit -m "refactor: render saved course and settings from app data"
```

### Task 7: Enforce the fixture boundary and run the full regression suite

**Files:**
- Create: `tests/app-preview/data-boundary.test.mjs`
- Modify: `tests/app-preview/user-journey.spec.mjs`
- Modify: `docs/superpowers/plans/2026-07-14-app-preview-data-isolation.md`

**Interfaces:**
- Consumes: all Phase 1 changes.
- Produces: a permanent architectural guard and verified fixture-mode preview.

- [x] **Step 1: Write the boundary test**

```js
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("only fixture repository imports fixture collections", async () => {
  const root = new URL("../../public/app-preview/", import.meta.url);
  const files = await readdir(root, { recursive: true });
  const offenders = [];
  for (const file of files.filter((name) => name.endsWith(".js"))) {
    const source = await readFile(new URL(file, root), "utf8");
    if (/from\s+["'][^"']*fixtures\.js["']/u.test(source)
      && file !== "data/fixture-repository.js") offenders.push(file);
  }
  assert.deepEqual(offenders, []);
});
```

- [x] **Step 2: Run the boundary test and fix every reported import**

Run: `node --test tests/app-preview/data-boundary.test.mjs`

Expected: PASS with an empty offender list.

- [x] **Step 3: Verify the complete user journey in fixture mode**

The E2E journey must cover onboarding fixture entry, following feed, discovery feed, place detail, save, saved list, course creation, course save, profile, comment, and follow toggle. It must reload after save and course creation to prove persisted IDs survive catalog-based normalization.

Run: `npx playwright test -c playwright.app-preview.config.mjs tests/app-preview/user-journey.spec.mjs`

Expected: all user journey tests PASS.

- [x] **Step 4: Run all Phase 1 verification**

Run:

```bash
npm run test:app-preview:unit
npm run test:app-preview:e2e
npm run check:app-preview
git diff --check
```

Expected: every command exits 0.

- [x] **Step 5: Record completion and commit**

Mark every completed checkbox in this plan and commit the guard and test updates.

```bash
git add tests/app-preview/data-boundary.test.mjs tests/app-preview/user-journey.spec.mjs docs/superpowers/plans/2026-07-14-app-preview-data-isolation.md
git commit -m "test: enforce app preview data boundary"
```

## Follow-on Plans

After this plan passes, create separate implementation plans in this order:

1. Backend branch contract corrections and clean migration/RLS verification.
2. Staging Supabase seed and HTTP API repository for read operations.
3. Save, course, follow, content-like, and comment write operations with rollback.
4. Signed media URL refresh, full loading/error states, and production-readiness evidence.
