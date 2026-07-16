import { createBottomNav, icon as componentIcon } from "../components.js";
import {
  byId,
  courseById,
  mediaForPlace,
  placeById,
  profileById,
  tagById,
  tagsFor as selectTagsFor
} from "../data/selectors.js";
import { routeDirectionsUrl } from "./routes.js";
import { placeMatchesLocationFilter } from "../data/location-filter.js";

const OVERLAY_DISMISS_EVENT = "app-preview:overlay-dismiss";

const NODE_IDS = Object.freeze({
  c1: "446:1787", c2: "446:1631", c3: "446:1223",
  c4: "446:1715", c6: "446:2394", c7: "446:1474"
});

const courseName = (route) => route?.name?.replaceAll("루트", "코스") || "코스";
const routeFor = (state, data) => byId(state?.savedRoutes || [], state?.selections?.selectedRouteId)
  || courseById(data, state?.selections?.selectedRouteId)
  || data.courses[0]
  || null;
const placeFor = (state, data) => placeById(data, state?.selections?.selectedPlaceId)
  || data.places[0]
  || null;
const mediaFor = (data, place, offset = 0) => {
  const items = mediaForPlace(data, place);
  return items[offset] || items[0] || null;
};
const routeWalkingMinutes = (route) => route?.walkingMinutes ?? Math.max(15, (route?.placeIds?.length || 0) * 15);

function savedPlaces(state, data) {
  return (state?.savedPlaceIds || []).map((id) => placeById(data, id)).filter(Boolean);
}

function visibleSavedPlaces(state, data) {
  const filters = ["situation", "time", "mood"]
    .map((key) => state?.selections?.[key])
    .filter(Boolean);
  const places = savedPlaces(state, data).filter((place) => placeMatchesLocationFilter(place, state?.selections));
  return filters.length === 0 ? places : places.filter((place) => filters.every((tagId) => place.tagIds.includes(tagId)));
}

function savedRoutes(state) {
  return state?.savedRoutes || [];
}

function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function data(node, values = {}) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) node.dataset[key] = String(value);
  }
  return node;
}

function button(label, action, values = {}, className = "") {
  const node = el("button", className);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.dataset.action = action;
  data(node, values);
  if (values.value !== undefined) node.value = String(values.value);
  return node;
}

function actionRegion(label, action, values = {}, className = "") {
  const node = el("article", className);
  node.setAttribute("role", "button");
  node.tabIndex = 0;
  node.setAttribute("aria-label", label);
  node.dataset.action = action;
  data(node, values);
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      node.click();
    }
  });
  return node;
}

function root(screenId, extra = "") {
  const node = el("section", `saved-screen saved-screen--${screenId} ${extra}`.trim());
  data(node, { screenId, figmaNode: NODE_IDS[screenId], renderMode: "semantic" });
  return node;
}

