export const PREVIEW_STORAGE_KEY = "doripe_app_preview_v1";
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
  likedMediaIds: [],
  likedPlaceIds: [],
  likedCommentIds: [],
  submittedComments: [],
  followedUserIds: INITIAL_FOLLOWED_USER_IDS,
  routePlaceIds: [],
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
    likedMediaIds: [],
    likedPlaceIds: [],
    likedCommentIds: [],
    submittedComments: [],
    followedUserIds: [...INITIAL_FOLLOWED_USER_IDS],
    routePlaceIds: [],
    overlays: []
  };
}

function clonePreviewState(value) {
  return { ...cloneDefaultState(), ...structuredClone(value) };
}

function loadState(storage) {
  try {
    const stored = storage?.getItem(PREVIEW_STORAGE_KEY);
    if (!stored) return cloneDefaultState();

    const parsed = JSON.parse(stored);
    return clonePreviewState(parsed);
  } catch {
    return cloneDefaultState();
  }
}

export function createPreviewState({ storage = globalThis.localStorage } = {}) {
  let currentState = loadState(storage);

  function persist() {
    storage?.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(currentState));
  }

  return {
    getState() {
      return currentState;
    },
    replace(nextState) {
      currentState = clonePreviewState(nextState);
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
