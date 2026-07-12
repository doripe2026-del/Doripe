import { MEDIA, PLACES, ROUTES, TAGS, USERS } from "../fixtures.js";

const SCREEN_NAVIGATE_EVENT = "app-preview:screen-navigate";
const OVERLAY_DISMISS_EVENT = "app-preview:overlay-dismiss";
const SELECTION_CLEAR_EVENT = "app-preview:selection-clear";
const MEDIA_HIDE_EVENT = "app-preview:media-hide";
const NODE_IDS = Object.freeze({
  d1: "446:2641", d2: "446:1929", d3: "446:2608", d4: "446:2574",
  d5: "446:1956", d6: "446:2048", d7: "446:2166", d8: "446:2218", d9: "446:2256"
});
const DEFAULT_ROUTE_PLACE_IDS = Object.freeze([...ROUTES[0].placeIds]);

const byId = (items, id) => items.find((item) => item.id === id);
const mediaFor = (place, offset = 0) => byId(MEDIA, place?.mediaIds?.[offset]) || MEDIA[0];
const tagsFor = (item) => (item?.tagIds || []).map((id) => byId(TAGS, id)).filter(Boolean);
const userFor = (item) => byId(USERS, item?.userId) || USERS[0];

function element(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function routeIcon(name, className = "") {
  const image = element("img", className);
  image.src = `/app-preview/assets/routes/${name}.svg`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  image.draggable = false;
  return image;
}

function photo(place, className = "", offset = 0) {
  const image = element("img", className);
  const media = mediaFor(place, offset);
  image.src = media.src;
  image.alt = media.alt;
  image.loading = "eager";
  return image;
}

function root(screenId, extra = "") {
  const screen = element("section", `route-screen route-screen--${screenId} ${extra}`.trim());
  screen.dataset.screenId = screenId;
  screen.dataset.figmaNode = NODE_IDS[screenId];
  screen.dataset.renderMode = "semantic";
  return screen;
}

function actionButton(label, action, className, iconName, values = {}) {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.dataset.action = action;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) button.dataset[key] = String(value);
  }
  if (values.value !== undefined) button.value = String(values.value);
  if (iconName) button.append(routeIcon(iconName));
  return button;
}

function navigateButton(label, screenId, className, iconName) {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  if (iconName) button.append(routeIcon(iconName));
  button.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent(SCREEN_NAVIGATE_EVENT, { detail: { screenId } }));
  });
  return button;
}

function actionRegion(label, action, className, values = {}) {
  const node = element("article", className);
  node.setAttribute("role", "button");
  node.tabIndex = 0;
  node.setAttribute("aria-label", label);
  node.dataset.action = action;
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) node.dataset[key] = String(value);
  }
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      node.click();
    }
  });
  return node;
}

function selectedPlaces(state, { fallback = false } = {}) {
  const requested = state?.routePlaceIds?.length
    ? state.routePlaceIds
    : fallback ? DEFAULT_ROUTE_PLACE_IDS : [];
  const uniqueIds = [...new Set(requested)];
  return uniqueIds.map((id) => byId(PLACES, id)).filter(Boolean);
}

function renderBottomNav(active = "routes", { contracted = true } = {}) {
  const nav = element("nav", "route-confirm-nav");
  nav.setAttribute("aria-label", "주요 메뉴");
  const specs = [
    ["발견", "open-discover", "b2", "nav-discover", "discover"],
    ["저장", "open-saved", "c1", "nav-saved", "saved"],
    ["코스", "open-routes", "d1", "nav-course-active", "routes"],
    ["설정", "open-settings", "e1", "nav-settings", "settings"]
  ];
  specs.forEach(([label, action, target, iconName, id], index) => {
    const className = `route-confirm-nav__item ${id === active ? "is-active" : ""}`;
    const item = contracted
      ? actionButton(label, action, className, iconName)
      : navigateButton(label, target, className, iconName);
    item.setAttribute("aria-current", id === active ? "page" : "false");
    item.style.setProperty("--route-nav-index", index);
    nav.append(item);
  });
  return nav;
}

