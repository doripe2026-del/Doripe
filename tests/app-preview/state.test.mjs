import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_STATE,
  PREVIEW_STORAGE_KEY,
  createPreviewState,
  normalizePreviewState,
  savePlaceId,
  unsavePlaceId
} from "../../public/app-preview/state.js";
import { normalizeDataSnapshot } from "../../public/app-preview/data/contracts.js";
import { createDataCatalog, createUnavailableDataCatalog } from "../../public/app-preview/data/selectors.js";
import { dispatchAction as dispatchTransition } from "../../public/app-preview/transitions.js";

const catalog = {
  isKnownPlaceId: (id) => ["place-a", "place-b", ...Array.from({ length: 12 }, (_, index) => `place-${index + 1}`)].includes(id),
  isKnownCourseId: (id) => ["course-a", "route-1", "route-2"].includes(id)
};
const data = normalizeDataSnapshot({
  places: ["place-a", "place-b", ...Array.from({ length: 12 }, (_, index) => `place-${index + 1}`)]
    .map((id) => ({ id })),
  courses: [
    { id: "course-a", name: "주입된 코스", placeIds: ["place-a", "place-b"] },
    { id: "route-1", name: "연남 저녁 데이트 루트", placeIds: ["place-1", "place-7", "place-8"] },
    { id: "route-2", name: "다른 코스", placeIds: ["place-6", "place-2", "place-12"] }
  ],
  profiles: [{ id: "user-1", handle: "도리", bio: "" }]
});
const dispatchAction = (screenId, actionId, payload = {}) => dispatchTransition(screenId, actionId, {
  ...payload,
  data: payload.data ?? data
});

function createState(options = {}) {
  return createPreviewState({ catalog, ...options });
}

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("state persists current screen, navigation history, and user review status", () => {
  const storage = createMemoryStorage();
  const state = createState({ storage });

  state.navigate("b2");
  state.setReviewStatus("b2", "complete");

  assert.deepEqual(state.getState().history, ["a1"]);
  assert.equal(state.getState().currentScreenId, "b2");
  assert.equal(state.getState().reviewStatus.b2, "complete");

  const reloaded = createState({ storage });
  assert.deepEqual(reloaded.getState().history, ["a1"]);
  assert.equal(reloaded.getState().currentScreenId, "b2");
  assert.equal(reloaded.getState().reviewStatus.b2, "complete");
});

test("state accepts only place IDs supplied by its injected catalog", () => {
  const state = createPreviewState({ storage: createMemoryStorage(), catalog });

  state.replace({ ...state.getState(), savedPlaceIds: ["place-a", "missing"] });

  assert.deepEqual(state.getState().savedPlaceIds, ["place-a"]);
});

test("state can adopt a refreshed catalog after authentication", () => {
  const storage = createMemoryStorage();
  const initialCatalog = {
    isKnownPlaceId: (id) => id === "place-a",
    isKnownCourseId: () => false
  };
  const refreshedCatalog = {
    isKnownPlaceId: (id) => ["place-a", "place-b"].includes(id),
    isKnownCourseId: () => false
  };
  const state = createPreviewState({ storage, catalog: initialCatalog });

  state.setCatalog(refreshedCatalog);
  state.replace({ ...state.getState(), savedPlaceIds: ["place-a", "place-b"] });

  assert.deepEqual(state.getState().savedPlaceIds, ["place-a", "place-b"]);
  assert.deepEqual(JSON.parse(storage.getItem(PREVIEW_STORAGE_KEY)).savedPlaceIds, ["place-a", "place-b"]);
});

test("a failed bootstrap preserves saved places and routes until a real catalog is available", () => {
  const storage = createMemoryStorage();
  storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({
    ...DEFAULT_STATE,
    savedPlaceIds: ["place-offline"],
    savedRoutes: [{ id: "route-offline", name: "오프라인 코스", placeIds: ["place-offline", "place-two"] }],
    routeDraft: { startPlaceId: "place-offline", placeIds: ["place-offline", "place-two"] },
    routePlaceIds: ["place-offline", "place-two"]
  }));

  const state = createPreviewState({ storage, catalog: createUnavailableDataCatalog() });

  assert.deepEqual(state.getState().savedPlaceIds, ["place-offline"]);
  assert.deepEqual(state.getState().savedRoutes[0].placeIds, ["place-offline", "place-two"]);
  assert.deepEqual(state.getState().routeDraft.placeIds, ["place-offline", "place-two"]);
  assert.deepEqual(JSON.parse(storage.getItem(PREVIEW_STORAGE_KEY)).savedPlaceIds, ["place-offline"]);
});

