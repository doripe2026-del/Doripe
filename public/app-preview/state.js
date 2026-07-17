export const PREVIEW_STORAGE_KEY = "doripe_app_preview_v1";
const EMPTY_CATALOG = Object.freeze({
  isKnownPlaceId: () => false,
  isKnownMediaId: () => false,
  isKnownProfileId: () => false,
  isKnownContentId: () => false,
  isKnownCommentId: () => false,
  isKnownCourseId: () => false
});
const INITIAL_FOLLOWED_USER_IDS = Object.freeze([
  "user-1", "user-2", "user-3", "user-4", "user-5", "user-6"
]);

export const DEFAULT_STATE = Object.freeze({
  currentScreenId: "a1",
  history: [],
  reviewStatus: {},
  form: {},
  selections: {},
  savedPlaceIds: [],
  savedRoutes: [],
  likedMediaIds: [],
  likedPlaceIds: [],
  likedCommentIds: [],
  submittedComments: [],
  followedUserIds: INITIAL_FOLLOWED_USER_IDS,
  routePlaceIds: [],
  routeDraft: { startPlaceId: null, placeIds: [] },
  overlays: [],
  toast: null
});

function cloneDefaultState() {
  return {
    ...DEFAULT_STATE,
    history: [],
    reviewStatus: {},
    form: {},
    selections: {},
    savedPlaceIds: [],
    savedRoutes: [],
    likedMediaIds: [],
    likedPlaceIds: [],
    likedCommentIds: [],
    submittedComments: [],
    followedUserIds: [...INITIAL_FOLLOWED_USER_IDS],
    routePlaceIds: [],
    routeDraft: { startPlaceId: null, placeIds: [] },
    overlays: []
  };
}

function isKnownPlaceId(catalog, placeId) {
  return catalog?.isKnownPlaceId?.(placeId) === true;
}

function isKnownCourseId(catalog, courseId) {
  return catalog?.isKnownCourseId?.(courseId) === true;
}

function normalizePlaceIds(placeIds, catalog) {
  if (!Array.isArray(placeIds)) return [];

  return [...new Set(placeIds.filter((placeId) => isKnownPlaceId(catalog, placeId)))];
}

function normalizeSavedRoutes(savedRoutes, catalog) {
  if (!Array.isArray(savedRoutes)) return [];

  const seenRouteIds = new Set();
  return savedRoutes.flatMap((route) => {
    if (!route || typeof route !== "object") return [];
    const id = typeof route.id === "string" ? route.id.trim() : "";
    const name = typeof route.name === "string" ? route.name.trim() : "";
    const placeIds = normalizePlaceIds(route.placeIds, catalog);
    if (!id || seenRouteIds.has(id) || !name || placeIds.length < 2) return [];

    seenRouteIds.add(id);
    return [{ id, name, placeIds }];
  });
}

function normalizeRouteDraft(routeDraft, legacyPlaceIds, catalog) {
  const draft = routeDraft && typeof routeDraft === "object" ? routeDraft : {};
  const startPlaceId = isKnownPlaceId(catalog, draft.startPlaceId) ? draft.startPlaceId : null;
  const sourcePlaceIds = Array.isArray(draft.placeIds) && (draft.placeIds.length > 0 || !Array.isArray(legacyPlaceIds))
    ? draft.placeIds
    : legacyPlaceIds;
  const placeIds = normalizePlaceIds(sourcePlaceIds, catalog);

  return {
    startPlaceId,
    placeIds: startPlaceId
      ? [startPlaceId, ...placeIds.filter((placeId) => placeId !== startPlaceId)]
      : placeIds
  };
}

function isSensitiveStateKey(key) {
  const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (normalized.includes("password")) return true;
  if (["jwt", "authorization", "sessiontoken", "bearertoken"].includes(normalized)) return true;
  if (normalized === "access" || normalized === "refresh") return true;
  if (normalized === "token") return true;
  if (/^(?:auth|id|provider|access|refresh)token/u.test(normalized)) return true;
  return (normalized.includes("access") || normalized.includes("refresh"))
    && normalized.includes("token");
}

export function stripSensitivePreviewData(value, seen = new WeakMap()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const result = [];
    seen.set(value, result);
    for (const item of value) result.push(stripSensitivePreviewData(item, seen));
    return result;
  }

  const result = {};
  seen.set(value, result);
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveStateKey(key)) continue;
    result[key] = stripSensitivePreviewData(item, seen);
  }
  return result;
}

