export const GUEST_MIGRATION_STORAGE_KEY = "doripe.app_preview.guest_migration.v1";
const JOURNAL_VERSION = 1;

const DISCOVERY_HABITS = new Set([
  "instagram-saved", "naver-map-saved", "blog-search", "friend-recommendation",
  "search-as-needed", "good-fit", "unknown"
]);
const REFERRAL_SOURCES = new Set([
  "friend", "instagram", "tiktok", "tiktok-shorts", "search", "blog-search",
  "community", "community-cafe", "creator", "store", "web-store", "map", "other", "unknown"
]);
const GENDERS = new Set(["female", "male", "unspecified"]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashText(value, seed = 2166136261) {
  let hash = seed >>> 0;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

function taskId(type, payload) {
  const source = `${type}:${stableStringify(payload)}`;
  return `guest_${type.replaceAll("-", "_")}_${hashText(source)}${hashText([...source].reverse().join(""), 2246822507)}`.slice(0, 80);
}

function task(type, payload) {
  return { id: taskId(type, payload), type, payload, status: "pending", attempts: 0, lastError: null };
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()))];
}

function normalizedRoute(route) {
  if (!route || typeof route !== "object") return null;
  const name = typeof route.name === "string" ? route.name.trim() : "";
  const placeIds = uniqueStrings(route.placeIds);
  return name && placeIds.length >= 2 ? { name, placeIds } : null;
}

function routesMatch(left, right) {
  return left?.name === right?.name
    && left.placeIds?.length === right.placeIds?.length
    && left.placeIds.every((placeId, index) => placeId === right.placeIds[index]);
}

function onboardingPayload(form = {}) {
  const payload = {
    neighborhoodIds: [],
    placeTypeTagIds: [],
    situationTagIds: [],
    referralSource: REFERRAL_SOURCES.has(form.source) ? form.source : "unknown"
  };
  const birthYear = Number(form.birthYear);
  const currentYear = new Date().getUTCFullYear();
  if (Number.isInteger(birthYear) && birthYear >= 1900 && birthYear <= currentYear) payload.birthYear = birthYear;
  if (GENDERS.has(form.gender)) payload.gender = form.gender;
  const nickname = typeof form.nickname === "string" ? form.nickname.trim() : "";
  if (nickname.length >= 2 && nickname.length <= 40) payload.nickname = nickname;
  if (DISCOVERY_HABITS.has(form.habit)) payload.discoveryHabit = form.habit;
  return payload;
}

function hasOnboardingData(form = {}) {
  return ["birthYear", "gender", "nickname", "habit", "source"].some((key) => {
    const value = form[key];
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  });
}

export function createGuestMigrationPlan({ guestState = {}, snapshot = {}, viewerId, migrateIdentity = false } = {}) {
  if (typeof viewerId !== "string" || !viewerId) throw new TypeError("viewerId is required");
  const tasks = [];
  const savedPlaceIds = new Set(snapshot.savedPlaceIds || []);
  for (const placeId of uniqueStrings(guestState.savedPlaceIds)) {
    if (!savedPlaceIds.has(placeId)) tasks.push(task("save-place", { placeId }));
  }

  const accountCourseIds = new Set([...(snapshot.savedCourseIds || []), ...(snapshot.ownedCourseIds || [])]);
  const accountCourses = (snapshot.courses || []).filter((course) => accountCourseIds.has(course.id));
  for (const sourceRoute of guestState.savedRoutes || []) {
    const route = normalizedRoute(sourceRoute);
    if (!route || accountCourses.some((course) => routesMatch(route, course))) continue;
    const existingCourse = (snapshot.courses || []).find((course) => routesMatch(route, course));
    if (existingCourse) {
      tasks.push(task("save-course", { courseId: existingCourse.id }));
    } else {
      tasks.push(task("create-course", {
        name: route.name,
        visibility: "private",
        startPlaceId: route.placeIds[0],
        placeIds: route.placeIds
      }));
    }
  }

  for (const comment of guestState.submittedComments || []) {
    const contentId = typeof comment?.contentId === "string" ? comment.contentId.trim() : "";
    const body = typeof comment?.body === "string" ? comment.body.trim() : "";
    const sourceCommentId = typeof comment?.id === "string" ? comment.id.trim() : "";
    if (contentId && body) tasks.push(task("create-comment", { contentId, body, sourceCommentId }));
  }

  if (migrateIdentity) {
    const form = guestState.form || {};
    if (hasOnboardingData(form)) tasks.push(task("put-onboarding", onboardingPayload(form)));
    const nickname = typeof form.nickname === "string" ? form.nickname.trim() : "";
    const viewer = (snapshot.profiles || []).find((profile) => profile.id === viewerId);
    const currentNickname = viewer?.name || viewer?.handle || "";
    if (nickname.length >= 2 && nickname.length <= 40 && nickname !== currentNickname) {
      tasks.push(task("update-profile", { nickname }));
    }
  }

  return { version: JOURNAL_VERSION, viewerId, tasks, createdAt: new Date().toISOString() };
}

