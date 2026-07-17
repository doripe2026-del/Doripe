import actionContract from "./figma/action-contract.json" with { type: "json" };
import inventory from "./figma/screen-inventory.json" with { type: "json" };
import {
  DEFAULT_STATE,
  normalizePreviewState,
  savePlaceId,
  stripSensitivePreviewData,
  unsavePlaceId
} from "./state.js";
import { contentById, courseById, placeById, profileById, viewerProfile } from "./data/selectors.js";

const contractActionsByScreen = new Map();
for (const record of actionContract.actions) {
  const actionIds = contractActionsByScreen.get(record.screenId) || [];
  if (!actionIds.includes(record.actionId)) actionIds.push(record.actionId);
  contractActionsByScreen.set(record.screenId, actionIds);
}

function placeFor(payload, placeId) {
  return payload?.data ? placeById(payload.data, placeId) : null;
}

function courseFor(payload, courseId) {
  return payload?.data ? courseById(payload.data, courseId) : null;
}

function profileFor(payload, profileId) {
  return payload?.data ? profileById(payload.data, profileId) : null;
}

function catalogFor(payload) {
  return {
    isKnownPlaceId: (placeId) => Boolean(placeFor(payload, placeId)),
    isKnownCourseId: (courseId) => Boolean(courseFor(payload, courseId))
  };
}

function normalizeState(state, payload) {
  return normalizePreviewState(state, catalogFor(payload));
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
  delete selections.detailSheetState;
  if (typeof placeId === "string" && placeId.length > 0) selections.selectedPlaceId = placeId;
  if (typeof mediaId === "string" && mediaId.length > 0) selections.selectedMediaId = mediaId;
  else delete selections.selectedMediaId;
  return navigateTo(nextScreenId)({ ...state, selections });
};

const startNewCourse = (nextScreenId) => (state) => {
  const selections = { ...(state.selections || {}) };
  delete selections.selectedRouteId;
  delete selections.selectedPlaceId;
  delete selections.startPlaceCardOpen;
  return navigateTo(nextScreenId)({
    ...state,
    selections,
    routeDraft: { startPlaceId: null, placeIds: [] },
    routePlaceIds: []
  });
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
  "locationCenter",
  "locationMode",
  "locationPickerOpen",
  "locationRadiusKm",
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

const volatileSecrets = new Map();
const passwordFieldPattern = /password/i;
const sessionSelectionKeys = new Set(["accessToken", "authenticated", "refreshToken", "session"]);

function updateSecretField(fieldId) {
  return (state, payload) => {
    volatileSecrets.set(fieldId, payload?.value ?? "");
    return idleResult(state);
  };
}

function secretValue(state, fieldId) {
  return typeof state.form?.[fieldId] === "string"
    ? state.form[fieldId]
    : volatileSecrets.get(fieldId);
}

function clearSecrets() {
  volatileSecrets.clear();
}

export function clearVolatilePasswords() {
  clearSecrets();
}

export function volatilePasswordValue(fieldId, fallback = "") {
  if (!passwordFieldPattern.test(fieldId)) return fallback;
  return volatileSecrets.has(fieldId) ? volatileSecrets.get(fieldId) : fallback;
}

function scrubSensitiveState(state, { session = false } = {}) {
  const scrubbed = stripSensitivePreviewData(state) || {};
  const form = { ...(scrubbed.form || {}) };
  const selections = session
    ? Object.fromEntries(Object.entries(scrubbed.selections || {}).filter(([key]) => !sessionSelectionKeys.has(key)))
    : { ...(scrubbed.selections || {}) };
  return { ...scrubbed, form, selections };
}

function withActiveSession(state) {
  const nextState = { ...state };
  delete nextState.sessionStatus;
  return nextState;
}

const clearField = (fieldId) => (state) => idleResult(state, {
  form: { ...(state.form || {}), [fieldId]: "" }
});

const selectValue = (selectionId, fallbackKey) => (state, payload) => idleResult(state, {
  selections: {
    ...(state.selections || {}),
    [selectionId]: valueFrom(payload, fallbackKey)
  }
});

function toggleLocationPicker(state) {
  return idleResult(state, {
    selections: {
      ...(state.selections || {}),
      locationPickerOpen: state.selections?.locationPickerOpen !== true
    }
  });
}

function selectLocationMode(state, payload) {
  if (valueFrom(payload) !== "seoul") return errorResult(state, "위치 범위를 다시 선택해 주세요");
  const selections = { ...(state.selections || {}), locationMode: "seoul", locationPickerOpen: true };
  delete selections.locationCenter;
  delete selections.locationRadiusKm;
  return idleResult(state, { selections });
}

function setLocationPin(state, payload) {
  try {
    const point = JSON.parse(String(valueFrom(payload) || ""));
    const latitude = Number(point.latitude);
    const longitude = Number(point.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("invalid coordinate");
    return idleResult(state, {
      selections: {
        ...(state.selections || {}),
        locationMode: "pin",
        locationPickerOpen: true,
        locationCenter: { latitude, longitude },
        locationRadiusKm: Number(state.selections?.locationRadiusKm) || 3
      }
    });
  } catch {
    return errorResult(state, "지도에서 위치를 다시 선택해 주세요");
  }
}

function selectLocationRadius(state, payload) {
  const radiusKm = Number(valueFrom(payload));
  if (![1, 3, 5, 10].includes(radiusKm) || state.selections?.locationMode !== "pin") {
    return errorResult(state, "먼저 지도에서 핀을 선택해 주세요");
  }
  return idleResult(state, {
    selections: { ...(state.selections || {}), locationRadiusKm: radiusKm }
  });
}

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

export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  savedPlaceUpdates: true,
  routeRecommendations: true,
  commentLikes: false,
  marketing: false
});