export function normalizePreviewState(value = {}, catalog = EMPTY_CATALOG) {
  const scrubbed = stripSensitivePreviewData(structuredClone(value));
  const nextState = { ...cloneDefaultState(), ...(scrubbed || {}) };
  const savedRoutes = normalizeSavedRoutes(nextState.savedRoutes, catalog);
  const routeDraft = normalizeRouteDraft(nextState.routeDraft, nextState.routePlaceIds, catalog);
  const selectedRouteId = nextState.selections?.selectedRouteId;
  const savedRouteIds = new Set(savedRoutes.map((route) => route.id));
  const selections = { ...(nextState.selections || {}) };

  const validateSelection = (key, validatorName) => {
    const selectedId = selections[key];
    if (typeof selectedId !== "string" || typeof catalog?.[validatorName] !== "function") return;
    if (catalog[validatorName](selectedId) !== true) selections[key] = null;
  };

  validateSelection("selectedPlaceId", "isKnownPlaceId");
  validateSelection("selectedMediaId", "isKnownMediaId");
  validateSelection("selectedUserId", "isKnownProfileId");
  validateSelection("selectedContentId", "isKnownContentId");
  validateSelection("selectedCommentId", "isKnownCommentId");

  if (selectedRouteId && !isKnownCourseId(catalog, selectedRouteId) && !savedRouteIds.has(selectedRouteId)) {
    selections.selectedRouteId = null;
  }

  return {
    ...nextState,
    selections,
    savedPlaceIds: normalizePlaceIds(nextState.savedPlaceIds, catalog),
    savedRoutes,
    routeDraft,
    routePlaceIds: [...routeDraft.placeIds]
  };
}

export function savePlaceId(state, placeId, catalog = EMPTY_CATALOG) {
  const normalized = normalizePreviewState(state, catalog);
  if (!isKnownPlaceId(catalog, placeId) || normalized.savedPlaceIds.includes(placeId)) return normalized;

  return { ...normalized, savedPlaceIds: [...normalized.savedPlaceIds, placeId] };
}

export function unsavePlaceId(state, placeId, catalog = EMPTY_CATALOG) {
  const normalized = normalizePreviewState(state, catalog);
  return {
    ...normalized,
    savedPlaceIds: normalized.savedPlaceIds.filter((savedPlaceId) => savedPlaceId !== placeId)
  };
}

function clonePreviewState(value, catalog) {
  return normalizePreviewState(value, catalog);
}

function loadState(storage, catalog) {
  try {
    const stored = storage?.getItem(PREVIEW_STORAGE_KEY);
    if (!stored) return cloneDefaultState();

    const parsed = JSON.parse(stored);
    return clonePreviewState(parsed, catalog);
  } catch {
    return cloneDefaultState();
  }
}

export function createPreviewState({
  storage = globalThis.localStorage,
  catalog = EMPTY_CATALOG
} = {}) {
  let activeCatalog = catalog;
  let currentState = loadState(storage, activeCatalog);

  function persist() {
    currentState = clonePreviewState(currentState, activeCatalog);
    storage?.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(currentState));
  }

  if (storage?.getItem(PREVIEW_STORAGE_KEY)) persist();

  return {
    getState() {
      return currentState;
    },
    setCatalog(nextCatalog = EMPTY_CATALOG) {
      activeCatalog = nextCatalog;
      persist();
    },
    replace(nextState) {
      currentState = clonePreviewState(nextState, activeCatalog);
      persist();
    },
    navigate(screenId, { replace = false } = {}) {
      if (!replace && currentState.currentScreenId !== screenId) {
        currentState = {
          ...currentState,
          history: [...currentState.history, currentState.currentScreenId]
        };
      }

      currentState = { ...currentState, currentScreenId: screenId };
      persist();
    },
    setReviewStatus(screenId, status) {
      currentState = {
        ...currentState,
        reviewStatus: { ...currentState.reviewStatus, [screenId]: status }
      };
      persist();
    },
    reset() {
      currentState = cloneDefaultState();
      storage?.removeItem(PREVIEW_STORAGE_KEY);
    }
  };
}
