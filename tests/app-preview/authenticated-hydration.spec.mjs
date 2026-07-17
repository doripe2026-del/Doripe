import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";
const AUTH_SESSION_STORAGE_KEY = "doripe.app_preview.auth.session.v1";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PLACE_IDS = [
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333"
];
const COURSE_ID = "44444444-4444-4444-8444-444444444444";

function place(id, index) {
  return {
    id,
    name: index === 0 ? "서버 저장 장소" : "코스 전용 장소",
    shortCopy: "로그인 계정에서 복원한 장소",
    neighborhoodId: null,
    address: "서울 마포구 동교로 1",
    nearestStation: "홍대입구역",
    latitude: 37.56 + index * 0.001,
    longitude: 126.92 + index * 0.001,
    category: { id: "category-cafe", name: "카페", displayOrder: 1 },
    tags: [],
    moodTags: [],
    bestFor: [],
    timeTags: [],
    media: [{
      id: `55555555-5555-4555-8555-55555555555${index}`,
      kind: "image",
      url: `/app-preview/assets/discover/feed-${index + 1}.jpg`,
      thumbnailUrl: null,
      position: 0,
      rightsStatus: "approved",
      placeId: id
    }],
    status: "published",
    updatedAt: "2026-07-17T00:00:00.000Z"
  };
}

test("a returning signed-in user sees server profile, saves, and complete course places", async ({ page }) => {
  const privateRequests = [];
  await page.addInitScript(({ storageKey, authKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      currentScreenId: "c1",
      history: [],
      savedPlaceIds: ["stale-place"],
      savedRoutes: [{ id: "stale-course", name: "예전 코스", placeIds: ["stale-1", "stale-2"] }],
      profile: { id: "stale-profile", nickname: "예전 사용자", bio: "" }
    }));
    sessionStorage.setItem(authKey, JSON.stringify({
      accessToken: "live-access-token",
      refreshToken: "live-refresh-token",
      expiresAt: Date.now() + 60_000,
      flow: "auth"
    }));
  }, { storageKey: STORAGE_KEY, authKey: AUTH_SESSION_STORAGE_KEY });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice("/api/v1/".length);
    if (path.startsWith("me/")) {
      privateRequests.push({ path: `${path}${url.search}`, authorization: request.headers().authorization });
    }
    if (path === "bootstrap") {
      return route.fulfill({ status: 200, json: { data: {
        regions: [], categories: [{ id: "category-cafe", name: "카페", displayOrder: 1 }], tags: [],
        featureFlags: {}, contractVersions: {}
      }, meta: {} } });
    }
    if (path === "feed") {
      return route.fulfill({ status: 200, json: { data: { items: [] }, meta: { nextCursor: null } } });
    }
    if (path === "me/profile") {
      return route.fulfill({ status: 200, json: { data: {
        id: PROFILE_ID,
        nickname: "복원된 도리",
        introduction: "서버 프로필",
        profileImageUrl: "/app-preview/assets/discover/avatar-1.png",
        isCurator: false,
        officialBadge: false,
        followedByMe: false,
        followerCount: 0
      }, meta: {} } });
    }
    if (path === "me/saves" && url.searchParams.get("targetType") === "place") {
      return route.fulfill({ status: 200, json: { data: {
        items: [{ targetType: "place", targetId: PLACE_IDS[0], target: null }]
      }, meta: { nextCursor: null } } });
    }
    if (path === "me/saves" && url.searchParams.get("targetType") === "course") {
      return route.fulfill({ status: 200, json: { data: {
        items: [{ targetType: "course", targetId: COURSE_ID, target: null }]
      }, meta: { nextCursor: null } } });
    }
    if (path === `places/${PLACE_IDS[0]}`) {
      return route.fulfill({ status: 200, json: { data: place(PLACE_IDS[0], 0), meta: {} } });
    }
    if (path === `places/${PLACE_IDS[1]}`) {
      return route.fulfill({ status: 200, json: { data: place(PLACE_IDS[1], 1), meta: {} } });
    }
    if (path === `courses/${COURSE_ID}`) {
      return route.fulfill({ status: 200, json: { data: {
        id: COURSE_ID,
        ownerId: PROFILE_ID,
        name: "서버 저장 코스",
        visibility: "private",
        version: 1,
        totalTravelMinutes: 20,
        places: PLACE_IDS.map((placeId, index) => ({ id: `course-place-${index + 1}`, placeId, position: index + 1 }))
      }, meta: {} } });
    }
    if (path === "sessions") {
      const body = request.postDataJSON();
      return route.fulfill({ status: 201, json: { data: { sessionId: body.sessionId, accepted: true }, meta: {} } });
    }
    if (path === "events") {
      const body = request.postDataJSON();
      return route.fulfill({ status: 202, json: { data: { accepted: body.events.length, duplicates: 0, rejected: 0 }, meta: {} } });
    }
    return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=c1");
  await expect(page.locator('[data-screen-id="c1"]')).toContainText("서버 저장 장소");

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.profile).toEqual({
    id: PROFILE_ID,
    nickname: "복원된 도리",
    bio: "서버 프로필",
    avatarUrl: "/app-preview/assets/discover/avatar-1.png"
  });
  expect(stored.savedPlaceIds).toEqual([PLACE_IDS[0]]);
  expect(stored.savedRoutes).toEqual([{
    id: COURSE_ID,
    name: "서버 저장 코스",
    placeIds: PLACE_IDS
  }]);
  expect(privateRequests).toHaveLength(3);
  expect(privateRequests.every((item) => item.authorization === "Bearer live-access-token")).toBe(true);
});
