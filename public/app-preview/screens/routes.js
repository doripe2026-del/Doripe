import {
  createBottomNav,
  createPrimaryActionButton,
  createSegmentedControl,
  icon as componentIcon
} from "../components.js";
import {
  byId,
  courseById,
  mediaForPlace,
  placeById,
  profileById,
  tagsFor as selectTagsFor
} from "../data/selectors.js";
import { placeMatchesLocationFilter } from "../data/location-filter.js";

const SCREEN_NAVIGATE_EVENT = "app-preview:screen-navigate";
const OVERLAY_DISMISS_EVENT = "app-preview:overlay-dismiss";
const SELECTION_CLEAR_EVENT = "app-preview:selection-clear";
const MEDIA_HIDE_EVENT = "app-preview:media-hide";
const NODE_IDS = Object.freeze({
  d1: "446:2641", d2: "446:1929", d3: "446:2608", d4: "446:2574",
  d5: "446:1956", d6: "446:2048", d7: "446:2166", d8: "446:2218", d9: "446:2256"
});
const mediaFor = (data, place, offset = 0) => {
  const items = mediaForPlace(data, place);
  return items[offset] || items[0] || null;
};
const userFor = (data, item) => profileById(data, item?.userId);

function savedPlaces(state, data) {
  return (state?.savedPlaceIds || []).map((id) => placeById(data, id)).filter(Boolean);
}

function preferredSavedMedia(place, state, data) {
  const hiddenMediaIds = new Set(state?.hiddenMediaIds || []);
  return mediaForPlace(data, place).find((media) => !hiddenMediaIds.has(media.id)) || null;
}

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

function sharedIcon(name, className = "", size = 18) {
  const template = document.createElement("template");
  template.innerHTML = componentIcon(name, { decorative: true, size });
  const image = template.content.firstElementChild;
  if (className) image.className = `${image.className} ${className}`;
  return image;
}

