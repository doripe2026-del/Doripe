import { CONFIG } from "./config.js";

function randomId(prefix) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getAnonymousId() {
  let id = localStorage.getItem(CONFIG.anonymousIdKey);
  if (!id) {
    id = randomId("anon");
    localStorage.setItem(CONFIG.anonymousIdKey, id);
  }
  return id;
}

export function getSessionId() {
  let id = sessionStorage.getItem(CONFIG.sessionIdKey);
  if (!id) {
    id = randomId("sess");
    sessionStorage.setItem(CONFIG.sessionIdKey, id);
  }
  return id;
}

export function initialState() {
  return {
    screen: "welcome",
    tab: "discover",
    selectedNeighborhoodId: CONFIG.activeNeighborhoodId,
    selectedPlaceId: null,
    currentIndex: 0,
    currentPhotoIndex: 0,
    cardActionCount: 0,
    photoDirection: "",
    discoverTutorialSeen: false,
    onboardingAnswers: {
      source: "",
      habit: ""
    },
    tagSetupComplete: false,
    savedPlaceIds: [],
    skippedPlaceIds: [],
    routePlaceIds: [],
    routeIncludePrevious: false,
    routeExpandedType: "",
    routeSummaryOpen: false,
    deletePlaceIds: [],
    savedFilters: {
      type: [],
      mood: [],
      situation: []
    },
    savedFilterOpen: false,
    savedFilterNoResults: false,
    routeFilterOpen: false,
    regionPickerOpen: false,
    deleteConfirmOpen: false,
    alert: null,
    shareOpen: false,
    shareLinksByPlaceId: {},
    sharedContext: null,
    selectedTags: [],
    feedbackType: "앱 오류",
    feedbackText: ""
  };
}

export function loadState() {
  return { ...initialState(), ...readJson(CONFIG.storageKey, {}) };
}

export function saveState(state) {
  writeJson(CONFIG.storageKey, state);
}

export function rememberSavedPlace(state, placeId) {
  return {
    ...state,
    savedPlaceIds: Array.from(new Set([...state.savedPlaceIds, placeId])),
    skippedPlaceIds: state.skippedPlaceIds.filter((id) => id !== placeId),
    cardActionCount: state.cardActionCount + 1,
    currentPhotoIndex: 0
  };
}

export function rememberSkippedPlace(state, placeId) {
  return {
    ...state,
    skippedPlaceIds: Array.from(new Set([...state.skippedPlaceIds, placeId])),
    savedPlaceIds: state.savedPlaceIds.filter((id) => id !== placeId),
    cardActionCount: state.cardActionCount + 1,
    currentPhotoIndex: 0
  };
}

export function rememberUnsavedPlace(state, placeId) {
  return {
    ...state,
    savedPlaceIds: state.savedPlaceIds.filter((id) => id !== placeId),
    routePlaceIds: state.routePlaceIds.filter((id) => id !== placeId)
  };
}
