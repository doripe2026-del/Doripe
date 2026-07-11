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
    historyMode: "back",
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

const selectPlaceMediaAndNavigate = (nextScreenId) => (state, payload) => {
  const placeId = payload?.placeId ?? payload?.id;
  const mediaId = payload?.mediaId;
  const selections = { ...(state.selections || {}) };
  if (typeof placeId === "string" && placeId.length > 0) selections.selectedPlaceId = placeId;
  if (typeof mediaId === "string" && mediaId.length > 0) selections.selectedMediaId = mediaId;
  else delete selections.selectedMediaId;
  return navigateTo(nextScreenId)({ ...state, selections });
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

function hasFormKey(state, key) {
  return Object.hasOwn(state.form || {}, key);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}

function isValidPassword(value) {
  return typeof value === "string"
    && value.length >= 8
    && /[A-Za-z]/.test(value)
    && /\d/.test(value);
}

function submitLogin(state) {
  if (!hasFormKey(state, "email") || !hasFormKey(state, "password")) {
    return errorResult(state, "이메일과 비밀번호를 입력해 주세요");
  }
  const valid = state.form?.email?.trim().toLowerCase() === "dori@doripe.kr"
    && state.form?.password === "Doripe123";
  return navigateTo(valid ? "b1" : "a4")(state);
}

function sendResetEmail(state) {
  return hasFormKey(state, "email") && isValidEmail(state.form.email)
    ? navigateTo("a6")(state)
    : errorResult(state, "올바른 이메일을 입력해 주세요");
}

function saveResetPassword(state) {
  if (!hasFormKey(state, "newPassword") || !hasFormKey(state, "passwordConfirmation")) {
    return errorResult(state, "새 비밀번호를 모두 입력해 주세요");
  }
  const valid = isValidPassword(state.form?.newPassword)
    && state.form.newPassword === state.form?.passwordConfirmation;
  return navigateTo(valid ? "a3" : "a8")(state);
}

function continueFromEmail(state) {
  if (!hasFormKey(state, "email")) return errorResult(state, "이메일을 입력해 주세요");
  const email = state.form.email.trim().toLowerCase();
  if (!isValidEmail(email)) return navigateTo("a10")(state);
  if (email === "doripe@example.com") return navigateTo("a11")(state);
  return navigateTo("a12")(state);
}

function continueFromPassword(state) {
  if (!hasFormKey(state, "password")) return errorResult(state, "비밀번호를 입력해 주세요");
  return navigateTo(isValidPassword(state.form.password) ? "a14" : "a13")(state);
}

function continueFromBirthYear(state) {
  if (!hasFormKey(state, "birthYear")) return errorResult(state, "출생연도를 선택해 주세요");
  return /^\d{4}$/.test(state.form.birthYear)
    ? navigateTo("a15")(state)
    : errorResult(state, "출생연도를 선택해 주세요");
}

function continueFromGender(state) {
  if (!hasFormKey(state, "gender")) return errorResult(state, "성별을 선택해 주세요");
  return ["female", "male", "unspecified"].includes(state.form.gender)
    ? navigateTo("a16")(state)
    : errorResult(state, "성별을 선택해 주세요");
}

function continueFromNickname(state) {
  if (!hasFormKey(state, "nickname")) return errorResult(state, "닉네임을 입력해 주세요");
  const nickname = state.form.nickname.trim();
  return navigateTo(nickname.length >= 2 && nickname !== "도리" ? "a18" : "a17")(state);
}

function resendResetEmail(state) {
  return idleResult(state, {
    form: { ...(state.form || {}), resetEmailResent: true }
  });
}

function continueFromHabit(state) {
  return typeof state.form?.habit === "string" && state.form.habit.length > 0
    ? navigateTo("a20")(state)
    : errorResult(state, "장소 탐색 습관을 선택해 주세요");
}

function skipHabit(state) {
  return navigateTo("a19")({
    ...state,
    form: { ...(state.form || {}), habit: state.form?.habit || "unknown" }
  });
}

function continueFromSource(state) {
  return typeof state.form?.source === "string" && state.form.source.length > 0
    ? navigateTo("a20")(state)
    : errorResult(state, "알게 된 경로를 선택해 주세요");
}

function skipSource(state) {
  return navigateTo("a20")({
    ...state,
    form: { ...(state.form || {}), source: state.form?.source || "unknown" }
  });
}

function confirmNeighborhood(state) {
  return typeof state.form?.neighborhoodId === "string" && state.form.neighborhoodId.length > 0
    ? navigateTo("a21")(state)
    : errorResult(state, "동네를 선택해 주세요");
}

const selectCanonicalValue = (selectionId, formId) => (state, payload) => {
  const value = valueFrom(payload);
  return idleResult(state, {
    selections: { ...(state.selections || {}), [selectionId]: value },
    form: { ...(state.form || {}), [formId]: value }
  });
};

const savePlace = addListValue("savedPlaceIds", "placeId");
const toggleFollow = toggleListValue("followedUserIds", "userId");
const toggleMediaLike = toggleListValue("likedMediaIds", "mediaId");
const togglePlaceLike = toggleListValue("likedPlaceIds", "placeId");
const toggleCommentLike = toggleListValue("likedCommentIds", "commentId");
const addRoutePlace = addListValue("routePlaceIds", "placeId");
const noChange = (state) => idleResult(state);

function submitComment(state, payload) {
  const body = state.form?.comment?.trim();
  const placeId = state.selections?.selectedPlaceId || payload?.placeId;
  if (!body || !placeId) return errorResult(state, "댓글을 입력해 주세요");
  const submittedComments = state.submittedComments || [];
  const comment = {
    id: `local-comment-${submittedComments.length + 1}`,
    placeId,
    userId: "user-1",
    body,
    likeCount: 0,
    createdAt: "local"
  };
  return {
    state: {
      ...state,
      submittedComments: [...submittedComments, comment],
      form: { ...(state.form || {}), comment: "" },
      toast: { kind: "success", message: "댓글을 등록했어요", duration: 2500 }
    },
    effect: "none"
  };
}

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
    "submit-login": submitLogin,
    "forgot-password": navigateTo("a5")
  }),
  a4: defineTransitions("a4", {
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": submitLogin,
    "forgot-password": navigateTo("a5")
  }),
  a5: defineTransitions("a5", { "go-back": navigateBack, "update-email": updateEmail, "send-reset-email": sendResetEmail }),
  a6: defineTransitions("a6", {
    "go-back": navigateBack,
    "return-to-login": navigateTo("a3"),
    "resend-reset-email": resendResetEmail
  }),
  a7: defineTransitions("a7", {
    "go-back": navigateBack,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": saveResetPassword
  }),
  a8: defineTransitions("a8", {
    "go-back": navigateBack,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": saveResetPassword
  }),
  a9: defineTransitions("a9", { "go-back": navigateBack, "update-email": updateEmail, "continue-sign-up": continueFromEmail }),
  a10: defineTransitions("a10", { "go-back": navigateBack, "update-email": updateEmail, "continue-sign-up": continueFromEmail }),
  a11: defineTransitions("a11", { "go-back": navigateBack, "update-email": updateEmail, "continue-sign-up": continueFromEmail }),
  a12: defineTransitions("a12", { "go-back": navigateBack, "update-password": updatePassword, "continue-sign-up": continueFromPassword }),
  a13: defineTransitions("a13", { "go-back": navigateBack, "update-password": updatePassword, "continue-sign-up": continueFromPassword }),
  a14: defineTransitions("a14", { "go-back": navigateBack, "select-birth-year": selectCanonicalValue("birthYear", "birthYear"), "continue-sign-up": continueFromBirthYear }),
  a15: defineTransitions("a15", { "go-back": navigateBack, "select-gender": selectCanonicalValue("gender", "gender"), "continue-sign-up": continueFromGender }),
  a16: defineTransitions("a16", { "go-back": navigateBack, "update-nickname": updateNickname, "continue-sign-up": continueFromNickname }),
  a17: defineTransitions("a17", { "go-back": navigateBack, "update-nickname": updateNickname, "continue-sign-up": continueFromNickname }),
  a18: defineTransitions("a18", {
    "go-back": navigateBack,
    "select-place-source": selectCanonicalValue("placeSource", "habit"),
    "choose-location": continueFromHabit,
    "skip-question": skipHabit
  }),
  a19: defineTransitions("a19", {
    "go-back": navigateBack,
    "select-referral-source": selectCanonicalValue("referralSource", "source"),
    "continue-sign-up": continueFromSource,
    "skip-question": skipSource
  }),
  a20: defineTransitions("a20", {
    "go-back": navigateBack,
    "select-neighborhood": selectCanonicalValue("neighborhood", "neighborhoodId"),
    "confirm-neighborhood": confirmNeighborhood
  }),
  a21: defineTransitions("a21", {}),
  a22: defineTransitions("a22", {}),
  b1: defineTransitions("b1", {
    "show-following": selectValue("feedTab"),
    "show-discover": navigateTo("b2"),
    "open-filter": selectValue("feedFilter"),
    "open-following-list": navigateTo("b13"),
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-place": selectPlaceMediaAndNavigate("b4"),
    "create-route": navigateTo("d1"),
    "scroll-to-top": noChange
  }),
  b2: defineTransitions("b2", {
    "show-following": navigateTo("b1"),
    "show-discover": selectValue("feedTab"),
    "open-filter": selectValue("feedFilter"),
    "open-place": selectPlaceMediaAndNavigate("b4")
  }),
  b3: defineTransitions("b3", {
    "go-back": navigateBack,
    "open-place": selectPlaceMediaAndNavigate("b4")
  }),
  b4: defineTransitions("b4", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": selectAndNavigate("b8", "selectedPlaceId", "placeId"),
    "open-business-hours": navigateTo("b9"),
    "open-place-map": selectAndNavigate("c4", "selectedPlaceId", "placeId"),
    "open-menu": openOverlay("place-menu", "selectedPlaceId", "placeId"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-official-place": selectAndNavigate("b10", "selectedPlaceId", "placeId"),
    "open-related-place": selectPlaceMediaAndNavigate("b10"),
    "toggle-comment-like": toggleCommentLike
  }),
  b5: defineTransitions("b5", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": selectAndNavigate("b8", "selectedPlaceId", "placeId"),
    "open-business-hours": navigateTo("b9"),
    "open-place-map": selectAndNavigate("c4", "selectedPlaceId", "placeId"),
    "open-menu": openOverlay("place-menu", "selectedPlaceId", "placeId"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-official-place": selectAndNavigate("b10", "selectedPlaceId", "placeId")
  }),
  b6: defineTransitions("b6", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": selectAndNavigate("b8", "selectedPlaceId", "placeId"),
    "open-business-hours": navigateTo("b9"),
    "open-place-map": selectAndNavigate("c4", "selectedPlaceId", "placeId"),
    "open-menu": openOverlay("place-menu", "selectedPlaceId", "placeId"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "open-official-place": selectAndNavigate("b10", "selectedPlaceId", "placeId"),
    "open-related-place": selectPlaceMediaAndNavigate("b10"),
    "toggle-comment-like": toggleCommentLike,
    "create-route": navigateTo("d1")
  }),
  b7: defineTransitions("b7", {
    "close-photo": navigateBack,
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-official-place": selectAndNavigate("b10", "selectedPlaceId", "placeId")
  }),
  b8: defineTransitions("b8", {
    "close-comments": navigateBack,
    "update-comment": updateComment,
    "submit-comment": submitComment,
    "toggle-comment-like": toggleCommentLike,
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId")
  }),
  b9: defineTransitions("b9", { "close-business-hours": navigateBack }),
  b10: defineTransitions("b10", {
    "close-place": navigateBack,
    "open-photo": selectAndNavigate("b7", "selectedMediaId", "mediaId"),
    "toggle-media-like": toggleMediaLike,
    "open-comments": selectAndNavigate("b8", "selectedPlaceId", "placeId"),
    "open-business-hours": navigateTo("b9"),
    "open-place-map": selectAndNavigate("c4", "selectedPlaceId", "placeId"),
    "open-menu": openOverlay("place-menu", "selectedPlaceId", "placeId"),
    "open-share": shareTarget("place"),
    "save-place": savePlace,
    "toggle-comment-like": toggleCommentLike,
    "create-route": navigateTo("d4"),
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-other-media": navigateTo("b3"),
    "open-related-places": navigateTo("b11")
  }),
  b11: defineTransitions("b11", {
    "go-back": navigateBack,
    "open-place": selectPlaceMediaAndNavigate("b10"),
    "toggle-place-like": togglePlaceLike
  }),
  b12: defineTransitions("b12", {
    "go-back": navigateBack,
    "toggle-follow": toggleFollow,
    "open-content": selectPlaceMediaAndNavigate("b4")
  }),
  b13: defineTransitions("b13", {
    "go-back": navigateBack,
    "toggle-follow": toggleFollow,
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId")
  }),
  c1: defineTransitions("c1", {
    "show-saved-places": selectValue("savedTab"),
    "show-saved-routes": navigateTo("c2"),
    "select-filter-tag": selectValue("savedFilter"),
    "open-place": selectAndNavigate("c4", "selectedPlaceId", "placeId"),
    "add-place-to-route": addRoutePlace
  }),
  c2: defineTransitions("c2", {
    "show-saved-places": navigateTo("c1"),
    "show-saved-routes": selectValue("savedTab"),
    "select-filter-tag": selectValue("savedFilter"),
    "open-route-map": openOverlay("saved-route-map", "selectedRouteId", "routeId"),
    "open-route": selectAndNavigate("c6", "selectedRouteId", "routeId")
  }),
  c3: defineTransitions("c3", {
    "select-situation": selectValue("situation"),
    "select-time": selectValue("time"),
    "select-mood": selectValue("mood"),
    "apply-filters": navigateTo("c1"),
    "reset-filters": resetFilterSelections
  }),
  c4: defineTransitions("c4", {
    "go-back": navigateBack,
    "close-place-card": clearSelection("selectedPlaceId"),
    "locate-user": noChange,
    "open-place": selectAndNavigate("b10", "selectedPlaceId", "placeId")
  }),
  c6: defineTransitions("c6", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": openOverlay("external-map"),
    "replace-route-place": selectAndNavigate("c7", "selectedPlaceId", "placeId"),
    "open-place": selectAndNavigate("b10", "selectedPlaceId", "placeId")
  }),
  c7: defineTransitions("c7", {
    "go-back": navigateBack,
    "select-filter-tag": selectValue("savedFilter"),
    "select-place": addRoutePlace,
    "toggle-place-like": togglePlaceLike,
    "replace-place": selectValue("replacementPlaceId", "placeId"),
    "confirm-place-selection": navigateTo("c6")
  }),
  d1: defineTransitions("d1", {
    "select-start-place": selectAndNavigate("d4", "selectedPlaceId", "placeId"),
    "open-photo-menu": openOverlay("photo-menu", "selectedMediaId", "mediaId")
  }),
  d2: defineTransitions("d2", {
    "go-back": navigateBack,
    "locate-user": noChange,
    "confirm-start-location": navigateTo("d4")
  }),
  d3: defineTransitions("d3", {
    "select-start-place": selectAndNavigate("d4", "selectedPlaceId", "placeId")
  }),
  d4: defineTransitions("d4", {
    "go-back": navigateBack,
    "close-place-card": clearSelection("selectedPlaceId"),
    "locate-user": noChange,
    "confirm-start-place": navigateTo("d5")
  }),
  d5: defineTransitions("d5", {
    "go-back": navigateBack,
    "show-saved-places": selectValue("routeSourceTab"),
    "show-discover": navigateTo("d6"),
    "change-filter": selectValue("routeFilter"),
    "select-filter-tag": selectValue("routeFilter"),
    "add-place": addRoutePlace,
    "confirm-route-places": navigateTo("d7")
  }),
  d6: defineTransitions("d6", {
    "go-back": navigateBack,
    "show-saved-places": navigateTo("d5"),
    "show-discover": selectValue("routeSourceTab"),
    "change-filter": selectValue("routeFilter"),
    "select-filter-tag": selectValue("routeFilter"),
    "add-place": addRoutePlace,
    "confirm-route-places": navigateTo("d7")
  }),
  d7: defineTransitions("d7", {
    "go-back": navigateBack,
    "change-places": navigateTo("d5"),
    "create-route": navigateTo("d8"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c1"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e1")
  }),
  d8: defineTransitions("d8", {
    "go-back": navigateBack,
    "update-route-name": updateRouteName,
    "clear-route-name": clearField("routeName"),
    "save-route": navigateTo("d9"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c1"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e1")
  }),
  d9: defineTransitions("d9", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": openOverlay("external-map"),
    "open-place": selectAndNavigate("b10", "selectedPlaceId", "placeId"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c1"),
    "open-routes": navigateTo("d1"),
    "open-settings": navigateTo("e1")
  }),
  e1: defineTransitions("e1", {
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-account-settings": navigateTo("e3"),
    "open-notification-settings": navigateTo("e4"),
    "open-contact": navigateTo("e5"),
    "open-terms": selectValue("settingsSection")
  }),
  e2: defineTransitions("e2", {
    "go-back": navigateBack,
    "update-nickname": updateNickname,
    "update-bio": updateBio,
    "show-profile-places": selectValue("profileTab"),
    "show-profile-routes": selectValue("profileTab"),
    "edit-media": openOverlay("media-editor", "selectedMediaId", "mediaId"),
    "save-profile": navigateTo("e1")
  }),
  e3: defineTransitions("e3", {
    "go-back": navigateBack,
    "update-current-password": updateCurrentPassword,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": showToast("success", "비밀번호를 변경했어요"),
    "forgot-password": navigateTo("a5"),
    logout: navigateTo("a3"),
    "delete-account": navigateTo("a1")
  }),
  e4: defineTransitions("e4", {
    "go-back": navigateBack,
    "toggle-all-notifications": toggleSetting("all"),
    "toggle-saved-place-updates": toggleSetting("savedPlaceUpdates"),
    "toggle-route-recommendations": toggleSetting("routeRecommendations"),
    "toggle-comment-likes": toggleSetting("commentLikes"),
    "toggle-marketing": toggleSetting("marketing")
  }),
  e5: defineTransitions("e5", {
    "go-back": navigateBack,
    "update-message": updateMessage,
    "send-message": showToast("success", "문의를 보냈어요")
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
