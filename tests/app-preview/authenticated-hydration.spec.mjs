import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";
const AUTH_SESSION_STORAGE_KEY = "doripe.app_preview.auth.session.v1";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const PLACE_IDS = [
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333"
];
const COURSE_ID = "44444444-4444-4444-8444-444444444444";
const SUPABASE_URL = "https://doripe-preview-test.supabase.co";
const SUPABASE_KEY = "sb_publishable_0123456789abcdefghijklmn";

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

function feedContent(placeRecord) {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    type: "place",
    author: {
      id: PROFILE_ID,
      nickname: "도리",
      introduction: "서울의 장소를 모아요",
      profileImageUrl: "/app-preview/assets/discover/avatar-1.png",
      isCurator: false,
      officialBadge: false,
      followedByMe: false,
      followerCount: 0
    },
    caption: "게스트가 저장한 장소",
    placeIds: [placeRecord.id],
    courseId: null,
    media: placeRecord.media,
    status: "published",
    version: 1,
    likedByMe: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    publishedAt: "2026-07-17T00:00:00.000Z"
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
    if (path === "courses" && url.searchParams.get("limit") === "50") {
      return route.fulfill({ status: 200, json: { data: { items: [] }, meta: { nextCursor: null } } });
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

test("signing in hydrates server account data without discarding guest saves", async ({ page }) => {
  const guestPlace = place(PLACE_IDS[1], 1);
  const serverPlace = place(PLACE_IDS[0], 0);
  let privateRequestCount = 0;

  await page.addInitScript(({ storageKey, guestPlaceId }) => {
    localStorage.setItem(storageKey, JSON.stringify({
      currentScreenId: "a3",
      history: [],
      form: {},
      savedPlaceIds: [guestPlaceId],
      savedRoutes: [{
        id: "saved-route-1",
        name: "비회원 코스",
        placeIds: [guestPlaceId, "22222222-2222-4222-8222-222222222222"]
      }]
    }));
  }, { storageKey: STORAGE_KEY, guestPlaceId: guestPlace.id });

  await page.route("**/api/app-auth-config", (route) => route.fulfill({
    status: 200,
    json: { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY }
  }));
  await page.route(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, (route) => route.fulfill({
    status: 200,
    json: {
      access_token: "signed-in-access-token",
      refresh_token: "signed-in-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: PROFILE_ID }
    }
  }));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice("/api/v1/".length);
    if (path === "bootstrap") {
      return route.fulfill({ status: 200, json: { data: {
        regions: [], categories: [{ id: "category-cafe", name: "카페", displayOrder: 1 }], tags: [],
        featureFlags: {}, contractVersions: {}
      }, meta: {} } });
    }
    if (path === "feed") {
      const content = feedContent(guestPlace);
      content.placeIds = [guestPlace.id, serverPlace.id];
      content.media = [...guestPlace.media, ...serverPlace.media];
      return route.fulfill({ status: 200, json: { data: { items: [content] }, meta: { nextCursor: null } } });
    }
    if (path === `places/${guestPlace.id}`) {
      return route.fulfill({ status: 200, json: { data: guestPlace, meta: {} } });
    }
    if (path === `places/${serverPlace.id}`) {
      return route.fulfill({ status: 200, json: { data: serverPlace, meta: {} } });
    }
    if (path === "me/profile") {
      privateRequestCount += 1;
      return route.fulfill({ status: 200, json: { data: {
        id: PROFILE_ID,
        nickname: "로그인 도리",
        introduction: "서버 계정",
        profileImageUrl: "/app-preview/assets/discover/avatar-1.png",
        isCurator: false,
        officialBadge: false,
        followedByMe: false,
        followerCount: 0
      }, meta: {} } });
    }
    if (path === "me/saves" && url.searchParams.get("targetType") === "place") {
      return route.fulfill({ status: 200, json: { data: {
        items: [{ targetType: "place", targetId: serverPlace.id, target: null }]
      }, meta: { nextCursor: null } } });
    }
    if (path === "me/saves" && url.searchParams.get("targetType") === "course") {
      return route.fulfill({ status: 200, json: { data: { items: [] }, meta: { nextCursor: null } } });
    }
    if (path === "courses" && url.searchParams.get("limit") === "50") {
      return route.fulfill({ status: 200, json: { data: { items: [] }, meta: { nextCursor: null } } });
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

  await page.goto("/app-preview/?screen=a3");
  await page.getByLabel("이메일").fill("dori@doripe.kr");
  await page.getByLabel("비밀번호").fill("Doripe123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();

  await expect(page.locator('[data-screen-id="b1"]')).toBeVisible();
  await expect.poll(() => privateRequestCount).toBe(1);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.savedPlaceIds).toEqual([serverPlace.id, guestPlace.id]);
  expect(stored.savedRoutes).toEqual([{
    id: "saved-route-1",
    name: "비회원 코스",
    placeIds: [guestPlace.id, serverPlace.id]
  }]);
  expect(stored.profile.nickname).toBe("로그인 도리");
});