function installSheetDrag(screen, handle, { up, down }) {
  let pointerId = null;
  let startY = 0;
  let delta = 0;
  handle.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startY = event.clientY;
    delta = 0;
    handle.setPointerCapture?.(pointerId);
    screen.classList.add("is-dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    delta = event.clientY - startY;
    screen.style.setProperty("--route-sheet-drag", `${Math.max(-130, Math.min(160, delta))}px`);
  });
  const finish = (event) => {
    if (pointerId !== event.pointerId) return;
    handle.releasePointerCapture?.(pointerId);
    screen.classList.remove("is-dragging");
    screen.style.removeProperty("--route-sheet-drag");
    const target = delta < -48 ? up : delta > 48 ? down : null;
    pointerId = null;
    if (target) document.dispatchEvent(new CustomEvent(SCREEN_NAVIGATE_EVENT, { detail: { screenId: target } }));
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("keydown", (event) => {
    const target = event.key === "ArrowDown" ? down : ["ArrowUp", "Enter", " "].includes(event.key) ? up : null;
    if (!target) return;
    event.preventDefault();
    document.dispatchEvent(new CustomEvent(SCREEN_NAVIGATE_EVENT, { detail: { screenId: target } }));
  });
}

function dismissOverlay(overlayId) {
  document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId } }));
}

function renderPhotoMenu(state) {
  const backdrop = element("div", "route-photo-menu-backdrop");
  const menu = element("section", "route-photo-menu");
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-modal", "true");
  const hide = element("button", "route-photo-menu__item", "이 사진 숨기기");
  hide.type = "button";
  hide.addEventListener("click", () => document.dispatchEvent(new CustomEvent(MEDIA_HIDE_EVENT, {
    detail: { mediaId: state?.selections?.selectedMediaId }
  })));
  menu.append(element("h2", "", "사진 메뉴"), hide);
  const cancel = element("button", "route-photo-menu__cancel", "취소");
  cancel.type = "button";
  cancel.addEventListener("click", () => dismissOverlay("photo-menu"));
  menu.append(cancel);
  backdrop.append(menu);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) dismissOverlay("photo-menu"); });
  return backdrop;
}

function renderMapControls(screen, { back = false } = {}) {
  if (back) screen.append(actionButton("뒤로 가기", "go-back", "route-map-control route-map-control--back", "chevron-left"));
  const locate = actionButton("내 위치 찾기", "locate-user", "route-map-control route-map-control--locate", "locate");
  screen.append(locate, routeIcon("region-pin", "route-map-pin"));
}

