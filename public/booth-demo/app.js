import { PLACES } from "./places.js";
import {
  browseNearby,
  completeCourse,
  createInitialState,
  openPlace,
  startDiscovery,
  toggleAdditionalPlace
} from "./demo-state.js";

const root = document.querySelector("#demo-app");
const placeById = new Map(PLACES.map((place) => [place.id, place]));
const INACTIVITY_MS = 60_000;
const MAX_FEED_BATCHES = 5;

let state = createInitialState();
let inactivityTimer;
let feedObserver;
let feedBatchCount = 1;

function placeTile(place, { selectable = false, selected = false } = {}) {
  const pressed = selectable ? ` aria-pressed="${selected}"` : "";
  const selectedClass = selected ? " is-selected" : "";
  return `
    <button class="place-tile touch-target${selectedClass}" type="button"
      data-place-id="${place.id}" aria-label="${place.name} 선택"${pressed}>
      <img src="${place.image}" alt="${place.name}" loading="eager" decoding="async">
      ${selectable ? '<span class="place-tile__check" aria-hidden="true">✓</span>' : ""}
    </button>
  `;
}

function renderWelcome() {
  const featured = PLACES[0];
  return `
    <section class="screen welcome" data-screen="welcome">
      <img class="welcome__photo" src="${featured.image}" alt="" fetchpriority="high">
      <div class="welcome__content">
        <img class="brand-logo" src="/booth-demo/assets/doripe-logo.png" alt="Doripe">
        <h1>오늘의 장소,<br>사진으로 골라봐요</h1>
        <p>마음에 드는 사진 한 장에서 나만의 동네 코스를 시작해보세요.</p>
        <button class="primary-action touch-target" type="button" data-action="start">60초 코스 만들기</button>
      </div>
    </section>
  `;
}

function renderFeed() {
  return `
    <section class="screen feed" data-screen="feed">
      <header class="feed-header">
        <div class="feed-header__row">
          <img class="brand-logo brand-logo--compact" src="/booth-demo/assets/doripe-logo.png" alt="Doripe">
          <p class="feed-header__hint">끌리는 사진을 눌러보세요</p>
        </div>
      </header>
      <div class="masonry-feed" data-feed-list>
        ${PLACES.map((place) => placeTile(place)).join("")}
        <div class="feed-sentinel" data-feed-sentinel aria-hidden="true"></div>
      </div>
    </section>
  `;
}

function renderDetail() {
  const place = placeById.get(state.startPlaceId);
  if (!place) return renderFeed();
  return `
    <section class="screen detail" data-screen="detail">
      <div class="detail__photo-wrap">
        <img class="detail__photo" src="${place.image}" alt="${place.name}" fetchpriority="high">
        <button class="detail__back touch-target" type="button" data-action="back-to-feed" aria-label="사진 피드로 돌아가기">←</button>
      </div>
      <div class="detail__panel">
        <p class="screen__eyebrow">첫 번째 장소</p>
        <h1>${place.name}</h1>
        <p>${place.copy}</p>
        <button class="primary-action touch-target" type="button" data-action="browse-nearby">이 장소 주변 둘러보기</button>
      </div>
    </section>
  `;
}

function renderBuilder() {
  const startPlace = placeById.get(state.startPlaceId);
  const candidates = PLACES.filter((place) => place.id !== state.startPlaceId);
  const selectedCount = state.selectedPlaceIds.length;
  return `
    <section class="screen builder" data-screen="builder">
      <header class="builder-header">
        <div class="builder-header__row">
          <div>
            <p class="screen__eyebrow">코스 만들기</p>
            <h1>다음 장소를 골라보세요</h1>
          </div>
          <button class="icon-action touch-target" type="button" data-action="back-to-detail" aria-label="장소 상세로 돌아가기">←</button>
        </div>
      </header>
      <article class="route-seed is-lifting" aria-label="코스의 시작 장소">
        <img src="${startPlace.image}" alt="">
        <div class="route-seed__copy">
          <span>여기서 시작해요</span>
          <strong>${startPlace.name}</strong>
        </div>
      </article>
      <div class="masonry-feed" aria-label="주변 장소 후보">
        ${candidates.map((place) => placeTile(place, {
          selectable: true,
          selected: state.selectedPlaceIds.includes(place.id)
        })).join("")}
      </div>
      ${selectedCount > 0 ? `
        <button class="primary-action floating-action touch-target" type="button" data-action="complete">
          ${selectedCount}곳으로 코스 완성하기
        </button>
      ` : ""}
    </section>
  `;
}

