import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getScreen, listScreens } from "../../public/app-preview/screen-registry.js";
import {
  ACTIONS_BY_SCREEN,
  TRANSITIONS,
  dispatchAction
} from "../../public/app-preview/transitions.js";

const actionPayload = Object.freeze({
  checked: true,
  commentId: "comment-1",
  id: "place-1",
  mediaId: "media-1",
  placeId: "place-1",
  routeId: "route-1",
  setting: "all-notifications",
  type: "place",
  userId: "user-1",
  value: "fixture-value"
});

test("every registry action has one explicit transition handler", () => {
  const screens = listScreens();

  assert.deepEqual(Object.keys(ACTIONS_BY_SCREEN), screens.map((screen) => screen.id));
  assert.deepEqual(Object.keys(TRANSITIONS), screens.map((screen) => screen.id));

  for (const screen of screens) {
    assert.deepEqual(screen.actions, ACTIONS_BY_SCREEN[screen.id]);

    for (const actionId of screen.actions) {
      assert.match(actionId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.equal(
        typeof TRANSITIONS[screen.id][actionId],
        "function",
        `missing transition for ${screen.id}/${actionId}`
      );
    }

    assert.deepEqual(Object.keys(TRANSITIONS[screen.id]), screen.actions);
  }
});

test("every transition destination is a valid registry screen", () => {
  for (const screen of listScreens()) {
    for (const actionId of screen.actions) {
      const result = dispatchAction(screen.id, actionId, actionPayload);

      assert.ok(result.state && typeof result.state === "object");
      assert.ok([undefined, "share", "copy", "none"].includes(result.effect));
      if (result.nextScreenId) {
        assert.ok(getScreen(result.nextScreenId), `${screen.id}/${actionId} -> ${result.nextScreenId}`);
      }
    }
  }
});

test("save, follow, and share actions implement the brief contract", () => {
  assert.equal(
    dispatchAction("b1", "save-place", { placeId: "place-1" }).state.savedPlaceIds[0],
    "place-1"
  );
  assert.equal(
    dispatchAction("e1", "toggle-follow", { userId: "user-1" }).state.followedUserIds[0],
    "user-1"
  );
  assert.equal(
    dispatchAction("b4", "open-share", { type: "place", id: "place-1" }).effect,
    "share"
  );
});

test("state changes are immutable and same-screen selections do not navigate", () => {
  const state = {
    currentScreenId: "b1",
    history: [],
    reviewStatus: { b1: "complete" },
    form: {},
    selections: {},
    savedPlaceIds: ["place-2"],
    likedMediaIds: [],
    followedUserIds: [],
    routePlaceIds: [],
    overlays: [],
    toast: null
  };

  const saved = dispatchAction("b1", "save-place", { state, placeId: "place-1" });
  const selected = dispatchAction("a15", "select-gender", { state, value: "female" });

  assert.notEqual(saved.state, state);
  assert.notEqual(saved.state.savedPlaceIds, state.savedPlaceIds);
  assert.deepEqual(state.savedPlaceIds, ["place-2"]);
  assert.deepEqual(saved.state.savedPlaceIds, ["place-2", "place-1"]);
  assert.equal(selected.nextScreenId, undefined);
  assert.equal(selected.state.selections.gender, "female");
  assert.deepEqual(state.selections, {});
  assert.equal(saved.state.reviewStatus.b1, "complete");
});

test("unknown screens and actions return an error toast instead of throwing", () => {
  assert.equal(dispatchAction("b1", "unknown-action").state.toast.kind, "error");
  assert.equal(dispatchAction("unknown-screen", "open-place").state.toast.kind, "error");
});

test("main owns delegated action events and keeps sharing as a DOM effect", async () => {
  const source = await readFile(new URL("../../public/app-preview/main.js", import.meta.url), "utf8");

  assert.match(source, /dispatchAction\(/);
  assert.equal(source.match(/addEventListener\("click"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("input"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("keydown"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("pointerdown"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("pointerup"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("pointercancel"/g)?.length, 1);
  assert.match(source, /navigator\.share\(/);
  assert.match(source, /navigator\.clipboard\.writeText\(/);
  assert.match(source, /data-action/);
  assert.match(source, /data-id/);
});