const LOCAL_REVIEW_PASSWORD = "Doripe123";

const toggleSetting = (settingId) => (state, payload) => {
  const storedNotifications = state.selections?.notifications || {};
  const notifications = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...storedNotifications
  };
  notifications.all = Object.hasOwn(storedNotifications, "all")
    ? storedNotifications.all === true
    : Object.values(DEFAULT_NOTIFICATION_SETTINGS).every(Boolean);
  const checked = typeof payload?.checked === "boolean"
    ? payload.checked
    : !notifications[settingId];

  const nextNotifications = settingId === "all"
    ? {
        all: checked,
        savedPlaceUpdates: checked,
        routeRecommendations: checked,
        commentLikes: checked,
        marketing: checked
      }
    : { ...notifications, [settingId]: checked };

  if (settingId !== "all") {
    const children = ["savedPlaceUpdates", "routeRecommendations", "commentLikes", "marketing"];
    nextNotifications.all = children.every((key) => nextNotifications[key] === true);
  }

  return idleResult(state, {
    selections: {
      ...(state.selections || {}),
      notifications: nextNotifications
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
        id: payload?.id
          || payload?.placeId
          || payload?.routeId
          || (targetType === "route" ? state.selections?.selectedRouteId : null)
      }
    },
    toast: null
  },
  effect: "share"
});

const updateEmail = updateField("email");
const updatePassword = updateSecretField("password");
const updateNewPassword = updateSecretField("newPassword");
const updatePasswordConfirmation = updateSecretField("passwordConfirmation");
const updateNickname = updateField("nickname");
const updateComment = updateField("comment");
const updateCourseComment = updateField("courseComment");
const updateRouteName = updateField("routeName");
const updateCurrentPassword = updateSecretField("currentPassword");
const updateMessage = updateField("message");

function profileDefaults(state, payload) {
  const profile = profileFor(payload, state.profile?.id)
    || profileFor(payload, state.selections?.selectedUserId)
    || (payload?.data ? viewerProfile(payload.data) : null)
    || {};
  return {
    id: state.profile?.id ?? profile.id ?? payload?.data?.viewerProfileId ?? null,
    nickname: state.profile?.nickname ?? state.form?.nickname ?? profile.nickname ?? profile.handle ?? "",
    bio: state.profile?.bio ?? state.form?.bio ?? profile.bio ?? ""
  };
}

const updateProfileDraft = (fieldId) => (state, payload) => idleResult(state, {
  profileDraft: {
    id: state.profileDraft?.id ?? profileDefaults(state, payload).id,
    nickname: state.profileDraft?.nickname ?? profileDefaults(state, payload).nickname,
    bio: state.profileDraft?.bio ?? profileDefaults(state, payload).bio,
    [fieldId]: payload?.value ?? ""
  }
});

function withoutProfileDraft(state) {
  const nextState = { ...state };
  delete nextState.profileDraft;
  return nextState;
}

function discardProfileDraft(state) {
  return navigateBack(withoutProfileDraft(state));
}

function saveProfile(state, payload) {
  const draft = state.profileDraft || {};
  const defaults = profileDefaults(state, payload);
  const profile = {
    id: draft.id ?? defaults.id,
    nickname: String(draft.nickname ?? defaults.nickname).trim(),
    bio: String(draft.bio ?? defaults.bio).trim()
  };
  return navigateTo("e1")({ ...withoutProfileDraft(state), profile });
}

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

function submitReviewFixtureLogin(state, payload) {
  if (payload?.authResult) {
    clearSecrets();
    const cleanState = scrubSensitiveState(state);
    return payload.authResult.ok
      ? navigateTo("b1")(withActiveSession(cleanState))
      : errorResult(cleanState, payload.authResult.message);
  }
  const password = secretValue(state, "password");
  if (!hasFormKey(state, "email") || typeof password !== "string") {
    return errorResult(state, "이메일과 비밀번호를 입력해 주세요");
  }
  const valid = state.form?.email?.trim().toLowerCase() === "dori@doripe.kr"
    && password === LOCAL_REVIEW_PASSWORD;
  clearSecrets();
  const fixtureState = valid
    ? withActiveSession(state)
    : { ...state, form: { ...(state.form || {}), reviewFixtureAuthSubmitted: true } };
  return navigateTo(valid ? "b1" : "a4")(fixtureState);
}

