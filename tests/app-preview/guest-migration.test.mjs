import assert from "node:assert/strict";
import test from "node:test";

import {
  GUEST_MIGRATION_STORAGE_KEY,
  createGuestMigrationPlan,
  executeGuestMigration,
  prepareGuestMigrationJournal
} from "../../public/app-preview/data/guest-migration.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

const snapshot = {
  viewerProfileId: "viewer-1",
  savedPlaceIds: ["place-server"],
  savedCourseIds: [],
  ownedCourseIds: [],
  profiles: [{ id: "viewer-1", name: "서버 도리" }],
  courses: [{ id: "course-existing", name: "같은 코스", placeIds: ["place-1", "place-2"] }]
};

const guestState = {
  savedPlaceIds: ["place-server", "place-guest"],
  savedRoutes: [
    { id: "saved-route-1", name: "같은 코스", placeIds: ["place-1", "place-2"] },
    { id: "saved-route-2", name: "새 코스", placeIds: ["place-2", "place-3"] }
  ],
  submittedComments: [{ id: "local-comment-1", contentId: "content-1", body: "다시 가고 싶어요" }],
  form: {
    birthYear: "2000",
    gender: "female",
    nickname: "도리새",
    habit: "instagram-saved",
    source: "instagram"
  }
};

test("guest migration plans only missing saves and preserves existing account identity by default", () => {
  const plan = createGuestMigrationPlan({ guestState, snapshot, viewerId: "viewer-1" });
  assert.deepEqual(plan.tasks.map((task) => task.type), [
    "save-place",
    "save-course",
    "create-course",
    "create-comment"
  ]);
  assert.deepEqual(plan.tasks[1].payload, { courseId: "course-existing" });
  assert.deepEqual(plan.tasks[2].payload, {
    name: "새 코스",
    visibility: "private",
    startPlaceId: "place-2",
    placeIds: ["place-2", "place-3"]
  });
});

test("new account migration can include guest onboarding and profile identity", () => {
  const plan = createGuestMigrationPlan({
    guestState,
    snapshot,
    viewerId: "viewer-1",
    migrateIdentity: true
  });
  assert.deepEqual(plan.tasks.map((task) => task.type), [
    "save-place",
    "save-course",
    "create-course",
    "create-comment",
    "put-onboarding",
    "update-profile"
  ]);
  assert.deepEqual(plan.tasks[4].payload, {
    birthYear: 2000,
    gender: "female",
    nickname: "도리새",
    discoveryHabit: "instagram-saved",
    neighborhoodIds: [],
    placeTypeTagIds: [],
    situationTagIds: [],
    referralSource: "instagram"
  });
});

test("guest migration task IDs are stable and valid idempotency keys", () => {
  const first = createGuestMigrationPlan({ guestState, snapshot, viewerId: "viewer-1" });
  const second = createGuestMigrationPlan({ guestState: structuredClone(guestState), snapshot, viewerId: "viewer-1" });
  assert.deepEqual(first.tasks.map((task) => task.id), second.tasks.map((task) => task.id));
  for (const task of first.tasks) assert.match(task.id, /^[A-Za-z0-9_-]{8,80}$/u);
});

test("a persisted journal resumes failed work without repeating completed tasks", async () => {
  const storage = memoryStorage();
  const plan = createGuestMigrationPlan({ guestState, snapshot, viewerId: "viewer-1" });
  const firstJournal = prepareGuestMigrationJournal({ storage, plan });
  const calls = [];
  let failComment = true;
  const repository = {
    savePlace: async (id, options) => calls.push(["save-place", id, options.idempotencyKey]),
    saveCourse: async (id, options) => calls.push(["save-course", id, options.idempotencyKey]),
    createCourse: async (payload, options) => calls.push(["create-course", payload.name, options.idempotencyKey]),
    createComment: async (id, body, options) => {
      calls.push(["create-comment", id, options.idempotencyKey]);
      if (failComment) throw new Error("temporary");
      return { id: "comment-server", contentId: id, body };
    },
    putMyOnboarding: async () => calls.push(["put-onboarding"]),
    updateMyProfile: async () => calls.push(["update-profile"])
  };

  const firstResult = await executeGuestMigration({ storage, repository, journal: firstJournal });
  assert.equal(firstResult.complete, false);
  assert.equal(firstResult.failedTaskIds.length, 1);
  const firstCallCount = calls.length;

  failComment = false;
  const resumedPlan = createGuestMigrationPlan({ guestState: {}, snapshot, viewerId: "viewer-1" });
  const resumedJournal = prepareGuestMigrationJournal({ storage, plan: resumedPlan });
  const secondResult = await executeGuestMigration({ storage, repository, journal: resumedJournal });
  assert.equal(secondResult.complete, true);
  assert.equal(calls.length, firstCallCount + 1);
  assert.equal(calls.at(-1)[0], "create-comment");

  const persisted = JSON.parse(storage.getItem(GUEST_MIGRATION_STORAGE_KEY));
  assert.equal(persisted.tasks.every((task) => task.status === "done"), true);
});
