import { createBottomNav, icon as componentIcon } from "../components.js";
import {
  commentsForContent,
  contentById,
  courseById,
  mediaById,
  mediaForPlace as selectMediaForPlace,
  placeById,
  profileById,
  tagsFor,
  viewerProfile
} from "../data/selectors.js";
import { renderFilters } from "./saved.js";
import { placeMatchesLocationFilter } from "../data/location-filter.js";

const NODE_IDS = Object.freeze({
  b1: "446:507", b2: "446:596", b3: "446:646", b4: "446:682",
  b5: "446:818", b6: "446:876", b7: "446:1000", b8: "446:1017",
  b9: "446:1070", b10: "446:1106", b11: "446:2667",
  b12: "446:2792", b13: "446:3042"
});
const FEED_STATUS_EVENT = "app-preview:feed-status";
const DETAIL_SHEET_STATE_EVENT = "app-preview:detail-sheet-state";
const FEED_FILTER_DISMISS_EVENT = "app-preview:feed-filter-dismiss";
const SELECTION_CLEAR_EVENT = "app-preview:selection-clear";

const selectedPlace = (state, data) => {
  const selectedId = state?.selections?.selectedPlaceId;
  if (selectedId === null) return null;
  if (typeof selectedId === "string") return placeById(data, selectedId);
  return data.places[0] || null;
};
const selectedUser = (state, data) => {
  const selectedId = state?.selections?.selectedUserId;
  if (selectedId === null) return null;
  if (typeof selectedId === "string") return profileById(data, selectedId);
  return viewerProfile(data) || null;
};
const mediaForPlace = (data, place) => selectMediaForPlace(data, place);
const tagsForPlace = (data, place) => tagsFor(data, place);

function selectedContent(state, data, type) {
  const matchesType = (content) => content && (!type || content.type === type);
  const explicit = contentById(data, state?.selections?.selectedContentId);
  if (matchesType(explicit)) return explicit;

  const selectedMediaId = state?.selections?.selectedMediaId;
  const byMedia = selectedMediaId
    ? data.contents.find((content) => matchesType(content) && content.mediaIds?.includes(selectedMediaId))
    : null;
  if (byMedia) return byMedia;

  const selectedRouteId = state?.selections?.selectedRouteId;
  const routeMatches = selectedRouteId
    ? data.contents.filter((content) => matchesType(content) && content.courseId === selectedRouteId)
    : [];
  if (routeMatches.length === 1) return routeMatches[0];

  const selectedPlaceId = state?.selections?.selectedPlaceId;
  const placeMatches = selectedPlaceId
    ? data.contents.filter((content) => matchesType(content) && content.placeId === selectedPlaceId)
    : [];
  return placeMatches.length === 1 ? placeMatches[0] : null;
}

function contentForSelectedPlace(state, data, place) {
  const content = selectedContent(state, data, "place");
  if (content?.placeId === place?.id) return content;
  const matches = data.contents.filter((item) => item.type === "place" && item.placeId === place?.id);
  return matches.length === 1 ? matches[0] : null;
}

const contentMedia = (data, content) => (content?.mediaIds || [])
  .map((mediaId) => mediaById(data, mediaId))
  .filter(Boolean);

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
  const template = document.createElement("template");
  template.innerHTML = componentIcon(name, { decorative: true, size: 24 });
  const image = template.content.firstElementChild;
  if (className) image.className = `${image.className} ${className}`;
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

function unavailableScreen(screenId, message) {
  const root = screenRoot(screenId, "discover-unavailable-screen");
  const closeAction = ["b4", "b5", "b6", "b10"].includes(screenId)
    ? "close-place"
    : screenId === "b7"
      ? "close-photo"
      : screenId === "b8"
        ? "close-comments"
        : screenId === "b9" ? "close-business-hours" : "go-back";
  const back = actionButton("뒤로 가기", closeAction, {}, "discover-circle-back");
  addBackIcon(back);
  root.append(back, element("h1", "", message), element("p", "", "목록으로 돌아가 다른 콘텐츠를 선택해 주세요."));
  return root;
}