function renderStartGallery(state) {
  const screen = root("d1", "route-start-screen");
  screen.append(routeIcon("region-pin", "route-start-pin"));
  const sheet = element("section", "route-start-sheet route-start-sheet--peek");
  const handle = element("button", "route-start-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "장소 선택 창 크기 조절");
  sheet.append(handle);
  const grid = element("div", "route-start-grid");
  const hiddenMediaIds = new Set(state?.hiddenMediaIds || []);
  PLACES.slice(0, 10).filter((place) => !hiddenMediaIds.has(place.mediaIds[0])).forEach((place, index) => {
    const card = actionRegion(`${place.name}에서 시작`, "select-start-place", "route-start-media", { placeId: place.id, mediaId: place.mediaIds[0] });
    card.append(photo(place, "", index % 3));
    const menu = actionButton(`${place.name} 사진 메뉴`, "open-photo-menu", "route-start-media__menu", "", { mediaId: place.mediaIds[0] });
    menu.textContent = "•••";
    card.append(menu);
    grid.append(card);
  });
  sheet.append(grid);
  screen.append(sheet, renderBottomNav("routes", { contracted: false }));
  if (state?.overlays?.includes("photo-menu")) screen.append(renderPhotoMenu(state));
  installSheetDrag(screen, handle, { up: "d3", down: "d2" });
  return screen;
}

function renderMapStart() {
  const screen = root("d2", "route-map-screen");
  renderMapControls(screen, { back: true });
  const start = actionButton("여기서 시작하기", "confirm-start-location", "route-map-start-button", "create-course");
  start.append(element("span", "", "여기서 시작하기"));
  const sheet = element("section", "route-start-sheet route-start-sheet--collapsed");
  const handle = element("button", "route-start-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "저장 목록 열기");
  sheet.append(handle);
  screen.append(start, sheet);
  installSheetDrag(screen, handle, { up: "d3", down: null });
  return screen;
}

function renderSavedStart(state) {
  const screen = root("d3", "route-start-screen route-start-screen--expanded");
  screen.append(routeIcon("region-pin", "route-start-pin"));
  const sheet = element("section", "route-start-sheet route-start-sheet--expanded");
  const handle = element("button", "route-start-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "지도에서 위치 선택");
  sheet.append(handle, element("h1", "", "저장한 사진과 영상"), element("p", "route-start-lead", "이 장소에서 저장한 분위기를 한눈에 모아봤어요"));
  const grid = element("div", "route-start-grid route-start-grid--expanded");
  PLACES.slice(0, 10).forEach((place, index) => {
    const card = actionButton(`${place.name}에서 시작`, "select-start-place", "route-start-media", "", { placeId: place.id, mediaId: place.mediaIds[0] });
    card.append(photo(place, "", index % 3));
    grid.append(card);
  });
  sheet.append(grid);
  screen.append(sheet);
  installSheetDrag(screen, handle, { up: null, down: "d2" });
  return screen;
}

function renderStartConfirmed(state) {
  const place = byId(PLACES, state?.selections?.selectedPlaceId) || PLACES[0];
  const screen = root("d4", "route-map-screen");
  renderMapControls(screen, { back: true });
  const card = element("article", "route-selected-place");
  card.append(photo(place, "route-selected-place__photo"));
  const copy = element("div", "route-selected-place__copy");
  copy.append(element("h1", "", place.name), element("span", "", tagsFor(place)[0]?.name || "장소"), element("p", "", place.address));
  const close = actionButton("선택 장소 닫기", "close-place-card", "route-selected-place__close", "close");
  card.append(copy, close);
  const start = actionButton("여기서 시작하기", "confirm-start-place", "route-map-start-button route-map-start-button--wide", "create-course");
  start.append(element("span", "", "여기서 시작하기"));
  start.disabled = state?.selections?.startPlaceCardOpen === false;
  if (state?.selections?.startPlaceCardOpen !== false) screen.append(card);
  screen.append(start);
  if (state?.toast?.message) screen.append(element("output", `route-toast route-toast--${state.toast.kind}`, state.toast.message));
  return screen;
}

const FILTERS = Object.freeze([
  ["연남 · 망원", "tag-yeonnam"], ["데이트", "tag-date"], ["오후", "tag-afternoon"], ["조용함", "tag-quiet"]
]);

function renderRouteFilters(state) {
  const row = element("div", "route-filter-row");
  FILTERS.forEach(([label, value]) => {
    const chip = actionButton(`${label} 필터`, "select-filter-tag", `route-filter-chip ${state?.selections?.routeFilter === value ? "is-active" : ""}`, "", { value });
    chip.textContent = label;
    chip.setAttribute("aria-pressed", String(state?.selections?.routeFilter === value));
    row.append(chip);
  });
  const change = actionButton("조건 변경", "change-filter", "route-filter-change", "", { value: "filters" });
  change.textContent = "☷  조건 변경";
  row.append(change);
  return row;
}

function routeSourceTabs(active) {
  const tabs = element("div", "route-source-tabs");
  tabs.setAttribute("role", "tablist");
  const saved = actionButton("저장된 장소", "show-saved-places", `route-source-tab ${active === "saved" ? "is-active" : ""}`, "nav-saved", { value: "saved" });
  const discover = actionButton("발견하기", "show-discover", `route-source-tab ${active === "discover" ? "is-active" : ""}`, "nav-discover", { value: "discover" });
  saved.setAttribute("role", "tab"); discover.setAttribute("role", "tab");
  saved.setAttribute("aria-selected", String(active === "saved")); discover.setAttribute("aria-selected", String(active === "discover"));
  saved.append(element("span", "", "저장된 장소")); discover.append(element("span", "", "발견하기"));
  tabs.append(saved, discover);
  return tabs;
}

function renderCandidateFilterSheet(state) {
  const backdrop = element("div", "route-filter-sheet-backdrop");
  const sheet = element("section", "route-filter-sheet");
  sheet.append(element("span", "route-filter-sheet__handle"), element("h2", "", "다음 장소 조건"), element("p", "", "상황과 분위기에 맞게 후보를 다시 정리해요"));
  const groups = [
    ["상황", [["데이트", "tag-date"], ["친구랑", "tag-friends"], ["혼자", "tag-alone"]]],
    ["시간", [["낮", "tag-daytime"], ["오후", "tag-afternoon"], ["저녁", "tag-evening"]]],
    ["분위기", [["조용함", "tag-quiet"], ["감성적인", "tag-emotional"], ["밝은", "tag-bright"]]]
  ];
  groups.forEach(([title, options]) => {
    const group = element("fieldset", "route-filter-sheet__group");
    group.append(element("legend", "", title));
    options.forEach(([label, value]) => {
      const option = actionButton(label, "select-filter-tag", state?.selections?.routeFilter === value ? "is-selected" : "", "", { value });
      option.textContent = label;
      option.setAttribute("aria-pressed", String(state?.selections?.routeFilter === value));
      group.append(option);
    });
    sheet.append(group);
  });
  backdrop.append(sheet);
  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    document.dispatchEvent(new CustomEvent(SELECTION_CLEAR_EVENT, { detail: { keys: ["routeFilter"] } }));
  });
  return backdrop;
}

function candidateToggle(place, state, className = "route-candidate-add") {
  const selected = state?.routePlaceIds?.includes(place.id) || false;
  const button = actionButton(`${place.name} ${selected ? "제외" : "추가"}`, "add-place", `${className} ${selected ? "is-selected" : ""}`, "", { placeId: place.id });
  button.setAttribute("aria-pressed", String(selected));
  button.textContent = selected ? "✓" : "+";
  return button;
}

function candidateFooter(state) {
  const count = selectedPlaces(state).length;
  const footer = element("footer", "route-candidate-footer");
  footer.append(element("strong", "", `${count}곳 선택됨`));
  const confirm = actionButton("선택한 장소로 코스 만들기", "confirm-route-places", "route-candidate-confirm", "create-course");
  confirm.append(element("span", "", "코스에 추가"));
  confirm.disabled = count < 2;
  confirm.setAttribute("aria-disabled", String(count < 2));
  footer.append(confirm);
  return footer;
}

function filteredCandidates(candidates, state) {
  const filter = state?.selections?.routeFilter;
  if (!filter || filter === "filters" || filter === "tag-yeonnam") return candidates;
  return [...candidates].sort((left, right) => Number(right.tagIds.includes(filter)) - Number(left.tagIds.includes(filter)));
}

function renderSavedCandidates(state) {
  const screen = root("d5", "route-candidate-screen");
  screen.append(actionButton("뒤로 가기", "go-back", "route-candidate-back", "chevron-left"));
  const hero = element("header", "route-candidate-hero");
  hero.append(element("h1", "", "오브젝트 연남에서 가까운 곳"));
  hero.append(element("span", "", "소품/체험"), element("span", "", "연남"));
  screen.append(hero, routeSourceTabs("saved"), renderRouteFilters(state));
  const heading = element("div", "route-candidate-heading");
  heading.append(element("h2", "", "저장한 장소 중 가까운 후보"), element("p", "", "거리와 분위기가 맞는 순서로 정리했어요"), element("span", "", "적합도순⌄"));
  screen.append(heading);
  const list = element("div", "route-saved-list");
  filteredCandidates([PLACES[9], PLACES[10], PLACES[7], PLACES[5], PLACES[1]], state).forEach((place, index) => {
    const card = element("article", "route-saved-candidate");
    card.append(photo(place, "route-saved-candidate__photo", index % 3));
    const copy = element("div", "route-saved-candidate__copy");
    copy.append(element("h3", "", place.name), element("p", "", `${tagsFor(place)[0]?.name || "장소"} · 도보 ${place.walkingMinutes}분`));
    const chips = element("div", "route-candidate-tags");
    tagsFor(place).slice(1, 3).forEach((tag) => chips.append(element("span", "", tag.name)));
    copy.append(chips);
    card.append(copy, element("strong", "route-fit-score", `적합도 ${92 - index * 4}`), candidateToggle(place, state));
    list.append(card);
  });
  screen.append(list, candidateFooter(state));
  if (state?.selections?.routeFilter === "filters") screen.append(renderCandidateFilterSheet(state));
  return screen;
}

function renderDiscoverCandidates(state) {
  const screen = root("d6", "route-candidate-screen");
  screen.append(actionButton("뒤로 가기", "go-back", "route-candidate-back", "chevron-left"));
  const hero = element("header", "route-candidate-hero");
  hero.append(element("h1", "", "오브젝트 연남에서 가까운 곳"));
  hero.append(element("span", "", "소품/체험"), element("span", "", "연남"));
  screen.append(hero, routeSourceTabs("discover"), renderRouteFilters(state));
  const grid = element("div", "route-discover-grid");
  filteredCandidates([PLACES[1], PLACES[3], PLACES[4], PLACES[5], PLACES[8], PLACES[11]], state).forEach((place, index) => {
    const card = element("article", "route-discover-candidate");
    const media = mediaFor(place, index % 3);
    card.append(photo(place, "route-discover-candidate__photo", index % 3));
    if (media.kind === "video") card.append(element("span", "route-video-indicator", "▶"));
    card.append(candidateToggle(place, state));
    const author = userFor(place);
    const meta = element("div", "route-discover-candidate__meta");
    meta.append(element("small", "", author.handle), element("strong", "", `적합도 ${94 - index * 2}`), element("h3", "", place.name), element("p", "", place.summary));
    const tags = element("div", "route-candidate-tags");
    tagsFor(place).slice(0, 2).forEach((tag) => tags.append(element("span", "", tag.name)));
    meta.append(tags);
    card.append(meta);
    grid.append(card);
  });
  screen.append(grid, candidateFooter(state));
  if (state?.selections?.routeFilter === "filters") screen.append(renderCandidateFilterSheet(state));
  return screen;
}

export function renderRouteConfirmation(state) {
  const places = selectedPlaces(state, { fallback: true });
  const count = places.length;
  const screen = root("d7");
  screen.append(element("div", "route-confirm-haze"));
  const back = actionButton("뒤로 가기", "go-back", "route-confirm-back", "chevron-left");
  const countPill = element("div", "route-confirm-count");
  countPill.append(routeIcon("check-selected"), element("strong", "", `선택한 장소 ${count}개`));
  const region = element("div", "route-confirm-region");
  region.append(routeIcon("region-pin"), element("strong", "", "연남"));
  screen.append(back, countPill, region);
  const summary = element("article", "route-confirm-summary");
  const summaryIcon = element("span", "route-confirm-summary__icon");
  summaryIcon.append(routeIcon("course-summary"));
  const copy = element("div", "route-confirm-summary__copy");
  copy.append(element("h1", "", `코스 후보 ${count}개 추가됨`), element("p", "", places.map((place) => place.name).join(" · ")));
  const change = actionButton("장소 바꾸기", "change-places", "route-confirm-action route-confirm-action--change", "change-place");
  change.append(element("span", "", "장소 바꾸기"));
  const create = actionButton("코스 만들기", "create-route", "route-confirm-action route-confirm-action--create", "create-course");
  create.append(element("span", "", "코스 만들기"));
  summary.append(summaryIcon, copy, change, create);
  screen.append(summary, renderBottomNav());
  return screen;
}

function renderRouteName(state) {
  const screen = root("d8");
  screen.append(actionButton("뒤로 가기", "go-back", "route-confirm-back", "chevron-left"));
  const region = element("div", "route-confirm-region route-confirm-region--name");
  region.append(routeIcon("region-pin"), element("strong", "", "연남"));
  screen.append(region);
  const sheet = element("section", "route-name-sheet");
  sheet.append(element("span", "route-name-handle"), element("h1", "", "코스 이름을 정해주세요"), element("p", "", "나중에 저장함에서 바로 찾을 수 있어요"));
  const field = element("div", "route-name-field");
  const input = element("input", "route-name-input");
  input.type = "text";
  input.value = state?.form?.routeName ?? "연남 저녁 데이트 코스";
  input.dataset.action = "update-route-name";
  input.dataset.persistDefault = "true";
  input.setAttribute("aria-label", "코스 이름");
  input.maxLength = 30;
  const clear = actionButton("코스 이름 지우기", "clear-route-name", "route-name-clear", "close");
  field.append(input, clear);
  const save = actionButton("코스 저장하기", "save-route", "route-name-save", "nav-saved");
  save.append(element("span", "", "코스 저장하기"));
  sheet.append(field, save);
  screen.append(sheet, renderBottomNav());
  return screen;
}

function renderNavigationOverlay() {
  const backdrop = element("div", "route-navigation-overlay");
  const dialog = element("section", "route-navigation-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.append(element("h2", "", "길찾기를 시작할까요?"), element("p", "", "선택한 순서대로 지도 앱에서 길찾기를 이어갈 수 있어요."));
  const link = element("a", "route-navigation-link", "지도 앱으로 이동");
  link.href = "https://map.naver.com/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const close = element("button", "route-navigation-close", "취소");
  close.type = "button";
  close.addEventListener("click", () => document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "external-map" } })));
  dialog.append(link, close);
  backdrop.append(dialog);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "external-map" } }));
  });
  return backdrop;
}

