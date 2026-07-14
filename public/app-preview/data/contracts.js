const COLLECTION_KEYS = Object.freeze([
  "places", "media", "profiles", "tags", "comments", "courses", "contents"
]);

const REPOSITORY_METHODS = Object.freeze([
  "getBootstrap", "getFeed", "getContentDetail", "getPlaceDetail",
  "getCourseDetail", "getPublicProfile", "getSavedPlaces", "getSavedCourses",
  "savePlace", "unsavePlace", "saveCourse", "unsaveCourse",
  "followProfile", "unfollowProfile", "likeContent", "unlikeContent",
  "getComments", "createComment", "createCourse", "updateCourse"
]);

export function createEmptyDataSnapshot() {
  return Object.freeze(Object.fromEntries(COLLECTION_KEYS.map((key) => [key, Object.freeze([])])));
}

export function normalizeDataSnapshot(value = {}) {
  return Object.freeze(Object.fromEntries(COLLECTION_KEYS.map((key) => [
    key,
    Object.freeze(structuredClone(Array.isArray(value[key]) ? value[key] : []))
  ])));
}

export function assertRepositoryContract(repository) {
  for (const method of REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== "function") {
      throw new TypeError(`Repository is missing ${method}()`);
    }
  }
  return repository;
}
