import { MEDIA, PLACES, ROUTES, TAGS, USERS } from "../fixtures.js";

const NODE_IDS = Object.freeze({
  c1: "446:1787", c2: "446:1631", c3: "446:1223",
  c4: "446:1715", c6: "446:2394", c7: "446:1474"
});

const byId = (items, id) => items.find((item) => item.id === id);
const courseName = (route) => route.name.replaceAll("루트", "코스");
const routeFor = (state) => byId(ROUTES, state?.selections?.selectedRouteId) || ROUTES[0];
const placeFor = (state) => byId(PLACES, state?.selections?.selectedPlaceId) || PLACES[0];
const tagsFor = (item) => (item?.tagIds || []).map((id) => byId(TAGS, id)).filter(Boolean);
const mediaFor = (place, offset = 0) => byId(MEDIA, place?.mediaIds?.[offset]) || MEDIA[0];

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

function photo(place, className = "", offset = 0) {
  const image = el("img", className);
  const media = mediaFor(place, offset);
  image.src = media.src;
  image.alt = media.alt;
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

function selectedFilterTags(state) {
  return [
    byId(TAGS, state?.selections?.situation) || byId(TAGS, "tag-date"),
    byId(TAGS, state?.selections?.time) || byId(TAGS, "tag-afternoon"),
    byId(TAGS, state?.selections?.mood) || byId(TAGS, "tag-quiet")
  ];
}

function topFilters(state, count = 5) {
  const selected = selectedFilterTags(state);
  const current = state?.selections?.savedFilter;
  const specs = [
    ["연남·망원", "tag-yeonnam", "saved:map-pin"],
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

function compactTags(item, startIndex, limit = 2) {
  const wrap = el("div", "saved-inline-tags");
  tagsFor(item).slice(0, limit).forEach((tag, index) => {
    wrap.append(filterChip(tag.name, tag.id, false, `chip#${startIndex + index}`));
  });
  return wrap;
}

function recommendationCard(place, index) {
  const card = actionRegion(`${place.name} 상세`, "open-place", { placeId: place.id, measureKey: `recommend card${index ? `#${index + 1}` : ""}` }, "saved-recommend-card");
  card.append(photo(place, "saved-recommend-card__photo"));
  card.append(savedIcon("chevron-right", "saved-recommend-chevron"));
  card.append(el("strong", "", place.name), el("small", "", `${tagsFor(place)[0]?.name || "장소"} · ${230 + index * 150}m`));
  card.append(compactTags(place, 6 + index * 2));
  return card;
}

function placeRow(place, index) {
  const row = actionRegion(`${place.name} 상세`, "open-place", { placeId: place.id, measureKey: `list row${index ? `#${index + 1}` : ""}` }, "saved-place-row");
  row.append(photo(place, "saved-place-row__photo"));
  const copy = el("div", "saved-place-row__copy");
  copy.append(el("strong", "", place.name), el("small", "", `${tagsFor(place)[0]?.name || "장소"} · 도보 ${place.walkingMinutes}분`), compactTags(place, 12 + index * 2));
  const score = el("span", "saved-place-row__score", `적합도 ${92 - index * 4}`);
  const add = button(`${place.name} 코스에 추가`, "add-place-to-route", { placeId: place.id, measureKey: `icon / add route${index ? `#${index + 1}` : ""}` }, "saved-add-route");
  add.append(savedIcon("add-course"));
  row.append(copy, score, add);
  return row;
}

function renderPlaces(state) {
  const screen = root("c1");
  screen.append(el("div", "saved-map saved-map--overview"));
  const sheet = el("div", "saved-sheet saved-sheet--places");
  sheet.append(el("span", "saved-handle"), savedTabs("c1"), topFilters(state));
  const heading = el("div", "saved-section-heading");
  heading.append(el("h1", "", "오늘 어울리는 장소 추천"), el("small", "", "거리와 분위기가 맞는 장소예요"), el("span", "", "적합도순⌄"));
  sheet.append(heading);
  const recommends = el("div", "saved-recommendations");
  PLACES.slice(0, 3).forEach((place, index) => recommends.append(recommendationCard(place, index)));
  sheet.append(recommends);
  const list = el("div", "saved-place-list");
  [PLACES[0], PLACES[9], PLACES[7], PLACES[10], PLACES[6]].forEach((place, index) => list.append(placeRow(place, index)));
  sheet.append(list);
  screen.append(sheet);
  return screen;
}

function routeCard(route, index) {
  const card = el("article", "saved-route-card");
  const place = byId(PLACES, route.placeIds[0]);
  card.append(photo(place, "saved-route-card__photo", index % 3));
  const copy = el("div", "saved-route-card__copy");
  copy.append(el("strong", "", courseName(route)), el("p", "", route.placeIds.map((id) => byId(PLACES, id)?.name).filter(Boolean).join(" → ")), el("small", "", `${route.placeIds.length}곳 · 약 1시간 ${route.walkingMinutes}분 · 걷기 중심`));
  const tags = el("div", "saved-route-tags");
  tagsFor(route).forEach((tag) => tags.append(el("span", "", tag.name)));
  copy.append(tags);
  const actions = el("div", "saved-route-card__actions");
  const map = button(`${courseName(route)} 경로 보기`, "open-route-map", { routeId: route.id, measureKey: `button${index ? `#${index * 2 + 1}` : ""}` }, "saved-route-outline");
  map.textContent = "경로 보기";
  const detail = button(`${courseName(route)} 상세 보기`, "open-route", { routeId: route.id, measureKey: `button#${index * 2 + 2}` }, "saved-route-fill");
  detail.textContent = "상세 보기";
  actions.append(map, detail);
  copy.append(actions);
  card.append(copy, el("span", "saved-route-more", "⋮"));
  return card;
}

function renderRoutes(state) {
  const screen = root("c2");
  const map = el("div", "saved-map saved-map--routes");
  PLACES.slice(0, 6).forEach((place, index) => {
    const marker = el("span", "saved-map-marker");
    marker.style.setProperty("--marker-x", `${88 + (index % 3) * 98}px`);
    marker.style.setProperty("--marker-y", `${40 + Math.floor(index / 3) * 112}px`);
    marker.append(photo(place, "saved-map-marker__photo"), el("i", "", "●"));
    map.append(marker);
  });
  screen.append(map);
  const sheet = el("div", "saved-sheet saved-sheet--routes");
  const title = el("h1", "saved-visually-hidden", "저장한 코스");
  sheet.append(title, savedTabs("c2"), topFilters(state));
  const list = el("div", "saved-route-list");
  ROUTES.forEach((route, index) => list.append(routeCard(route, index)));
  sheet.append(list);
  screen.append(sheet);
  return screen;
}

const FILTER_GROUPS = Object.freeze([
  { title: "상황", action: "select-situation", key: "situation", tags: ["tag-date", "tag-friends", "tag-alone", "tag-family-group"] },
  { title: "시간", action: "select-time", key: "time", tags: ["tag-daytime", "tag-afternoon", "tag-evening", "tag-night"] },
  { title: "분위기", action: "select-mood", key: "mood", tags: ["tag-quiet", "tag-emotional", "tag-good-for-talking", "tag-sophisticated", "tag-bright", "tag-dark"] }
]);

function renderFilters(state) {
  const screen = root("c3");
  const sheet = el("div", "saved-filter-sheet");
  sheet.append(el("span", "saved-handle"), el("h1", "", "어떤 장소를 다시 볼까요?"), el("p", "saved-filter-sheet__lead", "저장한 장소를 지금 상황에 맞게 정리해드릴게요"));
  let sourceIndex = 0;
  for (const group of FILTER_GROUPS) {
    const fieldset = el("fieldset", "saved-filter-group");
    fieldset.append(el("legend", "", group.title));
    for (const tagId of group.tags) {
      const tag = byId(TAGS, tagId);
      const selected = state?.selections?.[group.key] === tagId || (!state?.selections?.[group.key] && ["tag-date", "tag-afternoon", "tag-quiet", "tag-emotional"].includes(tagId));
      const option = button(tag.name, group.action, { value: tag.id, measureKey: `button${sourceIndex ? `#${sourceIndex + 1}` : ""}` }, `saved-filter-option ${selected ? "is-selected" : ""}`);
      option.setAttribute("aria-pressed", String(selected));
      option.append(el("span", "saved-filter-option__glyph", tag.group === "time" ? "☼" : "♡"), el("span", "", tag.name));
      fieldset.append(option);
      sourceIndex += 1;
    }
    sheet.append(fieldset);
  }
  const summary = el("div", "saved-filter-summary");
  summary.append(el("strong", "", "추천 기준"));
  selectedFilterTags(state).concat(byId(TAGS, state?.selections?.mood) ? [] : [byId(TAGS, "tag-emotional")]).forEach((tag) => summary.append(el("span", "", tag.name)));
  const apply = button("저장 장소 다시 정렬하기", "apply-filters", { measureKey: "CTA" }, "saved-filter-apply");
  apply.textContent = "✣  저장 장소 다시 정렬하기";
  const reset = button("초기화", "reset-filters", { measureKey: "button#15" }, "saved-filter-reset");
  reset.textContent = "초기화";
  sheet.append(summary, apply, reset);
  screen.append(sheet);
  return screen;
}

function renderPlaceMap(state) {
  const place = placeFor(state);
  const screen = root("c4");
  const back = button("뒤로 가기", "go-back", { measureKey: "button / back floating" }, "saved-map-control saved-map-control--back");
  back.append(savedIcon("chevron-left"));
  const locate = button("내 위치 찾기", "locate-user", { measureKey: "button / locate floating" }, "saved-map-control saved-map-control--locate");
  locate.append(savedIcon("locate"));
  const toast = el("div", "saved-map-toast", "클립보드에 복사되었어요");
  const card = actionRegion(`${place.name} 장소 보기`, "open-place", { placeId: place.id, measureKey: "place card / selected saved place" }, "saved-map-place-card");
  card.append(photo(place, "saved-map-place-card__photo"));
  const copy = el("div", "saved-map-place-card__copy");
  copy.append(el("h1", "", place.name));
  const tagRow = el("div", "saved-inline-tags");
  tagsFor(place).slice(0, 2).forEach((tag) => tagRow.append(el("span", "saved-static-tag", tag.name)));
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

function visibleRoutePlaces(route, state) {
  const placeIds = state?.routePlaceIds?.length ? state.routePlaceIds : route.placeIds;
  const places = placeIds.map((id) => byId(PLACES, id)).filter(Boolean);
  const replacement = byId(PLACES, state?.selections?.replacementPlaceId);
  const selectedId = state?.selections?.selectedPlaceId;
  return replacement ? places.map((place) => place.id === selectedId ? replacement : place) : places;
}

function renderRouteDetail(state) {
  const route = routeFor(state);
  const places = visibleRoutePlaces(route, state);
  const heroPlace = places[0] || PLACES[0];
  const screen = root("c6");
  const hero = el("div", "saved-route-hero");
  const heroImage = photo(heroPlace, "saved-route-hero__photo", 1);
  heroImage.src = "/app-preview/assets/saved/c6-hero.png";
  hero.append(heroImage);
  const sheet = el("div", "saved-route-detail-sheet");
  sheet.append(el("span", "saved-handle"));
  const header = el("header", "saved-route-detail-header");
  const back = button("뒤로 가기", "go-back", { measureKey: "Icon / back sheet" }, "saved-route-detail-back"); back.append(icon("back"));
  const title = el("div", ""); title.append(el("h1", "", courseName(route)), el("small", "", `${places.length}곳 · 1시간 ${route.walkingMinutes}분 · 도보 ${Math.max(5, route.walkingMinutes - 32)}분`));
  const shareIcon = button("코스 공유하기", "open-share", { type: "route", id: route.id, measureKey: "Icon / share-2 / header" }, "saved-route-detail-share"); shareIcon.append(icon("share"));
  header.append(back, title, shareIcon);
  const actions = el("div", "saved-route-detail-actions");
  const navigate = button("길찾기", "start-navigation", { routeId: route.id, measureKey: "Button / navigate bg" }, "saved-route-detail-navigate"); navigate.textContent = "➤  길찾기";
  const share = button("공유하기", "open-share", { type: "route", id: route.id, measureKey: "Button / share bg" }, "saved-route-detail-share-button"); share.textContent = "⌯  공유하기";
  actions.append(navigate, share);
  const list = el("ol", "saved-route-stops");
  places.forEach((place, index) => {
    const item = el("li", "saved-route-stop");
    item.append(el("span", "saved-route-stop__number", String(index + 1)));
    const open = button(`${place.name} 장소 보기`, "open-place", { placeId: place.id, measureKey: `Place photo crop ${index + 1}` }, "saved-route-stop__photo-button");
    open.append(photo(place, "saved-route-stop__photo"));
    const copy = el("div", "saved-route-stop__copy");
    copy.append(el("strong", "", place.name), el("span", "saved-static-tag", tagsFor(place)[0]?.name || "장소"), el("small", "", `${tagsFor(place)[0]?.name || "장소"} · ${20 + index * 15}분`));
    const replace = button(`${place.name} 바꾸기`, "replace-route-place", { placeId: place.id, measureKey: `Change place bg ${index + 1}` }, "saved-route-stop__replace");
    replace.textContent = "↻";
    item.append(open, copy, replace, el("span", "saved-route-stop__chevron", "›"));
    list.append(item);
  });
  sheet.append(header, actions, list);
  screen.append(hero, sheet);
  return screen;
}

function candidateCard(place, index, state) {
  const selected = state?.selections?.replacementPlaceId
    ? state.selections.replacementPlaceId === place.id
    : index === 0;
  const card = el("article", `saved-candidate ${selected ? "is-selected" : ""}`);
  card.append(photo(place, "saved-candidate__photo", 1));
  const user = byId(USERS, place.userId) || USERS[0];
  const userRow = el("div", "saved-candidate__user");
  const avatar = el("img", ""); avatar.src = user.avatarUrl; avatar.alt = "";
  const likeCount = el("span", "saved-candidate__like-count");
  likeCount.append(savedIcon("heart-count"), el("span", "", String(place.savedCount)));
  userRow.append(avatar, el("span", "", user.handle), likeCount);
  card.append(userRow);
  if (!selected) {
    const likeIndex = index - 1;
    const like = button(`${place.name} 좋아요`, "toggle-place-like", { placeId: place.id, measureKey: `status / like${likeIndex ? `#${likeIndex + 1}` : ""}` }, "saved-candidate__like");
    like.append(savedIcon("heart"));
    card.append(like);
  }
  card.append(el("h2", "", place.name), el("p", "", place.summary));
  const tagRow = el("div", "saved-candidate__tags"); tagsFor(place).slice(0, 2).forEach((tag) => tagRow.append(el("span", "", tag.name))); card.append(tagRow);
  const foot = el("div", "saved-candidate__foot");
  const walk = el("small", ""); walk.append(savedIcon("footprints-muted"), el("span", "", `도보 ${place.walkingMinutes}분`)); foot.append(walk);
  const replace = button(`${place.name}으로 교체`, "replace-place", { placeId: place.id, value: place.id, measureKey: `button${index ? `#${index + 1}` : ""}` }, "saved-candidate__replace"); replace.append(savedIcon("refresh"), el("span", "", "교체"));
  foot.append(replace); card.append(foot);
  if (selected) {
    const status = button(`${place.name} 선택됨`, "select-place", { placeId: place.id, measureKey: "status / selected" }, "saved-candidate__selected"); status.append(savedIcon("check")); card.append(status);
  }
  return card;
}

function renderReplace(state) {
  const current = placeFor(state);
  const screen = root("c7");
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
  const candidates = [PLACES[3], PLACES[1], PLACES[2], PLACES[4]];
  const grid = el("div", "saved-candidate-grid"); candidates.forEach((place, index) => grid.append(candidateCard(place, index, state)));
  const footer = el("footer", "saved-replace-footer");
  footer.append(el("strong", "", `후보 ${PLACES.length}곳`));
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
