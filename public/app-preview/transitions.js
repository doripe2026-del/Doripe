import { DEFAULT_STATE } from "./state.js";

const freezeActions = (actions) => Object.freeze(actions);

export const ACTIONS_BY_SCREEN = Object.freeze({
  a1: freezeActions(["start", "login"]),
  "a1-splash": freezeActions([]),
  a3: freezeActions(["update-email", "update-password", "create-account", "submit-login", "forgot-password"]),
  a4: freezeActions(["update-email", "update-password", "create-account", "submit-login", "forgot-password"]),
  a5: freezeActions(["go-back", "update-email", "send-reset-email"]),
  a6: freezeActions(["go-back", "return-to-login"]),
  a7: freezeActions(["go-back", "update-new-password", "update-password-confirmation", "save-password"]),
  a8: freezeActions(["go-back", "update-new-password", "update-password-confirmation", "save-password"]),
  a9: freezeActions(["go-back", "update-email", "continue-sign-up"]),
  a10: freezeActions(["go-back", "update-email", "continue-sign-up"]),
  a11: freezeActions(["go-back", "update-email", "continue-sign-up"]),
  a12: freezeActions(["go-back", "update-password", "continue-sign-up"]),
  a13: freezeActions(["go-back", "update-password", "continue-sign-up"]),
  a14: freezeActions(["go-back", "select-birth-year", "continue-sign-up"]),
  a15: freezeActions(["go-back", "select-gender", "continue-sign-up"]),
  a16: freezeActions(["go-back", "update-nickname", "continue-sign-up"]),
  a17: freezeActions(["go-back", "update-nickname", "continue-sign-up"]),
  a18: freezeActions(["go-back", "select-place-source", "choose-location", "skip-question"]),
  a19: freezeActions(["go-back", "select-referral-source", "continue-sign-up", "skip-question"]),
  a20: freezeActions(["go-back", "select-neighborhood", "locate-neighborhood", "confirm-neighborhood"]),
  a21: freezeActions([]),
  a22: freezeActions([]),
  b1: freezeActions(["show-following", "show-discover", "open-filter", "open-following-list", "open-place", "save-place", "create-route", "scroll-to-top"]),
  b2: freezeActions(["show-following", "show-discover", "open-filter", "open-place", "save-place"]),
  b3: freezeActions(["go-back", "open-place", "save-place", "toggle-media-like", "open-filter"]),
  b4: freezeActions(["go-back", "open-photo", "toggle-media-like", "open-comments", "open-business-hours", "open-share", "save-place", "open-related-place", "create-route"]),
  b5: freezeActions(["go-back", "open-photo", "toggle-media-like", "open-comments", "open-business-hours", "open-share", "save-place", "open-related-place"]),
  b6: freezeActions(["go-back", "open-photo", "toggle-media-like", "open-comments", "open-business-hours", "open-share", "save-place", "open-related-place", "create-route"]),
  b7: freezeActions(["close-photo"]),
  b8: freezeActions(["close-comments", "update-comment", "submit-comment", "toggle-comment-like"]),
  b9: freezeActions(["close-business-hours"]),
  b10: freezeActions(["go-back", "open-photo", "toggle-media-like", "open-comments", "open-business-hours", "open-share", "save-place", "open-related-place", "create-route"]),
  c1: freezeActions(["select-situation", "select-time", "select-mood", "apply-filters", "reset-filters"]),
  c2: freezeActions(["select-situation", "select-time", "select-mood", "apply-filters", "reset-filters"]),
  c3: freezeActions(["go-back", "select-filter-tag", "select-place", "toggle-place-like", "replace-place", "confirm-place-selection"]),
  c4: freezeActions(["show-saved-places", "show-saved-routes", "select-filter-tag", "open-route", "open-place-map"]),
  c5: freezeActions(["go-back", "close-place-card", "locate-user", "open-place"]),
  c6: freezeActions(["show-saved-places", "show-saved-routes", "select-filter-tag", "open-place", "add-place-to-route"]),
  d1: freezeActions(["go-back", "locate-user", "start-nearby"]),
  d2: freezeActions(["go-back", "show-saved-places", "show-discover", "select-filter-tag", "add-place", "confirm-route-places"]),
  d3: freezeActions(["go-back", "show-saved-places", "show-discover", "select-filter-tag", "add-place", "confirm-route-places"]),
  d4: freezeActions(["go-back", "change-places", "create-route", "open-discover", "open-saved", "open-routes", "open-settings"]),
  d5: freezeActions(["go-back", "update-route-name", "clear-route-name", "save-route", "open-discover", "open-saved", "open-routes", "open-settings"]),
  d6: freezeActions(["go-back", "open-share", "start-navigation", "open-place", "open-discover", "open-saved", "open-routes", "open-settings"]),
  d7: freezeActions(["go-back", "open-route-list", "stop-navigation"]),
  d8: freezeActions(["go-back", "open-share", "start-navigation", "replace-route-place", "open-place"]),
  d9: freezeActions(["go-back", "open-share", "start-navigation", "replace-route-place", "open-place"]),
  d10: freezeActions(["open-share", "replace-route-place", "open-place"]),
  d11: freezeActions(["go-back", "close-place-card", "locate-user", "start-nearby"]),
  d12: freezeActions(["open-photo-grid"]),
  d13: freezeActions([]),
  d14: freezeActions(["go-back", "select-place", "toggle-place-like", "open-place"]),
  e1: freezeActions(["go-back", "edit-profile", "toggle-follow", "open-media"]),
  e2: freezeActions(["go-back", "update-nickname", "update-bio", "show-profile-places", "show-profile-routes", "save-profile", "open-media"]),
  e3: freezeActions(["open-profile", "open-account-settings", "open-notification-settings", "open-contact", "open-terms"]),
  e4: freezeActions(["go-back", "update-current-password", "update-new-password", "update-password-confirmation", "save-password", "forgot-password", "logout", "delete-account"]),
  e5: freezeActions(["go-back", "toggle-all-notifications", "toggle-saved-place-updates", "toggle-route-recommendations", "toggle-comment-likes", "toggle-marketing"]),
  e6: freezeActions(["go-back", "update-message", "send-message"]),
  e7: freezeActions(["go-back", "toggle-follow"])
});

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

