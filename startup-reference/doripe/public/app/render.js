import { CONFIG } from "./config.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function firstImage(place) {
  return place?.images?.[0] || place?.coverImageUrl || "/app/assets/figma-place-photo-34.jpg";
}

function imageLoader(src, alt, options = {}) {
  const shellClass = options.shellClass || "";
  const imageClass = options.imageClass || "";
  const loading = options.loading || "lazy";
  const fetchPriority = options.fetchPriority ? ` fetchpriority="${esc(options.fetchPriority)}"` : "";
  const imageStyle = options.imageStyle ? ` style="${esc(options.imageStyle)}"` : "";
  return `
    <span class="image-loader-shell ${shellClass}" data-image-host="true">
      <span class="image-skeleton" aria-hidden="true"></span>
      <img class="${imageClass} loadable-image" src="${esc(src)}" alt="${esc(alt)}" decoding="async" loading="${esc(loading)}"${fetchPriority}${imageStyle} data-loadable-image="true" />
    </span>
  `;
}

function imageCropStyle(crop) {
  if (!crop) return "";
  const x = Number.isFinite(Number(crop.x)) ? Math.min(100, Math.max(0, Number(crop.x))) : 50;
  const y = Number.isFinite(Number(crop.y)) ? Math.min(100, Math.max(0, Number(crop.y))) : 50;
  const zoom = Number.isFinite(Number(crop.zoom)) ? Math.min(3, Math.max(1, Number(crop.zoom))) : 1;
  return `object-position:${x}% ${y}%;transform:scale(${zoom});`;
}

const CREATORS = [
  {
    id: "dori",
    name: "도리",
    title: "공식 크리에이터",
    avatar: "/app/assets/creator-photos/creator-04.png"
  },
  {
    id: "sua",
    name: "수아",
    title: "연남 큐레이터",
    avatar: "/app/assets/creator-photos/creator-01.png"
  },
  {
    id: "jian",
    name: "지안",
    title: "취향 기록자",
    avatar: "/app/assets/creator-photos/creator-02.png"
  },
  {
    id: "rio",
    name: "리오",
    title: "동네 수집가",
    avatar: "/app/assets/creator-photos/creator-03.png"
  }
];

