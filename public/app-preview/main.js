import { getScreen, listScreens } from "./screen-registry.js";
import { createPreviewState, stripSensitivePreviewData } from "./state.js";
import { clearVolatilePasswords, dispatchAction } from "./transitions.js";
import { createAuthClient, isLocalAuthFixtureLocation } from "./auth-client.js";
import { getAdapter } from "./api-adapter.js";
import { courseById, createDataCatalog, createUnavailableDataCatalog } from "./data/selectors.js";
import { createActionSync } from "./data/action-sync.js";
import { createAppDataStore } from "./data/store.js";
import { mergeDataSnapshots, normalizeDataSnapshot } from "./data/contracts.js";
import { mergePersonalSnapshotIntoState } from "./data/personal-state.js";
import {
  clearGuestMigrationJournal,
  createGuestMigrationPlan,
  executeGuestMigration,
  prepareGuestMigrationJournal
} from "./data/guest-migration.js";
import { isStaticPreview } from "./data/server-media.js";
import { createAnalyticsClient } from "./analytics-client.js";

const groups = ["A", "B", "C", "D", "E"];
const phoneRoot = document.querySelector("#phone-root");
const bootProgress = phoneRoot.querySelector("[data-app-boot] [role='progressbar']");
function setBootProgress(value) {
  if (!bootProgress?.isConnected) return;
  const progress = Math.max(Number(bootProgress.getAttribute("aria-valuenow")) || 0, Math.min(100, value));
  bootProgress.setAttribute("aria-valuenow", String(progress));
  bootProgress.style.width = `${183 * progress / 100}px`;
}

const authClient = createAuthClient();
const staticPreview = isStaticPreview();
const hadStartupSession = Boolean(window.sessionStorage.getItem("doripe.app_preview.auth.session.v1"));
const startupAuthResult = await authClient.initializeSession({
  url: window.location.href,
  replaceState: (url) => window.history.replaceState(window.history.state, "", url)
});
let authStatus = startupAuthResult.ok ? startupAuthResult.status : "no-session";
let personalDataReady = false;
let discoverFilterRequestSequence = 0;
let appRuntimeReady = false;
let unauthorizedNoticePending = false;
setBootProgress(45);
const repository = getAdapter(isStaticPreview() ? "fixture" : "api", {
  accessTokenProvider: authClient.getAccessToken,
  refreshAccessToken: authClient.refreshSession,
  onUnauthorized: handleUnauthorizedSession
});
const dataStore = createAppDataStore({ repository });
const actionSync = createActionSync({
  repository,
  enabled: repository.mode === "api",
  canSync: () => Boolean(authClient.getAccessToken()) && personalDataReady
});
const analyticsClient = staticPreview ? null : createAnalyticsClient({
  accessTokenProvider: authClient.getAccessToken
});
let dataLoadError = null;
try {
  await dataStore.load();
} catch (error) {
  dataLoadError = error;
}
setBootProgress(92);
let dataSnapshot = dataStore.getSnapshot();
const initialDiscoverContentIds = Object.freeze(dataSnapshot.contents.map((content) => content.id));
personalDataReady = authStatus === "authenticated" && dataSnapshot.personalDataLoaded === true;
if (authStatus === "authenticated" && !dataSnapshot.personalDataLoaded && !dataLoadError) {
  dataLoadError = new Error("계정 데이터를 불러오지 못했어요");
}
if (authStatus === "authenticated" && !dataSnapshot.personalDataLoaded) {
  authClient.clearSession();
  authStatus = "no-session";
}
let dataCatalog = dataLoadError ? createUnavailableDataCatalog() : createDataCatalog(dataSnapshot);
const state = createPreviewState({ catalog: dataCatalog });
if (dataSnapshot.personalDataLoaded) {
  await reconcileAuthenticatedState(state.getState());
}
const reviewList = document.querySelector("#review-list");
const resetButton = document.querySelector("#review-reset");
const BROWSER_HISTORY_KEY = "doripeAppPreview";
const LOGOUT_GUARD_KEY = "doripe.app_preview.auth.logged_out.v1";
const SCREEN_TEARDOWN_EVENT = "app-preview:screen-teardown";
const SCREEN_NAVIGATE_EVENT = "app-preview:screen-navigate";
const FEED_STATUS_EVENT = "app-preview:feed-status";
const DETAIL_SHEET_STATE_EVENT = "app-preview:detail-sheet-state";
const FEED_FILTER_DISMISS_EVENT = "app-preview:feed-filter-dismiss";
const OVERLAY_DISMISS_EVENT = "app-preview:overlay-dismiss";
const SELECTION_CLEAR_EVENT = "app-preview:selection-clear";
const MEDIA_HIDE_EVENT = "app-preview:media-hide";
const SHARE_PARAM_KEYS = Object.freeze(["type", "id", "rn", "rp"]);
const MAX_SHARED_QUERY_LENGTH = 2048;
const MAX_SHARED_QUERY_TOKENS = 12;
const MAX_RAW_SHARE_LENGTHS = Object.freeze({ type: 8, id: 100, rn: 360, rp: 128 });
const MAX_ROUTE_ID_DIGITS = 9;
const MAX_ROUTE_NAME_CODE_POINTS = 30;
const MAX_ROUTE_PLACE_COUNT = 10;
let interactionState = state.getState();
let activePointerTarget = null;
let pendingHistoryBack = null;
let activeShareParams = null;
let renderGeneration = 0;
let lastRenderedScreenId = null;
let analyticsSession = null;
const discoverSeenCursors = new Set();
function invalidateDiscoverFilterRequests() {
  discoverFilterRequestSequence += 1;
}

function handleUnauthorizedSession() {
  invalidateDiscoverFilterRequests();
  authClient.clearSession();
  authStatus = "no-session";
  personalDataReady = false;
  unauthorizedNoticePending = true;
  if (!appRuntimeReady) return;
  applyUnauthorizedNotice();
}

function applyUnauthorizedNotice() {
  if (!unauthorizedNoticePending || !appRuntimeReady) return;
  dataSnapshot = normalizeDataSnapshot({
    ...dataSnapshot,
    viewerProfileId: null,
    personalDataLoaded: false,
    savedPlaceIds: [],
    savedCourseIds: [],
    ownedCourseIds: [],
    feedNextCursor: null
  });
  dataCatalog = createDataCatalog(dataSnapshot);
  state.setCatalog(dataCatalog);
  const current = state.getState();
  const nextState = {
    ...current,
    savedPlaceIds: [],
    savedRoutes: [],
    likedMediaIds: [],
    likedPlaceIds: [],
    likedCommentIds: [],
    submittedComments: [],
    followedUserIds: [],
    routePlaceIds: [],
    routeDraft: { startPlaceId: null, placeIds: [] },
    selections: {
      ...(current.selections || {}),
      ...(current.selections?.feedStatus === "loading" ? { feedStatus: "error" } : {}),
      feedLoadingMore: false,
      ...(current.selections?.feedLoadingMore === true ? { feedLoadMoreStatus: "error" } : {})
    },
    toast: { kind: "error", message: "로그인이 만료되었어요. 다시 로그인해 주세요." }
  };
  delete nextState.profile;
  delete nextState.profileDraft;
  state.replace(nextState);
  interactionState = state.getState();
  unauthorizedNoticePending = false;
  queueMicrotask(() => {
    if (!appRuntimeReady) return;
    renderScreen(interactionState.currentScreenId);
    refreshCurrentBrowserEntry();
  });
}