function sendResetEmail(state, payload) {
  if (payload?.authResult) {
    const cleanState = scrubSensitiveState(state);
    return payload.authResult.ok
      ? navigateTo("a6")(cleanState)
      : errorResult(cleanState, payload.authResult.message);
  }
  return hasFormKey(state, "email") && isValidEmail(state.form.email)
    ? navigateTo("a6")(state)
    : errorResult(state, "올바른 이메일을 입력해 주세요");
}

function saveResetPassword(state, payload) {
  if (payload?.authResult) {
    clearSecrets();
    const cleanState = scrubSensitiveState(state, { session: true });
    if (!payload.authResult.ok) return errorResult(cleanState, payload.authResult.message);
    return {
      state: {
        ...cleanState,
        currentScreenId: "a3",
        history: [],
        sessionStatus: "logged-out",
        toast: null
      },
      nextScreenId: "a3",
      browserHistoryMode: "logout",
      effect: "none"
    };
  }
  const newPassword = secretValue(state, "newPassword");
  const passwordConfirmation = secretValue(state, "passwordConfirmation");
  if (typeof newPassword !== "string" || typeof passwordConfirmation !== "string") {
    return errorResult(state, "새 비밀번호를 모두 입력해 주세요");
  }
  const valid = isValidPassword(newPassword) && newPassword === passwordConfirmation;
  if (valid) clearSecrets();
  return navigateTo(valid ? "a3" : "a8")(state);
}

function continueFromEmail(state, payload) {
  if (!hasFormKey(state, "email")) return errorResult(state, "이메일을 입력해 주세요");
  const email = state.form.email.trim().toLowerCase();
  if (!isValidEmail(email)) return navigateTo("a10")(state);
  if (payload?.reviewFixtureMode === true && email === "doripe@example.com") return navigateTo("a11")(state);
  return navigateTo("a12")(state);
}

