import { COMMENTS, MEDIA, PLACES, TAGS, USERS } from "../fixtures.js";
import { renderFilters } from "./saved.js";

const NODE_IDS = Object.freeze({
  b1: "446:507", b2: "446:596", b3: "446:646", b4: "446:682",
  b5: "446:818", b6: "446:876", b7: "446:1000", b8: "446:1017",
  b9: "446:1070", b10: "446:1106", b11: "446:2667",
  b12: "446:2792", b13: "446:3042"
});
const FEED_STATUS_EVENT = "app-preview:feed-status";
const DETAIL_SHEET_STATE_EVENT = "app-preview:detail-sheet-state";

const byId = (items, id) => items.find((item) => item.id === id);
const selectedPlace = (state) => byId(PLACES, state?.selections?.selectedPlaceId) || PLACES[0];
const selectedUser = (state) => byId(USERS, state?.selections?.selectedUserId) || USERS[0];
const mediaForPlace = (place) => place.mediaIds.map((id) => byId(MEDIA, id)).filter(Boolean);
const tagsForPlace = (place) => place.tagIds.map((id) => byId(TAGS, id)).filter(Boolean);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setData(node, values = {}) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) node.dataset[key] = String(value);
  }
  return node;
}

function actionButton(label, action, data = {}, className = "") {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.dataset.action = action;
  setData(button, data);
  if (data.value !== undefined) button.value = String(data.value);
  return button;
}

function localButton(label, className = "") {
  const button = element("button", className);
  button.type = "button";
  button.setAttribute("aria-label", label);
  return button;
}

function iconAsset(name, className = "") {
  const image = element("img", className);
  image.src = `/app-preview/assets/icons/${name}.svg`;
  image.alt = "";
  image.setAttribute("aria-hidden", "true");
  return image;
}

function addBackIcon(button) {
  button.replaceChildren(iconAsset("back", "discover-back-icon"));
  return button;
}

function screenRoot(screenId, className = "") {
  const root = element("section", `discover-screen discover-screen--${screenId} ${className}`.trim());
  root.dataset.screenId = screenId;
  root.dataset.figmaNode = NODE_IDS[screenId];
  root.dataset.renderMode = "semantic";
  return root;
}

function semanticMedia(media, className = "", options = {}) {
  const frame = element("span", `discover-media ${className}`.trim());
  frame.dataset.loadState = "loading";
  if (options.testId) frame.dataset.testid = options.testId;
  if (options.mediaId) frame.dataset.mediaId = options.mediaId;

  const image = element("img", "discover-media__image");
  image.src = media?.src || "/app-preview/assets/discover/feed-1.png";
  image.alt = media?.alt || "장소 사진";
  image.decoding = "async";
  image.loading = options.eager ? "eager" : "lazy";
  image.width = options.width || 180;
  image.height = options.height || 180;

  const retry = localButton("이미지 다시 시도", "discover-media__retry");
  retry.textContent = "다시 시도";
  retry.hidden = true;
  let timeout;
  const markLoaded = () => {
    clearTimeout(timeout);
    frame.dataset.loadState = "loaded";
    retry.hidden = true;
  };
  const markFailed = () => {
    clearTimeout(timeout);
    frame.dataset.loadState = "error";
    retry.hidden = false;
  };
  image.addEventListener("load", markLoaded);
  image.addEventListener("error", markFailed);
  retry.addEventListener("click", () => {
    frame.dataset.loadState = "loading";
    retry.hidden = true;
    image.src = `${image.src.split("?")[0]}?retry=${Date.now()}`;
    timeout = setTimeout(markFailed, 8000);
  });
  timeout = setTimeout(markFailed, 8000);
  frame.addEventListener("app-preview:screen-teardown", () => clearTimeout(timeout));
  frame.append(image, retry);
  return frame;
}

function tagChip(tag) {
  const chip = element("span", `discover-tag discover-tag--${tag.group}`, tag.name);
  chip.dataset.tagId = tag.id;
  return chip;
}

function avatarImage(user, sizeClass = "") {
  const image = element("img", `discover-avatar ${sizeClass}`.trim());
  image.src = user.avatarUrl;
  image.alt = `${user.handle} 프로필 사진`;
  image.width = 46;
  image.height = 46;
  return image;
}

function brand(screenId) {
  const wrap = element("div", "discover-brand");
  const mark = element("img", "discover-brand__mark");
  mark.src = `/app-preview/assets/discover/${screenId === "b1" ? "logo-b1" : "logo"}.png`;
  mark.alt = "";
  wrap.append(mark, element("strong", "", "Doripe"));
  return wrap;
}