const GUEST_MVP_ENABLED = true;
const RECOVERY_SCREENS = new Set(["a7", "a8"]);
const AUTHENTICATED_SETUP_SCREENS = new Set([
  "a14", "a15", "a16", "a17"
]);
const GUEST_SETUP_SCREENS = new Set(["a18", "a19", "a20", "a21", "a22"]);

const REMOTE_AUTH_ACTIONS = new Map([
  ["a3/submit-login", "sign-in"],
  ["a4/submit-login", "sign-in"],
  ["a5/send-reset-email", "reset-password"],
  ["a6/resend-reset-email", "reset-password"],
  ["a7/save-password", "update-password"],
  ["a8/save-password", "update-password"],
  ["a12/continue-sign-up", "sign-up"],
  ["a13/continue-sign-up", "sign-up"],
  ["e3/logout", "sign-out"]
]);

resetButton.dataset.action = "review-reset";

function requiredAuthStatus(screenId) {
  if (RECOVERY_SCREENS.has(screenId)) return "recovery-ready";
  if (AUTHENTICATED_SETUP_SCREENS.has(screenId)) return "authenticated";
  if (GUEST_MVP_ENABLED && (GUEST_SETUP_SCREENS.has(screenId) || /^[b-e]/u.test(screenId))) return null;
  if (/^[b-e]/u.test(screenId)) return "authenticated";
  return null;
}

function authorizedScreenId(screenId) {
  if (isLocalAuthFixtureLocation(window.location)) return screenId;
  const required = requiredAuthStatus(screenId);
  return !required || authStatus === required ? screenId : "a3";
}

function replaceWithLoginState({ preserveToast = true } = {}) {
  state.replace({
    ...state.getState(),
    currentScreenId: "a3",
    history: [],
    toast: preserveToast ? state.getState().toast : null
  });
  interactionState = state.getState();
  activeShareParams = null;
}

function readScreenIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.has("screen") ? params.get("screen") : null;
}

function rawShareValuesFromUrl() {
  const query = window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search;
  const hasShareMarker = /(?:^|&)(?:type|id|rn|rp)=/.test(query);
  if (!hasShareMarker) return null;

  let tokenCount = query ? 1 : 0;
  for (let index = 0; index < query.length; index += 1) {
    if (query[index] === "&") tokenCount += 1;
  }
  if (query.length > MAX_SHARED_QUERY_LENGTH || tokenCount > MAX_SHARED_QUERY_TOKENS) {
    return { errorId: "shared-target" };
  }

  const values = {};
  let tokenStart = 0;
  while (tokenStart <= query.length) {
    const ampersand = query.indexOf("&", tokenStart);
    const tokenEnd = ampersand < 0 ? query.length : ampersand;
    const separatorIndex = query.indexOf("=", tokenStart);
    const separator = separatorIndex >= tokenStart && separatorIndex < tokenEnd ? separatorIndex : tokenEnd;
    const keyLength = separator - tokenStart;
    const key = keyLength <= 4 ? query.slice(tokenStart, separator) : "";
    if (!SHARE_PARAM_KEYS.includes(key)) {
      if (ampersand < 0) break;
      tokenStart = ampersand + 1;
      continue;
    }
    if (Object.hasOwn(values, key)) return { errorId: "shared-target" };
    const valueStart = separator < tokenEnd ? separator + 1 : tokenEnd;
    const valueLength = tokenEnd - valueStart;
    if (valueLength > MAX_RAW_SHARE_LENGTHS[key]) return { errorId: "shared-target" };
    values[key] = query.slice(valueStart, tokenEnd);
    if (ampersand < 0) break;
    tokenStart = ampersand + 1;
  }
  return { values };
}

function decodeRawShareValue(rawValue) {
  if (typeof rawValue !== "string") return null;
  try {
    return decodeURIComponent(rawValue.replaceAll("+", " "));
  } catch {
    return null;
  }
}

function readSharedTargetFromUrl() {
  const rawShare = rawShareValuesFromUrl();
  if (!rawShare || rawShare.errorId) return rawShare;
  const { values } = rawShare;
  const type = decodeRawShareValue(values.type);
  const id = decodeRawShareValue(values.id);
  if (!id || !["place", "route"].includes(type)) return { errorId: id || type || "shared-target" };

  if (type === "place") {
    if (values.rn !== undefined || values.rp !== undefined) return { errorId: id };
    return dataCatalog.isKnownPlaceId(id)
      ? { type, id, shareParams: { type, id } }
      : { errorId: id };
  }

  const hasSnapshot = values.rn !== undefined || values.rp !== undefined;
  const course = courseById(dataSnapshot, id);
  if (course && !hasSnapshot) {
    return { type, id, route: course, shareParams: { type, id } };
  }

  const name = decodeRawShareValue(values.rn);
  const rawPlaceIds = decodeRawShareValue(values.rp);
  const routeIdMatch = /^saved-route-(\d+)$/.exec(id);
  const validName = typeof name === "string"
    && name.trim().length > 0
    && Array.from(name.trim()).length <= MAX_ROUTE_NAME_CODE_POINTS
    && !/[<>\u0000-\u001F\u007F]/u.test(name);
  if (!routeIdMatch
    || routeIdMatch[1].length > MAX_ROUTE_ID_DIGITS
    || !validName
    || typeof rawPlaceIds !== "string") {
    if (hasSnapshot) return { errorId: id };
  }

  const placeIds = typeof rawPlaceIds === "string" ? rawPlaceIds.split(",") : [];
  const hasValidSnapshot = routeIdMatch !== null
    && routeIdMatch[1].length <= MAX_ROUTE_ID_DIGITS
    && typeof name === "string"
    && validName
    && placeIds.length >= 2
    && placeIds.length <= MAX_ROUTE_PLACE_COUNT
    && new Set(placeIds).size === placeIds.length
    && placeIds.every((placeId) => dataCatalog.isKnownPlaceId(placeId));
  if (hasValidSnapshot) {
    const routeName = name.trim();
    return {
      type,
      id,
      route: { id, name: routeName, placeIds },
      shareParams: { type, id, rn: routeName, rp: placeIds.join(",") }
    };
  }
  if (hasSnapshot) return { errorId: id };

  const existingRoute = interactionState.savedRoutes?.find((route) => route.id === id);
  if (existingRoute) return { type, id, route: existingRoute, shareParams: { type, id } };
  return { errorId: id };
}

async function hydrateSharedTargetFromUrl() {
  const rawShare = rawShareValuesFromUrl();
  if (!rawShare || rawShare.errorId) return rawShare;
  const { values } = rawShare;
  const type = decodeRawShareValue(values.type);
  const id = decodeRawShareValue(values.id);
  if (!id || !/^[A-Za-z0-9_-]{1,100}$/u.test(id) || !["place", "route"].includes(type)) {
    return { errorId: id || type || "shared-target" };
  }
  if (type === "place" && (values.rn !== undefined || values.rp !== undefined)) return { errorId: id };

  const isKnown = type === "place" ? dataCatalog.isKnownPlaceId(id) : dataCatalog.isKnownCourseId(id);
  const hasSnapshot = values.rn !== undefined || values.rp !== undefined;
  if (isKnown || hasSnapshot || repository.mode !== "api") return null;

  try {
    const incoming = type === "place"
      ? await repository.getPlaceSnapshot(id)
      : await repository.getCourseSnapshot(id);
    dataSnapshot = mergeDataSnapshots(dataSnapshot, incoming);
    dataCatalog = createDataCatalog(dataSnapshot);
    state.setCatalog(dataCatalog);
    interactionState = state.getState();
    return null;
  } catch {
    return { errorId: id };
  }
}

