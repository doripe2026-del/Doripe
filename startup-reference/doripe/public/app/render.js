import { CONFIG } from "./config.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function firstImage(place) {
  return place?.images?.[0] || place?.coverImageUrl || "/og-image.png";
}

function tagsFor(place) {
  const category = place?.categoryName ? [{ label: place.categoryName, kind: "type" }] : [];
  const moods = (place?.moodTags || []).slice(0, 2).map((label) => ({ label, kind: "mood" }));
  const situations = (place?.bestFor || []).slice(0, 1).map((label) => ({ label, kind: "situation" }));
  return [...category, ...moods, ...situations].slice(0, 4);
}

function bottomNav(active) {
  const items = [
    ["discover", "발견"],
    ["saved", "저장"],
    ["route", "루트"]
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

function topAlert(message) {
  if (!message) return "";
  return `
    <div class="top-alert" role="status">
      <span class="alert-icon" aria-hidden="true">!</span>
      <span>
        <span class="alert-title">${esc(message)}</span>
        <span class="alert-copy">지금은 연남동만 먼저 열어두었어요.</span>
      </span>
    </div>
  `;
}

function sharePopover() {
  return `
    <div class="share-popover" role="dialog" aria-label="공유 옵션">
      <button class="share-option" data-action="copy-share">복사</button>
      <button class="share-option" data-action="native-share">↗</button>
      <button class="share-option" data-action="close-share">×</button>
    </div>
  `;
}

function screenHeader(title, subtitle, options = {}) {
  return `
    <div class="top-row">
      ${options.region === false ? "<span></span>" : regionSelector()}
      ${options.counter ? `<span class="counter-pill">${esc(options.counter)}</span>` : "<span></span>"}
    </div>
    <h1 class="screen-title">${esc(title)}</h1>
    <p class="screen-subtitle">${esc(subtitle)}</p>
  `;
}

export function visibleDiscoverPlaces(places, state) {
  const hidden = new Set([...(state.savedPlaceIds || []), ...(state.skippedPlaceIds || [])]);
  return (places || []).filter((place) => !hidden.has(place.id));
}

export function currentDiscoverPlace(places, state) {
  const visible = visibleDiscoverPlaces(places, state);
  if (!visible.length) return null;
  return visible[Math.min(state.currentIndex || 0, visible.length - 1)];
}

function renderRegion(model) {
  const neighborhoods = model.data.neighborhoods?.length
    ? model.data.neighborhoods
    : [
      { id: "seongsu", label: "성수", enabled: false },
      { id: "yongsan-huam-haebangchon", label: "용산·후암·해방촌", enabled: false },
      { id: "yeonnam", label: "연남", enabled: true }
    ];
  return `
    <section class="screen screen-region">
      <h1 class="screen-title">처음 둘러볼<br />동네를 골라주세요</h1>
      <p class="screen-subtitle">마지막으로 첫 피드를 볼 동네를 골라주세요.</p>
      <div class="region-map" aria-label="서울 동네 선택">
        ${neighborhoods.map((item) => `
          <button class="region-pin ${item.enabled ? "is-enabled" : "is-disabled"}" data-action="select-neighborhood" data-neighborhood-id="${esc(item.id)}">
            <span class="pin-head" aria-hidden="true"></span>
            <span class="pin-label">${esc(item.label)}</span>
          </button>
        `).join("")}
      </div>
      <div class="selected-region-panel">
        <span class="selected-dot" aria-hidden="true"></span>
        <span>지금은 연남동만 열려 있어요</span>
      </div>
      <button class="primary-cta region-start" data-action="start-yeonnam">연남으로 시작하기</button>
    </section>
  `;
}

function renderTransition() {
  return `
    <section class="screen">
      <div class="white-sheet" style="height:332px;margin-top:184px;display:grid;place-items:center;text-align:center;">
        <div>
          <div class="brand-mark" style="width:92px;height:92px;margin:0 auto 28px;"></div>
          <strong style="font-size:22px;">연남으로 떠나는 중</strong>
        </div>
      </div>
      <h1 class="screen-title" style="text-align:center;margin-top:36px;">연남으로 떠나는 중</h1>
      <p class="screen-subtitle" style="text-align:center;">동네 분위기에 맞는 장소카드를 준비하고 있어요.</p>
    </section>
  `;
}

function renderTagSetup(model) {
  const tags = [
    ["type", "카페"], ["type", "식당"], ["type", "샵"], ["type", "사진스팟"],
    ["mood", "조용한"], ["mood", "감각적인"], ["mood", "따뜻한"], ["mood", "힙한"], ["mood", "차분한"],
    ["situation", "혼자"], ["situation", "데이트"], ["situation", "친구와"], ["situation", "가볍게"], ["situation", "오래 머물기"]
  ];
  const selected = new Set(model.state.selectedTags || []);
  return `
    <section class="screen">
      ${screenHeader("", "", { counter: "" })}
      <div class="white-sheet tag-sheet">
        <h1 class="detail-title">오늘은 어디를<br />발견해볼까요?</h1>
        <p class="screen-subtitle" style="margin-top:12px;">끌리는 태그를 골라주시면 장소카드를 더 잘 맞춰볼게요.</p>
        <div class="tag-section">
          <div class="tag-section-title">장소 유형</div>
          <div class="tag-picker">${tags.filter(([k]) => k === "type").map(([, label]) => tagButton(label, selected, "type")).join("")}</div>
        </div>
        <div class="tag-section">
          <div class="tag-section-title">분위기</div>
          <div class="tag-picker">${tags.filter(([k]) => k === "mood").map(([, label]) => tagButton(label, selected, "mood")).join("")}</div>
        </div>
        <div class="tag-section">
          <div class="tag-section-title">상황</div>
          <div class="tag-picker">${tags.filter(([k]) => k === "situation").map(([, label]) => tagButton(label, selected, "situation")).join("")}</div>
        </div>
        <button class="tag-apply" data-action="apply-tags">장소카드 보기</button>
      </div>
      ${bottomNav("discover")}
    </section>
  `;
}

function tagButton(label, selected, kind) {
  return `<button class="tag-button ${kind} ${selected.has(label) ? "is-selected" : ""}" data-action="toggle-tag" data-tag="${esc(label)}">${esc(label)}</button>`;
}

function renderPlaceCard(place, state, options = {}) {
  const images = place.images?.length ? place.images : [firstImage(place)];
  const index = Math.min(state.currentPhotoIndex || 0, images.length - 1);
  return `
    <article class="place-card ${options.detail ? "is-detail" : ""}">
      <img class="place-image" src="${esc(images[index])}" alt="${esc(place.name)} 사진" />
      <div class="photo-dots" aria-label="사진 ${index + 1}/${images.length}">
        ${images.map((_, dotIndex) => `<span class="photo-dot ${dotIndex === index ? "is-active" : ""}"></span>`).join("")}
      </div>
      <button class="photo-tap-zone left" data-action="previous-photo" aria-label="이전 사진"></button>
      <button class="photo-tap-zone right" data-action="next-photo" aria-label="다음 사진"></button>
      <div class="creator-badge"><span></span><strong>Doripe 공식</strong></div>
      <div class="card-actions">
        <button class="card-action" data-action="open-detail" data-place-id="${esc(place.id)}" aria-label="상세 정보">i</button>
        <button class="card-action heart" data-action="save-current" aria-label="저장">♥</button>
        <button class="card-action" data-action="skip-current" aria-label="넘기기">×</button>
        <button class="card-action" data-action="share-place" data-place-id="${esc(place.id)}" aria-label="공유">↗</button>
      </div>
      <div class="place-info">
        <div class="tag-row">
          ${tagsFor(place).map((tag) => `<span class="tag-chip ${tag.kind === "mood" ? "mood" : tag.kind === "situation" ? "situation" : ""}">${esc(tag.label)}</span>`).join("")}
        </div>
        <h2 class="place-title">${esc(place.name)}</h2>
        <p class="place-copy">${esc(place.shortCopy || place.address || "연남에서 발견한 장소")}</p>
      </div>
    </article>
  `;
}

function renderDiscover(model) {
  const place = currentDiscoverPlace(model.data.places, model.state);
  const counter = `${Math.min(model.state.cardActionCount, model.cardActionLimit)}/${model.cardActionLimit}`;
  if (model.state.cardActionCount >= model.cardActionLimit) return renderLimit(model);
  if (!place) return renderComplete(model);
  return `
    <section class="screen">
      ${screenHeader("오늘 발견할 장소", "사진을 넘겨보고 마음에 들면 저장해요.", { counter })}
      ${renderPlaceCard(place, model.state)}
      ${bottomNav("discover")}
    </section>
  `;
}

function renderComplete(model) {
  return `
    <section class="screen">
      ${screenHeader("모두 봤어요", "연남에서 준비한 장소카드를 모두 확인했어요.", { counter: `${model.state.cardActionCount}/${model.cardActionLimit}` })}
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        <h2 class="place-title">저장함으로 이동할까요?</h2>
        <p class="place-copy">저장한 장소를 보고 루트 만들기를 시도할 수 있어요.</p>
        <button class="primary-cta" style="margin-top:28px;" data-action="set-tab" data-tab="saved">저장함 보기</button>
      </div>
      ${bottomNav("discover")}
    </section>
  `;
}

function renderLimit(model) {
  return `
    <section class="screen">
      ${screenHeader("오늘은 여기까지", "12번 넘기기를 모두 사용했어요.", { counter: `${model.cardActionLimit}/${model.cardActionLimit}` })}
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        <h2 class="place-title">연남 장소를 저장했어요</h2>
        <p class="place-copy">저장함에서 마음에 든 장소를 다시 확인해보세요.</p>
        <button class="primary-cta" style="margin-top:28px;" data-action="set-tab" data-tab="saved">저장함 보기</button>
      </div>
      ${bottomNav("discover")}
    </section>
  `;
}

function renderDetail(model, fromSaved = false) {
  const place = model.data.places.find((item) => item.id === model.state.selectedPlaceId) || currentDiscoverPlace(model.data.places, model.state);
  if (!place) return renderEmpty("장소를 찾을 수 없어요", "다시 장소카드를 열어주세요.", model.state.tab);
  return `
    <section class="screen">
      ${screenHeader(fromSaved ? "저장한 장소" : "장소 정보", "필요한 정보를 확인하고 지도에서 열 수 있어요.", { counter: "" })}
      <div class="detail-sheet">
        <button class="close-button" data-action="${fromSaved ? "set-tab" : "back-discover"}" data-tab="${fromSaved ? "saved" : ""}" aria-label="닫기">×</button>
        <h1 class="detail-title">${esc(place.name)}</h1>
        <div class="tag-row" style="margin-top:14px;">${tagsFor(place).map((tag) => `<span class="tag-chip ${tag.kind === "mood" ? "mood" : tag.kind === "situation" ? "situation" : ""}">${esc(tag.label)}</span>`).join("")}</div>
        <p class="place-copy">${esc(place.shortCopy || "연남에서 발견한 장소")}</p>
        <div class="info-row"><strong>지도 위치</strong><span>${esc(place.address || place.subArea || "주소 준비 중")}</span></div>
        <div class="info-row"><strong>동네</strong><span>${esc(place.subArea || place.neighborhoodName || CONFIG.activeNeighborhoodLabel)}</span></div>
        <div class="info-row"><strong>지도 링크</strong><span>${place.naverPlaceUrl ? "네이버 지도에서 열 수 있어요." : "지도 링크 준비 중"}</span></div>
        <button class="primary-cta" style="margin-top:18px;width:100%;" data-action="open-map" data-place-id="${esc(place.id)}">지도에서 보기</button>
        <button class="primary-cta" style="margin-top:10px;width:100%;background:#f4f1e8;color:var(--doripe-ink);" data-action="share-place" data-place-id="${esc(place.id)}">공유하기</button>
      </div>
      ${bottomNav(model.state.tab || "discover")}
    </section>
  `;
}

function renderSaved(model) {
  const saved = model.data.places.filter((place) => model.state.savedPlaceIds.includes(place.id));
  if (!saved.length) {
    return `
      <section class="screen">
        ${screenHeader("저장함", "마음에 든 장소가 여기에 모여요.", { counter: "" })}
        <div class="empty-state">
          <div class="empty-icon">×</div>
          <h2 class="place-title">저장한 장소가 없어요</h2>
          <p class="place-copy">발견 탭에서 하트를 누르면 여기에 저장돼요.</p>
        </div>
        ${bottomNav("saved")}
      </section>
    `;
  }
  return `
    <section class="screen">
      ${screenHeader("저장함", "저장한 장소를 다시 보고 루트에 넣을 수 있어요.", { counter: `${saved.length}곳` })}
      <div class="saved-grid">
        ${saved.map((place) => `
          <button class="saved-card" data-action="open-saved-detail" data-place-id="${esc(place.id)}">
            <img src="${esc(firstImage(place))}" alt="${esc(place.name)}" />
            <span class="saved-card-title">${esc(place.name)}</span>
          </button>
        `).join("")}
      </div>
      ${bottomNav("saved")}
    </section>
  `;
}

function renderRoute(model) {
  const saved = model.data.places.filter((place) => model.state.savedPlaceIds.includes(place.id));
  const selected = new Set(model.state.routePlaceIds || []);
  if (!saved.length) {
    return `
      <section class="screen">
        ${screenHeader("루트 만들기", "저장한 장소가 생기면 루트를 만들 수 있어요.", { counter: "" })}
        <div class="empty-state">
          <div class="empty-icon">＋</div>
          <h2 class="place-title">장소를 먼저 저장해주세요</h2>
          <p class="place-copy">발견 탭에서 마음에 드는 장소를 저장하면 루트 후보가 생겨요.</p>
        </div>
        ${bottomNav("route")}
      </section>
    `;
  }
  const typeCounts = saved
    .filter((place) => selected.has(place.id))
    .reduce((acc, place) => {
      const key = place.categoryName || "미분류";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  return `
    <section class="screen">
      ${screenHeader("루트 만들기", "가고 싶은 장소를 누른 순서대로 담아보세요.", { counter: `${selected.size}곳` })}
      <div class="route-sheet">
        <div class="route-grid">
          ${saved.slice(0, 4).map((place) => `
            <button class="route-card ${selected.has(place.id) ? "is-selected" : ""}" data-action="toggle-route-place" data-place-id="${esc(place.id)}">
              <img src="${esc(firstImage(place))}" alt="${esc(place.name)}" />
              <span class="saved-card-title">${esc(place.name)}</span>
            </button>
          `).join("")}
        </div>
        <div class="route-summary">
          <span>${selected.size}곳 선택</span>
          ${Object.entries(typeCounts).slice(0, 3).map(([name, count]) => `<span class="tag-chip">${esc(name)} ${count}</span>`).join("")}
        </div>
        <button class="route-action" data-action="create-route" ${selected.size < 2 ? "disabled" : ""}>루트 만들기</button>
      </div>
      ${bottomNav("route")}
    </section>
  `;
}

function renderRouteBlocked(model) {
  return `
    <section class="screen">
      ${screenHeader("루트 만들기", "선택한 장소로 루트를 준비하고 있어요.", { counter: `${model.state.routePlaceIds.length}곳` })}
      <div class="future-x">×</div>
      <p class="route-blocked-copy">자동 루트 생성은 추후 제공될 기능이에요.<br />지금은 선택한 장소와 시도를 저장해둘게요.</p>
      <button class="primary-cta" style="margin:34px auto 0;display:block;" data-action="set-tab" data-tab="route">뒤로가기</button>
      ${bottomNav("route")}
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

  if (state.screen === "region") html = renderRegion(model);
  else if (state.screen === "regionTransition") html = renderTransition(model);
  else if (state.screen === "tagSetup") html = renderTagSetup(model);
  else if (state.screen === "discover") html = renderDiscover(model);
  else if (state.screen === "placeDetail") html = renderDetail(model, false);
  else if (state.screen === "saved") html = renderSaved(model);
  else if (state.screen === "savedPlaceDetail") html = renderDetail(model, true);
  else if (state.screen === "route") html = renderRoute(model);
  else if (state.screen === "routeBlocked") html = renderRouteBlocked(model);
  else html = renderEmpty("화면을 찾을 수 없어요", "다시 시도해주세요.", state.tab);

  root.innerHTML = `${topAlert(state.alert)}${html}${state.shareOpen ? sharePopover() : ""}`;
  bindActions(root, handlers, model);
}

function bindActions(root, handlers, model) {
  root.querySelectorAll("[data-action]").forEach((node) => {
    node.addEventListener("click", (event) => {
      const target = event.currentTarget;
      const action = target.dataset.action;
      if (action === "select-neighborhood") {
        const item = model.data.neighborhoods.find((neighborhood) => neighborhood.id === target.dataset.neighborhoodId);
        handlers.selectNeighborhood(item || { id: target.dataset.neighborhoodId, label: target.textContent.trim(), enabled: false });
      } else if (action === "start-yeonnam") handlers.startYeonnam();
      else if (action === "open-region") handlers.openRegion();
      else if (action === "set-tab") handlers.setTab(target.dataset.tab);
      else if (action === "toggle-tag") handlers.toggleTag(target.dataset.tag);
      else if (action === "apply-tags") handlers.applyTags();
      else if (action === "save-current") handlers.saveCurrentPlace();
      else if (action === "skip-current") handlers.skipCurrentPlace();
      else if (action === "next-photo") handlers.nextPhoto();
      else if (action === "previous-photo") handlers.previousPhoto();
      else if (action === "open-detail") handlers.openPlaceDetail(target.dataset.placeId);
      else if (action === "back-discover") handlers.backDiscover();
      else if (action === "open-saved-detail") handlers.openSavedDetail(target.dataset.placeId);
      else if (action === "share-place") handlers.sharePlace(target.dataset.placeId);
      else if (action === "toggle-route-place") handlers.toggleRoutePlace(target.dataset.placeId);
      else if (action === "create-route") handlers.createRoute();
      else if (action === "open-map") handlers.openMap(target.dataset.placeId);
      else if (action === "copy-share") handlers.copyLastShare();
      else if (action === "native-share") handlers.nativeShareLast();
      else if (action === "close-share") handlers.closeShare();
    });
  });
}
