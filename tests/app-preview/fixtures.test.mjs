import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMENTS,
  MEDIA,
  PLACES,
  ROUTES,
  TAGS,
  USERS
} from "../../public/app-preview/fixtures.js";
import {
  createFailingFixtureRepository,
  createFixtureRepository,
  getRepository
} from "../../public/app-preview/data/fixture-repository.js";
import {
  createFailingFixtureAdapter,
  createFixtureAdapter,
  getAdapter
} from "../../public/app-preview/api-adapter.js";

const visibleFigmaTagNames = [
  "소품/셀렉",
  "연남",
  "양식",
  "데이트",
  "조용함",
  "브런치",
  "감성적인",
  "음식점",
  "건강한",
  "아늑한",
  "바",
  "카페",
  "카페/디저트",
  "우아함",
  "친구랑",
  "혼자",
  "가족/단체",
  "낮",
  "오후",
  "저녁",
  "밤",
  "대화하기 좋은",
  "세련된",
  "밝은",
  "어두운",
  "도보 10분 안"
];

function assertUniqueIds(items, label) {
  const ids = items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, `${label} has duplicate ids`);
  for (const id of ids) assert.match(id, /^[a-z]+-[a-z0-9-]+$/);
}

test("fixtures meet deterministic inventory minimums and visible Figma tags", () => {
  assert.ok(PLACES.length >= 12);
  assert.ok(MEDIA.length >= 30);
  assert.ok(USERS.length >= 6);
  assert.ok(COMMENTS.length >= 6);
  assert.ok(ROUTES.length >= 3);

  for (const [items, label] of [
    [PLACES, "places"],
    [MEDIA, "media"],
    [USERS, "users"],
    [TAGS, "tags"],
    [COMMENTS, "comments"],
    [ROUTES, "routes"]
  ]) {
    assertUniqueIds(items, label);
    assert.ok(Object.isFrozen(items), `${label} fixture must be frozen`);
  }

  const tagNames = new Set(TAGS.map((tag) => tag.name));
  for (const name of visibleFigmaTagNames) {
    assert.ok(tagNames.has(name), `missing visible Figma tag: ${name}`);
  }
});

test("fixtures contain no orphan references", () => {
  const placeIds = new Set(PLACES.map((place) => place.id));
  const mediaIds = new Set(MEDIA.map((media) => media.id));
  const userIds = new Set(USERS.map((user) => user.id));
  const tagIds = new Set(TAGS.map((tag) => tag.id));

  for (const place of PLACES) {
    assert.ok(userIds.has(place.userId), `${place.id} has an unknown user`);
    assert.ok(place.mediaIds.length > 0, `${place.id} has no media`);
    for (const id of place.mediaIds) assert.ok(mediaIds.has(id), `${place.id} -> ${id}`);
    for (const id of place.tagIds) assert.ok(tagIds.has(id), `${place.id} -> ${id}`);
  }

  for (const media of MEDIA) {
    assert.ok(placeIds.has(media.placeId), `${media.id} has an unknown place`);
    assert.ok(userIds.has(media.userId), `${media.id} has an unknown user`);
  }

  for (const comment of COMMENTS) {
    assert.ok(placeIds.has(comment.placeId), `${comment.id} has an unknown place`);
    assert.ok(userIds.has(comment.userId), `${comment.id} has an unknown user`);
  }

  for (const route of ROUTES) {
    assert.ok(userIds.has(route.userId), `${route.id} has an unknown user`);
    assert.ok(route.placeIds.length > 0, `${route.id} has no places`);
    for (const id of route.placeIds) assert.ok(placeIds.has(id), `${route.id} -> ${id}`);
    for (const id of route.tagIds) assert.ok(tagIds.has(id), `${route.id} -> ${id}`);
  }
});