function restoreSharedTargetFromUrl() {
  const target = readSharedTargetFromUrl();
  activeShareParams = target?.shareParams ? { screenId: null, values: target.shareParams } : null;
  if (!target || target.errorId) return target;

  const selections = { ...(interactionState.selections || {}) };
  if (target.type === "place") selections.selectedPlaceId = target.id;
  if (target.type === "route") {
    selections.selectedRouteId = target.id;
    if (readScreenIdFromUrl() === "b4") {
      selections.routeDetailSource = "feed";
      delete selections.selectedPlaceId;
      delete selections.selectedMediaId;
      delete selections.detailSheetState;
    }
  }
  const savedRoutes = target.type === "route" && !dataCatalog.isKnownCourseId(target.id)
    ? [...(interactionState.savedRoutes || []).filter((route) => route.id !== target.id), target.route]
    : interactionState.savedRoutes;
  const routeDraft = target.type === "route"
    ? { startPlaceId: target.route.placeIds[0], placeIds: [...target.route.placeIds] }
    : interactionState.routeDraft;

  state.replace({
    ...interactionState,
    selections,
    savedRoutes,
    routeDraft,
    routePlaceIds: routeDraft?.placeIds || interactionState.routePlaceIds
  });
  interactionState = state.getState();
  return target;
}

function stripInvalidShareParamsFromUrl() {
  const url = new URL(window.location.href);
  SHARE_PARAM_KEYS.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(window.history.state, "", url);
}

function browserHistoryEntry() {
  return window.history.state?.[BROWSER_HISTORY_KEY] || null;
}

function writeScreenIdToUrl(screenId, { replace = false } = {}) {
  const url = new URL(window.location.href);
  const params = new URLSearchParams({ screen: screenId });
  if (isLocalAuthFixtureLocation(window.location)) params.set("static", "1");
  if (activeShareParams?.screenId === screenId) {
    for (const [key, value] of Object.entries(activeShareParams.values)) params.set(key, value);
  }
  url.search = params.toString();
  const currentEntry = browserHistoryEntry();
  const depth = replace ? (currentEntry?.depth || 0) : (currentEntry?.depth || 0) + 1;
  const browserState = {
    ...(replace && window.history.state ? window.history.state : {}),
    [BROWSER_HISTORY_KEY]: {
      screenId,
      depth,
      previewState: stripSensitivePreviewData(structuredClone(interactionState))
    }
  };
  window.history[replace ? "replaceState" : "pushState"](browserState, "", url);
}

function refreshCurrentBrowserEntry() {
  const screenId = readScreenIdFromUrl();
  if (screenId && getScreen(screenId)) writeScreenIdToUrl(screenId, { replace: true });
}

function teardownRenderedScreen() {
  for (const rendered of phoneRoot.children) {
    rendered.dispatchEvent(new Event(SCREEN_TEARDOWN_EVENT));
    for (const descendant of rendered.querySelectorAll("*")) {
      descendant.dispatchEvent(new Event(SCREEN_TEARDOWN_EVENT));
    }
  }
}

function renderReviewList() {
  const currentState = state.getState();
  reviewList.replaceChildren(...groups.map((group) => {
    const section = document.createElement("section");
    section.className = "review-group";

    const title = document.createElement("h2");
    title.textContent = `Flow ${group}`;
    section.append(title);

    for (const screen of listScreens(group)) {
      const row = document.createElement("div");
      row.className = "review-screen";
      row.dataset.reviewScreenId = screen.id;

      const navigationButton = document.createElement("button");
      navigationButton.type = "button";
      navigationButton.className = "review-screen-link";
      navigationButton.textContent = screen.name;
      navigationButton.setAttribute("aria-current", currentState.currentScreenId === screen.id ? "page" : "false");
      navigationButton.dataset.action = "review-navigate";
      navigationButton.dataset.id = screen.id;

      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.className = "review-status";
      const isComplete = currentState.reviewStatus[screen.id] === "complete";
      statusButton.textContent = isComplete ? "완료" : "미검토";
      statusButton.setAttribute("aria-pressed", String(isComplete));
      statusButton.dataset.action = "review-toggle-status";
      statusButton.dataset.id = screen.id;

      row.append(navigationButton, statusButton);
      section.append(row);
    }

    return section;
  }));
}

function renderEvidenceScreen(screen) {
  const renderedScreen = screen.render(interactionState, dataSnapshot);
  teardownRenderedScreen();
  renderGeneration += 1;
  phoneRoot.replaceChildren(renderedScreen);
  if (dataLoadError && !isStaticPreview() && !renderedScreen.querySelector(".auth-feedback")) {
    const feedback = document.createElement("div");
    feedback.className = "preview-data-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    const message = document.createElement("span");
    message.textContent = "데이터를 불러오지 못했어요.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "다시 시도";
    retry.dataset.action = "app-retry-data";
    feedback.append(message, retry);
    phoneRoot.append(feedback);
  }
  if (interactionState.toast?.message
    && !renderedScreen.querySelector(".auth-feedback, .route-toast, .settings-toast")) {
    const feedback = document.createElement("output");
    feedback.className = `preview-toast preview-mutation-feedback preview-toast--${interactionState.toast.kind || "info"}`;
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    feedback.textContent = interactionState.toast.message;
    renderedScreen.append(feedback);
  }
  persistVisibleDefaults(renderedScreen);
  phoneRoot.dataset.previewMode = "evidence";
}

function persistVisibleDefaults(renderedScreen) {
  const screenId = renderedScreen.dataset.screenId;
  for (const target of renderedScreen.querySelectorAll('[data-persist-default="true"][data-action]')) {
    const payload = readActionPayload(target);
    const result = dispatchAction(screenId, target.dataset.action, payload);
    if (result.nextScreenId) {
      throw new Error(`Visible default must use a state-only action: ${screenId}/${target.dataset.action}`);
    }
    state.replace(result.state);
    interactionState = state.getState();
  }
}

function renderUnknownScreen(screenId) {
  teardownRenderedScreen();
  renderGeneration += 1;
  phoneRoot.replaceChildren();
  phoneRoot.dataset.previewMode = "review-error";

  const errorPanel = document.createElement("section");
  errorPanel.className = "review-error";
  const heading = document.createElement("h1");
  heading.textContent = "화면을 찾을 수 없습니다";
  const invalidId = document.createElement("code");
  invalidId.textContent = screenId;
  const returnButton = document.createElement("button");
  returnButton.type = "button";
  returnButton.textContent = "첫 화면으로 돌아가기";
  returnButton.dataset.action = "review-return-home";
  returnButton.dataset.id = "a1";
  errorPanel.append(heading, invalidId, returnButton);
  phoneRoot.append(errorPanel);
}

function renderScreen(screenId) {
  const screen = getScreen(screenId);
  if (!screen) {
    renderUnknownScreen(screenId);
    renderReviewList();
    return;
  }

  const changedScreen = lastRenderedScreenId !== null && lastRenderedScreenId !== screenId;
  renderEvidenceScreen(screen);
  if (changedScreen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    phoneRoot.firstElementChild?.classList.add("is-screen-entering");
  }
  if (analyticsClient && lastRenderedScreenId !== screenId) {
    analyticsClient.enterScreen(screenId);
    if (lastRenderedScreenId !== null) flushAnalytics();
  }
  lastRenderedScreenId = screenId;
  renderReviewList();
}