function feedHeader(screenId) {
  const header = element("header", "discover-feed-header");
  const tabs = element("div", "discover-tabs");
  const discover = actionButton("Discover", "show-discover", { value: "discover" }, screenId === "b2" ? "is-selected" : "");
  discover.textContent = "Discover";
  const following = actionButton("팔로잉", "show-following", { value: "following" }, screenId === "b1" ? "is-selected" : "");
  following.textContent = "팔로잉";
  tabs.append(discover, following);
  const filter = actionButton("필터", "open-filter", { value: "menu" }, "discover-filter-button");
  const filterIcon = element("img", "discover-filter-button__icon");
  filterIcon.src = "/app-preview/assets/discover/filter.png";
  filterIcon.alt = "";
  const downIcon = element("img", "discover-filter-button__down");
  downIcon.src = "/app-preview/assets/discover/down.png";
  downIcon.alt = "";
  filter.append(filterIcon, element("span", "", "필터"), downIcon);
  header.append(brand(screenId), tabs, filter);

  return header;
}

const FEED_HEIGHTS = [210, 84, 168, 92, 82, 96, 152, 136, 108, 86, 106, 116, 96];
const FEED_RECTS = Object.freeze({
  b1: [
    [24, 178, 166, 221], [198, 178, 166, 124], [24, 407, 166, 93],
    [198, 310, 166, 221], [24, 508, 166, 124], [198, 539, 166, 93],
    [24, 640, 166, 166], [198, 640, 166, 260], [24, 814, 166, 221],
    [198, 908, 166, 166], [24, 1043, 166, 93]
  ],
  b2: [
    [19.949, 82, 171.563, 210], [195.503, 82, 177.548, 84], [195.503, 168, 177.548, 168],
    [19.949, 294, 171.563, 92], [195.503, 338, 177.548, 82], [19.949, 388, 171.563, 96],
    [195.503, 424, 177.548, 152], [19.949, 486, 171.563, 136], [195.503, 578, 177.548, 68],
    [19.949, 624, 171.563, 86], [195.503, 648, 177.548, 106], [19.949, 712, 171.563, 116],
    [195.503, 756, 177.548, 72]
  ],
  b3: [
    [13.964, 82, 179.543, 208], [197.497, 82, 181.538, 82], [197.497, 170, 181.538, 148],
    [13.964, 294, 179.543, 86], [197.497, 322, 181.538, 124], [13.964, 384, 179.543, 94],
    [197.497, 452, 181.538, 108], [13.964, 482, 179.543, 134], [197.497, 564, 181.538, 98],
    [13.964, 620, 179.543, 92], [197.497, 666, 181.538, 74], [13.964, 716, 179.543, 118],
    [197.497, 744, 181.538, 90]
  ]
});

const CONTINUATION_HEIGHTS = Object.freeze([124, 221, 93, 166, 260, 136, 108, 152]);

function extendedFeedRects(screenId, count) {
  const base = FEED_RECTS[screenId].map((rect) => [...rect]);
  if (count <= base.length) return base.slice(0, count);

  const columns = [...new Set(base.map(([x]) => x))].map((x) => {
    const rects = base.filter((rect) => rect[0] === x);
    return {
      x,
      width: rects[0][2],
      bottom: Math.max(...rects.map((rect) => rect[1] + rect[3]))
    };
  });

  for (let index = base.length; index < count; index += 1) {
    const column = columns.reduce((shortest, candidate) => candidate.bottom < shortest.bottom ? candidate : shortest);
    const height = CONTINUATION_HEIGHTS[index % CONTINUATION_HEIGHTS.length];
    const y = column.bottom + 8;
    base.push([column.x, y, column.width, height]);
    column.bottom = y + height;
  }
  return base;
}

function mediaTile(media, height, rect) {
  const place = byId(PLACES, media.placeId);
  const button = actionButton(`${place.name} 콘텐츠 열기`, "open-place", {
    placeId: place.id,
    mediaId: media.id
  }, "discover-feed-tile");
  button.dataset.testid = "media-tile";
  button.style.setProperty("--tile-height", `${height}px`);
  if (rect) {
    button.style.setProperty("--tile-x", `${rect[0]}px`);
    button.style.setProperty("--tile-y", `${rect[1]}px`);
    button.style.setProperty("--tile-width", `${rect[2]}px`);
    button.style.setProperty("--tile-height", `${rect[3]}px`);
  }
  button.append(semanticMedia(media, "discover-feed-tile__media", { width: 180, height }));
  return button;
}