function icon(name, className = "") {
  const image = el("img", className);
  image.src = `/app-preview/assets/icons/${name}.svg`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

function savedIcon(name, className = "") {
  const image = el("img", className);
  image.src = `/app-preview/assets/saved/${name}.svg`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
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
  const image = el("img", className);
  const media = mediaFor(data, place, offset);
  if (media) image.src = media.src;
  image.alt = media?.alt || place?.name || "";
  image.width = 180;
  image.height = 180;
  return image;
}

function filterChip(label, value, active, source, iconText = "") {
  const chip = button(`${label} 필터`, "select-filter-tag", { value, measureKey: source }, `saved-chip ${active ? "is-active" : ""}`);
  chip.setAttribute("aria-pressed", String(active));
  if (iconText?.startsWith?.("saved:")) chip.append(savedIcon(iconText.slice(6), "saved-chip__icon-image"));
  else if (iconText) chip.append(el("span", "saved-chip__icon", iconText));
  chip.append(el("span", "", label));
  return chip;
}

function savedTabs(screenId) {
  const tabs = el("div", "saved-tabs");
  tabs.setAttribute("role", "tablist");
  const places = button("장소", "show-saved-places", { value: "places", measureKey: "icon / bookmark" }, `saved-tab ${screenId === "c1" ? "is-active" : ""}`);
  const routes = button("코스", "show-saved-routes", { value: "routes", measureKey: "icon / route" }, `saved-tab ${screenId === "c2" ? "is-active" : ""}`);
  places.setAttribute("role", "tab"); routes.setAttribute("role", "tab");
  places.setAttribute("aria-selected", String(screenId === "c1"));
  routes.setAttribute("aria-selected", String(screenId === "c2"));
  places.append(savedIcon("bookmark-filled"), el("span", "", "장소"));
  routes.append(savedIcon("course"), el("span", "", "코스"));
  tabs.append(places, routes);
  return tabs;
}

function selectedFilterTags(state, data) {
  return [
    tagById(data, state?.selections?.situation) || tagById(data, "tag-date"),
    tagById(data, state?.selections?.time) || tagById(data, "tag-afternoon"),
    tagById(data, state?.selections?.mood) || tagById(data, "tag-quiet")
  ].filter(Boolean);
}

function topFilters(state, data, count = 5) {
  const selected = selectedFilterTags(state, data);
  const current = state?.selections?.savedFilter;
  const locationLabel = state?.selections?.locationMode === "pin"
    ? `핀 주변 ${Number(state?.selections?.locationRadiusKm) || 3}km`
    : "서울 전체";
  const specs = [
    [locationLabel, "location", "saved:map-pin"],
    ...selected.map((tag) => [tag.name, tag.id, ""]),
    ["조건 변경", "filters", "saved:sliders"]
  ].slice(0, count);
  const row = el("div", "saved-filter-row");
  const selectedIds = new Set(selected.map((tag) => tag.id));
  specs.forEach(([label, value, glyph], index) => {
    const chip = filterChip(
      label,
      value,
      current === value || (!current && index === 0),
      `chip${index ? `#${index + 1}` : ""}`,
      glyph
    );
    chip.setAttribute("aria-pressed", String(current === value || selectedIds.has(value) || (!current && index === 0)));
    row.append(chip);
  });
  return row;
}

function compactTags(data, item, startIndex, limit = 2) {
  const wrap = el("div", "saved-inline-tags");
  selectTagsFor(data, item).slice(0, limit).forEach((tag, index) => {
    const staticTag = el("span", "saved-chip", tag.name);
    staticTag.dataset.measureKey = `chip#${startIndex + index}`;
    wrap.append(staticTag);
  });
  return wrap;
}

function recommendationCard(data, place, index) {
  const card = actionRegion(`${place.name} 상세`, "open-place", { placeId: place.id, measureKey: `recommend card${index ? `#${index + 1}` : ""}` }, "saved-recommend-card");
  card.append(photo(data, place, "saved-recommend-card__photo"));
  card.append(savedIcon("chevron-right", "saved-recommend-chevron"));
  card.append(el("strong", "", place.name), el("small", "", `${selectTagsFor(data, place)[0]?.name || "장소"} · ${230 + index * 150}m`));
  card.append(compactTags(data, place, 6 + index * 2));
  return card;
}

function placeRow(data, place, index) {
  const row = actionRegion(`${place.name} 상세`, "open-place", { placeId: place.id, measureKey: `list row${index ? `#${index + 1}` : ""}` }, "saved-place-row");
  row.append(photo(data, place, "saved-place-row__photo"));
  const copy = el("div", "saved-place-row__copy");
  copy.append(el("strong", "", place.name), el("small", "", `${selectTagsFor(data, place)[0]?.name || "장소"} · 도보 ${place.walkingMinutes}분`), compactTags(data, place, 12 + index * 2));
  const score = el("span", "saved-place-row__score", `적합도 ${92 - index * 4}`);
  const add = button(`${place.name} 코스에 추가`, "add-place-to-route", { placeId: place.id, measureKey: `icon / add route${index ? `#${index + 1}` : ""}` }, "saved-add-route");
  add.append(savedIcon("add-course"));
  row.append(copy, score, add);
  return row;
}

function renderPlaces(state, data) {
  const screen = root("c1");
  screen.append(el("div", "saved-map saved-map--overview"));
  const sheet = el("div", "saved-sheet saved-sheet--places");
  sheet.append(el("span", "saved-handle"), savedTabs("c1"), topFilters(state, data));
  const heading = el("div", "saved-section-heading");
  const sort = el("span", "saved-section-sort");
  sort.append(el("span", "", "적합도순"), sharedIcon("saved-chevron-down", "saved-section-sort__icon", 14));
  heading.append(el("h1", "", "오늘 어울리는 장소 추천"), el("small", "", "거리와 분위기가 맞는 장소예요"), sort);
  sheet.append(heading);
  const places = visibleSavedPlaces(state, data);
  if (places.length === 0) {
    sheet.append(el("p", "saved-empty-state", "저장한 장소가 아직 없어요"));
    screen.append(sheet, createBottomNav({ selectedIndex: 1 }));
    return screen;
  }
  const recommends = el("div", "saved-recommendations");
  places.slice(0, 3).forEach((place, index) => recommends.append(recommendationCard(data, place, index)));
  sheet.append(recommends);
  const list = el("div", "saved-place-list");
  places.forEach((place, index) => list.append(placeRow(data, place, index)));
  sheet.append(list);
  screen.append(sheet, createBottomNav({ selectedIndex: 1 }));
  return screen;
}

function routeCard(data, route, index) {
  const card = el("article", "saved-route-card");
  const walkingMinutes = routeWalkingMinutes(route);
  const place = placeById(data, route.placeIds[0]);
  card.append(photo(data, place, "saved-route-card__photo", index % 3));
  const copy = el("div", "saved-route-card__copy");
  copy.append(el("strong", "", courseName(route)), el("p", "", route.placeIds.map((id) => placeById(data, id)?.name).filter(Boolean).join(" → ")), el("small", "", `${route.placeIds.length}곳 · 약 1시간 ${walkingMinutes}분 · 걷기 중심`));
  const tags = el("div", "saved-route-tags");
  selectTagsFor(data, route).forEach((tag) => tags.append(el("span", "", tag.name)));
  copy.append(tags);
  const actions = el("div", "saved-route-card__actions");
  const map = button(`${courseName(route)} 경로 보기`, "open-route-map", { routeId: route.id, measureKey: `button${index ? `#${index * 2 + 1}` : ""}` }, "saved-route-outline");
  map.textContent = "경로 보기";
  const detail = button(`${courseName(route)} 상세 보기`, "open-route", { routeId: route.id, measureKey: `button#${index * 2 + 2}` }, "saved-route-fill");
  detail.textContent = "상세 보기";
  actions.append(map, detail);
  copy.append(actions);
  const more = el("span", "saved-route-more");
  more.append(sharedIcon("saved-more", "saved-route-more__icon", 18));
  card.append(copy, more);
  return card;
}

function renderRoutes(state, data) {
  const screen = root("c2");
  const routes = savedRoutes(state);
  const map = el("div", "saved-map saved-map--routes");
  const places = [...new Set(routes.flatMap((route) => route.placeIds))]
    .map((id) => placeById(data, id))
    .filter(Boolean);
  places.slice(0, 6).forEach((place, index) => {
    const marker = el("span", "saved-map-marker");
    marker.style.setProperty("--marker-x", `${88 + (index % 3) * 98}px`);
    marker.style.setProperty("--marker-y", `${40 + Math.floor(index / 3) * 112}px`);
    marker.append(photo(data, place, "saved-map-marker__photo"), el("i", "", "●"));
    map.append(marker);
  });
  screen.append(map);
  const sheet = el("div", "saved-sheet saved-sheet--routes");
  const title = el("h1", "saved-visually-hidden", "저장한 코스");
  sheet.append(title, savedTabs("c2"), topFilters(state, data));
  const list = el("div", "saved-route-list");
  if (routes.length === 0) list.append(el("p", "saved-empty-state", "저장한 코스가 없어요"));
  routes.forEach((route, index) => list.append(routeCard(data, route, index)));
  sheet.append(list);
  screen.append(sheet, createBottomNav({ selectedIndex: 1 }));
  if (state?.overlays?.includes("saved-route-map")) screen.append(renderSavedRouteMap(state, data));
  return screen;
}

function renderSavedRouteMap(state, data) {
  const route = routeFor(state, data);
  const places = (route?.placeIds || []).map((id) => placeById(data, id)).filter(Boolean);
  const backdrop = el("div", "route-navigation-overlay saved-route-map-overlay");
  backdrop.style.zIndex = "100";
  const dialog = el("section", "route-navigation-dialog saved-route-map-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", `${courseName(route)} 경로`);
  dialog.style.maxHeight = "760px";
  dialog.style.overflow = "auto";
  dialog.append(el("h2", "", courseName(route)));

  const map = el("div", "saved-route-map-canvas");
  map.style.position = "relative";
  map.style.width = "100%";
  map.style.height = "180px";
  map.style.background = "#f3f5ef";
  map.style.borderRadius = "8px";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 300 180");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "180");
  svg.dataset.routePath = "true";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  const points = places.map((_, index) => `${35 + index * (230 / Math.max(1, places.length - 1))},${index % 2 ? 125 : 55}`).join(" ");
  path.setAttribute("points", points);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#f05a3c");
  path.setAttribute("stroke-width", "5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  map.append(svg);
  places.forEach((place, index) => {
    const marker = el("span", "saved-map-marker", String(index + 1));
    marker.style.setProperty("--marker-x", `${20 + index * (230 / Math.max(1, places.length - 1))}px`);
    marker.style.setProperty("--marker-y", `${index % 2 ? 95 : 25}px`);
    marker.style.zIndex = "1";
    map.append(marker);
  });
  dialog.append(map);

  const stops = el("ol", "saved-route-map-stops");
  places.forEach((place, index) => {
    const stop = el("li", "saved-route-map-stop");
    stop.dataset.routeStop = String(index + 1);
    stop.append(el("span", "saved-route-stop__number", String(index + 1)), el("strong", "", place.name));
    stops.append(stop);
  });
  dialog.append(stops);
  const directions = el("a", "route-navigation-link", "지도 앱으로 이동");
  directions.href = routeDirectionsUrl(places);
  directions.target = "_blank";
  directions.rel = "noopener noreferrer";
  const close = button("경로 닫기", "", {}, "route-navigation-close");
  delete close.dataset.action;
  close.textContent = "닫기";
  close.addEventListener("click", () => document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "saved-route-map" } })));
  dialog.append(directions, close);
  backdrop.append(dialog);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "saved-route-map" } }));
  });
  return backdrop;
}