export const TRANSITIONS = Object.freeze({
  a1: Object.freeze({ start: navigateTo("a9"), login: navigateTo("a3") }),
  "a1-splash": Object.freeze({}),
  a3: Object.freeze({
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": navigateTo("b1"),
    "forgot-password": navigateTo("a5")
  }),
  a4: Object.freeze({
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": navigateTo("b1"),
    "forgot-password": navigateTo("a5")
  }),
  a5: Object.freeze({ "go-back": navigateTo("a3"), "update-email": updateEmail, "send-reset-email": navigateTo("a6") }),
  a6: Object.freeze({ "go-back": navigateTo("a5"), "return-to-login": navigateTo("a3") }),
  a7: Object.freeze({
    "go-back": navigateTo("a6"),
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": navigateTo("a3")
  }),
  a8: Object.freeze({
    "go-back": navigateTo("a7"),
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": navigateTo("a3")
  }),
  a9: Object.freeze({ "go-back": navigateTo("a1"), "update-email": updateEmail, "continue-sign-up": navigateTo("a12") }),
  a10: Object.freeze({ "go-back": navigateTo("a9"), "update-email": updateEmail, "continue-sign-up": navigateTo("a12") }),
  a11: Object.freeze({ "go-back": navigateTo("a9"), "update-email": updateEmail, "continue-sign-up": navigateTo("a12") }),
  a12: Object.freeze({ "go-back": navigateTo("a9"), "update-password": updatePassword, "continue-sign-up": navigateTo("a14") }),
  a13: Object.freeze({ "go-back": navigateTo("a12"), "update-password": updatePassword, "continue-sign-up": navigateTo("a14") }),
  a14: Object.freeze({ "go-back": navigateTo("a13"), "select-birth-year": selectValue("birthYear"), "continue-sign-up": navigateTo("a15") }),
  a15: Object.freeze({ "go-back": navigateTo("a14"), "select-gender": selectValue("gender"), "continue-sign-up": navigateTo("a16") }),
  a16: Object.freeze({ "go-back": navigateTo("a15"), "update-nickname": updateNickname, "continue-sign-up": navigateTo("a18") }),
  a17: Object.freeze({ "go-back": navigateTo("a16"), "update-nickname": updateNickname, "continue-sign-up": navigateTo("a18") }),
  a18: Object.freeze({
    "go-back": navigateTo("a16"),
    "select-place-source": selectValue("placeSource"),
    "choose-location": navigateTo("a20"),
    "skip-question": navigateTo("a19")
  }),
  a19: Object.freeze({
    "go-back": navigateTo("a18"),
    "select-referral-source": selectValue("referralSource"),
    "continue-sign-up": navigateTo("a20"),
    "skip-question": navigateTo("a20")
  }),
  a20: Object.freeze({
    "go-back": navigateTo("a19"),
    "select-neighborhood": selectValue("neighborhood"),
    "locate-neighborhood": selectValue("neighborhood", "id"),
    "confirm-neighborhood": navigateTo("a21")
  }),
  a21: Object.freeze({}),
  a22: Object.freeze({}),
  b1: Object.freeze({
    "show-following": selectValue("feedTab"),
    "show-discover": navigateTo("b2"),
    "open-filter": selectValue("feedFilter"),
    "open-following-list": navigateTo("e7"),
    "open-place": navigateTo("b4"),
    "save-place": savePlace,
    "create-route": navigateTo("d1"),
    "scroll-to-top": noChange
  }),
  b2: Object.freeze({
    "show-following": navigateTo("b1"),
    "show-discover": selectValue("feedTab"),
    "open-filter": selectValue("feedFilter"),
    "open-place": navigateTo("b4"),
    "save-place": savePlace
  }),
  b3: Object.freeze({
    "go-back": navigateTo("b2"),
    "open-place": navigateTo("b4"),
    "save-place": savePlace,
    "toggle-media-like": toggleMediaLike,
    "open-filter": selectValue("feedFilter")
  }),
  b4: Object.freeze({
    "go-back": navigateTo("b3"),
    "open-photo": navigateTo("b7"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-related-place": navigateTo("b4"),
    "create-route": navigateTo("d1")
  }),
  b5: Object.freeze({
    "go-back": navigateTo("b3"),
    "open-photo": navigateTo("b7"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-related-place": navigateTo("b4")
  }),
  b6: Object.freeze({
    "go-back": navigateTo("b3"),
    "open-photo": navigateTo("b7"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-related-place": navigateTo("b4"),
    "create-route": navigateTo("d1")
  }),
  b7: Object.freeze({ "close-photo": navigateTo("b4") }),
  b8: Object.freeze({
    "close-comments": navigateTo("b4"),
    "update-comment": updateComment,
    "submit-comment": showToast("success", "댓글을 등록했어요"),
    "toggle-comment-like": toggleCommentLike
  }),
  b9: Object.freeze({ "close-business-hours": navigateTo("b4") }),
  b10: Object.freeze({
    "go-back": navigateTo("b3"),
    "open-photo": navigateTo("b7"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": navigateTo("b8"),
    "open-business-hours": navigateTo("b9"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-related-place": navigateTo("b4"),
    "create-route": navigateTo("d1")
  }),
  c1: Object.freeze({
    "select-situation": selectValue("situation"),
    "select-time": selectValue("time"),
    "select-mood": selectValue("mood"),
    "apply-filters": navigateTo("c3"),
    "reset-filters": (state) => idleResult(state, { selections: {} })
  }),
  c2: Object.freeze({
    "select-situation": selectValue("situation"),
    "select-time": selectValue("time"),
    "select-mood": selectValue("mood"),
    "apply-filters": navigateTo("c3"),
    "reset-filters": (state) => idleResult(state, { selections: {} })
  }),
  c3: Object.freeze({
    "go-back": navigateTo("c1"),
    "select-filter-tag": selectValue("savedFilter"),
    "select-place": addRoutePlace,
    "toggle-place-like": togglePlaceLike,
    "replace-place": selectValue("replacementPlaceId", "placeId"),
    "confirm-place-selection": navigateTo("c4")
  }),
  c4: Object.freeze({
    "show-saved-places": navigateTo("c6"),
    "show-saved-routes": selectValue("savedTab"),
    "select-filter-tag": selectValue("savedFilter"),
    "open-route": navigateTo("d10"),
    "open-place-map": navigateTo("c5")
  }),
  c5: Object.freeze({
    "go-back": navigateTo("c4"),
    "close-place-card": noChange,
    "locate-user": noChange,
    "open-place": navigateTo("b4")
  }),
  c6: Object.freeze({
    "show-saved-places": selectValue("savedTab"),
    "show-saved-routes": navigateTo("c4"),
    "select-filter-tag": selectValue("savedFilter"),
    "open-place": navigateTo("b4"),
    "add-place-to-route": addRoutePlace
  }),
  d1: Object.freeze({ "go-back": navigateTo("c6"), "locate-user": noChange, "start-nearby": navigateTo("d2") }),
  d2: Object.freeze({
    "go-back": navigateTo("d1"),
    "show-saved-places": selectValue("routeSourceTab"),
    "show-discover": navigateTo("d3"),
    "select-filter-tag": selectValue("routeFilter"),
    "add-place": addRoutePlace,
    "confirm-route-places": navigateTo("d4")
  }),
  d3: Object.freeze({
    "go-back": navigateTo("d1"),
    "show-saved-places": navigateTo("d2"),
    "show-discover": selectValue("routeSourceTab"),
    "select-filter-tag": selectValue("routeFilter"),
    "add-place": addRoutePlace,
    "confirm-route-places": navigateTo("d4")
  }),
  d4: Object.freeze({
    "go-back": navigateTo("d3"),
    "change-places": navigateTo("d2"),
    "create-route": navigateTo("d5"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c6"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e3")
  }),
  d5: Object.freeze({
    "go-back": navigateTo("d4"),
    "update-route-name": updateRouteName,
    "clear-route-name": clearField("routeName"),
    "save-route": navigateTo("d6"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c6"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e3")
  }),
  d6: Object.freeze({
    "go-back": navigateTo("d5"),
    "open-share": shareTarget("route"),
    "start-navigation": navigateTo("d7"),
    "open-place": navigateTo("b4"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c6"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e3")
  }),
  d7: Object.freeze({ "go-back": navigateTo("d6"), "open-route-list": navigateTo("d8"), "stop-navigation": navigateTo("d6") }),
  d8: Object.freeze({
    "go-back": navigateTo("d7"),
    "open-share": shareTarget("route"),
    "start-navigation": navigateTo("d7"),
    "replace-route-place": selectValue("replacementPlaceId", "placeId"),
    "open-place": navigateTo("b4")
  }),
  d9: Object.freeze({
    "go-back": navigateTo("d6"),
    "open-share": shareTarget("route"),
    "start-navigation": navigateTo("d7"),
    "replace-route-place": selectValue("replacementPlaceId", "placeId"),
    "open-place": navigateTo("b4")
  }),
  d10: Object.freeze({
    "open-share": shareTarget("route"),
    "replace-route-place": selectValue("replacementPlaceId", "placeId"),
    "open-place": navigateTo("b4")
  }),
  d11: Object.freeze({
    "go-back": navigateTo("d3"),
    "close-place-card": noChange,
    "locate-user": noChange,
    "start-nearby": navigateTo("d2")
  }),
  d12: Object.freeze({ "open-photo-grid": navigateTo("d13") }),
  d13: Object.freeze({}),
  d14: Object.freeze({
    "go-back": navigateTo("d3"),
    "select-place": addRoutePlace,
    "toggle-place-like": togglePlaceLike,
    "open-place": navigateTo("b4")
  }),
  e1: Object.freeze({
    "go-back": navigateTo("b1"),
    "edit-profile": navigateTo("e2"),
    "toggle-follow": toggleFollow,
    "open-media": navigateTo("b7")
  }),
  e2: Object.freeze({
    "go-back": navigateTo("e1"),
    "update-nickname": updateNickname,
    "update-bio": updateBio,
    "show-profile-places": selectValue("profileTab"),
    "show-profile-routes": selectValue("profileTab"),
    "save-profile": navigateTo("e1"),
    "open-media": navigateTo("b7")
  }),
  e3: Object.freeze({
    "open-profile": navigateTo("e1"),
    "open-account-settings": navigateTo("e4"),
    "open-notification-settings": navigateTo("e5"),
    "open-contact": navigateTo("e6"),
    "open-terms": selectValue("settingsSection")
  }),
  e4: Object.freeze({
    "go-back": navigateTo("e3"),
    "update-current-password": updateCurrentPassword,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": showToast("success", "비밀번호를 변경했어요"),
    "forgot-password": navigateTo("a5"),
    logout: navigateTo("a3"),
    "delete-account": navigateTo("a1")
  }),
  e5: Object.freeze({
    "go-back": navigateTo("e3"),
    "toggle-all-notifications": toggleSetting("all"),
    "toggle-saved-place-updates": toggleSetting("savedPlaceUpdates"),
    "toggle-route-recommendations": toggleSetting("routeRecommendations"),
    "toggle-comment-likes": toggleSetting("commentLikes"),
    "toggle-marketing": toggleSetting("marketing")
  }),
  e6: Object.freeze({
    "go-back": navigateTo("e3"),
    "update-message": updateMessage,
    "send-message": showToast("success", "문의를 보냈어요")
  }),
  e7: Object.freeze({ "go-back": navigateTo("e1"), "toggle-follow": toggleFollow })
});

export function dispatchAction(screenId, actionId, payload) {
  const state = payload?.state && typeof payload.state === "object"
    ? payload.state
    : DEFAULT_STATE;
  const transition = TRANSITIONS[screenId]?.[actionId];

  if (typeof transition !== "function") {
    return errorResult(state, "이 동작은 아직 연결되지 않았어요");
  }

  try {
    return transition(state, payload || {});
  } catch {
    return errorResult(state);
  }
}
