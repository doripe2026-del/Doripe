import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_STATE, PREVIEW_STORAGE_KEY, createPreviewState } from "../../public/app-preview/state.js";

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
  const state = createPreviewState({ storage });

  state.navigate("b2");
  state.setReviewStatus("b2", "complete");

  assert.deepEqual(state.getState().history, ["a1"]);
  assert.equal(state.getState().currentScreenId, "b2");
  assert.equal(state.getState().reviewStatus.b2, "complete");

  const reloaded = createPreviewState({ storage });
  assert.deepEqual(reloaded.getState().history, ["a1"]);
  assert.equal(reloaded.getState().currentScreenId, "b2");
  assert.equal(reloaded.getState().reviewStatus.b2, "complete");
});

test("replace navigation does not add history or change review status", () => {
  const state = createPreviewState({ storage: createMemoryStorage() });

  state.setReviewStatus("a1", "complete");
  state.navigate("a3", { replace: true });

  assert.deepEqual(state.getState().history, []);
  assert.equal(state.getState().currentScreenId, "a3");
  assert.equal(state.getState().reviewStatus.a1, "complete");
  assert.equal(state.getState().reviewStatus.a3, undefined);
});

test("replace persists the complete transition state across reloads", () => {
  const storage = createMemoryStorage();
  const state = createPreviewState({ storage });
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
  const reloaded = createPreviewState({ storage });

  assert.deepEqual(reloaded.getState(), transitionState);
  assert.notEqual(reloaded.getState(), transitionState);
  assert.notEqual(reloaded.getState().history, transitionState.history);
  assert.notEqual(reloaded.getState().selections, transitionState.selections);
});

test("reset restores defaults and clears preview storage", () => {
  const storage = createMemoryStorage();
  const state = createPreviewState({ storage });
  state.navigate("b13");
  state.setReviewStatus("b13", "complete");

  state.reset();

  assert.deepEqual(state.getState(), DEFAULT_STATE);
  assert.equal(storage.getItem(PREVIEW_STORAGE_KEY), null);
});