function masonryFeed(screenId, state) {
  const feed = element("div", "discover-feed");
  feed.dataset.testid = "discover-feed";
  feed.dataset.layout = screenId;
  const feedStatus = state?.selections?.feedStatus || "ready";
  if (feedStatus !== "ready") {
    feed.dataset.feedStatus = feedStatus;
    if (feedStatus === "loading") {
      const timeout = setTimeout(() => {
        if (feed.isConnected) document.dispatchEvent(new CustomEvent(FEED_STATUS_EVENT, { detail: { status: "error" } }));
      }, 8000);
      feed.addEventListener("app-preview:screen-teardown", () => clearTimeout(timeout), { once: true });
      for (let index = 0; index < 6; index += 1) feed.append(element("span", "discover-feed-skeleton"));
    } else if (feedStatus === "error") {
      feed.append(feedStatusMessage("피드를 불러오지 못했어요", true));
    } else {
      feed.append(feedStatusMessage("조건에 맞는 장소가 아직 없어요"));
    }
    return feed;
  }
  const filter = state?.selections?.feedFilter;
  const filterTagId = filter === "quiet" ? "tag-quiet" : filter === "date" ? "tag-date" : null;
  const visibleMedia = MEDIA.filter((media) => {
    if (!filter || filter === "all" || filter === "menu") return true;
    const place = byId(PLACES, media.placeId);
    return filterTagId ? place.tagIds.includes(filterTagId) : true;
  });
  const rects = extendedFeedRects(screenId, visibleMedia.length);
  visibleMedia.forEach((media, index) => feed.append(mediaTile(media, FEED_HEIGHTS[index % FEED_HEIGHTS.length], rects[index])));
  const spacer = element("span", "discover-feed__spacer");
  spacer.style.setProperty("--feed-end", `${Math.max(...rects.map((rect) => rect[1] + rect[3])) + 16}px`);
  feed.append(spacer);
  return feed;
}

function feedStatusMessage(message, retryable = false) {
  const status = element("div", "discover-feed-status");
  status.append(element("p", "", message));
  if (retryable) {
    const retry = localButton("피드 다시 시도", "discover-feed-status__retry");
    retry.textContent = "다시 시도";
    retry.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent(FEED_STATUS_EVENT, { detail: { status: "ready" } }));
    });
    status.append(retry);
  }
  return status;
}

function followingStrip() {
  const strip = element("div", "discover-following-strip");
  const avatars = element("span", "discover-following-strip__avatars");
  USERS.slice(0, 4).forEach((user) => {
    const profile = actionButton(`${user.handle} 프로필 보기`, "open-profile", { userId: user.id }, "discover-following-strip__profile");
    profile.append(avatarImage(user));
    avatars.append(profile);
  });
  avatars.append(element("span", "discover-following-strip__more", "+8"));
  const list = actionButton("팔로잉 목록 보기", "open-following-list", {}, "discover-following-strip__list");
  list.append(element("strong", "", "팔로잉 목록 보기"), iconAsset("back", "discover-following-strip__arrow"));
  strip.append(avatars, list);
  return strip;
}

function renderFeed(screenId, state) {
  const root = screenRoot(screenId, "discover-feed-screen");
  root.dataset.measureKey = screenId === "b1" ? "Header / top bar" : "Feed / masonry grid";
  root.append(feedHeader(screenId));
  if (screenId === "b1") root.append(followingStrip());
  root.append(masonryFeed(screenId, state));
  if (screenId === "b1") {
    const topVisual = element("img", "discover-scroll-top-visual");
    topVisual.src = "/app-preview/assets/discover/figma-scroll-top.svg";
    topVisual.alt = "";
    topVisual.setAttribute("aria-hidden", "true");
    const top = actionButton("맨 위로", "scroll-to-top", {}, "discover-scroll-top");
    top.addEventListener("click", () => root.querySelector("[data-testid=discover-feed]")?.scrollTo({ top: 0, behavior: "smooth" }));
    root.append(topVisual, top);
  }
  if (state?.overlays?.includes("feed-filter-sheet")) {
    const filters = renderFilters(state);
    filters.classList.add("discover-filter-overlay");
    filters.dataset.testid = "feed-filter-sheet";
    filters.dataset.sourceScreen = "c3";
    root.append(filters);
  }
  return root;
}

function renderOtherMedia(state) {
  const root = screenRoot("b3", "discover-grid-screen");
  root.dataset.measureKey = "Feed / masonry grid";
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-circle-back");
  addBackIcon(back);
  root.append(back);
  const place = selectedPlace(state);
  const feed = element("div", "discover-feed");
  feed.dataset.testid = "discover-feed";
  feed.dataset.layout = "b3";
  mediaForPlace(place).forEach((media, index) => {
    feed.append(mediaTile(media, FEED_HEIGHTS[index], FEED_RECTS.b3[index]));
  });
  root.append(feed);
  return root;
}