test("normalization marks stale entity selections instead of falling back to unrelated records", () => {
  const entityData = normalizeDataSnapshot({
    places: [{ id: "place-a" }],
    media: [{ id: "media-a" }],
    profiles: [{ id: "profile-a" }],
    contents: [{ id: "content-a" }],
    comments: [{ id: "comment-a" }],
    courses: [{ id: "course-a", placeIds: ["place-a", "place-a"] }]
  });
  const normalized = normalizePreviewState({
    selections: {
      selectedPlaceId: "deleted-place",
      selectedMediaId: "deleted-media",
      selectedUserId: "deleted-profile",
      selectedContentId: "deleted-content",
      selectedCommentId: "deleted-comment"
    }
  }, createDataCatalog(entityData));

  assert.deepEqual(normalized.selections, {
    selectedPlaceId: null,
    selectedMediaId: null,
    selectedUserId: null,
    selectedContentId: null,
    selectedCommentId: null
  });
});

test("replace navigation does not add history or change review status", () => {
  const state = createState({ storage: createMemoryStorage() });

  state.setReviewStatus("a1", "complete");
  state.navigate("a3", { replace: true });

  assert.deepEqual(state.getState().history, []);
  assert.equal(state.getState().currentScreenId, "a3");
  assert.equal(state.getState().reviewStatus.a1, "complete");
  assert.equal(state.getState().reviewStatus.a3, undefined);
});

test("replace persists the complete transition state across reloads", () => {
  const storage = createMemoryStorage();
  const state = createState({ storage });
  const transitionState = {
    ...state.getState(),
    currentScreenId: "b4",
    history: ["b1"],
    selections: {
      selectedPlaceId: "place-1",
      selectedMediaId: "media-2",
      selectedUserId: "user-3",
      selectedRouteId: "route-1"
    }
  };

  state.replace(transitionState);
  const reloaded = createState({ storage });

  assert.deepEqual(reloaded.getState(), transitionState);
  assert.notEqual(reloaded.getState(), transitionState);
  assert.notEqual(reloaded.getState().history, transitionState.history);
  assert.notEqual(reloaded.getState().selections, transitionState.selections);
});

test("canonical saved records normalize references and survive reload", () => {
  const storage = createMemoryStorage();
  const state = createState({ storage });

  state.replace({
    ...state.getState(),
    savedPlaceIds: ["place-1", "missing-place", "place-1"],
    savedRoutes: [{
      id: "saved-route-1",
      name: "연남 산책",
      placeIds: ["place-1", "missing-place", "place-2", "place-1"]
    }],
    routeDraft: {
      startPlaceId: "place-1",
      placeIds: ["place-2", "missing-place"]
    }
  });

  const reloaded = createState({ storage }).getState();

  assert.deepEqual(reloaded.savedPlaceIds, ["place-1"]);
  assert.deepEqual(reloaded.savedRoutes, [{
    id: "saved-route-1",
    name: "연남 산책",
    placeIds: ["place-1", "place-2"]
  }]);
  assert.deepEqual(reloaded.routeDraft, {
    startPlaceId: "place-1",
    placeIds: ["place-1", "place-2"]
  });
  assert.deepEqual(reloaded.routePlaceIds, ["place-1", "place-2"]);
});