function navigate(screenId, { replace = false } = {}) {
  const authorizedId = authorizedScreenId(screenId);
  if (authorizedId !== screenId) {
    replaceWithLoginState();
    renderScreen("a3");
    writeScreenIdToUrl("a3", { replace: true });
    return;
  }
  const screen = getScreen(screenId);
  if (!screen) {
    renderUnknownScreen(screenId);
    return;
  }

  state.navigate(screenId, { replace });
  interactionState = state.getState();
  renderScreen(screenId);
  writeScreenIdToUrl(screenId, { replace });
}

function restoreBrowserNavigation(snapshot, screenId) {
  const currentState = state.getState();
  const snapshotState = snapshot?.previewState;
  if (snapshot?.screenId === screenId && Array.isArray(snapshotState?.history)) {
    state.replace({
      ...currentState,
      currentScreenId: screenId,
      history: [...snapshotState.history],
      selections: structuredClone(snapshotState.selections || {})
    });
    return;
  }

  const history = [...(currentState.history || [])];
  if (history.at(-1) === screenId) history.pop();
  state.replace({ ...currentState, currentScreenId: screenId, history });
}

async function renderFromUrl(event) {
  const requestedScreenId = readScreenIdFromUrl() || state.getState().currentScreenId;
  if (getScreen(requestedScreenId) && authorizedScreenId(requestedScreenId) !== requestedScreenId) {
    replaceWithLoginState();
    renderScreen("a3");
    writeScreenIdToUrl("a3", { replace: true });
    return;
  }
  const hydrationError = await hydrateSharedTargetFromUrl();
  if (hydrationError?.errorId) {
    stripInvalidShareParamsFromUrl();
    renderScreen(hydrationError.errorId);
    return;
  }
  const sharedTarget = restoreSharedTargetFromUrl();
  if (sharedTarget?.errorId) {
    stripInvalidShareParamsFromUrl();
    renderScreen(sharedTarget.errorId);
    return;
  }

  const screenId = readScreenIdFromUrl();
  if (screenId !== null && !getScreen(screenId)) {
    renderScreen(screenId);
    return;
  }

  let selectedScreenId = screenId || state.getState().currentScreenId;
  if (activeShareParams) activeShareParams.screenId = selectedScreenId;
  const locallyLoggedOut = state.getState().sessionStatus === "logged-out"
    || window.sessionStorage.getItem(LOGOUT_GUARD_KEY) === "1";
  if (event?.type === "popstate" && locallyLoggedOut) {
    selectedScreenId = "a3";
    pendingHistoryBack = null;
    state.replace({
      ...state.getState(),
      currentScreenId: "a3",
      history: [],
      toast: null
    });
  } else if (event?.type === "popstate" && pendingHistoryBack) {
    selectedScreenId = pendingHistoryBack.nextScreenId;
    restoreBrowserNavigation(event.state?.[BROWSER_HISTORY_KEY], selectedScreenId);
    pendingHistoryBack = null;
  } else if (event?.type === "popstate") {
    restoreBrowserNavigation(event.state?.[BROWSER_HISTORY_KEY], selectedScreenId);
  } else {
    state.navigate(selectedScreenId, { replace: true });
  }
  interactionState = state.getState();
  writeScreenIdToUrl(selectedScreenId, { replace: true });
  if (!staticPreview && selectedScreenId === "b1") {
    requestDiscoverFeed({ state: interactionState, effect: "none" }, selectedScreenId, {
      state: interactionState,
      data: dataSnapshot
    }, true);
    return;
  }
  renderScreen(selectedScreenId);
}

function readActionPayload(target) {
  const id = target.getAttribute("data-id");
  const payload = { state: interactionState, data: dataSnapshot };

  if (id !== null) payload.id = id;
  if (target.dataset.type) payload.type = target.dataset.type;
  if (target.dataset.placeId) payload.placeId = target.dataset.placeId;
  if (target.dataset.mediaId) payload.mediaId = target.dataset.mediaId;
  if (target.dataset.userId) payload.userId = target.dataset.userId;
  if (target.dataset.routeId) payload.routeId = target.dataset.routeId;
  if (target.dataset.commentId) payload.commentId = target.dataset.commentId;
  if (target.dataset.contentId) payload.contentId = target.dataset.contentId;
  if (target.dataset.selectionKey) payload.selectionKey = target.dataset.selectionKey;
  if ("value" in target) payload.value = target.value;
  if ("checked" in target) payload.checked = target.checked;
  payload.reviewFixtureMode = isLocalAuthFixtureLocation(window.location);

  return payload;
}

function currentAppEntryPath() {
  return window.location.pathname === "/app" || window.location.pathname.startsWith("/app/")
    ? "/app"
    : "/app-preview/";
}

function canonicalAppLink(screenId, payload) {
  const url = new URL("/app", window.location.origin);
  const target = interactionState.selections?.shareTarget;
  const type = target?.type || payload.type;
  const id = target?.id || payload.id;

  url.searchParams.set("screen", screenId);
  if (type) url.searchParams.set("type", type);
  if (id) url.searchParams.set("id", id);
  if (type === "route" && /^saved-route-\d+$/u.test(id || "")) {
    const route = interactionState.savedRoutes?.find((item) => item.id === id);
    if (route) {
      url.searchParams.set("rn", route.name);
      url.searchParams.set("rp", route.placeIds.join(","));
    }
  }
  return url.href;
}

async function copyCanonicalLink(link) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(link);
    return;
  }

  const input = document.createElement("textarea");
  input.value = link;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Preview link copy failed");
}

function setEffectToast(kind, message) {
  interactionState = {
    ...interactionState,
    toast: { kind, message, duration: 2500 }
  };
  state.replace(interactionState);
  interactionState = state.getState();
  phoneRoot.dataset.toastKind = kind;
  refreshCurrentBrowserEntry();
}

async function runDomEffect(effect, screenId, payload) {
  if (!effect || effect === "none") return;

  const link = canonicalAppLink(screenId, payload);
  if (effect === "share" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Doripe", url: link });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyCanonicalLink(link);
    setEffectToast("success", "링크를 복사했어요");
  } catch {
    setEffectToast("error", "링크를 복사하지 못했어요");
  }
}

function applyActionResult(result, { rerender, screenId, payload }) {
  state.replace(result.state);
  interactionState = state.getState();
  if (result.nextScreenId) {
    if (result.browserHistoryMode === "logout") {
      window.sessionStorage.setItem(LOGOUT_GUARD_KEY, "1");
      pendingHistoryBack = null;
      activeShareParams = null;
      renderScreen(result.nextScreenId);
      writeScreenIdToUrl(result.nextScreenId, { replace: true });
    } else if (result.historyMode === "back" && (browserHistoryEntry()?.depth || 0) > 0) {
      pendingHistoryBack = {
        nextScreenId: result.nextScreenId,
        state: interactionState
      };
      window.history.back();
    } else {
      renderScreen(result.nextScreenId);
      writeScreenIdToUrl(result.nextScreenId, { replace: result.historyMode === "back" });
    }
  } else {
    if (rerender) renderScreen(interactionState.currentScreenId);
    refreshCurrentBrowserEntry();
  }
  void runDomEffect(result.effect, screenId, payload);
}

