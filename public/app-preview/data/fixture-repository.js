import { COMMENTS, MEDIA, PLACES, ROUTES, TAGS, USERS } from "../fixtures.js";
import { assertRepositoryContract, normalizeDataSnapshot } from "./contracts.js";

const clone = (value) => structuredClone(value);
const placeContentId = (placeId) => `content-${placeId}`;

const findOrThrow = (items, id, resource) => {
  const item = items.find((candidate) => candidate.id === id);
  if (item) return item;
  throw Object.assign(new Error(`Unknown fixture ${resource}: ${id}`), {
    code: "FIXTURE_NOT_FOUND",
    resource,
    resourceId: id
  });
};

function fixtureOperationError(operation) {
  return Object.assign(new Error(`Deterministic fixture failure: ${operation}`), {
    code: "FIXTURE_OPERATION_FAILED",
    operation
  });
}

function snapshotFromFixtures() {
  const contents = [
    ...PLACES.map((place) => ({
      id: placeContentId(place.id),
      type: "place",
      authorProfileId: place.userId,
      placeId: place.id,
      courseId: null,
      mediaIds: [...place.mediaIds],
      tagIds: [...place.tagIds]
    })),
    ...ROUTES.map((course) => ({
      id: `content-${course.id}`,
      type: "course",
      authorProfileId: course.userId,
      placeId: null,
      courseId: course.id,
      mediaIds: course.placeIds
        .map((placeId) => PLACES.find((place) => place.id === placeId)?.mediaIds?.[0])
        .filter(Boolean),
      tagIds: [...course.tagIds]
    }))
  ];

  return normalizeDataSnapshot({
    viewerProfileId: USERS[0]?.id || null,
    places: PLACES,
    media: MEDIA,
    profiles: USERS,
    tags: TAGS,
    courses: ROUTES,
    contents,
    comments: COMMENTS.map((comment) => ({
      ...comment,
      contentId: placeContentId(comment.placeId)
    }))
  });
}

export function createFixtureRepository() {
  const data = snapshotFromFixtures();
  const repository = {
    mode: "fixture",
    async getBootstrap() { return clone(data); },
    async getFeed() { return clone(data.contents); },
    async getContentDetail(id) { return clone(findOrThrow(data.contents, id, "content")); },
    async getPlaceDetail(id) { return clone(findOrThrow(data.places, id, "place")); },
    async getCourseDetail(id) { return clone(findOrThrow(data.courses, id, "course")); },
    async getPublicProfile(id) { return clone(findOrThrow(data.profiles, id, "profile")); },
    async getMyProfile() { return clone(findOrThrow(data.profiles, data.viewerProfileId, "profile")); },
    async updateMyProfile(input) { return { id: data.viewerProfileId, ...clone(input) }; },
    async putMyOnboarding() { return { id: data.viewerProfileId, status: "completed", version: 1 }; },
    async getSavedPlaces({ ids = [] } = {}) { return clone(data.places.filter((item) => ids.includes(item.id))); },
    async getSavedCourses({ ids = [] } = {}) { return clone(data.courses.filter((item) => ids.includes(item.id))); },
    async savePlace(placeId) { findOrThrow(data.places, placeId, "place"); return { placeId, saved: true }; },
    async unsavePlace(placeId) { findOrThrow(data.places, placeId, "place"); return { placeId, saved: false }; },
    async saveCourse(courseId) { findOrThrow(data.courses, courseId, "course"); return { courseId, saved: true }; },
    async unsaveCourse(courseId) { findOrThrow(data.courses, courseId, "course"); return { courseId, saved: false }; },
    async followProfile(profileId) { findOrThrow(data.profiles, profileId, "profile"); return { profileId, followed: true }; },
    async unfollowProfile(profileId) { findOrThrow(data.profiles, profileId, "profile"); return { profileId, followed: false }; },
    async likeContent(contentId) { findOrThrow(data.contents, contentId, "content"); return { contentId, liked: true }; },
    async unlikeContent(contentId) { findOrThrow(data.contents, contentId, "content"); return { contentId, liked: false }; },
    async getComments(contentId) { findOrThrow(data.contents, contentId, "content"); return clone(data.comments.filter((item) => item.contentId === contentId)); },
    async createComment(contentId, body) { findOrThrow(data.contents, contentId, "content"); return { id: "comment-local", contentId, body }; },
    async createCourse(input) { return { id: "saved-route-1", ...clone(input) }; },
    async updateCourse(courseId, input) { return { id: courseId, ...clone(input) }; }
  };

  return Object.freeze(assertRepositoryContract(repository));
}

export function createFailingFixtureRepository() {
  const repository = createFixtureRepository();

  return Object.freeze({
    ...repository,
    mode: "fixture-error",
    async savePlace() { throw fixtureOperationError("savePlace"); },
    async followProfile() { throw fixtureOperationError("followProfile"); }
  });
}

export function getRepository(mode = "fixture") {
  if (mode === "fixture-error") return createFailingFixtureRepository();
  if (mode !== "fixture") throw new Error(`Unsupported preview repository: ${mode}`);
  return createFixtureRepository();
}
