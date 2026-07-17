import { assertRepositoryContract, normalizeDataSnapshot } from "./contracts.js";

const CACHE_KEY = "doripe.app_preview.api_snapshot.v1";
const CACHE_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_READ_CACHE_TTL_MS = 30_000;
const DEFAULT_EMPTY_READ_CACHE_TTL_MS = 3_000;
const DEFAULT_SNAPSHOT_CACHE_TTL_MS = 60_000;
const DEFAULT_DETAIL_CONCURRENCY = 4;

const clone = (value) => structuredClone(value);

function apiError(status, body) {
  const error = new Error(body?.error?.message || `API request failed (${status})`);
  error.code = body?.error?.code || "API_REQUEST_FAILED";
  error.status = status;
  return error;
}

function stableTextId(prefix, value) {
  return `${prefix}-${String(value || "unknown")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "unknown"}`;
}

function toProfile(profile = {}) {
  return {
    id: String(profile.id || ""),
    handle: String(profile.nickname || ""),
    name: String(profile.nickname || ""),
    bio: String(profile.introduction || ""),
    avatarUrl: profile.profileImageUrl || "",
    isCurator: Boolean(profile.isCurator),
    officialBadge: Boolean(profile.officialBadge),
    followedByMe: Boolean(profile.followedByMe),
    followerCount: Number(profile.followerCount || 0)
  };
}

function toMedia(media = {}, { userId = null, createdAt = null } = {}) {
  return {
    id: String(media.id || ""),
    placeId: media.placeId || null,
    userId,
    kind: media.kind === "video" ? "video" : "photo",
    src: media.url || media.thumbnailUrl || "",
    fallbackSrc: media.thumbnailUrl || media.url || "",
    alt: "",
    createdAt
  };
}

function toContent(content = {}) {
  return {
    id: String(content.id || ""),
    type: content.type === "course" ? "course" : "place",
    authorProfileId: content.author?.id || null,
    placeId: content.type === "place" ? content.placeIds?.[0] || null : null,
    courseId: content.type === "course" ? content.courseId || null : null,
    mediaIds: (content.media || []).map((item) => item.id).filter(Boolean),
    tagIds: [],
    caption: String(content.caption || ""),
    likedByMe: Boolean(content.likedByMe),
    likeCount: Number(content.likeCount || 0),
    commentCount: Number(content.commentCount || 0)
  };
}

function syntheticTag(name, group) {
  return { id: stableTextId(`tag-${group}`, name), name: String(name), group };
}

function toPlace(place = {}, authorId = null) {
  const categoryTag = place.category?.name
    ? { id: String(place.category.id), name: String(place.category.name), group: "category" }
    : null;
  const tags = [
    categoryTag,
    ...(place.tags || []).map((tag) => ({ id: String(tag.id), name: String(tag.name), group: String(tag.kind || "general") })),
    ...(place.moodTags || []).map((name) => syntheticTag(name, "mood")),
    ...(place.bestFor || []).map((name) => syntheticTag(name, "situation")),
    ...(place.timeTags || []).map((name) => syntheticTag(name, "time"))
  ].filter(Boolean);
  return {
    place: {
      id: String(place.id || ""),
      name: String(place.name || ""),
      userId: authorId,
      tagIds: [...new Set(tags.map((tag) => tag.id))],
      mediaIds: (place.media || []).map((item) => item.id).filter(Boolean),
      address: String(place.address || ""),
      nearestStation: place.nearestStation || null,
      latitude: Number(place.latitude || 0),
      longitude: Number(place.longitude || 0),
      summary: String(place.shortCopy || ""),
      walkingMinutes: null,
      savedCount: 0,
      hoursText: place.hoursText || null,
      representativeMenuName: place.representativeMenuName || place.representativeMenu?.name || null,
      representativeMenuPrice: place.representativeMenuPrice || place.representativeMenu?.price || null,
      externalMapUrl: place.externalMapUrl || null
    },
    tags
  };
}

function toCourse(course = {}) {
  return {
    id: String(course.id || ""),
    name: String(course.name || ""),
    userId: course.ownerId || null,
    placeIds: (course.places || []).map((item) => item.placeId).filter(Boolean),
    tagIds: [],
    walkingMinutes: Number(course.totalTravelMinutes || 0),
    visibility: course.visibility || "private",
    version: Number(course.version || 1)
  };
}

function toComment(comment = {}) {
  return {
    id: String(comment.id || ""),
    contentId: comment.contentId || null,
    placeId: null,
    userId: comment.author?.id || null,
    body: String(comment.text || ""),
    likeCount: Number(comment.likeCount || 0),
    createdAt: comment.createdAt || null
  };
}