test("fixture repository returns a cloned normalized snapshot", async () => {
  const repository = createFixtureRepository();
  const bootstrap = await repository.getBootstrap();

  assert.equal(repository.mode, "fixture");
  assert.deepEqual(bootstrap.places, PLACES);
  assert.deepEqual(bootstrap.media, MEDIA);
  assert.deepEqual(bootstrap.profiles, USERS);
  assert.deepEqual(bootstrap.tags, TAGS);
  assert.deepEqual(bootstrap.courses, ROUTES);
  assert.ok(bootstrap.contents.some((item) => item.type === "place"));
  assert.ok(bootstrap.contents.some((item) => item.type === "course"));
  assert.deepEqual(await repository.getFeed(), bootstrap.contents);
  assert.notEqual(bootstrap.places, PLACES);
  assert.notEqual(await repository.getBootstrap(), bootstrap);
});

test("fixture repository exposes deterministic reads, mutations, and failures", async () => {
  const repository = createFixtureRepository();
  const contentId = "content-place-1";

  assert.deepEqual(await repository.getContentDetail(contentId), {
    id: contentId,
    type: "place",
    authorProfileId: "user-1",
    placeId: "place-1",
    courseId: null,
    mediaIds: PLACES[0].mediaIds,
    tagIds: PLACES[0].tagIds
  });
  assert.deepEqual(await repository.getPlaceDetail("place-1"), PLACES[0]);
  assert.deepEqual(await repository.getCourseDetail("route-1"), ROUTES[0]);
  assert.deepEqual(await repository.getPublicProfile("user-1"), USERS[0]);
  assert.deepEqual(await repository.getSavedPlaces({ ids: ["place-2", "place-1"] }), [PLACES[0], PLACES[1]]);
  assert.deepEqual(await repository.getSavedCourses({ ids: ["route-2"] }), [ROUTES[1]]);
  assert.deepEqual(await repository.savePlace("place-1"), { placeId: "place-1", saved: true });
  assert.deepEqual(await repository.unsavePlace("place-1"), { placeId: "place-1", saved: false });
  assert.deepEqual(await repository.saveCourse("route-1"), { courseId: "route-1", saved: true });
  assert.deepEqual(await repository.unsaveCourse("route-1"), { courseId: "route-1", saved: false });
  assert.deepEqual(await repository.followProfile("user-1"), { profileId: "user-1", followed: true });
  assert.deepEqual(await repository.unfollowProfile("user-1"), { profileId: "user-1", followed: false });
  assert.deepEqual(await repository.likeContent(contentId), { contentId, liked: true });
  assert.deepEqual(await repository.unlikeContent(contentId), { contentId, liked: false });
  assert.deepEqual((await repository.getComments(contentId)).map((item) => item.contentId), [contentId, contentId]);
  assert.deepEqual(await repository.createComment(contentId, "새 댓글"), {
    id: "comment-local",
    contentId,
    body: "새 댓글"
  });
  assert.deepEqual(await repository.createCourse({ name: "새 코스" }), { id: "saved-route-1", name: "새 코스" });
  assert.deepEqual(await repository.updateCourse("route-1", { name: "수정 코스" }), { id: "route-1", name: "수정 코스" });
  await assert.rejects(
    repository.getPlaceDetail("missing"),
    (error) => error.code === "FIXTURE_NOT_FOUND" && error.resource === "place" && error.resourceId === "missing"
  );
});

test("adapter compatibility aliases preserve repository modes and failures", async () => {
  const adapter = createFailingFixtureAdapter();

  assert.equal(adapter.mode, "fixture-error");
  assert.deepEqual((await adapter.getBootstrap()).places, PLACES);
  await assert.rejects(
    adapter.savePlace("place-1"),
    (error) => error.code === "FIXTURE_OPERATION_FAILED" && error.operation === "savePlace"
  );
  await assert.rejects(
    adapter.followProfile("user-1"),
    (error) => error.code === "FIXTURE_OPERATION_FAILED" && error.operation === "followProfile"
  );
  assert.equal(createFixtureAdapter().mode, "fixture");
  assert.equal(createFailingFixtureRepository().mode, "fixture-error");
  assert.equal(getAdapter().mode, "fixture");
  assert.equal(getAdapter("fixture").mode, "fixture");
  assert.equal(getAdapter("fixture-error").mode, "fixture-error");
  assert.equal(getRepository().mode, "fixture");
  assert.throws(() => getAdapter("production"), /Unsupported preview repository: production/);
});