function semanticMedia(media, className = "", options = {}) {
  const frame = element("span", `discover-media ${className}`.trim());
  frame.dataset.loadState = "loading";
  if (options.testId) frame.dataset.testid = options.testId;
  if (options.mediaId) frame.dataset.mediaId = options.mediaId;

  const image = element("img", "discover-media__image");
  const fallbackSrc = media?.fallbackSrc || "/app-preview/assets/discover/feed-1.jpg";
  const primarySrc = media?.src || fallbackSrc;
  let fallbackAttempted = primarySrc === fallbackSrc;
  image.src = primarySrc;
  image.alt = media?.alt || "장소 사진";
  image.decoding = "async";
  image.draggable = false;
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
  image.addEventListener("error", () => {
    if (!fallbackAttempted) {
      fallbackAttempted = true;
      frame.dataset.loadState = "loading";
      image.src = fallbackSrc;
      return;
    }
    markFailed();
  });
  retry.addEventListener("click", () => {
    frame.dataset.loadState = "loading";
    retry.hidden = true;
    fallbackAttempted = primarySrc === fallbackSrc;
    image.src = `${primarySrc.split("?")[0]}?retry=${Date.now()}`;
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

function authorChip(user, className = "discover-feed-author") {
  const chip = element("span", className);
  chip.dataset.authorKind = user.isCurator ? "curator" : "user";
  chip.append(avatarImage(user), element("span", `${className}__name`, user.name));
  if (user.isCurator) {
    const badge = element("span", `${className}__badge`);
    badge.title = "Doripe 공식 큐레이터";
    badge.setAttribute("aria-label", "공식 큐레이터");
    badge.append(iconAsset("official-badge"));
    chip.append(badge);
  }
  return chip;
}

function createDetailSocialOverlay({
  contentType,
  user,
  liked = false,
  likeAction,
  likeData = {},
  likeLabel,
  onLike,
  commentAction,
  commentData = {},
  commentLabel,
  legacyProfileClass = "",
  legacyActionsClass = ""
}) {
  const overlay = element("div", "discover-detail-social");
  overlay.dataset.testid = "detail-social-overlay";
  overlay.dataset.contentType = contentType;

  const profile = element("button", `discover-detail-social__profile ${legacyProfileClass}`.trim());
  profile.type = "button";
  const updateProfile = (nextUser) => {
    if (!nextUser) {
      profile.hidden = true;
      profile.replaceChildren();
      delete profile.dataset.action;
      delete profile.dataset.userId;
      profile.removeAttribute("aria-label");
      return;
    }
    profile.hidden = false;
    profile.dataset.action = "open-profile";
    profile.dataset.userId = nextUser.id;
    profile.setAttribute("aria-label", `${nextUser.name} 프로필 보기`);
    const profilePill = authorChip(nextUser, "discover-detail-social__profile-pill");
    profilePill.querySelector(".discover-detail-social__profile-pill__badge")
      ?.classList.add("discover-detail-social__badge");
    profile.replaceChildren(profilePill);
  };
  updateProfile(user);

  const actions = element("div", `discover-detail-social__actions ${legacyActionsClass}`.trim());
  const like = likeAction
    ? actionButton(likeLabel, likeAction, likeData, "discover-detail-social__action")
    : localButton(likeLabel, "discover-detail-social__action");
  like.dataset.socialAction = "like";
  like.setAttribute("aria-pressed", String(liked));
  like.append(iconAsset("heart"));
  if (onLike) like.addEventListener("click", onLike);

  const comments = commentAction
    ? actionButton(commentLabel, commentAction, commentData, "discover-detail-social__action")
    : localButton(commentLabel, "discover-detail-social__action");
  comments.dataset.socialAction = "comments";
  comments.append(iconAsset("message-circle"));
  actions.append(like, comments);
  overlay.append(profile, actions);

  const updateMediaContext = ({ user: nextUser, liked: nextLiked, mediaId }) => {
    updateProfile(nextUser);
    like.dataset.mediaId = mediaId;
    like.setAttribute("aria-pressed", String(nextLiked));
    like.setAttribute("aria-label", nextLiked ? "좋아요 취소" : "좋아요");
  };

  return { overlay, like, comments, updateMediaContext };
}

function connectDetailSocialOverlay(sheet, socialOverlay) {
  const syncState = () => {
    socialOverlay.dataset.sheetState = sheet.dataset.sheetState;
  };
  const setDragging = (dragging) => {
    if (dragging) socialOverlay.dataset.dragging = "true";
    else delete socialOverlay.dataset.dragging;
  };
  const setDragY = (distance) => {
    const value = `${distance}px`;
    const fill = `${Math.max(0, -distance)}px`;
    sheet.style.setProperty("--sheet-drag-y", value);
    sheet.style.setProperty("--sheet-drag-fill", fill);
    socialOverlay.style.setProperty("--sheet-drag-y", value);
  };
  const clearDragY = () => {
    sheet.style.removeProperty("--sheet-drag-y");
    sheet.style.removeProperty("--sheet-drag-fill");
    socialOverlay.style.removeProperty("--sheet-drag-y");
  };
  syncState();
  return { clearDragY, setDragging, setDragY, syncState };
}

function brand(screenId) {
  const wrap = element("div", "discover-brand");
  const mark = element("img", "discover-brand__mark");
  mark.src = `/app-preview/assets/discover/${screenId === "b1" ? "logo-b1" : "logo"}.png`;
  mark.alt = "";
  wrap.append(mark, element("strong", "", "Doripe"));
  return wrap;
}

const NEIGHBORHOOD_LABELS = Object.freeze({
  yeonnam: "연남",
  seongsu: "성수",
  yongsan: "용산"
});

const PLACE_SOURCE_LABELS = Object.freeze({
  "instagram-saved": "인스타 저장",
  "naver-map-saved": "네이버 지도 저장",
  "blog-search": "블로그 검색",
  "friend-recommendation": "지인 추천",
  "search-as-needed": "그때그때 검색",
  "good-fit": "취향 추천"
});

const DISTANCE_ORIENTED_SOURCES = new Set([
  "naver-map-saved",
  "blog-search",
  "search-as-needed"
]);

const SOCIAL_ORIENTED_SOURCES = new Set([
  "instagram-saved",
  "friend-recommendation"
]);

function feedOrdering(data) {
  const placeOrder = new Map(data.places.map((place, index) => [place.id, index]));
  const newestMediaByPlace = new Map(data.places.map((place) => [
    place.id,
    Math.max(...data.media
      .filter((media) => media.placeId === place.id)
      .map((media) => Date.parse(media.createdAt) || 0), 0)
  ]));
  return { placeOrder, newestMediaByPlace };
}

function comparePlacesForSource(first, second, placeSource, ordering) {
  if (DISTANCE_ORIENTED_SOURCES.has(placeSource)) {
    return first.walkingMinutes - second.walkingMinutes
      || ordering.placeOrder.get(first.id) - ordering.placeOrder.get(second.id);
  }
  if (SOCIAL_ORIENTED_SOURCES.has(placeSource)) {
    return ordering.newestMediaByPlace.get(second.id) - ordering.newestMediaByPlace.get(first.id)
      || second.savedCount - first.savedCount
      || ordering.placeOrder.get(first.id) - ordering.placeOrder.get(second.id);
  }
  return 0;
}

function placeForContent(data, content) {
  const media = contentMedia(data, content)[0];
  if (media?.placeId) return placeById(data, media.placeId);
  if (content?.placeId) return placeById(data, content.placeId);
  const course = courseById(data, content?.courseId);
  return placeById(data, course?.placeIds?.[0]);
}

function orderContentsForPreference(data, contents, placeSource) {
  if (!DISTANCE_ORIENTED_SOURCES.has(placeSource) && !SOCIAL_ORIENTED_SOURCES.has(placeSource)) {
    return contents;
  }
  const ordering = feedOrdering(data);
  const contentOrder = new Map(data.contents.map((content, index) => [content.id, index]));
  return [...contents].sort((first, second) => {
    const firstPlace = placeForContent(data, first);
    const secondPlace = placeForContent(data, second);
    return comparePlacesForSource(firstPlace, secondPlace, placeSource, ordering)
      || contentOrder.get(first.id) - contentOrder.get(second.id);
  });
}

function feedHeader(screenId, state) {
  const header = element("header", "discover-feed-header");
  const tabs = element("div", "discover-tabs");
  const discover = actionButton("Discover", "show-discover", { value: "discover" }, screenId === "b2" ? "is-selected" : "");
  discover.textContent = "Discover";
  const following = actionButton("팔로잉", "show-following", { value: "following" }, screenId === "b1" ? "is-selected" : "");
  following.textContent = "팔로잉";
  tabs.append(discover, following);
  const neighborhoodLabel = null;
  const placeSourceLabel = screenId === "b2" ? PLACE_SOURCE_LABELS[state?.selections?.placeSource] : null;
  const filterLabel = neighborhoodLabel ? `${neighborhoodLabel} 필터` : "필터";
  const accessibleFilterLabel = [neighborhoodLabel, placeSourceLabel, "필터"].filter(Boolean).join(" · ");
  const filter = actionButton(accessibleFilterLabel, "open-filter", { value: "menu" }, "discover-filter-button");
  if (neighborhoodLabel) filter.dataset.neighborhood = state.selections.feedNeighborhood;
  if (placeSourceLabel) filter.title = `${neighborhoodLabel || "선택 지역"} · ${placeSourceLabel}`;
  const filterIcon = iconAsset("saved-sliders", "discover-filter-button__icon");
  const downIcon = iconAsset("route-chevron-down", "discover-filter-button__down");
  filter.append(filterIcon, element("span", "", filterLabel), downIcon);
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
const B3_MEDIA_TILE_HEIGHT = 350;

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

function otherMediaRects(count) {
  const columns = FEED_RECTS.b3.slice(0, 2).map(([x, y, width]) => ({ x, y, width }));
  return Array.from({ length: count }, () => {
    const column = columns.reduce((shortest, candidate) => candidate.y < shortest.y ? candidate : shortest);
    const rect = [column.x, column.y, column.width, B3_MEDIA_TILE_HEIGHT];
    column.y += B3_MEDIA_TILE_HEIGHT + 8;
    return rect;
  });
}

function contentTile(data, content, height, rect) {
  const media = contentMedia(data, content)[0];
  const route = content.type === "course" ? courseById(data, content.courseId) : null;
  const place = placeForContent(data, content);
  const author = profileById(data, content.authorProfileId)
    || profileById(data, media?.userId)
    || profileById(data, route?.userId)
    || data.profiles[0];
  const button = content.type === "course"
    ? actionButton(`${route.name} 코스 열기`, "open-route-post", {
      routeId: route.id,
      contentId: content.id
    }, "discover-feed-tile")
    : actionButton(`${place.name} 콘텐츠 열기`, "open-place", {
      placeId: place.id,
      mediaId: media.id,
      contentId: content.id
    }, "discover-feed-tile");
  button.dataset.testid = "media-tile";
  button.dataset.contentId = content.id;
  button.dataset.feedType = content.type === "course" ? "route" : "place";
  button.dataset.authorKind = author.isCurator ? "curator" : "user";
  if (content.type !== "course") button.dataset.placeId = place.id;
  button.dataset.mediaId = media.id;
  if (content.type === "course") {
    button.dataset.routeId = route.id;
  }
  button.style.setProperty("--tile-height", `${height}px`);
  if (rect) {
    button.style.setProperty("--tile-x", `${rect[0]}px`);
    button.style.setProperty("--tile-y", `${rect[1]}px`);
    button.style.setProperty("--tile-width", `${rect[2]}px`);
    button.style.setProperty("--tile-height", `${rect[3]}px`);
  }
  button.append(
    semanticMedia(media, "discover-feed-tile__media", { width: 180, height }),
    authorChip(author)
  );
  if (content.type === "course") button.append(element("span", "discover-feed-type-label", "코스"));
  return button;
}

function placeMediaTile(data, media, height, rect) {
  const place = placeById(data, media.placeId);
  const content = data.contents.find((item) => item.type === "place" && item.mediaIds?.includes(media.id));
  const author = profileById(data, media.userId)
    || profileById(data, content?.authorProfileId)
    || data.profiles[0];
  const button = actionButton(`${place.name} 콘텐츠 열기`, "open-place", {
    placeId: place.id,
    mediaId: media.id,
    contentId: content?.id
  }, "discover-feed-tile");
  button.dataset.testid = "media-tile";
  button.dataset.feedType = "place";
  button.dataset.authorKind = author.isCurator ? "curator" : "user";
  button.dataset.placeId = place.id;
  button.dataset.mediaId = media.id;
  if (content) button.dataset.contentId = content.id;
  button.style.setProperty("--tile-height", `${height}px`);
  if (rect) {
    button.style.setProperty("--tile-x", `${rect[0]}px`);
    button.style.setProperty("--tile-y", `${rect[1]}px`);
    button.style.setProperty("--tile-width", `${rect[2]}px`);
    button.style.setProperty("--tile-height", `${rect[3]}px`);
  }
  button.append(
    semanticMedia(media, "discover-feed-tile__media", { width: 180, height }),
    authorChip(author)
  );
  return button;
}

function masonryFeed(screenId, state, data) {
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
  let visibleContents = data.contents.filter((content) => {
    if (!["place", "course"].includes(content.type)) return false;
    return Boolean(contentMedia(data, content)[0] && placeForContent(data, content));
  });
  visibleContents = visibleContents.filter((content) => placeMatchesLocationFilter(placeForContent(data, content), state?.selections));
  visibleContents = visibleContents.filter((content) => {
    if (!filter || filter === "all" || filter === "menu") return true;
    const place = placeForContent(data, content);
    return filterTagId ? place.tagIds.includes(filterTagId) : true;
  });
  if (visibleContents.length === 0) {
    feed.dataset.feedStatus = "empty";
    feed.append(feedStatusMessage("조건에 맞는 장소가 아직 없어요"));
    return feed;
  }
  if (screenId === "b2") visibleContents = orderContentsForPreference(data, visibleContents, state?.selections?.placeSource);
  const staticReview = new URLSearchParams(globalThis.location?.search || "").get("static") === "1";
  const feedEntries = staticReview
    ? visibleContents.map((content) => ({ content }))
    : visibleContents.flatMap((content) => {
      if (content.type === "course") return [{ content }];
      return contentMedia(data, content).map((media) => ({ content, media }));
    });
  const rects = extendedFeedRects(screenId, feedEntries.length);
  feedEntries.forEach((entry, index) => {
    const tile = entry.media
      ? placeMediaTile(data, entry.media, FEED_HEIGHTS[index % FEED_HEIGHTS.length], rects[index])
      : contentTile(data, entry.content, FEED_HEIGHTS[index % FEED_HEIGHTS.length], rects[index]);
    feed.append(tile);
  });
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

function followingStrip(data) {
  const strip = element("div", "discover-following-strip");
  const avatars = element("span", "discover-following-strip__avatars");
  data.profiles.slice(0, 4).forEach((user) => {
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

function bindFeedFilterDismiss(overlay) {
  const sheet = overlay.querySelector(".saved-filter-sheet");
  const handle = overlay.querySelector(".saved-handle");
  let startY = 0;
  let active = false;
  let dismissTimer = null;

  const dismiss = () => {
    if (overlay.classList.contains("is-closing")) return;
    overlay.classList.add("is-closing");
    sheet.style.removeProperty("transform");
    dismissTimer = setTimeout(() => {
      document.dispatchEvent(new CustomEvent(FEED_FILTER_DISMISS_EVENT));
    }, 180);
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) dismiss();
  });
  handle.addEventListener("pointerdown", (event) => {
    active = true;
    startY = event.clientY;
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener("pointermove", (event) => {
    if (!active) return;
    const distance = Math.max(0, Math.min(180, event.clientY - startY));
    sheet.style.transform = `translateY(${distance}px)`;
  });
  handle.addEventListener("pointerup", (event) => {
    if (!active) return;
    active = false;
    if (event.clientY - startY >= 56) dismiss();
    else sheet.style.removeProperty("transform");
  });
  handle.addEventListener("pointercancel", () => {
    active = false;
    sheet.style.removeProperty("transform");
  });
  overlay.addEventListener("app-preview:screen-teardown", () => clearTimeout(dismissTimer), { once: true });
}

function courseStop(data, route, placeId, index) {
  const place = placeById(data, placeId);
  const stop = actionButton(`${place.name} 장소 보기`, "open-related-place", {
    placeId: place.id,
    mediaId: place.mediaIds[0]
  }, "discover-course-stop");
  stop.dataset.placeId = place.id;
  stop.append(
    element("span", "discover-course-stop__number", String(index + 1)),
    semanticMedia(mediaForPlace(data, place)[0], "discover-course-stop__media", { width: 84, height: 84 }),
    element("strong", "discover-course-stop__name", place.name)
  );
  const tags = element("span", "discover-course-stop__tags");
  tagsForPlace(data, place).slice(0, 2).forEach((tag) => tags.append(tagChip(tag)));
  stop.append(
    tags,
    element("small", "discover-course-stop__meta", `도보 ${place.walkingMinutes}분`),
    element("span", "discover-course-stop__chevron", "›")
  );
  return stop;
}

function bindCourseSheetGesture(overlay, sheet, socialOverlay) {
  const handle = sheet.querySelector(".discover-sheet-handle");
  const states = ["collapsed", "medium", "expanded"];
  const socialSync = connectDetailSocialOverlay(sheet, socialOverlay);
  let pointerId = null;
  let startY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocityY = 0;

  const close = () => overlay.querySelector('[data-action="close-place"]')?.click();
  const moveTo = (direction) => {
    const currentIndex = Math.max(0, states.indexOf(sheet.dataset.sheetState));
    const nextIndex = Math.max(0, Math.min(states.length - 1, currentIndex + direction));
    sheet.dataset.sheetState = states[nextIndex];
    socialSync.syncState();
    socialSync.clearDragY();
  };
  const move = (event) => {
    if (event.pointerId !== pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - lastTime);
    velocityY = (event.clientY - lastY) / elapsed;
    lastY = event.clientY;
    lastTime = now;
    const distance = Math.max(-160, Math.min(180, event.clientY - startY));
    socialSync.setDragY(distance);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
  };
  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    const distance = event.clientY - startY;
    pointerId = null;
    delete sheet.dataset.dragging;
    socialSync.setDragging(false);
    cleanup();
    if ((distance >= 96 || (distance >= 32 && velocityY >= 0.65)) && sheet.dataset.sheetState === "collapsed") close();
    else if (distance >= 44 || (distance >= 24 && velocityY >= 0.36)) moveTo(-1);
    else if (distance <= -44 || (distance <= -24 && velocityY <= -0.36)) moveTo(1);
    else socialSync.clearDragY();
  };
  const cancel = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    delete sheet.dataset.dragging;
    socialSync.setDragging(false);
    socialSync.clearDragY();
    cleanup();
  };

  handle.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startY = event.clientY;
    lastY = event.clientY;
    lastTime = performance.now();
    velocityY = 0;
    sheet.dataset.dragging = "true";
    socialSync.setDragging(true);
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
  });
  handle.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") moveTo(1);
    if (event.key === "ArrowDown") moveTo(-1);
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  overlay.addEventListener("app-preview:screen-teardown", cleanup, { once: true });
}

function renderCoursePostDetail(routeId, state, data) {
  const matchingContents = data.contents.filter((content) => content.type === "course" && content.courseId === routeId);
  const content = selectedContent(state, data, "course")
    || (matchingContents.length === 1 ? matchingContents[0] : null);
  const route = courseById(data, content?.courseId || routeId);
  if (!route) return unavailableScreen("b4", "코스를 찾을 수 없어요");
  const author = profileById(data, content?.authorProfileId)
    || profileById(data, route.userId)
    || viewerProfile(data);
  const heroPlace = placeById(data, route.placeIds[0]);
  const heroMedia = contentMedia(data, content)[0] || mediaForPlace(data, heroPlace)[0];
  if (!heroMedia) return unavailableScreen("b4", "코스 사진을 찾을 수 없어요");
  const overlay = screenRoot("b4", "discover-course-detail");
  overlay.dataset.testid = "course-detail";
  overlay.dataset.routeId = route.id;
  if (content) overlay.dataset.contentId = content.id;
  overlay.dataset.contentType = "route";
  overlay.dataset.contentOrigin = "user-shared";
  overlay.style.setProperty("--detail-hero-image", `url("${heroMedia.src}")`);
  overlay.tabIndex = -1;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", `${route.name} 코스 상세`);

  const hero = element("div", "discover-course-detail__hero");
  hero.append(semanticMedia(heroMedia, "", { width: 393, height: 524, eager: true }));
  const dots = element("div", "discover-course-detail__dots");
  route.placeIds.forEach((_, index) => dots.append(element("span", index === 0 ? "is-active" : "")));
  const social = createDetailSocialOverlay({
    contentType: "route",
    user: author,
    likeLabel: "코스 좋아요",
    onLike: (event) => {
      const like = event.currentTarget;
      const active = like.getAttribute("aria-pressed") === "true";
      like.setAttribute("aria-pressed", String(!active));
    },
    commentLabel: "코스 댓글 보기",
    legacyProfileClass: "discover-course-author",
    legacyActionsClass: "discover-course-social"
  });
  hero.append(dots);

  const sheet = element("section", "discover-course-sheet");
  sheet.dataset.testid = "course-sheet";
  sheet.dataset.sheetState = "medium";
  const dragZone = element("div", "discover-sheet-drag-zone");
  const handle = localButton("코스 상세 시트 이동", "discover-sheet-handle");
  dragZone.append(handle);
  const close = actionButton("코스 상세 닫기", "close-place", {}, "discover-course-detail__back");
  addBackIcon(close);
  const heading = element("header", "discover-course-heading");
  heading.append(
    element("h1", "", route.name),
    element("p", "", `${route.placeIds.length}곳 · 약 ${route.walkingMinutes + 60}분 · 도보 중심`)
  );
  const tags = element("div", "discover-tags discover-course-tags");
  tagsForPlace(data, route).forEach((tag) => tags.append(tagChip(tag)));
  const actions = element("div", "discover-place-actions");
  const share = actionButton("공유하기", "open-share", { type: "route", id: route.id }, "discover-outline-action");
  const shareIcon = element("img", "discover-place-action__icon");
  shareIcon.src = "/app-preview/assets/discover/figma-share-icon.svg";
  shareIcon.alt = "";
  share.append(shareIcon, element("span", "", "공유하기"));
  const saved = (state?.savedRoutes || []).some((savedRoute) => (
    savedRoute.name === route.name
    && savedRoute.placeIds.length === route.placeIds.length
    && savedRoute.placeIds.every((placeId, index) => placeId === route.placeIds[index])
  ));
  const save = actionButton(saved ? "저장됨" : "저장하기", "save-shared-route", { routeId: route.id }, "discover-fill-action");
  const saveIcon = element("img", "discover-place-action__icon");
  saveIcon.src = "/app-preview/assets/discover/figma-save-icon.svg";
  saveIcon.alt = "";
  save.append(saveIcon, element("span", "", saved ? "저장됨" : "저장하기"));
  actions.append(share, save);
  const stops = element("div", "discover-course-stops");
  route.placeIds.forEach((placeId, index) => stops.append(courseStop(data, route, placeId, index)));
  sheet.append(dragZone, close, heading, tags, actions, stops);
  const commentDialog = element("div", "discover-course-comments");
  commentDialog.hidden = state?.selections?.courseCommentsOpen !== true;
  commentDialog.setAttribute("role", "dialog");
  commentDialog.setAttribute("aria-label", "코스 댓글");
  const commentCard = element("section", "discover-course-comments__card");
  const commentClose = localButton("코스 댓글 닫기", "discover-course-comments__close");
  commentClose.textContent = "×";
  const commentList = element("div", "discover-course-comments__list");
  const courseComments = [
    ...commentsForContent(data, content?.id),
    ...(state?.submittedComments || []).filter((comment) => comment.contentId === content?.id)
  ];
  courseComments.forEach((comment) => {
    const commenter = profileById(data, comment.userId);
    commentList.append(element("p", "", `${commenter?.handle || "사용자"}  ${comment.body}`));
  });
  const commentForm = element("form", "discover-course-comments__form");
  const commentInput = document.createElement("input");
  commentInput.type = "text";
  commentInput.placeholder = "댓글 추가하기";
  commentInput.setAttribute("aria-label", "코스 댓글 입력");
  commentInput.value = state?.form?.courseComment || "";
  commentInput.dataset.action = "update-course-comment";
  const commentSubmit = actionButton("코스 댓글 등록", "submit-course-comment", {
    contentId: content?.id,
    routeId: route.id
  });
  commentSubmit.textContent = "등록";
  commentForm.append(commentInput, commentSubmit);
  commentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    commentSubmit.click();
  });
  commentCard.append(element("h2", "", "코스 댓글"), commentClose, commentList, commentForm);
  commentDialog.append(commentCard);
  const closeComments = () => {
    commentDialog.hidden = true;
    social.comments.setAttribute("aria-expanded", "false");
    document.dispatchEvent(new CustomEvent(SELECTION_CLEAR_EVENT, { detail: { keys: ["courseCommentsOpen"] } }));
  };
  social.comments.setAttribute("aria-expanded", String(!commentDialog.hidden));
  social.comments.addEventListener("click", () => {
    commentDialog.hidden = false;
    social.comments.setAttribute("aria-expanded", "true");
    commentInput.focus();
  });
  commentClose.addEventListener("click", closeComments);
  commentDialog.addEventListener("click", (event) => {
    if (event.target === commentDialog) closeComments();
  });
  overlay.append(hero, social.overlay, sheet, commentDialog);
  bindCourseSheetGesture(overlay, sheet, social.overlay);
  requestAnimationFrame(() => overlay.focus({ preventScroll: true }));
  return overlay;
}

function renderFeed(screenId, state, data) {
  const root = screenRoot(screenId, "discover-feed-screen");
  root.dataset.measureKey = screenId === "b1" ? "Header / top bar" : "Feed / masonry grid";
  root.append(feedHeader(screenId, state));
  if (screenId === "b1") root.append(followingStrip(data));
  root.append(masonryFeed(screenId, state, data));
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
    const filters = renderFilters(state, data);
    filters.classList.add("discover-filter-overlay");
    filters.dataset.testid = "feed-filter-sheet";
    filters.dataset.sourceScreen = "c3";
    filters.querySelector("h1").textContent = "피드에서 볼 장소를 골라보세요";
    filters.querySelector(".saved-filter-sheet__lead").textContent = "지금 보고 싶은 분위기와 상황을 선택하세요";
    const applyFilter = filters.querySelector(".saved-filter-apply");
    applyFilter.setAttribute("aria-label", "필터 적용하기");
    applyFilter.querySelector("span").textContent = "필터 적용하기";
    bindFeedFilterDismiss(filters);
    root.append(filters);
  }
  root.append(createBottomNav({ selectedIndex: 0 }));
  return root;
}

function renderOtherMedia(state, data) {
  const root = screenRoot("b3", "discover-grid-screen");
  root.dataset.measureKey = "Feed / masonry grid";
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-circle-back");
  addBackIcon(back);
  root.append(back);
  const place = selectedPlace(state, data);
  if (!place) return unavailableScreen("b3", "장소를 찾을 수 없어요");
  const feed = element("div", "discover-feed");
  feed.dataset.testid = "discover-feed";
  feed.dataset.layout = "b3";
  const items = mediaForPlace(data, place);
  const rects = otherMediaRects(items.length);
  items.forEach((media, index) => {
    feed.append(placeMediaTile(data, media, FEED_HEIGHTS[index % FEED_HEIGHTS.length], rects[index]));
  });
  const spacer = element("span", "discover-feed__spacer");
  spacer.style.setProperty("--feed-end", `${Math.max(...rects.map((rect) => rect[1] + rect[3])) + 16}px`);
  feed.append(spacer);
  root.append(feed);
  if (new URLSearchParams(globalThis.location?.search || "").get("static") !== "1") {
    root.append(createBottomNav({ selectedIndex: 0 }));
  }
  return root;
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

function commentItem(comment, state, data, compact = false) {
  const user = profileById(data, comment.userId) || {
    id: "unavailable-user",
    handle: "사용자",
    avatarUrl: "/app-preview/assets/discover/avatar-1.png"
  };
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

function placeSummary(data, place, screenId) {
  const summary = element("div", "discover-place-summary");
  const text = element("div", "discover-place-summary__text");
  const official = actionButton("장소 공식 화면", "open-official-place", { placeId: place.id }, "discover-place-title");
  official.textContent = place.name;
  text.append(official);
  const placeTags = tagsForPlace(data, place);
  const descriptors = [
    placeTags.find((tag) => tag.group === "category"),
    placeTags.find((tag) => tag.group === "neighborhood")
  ].filter(Boolean);
  const supportText = descriptors.length > 0
    ? descriptors.map((tag) => tag.name).join(" · ")
    : placeTags[0]?.name || place.address;
  if (supportText) text.append(element("small", "", supportText));
  const tags = element("div", "discover-tags");
  placeTags
    .filter((tag) => tag.group !== "neighborhood")
    .slice(0, 4)
    .forEach((tag) => tags.append(tagChip(tag)));
  text.append(tags);
  summary.append(text);
  return summary;
}

function bindSheetGesture(sheet, socialOverlay) {
  const handle = sheet.querySelector(".discover-sheet-handle");
  const states = ["collapsed", "medium", "expanded"];
  const socialSync = connectDetailSocialOverlay(sheet, socialOverlay);
  let startY = 0;
  let pointerId = null;
  let suppressPointerClick = false;
  let lastY = 0;
  let lastTime = 0;
  let velocityY = 0;
  handle.style.touchAction = "none";

  const moveTo = (direction) => {
    const currentIndex = Math.max(0, states.indexOf(sheet.dataset.sheetState));
    const nextIndex = Math.max(0, Math.min(states.length - 1, currentIndex + direction));
    sheet.dataset.sheetState = states[nextIndex];
    socialSync.syncState();
    socialSync.clearDragY();
    document.dispatchEvent(new CustomEvent(DETAIL_SHEET_STATE_EVENT, {
      detail: { state: sheet.dataset.sheetState }
    }));
  };

  const move = (event) => {
    if (pointerId !== event.pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(1, now - lastTime);
    velocityY = (event.clientY - lastY) / elapsed;
    lastY = event.clientY;
    lastTime = now;
    const distance = Math.max(-140, Math.min(140, event.clientY - startY));
    if (Math.abs(distance) >= 6) suppressPointerClick = true;
    socialSync.setDragY(distance);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
  };
  const finish = (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientY - startY;
    pointerId = null;
    delete sheet.dataset.dragging;
    socialSync.setDragging(false);
    cleanup();
    if (distance <= -44 || (distance <= -24 && velocityY <= -0.36)) moveTo(1);
    else if (distance >= 44 || (distance >= 24 && velocityY >= 0.36)) moveTo(-1);
    else socialSync.clearDragY();
    setTimeout(() => { suppressPointerClick = false; }, 0);
  };
  const cancel = (event) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    delete sheet.dataset.dragging;
    socialSync.setDragging(false);
    socialSync.clearDragY();
    suppressPointerClick = false;
    cleanup();
  };

  handle.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startY = event.clientY;
    lastY = event.clientY;
    lastTime = performance.now();
    velocityY = 0;
    suppressPointerClick = false;
    sheet.dataset.dragging = "true";
    socialSync.setDragging(true);
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
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
  sheet.addEventListener("app-preview:screen-teardown", cleanup, { once: true });
}

function hoursForPlace(place) {
  return Array.isArray(place?.hours)
    ? place.hours.filter((entry) => Array.isArray(entry) && entry.length >= 2)
    : [];
}

function hoursSummary(place) {
  const hours = hoursForPlace(place);
  return hours.length > 0
    ? hours.map(([day, time]) => `${day} ${time}`).join(" · ")
    : "등록된 영업시간 정보가 없어요";
}

function placeSheet(screenId, place, state, data, socialOverlay) {
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
  sheet.append(dragZone, placeSummary(data, place, screenId));
  sheet.append(
    infoRow("주소", place.address, "open-place-map", { placeId: place.id }, "⌖"),
    infoRow("영업시간", hoursSummary(place), "open-business-hours", { placeId: place.id }, "◷"),
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
  const selectedPlaceContent = contentForSelectedPlace(state, data, place);
  const moreComments = actionButton("댓글 더보기", "open-comments", {
    placeId: place.id,
    contentId: selectedPlaceContent?.id
  }, "discover-text-action");
  moreComments.textContent = "더보기 ›";
  commentsHeader.append(moreComments);
  sheet.append(commentsHeader);
  commentsForContent(data, selectedPlaceContent?.id).slice(0, 2).forEach((comment, index) => {
    const item = commentItem(comment, state, data, true);
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
  const stripMedia = mediaForPlace(data, place).slice(1, 5);
  stripMedia.forEach((media) => {
    const button = actionButton(`${media.alt} 보기`, "open-photo", { mediaId: media.id }, "discover-media-strip__item");
    const uploader = profileById(data, media.userId);
    const credit = element("span", "discover-media-credit");
    credit.append(avatarImage(uploader), element("span", "", uploader.handle));
    button.append(semanticMedia(media, "", { width: 171, height: 58 }));
    button.append(credit);
    mediaStrip.append(button);
  });
  sheet.append(mediaStrip);

  if (["b4", "b5", "b6"].includes(screenId)) {
    const related = element("div", "discover-section-title");
    related.classList.add("discover-detail-related-title");
    related.append(element("strong", "", "관련 장소"));
    sheet.append(related, relatedMiniCards(data, place));
  }
  if (screenId === "b10") {
    const relatedHeader = element("div", "discover-section-title discover-related-header");
    relatedHeader.append(element("strong", "", "관련 장소"));
    const relatedAll = actionButton("관련 장소 전체보기", "open-related-places", {}, "discover-text-action");
    relatedAll.textContent = "전체보기 ›";
    relatedHeader.append(relatedAll);
    sheet.append(relatedHeader, relatedMiniCards(data, place));
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
  bindSheetGesture(sheet, socialOverlay);
  return sheet;
}

function relatedMiniCards(data, place) {
  const wrap = element("div", "discover-related-mini");
  data.places.filter((item) => item.id !== place.id).slice(0, 2).forEach((item) => {
    const button = actionButton(`${item.name} 열기`, "open-related-place", { placeId: item.id }, "discover-related-mini__card");
    const distance = element("span", "discover-related-mini__distance");
    distance.append(iconAsset("map-pin", ""), element("span", "", `${item.walkingMinutes * 20}m`));
    const chips = element("span", "discover-related-mini__tags");
    tagsForPlace(data, item)
      .filter((tag) => tag.group !== "neighborhood")
      .slice(0, 2)
      .forEach((tag) => chips.append(tagChip(tag)));
    const neighborhood = tagsForPlace(data, item).find((tag) => tag.group === "neighborhood")?.name || "서울";
    button.append(
      semanticMedia(mediaForPlace(data, item)[0], "", { width: 62, height: 62 }),
      element("strong", "", item.name),
      element("span", "discover-related-mini__chevron", "›"),
      element("small", "discover-related-mini__meta", neighborhood),
      distance,
      chips
    );
    wrap.append(button);
  });
  return wrap;
}

function renderPlaceDetail(screenId, state, data) {
  if (
    screenId === "b4"
    && state?.selections?.routeDetailSource === "feed"
    && state?.selections?.selectedRouteId
    && !state?.selections?.selectedPlaceId
  ) {
    return renderCoursePostDetail(state.selections.selectedRouteId, state, data);
  }
  const place = selectedPlace(state, data);
  if (!place) return unavailableScreen(screenId, "장소를 찾을 수 없어요");
  const selectedPlaceContent = contentForSelectedPlace(state, data, place);
  const items = (screenId === "b10" || !selectedPlaceContent
    ? mediaForPlace(data, place)
    : contentMedia(data, selectedPlaceContent)).slice(0, 5);
  if (items.length === 0) return unavailableScreen(screenId, "장소 사진을 찾을 수 없어요");
  const selectedMedia = mediaById(data, state?.selections?.selectedMediaId);
  const media = selectedMedia?.placeId === place.id ? selectedMedia : items[0];
  let mediaIndex = Math.max(0, items.findIndex((item) => item.id === media.id));
  const root = screenRoot(screenId, "discover-detail-screen");
  root.style.setProperty("--detail-hero-image", `url("${media.src}")`);
  if (screenId === "b4") root.dataset.measureKey = "Content / place detail screen";
  root.dataset.contentType = "place";
  if (selectedPlaceContent) root.dataset.contentId = selectedPlaceContent.id;
  const heroButton = actionButton(`${place.name} 사진 확대`, "open-photo", { mediaId: media.id }, "discover-detail-hero");
  heroButton.append(semanticMedia(media, "discover-detail-hero__media", {
    width: 393,
    height: screenId === "b10" ? 388 : 524,
    eager: true,
    testId: "detail-hero-media",
    mediaId: media.id
  }));
  const dots = element("div", "discover-detail-dots");
  dots.setAttribute("aria-hidden", "true");
  items.forEach((_, index) => {
    const dot = element("span", index === mediaIndex ? "is-active" : "");
    dot.dataset.mediaIndex = String(index);
    dots.append(dot);
  });
  const back = actionButton("피드로 돌아가기", "close-place", {}, "discover-detail-back");
  addBackIcon(back);
  const author = profileById(data, media.userId);
  const social = createDetailSocialOverlay({
    contentType: "place",
    user: author,
    liked: state?.likedMediaIds?.includes(media.id),
    likeAction: "toggle-media-like",
    likeData: { mediaId: media.id },
    likeLabel: state?.likedMediaIds?.includes(media.id) ? "좋아요 취소" : "좋아요",
    commentAction: "open-comments",
    commentData: { placeId: place.id, contentId: selectedPlaceContent?.id },
    commentLabel: "댓글 보기",
    legacyProfileClass: "discover-author-pill",
    legacyActionsClass: "discover-hero-actions"
  });

  const showMedia = (nextIndex, direction = 1) => {
    mediaIndex = (nextIndex + items.length) % items.length;
    const nextMedia = items[mediaIndex];
    const previousFrame = heroButton.querySelector(".discover-media");
    previousFrame?.dispatchEvent(new CustomEvent("app-preview:screen-teardown"));
    const nextFrame = semanticMedia(nextMedia, "discover-detail-hero__media", {
      width: 393,
      height: screenId === "b10" ? 388 : 524,
      eager: true,
      testId: "detail-hero-media",
      mediaId: nextMedia.id
    });
    nextFrame.dataset.slideDirection = direction < 0 ? "previous" : "next";
    heroButton.replaceChildren(nextFrame);
    heroButton.dataset.mediaId = nextMedia.id;
    heroButton.setAttribute("aria-label", `${place.name} 사진 확대, ${mediaIndex + 1}/${items.length}`);
    root.dataset.currentMediaId = nextMedia.id;
    root.style.setProperty("--detail-hero-image", `url("${nextMedia.src}")`);
    [...dots.children].forEach((dot, index) => dot.classList.toggle("is-active", index === mediaIndex));
    const nextUser = profileById(data, nextMedia.userId);
    social.updateMediaContext({
      user: nextUser,
      liked: state?.likedMediaIds?.includes(nextMedia.id),
      mediaId: nextMedia.id
    });
  };

  let pointerId = null;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let suppressClick = false;
  const releasePointer = (event) => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    pointerId = null;
    if (Math.abs(deltaX) >= 44 && Math.abs(deltaX) > Math.abs(deltaY)) {
      suppressClick = true;
      showMedia(mediaIndex + (deltaX < 0 ? 1 : -1), deltaX < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) return;
    const rect = heroButton.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;
    if (position <= 0.34 || position >= 0.66) {
      suppressClick = true;
      const direction = position >= 0.66 ? 1 : -1;
      showMedia(mediaIndex + direction, direction);
    }
  };
  heroButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    suppressClick = false;
    heroButton.setPointerCapture?.(event.pointerId);
  });
  heroButton.addEventListener("pointerup", (event) => {
    releasePointer(event);
    if (heroButton.hasPointerCapture?.(event.pointerId)) heroButton.releasePointerCapture(event.pointerId);
  });
  heroButton.addEventListener("pointercancel", (event) => {
    pointerId = null;
    if (heroButton.hasPointerCapture?.(event.pointerId)) heroButton.releasePointerCapture(event.pointerId);
  });
  heroButton.addEventListener("click", (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  });
  heroButton.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    showMedia(mediaIndex + direction, direction);
  });
  root.addEventListener("app-preview:screen-teardown", () => { pointerId = null; }, { once: true });
  root.append(heroButton, dots, back, social.overlay, placeSheet(screenId, place, state, data, social.overlay));
  return root;
}

function renderPhotoViewer(state, data) {
  const place = selectedPlace(state, data);
  if (!place) return unavailableScreen("b7", "장소를 찾을 수 없어요");
  const items = mediaForPlace(data, place);
  if (items.length === 0) return unavailableScreen("b7", "사진을 찾을 수 없어요");
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
  mediaFrame.addEventListener("pointerdown", (event) => { dragStart = { x: event.clientX }; });
  mediaFrame.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    const distance = event.clientX - dragStart.x;
    dragStart = null;
    if (Math.abs(distance) >= 56) step(distance < 0 ? 1 : -1);
  });
  mediaFrame.addEventListener("pointercancel", () => { dragStart = null; });
  root.append(dots, close, previous, mediaFrame, next);
  update();
  return root;
}

function renderComments(state, data) {
  const place = selectedPlace(state, data);
  if (!place) return unavailableScreen("b8", "장소를 찾을 수 없어요");
  const content = contentForSelectedPlace(state, data, place);
  const placeContentCount = data.contents.filter((item) => item.type === "place" && item.placeId === place.id).length;
  const submittedComments = (state?.submittedComments || []).filter((comment) => (
    comment.contentId === content?.id
    || (!comment.contentId && placeContentCount === 1 && comment.placeId === place.id)
  ));
  const displayedComments = [
    ...commentsForContent(data, content?.id),
    ...submittedComments
  ];
  const visibleCommentRows = Math.min(2, Math.max(1, displayedComments.length));
  const root = screenRoot("b8", "discover-overlay-screen");
  root.dataset.measureKey = "overlay / black dim background";
  const sourceScreenId = [...(state?.history || [])]
    .reverse()
    .find((screenId) => ["b4", "b5", "b6", "b10"].includes(screenId)) || "b4";
  const background = renderPlaceDetail(sourceScreenId, state, data);
  background.classList.add("discover-comments-background");
  background.removeAttribute("data-measure-key");
  background.removeAttribute("data-screen-id");
  background.removeAttribute("data-figma-node");
  background.setAttribute("aria-hidden", "true");
  background.inert = true;

  const backdrop = localButton("댓글 배경 닫기", "discover-comments-backdrop");
  const sheet = element("section", "discover-comments-sheet");
  sheet.dataset.visibleCommentRows = String(visibleCommentRows);
  sheet.style.setProperty("--comments-list-height", `${visibleCommentRows * 76}px`);
  sheet.style.setProperty("--comments-sheet-height", `${222 + (visibleCommentRows * 76)}px`);
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "댓글");
  const handle = localButton("댓글 창 아래로 닫기", "discover-sheet-handle discover-comments-handle");
  sheet.append(handle);
  const close = actionButton("댓글 닫기", "close-comments", {}, "discover-circle-back");
  addBackIcon(close);
  const title = element("h1", "", "댓글");
  title.append(element("span", "", ` ${displayedComments.length}`));
  const list = element("div", "discover-comments-list");
  list.dataset.testid = "comment-list";
  displayedComments.forEach((comment) => list.append(commentItem(comment, state, data)));
  const composer = element("div", "discover-comment-composer");
  const input = element("input", "");
  input.type = "text";
  input.placeholder = "댓글 추가하기";
  input.value = state?.form?.comment || "";
  input.dataset.action = "update-comment";
  const submit = actionButton("댓글 등록", "submit-comment", {
    placeId: place.id,
    contentId: content?.id
  }, "discover-submit-comment");
  submit.append(iconAsset("discover-send", "discover-submit-comment__icon"));
  composer.append(input, submit);
  sheet.append(close, title, list, composer);
  backdrop.addEventListener("click", () => close.click());

  let pointerId = null;
  let startY = 0;
  const resetDrag = () => {
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("--comments-drag-y");
  };
  const onPointerMove = (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - startY);
    sheet.style.setProperty("--comments-drag-y", `${distance}px`);
  };
  const cleanupPointer = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  };
  const onPointerUp = (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - startY);
    pointerId = null;
    cleanupPointer();
    if (distance >= 72) close.click();
    else resetDrag();
  };
  const onPointerCancel = (event) => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    cleanupPointer();
    resetDrag();
  };
  handle.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startY = event.clientY;
    sheet.classList.add("is-dragging");
    handle.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    event.preventDefault();
  });
  handle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    close.click();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close.click();
  });
  root.addEventListener("app-preview:screen-teardown", cleanupPointer, { once: true });
  root.append(background, backdrop, sheet);
  return root;
}

