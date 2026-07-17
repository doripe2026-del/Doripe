import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import { getScreen, listScreens } from "../../public/app-preview/screen-registry.js";
import { normalizeDataSnapshot } from "../../public/app-preview/data/contracts.js";
import { createDataCatalog } from "../../public/app-preview/data/selectors.js";
import { DEFAULT_STATE, normalizePreviewState } from "../../public/app-preview/state.js";
import {
  ACTIONS_BY_SCREEN,
  RUNTIME_ACTIONS_BY_SCREEN,
  TRANSITIONS,
  dispatchAction as dispatchTransition
} from "../../public/app-preview/transitions.js";

const data = normalizeDataSnapshot({
  viewerProfileId: "user-1",
  places: Array.from({ length: 12 }, (_, index) => ({ id: `place-${index + 1}` })),
  courses: [
    { id: "route-1", name: "연남 저녁 데이트 루트", placeIds: ["place-1", "place-7", "place-8"] },
    { id: "route-2", name: "다른 코스", placeIds: ["place-6", "place-2", "place-12"] }
  ],
  profiles: [{ id: "user-1", handle: "도리", bio: "" }],
  contents: [
    { id: "content-place-1", type: "place", placeId: "place-1" },
    { id: "content-route-1", type: "course", courseId: "route-1" }
  ]
});
const catalog = createDataCatalog(data);
const dispatchAction = (screenId, actionId, payload = {}) => dispatchTransition(screenId, actionId, {
  ...payload,
  data: payload.data ?? data
});

test("course selection resolves against the injected data snapshot", () => {
  const data = normalizeDataSnapshot({
    places: [{ id: "place-a" }, { id: "place-b" }],
    courses: [{ id: "course-a", name: "주입된 코스", placeIds: ["place-a", "place-b"] }],
    profiles: [{ id: "profile-a", handle: "도리", bio: "" }]
  });
  const result = dispatchTransition("b1", "open-route-post", {
    state: { ...DEFAULT_STATE, currentScreenId: "b1" },
    data,
    routeId: "course-a"
  });

  assert.equal(result.nextScreenId, "b4");
  assert.equal(result.state.selections.selectedRouteId, "course-a");
});

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

    assert.deepEqual(
      Object.keys(TRANSITIONS[screen.id]),
      [...screen.actions, ...(RUNTIME_ACTIONS_BY_SCREEN[screen.id] || [])]
    );
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
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-2"] },
      selections: ["c6", "c7"].includes(record.screenId) ? {
        selectedRouteId: "route-1",
        selectedPlaceId: "place-1",
        replacementPlaceId: "place-2"
      } : {}
    });
    const result = dispatchAction(record.screenId, record.actionId, { state, ...actionPayload });

    if (key === "e3/delete-account") {
      assert.equal(result.nextScreenId, undefined, key);
      assert.match(result.state.toast.message, /미리보기/);
      continue;
    }
    if (record.effect.type === "navigate") assert.equal(result.nextScreenId, record.effect.destination, key);
    if (record.effect.type === "history") assert.equal(result.nextScreenId, "a1", key);
    if (record.effect.type === "share") assert.equal(result.effect, "share", key);
    if (["state", "overlay"].includes(record.effect.type)) assert.equal(result.nextScreenId, undefined, key);
    if (record.effect.type === "overlay") assert.ok(result.state.overlays.includes(record.effect.overlayId), key);
  }
});