function readJournal(storage) {
  try {
    const value = JSON.parse(storage?.getItem(GUEST_MIGRATION_STORAGE_KEY));
    return value?.version === JOURNAL_VERSION && Array.isArray(value.tasks) ? value : null;
  } catch {
    return null;
  }
}

function writeJournal(storage, journal) {
  storage?.setItem(GUEST_MIGRATION_STORAGE_KEY, JSON.stringify(journal));
}

export function prepareGuestMigrationJournal({ storage = globalThis.localStorage, plan } = {}) {
  if (!plan || !Array.isArray(plan.tasks)) throw new TypeError("migration plan is required");
  const previous = readJournal(storage);
  const priorTasks = previous?.viewerId === plan.viewerId
    ? new Map(previous.tasks.map((item) => [item.id, item]))
    : new Map();
  const currentTaskIds = new Set(plan.tasks.map((item) => item.id));
  const unfinishedPriorTasks = [...priorTasks.values()]
    .filter((item) => item.status !== "done" && !currentTaskIds.has(item.id));
  const journal = {
    ...plan,
    tasks: [
      ...unfinishedPriorTasks,
      ...plan.tasks.map((item) => {
        const prior = priorTasks.get(item.id);
        return prior?.status === "done" ? { ...item, status: "done", attempts: prior.attempts || 1 } : item;
      })
    ],
    updatedAt: new Date().toISOString()
  };
  writeJournal(storage, journal);
  return journal;
}

async function executeTask(repository, item) {
  const options = { idempotencyKey: item.id };
  if (item.type === "save-place") return repository.savePlace(item.payload.placeId, options);
  if (item.type === "save-course") return repository.saveCourse(item.payload.courseId, options);
  if (item.type === "create-course") return repository.createCourse(item.payload, options);
  if (item.type === "create-comment") return repository.createComment(item.payload.contentId, item.payload.body, options);
  if (item.type === "put-onboarding") return repository.putMyOnboarding(item.payload);
  if (item.type === "update-profile") return repository.updateMyProfile(item.payload);
  throw new Error(`Unsupported guest migration task: ${item.type}`);
}

export async function executeGuestMigration({ storage = globalThis.localStorage, repository, journal } = {}) {
  if (!repository || !journal) throw new TypeError("repository and journal are required");
  for (const item of journal.tasks) {
    if (item.status === "done") continue;
    item.status = "pending";
    item.attempts = Number(item.attempts || 0) + 1;
    item.lastError = null;
    writeJournal(storage, { ...journal, updatedAt: new Date().toISOString() });
    try {
      await executeTask(repository, item);
      item.status = "done";
    } catch (error) {
      item.status = "failed";
      item.lastError = typeof error?.code === "string" ? error.code : "migration_failed";
    }
    writeJournal(storage, { ...journal, updatedAt: new Date().toISOString() });
  }
  const failedTaskIds = journal.tasks.filter((item) => item.status !== "done").map((item) => item.id);
  return { journal, complete: failedTaskIds.length === 0, failedTaskIds };
}