function heroActions(screenId, place, media, state) {
  const actions = element("div", "discover-hero-actions");
  const liked = state?.likedMediaIds?.includes(media.id);
  const like = actionButton(liked ? "좋아요 취소" : "좋아요", "toggle-media-like", { mediaId: media.id }, "discover-round-action");
  const likeAsset = element("img", "discover-round-action__asset");
  likeAsset.src = `/app-preview/assets/discover/figma-hero-like${["b6", "b10"].includes(screenId) ? `-${screenId}` : ""}.svg`;
  likeAsset.alt = "";
  like.append(likeAsset);
  const comments = actionButton("댓글 보기", "open-comments", { placeId: place.id }, "discover-round-action");
  const commentAsset = element("img", "discover-round-action__asset");
  commentAsset.src = `/app-preview/assets/discover/figma-hero-comment${["b6", "b10"].includes(screenId) ? `-${screenId}` : ""}.svg`;
  commentAsset.alt = "";
  comments.append(commentAsset);
  actions.append(like, comments);
  return actions;
}

function infoRow(label, value, action, data, iconText) {
  const row = actionButton(`${label} 보기`, action, data, "discover-info-row");
  row.dataset.infoLabel = label;
  const iconNode = element("img", "discover-info-row__asset");
  iconNode.src = `/app-preview/assets/discover/figma-info-${label === "주소" ? "location" : label === "영업시간" ? "clock" : "menu"}.svg`;
  iconNode.alt = "";
  const chevron = element("img", "discover-info-row__chevron");
  chevron.src = "/app-preview/assets/discover/figma-info-chevron.svg";
  chevron.alt = "";
  row.append(iconNode, element("span", "discover-info-row__label", label), element("span", "discover-info-row__value", value), chevron);
  return row;
}

function commentItem(comment, state, compact = false) {
  const user = byId(USERS, comment.userId);
  const item = element("article", `discover-comment ${compact ? "is-compact" : ""}`.trim());
  const profile = actionButton(`${user.handle} 프로필 보기`, "open-profile", { userId: user.id }, "discover-comment__profile");
  profile.append(avatarImage(user), element("strong", "", user.handle));
  const body = element("p", "", comment.body);
  const liked = state?.likedCommentIds?.includes(comment.id);
  const like = actionButton(`${user.handle} 댓글 좋아요`, "toggle-comment-like", { commentId: comment.id }, "discover-comment__like");
  const likeIcon = element("img", "discover-comment__like-icon");
  likeIcon.src = "/app-preview/assets/discover/figma-comment-like.svg";
  likeIcon.alt = "";
  if (liked) likeIcon.classList.add("is-liked");
  like.append(likeIcon, element("span", "", String(comment.likeCount + (liked ? 1 : 0))));
  item.append(profile, element("time", "", "2일 전"), body, like);
  return item;
}

function placeSummary(place, screenId) {
  const summary = element("div", "discover-place-summary");
  if (["b4", "b6"].includes(screenId)) summary.append(semanticMedia(mediaForPlace(place)[1], "discover-place-summary__thumb", { width: 86, height: 96 }));
  const text = element("div", "discover-place-summary__text");
  const official = actionButton("장소 공식 화면", "open-official-place", { placeId: place.id }, "discover-place-title");
  official.textContent = place.name;
  text.append(official, element("small", "", "소품샵 · 연남"));
  const tags = element("div", "discover-tags");
  tagsForPlace(place).slice(0, 4).forEach((tag) => tags.append(tagChip(tag)));
  text.append(tags);
  summary.append(text);
  return summary;
}

function bindSheetGesture(sheet) {
  const handle = sheet.querySelector(".discover-sheet-handle");
  const dragZone = sheet.querySelector(".discover-sheet-drag-zone");
  const states = ["collapsed", "medium", "expanded"];
  let startY = 0;
  let active = false;
  let suppressPointerClick = false;

  const moveTo = (direction) => {
    const currentIndex = Math.max(0, states.indexOf(sheet.dataset.sheetState));
    const nextIndex = Math.max(0, Math.min(states.length - 1, currentIndex + direction));
    sheet.dataset.sheetState = states[nextIndex];
    sheet.style.removeProperty("--sheet-drag-y");
    document.dispatchEvent(new CustomEvent(DETAIL_SHEET_STATE_EVENT, {
      detail: { state: sheet.dataset.sheetState }
    }));
  };

  dragZone.addEventListener("pointerdown", (event) => {
    active = true;
    startY = event.clientY;
    suppressPointerClick = true;
    dragZone.setPointerCapture?.(event.pointerId);
    sheet.dataset.dragging = "true";
    event.preventDefault();
  });
  dragZone.addEventListener("pointermove", (event) => {
    if (!active) return;
    const distance = Math.max(-140, Math.min(140, event.clientY - startY));
    sheet.style.setProperty("--sheet-drag-y", `${distance}px`);
  });
  dragZone.addEventListener("pointerup", (event) => {
    if (!active) return;
    active = false;
    const distance = event.clientY - startY;
    delete sheet.dataset.dragging;
    if (distance <= -56) moveTo(1);
    else if (distance >= 56) moveTo(-1);
    else sheet.style.removeProperty("--sheet-drag-y");
    setTimeout(() => { suppressPointerClick = false; }, 0);
  });
  dragZone.addEventListener("pointercancel", () => {
    active = false;
    delete sheet.dataset.dragging;
    sheet.style.removeProperty("--sheet-drag-y");
    suppressPointerClick = false;
  });
  handle.addEventListener("click", (event) => {
    if (!suppressPointerClick) return;
    suppressPointerClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  });
  handle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveTo(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveTo(-1);
    }
  });
}