function renderComplete() {
  const route = [state.startPlaceId, ...state.selectedPlaceIds]
    .map((id) => placeById.get(id))
    .filter(Boolean);
  return `
    <section class="screen completion" data-screen="complete">
      <div>
        <header class="completion__header">
          <div class="completion__mark" aria-hidden="true">✓</div>
          <p class="screen__eyebrow">60초 만에 완성</p>
          <h1>우리의 코스 완성!</h1>
          <p class="screen__copy">고른 순서대로 천천히 둘러보세요.</p>
        </header>
        <ol class="completion__route">
          ${route.map((place, index) => `
            <li class="completion-place" style="--route-index: ${index}">
              <span class="completion-place__order">${index + 1}</span>
              <img src="${place.image}" alt="">
              <strong>${place.name}</strong>
            </li>
          `).join("")}
        </ol>
      </div>
      <button class="primary-action touch-target" type="button" data-action="reset">처음부터 다시</button>
    </section>
  `;
}

function appendFeedBatch() {
  const list = root.querySelector("[data-feed-list]");
  const sentinel = root.querySelector("[data-feed-sentinel]");
  if (!list || !sentinel || feedBatchCount >= MAX_FEED_BATCHES) {
    feedObserver?.disconnect();
    return;
  }

  const nextPlaces = [...PLACES];
  for (let index = nextPlaces.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextPlaces[index], nextPlaces[swapIndex]] = [nextPlaces[swapIndex], nextPlaces[index]];
  }
  sentinel.insertAdjacentHTML("beforebegin", nextPlaces.map((place) => placeTile(place)).join(""));
  feedBatchCount += 1;
}

function observeFeedContinuation() {
  feedObserver?.disconnect();
  const sentinel = root.querySelector("[data-feed-sentinel]");
  if (!sentinel || !("IntersectionObserver" in window)) return;
  feedObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) appendFeedBatch();
  }, { rootMargin: "0px 0px 240px" });
  feedObserver.observe(sentinel);
}

function render() {
  feedObserver?.disconnect();
  root.innerHTML = `<div class="demo-shell">${
    state.screen === "welcome" ? renderWelcome()
      : state.screen === "feed" ? renderFeed()
        : state.screen === "detail" ? renderDetail()
          : state.screen === "builder" ? renderBuilder()
            : renderComplete()
  }</div>`;

  if (state.screen === "feed") observeFeedContinuation();
}

function armInactivityReset() {
  window.clearTimeout(inactivityTimer);
  inactivityTimer = window.setTimeout(() => {
    state = createInitialState();
    feedBatchCount = 1;
    render();
    armInactivityReset();
  }, INACTIVITY_MS);
}

function update(nextState) {
  state = nextState;
  if (state.screen !== "feed") feedBatchCount = 1;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  armInactivityReset();
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action], [data-place-id]");
  if (!target) return;

  if (target.dataset.action === "start") update(startDiscovery(state));
  else if (target.dataset.action === "back-to-feed") update(startDiscovery(state));
  else if (target.dataset.action === "back-to-detail") update({ ...state, screen: "detail", selectedPlaceIds: [] });
  else if (target.dataset.action === "browse-nearby") update(browseNearby(state));
  else if (target.dataset.action === "complete") update(completeCourse(state));
  else if (target.dataset.action === "reset") update(createInitialState());
  else if (target.dataset.placeId && state.screen === "feed") update(openPlace(state, target.dataset.placeId));
  else if (target.dataset.placeId && state.screen === "builder") update(toggleAdditionalPlace(state, target.dataset.placeId));
});

root.addEventListener("error", (event) => {
  if (!(event.target instanceof HTMLImageElement)) return;
  event.target.removeAttribute("src");
  event.target.alt = "이미지를 불러오지 못했어요";
  event.target.classList.add("image-fallback");
}, true);

for (const eventName of ["pointerdown", "touchstart", "keydown", "scroll"]) {
  window.addEventListener(eventName, armInactivityReset, { passive: true });
}

render();
armInactivityReset();
