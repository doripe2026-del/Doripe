import actionContract from "./figma/action-contract.json" with { type: "json" };
import inventory from "./figma/screen-inventory.json" with { type: "json" };
import { DEFAULT_STATE } from "./state.js";

const contractActionsByScreen = new Map();
for (const record of actionContract.actions) {
  const actionIds = contractActionsByScreen.get(record.screenId) || [];
  if (!actionIds.includes(record.actionId)) actionIds.push(record.actionId);
  contractActionsByScreen.set(record.screenId, actionIds);
}

export const ACTIONS_BY_SCREEN = Object.freeze(Object.fromEntries(inventory.map((screen) => [
  screen.id,
  Object.freeze(contractActionsByScreen.get(screen.id) || [])
])));

function valueFrom(payload, fallbackKey = "id") {
  return payload?.value ?? payload?.[fallbackKey];
}

function errorResult(state, message = "요청을 처리할 수 없어요") {
  return {
    state: {
      ...state,
      toast: { kind: "error", message, duration: 2500 }
    },
    effect: "none"
  };
}

function idleResult(state, changes = {}) {
  return {
    state: { ...state, ...changes, toast: null },
    effect: "none"
  };
}

const navigateTo = (nextScreenId) => (state) => {
  const history = state.currentScreenId === nextScreenId
    ? [...(state.history || [])]
    : [...(state.history || []), state.currentScreenId].filter(Boolean);

  return {
    state: { ...state, currentScreenId: nextScreenId, history, toast: null },
    nextScreenId,
    effect: "none"
  };
};

const navigateBack = (state) => {
  const history = [...(state.history || [])];
  const nextScreenId = history.pop();
  if (!nextScreenId) return errorResult(state, "돌아갈 화면이 없어요");

  return {
    state: { ...state, currentScreenId: nextScreenId, history, toast: null },
    nextScreenId,
    effect: "none"
  };
};

const selectAndNavigate = (nextScreenId, selectionId, payloadKey) => (state, payload) => {
  const value = payload?.[payloadKey] ?? payload?.id ?? state.selections?.[selectionId];
  const nextState = typeof value === "string" && value.length > 0
    ? {
        ...state,
        selections: { ...(state.selections || {}), [selectionId]: value }
      }
    : state;
  return navigateTo(nextScreenId)(nextState);
};

const clearSelection = (selectionId) => (state) => {
  const selections = { ...(state.selections || {}) };
  delete selections[selectionId];
  return idleResult(state, { selections });
};

const openOverlay = (overlayId, selectionId, payloadKey) => (state, payload) => {
  const value = payload?.[payloadKey] ?? payload?.id ?? state.selections?.[selectionId];
  const overlays = state.overlays?.includes(overlayId)
    ? [...state.overlays]
    : [...(state.overlays || []), overlayId];
  const selections = typeof value === "string" && value.length > 0
    ? { ...(state.selections || {}), [selectionId]: value }
    : { ...(state.selections || {}) };
  return idleResult(state, { overlays, selections });
};

const filterSelectionKeys = new Set([
  "feedFilter",
  "mood",
  "routeFilter",
  "savedFilter",
  "situation",
  "time"
]);

const resetFilterSelections = (state) => idleResult(state, {
  selections: Object.fromEntries(Object.entries(state.selections || {}).filter(
    ([key]) => !filterSelectionKeys.has(key)
  ))
});

const updateField = (fieldId) => (state, payload) => idleResult(state, {
  form: { ...(state.form || {}), [fieldId]: payload?.value ?? "" }
});

const clearField = (fieldId) => (state) => idleResult(state, {
  form: { ...(state.form || {}), [fieldId]: "" }
});

const selectValue = (selectionId, fallbackKey) => (state, payload) => idleResult(state, {
  selections: {
    ...(state.selections || {}),
    [selectionId]: valueFrom(payload, fallbackKey)
  }
});