function mergeStaleMutationState(result, optimisticState) {
  if (interactionState.currentScreenId === optimisticState.currentScreenId) return result.state;

  const merged = { ...interactionState, toast: result.state.toast };
  for (const key of result.changedKeys || []) {
    if (key !== "selections") merged[key] = result.state[key];
  }
  if ((result.changedKeys || []).includes("selections")) {
    const optimisticRouteId = optimisticState.selections?.selectedRouteId;
    merged.selections = {
      ...(interactionState.selections || {}),
      ...(interactionState.selections?.selectedRouteId === optimisticRouteId
        ? { selectedRouteId: result.state.selections?.selectedRouteId }
        : {})
    };
  }
  return merged;
}

function flushAnalytics() {
  if (!analyticsClient || !analyticsSession) return;
  void analyticsSession.then((session) => (session.ok ? analyticsClient.flush() : null));
}

function recordAuthCompletion(authResult, sourceScreen) {
  const eventName = authResult?.authEvent;
  if (!analyticsClient || !["signup_complete", "login_complete"].includes(eventName)) return;
  analyticsClient.recordEvent(eventName, { sourceScreen, properties: {} });
  flushAnalytics();
}

function successfulProductEvent(input, result) {
  if (!result.ok || result.status !== "synced") return null;
  const { screenId, actionId, payload = {}, previousState, optimisticState } = input;

  if (screenId === "a19" && ["continue-sign-up", "skip-question"].includes(actionId)) {
    return { name: "onboarding_complete", properties: {} };
  }

  if (actionId === "save-place") {
    const placeId = payload.placeId || payload.id;
    const wasSaved = previousState.savedPlaceIds?.includes(placeId) === true;
    return { name: wasSaved ? "place_unsave" : "place_save", properties: { placeId } };
  }
  if (actionId === "toggle-follow") {
    const targetId = payload.userId || payload.id;
    const wasFollowed = previousState.followedUserIds?.includes(targetId) === true;
    return { name: wasFollowed ? "unfollow" : "follow", properties: { targetType: "profile", targetId } };
  }
  if (["submit-comment", "submit-course-comment"].includes(actionId)) {
    const contentId = payload.contentId || previousState.selections?.selectedContentId;
    return { name: "comment_create", properties: { contentId } };
  }
  if (actionId === "save-shared-route") {
    const targetId = payload.routeId || payload.id;
    const removedSave = (optimisticState.savedRoutes?.length || 0) < (previousState.savedRoutes?.length || 0);
    return { name: removedSave ? "course_unsave" : "course_save", properties: { targetType: "course", targetId } };
  }
  if (actionId === "save-route") {
    const targetId = result.state.selections?.selectedRouteId;
    return { name: "course_complete", properties: { targetType: "course", targetId } };
  }
  return null;
}

function recordSuccessfulProductAction(input, result) {
  const event = analyticsClient ? successfulProductEvent(input, result) : null;
  if (!event) return;
  analyticsClient.recordEvent(event.name, {
    sourceScreen: input.previousState.currentScreenId,
    properties: event.properties
  });
  flushAnalytics();
}

async function syncProductAction(input) {
  const result = await actionSync.run(input);
  if (result.status === "local") return;
  recordSuccessfulProductAction(input, result);

  state.replace(mergeStaleMutationState(result, input.optimisticState));
  interactionState = state.getState();
  renderScreen(interactionState.currentScreenId);
  writeScreenIdToUrl(interactionState.currentScreenId, { replace: true });
}

function authFieldValue(screen, actionId, fallback = "") {
  const input = screen?.querySelector(`[data-action="${actionId}"]`);
  return input && "value" in input ? input.value : fallback;
}

function clearSubmittedPasswords(screen) {
  for (const input of screen?.querySelectorAll('input[type="password"]') || []) input.value = "";
  clearVolatilePasswords();
}

async function reconcileAuthenticatedState(guestState, { loadFirst = false, migrateIdentity = false } = {}) {
  try {
    if (loadFirst) await dataStore.load();
    dataSnapshot = dataStore.getSnapshot();
    if (!dataSnapshot.personalDataLoaded || !dataSnapshot.viewerProfileId) {
      throw new Error("로그인은 완료됐지만 계정 데이터를 불러오지 못했어요");
    }

    const plan = createGuestMigrationPlan({
      guestState,
      snapshot: dataSnapshot,
      viewerId: dataSnapshot.viewerProfileId,
      migrateIdentity
    });
    const journal = prepareGuestMigrationJournal({ storage: window.localStorage, plan });
    const migration = await executeGuestMigration({
      storage: window.localStorage,
      repository,
      journal
    });
    if (journal.tasks.length > 0) {
      await dataStore.load();
      dataSnapshot = dataStore.getSnapshot();
    }

    const migratedCommentIds = new Set(migration.journal.tasks
      .filter((item) => item.type === "create-comment" && item.status === "done")
      .map((item) => item.payload?.sourceCommentId)
      .filter(Boolean));
    const reconciledGuestState = migratedCommentIds.size === 0
      ? guestState
      : {
          ...guestState,
          submittedComments: (guestState.submittedComments || [])
            .filter((comment) => !migratedCommentIds.has(comment.id))
        };

    dataCatalog = createDataCatalog(dataSnapshot);
    state.setCatalog(dataCatalog);
    state.replace(mergePersonalSnapshotIntoState(reconciledGuestState, dataSnapshot, {
      preserveGuestData: !migration.complete
    }));
    dataLoadError = !dataSnapshot.personalDataLoaded
      ? new Error("로그인은 완료됐지만 계정 데이터를 불러오지 못했어요")
      : migration.complete
        ? null
        : new Error("일부 비회원 데이터를 계정으로 옮기지 못했어요. 다음 접속 때 다시 시도할게요");
    personalDataReady = true;
    return true;
  } catch (error) {
    personalDataReady = false;
    dataLoadError = error;
    dataCatalog = createUnavailableDataCatalog();
    state.setCatalog(dataCatalog);
    state.replace(guestState);
    return false;
  }
}

async function hydrateStateAfterAuthentication({ migrateIdentity = false } = {}) {
  const hydrated = await reconcileAuthenticatedState(state.getState(), { loadFirst: true, migrateIdentity });
  interactionState = state.getState();
  return hydrated;
}

