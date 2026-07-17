import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRepositoryContract,
  createPublicDataSnapshot,
  createEmptyDataSnapshot,
  mergeDataSnapshots,
  normalizeDataSnapshot
} from "../../public/app-preview/data/contracts.js";
import { createAppDataStore } from "../../public/app-preview/data/store.js";
import { createDataCatalog, mediaForPlace, placeById } from "../../public/app-preview/data/selectors.js";

test("normalized snapshots own cloned collections", () => {
  const places = [{ id: "place-1", mediaIds: ["media-1"], tagIds: [] }];
  const snapshot = normalizeDataSnapshot({
    places,
    media: [{ id: "media-1" }],
    personalDataLoaded: true,
    savedPlaceIds: ["place-1", "place-1", ""],
    savedCourseIds: ["course-1", "course-1"]
  });
  assert.notEqual(snapshot.places, places);
  assert.deepEqual(snapshot.places, places);
  assert.equal(snapshot.personalDataLoaded, true);
  assert.deepEqual(snapshot.savedPlaceIds, ["place-1"]);
  assert.deepEqual(snapshot.savedCourseIds, ["course-1"]);
  assert.deepEqual(createEmptyDataSnapshot().contents, []);
  assert.equal(createEmptyDataSnapshot().personalDataLoaded, false);
});

test("selectors resolve relationships by ID", () => {
  const data = normalizeDataSnapshot({
    places: [{ id: "place-1", mediaIds: ["media-1"], tagIds: [] }],
    media: [{ id: "media-1", placeId: "place-1" }]
  });
  assert.equal(placeById(data, "place-1").id, "place-1");
  assert.deepEqual(mediaForPlace(data, data.places[0]).map((item) => item.id), ["media-1"]);
  assert.equal(createDataCatalog(data).isKnownPlaceId("missing"), false);
});

test("repository contract rejects missing methods", () => {
  assert.throws(() => assertRepositoryContract({ getBootstrap() {} }), /getFeed/);
});

test("data snapshot extensions merge by canonical ID without losing personal state", () => {
  const merged = mergeDataSnapshots({
    viewerProfileId: "profile-1",
    personalDataLoaded: true,
    savedPlaceIds: ["place-1"],
    places: [{ id: "place-1", name: "기존 이름", mediaIds: [] }]
  }, {
    places: [
      { id: "place-1", name: "최신 이름", mediaIds: ["media-1"] },
      { id: "place-2", name: "공유 장소", mediaIds: [] }
    ],
    media: [{ id: "media-1", placeId: "place-1", src: "/one.jpg" }]
  });

  assert.equal(merged.viewerProfileId, "profile-1");
  assert.equal(merged.personalDataLoaded, true);
  assert.deepEqual(merged.savedPlaceIds, ["place-1"]);
  assert.deepEqual(merged.places.map((item) => item.id), ["place-1", "place-2"]);
  assert.equal(merged.places[0].name, "최신 이름");
  assert.deepEqual(merged.places[0].mediaIds, ["media-1"]);
});

test("public data snapshots remove account-only entities and personal flags", () => {
  const snapshot = createPublicDataSnapshot({
    viewerProfileId: "profile-viewer",
    personalDataLoaded: true,
    savedPlaceIds: ["place-private"],
    savedCourseIds: ["course-private"],
    ownedCourseIds: ["course-private"],
    feedNextCursor: "next-public-page",
    contents: [
      {
        id: "content-public",
        type: "place",
        authorProfileId: "profile-public",
        placeIds: ["place-public"],
        mediaIds: ["media-public"],
        tagIds: ["tag-public"],
        likedByMe: true
      }
    ],
    places: [
      { id: "place-public", userId: "profile-public", mediaIds: ["media-public"], tagIds: ["tag-public"] },
      { id: "place-private", userId: "profile-private", mediaIds: ["media-private"], tagIds: [] }
    ],
    media: [
      { id: "media-public", placeId: "place-public", userId: "profile-public" },
      { id: "media-private", placeId: "place-private", userId: "profile-private" }
    ],
    profiles: [
      { id: "profile-public", followedByMe: true },
      { id: "profile-private", followedByMe: true }
    ],
    tags: [{ id: "tag-public" }],
    courses: [{ id: "course-private", userId: "profile-private", placeIds: ["place-private"] }],
    comments: [{ id: "comment-private", contentId: "content-private", userId: "profile-private" }]
  });

  assert.equal(snapshot.viewerProfileId, null);
  assert.equal(snapshot.personalDataLoaded, false);
  assert.equal(snapshot.feedNextCursor, "next-public-page");
  assert.deepEqual(snapshot.savedPlaceIds, []);
  assert.deepEqual(snapshot.savedCourseIds, []);
  assert.deepEqual(snapshot.ownedCourseIds, []);
  assert.deepEqual(snapshot.contents.map((item) => item.id), ["content-public"]);
  assert.equal(snapshot.contents[0].likedByMe, false);
  assert.deepEqual(snapshot.places.map((item) => item.id), ["place-public"]);
  assert.deepEqual(snapshot.media.map((item) => item.id), ["media-public"]);
  assert.deepEqual(snapshot.profiles.map((item) => item.id), ["profile-public"]);
  assert.equal(snapshot.profiles[0].followedByMe, false);
  assert.deepEqual(snapshot.courses, []);
  assert.deepEqual(snapshot.comments, []);
});

test("data store exposes loading, ready, and retryable error states", async () => {
  const good = createAppDataStore({
    repository: { getBootstrap: async () => ({ places: [{ id: "place-1" }] }) }
  });
  assert.equal(good.getState().status, "idle");
  await good.load();
  assert.equal(good.getState().status, "ready");
  assert.equal(good.getSnapshot().places[0].id, "place-1");

  const bad = createAppDataStore({
    repository: { getBootstrap: async () => { throw new Error("offline"); } }
  });
  await assert.rejects(bad.load(), /offline/);
  assert.equal(bad.getState().status, "error");
  assert.equal(bad.getState().error.code, "DATA_BOOTSTRAP_FAILED");
});