function continueFromPassword(state, payload) {
  if (payload?.authResult) {
    clearSecrets();
    const cleanState = scrubSensitiveState(state);
    if (!payload.authResult.ok) return errorResult(cleanState, payload.authResult.message);
    return {
      state: {
        ...cleanState,
        toast: { kind: "info", message: payload.authResult.message || "이메일을 확인해 주세요", duration: 4000 }
      },
      effect: "none"
    };
  }
  const password = secretValue(state, "password");
  if (typeof password !== "string") return errorResult(state, "비밀번호를 입력해 주세요");
  const result = navigateTo(isValidPassword(password) ? "a14" : "a13")(state);
  if (isValidPassword(password)) clearSecrets();
  return result;
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

function resendResetEmail(state, payload) {
  if (payload?.authResult) {
    const cleanState = scrubSensitiveState(state);
    return payload.authResult.ok
      ? showToast("success", "재설정 메일을 다시 보냈어요")({
          ...cleanState,
          form: { ...(cleanState.form || {}), resetEmailResent: true }
        })
      : errorResult(cleanState, payload.authResult.message);
  }
  return idleResult(state, {
    form: { ...(state.form || {}), resetEmailResent: true }
  });
}

function continueFromHabit(state) {
  return typeof state.form?.habit === "string" && state.form.habit.length > 0
    ? navigateTo("a19")(state)
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
    ? navigateTo("a22")({
        ...state,
        selections: { ...(state.selections || {}), locationMode: "seoul" }
      })
    : errorResult(state, "알게 된 경로를 선택해 주세요");
}

function skipSource(state) {
  return navigateTo("a22")({
    ...state,
    form: { ...(state.form || {}), source: state.form?.source || "unknown" },
    selections: { ...(state.selections || {}), locationMode: "seoul" }
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

function savePlace(state, payload) {
  const placeId = payload?.placeId ?? payload?.id;
  const catalog = catalogFor(payload);
  if (!catalog.isKnownPlaceId(placeId)) return errorResult(state);
  const normalized = normalizePreviewState(state, catalog);
  return idleResult(normalized.savedPlaceIds.includes(placeId)
    ? unsavePlaceId(normalized, placeId, catalog)
    : savePlaceId(normalized, placeId, catalog));
}

function routesMatch(first, second) {
  return first.name === second.name
    && first.placeIds.length === second.placeIds.length
    && first.placeIds.every((placeId, index) => placeId === second.placeIds[index]);
}

function saveSharedRoute(state, payload) {
  const routeId = payload?.routeId ?? payload?.id;
  const sourceRoute = courseFor(payload, routeId);
  if (!sourceRoute) return errorResult(state, "코스 정보를 찾을 수 없어요");

  const normalized = normalizeState(state, payload);
  const savedIndex = normalized.savedRoutes.findIndex((route) => routesMatch(route, sourceRoute));
  if (savedIndex >= 0) {
    return idleResult({
      ...normalized,
      savedRoutes: normalized.savedRoutes.filter((_, index) => index !== savedIndex)
    });
  }

  let routeNumber = normalized.savedRoutes.length + 1;
  const ids = new Set(normalized.savedRoutes.map((route) => route.id));
  while (ids.has(`saved-route-${routeNumber}`)) routeNumber += 1;
  return idleResult({
    ...normalized,
    savedRoutes: [...normalized.savedRoutes, {
      id: `saved-route-${routeNumber}`,
      name: sourceRoute.name,
      placeIds: [...sourceRoute.placeIds]
    }]
  });
}
const toggleFollow = toggleListValue("followedUserIds", "userId");
const toggleMediaLike = toggleListValue("likedMediaIds", "mediaId");
const togglePlaceLike = toggleListValue("likedPlaceIds", "placeId");
const toggleCommentLike = toggleListValue("likedCommentIds", "commentId");
function withRouteDraft(state, routeDraft, payload) {
  return normalizeState({ ...state, routeDraft, routePlaceIds: routeDraft.placeIds }, payload);
}

function addRoutePlace(state, payload) {
  const placeId = payload?.placeId ?? payload?.id;
  if (!placeFor(payload, placeId)) return errorResult(state);

  const draft = normalizeState(state, payload).routeDraft;
  return idleResult(withRouteDraft(state, {
    ...draft,
    placeIds: draft.placeIds.includes(placeId) ? draft.placeIds : [...draft.placeIds, placeId]
  }, payload));
}

function toggleRoutePlace(state, payload) {
  const placeId = payload?.placeId ?? payload?.id;
  if (!placeFor(payload, placeId)) return errorResult(state);

  const draft = normalizeState(state, payload).routeDraft;
  const placeIds = placeId === draft.startPlaceId
    ? draft.placeIds
    : draft.placeIds.includes(placeId)
      ? draft.placeIds.filter((id) => id !== placeId)
      : [...draft.placeIds, placeId];
  return idleResult(withRouteDraft(state, { ...draft, placeIds }, payload));
}
const noChange = (state) => idleResult(state);

function confirmRoutePlaces(state, payload) {
  return normalizeState(state, payload).routeDraft.placeIds.length >= 2
    ? navigateTo("d7")(state)
    : errorResult(state, "코스에 넣을 장소를 2곳 이상 선택해 주세요");
}

function saveRouteName(state, payload) {
  const routeName = state.form?.routeName?.trim();
  if (!routeName) return errorResult(state, "코스 이름을 입력해 주세요");

  const normalized = normalizeState(state, payload);
  const { routeDraft } = normalized;
  if (!routeDraft.startPlaceId) {
    return errorResult(state, "시작 장소를 먼저 선택해 주세요");
  }
  if (routeDraft.placeIds.length < 2) {
    return errorResult(state, "코스에 넣을 장소를 2곳 이상 선택해 주세요");
  }

  const selectedRouteIndex = normalized.savedRoutes.findIndex(
    (route) => route.id === normalized.selections?.selectedRouteId
  );
  const duplicateRouteIndex = normalized.savedRoutes.findIndex((route) => (
    route.name === routeName
    && route.placeIds.length === routeDraft.placeIds.length
    && route.placeIds.every((placeId, index) => placeId === routeDraft.placeIds[index])
  ));
  const reusableRouteIndex = selectedRouteIndex >= 0 ? selectedRouteIndex : duplicateRouteIndex;
  let routeNumber = normalized.savedRoutes.length + 1;
  const savedRouteIds = new Set(normalized.savedRoutes.map((route) => route.id));
  while (savedRouteIds.has(`saved-route-${routeNumber}`)) routeNumber += 1;
  const route = {
    id: reusableRouteIndex >= 0 ? normalized.savedRoutes[reusableRouteIndex].id : `saved-route-${routeNumber}`,
    name: routeName,
    placeIds: [...routeDraft.placeIds]
  };
  const savedRoutes = reusableRouteIndex >= 0
    ? normalized.savedRoutes.map((savedRoute, index) => index === reusableRouteIndex ? route : savedRoute)
    : [...normalized.savedRoutes, route];

  return navigateTo("d9")({
    ...normalized,
    savedRoutes,
    form: { ...(normalized.form || {}), routeName },
    selections: { ...(normalized.selections || {}), selectedRouteId: route.id }
  });
}

function saveAccountPassword(state) {
  const currentPassword = secretValue(state, "currentPassword");
  const newPassword = secretValue(state, "newPassword");
  const passwordConfirmation = secretValue(state, "passwordConfirmation");
  if (!currentPassword || !newPassword || !passwordConfirmation) {
    return errorResult(state, "비밀번호를 모두 입력해 주세요");
  }
  if (currentPassword !== LOCAL_REVIEW_PASSWORD) {
    clearSecrets();
    return errorResult(state, "현재 비밀번호가 일치하지 않아요");
  }
  if (!isValidPassword(newPassword)) {
    clearSecrets();
    return errorResult(state, "새 비밀번호는 영문과 숫자를 포함해 8자 이상 입력해 주세요");
  }
  if (newPassword !== passwordConfirmation) {
    clearSecrets();
    return errorResult(state, "새 비밀번호가 서로 일치하지 않아요");
  }
  clearSecrets();
  return showToast("info", "미리보기에서는 비밀번호를 변경할 수 없어요")(state);
}

function logout(state, payload) {
  clearSecrets();
  const nextState = scrubSensitiveState(state, { session: true });
  const {
    email: _email,
    nickname: _nickname,
    bio: _bio,
    ...anonymousForm
  } = nextState.form || {};
  const loggedOutState = {
    ...nextState,
    form: anonymousForm,
    savedPlaceIds: [],
    savedRoutes: [],
    likedMediaIds: [],
    likedPlaceIds: [],
    likedCommentIds: [],
    submittedComments: [],
    followedUserIds: [],
    routePlaceIds: [],
    routeDraft: { startPlaceId: null, placeIds: [] }
  };
  delete loggedOutState.profile;
  delete loggedOutState.profileDraft;
  const warning = payload?.authResult?.warning;
  return {
    state: {
      ...loggedOutState,
      currentScreenId: "a3",
      history: [],
      sessionStatus: "logged-out",
      toast: warning ? { kind: "info", message: warning, duration: 4000 } : null
    },
    nextScreenId: "a3",
    browserHistoryMode: "logout",
    effect: "none"
  };
}

const showAccountDeletionUnavailable = showToast("info", "미리보기에서는 회원 탈퇴를 처리할 수 없어요");

function confirmStartPlace(state, payload) {
  const selectedPlaceId = payload?.placeId ?? payload?.id ?? state.selections?.selectedPlaceId;
  if (!placeFor(payload, selectedPlaceId)) {
    return errorResult(state, "시작 장소를 먼저 선택해 주세요");
  }
  const draft = normalizeState(state, payload).routeDraft;
  return navigateTo("d5")(withRouteDraft({
    ...state,
    selections: { ...(state.selections || {}), selectedPlaceId, startPlaceCardOpen: true }
  }, {
    ...draft,
    startPlaceId: selectedPlaceId,
    placeIds: [selectedPlaceId, ...draft.placeIds]
  }, payload));
}

function confirmStartLocation(state, payload) {
  const selectedPlaceId = payload?.placeId ?? payload?.id ?? state.selections?.selectedPlaceId;
  if (!placeFor(payload, selectedPlaceId)) return errorResult(state, "시작 장소를 먼저 선택해 주세요");
  return navigateTo("d4")({
    ...state,
    selections: {
      ...(state.selections || {}),
      selectedPlaceId,
      startPlaceCardOpen: true
    }
  });
}

function selectStartPlace(state, payload) {
  const placeId = payload?.placeId ?? payload?.id;
  if (!placeFor(payload, placeId)) return errorResult(state, "시작 장소를 먼저 선택해 주세요");
  return navigateTo("d4")({
    ...state,
    selections: {
      ...(state.selections || {}),
      selectedPlaceId: placeId,
      startPlaceCardOpen: true
    }
  });
}

function selectRouteFilter(state, payload) {
  const value = valueFrom(payload);
  const selections = { ...(state.selections || {}) };
  if (value === "filters") {
    selections.routeFilter = "filters";
    return idleResult(state, { selections });
  }
  if (payload?.selectionKey) {
    const routeFilters = { ...(selections.routeFilters || {}) };
    if (routeFilters[payload.selectionKey] === value) delete routeFilters[payload.selectionKey];
    else routeFilters[payload.selectionKey] = value;
    selections.routeFilters = routeFilters;
    if (selections.routeFilter !== "filters") delete selections.routeFilter;
    return idleResult(state, { selections });
  }
  if (selections.routeFilter === value) delete selections.routeFilter;
  else selections.routeFilter = value;
  return idleResult(state, { selections });
}

function applyRouteFilters(state) {
  const selections = { ...(state.selections || {}) };
  delete selections.routeFilter;
  return idleResult(state, { selections });
}

function resetRouteFilters(state) {
  const selections = { ...(state.selections || {}) };
  if (selections.routeFilter !== "filters") delete selections.routeFilter;
  delete selections.routeFilters;
  return idleResult(state, { selections });
}

function sendContactMessage(state) {
  const message = state.form?.message?.trim();
  if (!message) return errorResult(state, "문의 내용을 입력해 주세요");
  return showToast("info", "미리보기에서는 문의를 전송할 수 없어요")(state);
}

function selectSavedFilter(state, payload) {
  const value = valueFrom(payload);
  if (!["filters", "location"].includes(value)) return selectValue("savedFilter")(state, payload);
  const nextState = {
    ...state,
    selections: {
      ...(state.selections || {}),
      filterReturnScreen: state.currentScreenId,
      ...(value === "location" ? { locationPickerOpen: true } : {})
    }
  };
  return navigateTo("c3")(nextState);
}

function applySavedFilters(state) {
  if (state.overlays?.includes("feed-filter-sheet")) {
    return idleResult(state, {
      overlays: state.overlays.filter((overlay) => overlay !== "feed-filter-sheet")
    });
  }
  const destination = state.selections?.filterReturnScreen === "c2" ? "c2" : "c1";
  return navigateTo(destination)(state);
}

function startRoutePlaceReplacement(state, payload) {
  const placeId = payload?.placeId ?? payload?.id;
  if (!placeFor(payload, placeId)) return errorResult(state);
  const route = state.savedRoutes?.find((item) => item.id === state.selections?.selectedRouteId)
    || courseFor(payload, state.selections?.selectedRouteId);
  if (!route) return errorResult(state, "코스 정보를 찾을 수 없어요");
  const routePlaceIds = [...route.placeIds];
  const existingStartPlaceId = state.routeDraft?.startPlaceId;
  return navigateTo("c7")(withRouteDraft({
    ...state,
    selections: {
      ...(state.selections || {}),
      selectedPlaceId: placeId,
      replacementPlaceId: placeId
    }
  }, {
    startPlaceId: routePlaceIds.includes(existingStartPlaceId) ? existingStartPlaceId : routePlaceIds[0] ?? null,
    placeIds: routePlaceIds
  }, payload));
}

function confirmRoutePlaceReplacement(state, payload) {
  const normalized = normalizeState(state, payload);
  const previousId = normalized.selections?.selectedPlaceId;
  const replacementId = normalized.selections?.replacementPlaceId;
  if (!previousId || !replacementId) return errorResult(state, "교체할 장소를 선택해 주세요");
  const route = normalized.savedRoutes.find((item) => item.id === normalized.selections?.selectedRouteId)
    || courseFor(payload, normalized.selections?.selectedRouteId);
  const current = normalized.routeDraft.placeIds.length ? normalized.routeDraft.placeIds : route?.placeIds;
  if (!current) return errorResult(state, "코스 정보를 찾을 수 없어요");
  const routePlaceIds = current.map((placeId) => placeId === previousId ? replacementId : placeId);
  return navigateTo("c6")(withRouteDraft({
    ...normalized,
    selections: {
      ...(normalized.selections || {}),
      replacementPlaceId: replacementId
    }
  }, {
    ...normalized.routeDraft,
    startPlaceId: normalized.routeDraft.startPlaceId === previousId
      ? replacementId
      : normalized.routeDraft.startPlaceId,
    placeIds: routePlaceIds
  }, payload));
}

function closeSavedPlaceCard(state) {
  const selections = { ...(state.selections || {}) };
  delete selections.selectedPlaceId;
  selections.savedPlaceCardOpen = false;
  return idleResult(state, { selections });
}

function closeStartPlaceCard(state) {
  const selections = { ...(state.selections || {}) };
  delete selections.selectedPlaceId;
  selections.startPlaceCardOpen = false;
  return idleResult(state, { selections });
}

function submitContentComment(state, payload, { fieldId, entityKey, entityId }) {
  const body = state.form?.[fieldId]?.trim();
  const contentId = payload?.contentId || state.selections?.selectedContentId;
  const content = payload?.data ? contentById(payload.data, contentId) : null;
  const viewer = payload?.data ? viewerProfile(payload.data) : null;
  if (!body) return errorResult(state, "댓글을 입력해 주세요");
  if (!content) return errorResult(state, "댓글을 남길 콘텐츠를 찾을 수 없어요");
  if (!viewer) return errorResult(state, "내 프로필을 찾을 수 없어요");
  const submittedComments = state.submittedComments || [];
  const comment = {
    id: `local-comment-${submittedComments.length + 1}`,
    contentId,
    [entityKey]: entityId,
    userId: viewer.id,
    body,
    likeCount: 0,
    createdAt: "local"
  };
  return {
    state: {
      ...state,
      submittedComments: [...submittedComments, comment],
      form: { ...(state.form || {}), [fieldId]: "" },
      toast: { kind: "success", message: "댓글을 등록했어요", duration: 2500 }
    },
    effect: "none"
  };
}

function submitComment(state, payload) {
  const placeId = state.selections?.selectedPlaceId || payload?.placeId;
  return submitContentComment(state, payload, { fieldId: "comment", entityKey: "placeId", entityId: placeId });
}

function submitCourseComment(state, payload) {
  const courseId = state.selections?.selectedRouteId || payload?.routeId;
  const result = submitContentComment(state, payload, { fieldId: "courseComment", entityKey: "courseId", entityId: courseId });
  if (result.state.toast?.kind === "error") return result;
  return {
    ...result,
    state: {
      ...result.state,
      selections: { ...(result.state.selections || {}), courseCommentsOpen: true }
    }
  };
}

function openSharedRoutePost(state, payload) {
  const routeId = payload?.routeId ?? payload?.id;
  const routeExists = Boolean(courseFor(payload, routeId))
    || (state.savedRoutes || []).some((route) => route.id === routeId);
  if (!routeExists) return errorResult(state, "코스 정보를 찾을 수 없어요");

  const selections = { ...(state.selections || {}) };
  delete selections.selectedPlaceId;
  delete selections.selectedMediaId;
  delete selections.detailSheetState;
  selections.selectedRouteId = routeId;
  selections.routeDetailSource = "feed";
  return navigateTo("b4")({ ...state, selections });
}

export const RUNTIME_ACTIONS_BY_SCREEN = Object.freeze({
  b1: Object.freeze(["open-route-post"]),
  b2: Object.freeze(["open-route-post"]),
  b4: Object.freeze(["open-other-media", "save-shared-route", "update-course-comment", "submit-course-comment"]),
  b5: Object.freeze(["open-other-media"]),
  b6: Object.freeze(["open-other-media"]),
  d5: Object.freeze(["apply-route-filters", "reset-route-filters", "toggle-location-picker", "set-location-pin", "select-location-radius", "select-location-mode"]),
  d6: Object.freeze(["apply-route-filters", "reset-route-filters", "toggle-location-picker", "set-location-pin", "select-location-radius", "select-location-mode"]),
  c3: Object.freeze(["toggle-location-picker", "set-location-pin", "select-location-radius", "select-location-mode"])
});

function defineTransitions(screenId, handlers) {
  const expected = [...ACTIONS_BY_SCREEN[screenId], ...(RUNTIME_ACTIONS_BY_SCREEN[screenId] || [])];
  const actual = Object.keys(handlers);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Transition contract mismatch for ${screenId}`);
  }
  return Object.freeze(handlers);
}

export const TRANSITIONS = Object.freeze({
  a1: defineTransitions("a1", { start: navigateTo("a18"), login: navigateTo("a3") }),
  "a1-splash": defineTransitions("a1-splash", {}),
  a3: defineTransitions("a3", {
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": submitReviewFixtureLogin,
    "forgot-password": navigateTo("a5")
  }),
  a4: defineTransitions("a4", {
    "update-email": updateEmail,
    "update-password": updatePassword,
    "create-account": navigateTo("a9"),
    "submit-login": submitReviewFixtureLogin,
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
    "open-filter": openOverlay("feed-filter-sheet"),
    "open-following-list": navigateTo("b13"),
    "open-profile": selectAndNavigate("b12", "selectedUserId", "userId"),
    "open-place": selectPlaceMediaAndNavigate("b4"),
    "scroll-to-top": noChange,
    "open-route-post": openSharedRoutePost
  }),
  b2: defineTransitions("b2", {
    "show-following": navigateTo("b1"),
    "show-discover": selectValue("feedTab"),
    "open-filter": openOverlay("feed-filter-sheet"),
    "open-place": selectPlaceMediaAndNavigate("b4"),
    "open-route-post": openSharedRoutePost
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
    "toggle-comment-like": toggleCommentLike,
    "open-other-media": navigateTo("b3"),
    "save-shared-route": saveSharedRoute,
    "update-course-comment": updateCourseComment,
    "submit-course-comment": submitCourseComment
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
    "open-official-place": selectAndNavigate("b10", "selectedPlaceId", "placeId"),
    "open-other-media": navigateTo("b3")
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
    "create-route": startNewCourse("d3"),
    "open-other-media": navigateTo("b3")
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
    "create-route": startNewCourse("d4"),
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
    "select-filter-tag": selectSavedFilter,
    "open-place": selectAndNavigate("c4", "selectedPlaceId", "placeId"),
    "add-place-to-route": addRoutePlace
  }),
  c2: defineTransitions("c2", {
    "show-saved-places": navigateTo("c1"),
    "show-saved-routes": selectValue("savedTab"),
    "select-filter-tag": selectSavedFilter,
    "open-route-map": openOverlay("saved-route-map", "selectedRouteId", "routeId"),
    "open-route": selectAndNavigate("c6", "selectedRouteId", "routeId")
  }),
  c3: defineTransitions("c3", {
    "select-situation": selectValue("situation"),
    "select-time": selectValue("time"),
    "select-mood": selectValue("mood"),
    "apply-filters": applySavedFilters,
    "reset-filters": resetFilterSelections,
    "toggle-location-picker": toggleLocationPicker,
    "set-location-pin": setLocationPin,
    "select-location-radius": selectLocationRadius,
    "select-location-mode": selectLocationMode
  }),
  c4: defineTransitions("c4", {
    "go-back": navigateBack,
    "close-place-card": closeSavedPlaceCard,
    "locate-user": noChange,
    "open-place": selectAndNavigate("b10", "selectedPlaceId", "placeId")
  }),
  c6: defineTransitions("c6", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": openOverlay("external-map"),
    "replace-route-place": startRoutePlaceReplacement,
    "open-place": selectAndNavigate("b10", "selectedPlaceId", "placeId")
  }),
  c7: defineTransitions("c7", {
    "go-back": navigateBack,
    "select-filter-tag": selectValue("savedFilter"),
    "select-place": selectValue("replacementPlaceId", "placeId"),
    "toggle-place-like": togglePlaceLike,
    "replace-place": selectValue("replacementPlaceId", "placeId"),
    "confirm-place-selection": confirmRoutePlaceReplacement
  }),
  d1: defineTransitions("d1", {
    "select-start-place": selectStartPlace,
    "open-photo-menu": openOverlay("photo-menu", "selectedMediaId", "mediaId")
  }),
  d2: defineTransitions("d2", {
    "go-back": navigateBack,
    "locate-user": noChange,
    "confirm-start-location": confirmStartLocation
  }),
  d3: defineTransitions("d3", {
    "select-start-place": selectStartPlace
  }),
  d4: defineTransitions("d4", {
    "go-back": navigateBack,
    "close-place-card": closeStartPlaceCard,
    "locate-user": noChange,
    "confirm-start-place": confirmStartPlace
  }),
  d5: defineTransitions("d5", {
    "go-back": navigateBack,
    "show-saved-places": selectValue("routeSourceTab"),
    "show-discover": navigateTo("d6"),
    "change-filter": selectRouteFilter,
    "select-filter-tag": selectRouteFilter,
    "add-place": addRoutePlace,
    "confirm-route-places": confirmRoutePlaces,
    "apply-route-filters": applyRouteFilters,
    "reset-route-filters": resetRouteFilters,
    "toggle-location-picker": toggleLocationPicker,
    "set-location-pin": setLocationPin,
    "select-location-radius": selectLocationRadius,
    "select-location-mode": selectLocationMode
  }),
  d6: defineTransitions("d6", {
    "go-back": navigateBack,
    "show-saved-places": navigateTo("d5"),
    "show-discover": selectValue("routeSourceTab"),
    "change-filter": selectRouteFilter,
    "select-filter-tag": selectRouteFilter,
    "add-place": addRoutePlace,
    "confirm-route-places": confirmRoutePlaces,
    "apply-route-filters": applyRouteFilters,
    "reset-route-filters": resetRouteFilters,
    "toggle-location-picker": toggleLocationPicker,
    "set-location-pin": setLocationPin,
    "select-location-radius": selectLocationRadius,
    "select-location-mode": selectLocationMode
  }),
  d7: defineTransitions("d7", {
    "go-back": navigateBack,
    "change-places": navigateTo("d5"),
    "create-route": navigateTo("d8"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c1"),
    "open-routes": navigateTo("d3"),
    "open-settings": navigateTo("e1")
  }),
  d8: defineTransitions("d8", {
    "go-back": navigateBack,
    "update-route-name": updateRouteName,
    "clear-route-name": clearField("routeName"),
    "save-route": saveRouteName,
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c1"),
    "open-routes": navigateTo("d3"),
    "open-settings": navigateTo("e1")
  }),
  d9: defineTransitions("d9", {
    "go-back": navigateBack,
    "open-share": shareTarget("route"),
    "start-navigation": openOverlay("external-map"),
    "open-place": selectAndNavigate("b10", "selectedPlaceId", "placeId"),
    "open-discover": navigateTo("b2"),
    "open-saved": navigateTo("c1"),
    "open-routes": navigateTo("d3"),
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
    "go-back": discardProfileDraft,
    "update-nickname": updateProfileDraft("nickname"),
    "update-bio": updateProfileDraft("bio"),
    "show-profile-places": selectValue("profileTab"),
    "show-profile-routes": selectValue("profileTab"),
    "edit-media": openOverlay("media-editor", "selectedMediaId", "mediaId"),
    "save-profile": saveProfile
  }),
  e3: defineTransitions("e3", {
    "go-back": navigateBack,
    "update-current-password": updateCurrentPassword,
    "update-new-password": updateNewPassword,
    "update-password-confirmation": updatePasswordConfirmation,
    "save-password": saveAccountPassword,
    "forgot-password": navigateTo("a5"),
    logout,
    "delete-account": showAccountDeletionUnavailable
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
    "send-message": sendContactMessage
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
  const supportedActions = [...ACTIONS_BY_SCREEN[screenId], ...(RUNTIME_ACTIONS_BY_SCREEN[screenId] || [])];
  if (!Object.hasOwn(screenTransitions, actionId) || !supportedActions.includes(actionId)) {
    return errorResult(state, "이 동작은 아직 연결되지 않았어요");
  }

  const transition = screenTransitions[actionId];

  try {
    const result = transition(state, payload || {});
    return { ...result, state: scrubSensitiveState(result.state) };
  } catch {
    const result = errorResult(state);
    return { ...result, state: scrubSensitiveState(result.state) };
  }
}