function renderHours(state, data) {
  const place = selectedPlace(state, data);
  if (!place) return unavailableScreen("b9", "장소를 찾을 수 없어요");
  const root = screenRoot("b9", "discover-overlay-screen");
  root.dataset.measureKey = "overlay / black dim background";
  const sheet = element("section", "discover-hours-sheet");
  sheet.append(element("span", "discover-sheet-handle"));
  const close = actionButton("영업시간 닫기", "close-business-hours", {}, "discover-circle-back");
  addBackIcon(close);
  sheet.append(close, element("h1", "", "영업시간"));
  const hours = hoursForPlace(place);
  const table = element("dl", "discover-hours-list");
  hours.forEach(([day, time]) => table.append(element("dt", "", day), element("dd", "", time)));
  const note = hours.length > 0
    ? "방문 전 운영시간을 한 번 더 확인해주세요"
    : "등록된 영업시간 정보가 없어요";
  sheet.append(table, element("p", "discover-hours-note", note));
  root.append(sheet);
  return root;
}

function renderRelatedPlaces(state, data) {
  const current = selectedPlace(state, data);
  if (!current) return unavailableScreen("b11", "장소를 찾을 수 없어요");
  const root = screenRoot("b11", "discover-related-screen");
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-circle-back");
  addBackIcon(back);
  const query = element("header", "discover-related-query");
  query.dataset.measureKey = "Hero query card";
  const queryMedia = mediaForPlace(data, current)[0];
  query.style.setProperty("--related-query-image", `url("${queryMedia.src}")`);
  query.append(element("strong", "", `${current.name}에서 가까운 곳`));
  tagsForPlace(data, current).slice(0, 2).forEach((tag) => query.append(tagChip(tag)));
  const grid = element("div", "discover-related-grid");
  data.places.filter((place) => place.id !== current.id).slice(0, 6).forEach((place) => {
    const card = element("article", "discover-related-card");
    card.dataset.testid = "related-place";
    const open = actionButton(`${place.name} 공식 화면`, "open-place", { placeId: place.id }, "discover-related-card__open");
    open.append(semanticMedia(mediaForPlace(data, place)[0], "", { width: 176, height: 112 }), element("strong", "", place.name), element("p", "", place.summary));
    const liked = state?.likedPlaceIds?.includes(place.id);
    const like = actionButton(`${place.name} ${liked ? "좋아요 취소" : "좋아요"}`, "toggle-place-like", { placeId: place.id }, "discover-related-card__like");
    const likeIcon = iconAsset("heart", "discover-related-card__like-icon");
    likeIcon.classList.toggle("is-liked", liked);
    like.append(likeIcon, element("span", "", String(place.savedCount)));
    const chips = element("div", "discover-tags");
    tagsForPlace(data, place).slice(0, 2).forEach((tag) => chips.append(tagChip(tag)));
    const distance = element("small", "discover-related-card__distance");
    distance.append(iconAsset("saved-directions", "discover-related-card__distance-icon"), element("span", "", `도보 ${place.walkingMinutes}분`));
    card.append(open, like, chips, distance);
    grid.append(card);
  });
  root.append(back, query, grid);
  return root;
}