async function dispatchRemoteAuthAction(target, screenId, actionId, operation) {
  if (target.disabled || target.dataset.authSubmitting === "true") return;
  if (["sign-in", "sign-up", "update-password"].includes(operation)) invalidateDiscoverFilterRequests();
  const screen = target.closest("[data-screen-id]");
  const email = authFieldValue(screen, "update-email", interactionState.form?.email || "");
  const password = authFieldValue(screen, "update-password");
  const newPassword = authFieldValue(screen, "update-new-password");
  const passwordConfirmation = authFieldValue(screen, "update-password-confirmation");
  const requestGeneration = renderGeneration;
  const controller = new AbortController();
  screen?.addEventListener(SCREEN_TEARDOWN_EVENT, () => controller.abort(), { once: true });

  target.disabled = true;
  target.setAttribute("aria-disabled", "true");
  target.setAttribute("aria-busy", "true");
  target.dataset.authSubmitting = "true";
  clearSubmittedPasswords(screen);

  let authResult;
  try {
    if (operation === "sign-in") authResult = await authClient.signIn({ email, password, signal: controller.signal });
    if (operation === "sign-up") {
      const redirectTo = new URL(`${currentAppEntryPath()}?screen=a14`, window.location.origin).href;
      authResult = await authClient.signUp({ email, password, redirectTo, signal: controller.signal });
    }
    if (operation === "reset-password") {
      const redirectTo = new URL(`${currentAppEntryPath()}?screen=a7`, window.location.origin).href;
      authResult = await authClient.requestPasswordReset({ email, redirectTo, signal: controller.signal });
    }
    if (operation === "update-password") {
      authResult = await authClient.updatePassword({ password: newPassword, confirmation: passwordConfirmation, signal: controller.signal });
    }
    if (operation === "sign-out") authResult = await authClient.signOut({ signal: controller.signal });
  } catch {
    authResult = { ok: false, code: "network", message: "네트워크 연결을 확인하고 다시 시도해 주세요" };
  }

  const stale = controller.signal.aborted
    || requestGeneration !== renderGeneration
    || !screen?.isConnected
    || interactionState.currentScreenId !== screenId;
  if (stale) {
    if (["sign-in", "sign-up"].includes(operation)) authClient.clearSession();
    if (target.isConnected) {
      target.disabled = false;
      target.setAttribute("aria-disabled", "false");
      target.removeAttribute("aria-busy");
      delete target.dataset.authSubmitting;
    }
    return;
  }

  if (authResult.ok && authResult.status === "authenticated") {
    authStatus = "authenticated";
    window.sessionStorage.removeItem(LOGOUT_GUARD_KEY);
    const hydrated = await hydrateStateAfterAuthentication({ migrateIdentity: operation === "sign-up" });
    if (hydrated) {
      recordAuthCompletion(authResult, screenId);
    } else {
      authClient.clearSession();
      authStatus = "no-session";
      authResult = {
        ok: false,
        code: "account-data-unavailable",
        message: "계정 데이터를 불러오지 못했어요. 잠시 후 다시 로그인해 주세요"
      };
    }
  }
  if (authResult.ok && authResult.status === "password-updated") authStatus = "no-session";
  if (target.isConnected) {
    target.disabled = false;
    target.setAttribute("aria-disabled", "false");
    target.removeAttribute("aria-busy");
    delete target.dataset.authSubmitting;
  }
  const payload = { state: interactionState, data: dataSnapshot, authResult };
  const result = dispatchAction(screenId, actionId, payload);
  applyActionResult(result, { rerender: true, screenId, payload });
}

function dispatchLocalFirstLogout(target, screenId, actionId) {
  if (target.disabled || target.dataset.authSubmitting === "true") return;
  invalidateDiscoverFilterRequests();
  const completeRemoteLogout = authClient.beginSignOut();
  clearGuestMigrationJournal();
  authStatus = "no-session";
  personalDataReady = false;
  const payload = {
    state: interactionState,
    data: dataSnapshot,
    authResult: { ok: true, status: "signed-out" }
  };
  const result = dispatchAction(screenId, actionId, payload);
  applyActionResult(result, { rerender: true, screenId, payload });

  void completeRemoteLogout().then((remoteResult) => {
    if (!remoteResult.warning
      || authStatus !== "no-session"
      || interactionState.currentScreenId !== "a3"
      || interactionState.sessionStatus !== "logged-out") return;
    state.replace({
      ...interactionState,
      toast: { kind: "info", message: remoteResult.warning, duration: 4000 }
    });
    interactionState = state.getState();
    renderScreen("a3");
    refreshCurrentBrowserEntry();
  });
}

function feedScopeForScreen(screenId = interactionState.currentScreenId) {
  return screenId === "b1" ? "following" : "discover";
}

function discoverFilterParams(selections = {}, screenId = interactionState.currentScreenId) {
  const tagIds = [selections.situation, selections.time, selections.mood]
    .filter((id) => typeof id === "string" && (repository.mode === "fixture"
      || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)));
  const params = { scope: feedScopeForScreen(screenId), tagIds };
  const center = selections.locationCenter;
  const radiusKm = Number(selections.locationRadiusKm);
  if (selections.locationMode === "pin"
    && Number.isFinite(center?.latitude)
    && Number.isFinite(center?.longitude)
    && [1, 3, 5, 10].includes(radiusKm)) {
    params.centerLat = center.latitude;
    params.centerLng = center.longitude;
    params.radiusKm = radiusKm;
  }
  return params;
}

function feedRenderState() {
  const feed = phoneRoot.querySelector(".discover-feed");
  const loadMore = feed?.querySelector(".discover-feed__load-more");
  return {
    scrollTop: feed?.scrollTop || 0,
    restoreLoadMoreFocus: document.activeElement === loadMore
  };
}

function updateDiscoverFeedState(nextSelections, { expectedScreenId = null, preserveFeedPosition = false } = {}) {
  const renderedFeedState = preserveFeedPosition ? feedRenderState() : null;
  state.replace({ ...interactionState, selections: nextSelections });
  interactionState = state.getState();
  if (!expectedScreenId || interactionState.currentScreenId === expectedScreenId) {
    renderScreen(interactionState.currentScreenId);
    if (renderedFeedState) {
      const feed = phoneRoot.querySelector(".discover-feed");
      if (feed) feed.scrollTop = renderedFeedState.scrollTop;
      if (renderedFeedState.restoreLoadMoreFocus) {
        feed?.querySelector(".discover-feed__load-more")?.focus({ preventScroll: true });
      }
    }
  }
  refreshCurrentBrowserEntry();
}

function requestDiscoverFeed(transitionResult, screenId, payload, rerender) {
  const requestId = ++discoverFilterRequestSequence;
  discoverSeenCursors.clear();
  const requestFeedScreenId = transitionResult.state.currentScreenId;
  const requestParams = discoverFilterParams(transitionResult.state.selections, requestFeedScreenId);
  const loadingSelections = {
    ...(transitionResult.state.selections || {}),
    serverFeedFiltered: true,
    discoverFeedContentIds: [],
    feedStatus: "loading",
    feedLoadingMore: false,
    feedLoadMoreStatus: "idle"
  };
  applyActionResult({ ...transitionResult, state: { ...transitionResult.state, selections: loadingSelections } }, {
    rerender, screenId, payload
  });

  if (requestParams.scope === "following" && !authClient.getAccessToken()) {
    dataSnapshot = mergeDataSnapshots(dataSnapshot, { feedNextCursor: null });
    updateDiscoverFeedState({
      ...(interactionState.selections || {}),
      serverFeedFiltered: true,
      discoverFeedContentIds: [],
      feedStatus: "empty",
      feedLoadingMore: false,
      feedLoadMoreStatus: "complete"
    }, { expectedScreenId: requestFeedScreenId });
    return;
  }

  const requestActor = `${authClient.getAccessToken() ? "account" : "guest"}:${dataSnapshot.viewerProfileId || ""}`;
  void repository.getFeedSnapshot(requestParams).then((incoming) => {
    const currentActor = `${authClient.getAccessToken() ? "account" : "guest"}:${dataSnapshot.viewerProfileId || ""}`;
    if (requestId !== discoverFilterRequestSequence || requestActor !== currentActor) return;
    dataSnapshot = mergeDataSnapshots(dataSnapshot, incoming);
    dataCatalog = createDataCatalog(dataSnapshot);
    state.setCatalog(dataCatalog);
    updateDiscoverFeedState({
      ...(interactionState.selections || {}),
      serverFeedFiltered: true,
      discoverFeedContentIds: incoming.contents.map((content) => content.id),
      feedStatus: incoming.contents.length ? "ready" : "empty",
      feedLoadingMore: false,
      feedLoadMoreStatus: incoming.feedNextCursor ? "ready" : "complete"
    }, { expectedScreenId: requestFeedScreenId });
  }).catch(() => {
    const currentActor = `${authClient.getAccessToken() ? "account" : "guest"}:${dataSnapshot.viewerProfileId || ""}`;
    if (requestId !== discoverFilterRequestSequence || requestActor !== currentActor) return;
    updateDiscoverFeedState({
      ...(interactionState.selections || {}),
      serverFeedFiltered: true,
      feedStatus: "error",
      feedLoadingMore: false,
      feedLoadMoreStatus: "idle"
    }, { expectedScreenId: requestFeedScreenId });
  });
}

