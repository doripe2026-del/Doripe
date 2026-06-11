import { loadBootstrap, track, createShareLink, loadShareLink } from "./api.js";
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

function commit(nextState, options = {}) {
  state = nextState;
  saveState(state);
  render();
  if (state.alert && !options.keepAlert) {
    window.clearTimeout(commit.alertTimer);
    commit.alertTimer = window.setTimeout(() => {
      state = { ...state, alert: null };
      saveState(state);
      render();
    }, 2200);
  }
}

function selectedPlace(placeId) {
  return data.places.find((place) => place.id === placeId);
}

function currentPlace() {
  return currentDiscoverPlace(data.places, state);
}

function moveToTagSetup() {
  commit({ ...state, screen: "regionTransition", tab: "discover", selectedNeighborhoodId: CONFIG.activeNeighborhoodId, alert: null });
  window.setTimeout(() => {
    commit({ ...state, screen: "tagSetup", tab: "discover", alert: null });
  }, 850);
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

const handlers = {
  selectNeighborhood(neighborhood) {
    if (!neighborhood?.enabled) {
      track("disabled_neighborhood_tap", {
        screen: "region",
        metadata: { neighborhoodId: neighborhood?.id || "unknown" }
      });
      commit({ ...state, alert: CONFIG.disabledNeighborhoodMessage });
      return;
    }
    track("neighborhood_select", { screen: "region", neighborhoodId: neighborhood.id });
    moveToTagSetup();
  },

  startYeonnam() {
    track("neighborhood_select", { screen: "region", neighborhoodId: CONFIG.activeNeighborhoodId });
    moveToTagSetup();
  },

  openRegion() {
    commit({ ...state, screen: "region", alert: null });
  },

  setTab(tab) {
    const nextTab = tab || "discover";
    const eventName = nextTab === "saved" ? "saved_tab_open" : nextTab === "route" ? "route_tab_open" : "app_open";
    track(eventName, { screen: nextTab });
    commit({
      ...state,
      tab: nextTab,
      screen: nextTab === "discover" ? "discover" : nextTab,
      selectedPlaceId: null,
      shareOpen: false
    });
  },

  toggleTag(tag) {
    if (!tag) return;
    const selected = new Set(state.selectedTags || []);
    if (selected.has(tag)) selected.delete(tag);
    else selected.add(tag);
    commit({ ...state, selectedTags: Array.from(selected) });
  },

  applyTags() {
    commit({ ...state, screen: "discover", tab: "discover", currentIndex: 0, currentPhotoIndex: 0 });
  },

  saveCurrentPlace() {
    if (state.cardActionCount >= (data.config.cardActionLimit || CONFIG.cardActionLimit)) return;
    const place = currentPlace();
    if (!place) return;
    track("place_save", {
      screen: "discover",
      placeId: place.id,
      categoryId: place.categoryId,
      neighborhoodId: place.neighborhoodId,
      metadata: { actionCount: state.cardActionCount + 1 }
    });
    commit(rememberSavedPlace(state, place.id));
  },

  skipCurrentPlace() {
    if (state.cardActionCount >= (data.config.cardActionLimit || CONFIG.cardActionLimit)) return;
    const place = currentPlace();
    if (!place) return;
    track("place_skip", {
      screen: "discover",
      placeId: place.id,
      categoryId: place.categoryId,
      neighborhoodId: place.neighborhoodId,
      metadata: { actionCount: state.cardActionCount + 1 }
    });
    commit(rememberSkippedPlace(state, place.id));
  },

  nextPhoto() {
    const place = currentPlace() || selectedPlace(state.selectedPlaceId);
    if (!place) return;
    const next = Math.min((place.images?.length || 1) - 1, state.currentPhotoIndex + 1);
    if (next === state.currentPhotoIndex) return;
    track("discover_photo_next", { screen: state.screen, placeId: place.id });
    commit({ ...state, currentPhotoIndex: next });
  },

  previousPhoto() {
    const place = currentPlace() || selectedPlace(state.selectedPlaceId);
    if (!place) return;
    const next = Math.max(0, state.currentPhotoIndex - 1);
    if (next === state.currentPhotoIndex) return;
    track("discover_photo_previous", { screen: state.screen, placeId: place.id });
    commit({ ...state, currentPhotoIndex: next });
  },

  openPlaceDetail(placeId) {
    const targetId = placeId || currentPlace()?.id;
    if (!targetId) return;
    track("place_detail_open", { screen: state.screen, placeId: targetId });
    commit({ ...state, screen: "placeDetail", selectedPlaceId: targetId, currentPhotoIndex: 0 });
  },

  backDiscover() {
    commit({ ...state, screen: "discover", selectedPlaceId: null, currentPhotoIndex: 0 });
  },

  openSavedDetail(placeId) {
    track("saved_place_open", { screen: "saved", placeId });
    commit({ ...state, tab: "saved", screen: "savedPlaceDetail", selectedPlaceId: placeId, currentPhotoIndex: 0 });
  },

  async sharePlace(placeId) {
    const payload = sharePayloadForPlace(placeId);
    if (!payload) return;
    track("share_button_tap", { screen: state.screen, placeId: payload.placeId });
    try {
      const response = await createShareLink(payload);
      const share = response.share;
      const nextState = { ...state, shareOpen: true, lastShare: share, alert: null };
      commit(nextState, { keepAlert: true });
      if (navigator.share) {
        await navigator.share({ title: share.title, text: share.description, url: share.url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(share.url);
        commit({ ...nextState, alert: "공유 링크를 복사했어요." });
      }
    } catch (error) {
      commit({ ...state, alert: error.message || "공유 링크를 만들지 못했어요." });
    }
  },

  async copyLastShare() {
    if (!state.lastShare?.url || !navigator.clipboard) return;
    await navigator.clipboard.writeText(state.lastShare.url);
    commit({ ...state, alert: "공유 링크를 복사했어요.", shareOpen: false });
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
    else selected.add(placeId);
    track("route_place_select", { screen: "route", placeId, metadata: { selected: !state.routePlaceIds.includes(placeId) } });
    commit({ ...state, routePlaceIds: Array.from(selected) });
  },

  createRoute() {
    if ((state.routePlaceIds || []).length < 2) return;
    track("route_create_attempt", { screen: "route", metadata: { placeIds: state.routePlaceIds } });
    track("route_create_blocked", { screen: "route", metadata: { reason: "future_feature" } });
    commit({ ...state, screen: "routeBlocked" });
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
  }
};

function render() {
  renderApp(root, {
    state,
    data,
    cardActionLimit: data.config.cardActionLimit || CONFIG.cardActionLimit
  }, handlers);
}

async function applySharedContext() {
  const params = new URLSearchParams(window.location.search);
  const shareId = params.get("shareId");
  const shareType = params.get("shareType");
  if (!shareId || !shareType) return;

  const response = await loadShareLink(shareId);
  const share = response.share;
  if (share.content_type === "place" && share.place_id) {
    track("shared_place_open", { screen: "share", placeId: share.place_id, shareId });
    state = {
      ...state,
      tab: "discover",
      screen: "placeDetail",
      selectedPlaceId: share.place_id,
      sharedContext: { shareId, shareType }
    };
  } else if (share.content_type === "route" && Array.isArray(share.place_ids)) {
    track("shared_route_open", { screen: "share", shareId, metadata: { placeIds: share.place_ids } });
    state = {
      ...state,
      tab: "route",
      screen: "route",
      routePlaceIds: share.place_ids,
      sharedContext: { shareId, shareType }
    };
  }
  saveState(state);
}

async function boot() {
  data = await loadBootstrap();
  await applySharedContext();
  track("app_open", { screen: state.screen });
  track("session_start", { screen: state.screen });
  render();
}

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