const FILTER_GROUPS = Object.freeze([
  { title: "상황", action: "select-situation", key: "situation", tags: ["tag-date", "tag-friends", "tag-alone", "tag-family-group"] },
  { title: "시간", action: "select-time", key: "time", tags: ["tag-daytime", "tag-afternoon", "tag-evening", "tag-night"] },
  { title: "분위기", action: "select-mood", key: "mood", tags: ["tag-quiet", "tag-emotional", "tag-good-for-talking", "tag-sophisticated", "tag-bright", "tag-dark"] }
]);

export function renderFilters(state, data) {
  const screen = root("c3");
  const sheet = el("div", "saved-filter-sheet");
  sheet.append(el("span", "saved-handle"), el("h1", "", "어떤 장소를 다시 볼까요?"), el("p", "saved-filter-sheet__lead", "저장한 장소를 지금 상황에 맞게 정리해드릴게요"));
  const locationMode = state?.selections?.locationMode === "pin" ? "pin" : "seoul";
  const radiusKm = Number(state?.selections?.locationRadiusKm) || 3;
  const locationPreview = button(
    locationMode === "pin" ? `선택한 핀 ${radiusKm}km 위치 설정` : "서울 전체 위치 설정",
    "toggle-location-picker",
    { measureKey: "location preview" },
    "saved-location-preview"
  );
  const locationCopy = el("span", "saved-location-preview__copy");
  locationCopy.append(
    el("strong", "", locationMode === "pin" ? `핀 주변 ${radiusKm}km` : "서울 전체"),
    el("small", "", locationMode === "pin" ? "지도를 눌러 중심을 바꿀 수 있어요" : "지도를 눌러 원하는 근방만 볼 수 있어요")
  );
  locationPreview.append(savedIcon("map-pin", "saved-location-preview__pin"), locationCopy, sharedIcon("saved-chevron-down", "saved-location-preview__chevron", 18));
  sheet.append(locationPreview);

  if (state?.selections?.locationPickerOpen) {
    const picker = el("section", "saved-location-picker");
    picker.setAttribute("aria-label", "위치와 반경 선택");
    const map = button("지도에서 핀 위치 선택", "set-location-pin", {
      measureKey: "location map",
      value: JSON.stringify(state?.selections?.locationCenter || { latitude: 37.5665, longitude: 126.9780 })
    }, "saved-location-map");
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
    map.append(el("span", "saved-location-map__road saved-location-map__road--one"), el("span", "saved-location-map__road saved-location-map__road--two"), savedIcon("map-pin", "saved-location-map__marker"));
    const hint = el("p", "saved-location-picker__hint", "지도에서 보고 싶은 곳을 눌러 핀을 옮겨보세요");
    const radius = el("div", "saved-location-radius");
    radius.append(el("strong", "", "핀 주변 범위"));
    [1, 3, 5, 10].forEach((value) => {
      const option = button(`${value}km 반경`, "select-location-radius", { value }, `saved-location-radius__option ${locationMode === "pin" && radiusKm === value ? "is-selected" : ""}`);
      option.textContent = `${value}km`;
      option.disabled = locationMode !== "pin";
      option.setAttribute("aria-pressed", String(locationMode === "pin" && radiusKm === value));
      radius.append(option);
    });
    const allSeoul = button("서울 전체 보기", "select-location-mode", { value: "seoul" }, `saved-location-all ${locationMode === "seoul" ? "is-selected" : ""}`);
    allSeoul.append(savedIcon("map-pin", "saved-location-all__icon"), el("span", "", "서울 전체"));
    picker.append(map, hint, radius, allSeoul);
    sheet.append(picker);
  }
  let sourceIndex = 0;
  for (const group of FILTER_GROUPS) {
    const fieldset = el("fieldset", "saved-filter-group");
    fieldset.append(el("legend", "", group.title));
    for (const tagId of group.tags) {
      const tag = tagById(data, tagId);
      if (!tag) continue;
      const selected = state?.selections?.[group.key] === tagId || (!state?.selections?.[group.key] && ["tag-date", "tag-afternoon", "tag-quiet", "tag-emotional"].includes(tagId));
      const option = button(tag.name, group.action, { value: tag.id, measureKey: `button${sourceIndex ? `#${sourceIndex + 1}` : ""}` }, `saved-filter-option ${selected ? "is-selected" : ""}`);
      option.setAttribute("aria-pressed", String(selected));
      option.append(sharedIcon(tag.group === "time" ? "saved-sun" : "heart", "saved-filter-option__icon", 18), el("span", "", tag.name));
      fieldset.append(option);
      sourceIndex += 1;
    }
    sheet.append(fieldset);
  }
  const summary = el("div", "saved-filter-summary");
  summary.append(el("strong", "", "추천 기준"));
  selectedFilterTags(state, data)
    .concat(tagById(data, state?.selections?.mood) ? [] : [tagById(data, "tag-emotional")])
    .filter(Boolean)
    .forEach((tag) => summary.append(el("span", "", tag.name)));
  const apply = button("저장 장소 다시 정렬하기", "apply-filters", { measureKey: "CTA" }, "saved-filter-apply");
  apply.append(sharedIcon("saved-sliders", "saved-filter-apply__icon", 18), el("span", "", "저장 장소 다시 정렬하기"));
  const reset = button("초기화", "reset-filters", { measureKey: "button#15" }, "saved-filter-reset");
  reset.textContent = "초기화";
  sheet.append(summary, apply, reset);
  screen.append(sheet);
  return screen;
}

function renderPlaceMap(state, data) {
  const place = placeFor(state, data);
  const screen = root("c4");
  if (!place) {
    screen.append(el("p", "saved-empty-state", "장소 정보를 찾을 수 없어요"));
    return screen;
  }
  const back = button("뒤로 가기", "go-back", { measureKey: "button / back floating" }, "saved-map-control saved-map-control--back");
  back.append(savedIcon("chevron-left"));
  const locate = button("내 위치 찾기", "locate-user", { measureKey: "button / locate floating" }, "saved-map-control saved-map-control--locate");
  locate.append(savedIcon("locate"));
  const toast = el("div", "saved-map-toast", "클립보드에 복사되었어요");
  const card = actionRegion(`${place.name} 장소 보기`, "open-place", { placeId: place.id, measureKey: "place card / selected saved place" }, "saved-map-place-card");
  card.append(photo(data, place, "saved-map-place-card__photo"));
  const copy = el("div", "saved-map-place-card__copy");
  copy.append(el("h1", "", place.name));
  const tagRow = el("div", "saved-inline-tags");
  selectTagsFor(data, place).slice(0, 2).forEach((tag) => tagRow.append(el("span", "saved-static-tag", tag.name)));
  const address = el("small", "saved-map-place-card__address"); address.append(savedIcon("address-pin"), el("span", "", place.address));
  copy.append(tagRow, address);
  const close = button("장소 카드 닫기", "close-place-card", { measureKey: "button / close place card" }, "saved-map-place-card__close");
  close.append(savedIcon("close"));
  card.append(copy, close, savedIcon("speech-tail", "saved-map-place-card__pointer"));
  const transit = el("section", "saved-transit");
  transit.append(el("h2", "", "주변 교통 정보"));
  [["홍대입구역", "도보 8분", "2호선"], ["연남동 정류장", "도보 3분", "마을버스"], ["망원시장 정류장", "도보 9분", "지선버스"]].forEach(([name, time, kind], index) => {
    const row = el("div", "saved-transit__row");
    const transitIcon = el("span", "saved-transit__icon"); transitIcon.append(savedIcon(index ? "bus" : "subway"));
    row.append(transitIcon, el("strong", "", name), el("small", "", time), el("em", "", kind));
    transit.append(row);
  });
  screen.append(back, toast, locate);
  if (state?.selections?.savedPlaceCardOpen !== false) screen.append(card);
  screen.append(transit);
  return screen;
}

function visibleRoutePlaces(route, state, data) {
  const placeIds = route?.placeIds || [];
  const places = placeIds.map((id) => placeById(data, id)).filter(Boolean);
  const replacement = placeById(data, state?.selections?.replacementPlaceId);
  const selectedId = state?.selections?.selectedPlaceId;
  return replacement ? places.map((place) => place.id === selectedId ? replacement : place) : places;
}

function renderRouteDetail(state, data) {
  const route = routeFor(state, data);
  const screen = root("c6");
  if (!route) {
    screen.append(el("p", "saved-empty-state", "코스 정보를 찾을 수 없어요"));
    return screen;
  }
  const walkingMinutes = routeWalkingMinutes(route);
  const places = visibleRoutePlaces(route, state, data);
  const heroPlace = places[0] || null;
  const hero = el("div", "saved-route-hero");
  const heroImage = photo(data, heroPlace, "saved-route-hero__photo", 1);
  hero.append(heroImage);
  const sheet = el("div", "saved-route-detail-sheet");
  sheet.append(el("span", "saved-handle"));
  const header = el("header", "saved-route-detail-header");
  const back = button("뒤로 가기", "go-back", { measureKey: "Icon / back sheet" }, "saved-route-detail-back"); back.append(icon("back"));
  const title = el("div", ""); title.append(el("h1", "", courseName(route)), el("small", "", `${places.length}곳 · 1시간 ${walkingMinutes}분 · 도보 ${Math.max(5, walkingMinutes - 32)}분`));
  const shareIcon = button("코스 공유하기", "open-share", { type: "route", id: route.id, measureKey: "Icon / share-2 / header" }, "saved-route-detail-share"); shareIcon.append(icon("share"));
  header.append(back, title, shareIcon);
  const actions = el("div", "saved-route-detail-actions");
  const navigate = button("길찾기", "start-navigation", { routeId: route.id, measureKey: "Button / navigate bg" }, "saved-route-detail-navigate");
  navigate.append(sharedIcon("discover-send", "saved-route-detail-action__icon", 22), el("span", "", "길찾기"));
  const share = button("공유하기", "open-share", { type: "route", id: route.id, measureKey: "Button / share bg" }, "saved-route-detail-share-button");
  share.append(sharedIcon("share", "saved-route-detail-action__icon", 18), el("span", "", "공유하기"));
  actions.append(navigate, share);
  const list = el("ol", "saved-route-stops");
  places.forEach((place, index) => {
    const item = el("li", "saved-route-stop");
    item.append(el("span", "saved-route-stop__number", String(index + 1)));
    const open = button(`${place.name} 장소 보기`, "open-place", { placeId: place.id, measureKey: `Place photo crop ${index + 1}` }, "saved-route-stop__photo-button");
    open.append(photo(data, place, "saved-route-stop__photo"));
    const copy = el("div", "saved-route-stop__copy");
    copy.append(el("strong", "", place.name), el("span", "saved-static-tag", selectTagsFor(data, place)[0]?.name || "장소"), el("small", "", `${selectTagsFor(data, place)[0]?.name || "장소"} · ${20 + index * 15}분`));
    const replace = button(`${place.name} 바꾸기`, "replace-route-place", { placeId: place.id, measureKey: `Change place bg ${index + 1}` }, "saved-route-stop__replace");
    replace.append(sharedIcon("saved-refresh", "saved-route-stop__replace-icon", 18));
    item.append(open, copy, replace, sharedIcon("saved-chevron-right", "saved-route-stop__chevron", 18));
    list.append(item);
  });
  sheet.append(header, actions, list);
  screen.append(hero, sheet);
  if (state?.overlays?.includes("external-map")) screen.append(renderRouteDirections(places));
  return screen;
}

function renderRouteDirections(places) {
  const backdrop = el("div", "route-navigation-overlay");
  const dialog = el("section", "route-navigation-dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "코스 길찾기");
  dialog.append(el("h2", "", "길찾기를 시작할까요?"));
  const intermediate = places.slice(1, -1);
  dialog.append(el("p", "route-navigation-waypoints", intermediate.length
    ? `남은 경유지 ${intermediate.length}곳: ${intermediate.map((place) => place.name).join(" → ")}`
    : "남은 경유지 없이 목적지로 이동해요"));
  const stops = el("ol", "route-navigation-stops");
  places.forEach((place) => stops.append(el("li", "", place.name)));
  const link = el("a", "route-navigation-link", "지도 앱으로 이동");
  link.href = routeDirectionsUrl(places);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const close = button("취소", "", {}, "route-navigation-close");
  delete close.dataset.action;
  close.textContent = "취소";
  close.addEventListener("click", () => document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "external-map" } })));
  dialog.append(stops, link, close);
  backdrop.append(dialog);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) document.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { detail: { overlayId: "external-map" } }));
  });
  return backdrop;
}