function placeSheet(screenId, place, state) {
  const sheet = element("section", "discover-place-sheet");
  sheet.dataset.testid = "place-sheet";
  sheet.dataset.placeId = place.id;
  const defaultSheetState = screenId === "b6" || screenId === "b10"
    ? "expanded"
    : screenId === "b5" ? "collapsed" : "medium";
  const rememberedSheetState = state?.selections?.detailSheetState;
  sheet.dataset.sheetState = ["collapsed", "medium", "expanded"].includes(rememberedSheetState)
    ? rememberedSheetState
    : defaultSheetState;
  if (["b5", "b6", "b10"].includes(screenId)) sheet.dataset.measureKey = "Sheet / background";
  const handle = actionButton("장소 상세 닫기", "close-place", {}, "discover-sheet-handle");
  const dragZone = element("div", "discover-sheet-drag-zone");
  dragZone.append(handle);
  sheet.append(dragZone, placeSummary(place, screenId));
  sheet.append(
    infoRow("주소", place.address, "open-place-map", { placeId: place.id }, "⌖"),
    infoRow("영업시간", "매일 12:00 - 20:00", "open-business-hours", { placeId: place.id }, "◷"),
    infoRow("대표 메뉴", "오브젝트 셀렉션 · 18,000원", "open-menu", { placeId: place.id }, "♜")
  );
  const actions = element("div", "discover-place-actions");
  const share = actionButton("공유하기", "open-share", { type: "place", id: place.id }, "discover-outline-action");
  const shareIcon = element("img", "discover-place-action__icon");
  shareIcon.src = ["b6", "b10"].includes(screenId)
    ? `/app-preview/assets/discover/figma-share-${screenId}.svg`
    : "/app-preview/assets/discover/figma-share-icon.svg";
  shareIcon.alt = "";
  share.append(shareIcon, element("span", "", "공유하기"));
  const saved = state?.savedPlaceIds?.includes(place.id);
  const save = actionButton(saved ? "저장됨" : "저장하기", "save-place", { placeId: place.id }, "discover-fill-action");
  const saveIcon = element("img", "discover-place-action__icon");
  saveIcon.src = ["b6", "b10"].includes(screenId)
    ? `/app-preview/assets/discover/figma-save-${screenId}.svg`
    : "/app-preview/assets/discover/figma-save-icon.svg";
  saveIcon.alt = "";
  save.append(saveIcon, element("span", "", saved ? "저장됨" : "저장하기"));
  actions.append(share, save);
  sheet.append(actions);

  const commentsHeader = element("div", "discover-section-title");
  commentsHeader.classList.add("discover-detail-comments-title");
  commentsHeader.append(element("strong", "", "댓글"));
  const moreComments = actionButton("댓글 더보기", "open-comments", {}, "discover-text-action");
  moreComments.textContent = "더보기 ›";
  commentsHeader.append(moreComments);
  sheet.append(commentsHeader);
  COMMENTS.filter((comment) => comment.placeId === place.id).slice(0, 2).forEach((comment, index) => {
    const item = commentItem(comment, state, true);
    item.classList.add("discover-detail-comment");
    item.dataset.commentIndex = String(index);
    sheet.append(item);
  });

  const otherHeader = element("div", "discover-section-title");
  otherHeader.classList.add("discover-detail-other-title");
  otherHeader.append(element("strong", "", "이 장소의 다른 사진들"));
  const other = actionButton("다른 사진 전체보기", "open-other-media", {}, "discover-text-action");
  other.textContent = "전체보기 ›";
  otherHeader.append(other);
  sheet.append(otherHeader);
  const mediaStrip = element("div", "discover-media-strip");
  const stripMedia = mediaForPlace(place).slice(1, 5);
  stripMedia.forEach((media) => {
    const button = actionButton(`${media.alt} 보기`, "open-photo", { mediaId: media.id }, "discover-media-strip__item");
    const uploader = byId(USERS, media.userId);
    const credit = element("span", "discover-media-credit");
    credit.append(avatarImage(uploader), element("span", "", uploader.handle));
    button.append(semanticMedia(media, "", { width: 171, height: 58 }));
    if (screenId !== "b10") button.append(credit);
    mediaStrip.append(button);
  });
  sheet.append(mediaStrip);

  if (["b4", "b5", "b6"].includes(screenId)) {
    const related = element("div", "discover-section-title");
    related.classList.add("discover-detail-related-title");
    related.append(element("strong", "", "관련 장소"));
    sheet.append(related, relatedMiniCards(place));
  }
  if (screenId === "b10") {
    const relatedHeader = element("div", "discover-section-title discover-related-header");
    relatedHeader.append(element("strong", "", "관련 장소"));
    const relatedAll = actionButton("관련 장소 전체보기", "open-related-places", {}, "discover-text-action");
    relatedAll.textContent = "전체보기 ›";
    relatedHeader.append(relatedAll);
    sheet.append(relatedHeader);
  }
  if (["b4", "b5", "b6", "b10"].includes(screenId)) {
    const route = actionButton("이 장소로 코스 만들기", "create-route", { placeId: place.id }, "discover-create-route");
    if (screenId !== "b10") route.dataset.actionScreenId = "b6";
    const routeIcon = element("img", "discover-create-route__icon");
    routeIcon.src = `/app-preview/assets/discover/figma-route-${screenId === "b10" ? "b10" : "b6"}.svg`;
    routeIcon.alt = "";
    route.append(routeIcon, element("span", "", "이 장소로 코스 만들기"));
    sheet.append(route);
  }
  bindSheetGesture(sheet);
  return sheet;
}

