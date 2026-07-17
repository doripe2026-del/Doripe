const COLLECTION_KEYS = Object.freeze([
  "places", "media", "profiles", "tags", "comments", "courses", "contents"
]);

const REPOSITORY_METHODS = Object.freeze([
  "getBootstrap", "getFeed", "getFeedSnapshot", "getContentDetail", "getPlaceDetail",
  "getPlaceSnapshot", "getCourseDetail", "getCourseSnapshot", "getPublicProfile", "getMyProfile", "getSavedPlaces", "getSavedCourses",
  "updateMyProfile", "putMyOnboarding",
  "savePlace", "unsavePlace", "saveCourse", "unsaveCourse",
  "followProfile", "unfollowProfile", "likeContent", "unlikeContent",
  "getComments", "createComment", "createCourse", "updateCourse"
]);

function normalizeIdList(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value.filter((id) => typeof id === "string" && id.length > 0))]);
}

export function createEmptyDataSnapshot() {
  return Object.freeze({
    viewerProfileId: null,
    personalDataLoaded: false,
    feedNextCursor: null,
    savedPlaceIds: Object.freeze([]),
    savedCourseIds: Object.freeze([]),
    ownedCourseIds: Object.freeze([]),
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [key, Object.freeze([])]))
  });
}

export function normalizeDataSnapshot(value = {}) {
  return Object.freeze({
    viewerProfileId: typeof value.viewerProfileId === "string" && value.viewerProfileId.length > 0
      ? value.viewerProfileId
      : null,
    personalDataLoaded: value.personalDataLoaded === true,
    feedNextCursor: typeof value.feedNextCursor === "string" && value.feedNextCursor.length > 0
      ? value.feedNextCursor
      : null,
    savedPlaceIds: normalizeIdList(value.savedPlaceIds),
    savedCourseIds: normalizeIdList(value.savedCourseIds),
    ownedCourseIds: normalizeIdList(value.ownedCourseIds),
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [
      key,
      Object.freeze(structuredClone(Array.isArray(value[key]) ? value[key] : []))
    ]))
  });
}

export function mergeDataSnapshots(base = {}, extension = {}) {
  const replacesFeedCursor = Object.prototype.hasOwnProperty.call(extension, "feedNextCursor");
  const current = normalizeDataSnapshot(base);
  const incoming = normalizeDataSnapshot(extension);
  const mergeById = (left, right) => {
    const merged = new Map(left.map((item) => [item.id, item]));
    for (const item of right) merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
    return [...merged.values()];
  };

  return normalizeDataSnapshot({
    ...current,
    viewerProfileId: current.viewerProfileId || incoming.viewerProfileId,
    personalDataLoaded: current.personalDataLoaded || incoming.personalDataLoaded,
    feedNextCursor: replacesFeedCursor ? incoming.feedNextCursor : current.feedNextCursor,
    savedPlaceIds: [...current.savedPlaceIds, ...incoming.savedPlaceIds],
    savedCourseIds: [...current.savedCourseIds, ...incoming.savedCourseIds],
    ownedCourseIds: [...current.ownedCourseIds, ...incoming.ownedCourseIds],
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [
      key,
      mergeById(current[key], incoming[key])
    ]))
  });
}

export function assertRepositoryContract(repository) {
  for (const method of REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== "function") {
      throw new TypeError(`Repository is missing ${method}()`);
    }
  }
  return repository;
}