function hashString(value) {
  return String(value || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function creatorForPlace(place) {
  const explicit = place?.creatorId ? CREATORS.find((creator) => creator.id === place.creatorId) : null;
  if (explicit) return explicit;
  return CREATORS[hashString(place?.id || place?.name) % CREATORS.length];
}

function tagsFor(place, options = {}) {
  const moodLimit = Number.isFinite(options.moodLimit) ? options.moodLimit : 2;
  const totalLimit = Number.isFinite(options.totalLimit) ? options.totalLimit : 4;
  const category = place?.categoryName ? [{ label: place.categoryName, kind: "type" }] : [];
  const moods = (place?.moodTags || []).slice(0, moodLimit).map((label) => ({ label, kind: "mood" }));
  const situations = (place?.bestFor || []).slice(0, 1).map((label) => ({ label, kind: "situation" }));
  return [...category, ...moods, ...situations].slice(0, totalLimit);
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function safeExternalUrl(value) {
  const url = String(value ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function representativeMenuText(place) {
  const name = String(place?.representativeMenuName ?? "").trim();
  const price = String(place?.representativeMenuPrice ?? "").trim();
  if (name && price) return `${name} · ${price}`;
  return name || price;
}

function detailRowsFor(place) {
  const rows = [
    ["주소", place.address || place.subArea],
    ["가까운 역", place.nearestStation],
    ["영업시간", place.hoursText],
    ["대표 메뉴", representativeMenuText(place)],
    ["메뉴 힌트", place.priceHint],
    ["연락처", place.phoneText],
    ["추천 체류", place.stayTimeMinutes ? `${place.stayTimeMinutes}분 정도` : ""]
  ];
  return rows.filter(([, value]) => hasText(value));
}

function renderDetailRows(place) {
  const rows = detailRowsFor(place);
  if (!rows.length) return "";
  return `
    <div class="detail-info-list">
      ${rows.map(([label, value]) => `
        <div class="info-row">
          <strong>${esc(label)}</strong>
          <span>${esc(value)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDetailLinks(place) {
  const links = [
    ["네이버 지도", safeExternalUrl(place.naverPlaceUrl)],
    ["인스타그램", safeExternalUrl(place.instagramUrl)]
  ].filter(([, url]) => url);

  if (!links.length) return "";
  return `
    <div class="detail-link-row" aria-label="장소 외부 링크">
      ${links.map(([label, url]) => `
        <button class="detail-link-button" data-action="open-external" data-url="${esc(url)}">${esc(label)}</button>
      `).join("")}
    </div>
  `;
}

function renderDetailMap(place) {
  if (!place?.mapPreviewUrl) return "";
  return `
    <button class="detail-map-preview" data-action="open-map" data-place-id="${esc(place.id)}" aria-label="${esc(place.name)} 네이버 지도에서 보기">
      ${imageLoader(place.mapPreviewUrl, `${place.name} 지도`, { shellClass: "detail-map-image-shell", imageClass: "detail-map-image" })}
      <span class="detail-map-caption">
        <strong>지도 위치</strong>
        <em>네이버 지도에서 보기</em>
      </span>
    </button>
  `;
}

function bottomNav(active) {
  const items = [
    ["discover", "발견"],
    ["saved", "저장"],
    ["route", "루트"],
    ["my", "MY"]
  ];
  return `
    <nav class="bottom-nav" aria-label="하단 탭">
      ${items.map(([id, label]) => `
        <button class="nav-item ${active === id ? "is-active" : ""}" data-action="set-tab" data-tab="${id}">
          ${label}
        </button>
      `).join("")}
    </nav>
  `;
}

function regionSelector() {
  return `
    <button class="region-selector" data-action="open-region">
      <span class="mini-pin" aria-hidden="true"></span>
      <span>${CONFIG.activeNeighborhoodLabel}</span>
      <span class="chevron" aria-hidden="true">⌄</span>
    </button>
  `;
}

function statusBar() {
  return "";
}

function discoverControls(counter = "") {
  return `
    <div class="discover-controls">
      ${regionSelector()}
      ${counter ? `<span class="counter-pill">${esc(counter)}</span>` : ""}
    </div>
  `;
}

function stepProgress(activeStep) {
  return `
    <div class="step-progress" aria-hidden="true">
      ${[1, 2, 3].map((step) => `<span class="${step <= activeStep ? "is-active" : ""}"></span>`).join("")}
    </div>
  `;
}

function alertParts(message) {
  const text = String(message ?? "").trim();
  if (!text) return null;
  if (text === CONFIG.disabledNeighborhoodMessage) {
    return {
      title: "아직 준비 중인 동네예요.",
      copy: "지금은 연남·망원만 둘러볼 수 있어요."
    };
  }
  return { title: text, copy: "" };
}

function topAlert(message) {
  const parts = alertParts(message);
  if (!parts) return "";
  return `
    <div class="top-alert" role="status">
      <span class="alert-icon" aria-hidden="true">!</span>
      <span>
        <span class="alert-title">${esc(parts.title)}</span>
        ${parts.copy ? `<span class="alert-copy">${esc(parts.copy)}</span>` : ""}
      </span>
    </div>
  `;
}

function sharePopover() {
  return `
    <div class="share-popover" role="dialog" aria-label="공유 옵션">
      <button class="share-option share-copy-option" data-action="copy-share">복사</button>
      <button class="share-option share-native-option" data-action="native-share" aria-label="공유"></button>
      <button class="share-option share-close-option" data-action="close-share" aria-label="닫기">×</button>
    </div>
  `;
}

function screenHeader(title, subtitle, options = {}) {
  return `
    ${options.status === false ? "" : statusBar()}
    <h1 class="screen-title">${esc(title)}</h1>
    <p class="screen-subtitle">${esc(subtitle)}</p>
    ${options.region === false ? "" : `<div class="page-region">${regionSelector()}</div>`}
    ${options.counter ? `<span class="page-counter">${esc(options.counter)}</span>` : ""}
  `;
}

function renderWelcome() {
  return `
    <section class="screen screen-welcome">
      <div class="welcome-mark" aria-hidden="true"></div>
      <h1 class="welcome-title">Doripe</h1>
      <p class="welcome-copy">취향에 맞는 동네 장소를 가볍게 넘겨보세요.</p>
      <button class="primary-cta welcome-start" data-action="start-welcome">시작하기</button>
    </section>
  `;
}

function renderOnboardingQuestion(model, config) {
  const value = model.state.onboardingAnswers?.[config.field] || "";
  const disabled = !value;
  return `
    <section class="screen screen-onboarding screen-onboarding-${esc(config.field)}">
      ${config.back === false ? "" : `<button class="onboarding-back" data-action="onboarding-back" aria-label="뒤로가기">‹</button>`}
      <div class="step-pill">질문 ${config.step}/3</div>
      ${stepProgress(config.step)}
      <h1 class="screen-title">${config.title}</h1>
      <p class="screen-subtitle">${esc(config.subtitle)}</p>
      <div class="onboarding-options">
        ${config.options.map((option) => `
          <button class="onboarding-option ${value === option ? "is-selected" : ""}" data-action="select-onboarding-option" data-field="${esc(config.field)}" data-value="${esc(option)}">
            <span>${esc(option)}</span>
            ${value === option ? `<em aria-hidden="true">✓</em>` : ""}
          </button>
        `).join("")}
      </div>
      <button class="primary-cta region-start" data-action="onboarding-next" ${disabled ? "disabled" : ""}>${esc(config.cta)}</button>
    </section>
  `;
}

export function visibleDiscoverPlaces(places, state) {
  const hidden = new Set([...(state.savedPlaceIds || []), ...(state.skippedPlaceIds || [])]);
  const visibleTags = new Set((places || []).flatMap((place) => [
    place.categoryName,
    ...(place.bestFor || [])
  ]).filter(Boolean));
  const selectedTags = new Set((state.selectedTags || []).filter((tag) => visibleTags.has(tag)));
  return (places || [])
    .filter((place) => !hidden.has(place.id))
    .filter((place) => {
      if (!selectedTags.size) return true;
      const placeTags = [
        place.categoryName,
        ...(place.bestFor || [])
      ].filter(Boolean);
      return placeTags.some((tag) => selectedTags.has(tag));
    });
}

export function currentDiscoverPlace(places, state) {
  const visible = visibleDiscoverPlaces(places, state);
  if (!visible.length) return null;
  return visible[Math.min(state.currentIndex || 0, visible.length - 1)];
}

function renderRegion(model) {
  const neighborhoods = [
    { id: "yeonnam", label: "연남", enabled: true },
    { id: "seongsu", label: "성수", enabled: false },
    { id: "yongsan-huam-haebangchon", label: "용산·해방촌", enabled: false }
  ];
  return `
    <section class="screen screen-region">
      <button class="onboarding-back" data-action="onboarding-back" aria-label="뒤로가기">‹</button>
      <div class="step-pill">질문 3/3</div>
      ${stepProgress(3)}
      <h1 class="screen-title">처음 둘러볼<br />동네를 골라주세요</h1>
      <p class="screen-subtitle">마지막으로 첫 피드를 볼 동네를 골라주세요.</p>
      <div class="region-map" aria-label="서울 동네 선택">
        ${neighborhoods.map((item) => `
          <button class="region-pin ${item.enabled ? "is-enabled" : "is-disabled"}" data-action="select-neighborhood" data-neighborhood-id="${esc(item.id)}" data-enabled="${item.enabled ? "true" : "false"}" data-label="${esc(item.label)}">
            <span class="pin-head" aria-hidden="true"></span>
            <span class="pin-label">${esc(item.label)}</span>
          </button>
        `).join("")}
      </div>
      <div class="selected-region-panel">
        <span class="selected-dot" aria-hidden="true"></span>
        <span>연남부터 둘러볼게요</span>
      </div>
      <button class="primary-cta region-start" data-action="start-yeonnam">연남으로 시작하기</button>
    </section>
  `;
}

function renderTransition() {
  return `
    <section class="screen screen-travel">
      <div class="travel-card">
        <img class="plane-icon" src="/app/assets/figma-current/c1a-plane.svg" alt="" aria-hidden="true" />
        <img class="runway-line" src="/app/assets/figma-current/c1a-runway.svg" alt="" aria-hidden="true" />
        <div class="destination-pill"><span class="mini-pin" aria-hidden="true"></span><strong>${esc(CONFIG.activeNeighborhoodLabel)}</strong></div>
      </div>
      <h1 class="travel-title">${esc(CONFIG.activeNeighborhoodLabel)}로 떠나는 중</h1>
      <p class="travel-subtitle">동네 분위기에 맞는 장소카드를 준비하고 있어요.</p>
      <div class="travel-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </section>
  `;
}

function renderTagSetup(model) {
  const tagGroups = tagGroupsFor(model);
  const selected = new Set(model.state.selectedTags || []);
  const hasType = tagGroups.type.some((tag) => selected.has(tag));
  const hasSituation = tagGroups.situation.some((tag) => selected.has(tag));
  const canApply = hasType && hasSituation;
  return `
    <section class="screen screen-tag-setup">
      ${statusBar()}
      ${discoverControls()}
      <div class="white-sheet tag-sheet">
        <h1 class="detail-title">오늘은 어디를<br />발견해볼까요?</h1>
        <p class="screen-subtitle" style="margin-top:12px;">끌리는 태그를 골라주시면 장소카드를 더 잘 맞춰볼게요.</p>
        <div class="tag-section">
          <div class="tag-section-title">장소 유형</div>
          <div class="tag-picker">${tagGroups.type.map((label) => tagButton(label, selected, "type")).join("")}</div>
        </div>
        <div class="tag-section tag-section-situation">
          <div class="tag-section-title">상황</div>
          <div class="tag-picker">${tagGroups.situation.map((label) => tagButton(label, selected, "situation")).join("")}</div>
        </div>
        <button class="tag-apply" data-action="apply-tags" ${canApply ? "" : "disabled"}>장소카드 보기</button>
      </div>
      ${bottomNav("discover")}
    </section>
  `;
}

function uniqueLabels(labels, fallback, options = {}) {
  const hidden = new Set(options.hidden || []);
  const unique = Array.from(new Set(labels
    .filter(Boolean)
    .map((label) => String(label).trim())
    .filter((label) => label && !hidden.has(label))));
  return unique.length ? unique : fallback;
}

function tagGroupsFor(model) {
  const places = model.data.places || [];
  return {
    type: uniqueLabels(
      [
        ...(model.data.categories || []).map((category) => category.name),
        ...places.map((place) => place.categoryName)
      ],
      ["카페", "디저트", "음식점", "술/bar", "전시/문화", "쇼핑/체험", "거리/산책"],
      { hidden: ["미분류"] }
    ),
    mood: uniqueLabels(
      places.flatMap((place) => place.moodTags || []),
      ["조용한", "감각적인", "따뜻한", "힙한", "차분한"]
    ),
    situation: uniqueLabels(
      places.flatMap((place) => place.bestFor || []),
      ["혼자", "데이트", "친구와"]
    )
  };
}

function tagButton(label, selected, kind) {
  return `<button class="tag-button ${kind} ${selected.has(label) ? "is-selected" : ""}" data-action="toggle-tag" data-kind="${esc(kind)}" data-tag="${esc(label)}">${esc(label)}</button>`;
}

function selectedFilterSet(model, kind) {
  return new Set(model.state.savedFilters?.[kind] || []);
}

function filterChip(label, selected, kind) {
  return `
    <button class="tag-button ${kind} ${selected.has(label) ? "is-selected" : ""}" data-action="toggle-saved-filter" data-kind="${esc(kind)}" data-tag="${esc(label)}">
      ${esc(label)}
    </button>
  `;
}

function renderFilterSheet(model, scope = "saved") {
  const groups = tagGroupsFor(model);
  const action = scope === "route" ? "apply-route-filter" : "apply-saved-filter";
  return `
    <div class="overlay-scrim" data-action="${scope === "route" ? "close-route-filter" : "close-saved-filter"}"></div>
    <div class="filter-sheet" role="dialog" aria-label="${scope === "route" ? "루트 후보 필터" : "저장함 필터"}">
      <h2 class="filter-title">필터</h2>
      <button class="filter-reset" data-action="reset-saved-filter">초기화</button>
      <section class="filter-section">
        <h3>장소 유형</h3>
        <div class="tag-picker">${groups.type.map((label) => filterChip(label, selectedFilterSet(model, "type"), "type")).join("")}</div>
      </section>
      <section class="filter-section">
        <h3>분위기</h3>
        <div class="tag-picker">${groups.mood.map((label) => filterChip(label, selectedFilterSet(model, "mood"), "mood")).join("")}</div>
      </section>
      <section class="filter-section">
        <h3>상황</h3>
        <div class="tag-picker">${groups.situation.map((label) => filterChip(label, selectedFilterSet(model, "situation"), "situation")).join("")}</div>
      </section>
      <button class="filter-apply" data-action="${action}">필터 적용하기</button>
    </div>
  `;
}

function matchesSavedFilters(place, filters = {}) {
  const type = new Set(filters.type || []);
  const mood = new Set(filters.mood || []);
  const situation = new Set(filters.situation || []);
  const placeMood = new Set(place.moodTags || []);
  const placeSituation = new Set(place.bestFor || []);
  if (type.size && !type.has(place.categoryName)) return false;
  if (mood.size && !Array.from(mood).some((tag) => placeMood.has(tag))) return false;
  if (situation.size && !Array.from(situation).some((tag) => placeSituation.has(tag))) return false;
  return true;
}

function routeCandidatePlaces(model) {
  const savedIds = new Set(model.state.savedPlaceIds || []);
  return model.data.places.filter((place) => savedIds.has(place.id));
}

function categoryLabel(place) {
  return place?.categoryName || "미분류";
}

function groupRoutePlaces(places) {
  const groups = [];
  const groupMap = new Map();
  places.forEach((place) => {
    const label = categoryLabel(place);
    if (!groupMap.has(label)) {
      const group = { label, places: [] };
      groupMap.set(label, group);
      groups.push(group);
    }
    groupMap.get(label).places.push(place);
  });
  return groups;
}

function orderedRouteGroups(groups, expandedType) {
  if (!expandedType) return groups;
  const selected = groups.find((group) => group.label === expandedType);
  if (!selected) return groups;
  return [selected, ...groups.filter((group) => group.label !== expandedType)];
}

function routeSelectedPlaces(model, candidates) {
  const selected = new Set(model.state.routePlaceIds || []);
  return candidates.filter((place) => selected.has(place.id));
}

function routeTypeCounts(places) {
  return places.reduce((acc, place) => {
    const label = categoryLabel(place);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function compactRouteTypeLabel(label) {
  if (!label) return "";
  const [firstPart] = String(label).split("/");
  if (firstPart.length <= 3) return firstPart;
  return firstPart.slice(0, 3);
}

function routeRequiredTypes(model, candidates) {
  const candidateTypes = new Set(candidates.map(categoryLabel));
  const selectedSetupTypes = (model.state.selectedTags || []).filter((tag) => candidateTypes.has(tag));
  if (selectedSetupTypes.length) return selectedSetupTypes;
  return Array.from(candidateTypes).slice(0, Math.min(2, candidateTypes.size));
}

function canCreateRoute(model, candidates) {
  const selectedPlaces = routeSelectedPlaces(model, candidates);
  return selectedPlaces.length >= 2 && selectedPlaces.length <= 4;
}

function routeSummary(model, candidates) {
  const selectedPlaces = routeSelectedPlaces(model, candidates);
  const counts = Object.entries(routeTypeCounts(selectedPlaces));
  return { selectedPlaces, counts };
}

function routeSummaryPreview(model, candidates, selectedPlaces) {
  const counts = routeTypeCounts(selectedPlaces);
  const selectedLabels = Object.keys(counts);
  const labels = selectedLabels.length
    ? selectedLabels
    : [
      ...(model.data.categories || []).map((category) => category.name),
      ...candidates.map(categoryLabel)
    ].filter(Boolean);
  const uniqueLabels = Array.from(new Set(labels));
  const preferred = ["카페", "샵", "식당"];
  const ordered = [
    ...preferred.filter((label) => uniqueLabels.includes(label)),
    ...uniqueLabels.filter((label) => !preferred.includes(label))
  ];
  return ordered.slice(0, 3).map((label) => [label, counts[label] || 0]);
}

function renderRegionPicker(model) {
  const neighborhoods = [
    { id: "seongsu", label: "성수", sub: "카페 30 · 식당 30", enabled: false },
    { id: "yongsan-huam-haebangchon", label: "용산 · 해방촌", sub: "카페 30 · 식당 30", enabled: false },
    { id: "yeonnam", label: "연남 · 망원", sub: "카페 30 · 식당 30", enabled: true }
  ];
  const selectedId = model.state.selectedNeighborhoodId || CONFIG.activeNeighborhoodId;
  return `
    <div class="overlay-scrim region-transparent-scrim" data-action="close-region-picker"></div>
    <div class="region-popover" role="dialog" aria-label="동네 바꾸기">
      <h2>동네 바꾸기</h2>
      ${neighborhoods.map((item) => `
        <button class="region-popover-option ${item.id === selectedId ? "is-selected" : ""}" data-action="select-neighborhood" data-neighborhood-id="${esc(item.id)}" data-enabled="${item.enabled ? "true" : "false"}" data-label="${esc(item.label)}">
          <strong>${esc(item.label)}</strong>
          <span>${esc(item.sub)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderPlaceCard(place, state, options = {}) {
  const images = place.images?.length ? place.images : [firstImage(place)];
  const index = Math.min(state.currentPhotoIndex || 0, images.length - 1);
  const imageStyle = imageCropStyle(place.imageCrops?.[index]);
  const photoDirection = state.photoDirection ? `photo-${state.photoDirection}` : "";
  const gestureAttrs = options.detail || options.disableGesture ? "" : `data-gesture-card="true" data-place-id="${esc(place.id)}"`;
  const directPhotoActions = options.detail || options.disableGesture;
  const previousPhotoAttr = directPhotoActions ? `data-action="previous-photo"` : `data-photo-action="previous-photo"`;
  const nextPhotoAttr = directPhotoActions ? `data-action="next-photo"` : `data-photo-action="next-photo"`;
  const skipAction = options.selectedActions ? `data-action="skip-place" data-place-id="${esc(place.id)}"` : `data-action="skip-current"`;
  const saveAction = options.selectedActions ? `data-action="save-place" data-place-id="${esc(place.id)}"` : `data-action="save-current"`;
  const creator = creatorForPlace(place);
  const dotWidth = images.length > 1 ? 18 + ((images.length - 1) * 6) + ((images.length - 1) * 8) : 18;
  const cardStateClass = index > 0 ? "is-photo-secondary" : "is-photo-primary";
  const visibleTags = options.detail ? tagsFor(place) : tagsFor(place, { moodLimit: 1, totalLimit: 3 });
  return `
    <article class="place-card ${options.detail ? "is-detail" : ""} ${cardStateClass} ${photoDirection}" ${gestureAttrs}>
      ${imageLoader(images[index], `${place.name} 사진`, { shellClass: "place-image-shell", imageClass: "place-image", loading: "eager", fetchPriority: "high", imageStyle })}
      <div class="photo-dots" style="left:${(393 - dotWidth) / 2}px;width:${dotWidth}px;" aria-label="사진 ${index + 1}/${images.length}">
        ${images.map((_, dotIndex) => `<span class="photo-dot ${dotIndex === index ? "is-active" : ""}"></span>`).join("")}
      </div>
      <button class="photo-tap-zone left" ${previousPhotoAttr} aria-label="이전 사진"></button>
      <button class="photo-tap-zone right" ${nextPhotoAttr} aria-label="다음 사진"></button>
      <div class="creator-badge" style="--creator-avatar: url('${esc(creator.avatar)}');">
        <span class="creator-avatar"></span>
        <strong>${esc(creator.name)}</strong>
        <em aria-hidden="true">✓</em>
        <small>${esc(creator.title)}</small>
      </div>
      <div class="place-info">
        <button class="card-action info" data-action="open-detail" data-place-id="${esc(place.id)}" aria-label="상세 정보">
          <img src="/app/assets/figma-info.svg" alt="" />
        </button>
        <div class="tag-row">
          ${visibleTags.map((tag) => `<span class="tag-chip ${tag.kind === "mood" ? "mood" : tag.kind === "situation" ? "situation" : ""}">${esc(tag.label)}</span>`).join("")}
        </div>
        <h2 class="place-title">${esc(place.name)}</h2>
        <p class="place-copy">${esc(place.shortCopy || place.address || "연남에서 발견한 장소")}</p>
        <button class="card-action skip" ${skipAction} aria-label="넘기기">
          <img src="/app/assets/figma-x.svg" alt="" />
        </button>
        <button class="card-action heart" ${saveAction} aria-label="저장">
          <img src="/app/assets/figma-heart.svg" alt="" />
        </button>
      </div>
    </article>
  `;
}

function renderDiscover(model) {
  const place = currentDiscoverPlace(model.data.places, model.state);
  if (model.state.cardActionCount >= model.cardActionLimit) return renderLimit(model);
  if (!place) return renderComplete(model);
  const showTutorial = !model.state.discoverTutorialSeen && (model.state.cardActionCount || 0) === 0;
  return `
    <section class="screen screen-discover">
      ${statusBar()}
      ${discoverControls()}
      ${renderPlaceCard(place, model.state)}
      ${showTutorial ? renderDiscoverTutorial() : ""}
      ${bottomNav("discover")}
    </section>
  `;
}

function renderSharedPlace(model) {
  const place = model.data.places.find((item) => item.id === model.state.selectedPlaceId);
  if (!place) return renderEmpty("장소를 찾을 수 없어요", "공유된 장소가 삭제되었거나 아직 준비되지 않았어요.", "discover");
  return `
    <section class="screen screen-discover screen-shared-place">
      ${statusBar()}
      ${discoverControls()}
      ${renderPlaceCard(place, model.state, { disableGesture: true, selectedActions: true })}
      ${bottomNav("discover")}
    </section>
  `;
}

function renderDiscoverTutorial() {
  return `
    <button class="discover-tutorial" data-action="dismiss-discover-tutorial" data-reason="tap" aria-label="장소카드 튜토리얼 닫기">
      <span class="tutorial-side tutorial-side-left" aria-hidden="true">
        <strong>← 왼쪽</strong>
        <small>스킵</small>
      </span>
      <span class="tutorial-side tutorial-side-right" aria-hidden="true">
        <strong>오른쪽 →</strong>
        <small>저장</small>
      </span>
      <span class="tutorial-demo-card" aria-hidden="true">
        <span class="tutorial-demo-photo"></span>
        <span class="tutorial-demo-info"></span>
      </span>
      <span class="tutorial-copy">
        <strong>카드를 넘겨보세요</strong>
        <span>오른쪽은 저장, 왼쪽은 스킵</span>
        <em>화면을 탭하면 바로 시작해요</em>
      </span>
    </button>
  `;
}

function renderComplete(model) {
  return `
    <section class="screen screen-complete">
      <div class="complete-hero" aria-hidden="true">
        <img class="complete-halo" src="/app/assets/figma-current/d7-halo.svg" alt="" />
        <img class="complete-badge-image" src="/app/assets/figma-current/d7-check.svg" alt="" />
      </div>
      <h1 class="complete-title">${esc(CONFIG.activeNeighborhoodLabel)} 장소를<br />모두 봤어요</h1>
      <p class="complete-subtitle">저장한 장소 중에서<br />오늘 갈 후보를 골라볼 수 있어요.</p>
      <button class="primary-cta complete-main-action" data-action="open-route-candidates">후보 고르기</button>
      ${bottomNav("discover")}
    </section>
  `;
}

function renderLimit(model) {
  return `
    <section class="screen screen-complete screen-limit">
      <div class="complete-hero" aria-hidden="true">
        <img class="complete-halo" src="/app/assets/figma-current/d8-halo.svg" alt="" />
        <img class="complete-badge-image" src="/app/assets/figma-current/d8-check.svg" alt="" />
      </div>
      <h1 class="complete-title">오늘 볼 수 있는 카드는<br />여기까지예요</h1>
      <p class="complete-subtitle">내일 이어서 볼 수 있어요!</p>
      <button class="primary-cta complete-main-action" data-action="set-tab" data-tab="saved">저장함 보기</button>
      ${bottomNav("discover")}
    </section>
  `;
}

function renderDetail(model, fromSaved = false) {
  const place = model.data.places.find((item) => item.id === model.state.selectedPlaceId) || currentDiscoverPlace(model.data.places, model.state);
  if (!place) return renderEmpty("장소를 찾을 수 없어요", "다시 장소카드를 열어주세요.", model.state.tab);
  return `
    <section class="screen ${fromSaved ? "screen-saved-detail" : "screen-discover-detail"}">
      ${fromSaved
        ? screenHeader("저장함", "저장한 장소와 루트를 한 곳에서 볼 수 있어요.", { counter: "" })
        : `${statusBar()}${discoverControls()}`}
      <div class="detail-sheet ${fromSaved ? "saved-detail-sheet" : "discover-detail-sheet"}">
        <button class="close-button" data-action="${fromSaved ? "set-tab" : "back-discover"}" data-tab="${fromSaved ? "saved" : ""}" aria-label="닫기">×</button>
        ${fromSaved ? `<button class="detail-share-button" data-action="share-place" data-place-id="${esc(place.id)}" aria-label="공유"></button>` : ""}
        <h1 class="detail-title">${esc(place.name)}</h1>
        <div class="tag-row" style="margin-top:14px;">${tagsFor(place).map((tag) => `<span class="tag-chip ${tag.kind === "mood" ? "mood" : tag.kind === "situation" ? "situation" : ""}">${esc(tag.label)}</span>`).join("")}</div>
        <p class="place-copy">${esc(place.shortCopy || "연남에서 발견한 장소")}</p>
        ${renderDetailMap(place)}
        ${hasText(place.editorialNote) ? `<p class="detail-editorial-note">${esc(place.editorialNote)}</p>` : ""}
        ${renderDetailRows(place)}
        ${renderDetailLinks(place)}
      </div>
      ${bottomNav(model.state.tab || "discover")}
    </section>
  `;
}

function renderSaved(model) {
  const rawSaved = model.data.places.filter((place) => model.state.savedPlaceIds.includes(place.id));
  const saved = rawSaved.filter((place) => matchesSavedFilters(place, model.state.savedFilters));
  if (!saved.length) {
    const filteredEmpty = rawSaved.length > 0;
    return `
      <section class="screen screen-saved ${filteredEmpty ? "screen-saved-filter-empty" : "screen-saved-empty"}">
        ${screenHeader("저장함", "저장한 장소와 루트를 한 곳에서 볼 수 있어요.", { counter: "" })}
        <div class="saved-segment"><button class="is-active">장소</button><button data-action="set-tab" data-tab="route">루트</button></div>
        <button class="saved-filter" data-action="open-saved-filter">필터</button>
        <div class="empty-state">
          <div class="empty-icon">×</div>
          <h2 class="place-title">${filteredEmpty ? "조건에 맞는 장소가 없어요" : "저장한 장소가 없어요"}</h2>
          <p class="place-copy">${filteredEmpty ? "필터를 초기화하거나 다른 조건으로 다시 골라보세요." : "발견 탭에서 하트를 누르면 여기에 저장돼요."}</p>
          ${filteredEmpty ? `<button class="empty-reset-filter" data-action="reset-saved-filter">필터 초기화</button>` : `<button class="empty-reset-filter" data-action="set-tab" data-tab="discover">장소 발견하기</button>`}
        </div>
        ${bottomNav("saved")}
      </section>
    `;
  }
  return `
    <section class="screen screen-saved">
      ${screenHeader("저장함", "저장한 장소와 루트를 한 곳에서 볼 수 있어요.", { counter: "" })}
      <div class="saved-segment"><button class="is-active">장소</button><button data-action="set-tab" data-tab="route">루트</button></div>
      <button class="saved-filter" data-action="open-saved-filter">필터</button>
      <div class="saved-grid">
        ${saved.map((place) => `
          <button class="saved-card" data-action="open-saved-detail" data-long-press-action="open-saved-delete" data-place-id="${esc(place.id)}">
            ${imageLoader(firstImage(place), place.name, { shellClass: "saved-image-shell", imageClass: "saved-image" })}
            <span class="saved-card-title">${esc(place.name)}</span>
          </button>
        `).join("")}
      </div>
      ${bottomNav("saved")}
    </section>
  `;
}

function renderSavedDelete(model) {
  const saved = model.data.places.filter((place) => model.state.savedPlaceIds.includes(place.id));
  const selected = new Set(model.state.deletePlaceIds || []);
  return `
    <section class="screen screen-saved screen-saved-delete">
      ${screenHeader("저장함", "저장한 장소와 루트를 한 곳에서 볼 수 있어요.", { counter: "" })}
      <div class="saved-segment"><button class="is-active">장소</button><button data-action="set-tab" data-tab="route">루트</button></div>
      <button class="delete-select-all" data-action="select-all-delete">모두선택</button>
      <div class="saved-grid">
        ${saved.map((place) => `
          <button class="saved-card ${selected.has(place.id) ? "is-delete-selected" : ""}" data-action="toggle-delete-place" data-place-id="${esc(place.id)}">
            ${imageLoader(firstImage(place), place.name, { shellClass: "saved-image-shell", imageClass: "saved-image" })}
            <span class="saved-card-select" aria-hidden="true">${selected.has(place.id) ? "✓" : ""}</span>
            <span class="saved-card-title">${esc(place.name)}</span>
          </button>
        `).join("")}
      </div>
      <div class="saved-delete-bar">
        <span class="saved-delete-icon" aria-hidden="true"></span>
        <strong>${selected.size}개 장소 선택됨</strong>
        <div class="saved-delete-actions">
          <button class="saved-delete-cancel" data-action="cancel-saved-delete">취소</button>
          <button class="saved-delete-confirm" data-action="confirm-delete-saved" ${selected.size ? "" : "disabled"}>삭제</button>
        </div>
      </div>
      ${bottomNav("saved")}
    </section>
  `;
}

function renderDeleteConfirm(model) {
  const count = (model.state.deletePlaceIds || []).length;
  return `
    <div class="delete-confirm" role="dialog" aria-label="삭제 확인">
      <div class="delete-confirm-card">
        <h2>${count}개 장소를 삭제할까요?</h2>
        <p>삭제한 장소는 저장함에서 사라져요.</p>
        <div class="delete-confirm-actions">
          <button data-action="cancel-delete-confirm">취소</button>
          <button class="danger" data-action="delete-selected-saved">삭제</button>
        </div>
      </div>
    </div>
  `;
}

function renderRoute(model) {
  return renderRouteCandidates(model);
}

function renderRouteCandidates(model) {
  const savedAll = routeCandidatePlaces(model);
  const saved = savedAll.filter((place) => matchesSavedFilters(place, model.state.savedFilters));
  const selected = new Set(model.state.routePlaceIds || []);
  if (!savedAll.length) {
    return `
      <section class="screen screen-route screen-route-home">
        ${screenHeader("루트", "저장한 장소로 오늘 갈 동선을 만들어보세요.", { counter: "" })}
        <button class="route-home-button" data-action="set-tab" data-tab="saved">
          <span aria-hidden="true">＋</span>
          루트 만들기
        </button>
        <p class="route-home-helper">저장한 장소를 골라 순서를 정할 수 있어요.</p>
        ${bottomNav("route")}
      </section>
    `;
  }
  const { selectedPlaces, counts } = routeSummary(model, saved);
  const visibleSelectedCount = selectedPlaces.length;
  const canCreate = canCreateRoute(model, saved);
  const routeActionLabel = canCreate ? "루트 만들기" : "장소 2개 이상 선택";
  const summaryPreview = routeSummaryPreview(model, saved, selectedPlaces).slice(0, 2);
  const showSummaryMore = counts.length > 2;
  const allGroups = groupRoutePlaces(saved);
  const groups = orderedRouteGroups(allGroups, model.state.routeExpandedType);
  const categoryChips = allGroups;
  const includeLabel = model.state.routeIncludePrevious ? "오늘 저장한 장소만 보기" : "이전 저장장소 포함하기";
  const expandedLabel = model.state.routeExpandedType ? compactRouteTypeLabel(model.state.routeExpandedType) : "";
  const routeTitle = expandedLabel ? "오늘 고른 후보" : "루트";
  const routeSubtitle = expandedLabel
    ? `${expandedLabel} 버튼을 눌러 ${expandedLabel} 후보만 확장해서 보는 상태예요.`
    : "저장한 장소로 오늘 갈 동선을 만들어보세요.";
  return `
    <section class="screen screen-route screen-route-candidates ${model.state.routeSummaryOpen ? "screen-route-summary-open" : ""} ${model.state.routeExpandedType ? "screen-route-expanded" : ""}">
      ${screenHeader(routeTitle, routeSubtitle, { counter: "" })}
      <div class="route-sheet">
        <button class="route-include-toggle" data-action="toggle-route-previous">${esc(includeLabel)}</button>
        <div class="route-category-row" aria-label="루트 장소 유형">
          <button class="route-category-chip ${!model.state.routeExpandedType ? "is-active" : ""}" data-action="set-route-category" data-category="">전체 ${saved.length}</button>
          ${categoryChips.map((group) => `
            <button class="route-category-chip ${model.state.routeExpandedType === group.label ? "is-active" : ""}" data-action="set-route-category" data-category="${esc(group.label)}">
              ${esc(compactRouteTypeLabel(group.label))} ${group.places.length}
            </button>
          `).join("")}
        </div>
        <div class="route-section-scroll">
          ${groups.map((group) => `
            <section class="route-section ${model.state.routeExpandedType === group.label && group.places.length > 2 ? "is-expanded-section" : ""}">
              <div class="route-section-header">
                <button data-action="set-route-category" data-category="${esc(group.label)}">${esc(compactRouteTypeLabel(group.label))}</button>
                <span>${group.places.length}곳</span>
              </div>
              <div class="route-grid">
                ${group.places.map((place) => `
                  <button class="route-card ${selected.has(place.id) ? "is-selected" : ""}" data-action="toggle-route-place" data-place-id="${esc(place.id)}">
                    ${imageLoader(firstImage(place), place.name, { shellClass: "route-image-shell", imageClass: "route-image" })}
                    <span class="route-card-type">${esc(compactRouteTypeLabel(categoryLabel(place)))}</span>
                    <span class="saved-card-title">${esc(place.name)}</span>
                  </button>
                `).join("")}
              </div>
            </section>
          `).join("")}
        </div>
        <div class="route-summary">
          <span class="route-summary-total">최종 ${visibleSelectedCount}곳</span>
          ${summaryPreview.map(([name, count], index) => `<span class="route-summary-chip route-summary-preview-${index} ${index === 1 ? "warm" : index >= 2 ? "cool" : ""}" title="${esc(name)} ${count}">${esc(compactRouteTypeLabel(name))} ${count}</span>`).join("")}
          ${showSummaryMore ? `<button class="route-summary-more" data-action="${model.state.routeSummaryOpen ? "close-route-summary" : "open-route-summary"}" aria-label="선택한 장소유형 더보기">...</button>` : ""}
          <span class="route-summary-chip total">총 ${visibleSelectedCount}/4</span>
        </div>
        ${model.state.routeSummaryOpen ? `<button class="route-summary-backdrop" data-action="close-route-summary" aria-label="요약 더보기 닫기"></button>${renderRouteSummaryMore(counts, visibleSelectedCount)}` : ""}
        <button class="route-action" data-action="create-route" ${canCreate ? "" : "disabled"}>${routeActionLabel}</button>
        ${savedAll.length && !saved.length ? `<p class="route-filter-empty">조건에 맞는 장소가 없어요.</p>` : ""}
      </div>
      ${bottomNav("route")}
    </section>
  `;
}

function renderRouteSummaryMore(counts, selectedCount) {
  return `
    <div class="route-summary-popover" role="dialog" aria-label="선택한 장소유형">
      <strong>선택한 장소유형</strong>
      <div>
        ${counts.length
          ? counts.map(([name, count], index) => `<span class="route-summary-chip ${index === 1 ? "warm" : index >= 2 ? "cool" : ""}">${esc(name)} ${count}</span>`).join("")
          : `<span class="route-summary-empty">아직 선택한 후보가 없어요.</span>`}
        <span class="route-summary-chip total">총 ${selectedCount}/4</span>
      </div>
    </div>
  `;
}

function renderRouteBlocked(model) {
  return `
    <section class="screen screen-route-blocked">
      <div class="future-x">×</div>
      <p class="route-blocked-copy">루트 자동 정리는 곧 열릴 예정이에요.<br />선택한 장소는 저장함에 남아 있어요.</p>
      <button class="primary-cta" style="margin:34px auto 0;display:block;" data-action="set-tab" data-tab="route">뒤로가기</button>
      <button class="route-notify-link" data-action="open-notify">알림받기</button>
    </section>
  `;
}

function renderMy(model) {
  return `
    <section class="screen screen-my">
      ${screenHeader("MY", "저장한 장소와 기본 설정을 확인할 수 있어요.", { region: false })}
      <div class="my-menu">
        <button data-action="open-my-feedback"><strong>문의하기</strong><span>오류, 장소 제안, 루트 의견을 보낼 수 있어요.</span></button>
        <button data-action="open-my-terms"><strong>약관 및 개인정보</strong><span>서비스 이용약관과 개인정보 처리방침을 확인해요.</span></button>
        <button data-action="open-my-info"><strong>앱 정보</strong><span>Doripe MVP 파일럿 정보를 확인해요.</span></button>
      </div>
      ${bottomNav("my")}
    </section>
  `;
}

function renderMySubscreen(model, type) {
  const title = type === "feedback" ? "문의하기" : type === "terms" ? "약관 및 개인정보" : "앱 정보";
  const feedbackType = model.state.feedbackType || "앱 오류";
  const feedbackText = model.state.feedbackText || "";
  const body = {
    feedback: `
      <div class="my-choice-row">
        ${["앱 오류", "장소 제안", "루트 의견"].map((option) => `
          <button class="${feedbackType === option ? "is-selected" : ""}" data-action="select-feedback-type" data-value="${esc(option)}">${esc(option)}</button>
        `).join("")}
      </div>
      <textarea class="feedback-input" data-feedback-input="true" placeholder="내용을 입력해주세요">${esc(feedbackText)}</textarea>
      <button class="primary-cta my-submit" data-action="submit-feedback" ${feedbackText.trim() ? "" : "disabled"}>제출하기</button>
    `,
    terms: `
      <div class="my-menu compact">
        <button data-action="open-external" data-url="/terms"><strong>서비스 이용약관</strong><span>웹 문서로 열기</span></button>
        <button data-action="open-external" data-url="/privacy"><strong>개인정보 처리방침</strong><span>웹 문서로 열기</span></button>
        <button data-action="open-external" data-url="/licenses"><strong>오픈소스 라이선스</strong><span>웹 문서로 열기</span></button>
        <button data-action="open-external" data-url="/account-delete"><strong>계정 삭제 안내</strong><span>웹 문서로 열기</span></button>
      </div>
    `,
    info: `
      <div class="my-info-card">
        <strong>Doripe</strong>
        <span>version 0.1.0</span>
        <p>서울 동네 장소 발견 MVP 파일럿입니다.</p>
      </div>
    `
  }[type];
  return `
    <section class="screen screen-my screen-my-sub">
      ${statusBar()}
      <button class="onboarding-back" data-action="set-tab" data-tab="my" aria-label="뒤로가기">‹</button>
      <h1 class="screen-title">${title}</h1>
      <p class="screen-subtitle">필요한 항목을 확인해주세요.</p>
      ${body}
      ${bottomNav("my")}
    </section>
  `;
}

function renderEmpty(title, copy, active = "discover") {
  return `
    <section class="screen">
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h2 class="place-title">${esc(title)}</h2>
        <p class="place-copy">${esc(copy)}</p>
      </div>
      ${bottomNav(active)}
    </section>
  `;
}

export function renderApp(root, model, handlers) {
  const state = model.state;
  let html = "";

  if (state.screen === "welcome") {
    html = renderWelcome();
  }
  else if (state.screen === "onboardingSource") {
    html = renderOnboardingQuestion(model, {
      field: "source",
      step: 1,
      back: false,
      title: "Doripe를<br />어디서 알게 됐나요?",
      subtitle: "처음 한 번만 알려주면 추천을 더 가볍게 맞춰볼게요.",
      options: ["지인 추천", "인스타그램", "릴스/숏츠", "블로그/검색", "커뮤니티/카페", "크리에이터", "앱스토어", "기타"],
      cta: "다음"
    });
  }
  else if (state.screen === "onboardingHabit") {
    html = renderOnboardingQuestion(model, {
      field: "habit",
      step: 2,
      title: "평소 장소를<br />어떻게 찾나요?",
      subtitle: "자주 쓰던 방식에 맞춰 장소 카드를 보여줄게요.",
      options: ["인스타 저장", "네이버 지도 저장", "블로그 검색", "친구 추천", "그때그때 검색", "잘 못 찾는 편"],
      cta: "동네 고르기"
    });
  }
  else if (state.screen === "region") html = renderRegion(model);
  else if (state.screen === "regionTransition") html = renderTransition(model);
  else if (state.screen === "tagSetup") html = renderTagSetup(model);
  else if (state.screen === "discover") html = renderDiscover(model);
  else if (state.screen === "sharedPlace") html = renderSharedPlace(model);
  else if (state.screen === "complete") html = renderComplete(model);
  else if (state.screen === "placeDetail") html = renderDetail(model, false);
  else if (state.screen === "saved") html = renderSaved(model);
  else if (state.screen === "savedDelete") html = renderSavedDelete(model);
  else if (state.screen === "savedPlaceDetail") html = renderDetail(model, true);
  else if (state.screen === "route") html = renderRoute(model);
  else if (state.screen === "routeCandidates") html = renderRouteCandidates(model);
  else if (state.screen === "routeBlocked") html = renderRouteBlocked(model);
  else if (state.screen === "my") html = renderMy(model);
  else if (state.screen === "myFeedback") html = renderMySubscreen(model, "feedback");
  else if (state.screen === "myTerms") html = renderMySubscreen(model, "terms");
  else if (state.screen === "myInfo") html = renderMySubscreen(model, "info");
  else html = renderEmpty("화면을 찾을 수 없어요", "다시 시도해주세요.", state.tab);

  root.innerHTML = [
    topAlert(state.alert),
    html,
    state.regionPickerOpen ? renderRegionPicker(model) : "",
    state.savedFilterOpen ? renderFilterSheet(model, "saved") : "",
    state.routeFilterOpen ? renderFilterSheet(model, "route") : "",
    state.deleteConfirmOpen ? renderDeleteConfirm(model) : "",
    state.shareOpen ? sharePopover() : ""
  ].join("");
  bindActions(root, handlers, model);
  bindLongPressActions(root, handlers);
  bindCardGesture(root, handlers);
}

function bindActions(root, handlers, model) {
  root.querySelectorAll("[data-action]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const action = target.dataset.action;
      if (action === "select-neighborhood") {
        const item = model.data.neighborhoods.find((neighborhood) => neighborhood.id === target.dataset.neighborhoodId);
        const hasExplicitEnabled = target.dataset.enabled === "true" || target.dataset.enabled === "false";
        handlers.selectNeighborhood({
          ...(item || {}),
          id: target.dataset.neighborhoodId,
          label: target.dataset.label || item?.label || target.textContent.trim(),
          enabled: hasExplicitEnabled ? target.dataset.enabled === "true" : Boolean(item?.enabled)
        });
      } else if (action === "start-welcome") handlers.startWelcome();
      else if (action === "select-onboarding-option") handlers.selectOnboardingOption(target.dataset.field, target.dataset.value);
      else if (action === "onboarding-next") handlers.nextOnboarding();
      else if (action === "onboarding-back") handlers.backOnboarding();
      else if (action === "start-yeonnam") handlers.startYeonnam();
      else if (action === "open-region") handlers.openRegion();
      else if (action === "close-region-picker") handlers.closeRegionPicker();
      else if (action === "set-tab") handlers.setTab(target.dataset.tab);
      else if (action === "toggle-tag") handlers.toggleTag(target.dataset.tag, target.dataset.kind);
      else if (action === "apply-tags") handlers.applyTags();
      else if (action === "dismiss-discover-tutorial") handlers.dismissDiscoverTutorial(target.dataset.reason || "tap");
      else if (action === "open-saved-filter") handlers.openSavedFilter();
      else if (action === "close-saved-filter") handlers.closeSavedFilter();
      else if (action === "toggle-saved-filter") handlers.toggleSavedFilter(target.dataset.kind, target.dataset.tag);
      else if (action === "reset-saved-filter") handlers.resetSavedFilter();
      else if (action === "apply-saved-filter") handlers.applySavedFilter();
      else if (action === "save-current") handlers.saveCurrentPlace();
      else if (action === "skip-current") handlers.skipCurrentPlace();
      else if (action === "save-place") handlers.savePlace(target.dataset.placeId);
      else if (action === "skip-place") handlers.skipPlace(target.dataset.placeId);
      else if (action === "next-photo") {
        if (target.closest('[data-gesture-card="true"]')) return;
        handlers.nextPhoto();
      }
      else if (action === "previous-photo") {
        if (target.closest('[data-gesture-card="true"]')) return;
        handlers.previousPhoto();
      }
      else if (action === "open-detail") handlers.openPlaceDetail(target.dataset.placeId);
      else if (action === "back-discover") handlers.backDiscover();
      else if (action === "open-saved-detail") handlers.openSavedDetail(target.dataset.placeId);
      else if (action === "open-saved-delete") handlers.openSavedDelete(target.dataset.placeId);
      else if (action === "toggle-delete-place") handlers.toggleDeletePlace(target.dataset.placeId);
      else if (action === "select-all-delete") handlers.selectAllDeletePlaces();
      else if (action === "cancel-saved-delete") handlers.cancelSavedDelete();
      else if (action === "confirm-delete-saved") handlers.confirmDeleteSaved();
      else if (action === "cancel-delete-confirm") handlers.cancelDeleteConfirm();
      else if (action === "delete-selected-saved") handlers.deleteSelectedSaved();
      else if (action === "share-place") handlers.sharePlace(target.dataset.placeId);
      else if (action === "open-route-candidates") handlers.openRouteCandidates();
      else if (action === "open-route-filter") handlers.openRouteFilter();
      else if (action === "close-route-filter") handlers.closeRouteFilter();
      else if (action === "apply-route-filter") handlers.applyRouteFilter();
      else if (action === "toggle-route-place") handlers.toggleRoutePlace(target.dataset.placeId);
      else if (action === "toggle-route-previous") handlers.toggleRoutePrevious();
      else if (action === "set-route-category") handlers.setRouteCategory(target.dataset.category || "");
      else if (action === "open-route-summary") handlers.openRouteSummary();
      else if (action === "close-route-summary") handlers.closeRouteSummary();
      else if (action === "create-route") handlers.createRoute();
      else if (action === "open-notify") handlers.openNotify();
      else if (action === "open-map") handlers.openMap(target.dataset.placeId);
      else if (action === "copy-share") handlers.copyLastShare();
      else if (action === "native-share") handlers.nativeShareLast();
      else if (action === "close-share") handlers.closeShare();
      else if (action === "open-my-feedback") handlers.openMyScreen("myFeedback");
      else if (action === "open-my-terms") handlers.openMyScreen("myTerms");
      else if (action === "open-my-info") handlers.openMyScreen("myInfo");
      else if (action === "select-feedback-type") handlers.selectFeedbackType(target.dataset.value);
      else if (action === "submit-feedback") handlers.submitFeedback();
      else if (action === "open-external") handlers.openExternal(target.dataset.url);
      else if (action === "noop") event.preventDefault();
    });
  });
  const feedbackInput = root.querySelector("[data-feedback-input]");
  if (feedbackInput) {
    feedbackInput.addEventListener("input", (event) => {
      const value = event.currentTarget.value;
      handlers.setFeedbackText(value);
      const submit = root.querySelector('[data-action="submit-feedback"]');
      if (submit) submit.disabled = !value.trim();
    });
  }
}

function bindLongPressActions(root, handlers) {
  root.querySelectorAll("[data-long-press-action]").forEach((node) => {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let fired = false;

    function clear() {
      window.clearTimeout(timer);
      timer = null;
    }

    node.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      startX = event.clientX;
      startY = event.clientY;
      fired = false;
      clear();
      timer = window.setTimeout(() => {
        fired = true;
        if (node.dataset.longPressAction === "open-saved-delete") {
          handlers.openSavedDelete(node.dataset.placeId);
        }
      }, 430);
    });

    node.addEventListener("pointermove", (event) => {
      if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) clear();
    });

    node.addEventListener("pointerup", (event) => {
      clear();
      if (!fired) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    node.addEventListener("pointercancel", clear);
    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  });
}

function bindCardGesture(root, handlers) {
  const card = root.querySelector('[data-gesture-card="true"]');
  if (!card) return;

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let dragY = 0;
  let isDragging = false;
  let suppressClick = false;
  let tapZoneAction = "";
  let movedTooFarForTap = false;

  function resetCard() {
    card.classList.add("is-returning");
    card.style.setProperty("--drag-x", "0px");
    card.style.setProperty("--drag-y", "0px");
    card.style.setProperty("--drag-rotate", "0deg");
    card.style.setProperty("--drag-intensity", "0");
    delete card.dataset.swipeDirection;
    window.setTimeout(() => card.classList.remove("is-returning", "is-dragging"), 170);
  }

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest(".card-action")) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    dragX = 0;
    dragY = 0;
    isDragging = false;
    suppressClick = false;
    movedTooFarForTap = false;
    const photoZone = event.target.closest(".photo-tap-zone");
    tapZoneAction = photoZone?.dataset.photoAction || photoZone?.dataset.action || "";
    card.setPointerCapture?.(event.pointerId);
  }, true);

  card.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    dragX = event.clientX - startX;
    dragY = event.clientY - startY;
    if (Math.hypot(dragX, dragY) > 8) movedTooFarForTap = true;
    if (!isDragging && Math.abs(dragX) > 10 && Math.abs(dragX) > Math.abs(dragY)) {
      isDragging = true;
      card.classList.add("is-dragging");
    }
    if (!isDragging) return;
    event.preventDefault();
    const limitedX = Math.max(-170, Math.min(170, dragX));
    const limitedY = Math.max(-28, Math.min(28, dragY));
    const intensity = Math.min(Math.abs(limitedX) / 112, 1);
    card.dataset.swipeDirection = limitedX >= 0 ? "right" : "left";
    card.style.setProperty("--drag-x", `${limitedX}px`);
    card.style.setProperty("--drag-y", `${limitedY}px`);
    card.style.setProperty("--drag-rotate", `${limitedX / 18}deg`);
    card.style.setProperty("--drag-intensity", String(intensity));
  }, true);

  card.addEventListener("pointerup", (event) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    if (!isDragging) {
      if (!movedTooFarForTap && (tapZoneAction === "next-photo" || tapZoneAction === "previous-photo")) {
        suppressClick = true;
        event.preventDefault();
        if (tapZoneAction === "next-photo") handlers.nextPhoto();
        else handlers.previousPhoto();
        window.setTimeout(() => {
          suppressClick = false;
        }, 120);
      }
      tapZoneAction = "";
      return;
    }
    suppressClick = true;
    event.preventDefault();
    const threshold = 106;
    if (dragX > threshold) handlers.swipeCurrentPlace("right");
    else if (dragX < -threshold) handlers.swipeCurrentPlace("left");
    else resetCard();
    tapZoneAction = "";
    window.setTimeout(() => {
      suppressClick = false;
    }, 120);
  }, true);

  card.addEventListener("pointercancel", () => {
    pointerId = null;
    if (isDragging) resetCard();
  }, true);

  card.addEventListener("click", (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
