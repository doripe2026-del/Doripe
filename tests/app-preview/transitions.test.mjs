import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import { getScreen, listScreens } from "../../public/app-preview/screen-registry.js";
import { DEFAULT_STATE } from "../../public/app-preview/state.js";
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

const visibleControlPatterns = [
  /^action\/[^/]+$/i,
  /^field\/[^/]+\/(?:bg|container)$/i,
  /^(?:button|Button)(?:#\d+)?(?: \/.*)?$/,
  /CTA/i,
  /^hero-action\/[^/]+$/,
  /(?:^|\/)(?:toggle|tab|filter)(?:\b| \/)/i,
  /^chip(?:#\d+)?$/i,
  /^Photo menu(?:#\d+)?$/,
  /^Candidate photo slot \d+$/,
  /^Navigation \/ back button/,
  /^Back button/,
  /^Locate button/,
  /^Target button/,
  /^Following \/ list CTA$/,
  /^Header \/ filter pill$/,
  /^Header \/ segmented control$/,
  /^Floating \/ (?:add route CTA|scroll to top)$/,
  /^Info \/ (?:address|hours|menu) row$/,
  /^Related places \/ card/,
  /^slot\/comment-item\/like-icon/,
  /^bottom sheet \/ (?:comments editable|business hours|filter only)$/i,
  /^Discover card\/action bg/,
  /^Segmented \//,
  /^segment (?:place|route)$/,
  /^ui\/toggle\/bg/,
  /^slot\/settings-row\/bg/,
  /^Photo grid sheet$/,
  /^Bottom sheet \/ selected place photos$/,
  /^Floating CTA \/ start here$/,
  /^Start CTA \/ bg$/,
  /^Filter \/ change bg$/,
  /^Top \/ back button bg$/,
  /^route card(?:#\d+)?$/,
  /^Feed \/ media tile \d+(?:#\d+)?$/,
  /^media\/(?:photo|avatar)\/crop-asset(?:#\d+)?$/,
  /^slot\/option-card\/bg(?:#\d+)?$/,
  /^gender radio(?:#\d+|\/[^/]+)?$/,
  /^region(?:#\d+)?$/,
  /^slot\/user-photo\/media(?:#\d+)?$/,
  /^UGC card \d+$/,
  /^Heart icon(?:#\d+)?$/
];

function isVisibleControlKey(key) {
  return visibleControlPatterns.some((pattern) => pattern.test(key));
}

function actionIdsForScreen(screenId) {
  return [...new Set(actionContract.actions
    .filter((record) => record.screenId === screenId)
    .map((record) => record.actionId))];
}

function previewState(currentScreenId, overrides = {}) {
  return {
    ...DEFAULT_STATE,
    currentScreenId,
    history: [],
    reviewStatus: {},
    form: {},
    selections: {},
    savedPlaceIds: [],
    likedMediaIds: [],
    followedUserIds: [],
    routePlaceIds: [],
    overlays: [],
    ...overrides
  };
}

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

test("the independent Figma action contract covers measured controls and drives registry actions", async () => {
  const screenIds = new Set(listScreens().map((screen) => screen.id));
  const actionSources = new Set();
  const classifiedSources = new Set();

  assert.equal(actionContract.version, 1);
  assert.ok(actionContract.actions.length > 0);

  for (const record of actionContract.actions) {
    assert.ok(screenIds.has(record.screenId), `unknown contract screen ${record.screenId}`);
    assert.match(record.actionId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Object.hasOwn(measurements[record.screenId].elements, record.source), `${record.screenId}/${record.source}`);
    assert.ok(record.kind.length > 0);
    assert.ok(record.evidence.length > 0);
    assert.ok(["navigate", "history", "state", "share", "overlay"].includes(record.effect.type));
    if (record.effect.destination) assert.ok(getScreen(record.effect.destination));
    actionSources.add(`${record.screenId}\0${record.source}`);
    classifiedSources.add(`${record.screenId}\0${record.source}`);
  }

  for (const record of actionContract.nonInteractive) {
    assert.ok(screenIds.has(record.screenId), `unknown classification screen ${record.screenId}`);
    assert.ok(Object.hasOwn(measurements[record.screenId].elements, record.source), `${record.screenId}/${record.source}`);
    assert.ok(record.kind.length > 0);
    assert.ok(record.reason.length > 0);
    assert.ok(!actionSources.has(`${record.screenId}\0${record.source}`), `interactive source classified noninteractive: ${record.screenId}/${record.source}`);
    classifiedSources.add(`${record.screenId}\0${record.source}`);
  }

  for (const screen of listScreens()) {
    assert.deepEqual(screen.actions, actionIdsForScreen(screen.id));
    for (const key of Object.keys(measurements[screen.id].elements).filter(isVisibleControlKey)) {
      assert.ok(classifiedSources.has(`${screen.id}\0${key}`), `unclassified visible control ${screen.id}/${key}`);
    }
  }

  const registrySource = await readFile(new URL("../../public/app-preview/screen-registry.js", import.meta.url), "utf8");
  const transitionSource = await readFile(new URL("../../public/app-preview/transitions.js", import.meta.url), "utf8");
  const checkSource = await readFile(new URL("../../scripts/check-app-preview.mjs", import.meta.url), "utf8");
  assert.match(registrySource, /action-contract\.json/);
  assert.match(transitionSource, /action-contract\.json/);
  assert.match(checkSource, /action-contract\.json/);
});

test("contract effects agree with pure transition results", () => {
  const seen = new Set();

  for (const record of actionContract.actions) {
    const key = `${record.screenId}/${record.actionId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const state = previewState(record.screenId, {
      history: ["a1"],
      form: {
        email: "dori@doripe.kr",
        password: "Doripe123",
        newPassword: "Doripe123",
        passwordConfirmation: "Doripe123",
        birthYear: "2000",
        gender: "female",
        nickname: "dori",
        routeName: "연남 저녁 코스",
        habit: "instagram-saved",
        source: "instagram",
        neighborhoodId: "seongsu"
      },
      routePlaceIds: ["place-1", "place-2"],
      selections: record.screenId === "c7" ? {
        selectedRouteId: "route-1",
        selectedPlaceId: "place-1",
        replacementPlaceId: "place-2"
      } : {}
    });
    const result = dispatchAction(record.screenId, record.actionId, { state, ...actionPayload });

    if (record.effect.type === "navigate") assert.equal(result.nextScreenId, record.effect.destination, key);
    if (record.effect.type === "history") assert.equal(result.nextScreenId, "a1", key);
    if (record.effect.type === "share") assert.equal(result.effect, "share", key);
    if (["state", "overlay"].includes(record.effect.type)) assert.equal(result.nextScreenId, undefined, key);
    if (record.effect.type === "overlay") assert.ok(result.state.overlays.includes(record.effect.overlayId), key);
  }
});

test("contract records the corrected B4, B6, and current D1 evidence", () => {
  const b4Actions = actionIdsForScreen("b4");
  const b6Actions = actionIdsForScreen("b6");
  const d1PhotoMenus = actionContract.actions.filter((record) => (
    record.screenId === "d1" && /^Photo menu(?:#\d+)?$/.test(record.source)
  ));

  assert.ok(!b4Actions.includes("go-back"));
  assert.ok(!b4Actions.includes("create-route"));
  assert.ok(b6Actions.includes("create-route"));
  assert.equal(d1PhotoMenus.length, 9);
  assert.ok(d1PhotoMenus.every((record) => record.actionId === "open-photo-menu"));
});

test("A4 action sources follow the visible login and signup controls", () => {
  const a4BySource = new Map(actionContract.actions
    .filter((record) => record.screenId === "a4")
    .map((record) => [record.source, record]));

  assert.equal(a4BySource.get("action/primary/bg#2").actionId, "submit-login");
  assert.equal(a4BySource.get("action/primary/bg#2").effect.destination, "b1");
  assert.equal(a4BySource.get("action/primary/bg").actionId, "create-account");
  assert.equal(a4BySource.get("action/primary/bg").effect.destination, "a9");
});

test("required Flow A transitions reject missing persisted form values", () => {
  for (const [screenId, actionId] of [
    ["a3", "submit-login"],
    ["a5", "send-reset-email"],
    ["a7", "save-password"],
    ["a9", "continue-sign-up"],
    ["a12", "continue-sign-up"],
    ["a14", "continue-sign-up"],
    ["a15", "continue-sign-up"],
    ["a16", "continue-sign-up"],
    ["a18", "choose-location"],
    ["a19", "continue-sign-up"],
    ["a20", "confirm-neighborhood"]
  ]) {
    const state = previewState(screenId);
    const result = dispatchAction(screenId, actionId, { state });
    assert.equal(result.nextScreenId, undefined, `${screenId}/${actionId}`);
    assert.equal(result.state.currentScreenId, screenId, `${screenId}/${actionId}`);
    assert.equal(result.state.toast?.kind, "error", `${screenId}/${actionId}`);
  }
});

test("A6 resend is a measured state action", () => {
  const record = actionContract.actions.find(({ screenId, actionId }) => (
    screenId === "a6" && actionId === "resend-reset-email"
  ));
  assert.equal(record.source, "resend");
  assert.equal(record.effect.type, "state");

  const state = previewState("a6");
  const result = dispatchAction("a6", "resend-reset-email", { state });
  assert.equal(result.nextScreenId, undefined);
  assert.equal(result.state.form.resetEmailResent, true);
});

test("one measured source maps to one action unless backed by explicit Figma variants", async () => {
  const { validateActionSources } = await import("../../scripts/generate-app-preview-action-contract.mjs");
  const actionsBySource = new Map();

  for (const record of actionContract.actions) {
    const key = `${record.screenId}\0${record.source}`;
    const records = actionsBySource.get(key) || [];
    records.push(record);
    actionsBySource.set(key, records);
  }

  for (const [key, records] of actionsBySource) {
    const actionIds = new Set(records.map((record) => record.actionId));
    if (actionIds.size <= 1) continue;
    assert.ok(records.every((record) => record.variant?.condition && record.variant?.figmaNodeId), key);
    assert.equal(new Set(records.map((record) => record.variant.figmaNodeId)).size, records.length, key);
  }

  assert.throws(() => validateActionSources([
    { screenId: "b12", source: "action/primary", actionId: "toggle-follow" },
    { screenId: "b12", source: "action/primary", actionId: "edit-profile" }
  ]), /Duplicate measured action source/);
});

test("noninteractive controls require exact reviewed overrides without generic reasons", async () => {
  const {
    ALLOWED_NONINTERACTIVE_REASONS,
    NONINTERACTIVE_OVERRIDES,
    classifyNonInteractive
  } = await import("../../scripts/generate-app-preview-action-contract.mjs");
  const artifactByKey = new Map(actionContract.nonInteractive.map((record) => [
    `${record.screenId}\0${record.source}`,
    record
  ]));

  assert.throws(() => classifyNonInteractive({
    measurementRegistry: { x1: { elements: { "button / unreviewed": {} } } },
    actionRecords: [],
    overrides: {}
  }), /Unreviewed control-shaped element: x1\/button \/ unreviewed/);

  for (const [key, override] of Object.entries(NONINTERACTIVE_OVERRIDES)) {
    const record = artifactByKey.get(key);
    assert.ok(record, `override missing from artifact: ${key}`);
    assert.ok(ALLOWED_NONINTERACTIVE_REASONS.has(override.reason), key);
    assert.equal(record.reason, override.reason);
    assert.equal(record.evidence, override.evidence);
    assert.doesNotMatch(record.evidence, /reference and 59-screen inventory|visual child or containing composite/i);
  }
  assert.equal(artifactByKey.size, Object.keys(NONINTERACTIVE_OVERRIDES).length);
});

test("B12 exposes only its measured follow action and B4 rows are interactive", () => {
  const b12Actions = actionIdsForScreen("b12");
  const b4BySource = new Map(actionContract.actions
    .filter((record) => record.screenId === "b4")
    .map((record) => [record.source, record]));

  assert.ok(!b12Actions.includes("edit-profile"));
  assert.equal(b4BySource.get("Info / address row").actionId, "open-place-map");
  assert.equal(b4BySource.get("Info / address row").effect.destination, "c4");
  assert.equal(b4BySource.get("Info / menu row").actionId, "open-menu");
  assert.equal(b4BySource.get("Info / menu row").effect.type, "overlay");
});

test("route controls use their distinct measured buttons", () => {
  const c2RouteMapSources = actionContract.actions
    .filter((record) => record.screenId === "c2" && record.actionId === "open-route-map")
    .map((record) => record.source);
  const c2DetailSources = actionContract.actions
    .filter((record) => record.screenId === "c2" && record.actionId === "open-route")
    .map((record) => record.source);
  const d5AddSources = actionContract.actions
    .filter((record) => record.screenId === "d5" && record.actionId === "add-place")
    .map((record) => record.source);

  assert.deepEqual(c2RouteMapSources, ["button", "button#3", "button#5"]);
  assert.deepEqual(c2DetailSources, ["button#2", "button#4", "button#6"]);
  assert.deepEqual(d5AddSources, ["icon/lucide#5", "icon/lucide#6", "icon/lucide#7"]);
  assert.ok(actionIdsForScreen("c6").includes("go-back"));
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
    dispatchAction("b4", "save-place", { placeId: "place-1" }).state.savedPlaceIds[0],
    "place-1"
  );
  assert.equal(
    dispatchAction("b12", "toggle-follow", {
      state: { ...structuredClone(DEFAULT_STATE), followedUserIds: [] },
      userId: "user-1"
    }).state.followedUserIds[0],
    "user-1"
  );
  assert.equal(
    dispatchAction("b4", "open-share", { type: "place", id: "place-1" }).effect,
    "share"
  );
});

test("saved-list add is idempotent while candidate selection can be toggled", () => {
  const initial = { ...structuredClone(DEFAULT_STATE), routePlaceIds: [] };
  const firstAdd = dispatchAction("c1", "add-place-to-route", { state: initial, placeId: "place-1" });
  const secondAdd = dispatchAction("c1", "add-place-to-route", { state: firstAdd.state, placeId: "place-1" });
  assert.deepEqual(secondAdd.state.routePlaceIds, ["place-1"]);

  const removed = dispatchAction("d5", "add-place", { state: secondAdd.state, placeId: "place-1" });
  assert.deepEqual(removed.state.routePlaceIds, []);
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

  const saved = dispatchAction("b4", "save-place", { state, placeId: "place-1" });
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

test("opening feed media preserves both the selected place and selected media", () => {
  const result = dispatchAction("b2", "open-place", {
    placeId: "place-2",
    mediaId: "media-5"
  });

  assert.equal(result.nextScreenId, "b4");
  assert.equal(result.state.selections.selectedPlaceId, "place-2");
  assert.equal(result.state.selections.selectedMediaId, "media-5");
});

test("submitted comments persist independently from the composer field", () => {
  const state = {
    ...structuredClone(DEFAULT_STATE),
    currentScreenId: "b8",
    selections: { selectedPlaceId: "place-1" },
    form: { comment: "다시 가고 싶어요" }
  };
  const submitted = dispatchAction("b8", "submit-comment", { state });
  const liked = dispatchAction("b8", "toggle-comment-like", {
    state: submitted.state,
    commentId: "comment-1"
  });

  assert.equal(submitted.state.form.comment, "");
  assert.equal(submitted.state.submittedComments[0].body, "다시 가고 싶어요");
  assert.equal(liked.state.submittedComments[0].body, "다시 가고 싶어요");
});

test("unknown screens and actions return an error toast instead of throwing", () => {
  assert.equal(dispatchAction("b1", "unknown-action").state.toast.kind, "error");
  assert.equal(dispatchAction("unknown-screen", "open-place").state.toast.kind, "error");
});

test("prototype keys are unknown actions and cannot mutate state", () => {
  const state = previewState("b1", {
    selections: { safe: "value" },
    savedPlaceIds: ["place-2"]
  });
  const snapshot = structuredClone(state);

  for (const [screenId, actionId] of [
    ["b1", "toString"],
    ["b1", "__proto__"],
    ["toString", "open-place"],
    ["__proto__", "open-place"]
  ]) {
    const result = dispatchAction(screenId, actionId, { state, placeId: "place-1" });
    assert.equal(result.state.toast.kind, "error");
    assert.equal(result.nextScreenId, undefined);
  }

  assert.deepEqual(state, snapshot);
  assert.equal({}.selectedPlaceId, undefined);
});

test("detail and media close actions return to their exact opener", () => {
  const detail = dispatchAction("b1", "open-place", {
    state: previewState("b1"),
    placeId: "place-1"
  });
  assert.equal(detail.nextScreenId, "b4");
  assert.equal(detail.state.selections.selectedPlaceId, "place-1");
  assert.deepEqual(detail.state.history, ["b1"]);

  const detailClosed = dispatchAction("b4", "close-place", { state: detail.state });
  assert.equal(detailClosed.nextScreenId, "b1");
  assert.deepEqual(detailClosed.state.history, []);

  const media = dispatchAction("b12", "open-content", {
    state: previewState("b12"),
    placeId: "place-4"
  });
  assert.equal(media.nextScreenId, "b4");
  assert.equal(media.state.selections.selectedPlaceId, "place-4");

  const mediaClosed = dispatchAction("b4", "close-place", { state: media.state });
  assert.equal(mediaClosed.nextScreenId, "b12");
  assert.deepEqual(mediaClosed.state.history, []);
});

test("opening profile and route records selected fixture ids immutably", () => {
  const profileState = previewState("b13");
  const profile = dispatchAction("b13", "open-profile", { state: profileState, userId: "user-2" });
  const route = dispatchAction("c2", "open-route", {
    state: previewState("c2"),
    routeId: "route-2"
  });

  assert.equal(profile.state.selections.selectedUserId, "user-2");
  assert.equal(profile.nextScreenId, "b12");
  assert.equal(route.state.selections.selectedRouteId, "route-2");
  assert.equal(route.nextScreenId, "c6");
  assert.deepEqual(profileState.selections, {});
});

test("route detail closes to its exact opener", () => {
  const route = dispatchAction("c2", "open-route", {
    state: previewState("c2"),
    routeId: "route-2"
  });
  const closed = dispatchAction("c6", "go-back", { state: route.state });

  assert.equal(route.nextScreenId, "c6");
  assert.equal(route.state.selections.selectedRouteId, "route-2");
  assert.equal(closed.nextScreenId, "c2");
  assert.deepEqual(closed.state.history, []);
});

test("filter reset preserves non-filter selections", () => {
  const state = previewState("c3", {
    selections: {
      birthYear: 1995,
      profileTab: "places",
      referralSource: "friend",
      shareTarget: { type: "place", id: "place-1" },
      situation: "date",
      time: "afternoon",
      mood: "quiet",
      feedFilter: "nearby",
      savedFilter: "cafe",
      routeFilter: "walk"
    }
  });
  const result = dispatchAction("c3", "reset-filters", { state });

  assert.deepEqual(result.state.selections, {
    birthYear: 1995,
    profileTab: "places",
    referralSource: "friend",
    shareTarget: { type: "place", id: "place-1" }
  });
  assert.notEqual(result.state.selections, state.selections);
});

test("main owns delegated action events and keeps sharing as a DOM effect", async () => {
  const source = await readFile(new URL("../../public/app-preview/main.js", import.meta.url), "utf8");

  assert.match(source, /dispatchAction\(/);
  assert.equal(source.match(/addEventListener\("click"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("input"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("change"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("keydown"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("pointerdown"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("pointerup"/g)?.length, 1);
  assert.equal(source.match(/addEventListener\("pointercancel"/g)?.length, 1);
  assert.match(source, /navigator\.share\(/);
  assert.match(source, /navigator\.clipboard\.writeText\(/);
  assert.match(source, /data-action/);
  assert.match(source, /data-id/);
  assert.match(source, /function isActionFormControl\(target\)/);
  assert.match(source, /if \(isActionFormControl\(target\)\) return;/);
  assert.match(source, /function isChangeOnlyControl\(target\)/);
  assert.match(source, /state\.replace\(result\.state\)/);
  assert.doesNotMatch(source, /if \(result\.nextScreenId\) navigate\(result\.nextScreenId\)/);

  const clickHandler = source.slice(
    source.indexOf('document.addEventListener("click"'),
    source.indexOf('document.addEventListener("input"')
  );
  assert.ok(clickHandler.indexOf("isActionFormControl(target)") < clickHandler.indexOf("dispatchTargetAction(target)"));

  const inputHandler = source.slice(
    source.indexOf('document.addEventListener("input"'),
    source.indexOf('document.addEventListener("change"')
  );
  const changeHandler = source.slice(
    source.indexOf('document.addEventListener("change"'),
    source.indexOf('document.addEventListener("keydown"')
  );
  assert.ok(inputHandler.indexOf("isChangeOnlyControl(target)") < inputHandler.indexOf("dispatchTargetAction(target, { rerender: false })"));
  assert.match(inputHandler, /dispatchTargetAction\(target, \{ rerender: false \}\)/);
  assert.ok(changeHandler.indexOf("!isChangeOnlyControl(target)") < changeHandler.indexOf("dispatchTargetAction(target)"));
});
