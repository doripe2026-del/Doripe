import assert from "node:assert/strict";
import test from "node:test";

import { mergePersonalSnapshotIntoState } from "../../public/app-preview/data/personal-state.js";

test("public snapshots never replace local personal state", () => {
  const state = {
    savedPlaceIds: ["local-place"],
    savedRoutes: [{ id: "local-course", name: "로컬 코스", placeIds: ["place-1", "place-2"] }],
    profile: { id: "local-user", nickname: "로컬", bio: "로컬 소개" }
  };

  const merged = mergePersonalSnapshotIntoState(state, {
    personalDataLoaded: false,
    savedPlaceIds: [],
    savedCourseIds: [],
    profiles: [],
    courses: []
  });

  assert.deepEqual(merged, state);
  assert.notEqual(merged, state);
});

test("authenticated snapshots replace account-owned profile and saves with server truth", () => {
  const state = {
    currentScreenId: "b1",
    savedPlaceIds: ["stale-place"],
    savedRoutes: [{ id: "stale-course", name: "예전 코스", placeIds: ["place-1", "place-2"] }],
    profile: { id: "viewer-1", nickname: "예전 이름", bio: "예전 소개" }
  };
  const snapshot = {
    personalDataLoaded: true,
    viewerProfileId: "viewer-1",
    savedPlaceIds: ["place-1"],
    savedCourseIds: ["course-1"],
    profiles: [{ id: "viewer-1", name: "도리", bio: "서울의 장소를 모아요", avatarUrl: "/dori.jpg" }],
    courses: [{ id: "course-1", name: "연남 코스", placeIds: ["place-1", "place-2"] }]
  };

  const merged = mergePersonalSnapshotIntoState(state, snapshot);

  assert.deepEqual(merged.savedPlaceIds, ["place-1"]);
  assert.deepEqual(merged.savedRoutes, [{ id: "course-1", name: "연남 코스", placeIds: ["place-1", "place-2"] }]);
  assert.deepEqual(merged.profile, {
    id: "viewer-1",
    nickname: "도리",
    bio: "서울의 장소를 모아요",
    avatarUrl: "/dori.jpg"
  });
  assert.deepEqual(state.savedPlaceIds, ["stale-place"]);
});