function relatedMiniCards(place) {
  const wrap = element("div", "discover-related-mini");
  PLACES.filter((item) => item.id !== place.id).slice(0, 2).forEach((item) => {
    const button = actionButton(`${item.name} 열기`, "open-related-place", { placeId: item.id }, "discover-related-mini__card");
    const distance = element("span", "discover-related-mini__distance");
    distance.append(iconAsset("map-pin", ""), element("span", "", `${item.walkingMinutes * 20}m`));
    const chips = element("span", "discover-related-mini__tags");
    tagsForPlace(item).slice(0, 2).forEach((tag) => chips.append(tagChip(tag)));
    button.append(
      semanticMedia(mediaForPlace(item)[0], "", { width: 62, height: 62 }),
      element("strong", "", item.name),
      element("span", "discover-related-mini__chevron", "›"),
      element("small", "discover-related-mini__meta", "연남동"),
      distance,
      chips
    );
    wrap.append(button);
  });
  return wrap;
}

function renderPlaceDetail(screenId, state) {
  const place = selectedPlace(state);
  const selectedMedia = byId(MEDIA, state?.selections?.selectedMediaId);
  const media = selectedMedia?.placeId === place.id ? selectedMedia : mediaForPlace(place)[0];
  const root = screenRoot(screenId, "discover-detail-screen");
  if (screenId === "b4") root.dataset.measureKey = "Content / place detail screen";
  const heroButton = actionButton(`${place.name} 사진 확대`, "open-photo", { mediaId: media.id }, "discover-detail-hero");
  heroButton.append(semanticMedia(media, "", { width: 393, height: 388, eager: true }));
  const author = actionButton(`${byId(USERS, media.userId).handle} 프로필 보기`, "open-profile", { userId: media.userId }, "discover-author-pill");
  author.append(avatarImage(byId(USERS, media.userId)), element("span", "", byId(USERS, media.userId).handle));
  root.append(heroButton, author, heroActions(screenId, place, media, state), placeSheet(screenId, place, state));
  return root;
}