const toggleListValue = (stateKey, payloadKey) => (state, payload) => {
  const value = payload?.[payloadKey] ?? payload?.id;
  if (typeof value !== "string" || value.length === 0) return errorResult(state);

  const current = state[stateKey] || [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return idleResult(state, { [stateKey]: next });
};

const addListValue = (stateKey, payloadKey) => (state, payload) => {
  const value = payload?.[payloadKey] ?? payload?.id;
  if (typeof value !== "string" || value.length === 0) return errorResult(state);

  const current = state[stateKey] || [];
  return idleResult(state, {
    [stateKey]: current.includes(value) ? [...current] : [...current, value]
  });
};

const toggleSetting = (settingId) => (state, payload) => {
  const notifications = state.selections?.notifications || {};
  const checked = typeof payload?.checked === "boolean"
    ? payload.checked
    : !notifications[settingId];

  return idleResult(state, {
    selections: {
      ...(state.selections || {}),
      notifications: { ...notifications, [settingId]: checked }
    }
  });
};

const showToast = (kind, message) => (state) => ({
  state: { ...state, toast: { kind, message, duration: 2500 } },
  effect: "none"
});

const shareTarget = (targetType) => (state, payload) => ({
  state: {
    ...state,
    selections: {
      ...(state.selections || {}),
      shareTarget: {
        type: payload?.type || targetType,
        id: payload?.id || payload?.placeId || payload?.routeId || null
      }
    },
    toast: null
  },
  effect: "share"
});

const updateEmail = updateField("email");
const updatePassword = updateField("password");
const updateNewPassword = updateField("newPassword");
const updatePasswordConfirmation = updateField("passwordConfirmation");
const updateNickname = updateField("nickname");
const updateComment = updateField("comment");
const updateRouteName = updateField("routeName");
const updateBio = updateField("bio");
const updateCurrentPassword = updateField("currentPassword");
const updateMessage = updateField("message");
const savePlace = addListValue("savedPlaceIds", "placeId");
const toggleFollow = toggleListValue("followedUserIds", "userId");
const toggleMediaLike = toggleListValue("likedMediaIds", "mediaId");
const togglePlaceLike = toggleListValue("likedPlaceIds", "placeId");
const toggleCommentLike = toggleListValue("likedCommentIds", "commentId");
const addRoutePlace = addListValue("routePlaceIds", "placeId");
const noChange = (state) => idleResult(state);

function defineTransitions(screenId, handlers) {
  const expected = ACTIONS_BY_SCREEN[screenId];
  const actual = Object.keys(handlers);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Transition contract mismatch for ${screenId}`);
  }
  return Object.freeze(handlers);
}

export const TRANSITIONS = Object.freeze({
  a1: defineTransitions("a1", { start: navigateTo("a9"), login: navigateTo("a3") }),
  "a1-splash": defineTransitions("a1-splash", {}),
  a3: defineTransitions("a3", {
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": navigateTo("b1"),
    "forgot-password": navigateTo("a5")
  }),
  a4: defineTransitions("a4", {
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": navigateTo("b1"),
    "forgot-password": navigateTo("a5")
  }),
  a5: defineTransitions("a5", { "go-back": navigateBack, "update-email": updateEmail, "send-reset-email": navigateTo("a6") }),
  a6: defineTransitions("a6", { "go-back": navigateBack, "return-to-login": navigateTo("a3") }),
  a7: defineTransitions("a7", {
    "go-back": navigateBack,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": navigateTo("a3")
  }),
  a8: defineTransitions("a8", {
    "go-back": navigateBack,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": navigateTo("a3")
  }),
  a9: defineTransitions("a9", { "go-back": navigateBack, "update-email": updateEmail, "continue-sign-up": navigateTo("a12") }),
  a10: defineTransitions("a10", { "go-back": navigateBack, "update-email": updateEmail, "continue-sign-up": navigateTo("a12") }),
  a11: defineTransitions("a11", { "go-back": navigateBack, "update-email": updateEmail, "continue-sign-up": navigateTo("a12") }),
  a12: defineTransitions("a12", { "go-back": navigateBack, "update-password": updatePassword, "continue-sign-up": navigateTo("a14") }),
  a13: defineTransitions("a13", { "go-back": navigateBack, "update-password": updatePassword, "continue-sign-up": navigateTo("a14") }),
  a14: defineTransitions("a14", { "go-back": navigateBack, "select-birth-year": selectValue("birthYear"), "continue-sign-up": navigateTo("a15") }),
  a15: defineTransitions("a15", { "go-back": navigateBack, "select-gender": selectValue("gender"), "continue-sign-up": navigateTo("a16") }),
  a16: defineTransitions("a16", { "go-back": navigateBack, "update-nickname": updateNickname, "continue-sign-up": navigateTo("a18") }),
  a17: defineTransitions("a17", { "go-back": navigateBack, "update-nickname": updateNickname, "continue-sign-up": navigateTo("a18") }),
  a18: defineTransitions("a18", {
    "go-back": navigateBack,
    "select-place-source": selectValue("placeSource"),
    "choose-location": navigateTo("a20"),
    "skip-question": navigateTo("a19")
  }),
  a19: defineTransitions("a19", {
    "go-back": navigateBack,
    "select-referral-source": selectValue("referralSource"),
    "continue-sign-up": navigateTo("a20"),
    "skip-question": navigateTo("a20")
  }),
  a20: defineTransitions("a20", {
    "go-back": navigateBack,
    "select-neighborhood": selectValue("neighborhood"),
    "confirm-neighborhood": navigateTo("a21")
  }),
  a21: defineTransitions("a21", {}),
  a22: defineTransitions("a22", {}),
  b1: defineTransitions("b1", {
    "show-following": selectValue("feedTab"),
    "show-discover": navigateTo("b2"),
    "open-filter": selectValue("feedFilter"),
    "open-following-list": navigateTo("e7"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId"),
    "save-place": savePlace,
    "create-route": navigateTo("d1"),
    "scroll-to-top": noChange
  }),
  b2: defineTransitions("b2", {
    "show-following": navigateTo("b1"),
    "show-discover": selectValue("feedTab"),
    "open-filter": selectValue("feedFilter"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId")
  }),
  b3: defineTransitions("b3", {
    "go-back": navigateBack,
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId")
  }),
  b4: defineTransitions("b4", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-related-place": selectAndNavigate("b4", "selectedPlaceId", "placeId"),
    "toggle-comment-like": toggleCommentLike
  }),
  b5: defineTransitions("b5", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace
  }),
  b6: defineTransitions("b6", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-related-place": selectAndNavigate("b4", "selectedPlaceId", "placeId"),
    "toggle-comment-like": toggleCommentLike,
    "create-route": navigateTo("d1")
  }),
  b7: defineTransitions("b7", { "close-photo": navigateBack }),
  b8: defineTransitions("b8", {
    "close-comments": navigateBack,
    "update-comment": updateComment,
    "submit-comment": showToast("success", "댓글을 등록했어요"),
    "toggle-comment-like": toggleCommentLike
  }),
  b9: defineTransitions("b9", { "close-business-hours": navigateBack }),
  b10: defineTransitions("b10", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "toggle-comment-like": toggleCommentLike,
    "create-route": navigateTo("d1")
  }),
  c1: defineTransitions("c1", {
    "select-situation": selectValue("situation"),
    "select-time": selectValue("time"),
    "select-mood": selectValue("mood"),
    "apply-filters": navigateTo("c3"),
    "reset-filters": resetFilterSelections
  }),
  c2: defineTransitions("c2", {
    "select-situation": selectValue("situation"),
    "select-time": selectValue("time"),
    "select-mood": selectValue("mood"),
    "apply-filters": navigateTo("c3"),
    "reset-filters": resetFilterSelections
  }),
  c3: defineTransitions("c3", {
    "go-back": navigateBack,
    "select-filter-tag": selectValue("savedFilter"),
    "select-place": addRoutePlace,
    "toggle-place-like": togglePlaceLike,
    "replace-place": selectValue("replacementPlaceId", "placeId"),
    "confirm-place-selection": navigateTo("c4")
  }),
  c4: defineTransitions("c4", {
    "show-saved-places": navigateTo("c6"),
    "show-saved-routes": selectValue("savedTab"),
    "select-filter-tag": selectValue("savedFilter"),
    "open-route-map": selectAndNavigate("d9", "selectedRouteId", "routeId"),
    "open-route": selectAndNavigate("d10", "selectedRouteId", "routeId")
  }),
  c5: defineTransitions("c5", {
    "go-back": navigateBack,
    "close-place-card": clearSelection("selectedPlaceId"),
    "locate-user": noChange,
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId")
  }),
  c6: defineTransitions("c6", {
    "show-saved-places": selectValue("savedTab"),
    "show-saved-routes": navigateTo("c4"),
    "select-filter-tag": selectValue("savedFilter"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId"),
    "add-place-to-route": addRoutePlace
  }),
  d1: defineTransitions("d1", { "go-back": navigateBack, "locate-user": noChange, "start-nearby": navigateTo("d2") }),
  d2: defineTransitions("d2", {
    "go-back": navigateBack,
    "show-saved-places": selectValue("routeSourceTab"),
    "show-discover": navigateTo("d3"),
    "change-filter": selectValue("routeFilter"),
    "select-filter-tag": selectValue("routeFilter"),
    "add-place": addRoutePlace,
    "confirm-route-places": navigateTo("d4")
  }),
  d3: defineTransitions("d3", {
    "go-back": navigateBack,
    "show-saved-places": navigateTo("d2"),
    "show-discover": selectValue("routeSourceTab"),
    "change-filter": selectValue("routeFilter"),
    "select-filter-tag": selectValue("routeFilter"),
    "add-place": addRoutePlace,
    "confirm-route-places": navigateTo("d4")
  }),
  d4: defineTransitions("d4", {
    "go-back": navigateBack,
    "change-places": navigateTo("d2"),
    "create-route": navigateTo("d5"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c6"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e3")
  }),
  d5: defineTransitions("d5", {
    "go-back": navigateBack,
    "update-route-name": updateRouteName,
    "clear-route-name": clearField("routeName"),
    "save-route": navigateTo("d6"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c6"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e3")
  }),
  d6: defineTransitions("d6", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": navigateTo("d7"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c6"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e3")
  }),
  d7: defineTransitions("d7", { "go-back": navigateBack, "open-route-list": navigateTo("d8"), "stop-navigation": navigateBack }),
  d8: defineTransitions("d8", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": navigateTo("d7"),
    "replace-route-place": selectValue("replacementPlaceId", "placeId"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId")
  }),
  d9: defineTransitions("d9", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": navigateTo("d7"),
    "replace-route-place": selectValue("replacementPlaceId", "placeId"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId")
  }),
  d10: defineTransitions("d10", {
    "close-route": navigateBack,
    "open-share": shareTarget("route"),
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId")
  }),
  d11: defineTransitions("d11", {
    "go-back": navigateBack,
    "close-place-card": clearSelection("selectedPlaceId"),
    "locate-user": noChange,
    "start-nearby": navigateTo("d2")
  }),
  d12: defineTransitions("d12", { "open-photo-grid": navigateTo("d13") }),
  d13: defineTransitions("d13", {
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "open-photo-menu": openOverlay("photo-menu", "selectedMediaId", "mediaId")
  }),
  d14: defineTransitions("d14", {
    "go-back": navigateBack,
    "open-place": selectAndNavigate("b4", "selectedPlaceId", "placeId"),
    "toggle-place-like": togglePlaceLike
  }),
  e1: defineTransitions("e1", {
    "go-back": navigateBack,
    "edit-profile": navigateTo("e2"),
    "toggle-follow": toggleFollow,
    "open-media": selectAndNavigate("b7", "selectedMediaId", "mediaId")
  }),
  e2: defineTransitions("e2", {
    "go-back": navigateBack,
    "update-nickname": updateNickname,
    "update-bio": updateBio,
    "show-profile-places": selectValue("profileTab"),
    "show-profile-routes": selectValue("profileTab"),
    "save-profile": navigateTo("e1")
  }),
  e3: defineTransitions("e3", {
    "open-profile": selectAndNavigate("e1", "selectedUserId", "userId"),
    "open-account-settings": navigateTo("e4"),
    "open-notification-settings": navigateTo("e5"),
    "open-contact": navigateTo("e6"),
    "open-terms": selectValue("settingsSection")
  }),
  e4: defineTransitions("e4", {
    "go-back": navigateBack,
    "update-current-password": updateCurrentPassword,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": showToast("success", "비밀번호를 변경했어요"),
    "forgot-password": navigateTo("a5"),
    logout: navigateTo("a3"),
    "delete-account": navigateTo("a1")
  }),
  e5: defineTransitions("e5", {
    "go-back": navigateBack,
    "toggle-all-notifications": toggleSetting("all"),
    "toggle-saved-place-updates": toggleSetting("savedPlaceUpdates"),
    "toggle-route-recommendations": toggleSetting("routeRecommendations"),
    "toggle-comment-likes": toggleSetting("commentLikes"),
    "toggle-marketing": toggleSetting("marketing")
  }),
  e6: defineTransitions("e6", {
    "go-back": navigateBack,
    "update-message": updateMessage,
    "send-message": showToast("success", "문의를 보냈어요")
  }),
  e7: defineTransitions("e7", {
    "go-back": navigateBack,
    "toggle-follow": toggleFollow,
    "open-profile": selectAndNavigate("e1", "selectedUserId", "userId")
  })
});

export function dispatchAction(screenId, actionId, payload) {
  const state = payload?.state && typeof payload.state === "object"
    ? payload.state
    : DEFAULT_STATE;
  if (!Object.hasOwn(TRANSITIONS, screenId) || !Object.hasOwn(ACTIONS_BY_SCREEN, screenId)) {
    return errorResult(state, "이 동작은 아직 연결되지 않았어요");
  }

  const screenTransitions = TRANSITIONS[screenId];
  if (!Object.hasOwn(screenTransitions, actionId) || !ACTIONS_BY_SCREEN[screenId].includes(actionId)) {
    return errorResult(state, "이 동작은 아직 연결되지 않았어요");
  }

  const transition = screenTransitions[actionId];

  try {
    return transition(state, payload || {});
  } catch {
    return errorResult(state);
  }
}