test("contract records the corrected B4, B6, and current D1 evidence", () => {
  const b4Actions = actionIdsForScreen("b4");
  const b5Actions = actionIdsForScreen("b5");
  const b6Actions = actionIdsForScreen("b6");
  const d1PhotoMenus = actionContract.actions.filter((record) => (
    record.screenId === "d1" && /^Photo menu(?:#\d+)?$/.test(record.source)
  ));

  assert.ok(!b4Actions.includes("go-back"));
  assert.ok(!b4Actions.includes("create-route"));
  assert.ok(!b4Actions.includes("open-other-media"));
  assert.ok(!b5Actions.includes("open-other-media"));
  assert.ok(!b6Actions.includes("open-other-media"));
  assert.ok(RUNTIME_ACTIONS_BY_SCREEN.b4.includes("open-other-media"));
  assert.ok(RUNTIME_ACTIONS_BY_SCREEN.b5.includes("open-other-media"));
  assert.ok(RUNTIME_ACTIONS_BY_SCREEN.b6.includes("open-other-media"));
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

test("A1 start enters guest onboarding without account creation", () => {
  const result = dispatchAction("a1", "start", { state: previewState("a1") });

  assert.equal(result.nextScreenId, "a18");
  assert.equal(result.state.currentScreenId, "a18");
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

test("onboarding keeps preference values available to discovery", () => {
  let result = dispatchAction("a18", "select-place-source", {
    state: previewState("a18"),
    value: "map-search"
  });
  result = dispatchAction("a19", "select-referral-source", {
    state: { ...result.state, currentScreenId: "a19" },
    value: "friend"
  });
  result = dispatchAction("a19", "continue-sign-up", { state: result.state });

  assert.equal(result.nextScreenId, "a22");
  assert.deepEqual(result.state.selections, {
    placeSource: "map-search",
    referralSource: "friend",
    locationMode: "seoul"
  });
});

test("password changes reject a wrong current password and scrub every secret", () => {
  let result = dispatchAction("e3", "update-current-password", {
    state: previewState("e3"),
    value: "DefinitelyWrong123"
  });
  result = dispatchAction("e3", "update-new-password", { state: result.state, value: "Newpass123" });
  result = dispatchAction("e3", "update-password-confirmation", { state: result.state, value: "Newpass123" });
  result = dispatchAction("e3", "save-password", { state: result.state });

  assert.equal(result.state.currentScreenId, "e3");
  assert.equal(result.state.toast.kind, "error");
  assert.match(result.state.toast.message, /현재 비밀번호가 일치하지 않아요/);
  assert.equal(JSON.stringify(result.state).includes("DefinitelyWrong123"), false);
  assert.equal(JSON.stringify(result.state).includes("Newpass123"), false);

  const deleted = dispatchAction("e3", "delete-account", { state: result.state });
  assert.equal(deleted.nextScreenId, undefined);
  assert.match(deleted.state.toast.message, /미리보기에서는 회원 탈퇴를 처리할 수 없어요/);
});

test("logout clears account-owned data while preserving anonymous discovery preferences", () => {
  const result = dispatchAction("e3", "logout", {
    state: previewState("e3", {
      form: {
        email: "dori@doripe.kr",
        nickname: "도리",
        bio: "서울을 기록해요",
        password: "secret",
        newPassword: "new-secret",
        birthYear: "2000",
        gender: "female",
        habit: "instagram-saved",
        source: "instagram",
        discoverySource: "instagram"
      },
      selections: { authenticated: true, session: { userId: "user-1" }, neighborhood: "yeonnam" },
      profile: { id: "user-1", nickname: "도리", bio: "서울을 기록해요" },
      profileDraft: { id: "user-1", nickname: "새 도리", bio: "새 소개" },
      savedPlaceIds: ["place-1"],
      savedRoutes: [{ id: "route-1", name: "연남 코스", placeIds: ["place-1", "place-2"] }],
      likedMediaIds: ["media-1"],
      likedPlaceIds: ["place-1"],
      likedCommentIds: ["comment-1"],
      submittedComments: [{ id: "local-comment-1", body: "좋아요" }],
      followedUserIds: ["user-1"],
      routePlaceIds: ["place-1", "place-2"],
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-2"] }
    })
  });

  assert.equal(result.nextScreenId, "a3");
  assert.deepEqual(result.state.form, { discoverySource: "instagram" });
  assert.deepEqual(result.state.selections, { neighborhood: "yeonnam" });
  assert.equal(result.state.profile, undefined);
  assert.equal(result.state.profileDraft, undefined);
  assert.deepEqual(result.state.savedPlaceIds, []);
  assert.deepEqual(result.state.savedRoutes, []);
  assert.deepEqual(result.state.likedMediaIds, []);
  assert.deepEqual(result.state.likedPlaceIds, []);
  assert.deepEqual(result.state.likedCommentIds, []);
  assert.deepEqual(result.state.submittedComments, []);
  assert.deepEqual(result.state.followedUserIds, []);
  assert.deepEqual(result.state.routePlaceIds, []);
  assert.deepEqual(result.state.routeDraft, { startPlaceId: null, placeIds: [] });
});

test("remote signup always stays on neutral email verification", () => {
  const state = previewState("a12", { form: { email: "new@doripe.kr" } });
  const pending = dispatchAction("a12", "continue-sign-up", {
    state,
    password: "Doripe123",
    authResult: { ok: true, status: "email-check", message: "이메일을 확인해 주세요" }
  });
  assert.equal(pending.nextScreenId, undefined);
  assert.equal(pending.state.currentScreenId, "a12");
  assert.equal(pending.state.toast.message, "이메일을 확인해 주세요");

  const sessionBearing = dispatchAction("a12", "continue-sign-up", {
    state,
    password: "Doripe123",
    authResult: { ok: true, status: "authenticated" }
  });
  assert.equal(sessionBearing.nextScreenId, undefined);
  assert.equal(sessionBearing.state.currentScreenId, "a12");
  assert.equal(sessionBearing.state.toast.message, "이메일을 확인해 주세요");
});

test("logout transition is local-first even when remote logout reports a warning", () => {
  const result = dispatchAction("e3", "logout", {
    state: previewState("e3", {
      history: ["b1", "e1"],
      selections: { authenticated: true, session: { accessToken: "secret" } }
    }),
    authResult: { ok: true, status: "signed-out", warning: "로그아웃 서버 연결에 실패했어요" }
  });
  assert.equal(result.nextScreenId, "a3");
  assert.deepEqual(result.state.history, []);
  assert.equal(result.state.toast.message, "로그아웃 서버 연결에 실패했어요");
  assert.doesNotMatch(JSON.stringify(result.state), /accessToken|secret/);
});

test("profile edits stay in a draft until save and back discards the draft", () => {
  const committed = { nickname: "기존도리", bio: "기존 소개" };
  let result = dispatchAction("e2", "update-nickname", {
    state: previewState("e2", { profile: committed, history: ["e1"] }),
    value: "새도리"
  });
  result = dispatchAction("e2", "update-bio", { state: result.state, value: "새 소개" });

  assert.deepEqual(result.state.profile, committed);
  assert.deepEqual(result.state.profileDraft, { id: "user-1", nickname: "새도리", bio: "새 소개" });

  const discarded = dispatchAction("e2", "go-back", { state: result.state });
  assert.equal(discarded.nextScreenId, "e1");
  assert.deepEqual(discarded.state.profile, committed);
  assert.equal(discarded.state.profileDraft, undefined);

  const saved = dispatchAction("e2", "save-profile", {
    state: { ...result.state, currentScreenId: "e2", history: ["e1"] }
  });
  assert.equal(saved.nextScreenId, "e1");
  assert.deepEqual(saved.state.profile, { id: "user-1", nickname: "새도리", bio: "새 소개" });
  assert.equal(saved.state.profileDraft, undefined);
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

test("every add-to-course action is idempotent and visibly retained in state", () => {
  const initial = { ...structuredClone(DEFAULT_STATE), routePlaceIds: [] };
  const firstAdd = dispatchAction("c1", "add-place-to-route", { state: initial, placeId: "place-1" });
  const secondAdd = dispatchAction("c1", "add-place-to-route", { state: firstAdd.state, placeId: "place-1" });
  assert.deepEqual(secondAdd.state.routePlaceIds, ["place-1"]);

  const candidateAdd = dispatchAction("d5", "add-place", { state: secondAdd.state, placeId: "place-2" });
  const candidateAddAgain = dispatchAction("d5", "add-place", { state: candidateAdd.state, placeId: "place-2" });
  assert.deepEqual(candidateAddAgain.state.routePlaceIds, ["place-1", "place-2"]);
});

test("a route cannot proceed from the map without an explicitly selected place", () => {
  const result = dispatchAction("d2", "confirm-start-location", { state: previewState("d2") });
  assert.equal(result.nextScreenId, undefined);
  assert.equal(result.state.currentScreenId, "d2");
  assert.match(result.state.toast.message, /시작 장소를 먼저 선택해 주세요/);
});

test("notification defaults and master state remain consistent after child changes", () => {
  const initial = previewState("e4");
  const disabledDefault = dispatchAction("e4", "toggle-saved-place-updates", {
    state: initial,
    checked: false
  });
  assert.deepEqual(disabledDefault.state.selections.notifications, {
    all: false,
    savedPlaceUpdates: false,
    routeRecommendations: true,
    commentLikes: false,
    marketing: false
  });

  const enabledAll = dispatchAction("e4", "toggle-all-notifications", {
    state: disabledDefault.state,
    checked: true
  });
  assert.equal(enabledAll.state.selections.notifications.all, true);
  assert.equal(Object.values(enabledAll.state.selections.notifications).every(Boolean), true);

  const disabledChild = dispatchAction("e4", "toggle-comment-likes", {
    state: enabledAll.state,
    checked: false
  });
  assert.equal(disabledChild.state.selections.notifications.all, false);
  assert.equal(disabledChild.state.selections.notifications.commentLikes, false);
});

test("confirming a route start keeps it as the first saved route draft place", () => {
  const selected = dispatchAction("d1", "select-start-place", {
    state: previewState("d1"),
    placeId: "place-3"
  });
  const confirmed = dispatchAction("d4", "confirm-start-place", { state: selected.state });

  assert.equal(confirmed.nextScreenId, "d5");
  assert.deepEqual(confirmed.state.routeDraft, {
    startPlaceId: "place-3",
    placeIds: ["place-3"]
  });
  assert.deepEqual(confirmed.state.routePlaceIds, ["place-3"]);
});

test("saving a named course creates a canonical saved route", () => {
  const result = dispatchAction("d8", "save-route", {
    state: previewState("d8", {
      form: { routeName: "연남 오후 코스" },
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-2"] },
      routePlaceIds: ["place-1", "place-2"]
    })
  });

  assert.equal(result.nextScreenId, "d9");
  assert.deepEqual(result.state.savedRoutes, [{
    id: "saved-route-1",
    name: "연남 오후 코스",
    placeIds: ["place-1", "place-2"]
  }]);
  assert.equal(result.state.selections.selectedRouteId, "saved-route-1");
});

test("route tab navigates without resetting the last useful course state", () => {
  const originalRoute = {
    id: "saved-route-1",
    name: "기존 연남 코스",
    placeIds: ["place-1", "place-2"]
  };
  const existing = previewState("d9", {
    form: { routeName: originalRoute.name },
    savedRoutes: [originalRoute],
    routeDraft: { startPlaceId: "place-1", placeIds: [...originalRoute.placeIds] },
    routePlaceIds: [...originalRoute.placeIds],
    selections: { selectedRouteId: originalRoute.id, selectedPlaceId: "place-1" }
  });

  const entered = dispatchAction("d9", "open-routes", { state: existing });
  assert.equal(entered.nextScreenId, "d3");
  assert.equal(entered.state.selections.selectedRouteId, originalRoute.id);
  assert.deepEqual(entered.state.routeDraft, {
    startPlaceId: "place-1",
    placeIds: originalRoute.placeIds
  });
  assert.deepEqual(entered.state.routePlaceIds, originalRoute.placeIds);
});

test("route replacement updates the canonical draft and legacy place ids", () => {
  const result = dispatchAction("c7", "confirm-place-selection", {
    state: previewState("c7", {
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-2"] },
      routePlaceIds: ["place-1", "place-2"],
      selections: {
        selectedRouteId: "route-1",
        selectedPlaceId: "place-2",
        replacementPlaceId: "place-3"
      }
    })
  });

  assert.deepEqual(result.state.routePlaceIds, ["place-1", "place-3"]);
  assert.deepEqual(result.state.routeDraft, {
    startPlaceId: "place-1",
    placeIds: ["place-1", "place-3"]
  });
});

test("starting replacement switches an existing canonical draft to the selected route", () => {
  const result = dispatchAction("c6", "replace-route-place", {
    state: previewState("c6", {
      routeDraft: {
        startPlaceId: "place-1",
        placeIds: ["place-1", "place-7", "place-8"]
      },
      routePlaceIds: ["place-1", "place-7", "place-8"],
      selections: { selectedRouteId: "route-2" }
    }),
    placeId: "place-2"
  });

  const expectedDraft = {
    startPlaceId: "place-6",
    placeIds: ["place-6", "place-2", "place-12"]
  };
  assert.equal(result.nextScreenId, "c7");
  assert.deepEqual(result.state.routeDraft, expectedDraft);
  assert.deepEqual(result.state.routePlaceIds, expectedDraft.placeIds);
  assert.deepEqual(normalizePreviewState(result.state, catalog).routeDraft, expectedDraft);
});

test("saving a route rejects drafts without a valid start place", () => {
  const result = dispatchAction("d8", "save-route", {
    state: previewState("d8", {
      form: { routeName: "시작 없는 코스" },
      routeDraft: { startPlaceId: null, placeIds: ["place-1", "place-2"] },
      routePlaceIds: ["place-1", "place-2"]
    })
  });

  assert.equal(result.nextScreenId, undefined);
  assert.equal(result.state.savedRoutes.length, 0);
  assert.equal(result.state.toast.kind, "error");
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

test("a shared feed course can be quietly saved and unsaved without opening navigation", () => {
  const initial = previewState("b4", {
    selections: { selectedRouteId: "route-1", routeDetailSource: "feed" }
  });
  const saved = dispatchAction("b4", "save-shared-route", { state: initial, routeId: "route-1" });

  assert.equal(saved.nextScreenId, undefined);
  assert.deepEqual(saved.state.savedRoutes, [{
    id: "saved-route-1",
    name: "연남 저녁 데이트 루트",
    placeIds: ["place-1", "place-7", "place-8"]
  }]);

  const unsaved = dispatchAction("b4", "save-shared-route", { state: saved.state, routeId: "route-1" });
  assert.equal(unsaved.nextScreenId, undefined);
  assert.deepEqual(unsaved.state.savedRoutes, []);
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
  const submitted = dispatchAction("b8", "submit-comment", { state, contentId: "content-place-1" });
  const liked = dispatchAction("b8", "toggle-comment-like", {
    state: submitted.state,
    commentId: "comment-1"
  });

  assert.equal(submitted.state.form.comment, "");
  assert.equal(submitted.state.submittedComments[0].body, "다시 가고 싶어요");
  assert.equal(submitted.state.submittedComments[0].contentId, "content-place-1");
  assert.equal(submitted.state.submittedComments[0].userId, "user-1");
  assert.equal(liked.state.submittedComments[0].body, "다시 가고 싶어요");
});

test("course comments persist in canonical preview state with the viewer and content IDs", () => {
  const state = {
    ...structuredClone(DEFAULT_STATE),
    currentScreenId: "b4",
    selections: { selectedRouteId: "route-1", selectedContentId: "content-route-1", routeDetailSource: "feed" },
    form: { courseComment: "이 코스로 가볼게요" }
  };
  const submitted = dispatchAction("b4", "submit-course-comment", {
    state,
    contentId: "content-route-1"
  });

  assert.equal(submitted.state.form.courseComment, "");
  assert.deepEqual(submitted.state.submittedComments[0], {
    id: "local-comment-1",
    contentId: "content-route-1",
    courseId: "route-1",
    userId: "user-1",
    body: "이 코스로 가볼게요",
    likeCount: 0,
    createdAt: "local"
  });
});

test("profile save preserves the canonical viewer profile ID", () => {
  const state = {
    ...structuredClone(DEFAULT_STATE),
    currentScreenId: "e2",
    profileDraft: { nickname: "새 도리", bio: "새 소개" }
  };
  const saved = dispatchAction("e2", "save-profile", { state });

  assert.deepEqual(saved.state.profile, { id: "user-1", nickname: "새 도리", bio: "새 소개" });
});

test("unknown screens and actions return an error toast instead of throwing", () => {
  assert.equal(dispatchAction("b1", "unknown-action").state.toast.kind, "error");
  assert.equal(dispatchAction("unknown-screen", "open-place").state.toast.kind, "error");
});

test("C3 location actions keep a transient pin and radius in filter state", () => {
  const opened = dispatchAction("c3", "toggle-location-picker", { state: previewState("c3") });
  const pinned = dispatchAction("c3", "set-location-pin", {
    state: opened.state,
    value: JSON.stringify({ latitude: 37.55, longitude: 126.98 })
  });
  const radius = dispatchAction("c3", "select-location-radius", { state: pinned.state, value: "5" });

  assert.equal(opened.state.selections.locationPickerOpen, true);
  assert.equal(pinned.state.selections.locationMode, "pin");
  assert.deepEqual(pinned.state.selections.locationCenter, { latitude: 37.55, longitude: 126.98 });
  assert.equal(radius.state.selections.locationRadiusKm, 5);

  const allSeoul = dispatchAction("c3", "select-location-mode", { state: radius.state, value: "seoul" });
  assert.equal(allSeoul.state.selections.locationMode, "seoul");
  assert.equal(allSeoul.state.selections.locationCenter, undefined);
  assert.equal(allSeoul.state.selections.locationRadiusKm, undefined);
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

test("B1 and B2 course feed tiles open shared course detail without stale place media", () => {
  for (const screenId of ["b1", "b2"]) {
    const source = previewState(screenId, {
      selections: { selectedPlaceId: "place-1", selectedMediaId: "media-1" }
    });
    const opened = dispatchAction(screenId, "open-route-post", {
      state: source,
      routeId: "route-2"
    });

    assert.equal(opened.nextScreenId, "b4");
    assert.equal(opened.state.selections.selectedRouteId, "route-2");
    assert.equal(opened.state.selections.routeDetailSource, "feed");
    assert.equal(opened.state.selections.selectedPlaceId, undefined);
    assert.equal(opened.state.selections.selectedMediaId, undefined);
    assert.deepEqual(opened.state.history, [screenId]);

    const closed = dispatchAction("b4", "close-place", { state: opened.state });
    assert.equal(closed.nextScreenId, screenId);
  }
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

test("course filter choices keep the sheet open until apply", () => {
  const opened = dispatchAction("d5", "change-filter", {
    state: previewState("d5"),
    value: "filters"
  });
  const selected = dispatchAction("d5", "select-filter-tag", {
    state: opened.state,
    value: "tag-date",
    selectionKey: "situation"
  });

  assert.equal(selected.nextScreenId, undefined);
  assert.equal(selected.state.selections.routeFilter, "filters");
  assert.deepEqual(selected.state.selections.routeFilters, { situation: "tag-date" });

  const applied = dispatchAction("d5", "apply-route-filters", { state: selected.state });
  assert.equal(applied.state.selections.routeFilter, undefined);
  assert.deepEqual(applied.state.selections.routeFilters, { situation: "tag-date" });
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