function renderProfile(state, data) {
  const user = selectedUser(state, data);
  if (!user) return unavailableScreen("b12", "사용자를 찾을 수 없어요");
  const committedProfile = user.id === data.viewerProfileId ? state?.profile : null;
  const handle = committedProfile?.nickname || user.handle;
  const bio = committedProfile?.bio || user.bio;
  const content = data.media.filter((media) => media.userId === user.id);
  const items = content.slice(0, 7);
  const root = screenRoot("b12", "discover-profile-screen");
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-circle-back");
  addBackIcon(back);
  const header = element("header", "discover-profile-header");
  const avatar = avatarImage(user, "discover-profile-avatar");
  avatar.dataset.measureKey = "profile/avatar";
  const info = element("div", "discover-profile-info");
  info.append(element("h1", "", handle), element("p", "", bio));
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

function renderFollowing(state, data) {
  const root = screenRoot("b13", "discover-following-screen");
  root.dataset.measureKey = "E7 rebuilt editable content";
  const back = actionButton("뒤로 가기", "go-back", {}, "discover-square-back");
  addBackIcon(back);
  const title = element("h1", "", "팔로잉 목록");
  const followedIds = new Set(state?.followedUserIds || []);
  const followedUsers = data.profiles.filter((user) => followedIds.has(user.id));
  root.append(back, title, element("p", "discover-following-count", `${followedUsers.length}명 팔로잉`));
  const list = element("div", "discover-following-list");
  if (followedUsers.length === 0) list.append(element("p", "discover-following-empty", "아직 팔로우한 계정이 없어요"));
  followedUsers.forEach((user) => {
    const row = element("article", "discover-following-user");
    row.dataset.testid = "following-user";
    const profile = actionButton(`${user.handle} 프로필 보기`, "open-profile", { userId: user.id }, "discover-following-user__profile");
    profile.append(avatarImage(user), element("strong", "", user.handle), element("span", "", user.bio));
    const photos = element("div", "discover-following-user__photos");
    data.media.filter((media) => media.userId === user.id).slice(0, 3).forEach((media) => photos.append(semanticMedia(media, "", { width: 43, height: 43 })));
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
  b1: (state, data) => renderFeed("b1", state, data),
  b2: (state, data) => renderFeed("b2", state, data),
  b3: renderOtherMedia,
  b4: (state, data) => renderPlaceDetail("b4", state, data),
  b5: (state, data) => renderPlaceDetail("b5", state, data),
  b6: (state, data) => renderPlaceDetail("b6", state, data),
  b7: renderPhotoViewer,
  b8: renderComments,
  b9: renderHours,
  b10: (state, data) => renderPlaceDetail("b10", state, data),
  b11: renderRelatedPlaces,
  b12: renderProfile,
  b13: renderFollowing
});