function photo(data, place, className = "", offset = 0) {
  const image = element("img", className);
  const media = mediaFor(data, place, offset);
  if (media) image.src = media.src;
  image.alt = media?.alt || place?.name || "";
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

function routeBackButton(className = "") {
  return actionButton(
    "뒤로 가기",
    "go-back",
    `route-shared-back ${className}`.trim(),
    "chevron-left"
  );
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

function selectedCourse(state, data) {
  return courseById(data, state?.selections?.selectedRouteId)
    || byId(state?.savedRoutes || [], state?.selections?.selectedRouteId)
    || null;
}

function selectedCoursePlaceIds(state, data) {
  return selectedCourse(state, data)?.placeIds
    || state?.routeDraft?.placeIds
    || [];
}

function selectedPlaces(state, data, { fallback = false } = {}) {
  const requested = state?.routePlaceIds?.length
    ? state.routePlaceIds
    : fallback ? selectedCoursePlaceIds(state, data) : [];
  const uniqueIds = [...new Set(requested)];
  return uniqueIds.map((id) => placeById(data, id)).filter(Boolean);
}

function routeStartPlace(state, data) {
  const startPlaceIds = [
    state?.routeDraft?.startPlaceId,
    selectedCoursePlaceIds(state, data)[0],
    state?.selections?.selectedPlaceId
  ];
  return startPlaceIds.map((id) => placeById(data, id)).find(Boolean) || null;
}

function renderBottomNav() {
  return createBottomNav({ selectedIndex: 2 });
}

export function routeSheetSnapTarget({ deltaY = 0, durationMs = 0, up, down }) {
  const distance = Math.abs(deltaY);
  const velocity = distance / Math.max(durationMs, 1);
  const shouldSnap = distance >= 56 || (distance >= 14 && velocity >= 0.5);
  if (!shouldSnap) return null;
  return deltaY < 0 ? up || null : deltaY > 0 ? down || null : null;
}

function installSheetDrag(screen, handle, { up, down }) {
  let pointerId = null;
  let startY = 0;
  let startTime = 0;
  let delta = 0;
  handle.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startY = event.clientY;
    startTime = event.timeStamp;
    delta = 0;
    handle.setPointerCapture?.(pointerId);
    screen.classList.add("is-dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    delta = event.clientY - startY;
    screen.style.setProperty("--route-sheet-drag", `${Math.max(-130, Math.min(160, delta))}px`);
  });
  const reset = () => {
    pointerId = null;
    delta = 0;
    screen.classList.remove("is-dragging");
    screen.style.removeProperty("--route-sheet-drag");
  };
  const finish = (event) => {
    if (pointerId !== event.pointerId) return;
    handle.releasePointerCapture?.(pointerId);
    delta = event.clientY - startY;
    const target = routeSheetSnapTarget({
      deltaY: delta,
      durationMs: event.timeStamp - startTime,
      up,
      down
    });
    reset();
    if (target) document.dispatchEvent(new CustomEvent(SCREEN_NAVIGATE_EVENT, { detail: { screenId: target } }));
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", reset);
  handle.addEventListener("keydown", (event) => {
    const target = event.key === "ArrowDown"
      ? down
      : event.key === "ArrowUp"
        ? up
        : ["Enter", " "].includes(event.key)
          ? up ?? down
          : null;
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

function renderStartGallery(state, data) {
  const screen = root("d1", "route-start-screen");
  screen.append(routeIcon("region-pin", "route-start-pin"));
  const sheet = element("section", "route-start-sheet route-start-sheet--peek");
  const handle = element("button", "route-start-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "장소 선택 창 크기 조절");
  sheet.append(handle);
  const grid = element("div", "route-start-grid");
  const saved = savedPlaces(state, data);
  const hiddenMediaIds = new Set(state?.hiddenMediaIds || []);
  const entries = saved.slice(0, 10).flatMap((place) => {
    const media = mediaForPlace(data, place)[0] || null;
    return media && !hiddenMediaIds.has(media.id) ? [{ place, media }] : [];
  });
  entries.forEach(({ place, media }, index) => {
    const card = actionRegion(`${place.name}에서 시작`, "select-start-place", "route-start-media", { placeId: place.id, mediaId: media.id });
    const image = element("img");
    image.src = media.src;
    image.alt = media.alt;
    image.loading = "eager";
    card.append(image);
    const menu = actionButton(`${place.name} 사진 메뉴`, "open-photo-menu", "route-start-media__menu", "", { mediaId: media.id });
    menu.append(sharedIcon("saved-more", "route-start-media__menu-icon", 18));
    card.append(menu);
    grid.append(card);
  });
  if (entries.length === 0) {
    const empty = element("div", "route-start-empty");
    empty.append(element("strong", "", "저장한 장소가 필요해요"), element("p", "", "발견 탭에서 마음에 드는 장소를 먼저 저장해 보세요"));
    sheet.append(empty);
  } else {
    sheet.append(grid);
  }
  screen.append(sheet, renderBottomNav());
  if (state?.overlays?.includes("photo-menu")) screen.append(renderPhotoMenu(state));
  installSheetDrag(screen, handle, { up: "d3", down: "d2" });
  return screen;
}

function renderMapStart(state, data) {
  const screen = root("d2", "route-map-screen");
  renderMapControls(screen, { back: true });
  const start = createPrimaryActionButton({
    label: "여기서 시작하기",
    action: "confirm-start-location",
    disabled: !placeById(data, state?.selections?.selectedPlaceId),
    className: "route-map-start-button",
    iconName: "map-pin"
  });
  const sheet = element("section", "route-start-sheet route-start-sheet--collapsed");
  const handle = element("button", "route-start-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "저장 목록 열기");
  sheet.append(handle);
  screen.append(start, sheet);
  installSheetDrag(screen, handle, { up: "d3", down: null });
  if (state?.toast?.message) screen.append(element("output", `route-toast route-toast--${state.toast.kind}`, state.toast.message));
  return screen;
}

function renderSavedStart(state, data) {
  const screen = root("d3", "route-start-screen route-start-screen--expanded");
  screen.append(routeIcon("region-pin", "route-start-pin"));
  const sheet = element("section", "route-start-sheet route-start-sheet--expanded");
  const handle = element("button", "route-start-handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "지도에서 위치 선택");
  sheet.append(handle, element("h1", "", "저장한 사진과 영상"), element("p", "route-start-lead", "이 장소에서 저장한 분위기를 한눈에 모아봤어요"));
  const grid = element("div", "route-start-grid route-start-grid--expanded");
  const entries = savedPlaces(state, data).flatMap((place) => {
    const media = preferredSavedMedia(place, state, data);
    return media ? [{ place, media }] : [];
  });
  entries.forEach(({ place, media }) => {
    const card = actionButton(`${place.name}에서 시작`, "select-start-place", "route-start-media", "", { placeId: place.id, mediaId: media.id });
    card.dataset.testid = "route-start-media";
    const image = element("img");
    image.src = media.src;
    image.alt = media.alt;
    image.loading = "eager";
    card.append(image);
    grid.append(card);
  });
  if (entries.length === 0) {
    const empty = element("div", "route-start-empty");
    empty.append(element("strong", "", "저장한 장소가 아직 없어요"), element("p", "", "발견 탭에서 마음에 드는 장소를 먼저 저장해 보세요"));
    sheet.append(empty);
  } else {
    sheet.append(grid);
  }
  screen.append(sheet, renderBottomNav());
  installSheetDrag(screen, handle, { up: null, down: "d2" });
  return screen;
}

function renderStartConfirmed(state, data) {
  const place = placeById(data, state?.selections?.selectedPlaceId);
  const screen = root("d4", "route-map-screen");
  renderMapControls(screen, { back: true });
  const start = createPrimaryActionButton({
    label: "여기서 시작하기",
    action: "confirm-start-place",
    disabled: !place,
    className: "route-map-start-button route-map-start-button--wide",
    iconName: "map-pin",
    values: { placeId: place?.id }
  });
  if (place && state?.selections?.startPlaceCardOpen !== false) {
    const card = element("article", "route-selected-place");
    card.append(photo(data, place, "route-selected-place__photo"));
    const copy = element("div", "route-selected-place__copy");
    copy.append(element("h1", "", place.name), element("span", "", selectTagsFor(data, place)[0]?.name || "장소"), element("p", "", place.address));
    const close = actionButton("선택 장소 닫기", "close-place-card", "route-selected-place__close", "close");
    card.append(copy, close);
    screen.append(card);
  }
  screen.append(start);
  if (state?.toast?.message) screen.append(element("output", `route-toast route-toast--${state.toast.kind}`, state.toast.message));
  return screen;
}

const FILTERS = Object.freeze([
  Object.freeze({ label: "데이트", tagName: "데이트", value: "tag-date", key: "situation", icon: "heart" }),
  Object.freeze({ label: "오후", tagName: "오후", value: "tag-afternoon", key: "time", icon: "saved-sun" }),
  Object.freeze({ label: "조용함", tagName: "조용함", value: "tag-quiet", key: "mood", icon: "message-circle" })
]);

function selectedRouteFilters(state) {
  return state?.selections?.routeFilters || {};
}

function filterValue(data, filter) {
  return data.tags.find((tag) => tag.name === filter.tagName)?.id || filter.value;
}

function renderRouteFilters(state, data) {
  const row = element("div", "route-filter-row");
  const selected = selectedRouteFilters(state);
  const locationLabel = state?.selections?.locationMode === "pin"
    ? `핀 주변 ${Number(state?.selections?.locationRadiusKm) || 3}km`
    : "서울 전체";
  const location = actionButton(`${locationLabel} 위치 필터`, "change-filter", "route-filter-chip is-active", "", { value: "filters" });
  location.append(sharedIcon("map-pin", "route-filter-chip__icon", 15), element("span", "", locationLabel));
  location.setAttribute("aria-pressed", "true");
  row.append(location);
  FILTERS.forEach((filter) => {
    const { label, key, icon } = filter;
    const value = filterValue(data, filter);
    const active = selected[key] === value || state?.selections?.routeFilter === value;
    const chip = actionButton(`${label} 필터`, "select-filter-tag", `route-filter-chip ${active ? "is-active" : ""}`, "", { value, selectionKey: key });
    chip.append(sharedIcon(icon, "route-filter-chip__icon", 15), element("span", "", label));
    chip.setAttribute("aria-pressed", String(active));
    row.append(chip);
  });
  const change = actionButton("조건 변경", "change-filter", "route-filter-change", "", { value: "filters" });
  change.append(sharedIcon("saved-sliders", "route-filter-change__icon", 16), element("span", "", "조건 변경"));
  row.append(change);
  return row;
}

function routeSourceTabs(active) {
  return createSegmentedControl({
    label: "코스 후보 출처",
    className: "route-source-tabs",
    selectedIndex: active === "saved" ? 0 : 1,
    items: [
      { label: "저장된 장소", action: "show-saved-places", value: "saved", iconName: "bookmark" },
      { label: "발견하기", action: "show-discover", value: "discover", iconName: "nav-discover" }
    ]
  });
}

function renderCandidateFilterSheet(state, data) {
  const backdrop = element("div", "route-filter-sheet-backdrop");
  const sheet = element("section", "route-filter-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "route-filter-sheet-title");
  const handle = element("button", "route-filter-sheet__handle");
  handle.type = "button";
  handle.setAttribute("aria-label", "필터 창 닫기");
  const title = element("h2", "", "다음 장소 조건");
  title.id = "route-filter-sheet-title";
  sheet.append(handle, title, element("p", "", "상황과 분위기에 맞게 후보를 다시 정리해요"));
  const locationMode = state?.selections?.locationMode === "pin" ? "pin" : "seoul";
  const radiusKm = Number(state?.selections?.locationRadiusKm) || 3;
  const locationPreview = actionButton(
    locationMode === "pin" ? `선택한 핀 ${radiusKm}km 위치 설정` : "서울 전체 위치 설정",
    "toggle-location-picker",
    "saved-location-preview",
    "",
    { value: "location" }
  );
  const locationCopy = element("span", "saved-location-preview__copy");
  locationCopy.append(
    element("strong", "", locationMode === "pin" ? `핀 주변 ${radiusKm}km` : "서울 전체"),
    element("small", "", locationMode === "pin" ? "지도를 눌러 중심을 바꿀 수 있어요" : "지도를 눌러 원하는 근방만 볼 수 있어요")
  );
  locationPreview.append(sharedIcon("map-pin", "saved-location-preview__pin", 18), locationCopy, sharedIcon("route-chevron-down", "saved-location-preview__chevron", 18));
  sheet.append(locationPreview);
  if (state?.selections?.locationPickerOpen) {
    const picker = element("section", "saved-location-picker");
    picker.setAttribute("aria-label", "위치와 반경 선택");
    const map = actionButton("지도에서 핀 위치 선택", "set-location-pin", "saved-location-map", "", {
      value: JSON.stringify(state?.selections?.locationCenter || { latitude: 37.5665, longitude: 126.9780 })
    });
    const selectedCenter = state?.selections?.locationCenter;
    if (selectedCenter) {
      const pinX = Math.min(100, Math.max(0, ((Number(selectedCenter.longitude) - 126.764) / 0.42) * 100));
      const pinY = Math.min(100, Math.max(0, ((37.701 - Number(selectedCenter.latitude)) / 0.274) * 100));
      map.style.setProperty("--pin-x", `${pinX}%`);
      map.style.setProperty("--pin-y", `${pinY}%`);
    }
    map.addEventListener("click", (event) => {
      const bounds = map.getBoundingClientRect();
      const horizontal = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const vertical = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      map.value = JSON.stringify({
        latitude: Number((37.701 - vertical * 0.274).toFixed(6)),
        longitude: Number((126.764 + horizontal * 0.42).toFixed(6))
      });
    });
    map.append(
      element("span", "saved-location-map__road saved-location-map__road--one"),
      element("span", "saved-location-map__road saved-location-map__road--two"),
      sharedIcon("map-pin", "saved-location-map__marker", 36)
    );
    const radius = element("div", "saved-location-radius");
    radius.append(element("strong", "", "핀 주변 범위"));
    [1, 3, 5, 10].forEach((value) => {
      const option = actionButton(`${value}km 반경`, "select-location-radius", `saved-location-radius__option ${locationMode === "pin" && radiusKm === value ? "is-selected" : ""}`, "", { value });
      option.textContent = `${value}km`;
      option.disabled = locationMode !== "pin";
      option.setAttribute("aria-pressed", String(locationMode === "pin" && radiusKm === value));
      radius.append(option);
    });
    const allSeoul = actionButton("서울 전체 보기", "select-location-mode", `saved-location-all ${locationMode === "seoul" ? "is-selected" : ""}`, "", { value: "seoul" });
    allSeoul.append(sharedIcon("map-pin", "saved-location-all__icon", 17), element("span", "", "서울 전체"));
    picker.append(map, element("p", "saved-location-picker__hint", "지도에서 보고 싶은 곳을 눌러 핀을 옮겨보세요"), radius, allSeoul);
    sheet.append(picker);
  }
  const groups = [
    ["상황", "situation", "heart"],
    ["시간", "time", "saved-sun"],
    ["분위기", "mood", "message-circle"]
  ].map(([title, key, icon]) => [
    title,
    key,
    icon,
    data.tags.filter((tag) => tag.group === key).map((tag) => [tag.name, tag.id])
  ]);
  const selected = selectedRouteFilters(state);
  groups.forEach(([title, key, icon, options]) => {
    const group = element("fieldset", "route-filter-sheet__group");
    group.append(element("legend", "", title));
    options.forEach(([label, value]) => {
      const active = selected[key] === value;
      const option = actionButton(label, "select-filter-tag", active ? "is-selected" : "", "", { value, selectionKey: key });
      option.append(sharedIcon(icon, "route-filter-option__icon", 16), element("span", "", label));
      option.setAttribute("aria-pressed", String(active));
      group.append(option);
    });
    sheet.append(group);
  });
  const summary = element("div", "route-filter-sheet__summary");
  summary.append(element("strong", "", "추천 기준"), element("span", "", locationMode === "pin" ? `핀 주변 ${radiusKm}km` : "서울 전체"));
  const optionLabels = new Map(groups.flatMap(([, , , options]) => options.map(([label, value]) => [value, label])));
  Object.values(selected).forEach((value) => {
    const label = data.tags.find((tag) => tag.id === value)?.name || optionLabels.get(value);
    if (label) summary.append(element("span", "", label));
  });
  const reset = actionButton("필터 초기화", "reset-route-filters", "route-filter-sheet__reset");
  reset.textContent = "초기화";
  const apply = createPrimaryActionButton({
    label: "필터 적용하기",
    action: "apply-route-filters",
    className: "route-filter-sheet__apply",
    iconName: "saved-sliders"
  });
  sheet.append(summary, reset, apply);
  backdrop.append(sheet);
  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    document.dispatchEvent(new CustomEvent(SELECTION_CLEAR_EVENT, { detail: { keys: ["routeFilter"] } }));
  });
  let pointerId = null;
  let startY = 0;
  let startTime = 0;
  let dragY = 0;
  const resetDrag = () => {
    pointerId = null;
    dragY = 0;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("--route-filter-drag-y");
  };
  const dismiss = () => {
    resetDrag();
    document.dispatchEvent(new CustomEvent(SELECTION_CLEAR_EVENT, { detail: { keys: ["routeFilter"] } }));
  };
  handle.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startY = event.clientY;
    startTime = event.timeStamp;
    dragY = 0;
    sheet.classList.add("is-dragging");
    handle.setPointerCapture?.(pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    dragY = Math.max(0, event.clientY - startY);
    sheet.style.setProperty("--route-filter-drag-y", `${Math.min(dragY, 240)}px`);
  });
  handle.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    handle.releasePointerCapture?.(pointerId);
    const target = routeSheetSnapTarget({
      deltaY: event.clientY - startY,
      durationMs: event.timeStamp - startTime,
      up: null,
      down: "dismiss"
    });
    if (target === "dismiss") dismiss();
    else resetDrag();
  });
  handle.addEventListener("pointercancel", resetDrag);
  sheet.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    dismiss();
  });
  return backdrop;
}

function candidateToggle(place, state, className = "route-candidate-add") {
  const selected = state?.routePlaceIds?.includes(place.id) || false;
  const button = actionButton(`${place.name} ${selected ? "추가됨" : "추가"}`, "add-place", `${className} ${selected ? "is-selected" : ""}`, "", { placeId: place.id });
  button.setAttribute("aria-pressed", String(selected));
  if (selected) button.append(sharedIcon("route-check", "route-candidate-add__icon", 18));
  else button.append(sharedIcon("route-plus", "route-candidate-add__icon", 18));
  return button;
}

function candidateFooter(state, data) {
  const startPlaceId = state?.routeDraft?.startPlaceId;
  const count = selectedPlaces(state, data).filter((place) => place.id !== startPlaceId).length;
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
  const legacyFilter = state?.selections?.routeFilter;
  const activeFilters = Object.values(selectedRouteFilters(state)).filter((value) => value && value !== "tag-yeonnam");
  if (activeFilters.length === 0 && legacyFilter && legacyFilter !== "filters" && legacyFilter !== "tag-yeonnam") activeFilters.push(legacyFilter);
  const located = candidates.filter((candidate) => placeMatchesLocationFilter(candidate, state?.selections));
  if (activeFilters.length === 0) return located;
  return located.filter((candidate) => activeFilters.every((filter) => candidate.tagIds.includes(filter)));
}

function candidateHero(state, data) {
  const hero = element("header", "route-candidate-hero");
  const startPlace = routeStartPlace(state, data);
  hero.append(element("h1", "", `${startPlace?.name || "선택한 장소"}에서 가까운 곳`));
  const tags = selectTagsFor(data, startPlace);
  const primaryTags = ["category", "neighborhood"]
    .map((group) => tags.find((tag) => tag.group === group))
    .filter(Boolean);
  [...new Map([...primaryTags, ...tags].map((tag) => [tag.id, tag])).values()]
    .slice(0, 2)
    .forEach((tag) => hero.append(element("span", "", tag.name)));
  return hero;
}

function renderSavedCandidates(state, data) {
  const screen = root("d5", "route-candidate-screen");
  screen.append(routeBackButton("route-candidate-back"));
  screen.append(candidateHero(state, data), routeSourceTabs("saved"), renderRouteFilters(state, data));
  const heading = element("div", "route-candidate-heading");
  const sort = element("span", "route-candidate-sort");
  sort.append(element("span", "", "적합도순"), sharedIcon("route-chevron-down", "route-candidate-sort__icon", 14));
  heading.append(element("h2", "", "저장한 장소 중 가까운 후보"), element("p", "", "거리와 분위기가 맞는 순서로 정리했어요"), sort);
  screen.append(heading);
  const list = element("div", "route-saved-list");
  const startPlaceId = state?.routeDraft?.startPlaceId;
  const candidates = savedPlaces(state, data).filter((place) => place.id !== startPlaceId);
  filteredCandidates(candidates, state).forEach((place, index) => {
    const card = element("article", "route-saved-candidate");
    card.append(photo(data, place, "route-saved-candidate__photo", index % 3));
    const copy = element("div", "route-saved-candidate__copy");
    copy.append(element("h3", "", place.name), element("p", "", `${selectTagsFor(data, place)[0]?.name || "장소"} · 도보 ${place.walkingMinutes}분`));
    const chips = element("div", "route-candidate-tags");
    selectTagsFor(data, place).slice(1, 3).forEach((tag) => chips.append(element("span", "", tag.name)));
    copy.append(chips);
    card.append(copy, element("strong", "route-fit-score", `적합도 ${92 - index * 4}`), candidateToggle(place, state));
    list.append(card);
  });
  screen.append(list, candidateFooter(state, data));
  if (state?.selections?.routeFilter === "filters") screen.append(renderCandidateFilterSheet(state, data));
  return screen;
}

function renderDiscoverCandidates(state, data) {
  const screen = root("d6", "route-candidate-screen");
  screen.append(routeBackButton("route-candidate-back"));
  screen.append(candidateHero(state, data), routeSourceTabs("discover"), renderRouteFilters(state, data));
  const grid = element("div", "route-discover-grid");
  const savedPlaceIds = new Set(state?.savedPlaceIds || []);
  const startPlaceId = state?.routeDraft?.startPlaceId;
  const candidates = data.places
    .filter((place) => place.id !== startPlaceId && !savedPlaceIds.has(place.id))
    .slice(0, 6);
  filteredCandidates(candidates, state).forEach((place, index) => {
    const card = element("article", "route-discover-candidate");
    const media = mediaFor(data, place, index % 3);
    card.append(photo(data, place, "route-discover-candidate__photo", index % 3));
    if (media?.kind === "video") {
      const video = element("span", "route-video-indicator");
      video.append(sharedIcon("route-play", "route-video-indicator__icon", 14));
      card.append(video);
    }
    card.append(candidateToggle(place, state));
    const author = userFor(data, place);
    const meta = element("div", "route-discover-candidate__meta");
    meta.append(element("small", "", author?.handle || ""), element("strong", "", `적합도 ${94 - index * 2}`), element("h3", "", place.name), element("p", "", place.summary));
    const tags = element("div", "route-candidate-tags");
    selectTagsFor(data, place).slice(0, 2).forEach((tag) => tags.append(element("span", "", tag.name)));
    meta.append(tags);
    card.append(meta);
    grid.append(card);
  });
  screen.append(grid, candidateFooter(state, data));
  if (state?.selections?.routeFilter === "filters") screen.append(renderCandidateFilterSheet(state, data));
  return screen;
}

export function renderRouteConfirmation(state, data) {
  const places = selectedPlaces(state, data, { fallback: true });
  const count = places.length;
  const screen = root("d7");
  screen.append(element("div", "route-confirm-haze"));
  const back = routeBackButton("route-confirm-back");
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
  screen.append(routeBackButton("route-confirm-back"));
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

export function routeDirectionsUrl(places) {
  const start = places[0];
  const destination = places.at(-1);
  if (!start || !destination) return "";
  const point = (place) => `${place.longitude},${place.latitude},${encodeURIComponent(place.name)}`;
  return `https://map.naver.com/p/directions/${point(start)}/${point(destination)}/-/walk`;
}

function renderNavigationOverlay(places) {
  const backdrop = element("div", "route-navigation-overlay");
  const dialog = element("section", "route-navigation-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "코스 길찾기");
  dialog.append(element("h2", "", "길찾기를 시작할까요?"));
  const intermediate = places.slice(1, -1);
  dialog.append(element(
    "p",
    "route-navigation-waypoints",
    intermediate.length
      ? `남은 경유지 ${intermediate.length}곳: ${intermediate.map((place) => place.name).join(" → ")}`
      : "남은 경유지 없이 목적지로 이동해요"
  ));
  const stops = element("ol", "route-navigation-stops");
  places.forEach((place) => stops.append(element("li", "", place.name)));
  dialog.append(stops);
  const link = element("a", "route-navigation-link", "지도 앱으로 이동");
  link.href = routeDirectionsUrl(places);
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

function routeFromDraft(state) {
  const placeIds = state?.routeDraft?.placeIds || [];
  if (placeIds.length === 0) return null;
  return {
    id: state?.selections?.selectedRouteId || "route-draft",
    name: state?.form?.routeName?.trim() || "새 코스",
    placeIds,
    tagIds: []
  };
}

function renderRouteComplete(state, data) {
  const route = selectedCourse(state, data) || routeFromDraft(state) || data?.courses?.[0] || null;
  const screen = root("d9", "route-complete-screen");
  if (!route) {
    screen.append(routeBackButton("route-complete-back"));
    screen.append(element("p", "route-start-empty", "완성된 코스가 아직 없어요"), renderBottomNav());
    return screen;
  }
  const places = (route.placeIds || []).map((placeId) => placeById(data, placeId)).filter(Boolean);
  const routeName = route.name || state?.form?.routeName?.trim() || "새 코스";
  const isSharedFeedRoute = state?.selections?.routeDetailSource === "feed";
  const author = isSharedFeedRoute ? profileById(data, route.userId) : null;
  const content = element("div", "route-complete-scroll");
  const top = element("header", "route-complete-top");
  top.append(routeBackButton("route-complete-back"), element("strong", "", isSharedFeedRoute ? "공유 코스" : "코스 완성"), actionButton("코스 공유", "open-share", "route-complete-share", "share", { type: "route", id: route.id }));
  content.append(top, element("h1", "route-complete-title", routeName), element("p", "route-complete-meta", `${places.length}곳 · 약 1시간 40분 · 도보 중심`));
  if (author) {
    const attribution = element("div", "route-complete-author");
    const avatar = element("img");
    avatar.src = author.avatarUrl;
    avatar.alt = `${author.name} 프로필`;
    attribution.append(avatar, element("strong", "", `${author.name}님의 공유 코스`));
    if (author.isCurator) {
      const badge = sharedIcon("official-badge", "route-complete-author__badge", 17);
      badge.setAttribute("aria-label", "공식 큐레이터");
      badge.removeAttribute("aria-hidden");
      attribution.append(badge, element("span", "route-visually-hidden", "공식 큐레이터"));
    }
    content.append(attribution);
  }
  const tags = element("div", "route-complete-tags");
  selectTagsFor(data, route).forEach((tag) => tags.append(element("span", "", tag.name)));
  content.append(tags, element("div", "route-complete-map"));
  const actions = element("div", "route-complete-actions");
  const navigate = actionButton("길찾기 시작", "start-navigation", "route-complete-navigate", "create-course");
  navigate.append(element("span", "", "길찾기 시작"));
  const share = actionButton("공유하기", "open-share", "route-complete-share-button", "share", { type: "route", id: route.id });
  share.append(element("span", "", "공유하기"));
  actions.append(navigate, share);
  content.append(actions, element("h2", "route-detail-heading", "코스 상세"));
  const list = element("div", "route-complete-list");
  places.forEach((place, index) => {
    const row = actionButton(`${place.name} 장소 보기`, "open-place", "route-complete-place", "", { placeId: place.id });
    row.append(element("span", "route-order", String(index + 1)), photo(data, place, "route-complete-place__photo", index % 3));
    const copy = element("span", "route-complete-place__copy");
    copy.append(element("strong", "", place.name), element("small", "", `${selectTagsFor(data, place)[0]?.name || "장소"} · 50분`), element("em", "", ["가볍게 둘러보기 좋은 첫 장소", "저녁 식사 후보", "마무리로 가기 좋은 카페"][index] || "함께 둘러보기 좋은 장소"));
    row.append(copy, routeIcon("chevron-left", "route-complete-chevron"));
    list.append(row);
  });
  content.append(list);
  const nearby = element("section", "route-nearby");
  nearby.append(element("h2", "", "근처 추천"), navigateButton("추천 장소 더보기", "c1", "route-nearby-more"));
  nearby.lastChild.textContent = "더보기";
  const routePlaceIds = new Set(route.placeIds || []);
  const selectedNearbyPlace = placeById(data, state?.selections?.selectedPlaceId);
  const nearbyPlace = selectedNearbyPlace && !routePlaceIds.has(selectedNearbyPlace.id)
    ? selectedNearbyPlace
    : data.places.find((place) => !routePlaceIds.has(place.id))
    || places[0]
    || null;
  if (nearbyPlace) {
    const nearbyCard = actionButton(`${nearbyPlace.name} 장소 보기`, "open-place", "route-nearby-card", "", { placeId: nearbyPlace.id });
    nearbyCard.append(photo(data, nearbyPlace, ""), element("strong", "", nearbyPlace.name), element("small", "", `${selectTagsFor(data, nearbyPlace)[0]?.name || "장소"} · 3분 거리`), routeIcon("nav-saved"));
    nearby.append(nearbyCard);
  }
  content.append(nearby);
  screen.append(content, renderBottomNav());
  if (state?.overlays?.includes("external-map")) screen.append(renderNavigationOverlay(places));
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
