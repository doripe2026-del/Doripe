import assert from "node:assert/strict";
import test from "node:test";

import { createActionSync } from "../../public/app-preview/data/action-sync.js";

function state(overrides = {}) {
  return {
    currentScreenId: "b4",
    savedPlaceIds: [],
    savedRoutes: [],
    followedUserIds: [],
    likedCommentIds: [],
    submittedComments: [],
    selections: {},
    form: {},
    toast: null,
    ...overrides
  };
}

test("save actions call the matching repository mutation once while pending", async () => {
  let release;
  let calls = 0;
  const repository = {
    savePlace: async () => {
      calls += 1;
      await new Promise((resolve) => { release = resolve; });
    }
  };
  const sync = createActionSync({ repository, enabled: true });
  const previousState = state();
  const optimisticState = state({ savedPlaceIds: ["place-1"] });
  const input = {
    actionId: "save-place",
    payload: { placeId: "place-1" },
    previousState,
    optimisticState
  };

  const first = sync.run(input);
  const second = sync.run(input);

  assert.equal(sync.isPending(input), true);
  assert.equal(calls, 1);
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.ok, true);
  assert.equal(secondResult.ok, true);
  assert.equal(sync.isPending(input), false);
});

test("failed optimistic mutations restore the prior value and show an error", async () => {
  const repository = {
    followProfile: async () => { throw new Error("offline"); }
  };
  const sync = createActionSync({ repository, enabled: true });
  const previousState = state();
  const optimisticState = state({ followedUserIds: ["profile-1"] });

  const result = await sync.run({
    actionId: "toggle-follow",
    payload: { userId: "profile-1" },
    previousState,
    optimisticState
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.state.followedUserIds, []);
  assert.equal(result.state.toast.kind, "error");
  assert.match(result.state.toast.message, /다시 시도/u);
});

test("active saves, follows, and comment likes call their inverse mutations", async () => {
  const calls = [];
  const repository = {
    unsavePlace: async (id) => { calls.push(["unsave-place", id]); },
    unfollowProfile: async (id) => { calls.push(["unfollow", id]); },
    unlikeComment: async (id) => { calls.push(["unlike-comment", id]); }
  };
  const sync = createActionSync({ repository, enabled: true });

  await sync.run({
    actionId: "save-place",
    payload: { placeId: "place-1" },
    previousState: state({ savedPlaceIds: ["place-1"] }),
    optimisticState: state()
  });
  await sync.run({
    actionId: "toggle-follow",
    payload: { userId: "profile-1" },
    previousState: state({ followedUserIds: ["profile-1"] }),
    optimisticState: state()
  });
  await sync.run({
    actionId: "toggle-comment-like",
    payload: { commentId: "comment-1" },
    previousState: state({ likedCommentIds: ["comment-1"] }),
    optimisticState: state()
  });

  assert.deepEqual(calls, [
    ["unsave-place", "place-1"],
    ["unfollow", "profile-1"],
    ["unlike-comment", "comment-1"]
  ]);
});

test("static fixture mode keeps local state without remote mutations", async () => {
  let calls = 0;
  const sync = createActionSync({
    repository: { savePlace: async () => { calls += 1; } },
    enabled: false
  });
  const optimisticState = state({ savedPlaceIds: ["place-1"] });

  const result = await sync.run({
    actionId: "save-place",
    payload: { placeId: "place-1" },
    previousState: state(),
    optimisticState
  });

  assert.equal(result.status, "local");
  assert.equal(result.state, optimisticState);
  assert.equal(calls, 0);
});

test("signed-out API mode keeps guest changes locally instead of rolling them back", async () => {
  let calls = 0;
  const sync = createActionSync({
    repository: { savePlace: async () => { calls += 1; } },
    enabled: true,
    canSync: () => false
  });
  const optimisticState = state({ savedPlaceIds: ["place-1"] });

  const result = await sync.run({
    actionId: "save-place",
    payload: { placeId: "place-1" },
    previousState: state(),
    optimisticState
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "local");
  assert.equal(result.state, optimisticState);
  assert.equal(calls, 0);
});

test("comment actions use content and comment API contracts", async () => {
  const calls = [];
  const repository = {
    createComment: async (contentId, body) => {
      calls.push(["create", contentId, body]);
      return { id: "comment-server", contentId, body, userId: "viewer-1" };
    },
    likeComment: async (commentId) => { calls.push(["like", commentId]); }
  };
  const sync = createActionSync({ repository, enabled: true });
  const previousCommentState = state({ form: { comment: "좋아요" } });
  const optimisticCommentState = state({
    form: { comment: "" },
    submittedComments: [{ id: "local-comment-1", contentId: "content-1", body: "좋아요" }]
  });

  const commentResult = await sync.run({
    actionId: "submit-comment",
    payload: { contentId: "content-1" },
    previousState: previousCommentState,
    optimisticState: optimisticCommentState
  });
  await sync.run({
    actionId: "toggle-comment-like",
    payload: { commentId: "comment-1" },
    previousState: state(),
    optimisticState: state({ likedCommentIds: ["comment-1"] })
  });

  assert.deepEqual(calls, [
    ["create", "content-1", "좋아요"],
    ["like", "comment-1"]
  ]);
  assert.equal(commentResult.state.submittedComments[0].id, "comment-server");
});

test("API mode prepares an optimistic comment when bootstrap has no viewer profile", () => {
  const sync = createActionSync({ repository: {}, enabled: true });
  const previousState = state({ form: { comment: "댓글" } });
  const transitionState = state({
    form: { comment: "댓글" },
    toast: { kind: "error", message: "내 프로필을 찾을 수 없어요" }
  });

  const optimisticState = sync.prepare({
    actionId: "submit-comment",
    payload: { contentId: "content-1", placeId: "place-1" },
    previousState,
    transitionState
  });

  assert.equal(optimisticState.form.comment, "");
  assert.equal(optimisticState.submittedComments.length, 1);
  assert.equal(optimisticState.submittedComments[0].contentId, "content-1");
  assert.equal(optimisticState.submittedComments[0].placeId, "place-1");
  assert.equal(optimisticState.toast.kind, "success");
});

test("course save and create use existing repository contracts", async () => {
  const calls = [];
  const repository = {
    saveCourse: async (id) => { calls.push(["save", id]); },
    createCourse: async (input) => {
      calls.push(["create", input]);
      return { id: "course-server", version: 1, ...input };
    }
  };
  const sync = createActionSync({ repository, enabled: true });
  const sharedRoute = { id: "course-shared", name: "공유 코스", placeIds: ["place-1", "place-2"] };
  await sync.run({
    actionId: "save-shared-route",
    payload: { routeId: sharedRoute.id, data: { courses: [sharedRoute] } },
    previousState: state(),
    optimisticState: state({ savedRoutes: [{ ...sharedRoute, id: "saved-route-1" }] })
  });

  const previousState = state({
    currentScreenId: "d8",
    routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-2"] },
    form: { routeName: "새 코스" }
  });
  const optimisticState = state({
    currentScreenId: "d9",
    selections: { selectedRouteId: "saved-route-1" },
    savedRoutes: [{ id: "saved-route-1", name: "새 코스", placeIds: ["place-1", "place-2"] }]
  });
  const result = await sync.run({ actionId: "save-route", payload: {}, previousState, optimisticState });

  assert.deepEqual(calls, [
    ["save", "course-shared"],
    ["create", {
      name: "새 코스",
      visibility: "private",
      startPlaceId: "place-1",
      placeIds: ["place-1", "place-2"]
    }]
  ]);
  assert.equal(result.state.selections.selectedRouteId, "course-server");
  assert.equal(result.state.savedRoutes[0].id, "course-server");
});

test("place and media likes roll back when no server contract exists", async () => {
  const sync = createActionSync({ repository: {}, enabled: true });
  const previousState = state({ likedMediaIds: [] });
  const optimisticState = state({ likedMediaIds: ["media-1"] });

  const result = await sync.run({
    actionId: "toggle-media-like",
    payload: { mediaId: "media-1" },
    previousState,
    optimisticState
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.state.likedMediaIds, []);
  assert.match(result.state.toast.message, /지원하지 않아요/u);
});

test("authenticated onboarding completion stores the profile and onboarding answers", async () => {
  const calls = [];
  const repository = {
    updateMyProfile: async (input) => { calls.push(["profile", input]); },
    putMyOnboarding: async (input) => { calls.push(["onboarding", input]); }
  };
  const sync = createActionSync({ repository, enabled: true });
  const previousState = state({
    currentScreenId: "a19",
    form: {
      birthYear: "2000",
      gender: "male",
      nickname: "새도리",
      habit: "instagram-saved",
      source: "instagram"
    }
  });
  const optimisticState = { ...previousState, currentScreenId: "a22" };

  const result = await sync.run({
    screenId: "a19",
    actionId: "continue-sign-up",
    payload: {},
    previousState,
    optimisticState
  });

  assert.equal(result.status, "synced");
  assert.deepEqual(calls, [
    ["profile", { nickname: "새도리" }],
    ["onboarding", {
      birthYear: 2000,
      gender: "male",
      nickname: "새도리",
      discoveryHabit: "instagram-saved",
      neighborhoodIds: [],
      placeTypeTagIds: [],
      situationTagIds: [],
      referralSource: "instagram"
    }]
  ]);
});
