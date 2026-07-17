const COLLECTION_KEYS = Object.freeze([
  "places", "media", "profiles", "tags", "comments", "courses", "contents"
]);

const REPOSITORY_METHODS = Object.freeze([
  "getBootstrap", "getFeed", "getContentDetail", "getPlaceDetail",
  "getCourseDetail", "getPublicProfile", "getMyProfile", "getSavedPlaces", "getSavedCourses",
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
    savedPlaceIds: Object.freeze([]),
    savedCourseIds: Object.freeze([]),
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [key, Object.freeze([])]))
  });
}

export function normalizeDataSnapshot(value = {}) {
  return Object.freeze({
    viewerProfileId: typeof value.viewerProfileId === "string" && value.viewerProfileId.length > 0
      ? value.viewerProfileId
      : null,
    personalDataLoaded: value.personalDataLoaded === true,
    savedPlaceIds: normalizeIdList(value.savedPlaceIds),
    savedCourseIds: normalizeIdList(value.savedCourseIds),
    ...Object.fromEntries(COLLECTION_KEYS.map((key) => [
      key,
      Object.freeze(structuredClone(Array.isArray(value[key]) ? value[key] : []))
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