function renderPhotoViewer(state) {
  const place = selectedPlace(state);
  const items = mediaForPlace(place);
  const selectedId = state?.selections?.selectedMediaId || items[0].id;
  let index = Math.max(0, items.findIndex((media) => media.id === selectedId));
  const root = screenRoot("b7", "discover-viewer");
  root.dataset.measureKey = "overlay / black dim / opacity 78";
  const dots = element("div", "discover-viewer__dots");
  const mediaFrame = element("div", "discover-viewer__frame");
  const close = actionButton("사진 닫기", "close-photo", {}, "discover-viewer__close");
  close.append(iconAsset("close", "discover-close-icon"));
  const previous = localButton("이전 사진", "discover-viewer__previous");
  const next = localButton("다음 사진", "discover-viewer__next");
  previous.textContent = "‹";
  next.textContent = "›";

  const update = () => {
    mediaFrame.replaceChildren(semanticMedia(items[index], "discover-viewer__media", {
      width: 345, height: 612, eager: true, testId: "viewer-media", mediaId: items[index].id
    }));
    dots.replaceChildren(...items.slice(0, 5).map((_, dotIndex) => element("span", dotIndex === index ? "is-active" : "")));
    for (const link of root.querySelectorAll('link[rel="preload"]')) link.remove();
    for (let offset = 1; offset <= 2; offset += 1) {
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "image";
      preload.href = items[(index + offset) % items.length].src;
      root.append(preload);
    }
  };
  const step = (amount) => { index = (index + amount + items.length) % items.length; update(); };
  previous.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  let dragStart = null;
  mediaFrame.addEventListener("pointerdown", (event) => { dragStart = { x: event.clientX, time: performance.now() }; });
  mediaFrame.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    const distance = event.clientX - dragStart.x;
    const velocity = distance / Math.max(performance.now() - dragStart.time, 1);
    dragStart = null;
    if (Math.abs(distance) >= 56 || Math.abs(velocity) >= 0.65) step(distance < 0 ? 1 : -1);
  });
  mediaFrame.addEventListener("pointercancel", () => { dragStart = null; });
  root.append(dots, close, previous, mediaFrame, next);
  update();
  return root;
}

function renderComments(state) {
  const place = selectedPlace(state);
  const submittedComments = (state?.submittedComments || []).filter((comment) => comment.placeId === place.id);
  const displayedComments = [
    ...COMMENTS.filter((comment) => comment.placeId === place.id),
    ...submittedComments
  ];
  const root = screenRoot("b8", "discover-overlay-screen");
  root.dataset.measureKey = "overlay / black dim background";
  const sheet = element("section", "discover-comments-sheet");
  sheet.append(element("span", "discover-sheet-handle"));
  const close = actionButton("댓글 닫기", "close-comments", {}, "discover-circle-back");
  addBackIcon(close);
  const title = element("h1", "", "댓글");
  title.append(element("span", "", ` ${displayedComments.length}`));
  const list = element("div", "discover-comments-list");
  list.dataset.testid = "comment-list";
  displayedComments.forEach((comment) => list.append(commentItem(comment, state)));
  const composer = element("div", "discover-comment-composer");
  const input = element("input", "");
  input.type = "text";
  input.placeholder = "댓글 추가하기";
  input.value = state?.form?.comment || "";
  input.dataset.action = "update-comment";
  const submit = actionButton("댓글 등록", "submit-comment", { placeId: place.id }, "discover-submit-comment");
  submit.textContent = "↑";
  composer.append(input, submit);
  sheet.append(close, title, list, composer);
  root.append(sheet);
  return root;
}

function renderHours() {
  const root = screenRoot("b9", "discover-overlay-screen");
  root.dataset.measureKey = "overlay / black dim background";
  const sheet = element("section", "discover-hours-sheet");
  sheet.append(element("span", "discover-sheet-handle"));
  const close = actionButton("영업시간 닫기", "close-business-hours", {}, "discover-circle-back");
  addBackIcon(close);
  sheet.append(close, element("h1", "", "영업시간"));
  const hours = [["월", "12:00 - 20:00"], ["화", "12:00 - 20:00"], ["수", "12:00 - 20:00"], ["목", "12:00 - 20:00"], ["금", "12:00 - 21:00"], ["토", "11:00 - 21:00"], ["일", "11:00 - 19:00"]];
  const table = element("dl", "discover-hours-list");
  hours.forEach(([day, time]) => table.append(element("dt", "", day), element("dd", "", time)));
  sheet.append(table, element("p", "discover-hours-note", "방문 전 운영시간을 한 번 더 확인해주세요"));
  root.append(sheet);
  return root;
}