function renderRouteComplete(state) {
  const places = selectedPlaces(state, { fallback: true });
  const route = ROUTES[0];
  const routeName = state?.form?.routeName?.trim() || route.name.replace("루트", "코스");
  const screen = root("d9", "route-complete-screen");
  const top = element("header", "route-complete-top");
  top.append(actionButton("뒤로 가기", "go-back", "route-complete-back", "chevron-left"), element("strong", "", "코스 완성"), actionButton("코스 공유", "open-share", "route-complete-share", "share", { type: "route", id: route.id }));
  screen.append(top, element("h1", "route-complete-title", routeName), element("p", "route-complete-meta", `${places.length}곳 · 약 1시간 40분 · 도보 중심`));
  const tags = element("div", "route-complete-tags");
  tagsFor(route).forEach((tag) => tags.append(element("span", "", tag.name)));
  screen.append(tags, element("div", "route-complete-map"));
  const actions = element("div", "route-complete-actions");
  const navigate = actionButton("길찾기 시작", "start-navigation", "route-complete-navigate", "create-course");
  navigate.append(element("span", "", "길찾기 시작"));
  const share = actionButton("공유하기", "open-share", "route-complete-share-button", "share", { type: "route", id: route.id });
  share.append(element("span", "", "공유하기"));
  actions.append(navigate, share);
  screen.append(actions, element("h2", "route-detail-heading", "코스 상세"));
  const list = element("div", "route-complete-list");
  places.forEach((place, index) => {
    const row = actionButton(`${place.name} 장소 보기`, "open-place", "route-complete-place", "", { placeId: place.id });
    row.append(element("span", "route-order", String(index + 1)), photo(place, "route-complete-place__photo"));
    const copy = element("span", "route-complete-place__copy");
    copy.append(element("strong", "", place.name), element("small", "", `${tagsFor(place)[0]?.name || "장소"} · 50분`), element("em", "", ["가볍게 둘러보기 좋은 첫 장소", "저녁 식사 후보", "마무리로 가기 좋은 카페"][index] || "함께 둘러보기 좋은 장소"));
    row.append(copy, routeIcon("chevron-left", "route-complete-chevron"));
    list.append(row);
  });
  screen.append(list);
  const nearby = element("section", "route-nearby");
  nearby.append(element("h2", "", "근처 추천"), navigateButton("추천 장소 더보기", "c1", "route-nearby-more"));
  nearby.lastChild.textContent = "더보기";
  const nearbyPlace = PLACES.find((place) => place.name === "연남방앗간") || PLACES[8];
  const nearbyCard = actionButton(`${nearbyPlace.name} 장소 보기`, "open-place", "route-nearby-card", "", { placeId: nearbyPlace.id });
  nearbyCard.append(photo(nearbyPlace, ""), element("strong", "", nearbyPlace.name), element("small", "", `${tagsFor(nearbyPlace)[0]?.name || "장소"} · 3분 거리`), routeIcon("nav-saved"));
  nearby.append(nearbyCard);
  screen.append(nearby, renderBottomNav());
  if (state?.overlays?.includes("external-map")) screen.append(renderNavigationOverlay());
  if (state?.toast?.message) screen.append(element("output", `route-toast route-toast--${state.toast.kind}`, state.toast.message));
  return screen;
}

export const ROUTE_RENDERERS = Object.freeze({
  d1: renderStartGallery,
  d2: renderMapStart,
  d3: renderSavedStart,
  d4: renderStartConfirmed,
  d5: renderSavedCandidates,
  d6: renderDiscoverCandidates,
  d7: renderRouteConfirmation,
  d8: renderRouteName,
  d9: renderRouteComplete
});