function requestNextDiscoverFeed(screenId) {
  const cursor = dataSnapshot.feedNextCursor;
  if (!cursor || discoverSeenCursors.has(cursor) || interactionState.selections?.feedLoadingMore === true) return;
  discoverSeenCursors.add(cursor);
  const requestId = ++discoverFilterRequestSequence;
  const requestFeedScreenId = interactionState.currentScreenId;
  const requestActor = `${authClient.getAccessToken() ? "account" : "guest"}:${dataSnapshot.viewerProfileId || ""}`;
  state.replace({
    ...interactionState,
    selections: {
      ...(interactionState.selections || {}),
      feedLoadingMore: true,
      feedLoadMoreStatus: "loading"
    }
  });
  interactionState = state.getState();
  const feed = phoneRoot.querySelector(".discover-feed");
  const loadMore = feed?.querySelector(".discover-feed__load-more");
  if (feed) feed.setAttribute("aria-busy", "true");
  if (loadMore) {
    loadMore.disabled = true;
    loadMore.textContent = "더 불러오는 중…";
  }
  refreshCurrentBrowserEntry();

  void repository.getFeedSnapshot({
    ...discoverFilterParams(interactionState.selections, requestFeedScreenId),
    cursor
  }).then((incoming) => {
    const currentActor = `${authClient.getAccessToken() ? "account" : "guest"}:${dataSnapshot.viewerProfileId || ""}`;
    if (requestId !== discoverFilterRequestSequence || requestActor !== currentActor) return;
    const previousIds = Array.isArray(interactionState.selections?.discoverFeedContentIds)
      ? interactionState.selections.discoverFeedContentIds
      : initialDiscoverContentIds;
    const nextIds = [...new Set([...previousIds, ...incoming.contents.map((content) => content.id)])];
    const nextCursor = incoming.feedNextCursor && !discoverSeenCursors.has(incoming.feedNextCursor)
      ? incoming.feedNextCursor
      : null;
    dataSnapshot = mergeDataSnapshots(dataSnapshot, { ...incoming, feedNextCursor: nextCursor });
    dataCatalog = createDataCatalog(dataSnapshot);
    state.setCatalog(dataCatalog);
    updateDiscoverFeedState({
      ...(interactionState.selections || {}),
      discoverFeedContentIds: nextIds,
      feedLoadingMore: false,
      feedLoadMoreStatus: nextCursor ? "ready" : "complete",
      feedStatus: nextIds.length ? "ready" : "empty"
    }, { expectedScreenId: requestFeedScreenId, preserveFeedPosition: true });
  }).catch(() => {
    const currentActor = `${authClient.getAccessToken() ? "account" : "guest"}:${dataSnapshot.viewerProfileId || ""}`;
    if (requestId !== discoverFilterRequestSequence || requestActor !== currentActor) return;
    updateDiscoverFeedState({
      ...(interactionState.selections || {}),
      feedLoadingMore: false,
      feedLoadMoreStatus: "error"
    }, { expectedScreenId: requestFeedScreenId, preserveFeedPosition: true });
  });
}

function applyDiscoverFeedFilters(screenId, actionId, payload, rerender) {
  requestDiscoverFeed(dispatchAction(screenId, actionId, payload), screenId, payload, rerender);
}

function retryDiscoverFeed(screenId) {
  requestDiscoverFeed({ state: { ...interactionState, toast: null }, effect: "none" }, screenId, {
    state: interactionState,
    data: dataSnapshot
  }, true);
}

function resetDiscoverFeedFilters(screenId, actionId, payload, rerender) {
  const transitionResult = dispatchAction(screenId, actionId, payload);
  requestDiscoverFeed(transitionResult, screenId, payload, rerender);
}

function dispatchTargetAction(target, { rerender = true } = {}) {
  const actionId = target.dataset.action;
  const screenId = target.dataset.actionScreenId
    || target.closest("[data-screen-id]")?.dataset.screenId
    || interactionState.currentScreenId;
  const payload = readActionPayload(target);
  const isDiscoverFilterOverlay = screenId === "c3" && interactionState.overlays?.includes("feed-filter-sheet");
  if (isDiscoverFilterOverlay && actionId === "apply-filters") {
    applyDiscoverFeedFilters(screenId, actionId, payload, rerender);
    return;
  }
  if (isDiscoverFilterOverlay && actionId === "reset-filters") {
    resetDiscoverFeedFilters(screenId, actionId, payload, rerender);
    return;
  }
  const switchesFeedScope = (screenId === "b1" && actionId === "show-discover")
    || (screenId === "b2" && actionId === "show-following");
  if (switchesFeedScope) {
    requestDiscoverFeed(dispatchAction(screenId, actionId, payload), screenId, payload, rerender);
    return;
  }
  const pendingInput = { screenId, actionId, payload, previousState: interactionState, optimisticState: interactionState };
  if (actionSync.isPending(pendingInput)) return;
  const operation = REMOTE_AUTH_ACTIONS.get(`${screenId}/${actionId}`);
  if (operation && payload.reviewFixtureMode !== true) {
    if (operation === "sign-out") {
      dispatchLocalFirstLogout(target, screenId, actionId);
      return;
    }
    void dispatchRemoteAuthAction(target, screenId, actionId, operation);
    return;
  }
  const previousState = interactionState;
  const transitionResult = dispatchAction(screenId, actionId, payload);
  const optimisticState = actionSync.prepare({
    screenId,
    actionId,
    payload,
    previousState,
    transitionState: transitionResult.state
  });
  const result = { ...transitionResult, state: optimisticState };
  if (screenId === "e3" && actionId === "save-password") {
    clearSubmittedPasswords(target.closest("[data-screen-id]"));
  }
  applyActionResult(result, { rerender, screenId, payload });
  void syncProductAction({
    screenId,
    actionId,
    payload,
    previousState,
    optimisticState: interactionState
  });
}

function handleReviewAction(actionId, id) {
  if (actionId === "review-navigate" || actionId === "review-return-home") {
    navigate(id || "a1");
    return true;
  }

  if (actionId === "review-toggle-status") {
    const isComplete = state.getState().reviewStatus[id] === "complete";
    state.setReviewStatus(id, isComplete ? "unreviewed" : "complete");
    interactionState = {
      ...interactionState,
      reviewStatus: { ...state.getState().reviewStatus }
    };
    renderReviewList();
    refreshCurrentBrowserEntry();
    return true;
  }

  if (actionId === "review-reset") {
    state.reset();
    interactionState = state.getState();
    renderScreen("a1");
    writeScreenIdToUrl("a1", { replace: true });
    return true;
  }

  return false;
}

function handleAppAction(actionId) {
  if (actionId !== "app-retry-data") return false;
  window.location.reload();
  return true;
}