function renderRelatedPlaces(state) {
  const current = selectedPlace(state);
  const root = screenRoot("b11", "discover-related-screen");
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-circle-back");
  addBackIcon(back);
  const query = element("header", "discover-related-query");
  query.dataset.measureKey = "Hero query card";
  query.append(element("strong", "", `${current.name}에서 가까운 곳`), tagChip(tagsForPlace(current)[0]), tagChip(byId(TAGS, "tag-yeonnam")));
  const grid = element("div", "discover-related-grid");
  PLACES.filter((place) => place.id !== current.id).slice(0, 6).forEach((place) => {
    const card = element("article", "discover-related-card");
    card.dataset.testid = "related-place";
    const open = actionButton(`${place.name} 공식 화면`, "open-place", { placeId: place.id }, "discover-related-card__open");
    open.append(semanticMedia(mediaForPlace(place)[0], "", { width: 176, height: 112 }), element("strong", "", place.name), element("p", "", place.summary));
    const liked = state?.likedPlaceIds?.includes(place.id);
    const like = actionButton(`${place.name} ${liked ? "좋아요 취소" : "좋아요"}`, "toggle-place-like", { placeId: place.id }, "discover-related-card__like");
    like.textContent = `${liked ? "♥" : "♡"} ${place.savedCount}`;
    const chips = element("div", "discover-tags");
    tagsForPlace(place).slice(0, 2).forEach((tag) => chips.append(tagChip(tag)));
    card.append(open, like, chips, element("small", "", `♙ 도보 ${place.walkingMinutes}분`));
    grid.append(card);
  });
  root.append(back, query, grid);
  return root;
}

function renderProfile(state) {
  const user = selectedUser(state);
  const content = MEDIA.filter((media) => media.userId === user.id);
  const items = content.slice(0, 7);
  const root = screenRoot("b12", "discover-profile-screen");
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-circle-back");
  addBackIcon(back);
  const header = element("header", "discover-profile-header");
  const avatar = avatarImage(user, "discover-profile-avatar");
  avatar.dataset.measureKey = "profile/avatar";
  const info = element("div", "discover-profile-info");
  info.append(element("h1", "", user.handle), element("p", "", user.bio));
  const followed = state?.followedUserIds?.includes(user.id);
  const follow = actionButton(followed ? "언팔로우" : "팔로우", "toggle-follow", { userId: user.id }, "discover-follow-button");
  follow.textContent = followed ? "팔로잉" : "팔로우";
  info.append(follow);
  header.append(avatar, info);
  const stats = element("dl", "discover-profile-stats");
  [["팔로워", "1.2K"], ["장소", "48"], ["코스", "7"]].forEach(([label, value]) => {
    const item = element("div", "");
    item.append(element("dt", "", label), element("dd", "", value));
    stats.append(item);
  });
  const grid = element("div", "discover-profile-grid");
  items.forEach((media, index) => {
    const button = actionButton(`${media.alt} 콘텐츠 열기`, "open-content", {
      placeId: media.placeId,
      mediaId: media.id
    }, "discover-profile-content");
    button.dataset.testid = "profile-content";
    button.append(semanticMedia(media, "", { width: index % 2 ? 164 : 173, height: FEED_HEIGHTS[index] || 150 }));
    grid.append(button);
  });
  root.append(back, header, stats, grid);
  return root;
}

function renderFollowing(state) {
  const root = screenRoot("b13", "discover-following-screen");
  root.dataset.measureKey = "E7 rebuilt editable content";
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-square-back");
  addBackIcon(back);
  const title = element("h1", "", "팔로잉 목록");
  const followedIds = new Set(state?.followedUserIds || []);
  const followedUsers = USERS.filter((user) => followedIds.has(user.id));
  root.append(back, title, element("p", "discover-following-count", `${followedUsers.length}명 팔로잉`));
  const list = element("div", "discover-following-list");
  if (followedUsers.length === 0) list.append(element("p", "discover-following-empty", "아직 팔로우한 계정이 없어요"));
  followedUsers.forEach((user) => {
    const row = element("article", "discover-following-user");
    row.dataset.testid = "following-user";
    const profile = actionButton(`${user.handle} 프로필 보기`, "open-profile", { userId: user.id }, "discover-following-user__profile");
    profile.append(avatarImage(user), element("strong", "", user.handle), element("span", "", user.bio));
    const photos = element("div", "discover-following-user__photos");
    MEDIA.filter((media) => media.userId === user.id).slice(0, 3).forEach((media) => photos.append(semanticMedia(media, "", { width: 43, height: 43 })));
    profile.append(photos);
    const follow = actionButton("언팔로우", "toggle-follow", { userId: user.id }, "discover-follow-button is-outline");
    follow.textContent = "팔로잉";
    row.append(profile, follow);
    list.append(row);
  });
  root.append(list);
  return root;
}

export const DISCOVER_RENDERERS = Object.freeze({
  b1: (state) => renderFeed("b1", state),
  b2: (state) => renderFeed("b2", state),
  b3: renderOtherMedia,
  b4: (state) => renderPlaceDetail("b4", state),
  b5: (state) => renderPlaceDetail("b5", state),
  b6: (state) => renderPlaceDetail("b6", state),
  b7: renderPhotoViewer,
  b8: renderComments,
  b9: renderHours,
  b10: (state) => renderPlaceDetail("b10", state),
  b11: renderRelatedPlaces,
  b12: renderProfile,
  b13: renderFollowing
});