function mergeUnique(items, key = "id") {
  const map = new Map();
  for (const item of items) {
    if (item?.[key]) map.set(item[key], { ...(map.get(item[key]) || {}), ...item });
  }
  return [...map.values()];
}

function isEmptyReadResult(value) {
  return value == null
    || (Array.isArray(value) && value.length === 0)
    || (Array.isArray(value?.items) && value.items.length === 0);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

function buildSnapshot({ bootstrap, feed, places, courses }) {
  const contents = (feed || []).map(toContent);
  const authorByPlace = new Map();
  for (const content of feed || []) {
    if (content.type !== "place") continue;
    for (const placeId of content.placeIds || []) authorByPlace.set(placeId, content.author?.id || null);
  }
  const placeResults = (places || []).map((place) => toPlace(place, authorByPlace.get(place.id) || null));
  const profiles = mergeUnique((feed || []).map((content) => toProfile(content.author)));
  const media = mergeUnique([
    ...(feed || []).flatMap((content) => (content.media || []).map((item) => toMedia(item, {
      userId: content.author?.id || null,
      createdAt: content.createdAt || null
    }))),
    ...(places || []).flatMap((place) => (place.media || []).map((item) => toMedia(item, {
      userId: authorByPlace.get(place.id) || null,
      createdAt: place.updatedAt || null
    })))
  ]);
  const bootstrapTags = (bootstrap?.tags || []).map((tag) => ({
    id: String(tag.id), name: String(tag.name), group: String(tag.kind || "general")
  }));
  const categoryTags = (bootstrap?.categories || []).map((category) => ({
    id: String(category.id), name: String(category.name), group: "category"
  }));

  return normalizeDataSnapshot({
    viewerProfileId: null,
    personalDataLoaded: false,
    savedPlaceIds: [],
    savedCourseIds: [],
    places: placeResults.map((result) => result.place),
    media,
    profiles,
    tags: mergeUnique([...bootstrapTags, ...categoryTags, ...placeResults.flatMap((result) => result.tags)]),
    comments: [],
    courses: (courses || []).map(toCourse),
    contents
  });
}

function mergePersonalData(snapshot, { profile, savedPlaceIds, savedCourseIds, places, courses }) {
  const placeResults = places.map((place) => toPlace(place));
  const media = places.flatMap((place) => (place.media || []).map((item) => toMedia(item, {
    createdAt: place.updatedAt || null
  })));
  return normalizeDataSnapshot({
    ...snapshot,
    viewerProfileId: profile.id,
    personalDataLoaded: true,
    savedPlaceIds,
    savedCourseIds,
    places: mergeUnique([...snapshot.places, ...placeResults.map((result) => result.place)]),
    media: mergeUnique([...snapshot.media, ...media]),
    profiles: mergeUnique([...snapshot.profiles, profile]),
    tags: mergeUnique([...snapshot.tags, ...placeResults.flatMap((result) => result.tags)]),
    courses: mergeUnique([...snapshot.courses, ...courses.map(toCourse)])
  });
}

function readCache(storage, now, ttlMs) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(CACHE_KEY) || "null");
    if (parsed?.version !== CACHE_VERSION || !parsed.snapshot) return null;
    const ageMs = now() - Number(parsed.savedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > ttlMs) {
      storage?.removeItem?.(CACHE_KEY);
      return null;
    }
    return normalizeDataSnapshot(parsed.snapshot);
  } catch {
    return null;
  }
}

function writeCache(storage, snapshot, now) {
  try {
    storage?.setItem?.(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, savedAt: now(), snapshot }));
  } catch {
    // A blocked or full cache must not prevent live data from rendering.
  }
}