test("a route created through transitions persists its start place across reload", () => {
  const storage = createMemoryStorage();
  const initialState = structuredClone(DEFAULT_STATE);
  const selectedStart = dispatchAction("d1", "select-start-place", {
    state: initialState,
    placeId: "place-1"
  });
  const confirmedStart = dispatchAction("d4", "confirm-start-place", { state: selectedStart.state });
  const addedPlace = dispatchAction("d5", "add-place", {
    state: confirmedStart.state,
    placeId: "place-2"
  });
  const confirmedPlaces = dispatchAction("d5", "confirm-route-places", { state: addedPlace.state });
  const namingRoute = dispatchAction("d7", "create-route", { state: confirmedPlaces.state });
  const namedRoute = dispatchAction("d8", "update-route-name", {
    state: namingRoute.state,
    value: "연남 오후 코스"
  });
  const savedRoute = dispatchAction("d8", "save-route", { state: namedRoute.state });

  const state = createState({ storage });
  state.replace(savedRoute.state);
  const reloaded = createState({ storage }).getState();

  assert.deepEqual(reloaded.savedRoutes, [{
    id: "saved-route-1",
    name: "연남 오후 코스",
    placeIds: ["place-1", "place-2"]
  }]);
  assert.deepEqual(reloaded.routeDraft, {
    startPlaceId: "place-1",
    placeIds: ["place-1", "place-2"]
  });
});

test("saving and unsaving a place are idempotent", () => {
  const savedOnce = savePlaceId(DEFAULT_STATE, "place-1", catalog);
  const savedTwice = savePlaceId(savedOnce, "place-1", catalog);
  const unsavedOnce = unsavePlaceId(savedTwice, "place-1", catalog);
  const unsavedTwice = unsavePlaceId(unsavedOnce, "place-1", catalog);

  assert.deepEqual(savedTwice.savedPlaceIds, ["place-1"]);
  assert.deepEqual(unsavedTwice.savedPlaceIds, []);
});

test("reset restores defaults and clears preview storage", () => {
  const storage = createMemoryStorage();
  const state = createState({ storage });
  state.navigate("b13");
  state.setReviewStatus("b13", "complete");

  state.reset();

  assert.deepEqual(state.getState(), DEFAULT_STATE);
  assert.equal(storage.getItem(PREVIEW_STORAGE_KEY), null);
});

test("legacy persisted state is recursively migrated without password or token-like fields", () => {
  const storage = createMemoryStorage();
  storage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify({
    currentScreenId: "e3",
    form: {
      email: "dori@doripe.kr",
      password: "plain-password",
      nested: [{ currentPassword: "old-password" }, { profile: { nickname: "도리" } }]
    },
    selections: {
      auth: {
        access_token: "legacy-access",
        refreshToken: "legacy-refresh",
        deeper: {
          access: "short-access",
          refresh: "short-refresh",
          token: "plain-token",
          AUTH_token: "auth-token",
          ID_TOKEN: "id-token",
          "provider-token": "provider-token",
          jwt: "legacy-jwt",
          authorization: "legacy-authorization",
          sessionToken: "legacy-session-token",
          bearer_token: "legacy-bearer-token",
          newPassword: "new-password",
          confirmPassword: "confirm-password",
          tokenCount: 7
        }
      }
    },
    history: ["e1", { snapshot: { accessTokenValue: "history-access", refresh_token_value: "history-refresh" } }]
  }));

  const state = createState({ storage }).getState();
  const persisted = storage.getItem(PREVIEW_STORAGE_KEY);

  assert.equal(state.form.email, "dori@doripe.kr");
  assert.equal(state.form.nested[1].profile.nickname, "도리");
  assert.equal(state.selections.auth.deeper.tokenCount, 7);
  assert.doesNotMatch(JSON.stringify(state), /plain-password|old-password|new-password|confirm-password|legacy-access|legacy-refresh|short-access|short-refresh|plain-token|auth-token|id-token|provider-token|legacy-jwt|legacy-authorization|legacy-session-token|legacy-bearer-token|history-access|history-refresh/);
  assert.doesNotMatch(persisted, /"(?:password|token|auth.?token|id.?token|provider.?token|access.?token|refresh.?token)"/i);
});

test("normalization strips sensitive keys recursively before history snapshots can receive them", () => {
  const normalized = normalizePreviewState({
    currentScreenId: "a3",
    form: {
      nickname: "도리",
      password: "secret",
      nested: { confirmPassword: "secret", safe: "keep" }
    },
    history: [{ form: { newPassword: "secret" } }],
    selections: [{ access_token: "token", refreshTokenBackup: "refresh", placeId: "place-1" }]
  });

  assert.equal(normalized.form.nickname, "도리");
  assert.equal(normalized.form.nested.safe, "keep");
  assert.equal(normalized.selections[0].placeId, "place-1");
  assert.doesNotMatch(JSON.stringify(normalized), /secret|token|refresh/i);
});