function candidateCard(data, place, index, state) {
  const selected = state?.selections?.replacementPlaceId
    ? state.selections.replacementPlaceId === place.id
    : index === 0;
  const card = el("article", `saved-candidate ${selected ? "is-selected" : ""}`);
  card.append(photo(data, place, "saved-candidate__photo", 1));
  const user = profileById(data, place.userId);
  const userRow = el("div", "saved-candidate__user");
  const avatar = el("img", "");
  if (user?.avatarUrl) avatar.src = user.avatarUrl;
  avatar.alt = "";
  const likeCount = el("span", "saved-candidate__like-count");
  likeCount.append(savedIcon("heart-count"), el("span", "", String(place.savedCount)));
  userRow.append(avatar, el("span", "", user?.handle || ""), likeCount);
  card.append(userRow);
  if (!selected) {
    const likeIndex = index - 1;
    const like = button(`${place.name} 좋아요`, "toggle-place-like", { placeId: place.id, measureKey: `status / like${likeIndex ? `#${likeIndex + 1}` : ""}` }, "saved-candidate__like");
    like.append(savedIcon("heart"));
    card.append(like);
  }
  card.append(el("h2", "", place.name), el("p", "", place.summary));
  const tagRow = el("div", "saved-candidate__tags"); selectTagsFor(data, place).slice(0, 2).forEach((tag) => tagRow.append(el("span", "", tag.name))); card.append(tagRow);
  const foot = el("div", "saved-candidate__foot");
  const walk = el("small", ""); walk.append(savedIcon("footprints-muted"), el("span", "", `도보 ${place.walkingMinutes}분`)); foot.append(walk);
  const replace = button(`${place.name}으로 교체`, "replace-place", { placeId: place.id, value: place.id, measureKey: `button${index ? `#${index + 1}` : ""}` }, "saved-candidate__replace"); replace.append(savedIcon("refresh"), el("span", "", "교체"));
  foot.append(replace); card.append(foot);
  if (selected) {
    const status = button(`${place.name} 선택됨`, "select-place", { placeId: place.id, measureKey: "status / selected" }, "saved-candidate__selected"); status.append(savedIcon("check")); card.append(status);
  }
  return card;
}

function renderReplace(state, data) {
  const current = placeFor(state, data);
  const screen = root("c7");
  if (!current) {
    screen.append(el("p", "saved-empty-state", "장소 정보를 찾을 수 없어요"));
    return screen;
  }
  const header = el("header", "saved-replace-header");
  const back = button("뒤로 가기", "go-back", { measureKey: "button / back" }, "saved-replace-back"); back.append(savedIcon("arrow-left"));
  const title = el("div", ""); title.append(el("h1", "", "비슷한 장소로 바꾸기"), el("p", "", `${current.name} 대신 갈 곳을 골라요`));
  header.append(back, title);
  const filters = el("div", "saved-replace-filters");
  const filterSpecs = [["음식점", "tag-restaurant", "saved:utensils"], ["도보 10분 안", "tag-walk-ten-minutes", "saved:footprints"], ["데이트", "tag-date", ""], ["감성적인", "tag-emotional", ""], ["저녁", "tag-evening", ""]];
  filterSpecs.forEach(([label, value, glyph], index) => filters.append(filterChip(label, value, state?.selections?.savedFilter === value || index < 2, `filter${index ? `#${index + 1}` : ""}`, glyph)));
  const excluded = el("div", "saved-replace-excluded");
  const excludedIcon = el("span", ""); excludedIcon.append(savedIcon("x"));
  excluded.append(excludedIcon, el("small", "", "기존 장소는 제외했어요"), el("strong", "", current.name));
  const routePlaceIds = new Set(routeFor(state, data)?.placeIds || []);
  const currentTags = new Set(current.tagIds || []);
  const candidates = data.places
    .filter((place) => place.id !== current.id && !routePlaceIds.has(place.id))
    .map((place, index) => ({
      place,
      index,
      sharedTagCount: (place.tagIds || []).filter((tagId) => currentTags.has(tagId)).length
    }))
    .sort((left, right) => right.sharedTagCount - left.sharedTagCount || left.index - right.index)
    .slice(0, 4)
    .map(({ place }) => place);
  const grid = el("div", "saved-candidate-grid"); candidates.forEach((place, index) => grid.append(candidateCard(data, place, index, state)));
  const footer = el("footer", "saved-replace-footer");
  footer.append(el("strong", "", `후보 ${data.places.length}곳`));
  const confirm = button("선택한 장소로 교체", "confirm-place-selection", { measureKey: "CTA" }, "saved-replace-confirm"); confirm.textContent = "선택한 장소로 교체"; footer.append(confirm);
  screen.append(header, filters, excluded, grid, footer);
  return screen;
}

export const SAVED_RENDERERS = Object.freeze({
  c1: renderPlaces,
  c2: renderRoutes,
  c3: renderFilters,
  c4: renderPlaceMap,
  c6: renderRouteDetail,
  c7: renderReplace
});