export function createApiRepository({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  storage = globalThis.localStorage,
  accessTokenProvider = () => null,
  refreshAccessToken,
  onUnauthorized,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = Date.now,
  readCacheTtlMs = DEFAULT_READ_CACHE_TTL_MS,
  emptyReadCacheTtlMs = DEFAULT_EMPTY_READ_CACHE_TTL_MS,
  snapshotCacheTtlMs = DEFAULT_SNAPSHOT_CACHE_TTL_MS,
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("API repository requires fetch");
  let lastLoadSource = "none";
  const readCacheEntries = new Map();
  const pendingReads = new Map();
  const detailRequestLimit = Math.max(1, Math.floor(detailConcurrency));

  async function request(path, { method = "GET", body, auth = false, idempotencyKey } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const token = accessTokenProvider?.() || null;
    if (auth && !token) {
      clearTimeout(timer);
      const error = new Error("로그인이 필요한 기능입니다.");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    try {
      const perform = async (accessToken) => {
        const response = await fetchImpl(`/api/v1/${path}`, {
          method,
          headers: {
            accept: "application/json",
            ...(body === undefined ? {} : { "content-type": "application/json" }),
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
            ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {})
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal
        });
        return { response, payload: await response.json().catch(() => null) };
      };

      let result = await perform(token);
      if (result.response.status === 401 && token && typeof refreshAccessToken === "function") {
        const refreshed = await refreshAccessToken();
        const refreshedToken = refreshed?.ok ? accessTokenProvider?.() || null : null;
        if (refreshedToken) result = await perform(refreshedToken);
        if (!refreshedToken || result.response.status === 401) onUnauthorized?.();
      }
      if (!result.response.ok) throw apiError(result.response.status, result.payload);
      return result.payload?.data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function read(path) {
    const cached = readCacheEntries.get(path);
    if (cached && cached.expiresAt > now()) return clone(cached.value);
    if (cached) readCacheEntries.delete(path);
    if (pendingReads.has(path)) return clone(await pendingReads.get(path));

    const pending = request(path).then((value) => {
      const ttlMs = isEmptyReadResult(value) ? emptyReadCacheTtlMs : readCacheTtlMs;
      if (ttlMs > 0) readCacheEntries.set(path, { value: clone(value), expiresAt: now() + ttlMs });
      return value;
    }).finally(() => pendingReads.delete(path));
    pendingReads.set(path, pending);
    return clone(await pending);
  }

  async function loadBootstrap() {
    const [bootstrap, feedPage] = await Promise.all([
      request("bootstrap"),
      request("feed?scope=discover&limit=50")
    ]);
    const feed = Array.isArray(feedPage?.items) ? feedPage.items : [];
    const placeIds = [...new Set(feed.flatMap((content) => content.placeIds || []))];
    const courseIds = [...new Set(feed.map((content) => content.courseId).filter(Boolean))];
    const details = [
      ...placeIds.map((id) => ({ type: "place", id })),
      ...courseIds.map((id) => ({ type: "course", id }))
    ];
    const detailResults = await mapWithConcurrency(details, detailRequestLimit, ({ type, id }) => (
      read(`${type === "place" ? "places" : "courses"}/${encodeURIComponent(id)}`)
    ));
    const places = detailResults.slice(0, placeIds.length);
    const courses = detailResults.slice(placeIds.length);
    return buildSnapshot({ bootstrap, feed, places, courses });
  }

  async function loadPersonalData(snapshot) {
    const [profileData, placePage, coursePage] = await Promise.all([
      request("me/profile", { auth: true }),
      request("me/saves?targetType=place&limit=50", { auth: true }),
      request("me/saves?targetType=course&limit=50", { auth: true })
    ]);
    const profile = toProfile(profileData);
    const savedPlaceIds = [...new Set((placePage?.items || [])
      .filter((item) => item.targetType === "place")
      .map((item) => item.targetId || item.target?.id)
      .filter(Boolean))];
    const savedCourseIds = [...new Set((coursePage?.items || [])
      .filter((item) => item.targetType === "course")
      .map((item) => item.targetId || item.target?.id)
      .filter(Boolean))];
    const knownPlaceIds = new Set(snapshot.places.map((item) => item.id));
    const knownCourseIds = new Set(snapshot.courses.map((item) => item.id));
    const missingDetails = [
      ...savedPlaceIds.filter((id) => !knownPlaceIds.has(id)).map((id) => ({ type: "place", id })),
      ...savedCourseIds.filter((id) => !knownCourseIds.has(id)).map((id) => ({ type: "course", id }))
    ];
    const details = await mapWithConcurrency(missingDetails, detailRequestLimit, ({ type, id }) => (
      read(`${type === "place" ? "places" : "courses"}/${encodeURIComponent(id)}`)
    ));
    const placeCount = missingDetails.filter((item) => item.type === "place").length;
    const savedPlaces = details.slice(0, placeCount);
    const savedCourses = details.slice(placeCount);
    const fetchedPlaceIds = new Set(savedPlaces.map((item) => item.id));
    const savedCoursePlaceIds = new Set([
      ...snapshot.courses
        .filter((item) => savedCourseIds.includes(item.id))
        .flatMap((item) => item.placeIds || []),
      ...savedCourses.flatMap((item) => (item.places || []).map((coursePlace) => coursePlace.placeId))
    ].filter(Boolean));
    const missingCoursePlaces = [...savedCoursePlaceIds]
      .filter((id) => !knownPlaceIds.has(id) && !fetchedPlaceIds.has(id));
    const coursePlaces = await mapWithConcurrency(
      missingCoursePlaces,
      detailRequestLimit,
      (id) => read(`places/${encodeURIComponent(id)}`)
    );
    return mergePersonalData(snapshot, {
      profile,
      savedPlaceIds,
      savedCourseIds,
      places: [...savedPlaces, ...coursePlaces],
      courses: savedCourses
    });
  }

  async function getBootstrap() {
    let snapshot;
    try {
      snapshot = await loadBootstrap();
      writeCache(storage, snapshot, now);
      lastLoadSource = "network";
    } catch (error) {
      const cached = readCache(storage, now, snapshotCacheTtlMs);
      if (!cached) throw error;
      lastLoadSource = "cache";
      snapshot = cached;
    }

    if (!accessTokenProvider?.()) return clone(snapshot);
    try {
      return clone(await loadPersonalData(snapshot));
    } catch {
      return clone(snapshot);
    }
  }

  let mutationSequence = 0;
  const mutation = (path, method, body) => {
    mutationSequence += 1;
    const randomPart = globalThis.crypto?.randomUUID?.().replaceAll("-", "")
      || `${Date.now().toString(36)}${mutationSequence.toString(36)}`;
    const idempotencyKey = `app_preview_${randomPart}_${mutationSequence.toString(36)}`.slice(0, 80);
    return request(path, { method, body, auth: true, idempotencyKey });
  };
  const repository = {
    mode: "api",
    getLastLoadSource: () => lastLoadSource,
    getBootstrap,
    async getFeed(params = {}) {
      const query = new URLSearchParams({ scope: params.scope || "discover", limit: String(params.limit || 30) });
      const page = await read(`feed?${query}`);
      return (page?.items || []).map(toContent);
    },
    async getContentDetail(id) { return toContent(await read(`contents/${encodeURIComponent(id)}`)); },
    async getPlaceDetail(id) { return toPlace(await read(`places/${encodeURIComponent(id)}`)).place; },
    async getCourseDetail(id) { return toCourse(await read(`courses/${encodeURIComponent(id)}`)); },
    async getPublicProfile(id) { return toProfile(await read(`profiles/${encodeURIComponent(id)}`)); },
    async getMyProfile() { return toProfile(await request("me/profile", { auth: true })); },
    async getSavedPlaces() {
      const page = await request("me/saves?targetType=place&limit=50", { auth: true });
      return (page?.items || [])
        .filter((item) => item.targetType === "place" && item.target)
        .map((item) => toPlace(item.target).place);
    },
    async getSavedCourses() {
      const page = await request("me/saves?targetType=course&limit=50", { auth: true });
      return (page?.items || []).filter((item) => item.targetType === "course" && item.target).map((item) => toCourse(item.target));
    },
    async savePlace(id) { return mutation(`me/saves/place/${encodeURIComponent(id)}`, "PUT", { sourceScreen: "app-preview" }); },
    async unsavePlace(id) { return mutation(`me/saves/place/${encodeURIComponent(id)}`, "DELETE"); },
    async saveCourse(id) { return mutation(`me/saves/course/${encodeURIComponent(id)}`, "PUT", { sourceScreen: "app-preview" }); },
    async unsaveCourse(id) { return mutation(`me/saves/course/${encodeURIComponent(id)}`, "DELETE"); },
    async followProfile(id) { return mutation(`profiles/${encodeURIComponent(id)}/follow`, "POST"); },
    async unfollowProfile(id) { return mutation(`profiles/${encodeURIComponent(id)}/follow`, "DELETE"); },
    async likeContent(id) { return mutation(`contents/${encodeURIComponent(id)}/like`, "POST"); },
    async unlikeContent(id) { return mutation(`contents/${encodeURIComponent(id)}/like`, "DELETE"); },
    async getComments(id) {
      const page = await request(`contents/${encodeURIComponent(id)}/comments?limit=50`);
      return (page?.items || []).map(toComment);
    },
    async createComment(id, body) { return toComment(await mutation(`contents/${encodeURIComponent(id)}/comments`, "POST", { text: body })); },
    async likeComment(id) { return mutation(`comments/${encodeURIComponent(id)}/like`, "POST"); },
    async unlikeComment(id) { return mutation(`comments/${encodeURIComponent(id)}/like`, "DELETE"); },
    async deleteComment(id) { return mutation(`comments/${encodeURIComponent(id)}`, "DELETE"); },
    async createCourse(input) { return toCourse(await mutation("courses", "POST", input)); },
    async updateCourse(id, input) { return toCourse(await mutation(`courses/${encodeURIComponent(id)}`, "PATCH", input)); }
  };

  return Object.freeze(assertRepositoryContract(repository));
}
