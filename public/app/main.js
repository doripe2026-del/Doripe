import { loadBootstrap, refreshBootstrapCache, track, createShareLink, loadShareLink } from "./api.js";
import {
  loadState,
  saveState,
  rememberSavedPlace,
  rememberSkippedPlace,
  rememberUnsavedPlace
} from "./state.js";
import { CONFIG } from "./config.js";
import { renderApp, currentDiscoverPlace } from "./render.js";

const root = document.getElementById("app");
let state = loadState();
let data = { places: [], neighborhoods: [], categories: [], regions: [], config: {} };
let activeCardExposure = null;
let isCardActionAnimating = false;
let sessionStartedAt = Date.now();
let discoverTutorialTimer = null;
const preloadedImages = new Map();
const pendingShareLinks = new Map();

function setBootProgress(percent) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  root?.style.setProperty("--boot-progress", String(clamped / 100));
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function imageUrlsForPlace(place) {
  return Array.from(new Set([
    ...(place?.images || []),
    place?.coverImageUrl
  ].filter(Boolean)));
}

function normalizeBootstrap(bootstrap) {
  const { __fromCache, __cacheFresh, ...rest } = bootstrap || {};
  return rest;
}

function preconnectImageOrigins() {
  const origins = Array.from(new Set(data.places
    .flatMap(imageUrlsForPlace)
    .map((url) => {
      try {
        return new URL(url, window.location.href).origin;
      } catch {
        return "";
      }
    })
    .filter((origin) => origin && origin !== window.location.origin)));

  origins.slice(0, 3).forEach((origin) => {
    if (document.head.querySelector(`link[data-doripe-preconnect="${origin}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origin;
    link.crossOrigin = "anonymous";
    link.dataset.doripePreconnect = origin;
    document.head.appendChild(link);
  });
}

function preloadImage(url) {
  if (!url || typeof Image === "undefined") return null;
  if (preloadedImages.has(url)) return preloadedImages.get(url);
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.loading = "eager";
  const promise = new Promise((resolve) => {
    image.onload = async () => {
      if (typeof image.decode === "function") {
        await image.decode().catch(() => {});
      }
      resolve({ url, ok: true });
    };
    image.onerror = () => resolve({ url, ok: false });
  });
  image.src = url;
  const entry = { image, promise };
  preloadedImages.set(url, entry);
  return entry;
}

function preloadUrls(urls) {
  urls.forEach((url) => preloadImage(url));
}

async function preloadCriticalImages(onProgress) {
  const firstPlaceImages = imageUrlsForPlace(data.places[0]).slice(0, 2);
  const urls = [
    "/app/assets/figma-a0-logo.png",
    "/app/assets/creator-avatar.png",
    "/app/assets/creator-photos/creator-01.png",
    "/app/assets/creator-photos/creator-02.png",
    "/app/assets/creator-photos/creator-03.png",
    "/app/assets/creator-photos/creator-04.png",
    "/app/assets/seoul-map-bg-doripe.jpg",
    "/app/assets/figma-place-photo-34.jpg",
    ...firstPlaceImages
  ];
  preloadUrls(urls);
  const waits = urls.map((url) => preloadImage(url)?.promise).filter(Boolean);
  let completed = 0;
  waits.forEach((promise) => {
    promise.then(() => {
      completed += 1;
      onProgress?.(completed, waits.length);
    });
  });
  await Promise.race([
    Promise.all(waits),
    new Promise((resolve) => window.setTimeout(resolve, 850))
  ]);
}

function preloadAllPlaceImages() {
  const urls = data.places.flatMap(imageUrlsForPlace);
  const run = () => preloadUrls(urls);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    window.setTimeout(run, 250);
  }
}

function preloadCurrentContext() {
  const current = currentPlace() || selectedPlace(state.selectedPlaceId);
  const currentIndex = Math.max(0, data.places.findIndex((place) => place.id === current?.id));
  const nearby = data.places.slice(currentIndex, currentIndex + 3);
  preloadUrls(nearby.flatMap(imageUrlsForPlace));
}

function refreshBootstrapInBackground() {
  refreshBootstrapCache()
    .then((freshBootstrap) => {
      const nextData = normalizeBootstrap(freshBootstrap);
      if (!nextData?.places?.length) return;

      const currentFingerprint = JSON.stringify(data.places.map((place) => [place.id, place.images?.length || 0]));
      const nextFingerprint = JSON.stringify(nextData.places.map((place) => [place.id, place.images?.length || 0]));
      data = nextData;
      preconnectImageOrigins();
      preloadCurrentContext();
      preloadAllPlaceImages();
      if (currentFingerprint !== nextFingerprint) render();
    })
    .catch(() => {});
}

function commit(nextState, options = {}) {
  const previousState = state;
  const previousCard = cardForState(previousState);
  const nextCard = cardForState(nextState);
  const scrollSnapshots = captureScrollSnapshots(options.preserveScrollSelectors);

  if (previousCard?.id !== nextCard?.id || nextState.screen !== "discover") {
    closeCardExposure(previousCard?.id, "card_hidden");
  }
  if (nextState.alert && nextState.alert !== previousState.alert) {
    track("error_shown", {
      screen: nextState.screen,
      metadata: { message: nextState.alert }
    });
  }

  const transition = options.transition || transitionFor(previousState, nextState);
  const applyState = () => {
    root.dataset.transition = transition;
    state = nextState;
    saveState(state);
    render();
    restoreScrollSnapshots(scrollSnapshots);
    if (scrollSnapshots.length) {
      requestAnimationFrame(() => restoreScrollSnapshots(scrollSnapshots));
    }
  };

  if (!options.noTransition && typeof document.startViewTransition === "function") {
    document.startViewTransition(applyState);
  } else {
    root.classList.remove("fallback-transition");
    applyState();
    if (!options.noTransition) requestAnimationFrame(() => root.classList.add("fallback-transition"));
  }

  if (state.alert && !options.keepAlert) {
    window.clearTimeout(commit.alertTimer);
    commit.alertTimer = window.setTimeout(() => {
      state = { ...state, alert: null };
      saveState(state);
      render();
    }, 2200);
  }
}

function captureScrollSnapshots(selectors) {
  if (!Array.isArray(selectors) || !selectors.length) return [];
  return selectors
    .map((selector) => {
      const element = document.querySelector(selector);
      return element ? { selector, top: element.scrollTop, left: element.scrollLeft } : null;
    })
    .filter(Boolean);
}

function restoreScrollSnapshots(snapshots) {
  for (const snapshot of snapshots) {
    const element = document.querySelector(snapshot.selector);
    if (!element) continue;
    element.scrollTop = snapshot.top;
    element.scrollLeft = snapshot.left;
  }
}

function syncImageLoadingStates() {
  root.querySelectorAll("[data-loadable-image]").forEach((image) => {
    const host = image.closest("[data-image-host]") || image.parentElement;
    if (!host) return;

    const markLoaded = () => {
      host.classList.add("is-image-loaded");
      host.classList.remove("is-image-error");
      image.classList.add("is-loaded");
    };
    const markError = () => {
      host.classList.add("is-image-loaded", "is-image-error");
      image.classList.add("is-loaded");
    };

    if (image.complete && image.naturalWidth > 0) {
      markLoaded();
      return;
    }
    if (image.complete) {
      markError();
      return;
    }
    image.addEventListener("load", markLoaded, { once: true });
    image.addEventListener("error", markError, { once: true });
  });
}

function transitionFor(previousState, nextState) {
  if (previousState.screen === nextState.screen && previousState.tab === nextState.tab) return "state";
  if (nextState.screen === "placeDetail" || nextState.screen === "savedPlaceDetail") return "detail";
  if (previousState.screen === "placeDetail" || previousState.screen === "savedPlaceDetail") return "back";
  if (nextState.screen === "onboardingSource" || nextState.screen === "onboardingHabit" || nextState.screen === "region" || nextState.screen === "regionTransition" || nextState.screen === "tagSetup") return "forward";
  if (previousState.tab !== nextState.tab) return "tab";
  if (nextState.screen === "routeBlocked") return "modal";
  return "forward";
}

function selectedPlace(placeId) {
  return data.places.find((place) => place.id === placeId);
}

function currentPlace() {
  return currentDiscoverPlace(data.places, state);
}

function cardForState(targetState) {
  if (targetState.screen !== "discover") return null;
  return currentDiscoverPlace(data.places, targetState);
}

function closeCardExposure(placeId, reason) {
  if (!activeCardExposure) return;
  if (placeId && activeCardExposure.placeId !== placeId) return;
  const durationMs = Math.max(0, Date.now() - activeCardExposure.startedAt);
  track("session_heartbeat", {
    screen: "discover",
    placeId: activeCardExposure.placeId,
    durationMs,
    metadata: { kind: "discover_card_dwell", reason }
  });
  activeCardExposure = null;
}

function syncVisibleCardExposure() {
  const place = currentPlace();
  if (state.screen !== "discover" || !place || state.cardActionCount >= (data.config.cardActionLimit || CONFIG.cardActionLimit)) return;
  if (activeCardExposure?.placeId === place.id) return;
  closeCardExposure(null, "card_replaced");
  activeCardExposure = { placeId: place.id, startedAt: Date.now() };
  track("discover_card_view", {
    screen: "discover",
    placeId: place.id,
    categoryId: place.categoryId,
    neighborhoodId: place.neighborhoodId,
    metadata: {
      actionCount: state.cardActionCount,
      photoCount: place.images?.length || 0,
      selectedTags: state.selectedTags || []
    }
  });
}

function shouldShowDiscoverTutorial(targetState = state) {
  return targetState.screen === "discover"
    && !targetState.discoverTutorialSeen
    && (targetState.cardActionCount || 0) === 0
    && !!currentDiscoverPlace(data.places, targetState);
}

function syncDiscoverTutorialAutoDismiss() {
  window.clearTimeout(discoverTutorialTimer);
  discoverTutorialTimer = null;
  if (!shouldShowDiscoverTutorial()) return;
  discoverTutorialTimer = window.setTimeout(() => {
    if (!shouldShowDiscoverTutorial()) return;
    handlers.dismissDiscoverTutorial("auto");
  }, 5200);
}

function animateCardOut(direction, done) {
  if (isCardActionAnimating) return;
  isCardActionAnimating = true;
  const card = root.querySelector(".place-card:not(.is-detail)");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (!card || reducedMotion) {
    isCardActionAnimating = false;
    done();
    return;
  }
  card.classList.add(direction === "right" ? "swipe-out-right" : "swipe-out-left");
  window.setTimeout(() => {
    isCardActionAnimating = false;
    done();
  }, 230);
}

function moveToTagSetup() {
  commit({ ...state, screen: "regionTransition", tab: "discover", selectedNeighborhoodId: CONFIG.activeNeighborhoodId, alert: null }, { transition: "forward" });
  window.setTimeout(() => {
    commit({
      ...state,
      screen: state.tagSetupComplete ? "discover" : "tagSetup",
      tab: "discover",
      alert: null
    }, { transition: "forward" });
  }, 1250);
}

function sharePayloadForPlace(placeId) {
  const place = selectedPlace(placeId) || currentPlace();
  if (!place) return null;
  return {
    type: "place",
    placeId: place.id,
    title: place.name,
    description: place.shortCopy || `${CONFIG.activeNeighborhoodLabel}에서 발견한 장소`
  };
}

function cachedShareForPlace(placeId) {
  if (!placeId) return null;
  return state.shareLinksByPlaceId?.[placeId] || null;
}

async function ensureShareForPlace(placeId) {
  const payload = sharePayloadForPlace(placeId);
  if (!payload) return null;
  const cached = cachedShareForPlace(payload.placeId);
  if (cached?.url) return cached;
  if (pendingShareLinks.has(payload.placeId)) return pendingShareLinks.get(payload.placeId);

  const promise = createShareLink(payload)
    .then((response) => {
      const share = response.share;
      if (share?.url) {
        state = {
          ...state,
          shareLinksByPlaceId: {
            ...(state.shareLinksByPlaceId || {}),
            [payload.placeId]: share
          }
        };
        saveState(state);
      }
      return share;
    })
    .finally(() => {
      pendingShareLinks.delete(payload.placeId);
    });

  pendingShareLinks.set(payload.placeId, promise);
  return promise;
}

function prefetchShareForPlace(placeId) {
  ensureShareForPlace(placeId).catch(() => {});
}

async function openNativeShareOrCopy(share, nextState) {
  if (!share?.url) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: share.title, text: share.description, url: share.url });
    } catch (error) {
      if (error?.name !== "AbortError") throw error;
    }
    commit({ ...nextState, shareOpen: false }, { noTransition: true });
    return;
  }
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(share.url);
    commit({ ...nextState, alert: "클립보드에 저장됐어요", shareOpen: false });
  }
}

const handlers = {
  startWelcome() {
    track("welcome_start", { screen: "welcome" });
    commit({ ...state, screen: "onboardingSource", alert: null }, { transition: "forward" });
  },

  selectOnboardingOption(field, value) {
    if (!field || !value) return;
    track("onboarding_option_select", {
      screen: state.screen,
      metadata: { field, value }
    });
    commit({
      ...state,
      onboardingAnswers: {
        ...(state.onboardingAnswers || {}),
        [field]: value
      },
      alert: null
    }, { noTransition: true });
  },

  nextOnboarding() {
    if (state.screen === "onboardingSource") {
      track("onboarding_next", { screen: "onboardingSource", metadata: { answer: state.onboardingAnswers?.source || "" } });
      commit({ ...state, screen: "onboardingHabit", alert: null }, { transition: "forward" });
      return;
    }
    if (state.screen === "onboardingHabit") {
      track("onboarding_next", { screen: "onboardingHabit", metadata: { answer: state.onboardingAnswers?.habit || "" } });
      commit({ ...state, screen: "region", alert: null }, { transition: "forward" });
    }
  },

  backOnboarding() {
    if (state.screen === "onboardingHabit") {
      commit({ ...state, screen: "onboardingSource", alert: null }, { transition: "back" });
      return;
    }
    if (state.screen === "region") {
      commit({ ...state, screen: "onboardingHabit", alert: null }, { transition: "back" });
    }
  },

  selectNeighborhood(neighborhood) {
    const isActiveNeighborhood = neighborhood?.id === CONFIG.activeNeighborhoodId;
    if (!neighborhood?.enabled && !isActiveNeighborhood) {
      track("disabled_neighborhood_tap", {
        screen: state.screen,
        metadata: { neighborhoodId: neighborhood?.id || "unknown" }
      });
      commit({ ...state, alert: CONFIG.disabledNeighborhoodMessage }, { keepAlert: false });
      return;
    }
    track("neighborhood_select", { screen: state.screen, neighborhoodId: neighborhood.id });
    if (state.regionPickerOpen) {
      commit({ ...state, selectedNeighborhoodId: neighborhood.id, regionPickerOpen: false, alert: null }, { transition: "state" });
      return;
    }
    moveToTagSetup();
  },

  startYeonnam() {
    track("neighborhood_select", { screen: "region", neighborhoodId: CONFIG.activeNeighborhoodId });
    moveToTagSetup();
  },

  openRegion() {
    if (state.screen === "region") return;
    commit({ ...state, regionPickerOpen: true, alert: null }, { transition: "state" });
  },

  closeRegionPicker() {
    commit({ ...state, regionPickerOpen: false }, { transition: "state" });
  },

  setTab(tab) {
    const nextTab = tab || "discover";
    const eventName = nextTab === "saved" ? "saved_tab_open" : nextTab === "route" ? "route_tab_open" : nextTab === "my" ? "my_tab_open" : "app_open";
    track(eventName, { screen: nextTab });
    const discoverScreen = state.tagSetupComplete ? "discover" : "tagSetup";
    commit({
      ...state,
      tab: nextTab,
      screen: nextTab === "discover" ? discoverScreen : nextTab === "route" ? "routeCandidates" : nextTab,
      selectedPlaceId: null,
      shareOpen: false,
      savedFilterOpen: false,
      routeFilterOpen: false,
      routeSummaryOpen: false,
      regionPickerOpen: false,
      deleteConfirmOpen: false
    });
  },

  toggleTag(tag, kind = "type") {
    if (!tag) return;
    const selected = new Set(state.selectedTags || []);
    if (kind === "situation") {
      const situationTags = new Set(data.places.flatMap((place) => place.bestFor || []));
      ["혼자", "데이트", "친구와", "가볍게", "오래 머물기"].forEach((label) => situationTags.add(label));
      situationTags.forEach((label) => selected.delete(label));
      selected.add(tag);
    } else if (selected.has(tag)) selected.delete(tag);
    else selected.add(tag);
    commit({ ...state, selectedTags: Array.from(selected) }, { noTransition: true });
  },

  applyTags() {
    const categoryTags = new Set([
      ...data.categories.map((category) => category.name),
      ...data.places.map((place) => place.categoryName)
    ].filter((label) => label && label !== "미분류"));
    const situationTags = new Set(data.places.flatMap((place) => place.bestFor || []));
    ["혼자", "데이트", "친구와", "가볍게", "오래 머물기"].forEach((tag) => situationTags.add(tag));
    const selected = new Set(state.selectedTags || []);
    const hasType = Array.from(categoryTags).some((tag) => selected.has(tag));
    const hasSituation = Array.from(situationTags).some((tag) => selected.has(tag));
    if (!hasType || !hasSituation) {
      commit({ ...state, alert: "장소 유형과 상황을 하나씩 골라주세요." });
      return;
    }
    commit({ ...state, screen: "discover", tab: "discover", currentIndex: 0, currentPhotoIndex: 0, tagSetupComplete: true });
  },

  saveCurrentPlace(source = "button") {
    if (isCardActionAnimating) return;
    if (state.cardActionCount >= (data.config.cardActionLimit || CONFIG.cardActionLimit)) return;
    const place = currentPlace();
    if (!place) return;
    track("place_save", {
      screen: "discover",
      placeId: place.id,
      categoryId: place.categoryId,
      neighborhoodId: place.neighborhoodId,
      metadata: { actionCount: state.cardActionCount + 1, source }
    });
    const nextState = rememberSavedPlace(state, place.id);
    const savedCount = nextState.savedPlaceIds.length;
    const targetState = savedCount >= 5 ? { ...nextState, screen: "complete", selectedPlaceId: null } : nextState;
    animateCardOut("right", () => commit(targetState, { transition: "card" }));
  },

  savePlace(placeId) {
    const place = selectedPlace(placeId);
    if (!place) return;
    track("place_save", {
      screen: state.screen,
      placeId: place.id,
      categoryId: place.categoryId,
      neighborhoodId: place.neighborhoodId,
      metadata: { source: "shared_card" }
    });
    commit({
      ...state,
      tab: "saved",
      screen: "saved",
      selectedPlaceId: null,
      currentPhotoIndex: 0,
      savedPlaceIds: Array.from(new Set([...(state.savedPlaceIds || []), place.id])),
      skippedPlaceIds: (state.skippedPlaceIds || []).filter((id) => id !== place.id)
    }, { transition: "forward" });
  },

  skipPlace(placeId) {
    const place = selectedPlace(placeId);
    if (!place) return;
    track("place_skip", {
      screen: state.screen,
      placeId: place.id,
      categoryId: place.categoryId,
      neighborhoodId: place.neighborhoodId,
      metadata: { source: "shared_card" }
    });
    commit({
      ...state,
      tab: "discover",
      screen: state.tagSetupComplete ? "discover" : "tagSetup",
      selectedPlaceId: null,
      currentPhotoIndex: 0,
      skippedPlaceIds: Array.from(new Set([...(state.skippedPlaceIds || []), place.id]))
    }, { transition: "back" });
  },

  skipCurrentPlace(source = "button") {
    if (isCardActionAnimating) return;
    if (state.cardActionCount >= (data.config.cardActionLimit || CONFIG.cardActionLimit)) return;
    const place = currentPlace();
    if (!place) return;
    track("place_skip", {
      screen: "discover",
      placeId: place.id,
      categoryId: place.categoryId,
      neighborhoodId: place.neighborhoodId,
      metadata: { actionCount: state.cardActionCount + 1, source }
    });
    const nextState = rememberSkippedPlace(state, place.id);
    animateCardOut("left", () => commit(nextState, { transition: "card" }));
  },

  swipeCurrentPlace(direction) {
    if (direction === "right") handlers.saveCurrentPlace("drag");
    if (direction === "left") handlers.skipCurrentPlace("drag");
  },

  dismissDiscoverTutorial(reason = "tap") {
    if (state.discoverTutorialSeen) return;
    track("discover_tutorial_dismiss", {
      screen: "discover",
      metadata: { reason }
    });
    commit({ ...state, discoverTutorialSeen: true }, { noTransition: true });
  },

  nextPhoto() {
    const place = state.screen === "discover" ? currentPlace() : selectedPlace(state.selectedPlaceId) || currentPlace();
    if (!place) return;
    const next = Math.min((place.images?.length || 1) - 1, state.currentPhotoIndex + 1);
    if (next === state.currentPhotoIndex) return;
    track("discover_photo_next", { screen: state.screen, placeId: place.id });
    commit({ ...state, currentPhotoIndex: next, photoDirection: "next" }, { transition: "photo", noTransition: true });
    window.setTimeout(() => {
      if (state.currentPhotoIndex === next && state.photoDirection === "next") {
        commit({ ...state, photoDirection: "" }, { noTransition: true });
      }
    }, 180);
  },

  previousPhoto() {
    const place = state.screen === "discover" ? currentPlace() : selectedPlace(state.selectedPlaceId) || currentPlace();
    if (!place) return;
    const next = Math.max(0, state.currentPhotoIndex - 1);
    if (next === state.currentPhotoIndex) return;
    track("discover_photo_previous", { screen: state.screen, placeId: place.id });
    commit({ ...state, currentPhotoIndex: next, photoDirection: "previous" }, { transition: "photo", noTransition: true });
    window.setTimeout(() => {
      if (state.currentPhotoIndex === next && state.photoDirection === "previous") {
        commit({ ...state, photoDirection: "" }, { noTransition: true });
      }
    }, 180);
  },

  openPlaceDetail(placeId) {
    const targetId = placeId || currentPlace()?.id;
    if (!targetId) return;
    track("place_detail_open", { screen: state.screen, placeId: targetId });
    prefetchShareForPlace(targetId);
    commit({ ...state, screen: "placeDetail", selectedPlaceId: targetId, currentPhotoIndex: 0 });
  },

  backDiscover() {
    commit({ ...state, screen: "discover", selectedPlaceId: null, currentPhotoIndex: 0 });
  },

  openSavedDetail(placeId) {
    track("saved_place_open", { screen: "saved", placeId });
    prefetchShareForPlace(placeId);
    commit({ ...state, tab: "saved", screen: "savedPlaceDetail", selectedPlaceId: placeId, currentPhotoIndex: 0 });
  },

  openSavedDelete(placeId) {
    if (!placeId) return;
    track("saved_delete_mode_open", { screen: "saved", placeId });
    commit({ ...state, tab: "saved", screen: "savedDelete", deletePlaceIds: [placeId], selectedPlaceId: null, shareOpen: false, deleteConfirmOpen: false }, { transition: "modal" });
  },

  toggleDeletePlace(placeId) {
    if (!placeId) return;
    const selected = new Set(state.deletePlaceIds || []);
    if (selected.has(placeId)) selected.delete(placeId);
    else selected.add(placeId);
    track("saved_delete_place_toggle", { screen: "savedDelete", placeId, metadata: { selected: selected.has(placeId) } });
    commit({ ...state, deletePlaceIds: Array.from(selected) }, { noTransition: true });
  },

  selectAllDeletePlaces() {
    const saved = data.places.filter((place) => state.savedPlaceIds.includes(place.id));
    const allIds = saved.map((place) => place.id);
    const selectedAll = allIds.length && allIds.every((id) => state.deletePlaceIds.includes(id));
    commit({ ...state, deletePlaceIds: selectedAll ? [] : allIds }, { noTransition: true });
  },

  confirmDeleteSaved() {
    if (!(state.deletePlaceIds || []).length) return;
    commit({ ...state, deleteConfirmOpen: true }, { transition: "modal" });
  },

  cancelSavedDelete() {
    track("saved_delete_cancel", {
      screen: "savedDelete",
      metadata: { selectedCount: (state.deletePlaceIds || []).length }
    });
    commit({
      ...state,
      tab: "saved",
      screen: "saved",
      deletePlaceIds: [],
      deleteConfirmOpen: false
    }, { transition: "back" });
  },

  cancelDeleteConfirm() {
    commit({ ...state, deleteConfirmOpen: false }, { transition: "state" });
  },

  deleteSelectedSaved() {
    const selected = new Set(state.deletePlaceIds || []);
    if (!selected.size) {
      commit({ ...state, screen: "saved", deletePlaceIds: [] });
      return;
    }
    track("saved_places_delete", { screen: "savedDelete", metadata: { placeIds: Array.from(selected) } });
    commit({
      ...state,
      screen: "saved",
      savedPlaceIds: state.savedPlaceIds.filter((id) => !selected.has(id)),
      routePlaceIds: state.routePlaceIds.filter((id) => !selected.has(id)),
      deletePlaceIds: [],
      deleteConfirmOpen: false
    }, { transition: "back" });
  },

  openSavedFilter() {
    commit({ ...state, savedFilterOpen: true }, { transition: "state" });
  },

  closeSavedFilter() {
    commit({ ...state, savedFilterOpen: false }, { transition: "state" });
  },

  toggleSavedFilter(kind, tag) {
    if (!kind || !tag) return;
    const filters = { ...(state.savedFilters || {}) };
    const selected = new Set(filters[kind] || []);
    if (selected.has(tag)) selected.delete(tag);
    else selected.add(tag);
    filters[kind] = Array.from(selected);
    commit({ ...state, savedFilters: filters }, { noTransition: true });
  },

  resetSavedFilter() {
    commit({
      ...state,
      savedFilters: { type: [], mood: [], situation: [] },
      savedFilterOpen: false,
      savedFilterNoResults: false
    }, { transition: "state" });
  },

  applySavedFilter() {
    commit({ ...state, savedFilterOpen: false, screen: "saved", tab: "saved" }, { transition: "state" });
  },

  async sharePlace(placeId) {
    const payload = sharePayloadForPlace(placeId);
    if (!payload) return;
    track("share_button_tap", { screen: state.screen, placeId: payload.placeId });
    try {
      if (!cachedShareForPlace(payload.placeId)) {
        commit({ ...state, alert: "공유 링크를 준비하고 있어요.", shareOpen: false }, { keepAlert: true, noTransition: true });
      }
      const share = await ensureShareForPlace(payload.placeId);
      const nextState = { ...state, shareOpen: false, lastShare: share, alert: null };
      commit(nextState, { keepAlert: true, noTransition: true });
      await openNativeShareOrCopy(share, nextState);
    } catch (error) {
      commit({ ...state, alert: error.message || "공유 링크를 만들지 못했어요." });
    }
  },

  async copyLastShare() {
    if (!state.lastShare?.url || !navigator.clipboard) return;
    await navigator.clipboard.writeText(state.lastShare.url);
    commit({ ...state, alert: "클립보드에 저장됐어요", shareOpen: false });
  },

  async nativeShareLast() {
    if (!state.lastShare?.url) return;
    if (navigator.share) {
      await navigator.share({ title: state.lastShare.title, text: state.lastShare.description, url: state.lastShare.url });
      commit({ ...state, shareOpen: false });
    } else {
      await handlers.copyLastShare();
    }
  },

  closeShare() {
    commit({ ...state, shareOpen: false });
  },

  toggleRoutePlace(placeId) {
    if (!placeId) return;
    const selected = new Set(state.routePlaceIds || []);
    if (selected.has(placeId)) selected.delete(placeId);
    else if (selected.size < 4) selected.add(placeId);
    else {
      commit(
        { ...state, alert: "루트 후보는 최대 4곳까지 고를 수 있어요." },
        { preserveScrollSelectors: [".screen-route-candidates .route-section-scroll"] }
      );
      return;
    }
    track("route_place_select", { screen: "routeCandidates", placeId, metadata: { selected: !state.routePlaceIds.includes(placeId) } });
    commit(
      { ...state, routePlaceIds: Array.from(selected) },
      { noTransition: true, preserveScrollSelectors: [".screen-route-candidates .route-section-scroll"] }
    );
  },

  toggleRoutePrevious() {
    track("route_previous_toggle", { screen: "routeCandidates", metadata: { enabled: !state.routeIncludePrevious } });
    commit({ ...state, routeIncludePrevious: !state.routeIncludePrevious, routeSummaryOpen: false }, { transition: "state" });
  },

  setRouteCategory(category) {
    track("route_category_select", { screen: "routeCandidates", metadata: { category: category || "all" } });
    commit({ ...state, routeExpandedType: category || "", routeSummaryOpen: false }, { transition: "state" });
  },

  openRouteSummary() {
    track("route_summary_more_open", { screen: "routeCandidates" });
    commit({ ...state, routeSummaryOpen: true }, { transition: "state" });
  },

  closeRouteSummary() {
    commit({ ...state, routeSummaryOpen: false }, { transition: "state" });
  },

  openRouteFilter() {
    commit({ ...state, routeFilterOpen: true }, { transition: "state" });
  },

  closeRouteFilter() {
    commit({ ...state, routeFilterOpen: false }, { transition: "state" });
  },

  applyRouteFilter() {
    commit({ ...state, routeFilterOpen: false }, { transition: "state" });
  },

  openRouteCandidates() {
    const saved = data.places.filter((place) => state.savedPlaceIds.includes(place.id));
    track("route_candidate_open", { screen: "route", metadata: { savedCount: saved.length } });
    commit({ ...state, tab: "route", screen: "routeCandidates", routePlaceIds: state.routePlaceIds || [], routeSummaryOpen: false, alert: null }, { transition: "forward" });
  },

  createRoute() {
    const visibleRouteIds = new Set(
      data.places
        .filter((place) => state.savedPlaceIds.includes(place.id))
        .filter((place) => {
          const filters = state.savedFilters || {};
          const type = new Set(filters.type || []);
          const mood = new Set(filters.mood || []);
          const situation = new Set(filters.situation || []);
          const placeMood = new Set(place.moodTags || []);
          const placeSituation = new Set(place.bestFor || []);
          if (type.size && !type.has(place.categoryName)) return false;
          if (mood.size && !Array.from(mood).some((tag) => placeMood.has(tag))) return false;
          if (situation.size && !Array.from(situation).some((tag) => placeSituation.has(tag))) return false;
          return true;
        })
        .map((place) => place.id)
    );
    const selectedVisibleIds = (state.routePlaceIds || []).filter((id) => visibleRouteIds.has(id));
    if (selectedVisibleIds.length < 2) return;
    track("route_create_attempt", { screen: "routeCandidates", metadata: { placeIds: state.routePlaceIds } });
    track("route_create_blocked", { screen: "routeCandidates", metadata: { reason: "future_feature" } });
    commit({ ...state, screen: "routeBlocked", routeSummaryOpen: false });
  },

  openNotify() {
    track("route_notify_open", { screen: state.screen });
    window.open("https://doripe.kr/notify", "_blank", "noopener,noreferrer");
  },

  openMap(placeId) {
    const place = selectedPlace(placeId);
    if (!place?.naverPlaceUrl) {
      commit({ ...state, alert: "지도 링크가 아직 준비되지 않았어요." });
      return;
    }
    track("external_map_open", { screen: state.screen, placeId: place.id });
    window.open(place.naverPlaceUrl, "_blank", "noopener,noreferrer");
  },

  unsavePlace(placeId) {
    track("place_unsave", { screen: "saved", placeId });
    commit(rememberUnsavedPlace(state, placeId));
  },

  openMyScreen(screen) {
    commit({ ...state, tab: "my", screen, alert: null }, { transition: "forward" });
  },

  selectFeedbackType(value) {
    if (!value) return;
    commit({ ...state, feedbackType: value }, { noTransition: true });
  },

  setFeedbackText(value) {
    state = { ...state, feedbackText: value || "" };
    saveState(state);
  },

  submitFeedback() {
    const text = (state.feedbackText || "").trim();
    if (!text) {
      commit({ ...state, alert: "문의 내용을 입력해주세요." });
      return;
    }
    track("feedback_submit", {
      screen: state.screen,
      metadata: {
        type: state.feedbackType || "앱 오류",
        textLength: text.length
      }
    });
    commit({ ...state, screen: "my", feedbackText: "", alert: "의견을 받았어요." }, { transition: "back" });
  },

  openExternal(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

function render() {
  renderApp(root, {
    state,
    data,
    cardActionLimit: data.config.cardActionLimit || CONFIG.cardActionLimit
  }, handlers);
  syncImageLoadingStates();
  preloadCurrentContext();
  syncVisibleCardExposure();
  syncDiscoverTutorialAutoDismiss();
}

async function applySharedContext() {
  const params = new URLSearchParams(window.location.search);
  const shareId = params.get("shareId");
  const shareType = params.get("shareType");
  if (!shareId || !shareType) return;

  const response = await loadShareLink(shareId);
  const share = response.share;
  track("share_link_open", { screen: "share", shareId, metadata: { shareType } });
  if (share.content_type === "place" && share.place_id) {
    track("shared_place_open", { screen: "share", placeId: share.place_id, shareId });
    state = {
      ...state,
      tab: "discover",
      screen: "sharedPlace",
      selectedPlaceId: share.place_id,
      currentPhotoIndex: 0,
      sharedContext: { shareId, shareType }
    };
  } else if (share.content_type === "route" && Array.isArray(share.place_ids)) {
    track("shared_route_open", { screen: "share", shareId, metadata: { placeIds: share.place_ids } });
    state = {
      ...state,
      tab: "route",
      screen: "routeCandidates",
      routePlaceIds: share.place_ids,
      sharedContext: { shareId, shareType }
    };
  }
  saveState(state);
}

function applyLocalDebugScreen() {
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
  const params = new URLSearchParams(window.location.search);
  const devScreen = params.get("devScreen");
  if (!devScreen) return;
  const base = {
    ...state,
    screen: devScreen,
    tab: params.get("tab") || (devScreen === "saved" || devScreen === "savedDelete" || devScreen === "savedPlaceDetail" ? "saved" : devScreen === "route" || devScreen === "routeCandidates" || devScreen === "routeBlocked" ? "route" : "discover"),
    selectedNeighborhoodId: CONFIG.activeNeighborhoodId,
    selectedPlaceId: params.get("placeId") || data.places[0]?.id || null,
    currentIndex: Number(params.get("index") || 0),
    currentPhotoIndex: Number(params.get("photo") || 0),
    cardActionCount: Number(params.get("count") || state.cardActionCount || 0),
    selectedTags: devScreen === "tagSetup" ? ["카페"] : state.selectedTags,
    onboardingAnswers: state.onboardingAnswers || { source: "인스타그램", habit: "인스타 저장" },
    alert: null,
    shareOpen: false,
    regionPickerOpen: params.get("regionOpen") === "1"
  };
  if (devScreen === "saved" || devScreen === "savedDelete" || devScreen === "savedPlaceDetail" || devScreen === "route" || devScreen === "routeCandidates") {
    base.savedPlaceIds = data.places.slice(0, 4).map((place) => place.id);
  }
  if (devScreen === "savedDelete") {
    base.deletePlaceIds = data.places.slice(0, 2).map((place) => place.id);
  }
  if (devScreen === "routeCandidates") {
    base.routePlaceIds = data.places.slice(0, 2).map((place) => place.id);
    base.routeExpandedType = params.get("routeType") || "";
    base.routeIncludePrevious = params.get("includePrevious") === "1";
    base.routeSummaryOpen = params.get("summaryOpen") === "1";
  }
  state = base;
  saveState(state);
}

async function boot() {
  setBootProgress(6);
  const bootstrap = await loadBootstrap();
  const loadedFromCache = Boolean(bootstrap.__fromCache);
  data = normalizeBootstrap(bootstrap);
  preconnectImageOrigins();
  setBootProgress(42);
  await preloadCriticalImages((completed, total) => {
    const imageProgress = total ? completed / total : 1;
    setBootProgress(42 + Math.round(imageProgress * 38));
  });
  setBootProgress(82);
  preloadAllPlaceImages();
  await applySharedContext();
  setBootProgress(90);
  applyLocalDebugScreen();
  setBootProgress(96);
  track("app_open", { screen: state.screen });
  track("session_start", { screen: state.screen });
  setBootProgress(100);
  await sleep(120);
  render();
  if (loadedFromCache) refreshBootstrapInBackground();
  window.setInterval(() => {
    track("session_heartbeat", {
      screen: state.screen,
      durationMs: Date.now() - sessionStartedAt,
      metadata: { kind: "session" }
    });
  }, 30000);
}

window.addEventListener("beforeunload", () => {
  closeCardExposure(null, "page_unload");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") closeCardExposure(null, "page_hidden");
});

boot().catch((error) => {
  root.innerHTML = `
    <section class="screen">
      <div class="top-alert" role="alert">
        <span class="alert-icon">!</span>
        <span>
          <span class="alert-title">앱을 열지 못했어요</span>
          <span class="alert-copy">${String(error.message || "다시 시도해주세요.")}</span>
        </span>
      </div>
      <button class="primary-cta region-start" onclick="location.reload()">다시 시도</button>
    </section>
  `;
});