function isActionFormControl(target) {
  return target.matches("input, select, textarea");
}

function isChangeOnlyControl(target) {
  return target.matches([
    "select",
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="date"]',
    'input[type="file"]'
  ].join(", "));
}

function enforceLocalLogoutAfterRestore() {
  if (window.sessionStorage.getItem(LOGOUT_GUARD_KEY) !== "1" || readScreenIdFromUrl() === "a3") return;
  state.replace({
    ...state.getState(),
    currentScreenId: "a3",
    history: [],
    sessionStatus: "logged-out",
    toast: null
  });
  interactionState = state.getState();
  renderScreen("a3");
  writeScreenIdToUrl("a3", { replace: true });
}

window.addEventListener("popstate", (event) => { void renderFromUrl(event); });
window.addEventListener("pageshow", enforceLocalLogoutAfterRestore);
document.addEventListener(SCREEN_NAVIGATE_EVENT, (event) => {
  navigate(event.detail.screenId, { replace: event.detail.replace === true });
});
document.addEventListener(FEED_STATUS_EVENT, (event) => {
  const feedStatus = event.detail?.status;
  if (feedStatus === "retry") {
    retryDiscoverFeed(interactionState.currentScreenId);
    return;
  }
  if (feedStatus === "next-page") {
    requestNextDiscoverFeed(interactionState.currentScreenId);
    return;
  }
  if (!["ready", "loading", "error", "empty"].includes(feedStatus)) return;
  state.replace({
    ...interactionState,
    selections: { ...(interactionState.selections || {}), feedStatus }
  });
  interactionState = state.getState();
  renderScreen(interactionState.currentScreenId);
  refreshCurrentBrowserEntry();
});
document.addEventListener(DETAIL_SHEET_STATE_EVENT, (event) => {
  const detailSheetState = event.detail?.state;
  if (!["collapsed", "medium", "expanded"].includes(detailSheetState)) return;
  state.replace({
    ...interactionState,
    selections: { ...(interactionState.selections || {}), detailSheetState }
  });
  interactionState = state.getState();
  refreshCurrentBrowserEntry();
});
document.addEventListener(FEED_FILTER_DISMISS_EVENT, () => {
  state.replace({
    ...interactionState,
    overlays: (interactionState.overlays || []).filter((overlay) => overlay !== "feed-filter-sheet")
  });
  interactionState = state.getState();
  renderScreen(interactionState.currentScreenId);
  refreshCurrentBrowserEntry();
});
document.addEventListener(OVERLAY_DISMISS_EVENT, (event) => {
  const overlayId = event.detail?.overlayId;
  if (!overlayId) return;
  state.replace({
    ...interactionState,
    overlays: (interactionState.overlays || []).filter((overlay) => overlay !== overlayId)
  });
  interactionState = state.getState();
  renderScreen(interactionState.currentScreenId);
  refreshCurrentBrowserEntry();
});
document.addEventListener(SELECTION_CLEAR_EVENT, (event) => {
  const keys = Array.isArray(event.detail?.keys) ? event.detail.keys : [];
  if (!keys.length) return;
  const selections = { ...(interactionState.selections || {}) };
  keys.forEach((key) => delete selections[key]);
  state.replace({ ...interactionState, selections });
  interactionState = state.getState();
  renderScreen(interactionState.currentScreenId);
  refreshCurrentBrowserEntry();
});
document.addEventListener(MEDIA_HIDE_EVENT, (event) => {
  const mediaId = event.detail?.mediaId;
  if (!mediaId) return;
  const hiddenMediaIds = interactionState.hiddenMediaIds?.includes(mediaId)
    ? [...interactionState.hiddenMediaIds]
    : [...(interactionState.hiddenMediaIds || []), mediaId];
  state.replace({
    ...interactionState,
    hiddenMediaIds,
    overlays: (interactionState.overlays || []).filter((overlay) => overlay !== "photo-menu"),
    toast: { kind: "success", message: "이 사진을 숨겼어요", duration: 2500 }
  });
  interactionState = state.getState();
  renderScreen(interactionState.currentScreenId);
  refreshCurrentBrowserEntry();
});
document.addEventListener("click", (event) => {
  const target = event.target.closest?.("[data-action]");
  if (!target) return;

  const actionId = target.dataset.action;
  const id = target.getAttribute("data-id");
  if (handleAppAction(actionId)) return;
  if (handleReviewAction(actionId, id)) return;
  if (isActionFormControl(target)) return;
  dispatchTargetAction(target);
});

document.addEventListener("input", (event) => {
  const target = event.target.closest?.("[data-action]");
  if (!target || handleReviewAction(target.dataset.action, target.getAttribute("data-id"))) return;
  if (isChangeOnlyControl(target)) return;
  dispatchTargetAction(target, { rerender: false });
});

document.addEventListener("change", (event) => {
  const target = event.target.closest?.("[data-action]");
  if (!target || !isChangeOnlyControl(target)) return;
  dispatchTargetAction(target);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const target = phoneRoot.querySelector("[data-escape-action]");
  if (target) dispatchTargetAction(target);
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target.closest?.("[data-pointer-effect]");
  if (!target) return;
  activePointerTarget = target;
  target.dataset.pointerActive = "true";
});

document.addEventListener("pointerup", () => {
  if (activePointerTarget) delete activePointerTarget.dataset.pointerActive;
  activePointerTarget = null;
});

document.addEventListener("pointercancel", () => {
  if (activePointerTarget) delete activePointerTarget.dataset.pointerActive;
  activePointerTarget = null;
});

if (!startupAuthResult.ok) {
  const invalidStoredSession = hadStartupSession && startupAuthResult.code === "invalid-session";
  if (invalidStoredSession) authClient.clearSession();
  const startupScreenId = readScreenIdFromUrl() || state.getState().currentScreenId;
  const invalidSessionNeedsLogin = invalidStoredSession && requiredAuthStatus(startupScreenId) !== null;
  const nextState = {
    ...state.getState(),
    currentScreenId: invalidSessionNeedsLogin ? "a3" : state.getState().currentScreenId,
    history: invalidSessionNeedsLogin ? [] : state.getState().history,
    toast: { kind: "error", message: startupAuthResult.message, duration: 4000 }
  };
  if (invalidSessionNeedsLogin) nextState.sessionStatus = "logged-out";
  else if (invalidStoredSession) delete nextState.sessionStatus;
  state.replace(nextState);
  interactionState = state.getState();
  if (invalidSessionNeedsLogin) {
    window.sessionStorage.setItem(LOGOUT_GUARD_KEY, "1");
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ screen: "a3" }).toString();
    window.history.replaceState(null, "", url);
  } else if (invalidStoredSession) {
    window.sessionStorage.removeItem(LOGOUT_GUARD_KEY);
  }
} else if (authStatus === "authenticated" && personalDataReady) {
  window.sessionStorage.removeItem(LOGOUT_GUARD_KEY);
}
analyticsClient?.attachLifecycle();
setBootProgress(100);
appRuntimeReady = true;
applyUnauthorizedNotice();
await renderFromUrl();
if (analyticsClient) {
  analyticsSession = analyticsClient.startSession({
    entryPath: `${window.location.pathname}${window.location.search}`,
    sourceScreen: lastRenderedScreenId || "app"
  });
  if (authStatus === "authenticated" && personalDataReady) {
    recordAuthCompletion(startupAuthResult, lastRenderedScreenId || "app");
  }
  flushAnalytics();
}
