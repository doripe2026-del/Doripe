import { expect, test } from "@playwright/test";

const PLACE_ID = "22222222-2222-4222-8222-222222222222";
const CONTENT_ID = "55555555-5555-4555-8555-555555555555";
const MEDIA_ID = "44444444-4444-4444-8444-444444444444";

function liveApiData() {
  const place = {
    id: PLACE_ID,
    name: "오브젝트 연남",
    shortCopy: "취향이 머무는 소품숍",
    neighborhoodId: "33333333-3333-4333-8333-333333333333",
    address: "서울 마포구 동교로 243-5",
    latitude: 37.5624,
    longitude: 126.9257,
    category: { id: "category-shop", name: "소품/체험", displayOrder: 1 },
    tags: [],
    moodTags: [],
    bestFor: [],
    timeTags: [],
    media: [{
      id: MEDIA_ID,
      kind: "image",
      url: "/app-preview/assets/discover/feed-1.jpg",
      thumbnailUrl: null,
      position: 0,
      rightsStatus: "approved",
      placeId: PLACE_ID
    }],
    status: "published",
    updatedAt: "2026-07-16T00:00:00.000Z"
  };
  const content = {
    id: CONTENT_ID,
    type: "place",
    author: {
      id: "11111111-1111-4111-8111-111111111111",
      nickname: "도리",
      introduction: "서울의 좋은 장소를 모아요",
      profileImageUrl: "/app-preview/assets/discover/avatar-1.png",
      isCurator: true,
      officialBadge: true,
      followedByMe: false,
      followerCount: 12
    },
    caption: "오늘 발견한 곳",
    placeIds: [PLACE_ID],
    courseId: null,
    media: place.media,
    status: "published",
    version: 1,
    likedByMe: false,
    likeCount: 3,
    commentCount: 0,
    createdAt: "2026-07-16T00:00:00.000Z",
    updatedAt: "2026-07-16T00:00:00.000Z",
    publishedAt: "2026-07-16T00:00:00.000Z"
  };
  return { place, content };
}

async function installLiveApi(page) {
  const requests = { sessions: [], eventBatches: [], mutations: [] };
  const { place, content } = liveApiData();

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice("/api/v1/".length);

    if (path === "sessions") {
      requests.sessions.push({ body: request.postDataJSON(), headers: request.headers() });
      return route.fulfill({ status: 201, json: { data: { sessionId: requests.sessions[0].body.sessionId, accepted: true }, meta: {} } });
    }
    if (path === "events") {
      const batch = request.postDataJSON();
      requests.eventBatches.push(batch);
      return route.fulfill({ status: 202, json: { data: { accepted: batch.events.length, duplicates: 0, rejected: 0 }, meta: {} } });
    }
    if (path === "bootstrap") {
      return route.fulfill({ status: 200, json: { data: {
        regions: [], categories: [place.category], tags: [],
        featureFlags: { videoUpload: false, contentShare: true },
        contractVersions: { api: "v1", onboarding: 1, notifications: 1, analytics: 1 }
      }, meta: {} } });
    }
    if (path === "feed") {
      return route.fulfill({ status: 200, json: { data: { items: [content] }, meta: { nextCursor: null } } });
    }
    if (path === `places/${PLACE_ID}`) {
      return route.fulfill({ status: 200, json: { data: place, meta: {} } });
    }
    if (path === `me/saves/place/${PLACE_ID}`) {
      requests.mutations.push({ method: request.method(), path });
      return route.fulfill({ status: 201, json: { data: { targetType: "place", targetId: PLACE_ID, saved: true }, meta: {} } });
    }
    return route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });
  return requests;
}

async function eventList(requests) {
  await expect.poll(() => requests.eventBatches.flatMap((batch) => batch.events).length).toBeGreaterThan(0);
  return requests.eventBatches.flatMap((batch) => batch.events);
}

test("live preview links an authenticated session while preserving anonymous attribution", async ({ page }) => {
  const requests = await installLiveApi(page);
  await page.addInitScript(() => {
    const counts = { visibilitychange: 0, pagehide: 0 };
    const addDocumentListener = document.addEventListener;
    const addWindowListener = window.addEventListener;
    document.addEventListener = function addEventListener(type, ...args) {
      if (type === "visibilitychange") counts.visibilitychange += 1;
      return addDocumentListener.call(this, type, ...args);
    };
    window.addEventListener = function addEventListener(type, ...args) {
      if (type === "pagehide") counts.pagehide += 1;
      return addWindowListener.call(this, type, ...args);
    };
    window.__analyticsLifecycleListenerCounts = counts;
    sessionStorage.setItem("doripe.app_preview.auth.session.v1", JSON.stringify({
      accessToken: "live-access-token",
      refreshToken: "live-refresh-token",
      expiresAt: Date.now() + 60_000,
      flow: "auth"
    }));
  });

  await page.goto("/app-preview/?screen=b4");
  await expect(page.locator('[data-screen-id="b4"]')).toBeVisible();
  await expect.poll(() => requests.sessions.length).toBe(1);
  expect(requests.sessions[0].body.anonymousId).toBeTruthy();
  expect(requests.sessions[0].headers.authorization).toBe("Bearer live-access-token");

  await page.locator('[data-action="save-place"]').click();
  await expect.poll(() => requests.mutations.length).toBe(1);
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("app-preview:screen-navigate", { detail: { screenId: "b4" } }));
    document.dispatchEvent(new CustomEvent("app-preview:screen-navigate", { detail: { screenId: "b1" } }));
  });

  await expect.poll(async () => (await eventList(requests)).filter((event) => event.name === "place_save").length).toBe(1);
  await expect.poll(async () => (await eventList(requests)).filter((event) => event.name === "screen_view").length).toBe(1);
  const events = await eventList(requests);
  expect(events.filter((event) => event.name === "session_start")).toHaveLength(1);
  expect(events.find((event) => event.name === "place_save")?.properties.placeId).toBe(PLACE_ID);
  const dwell = events.find((event) => event.name === "screen_view");
  expect(dwell?.sourceScreen).toBe("b4");
  expect(dwell?.properties.durationMs).toBeGreaterThanOrEqual(0);
  expect(await page.evaluate(() => window.__analyticsLifecycleListenerCounts)).toEqual({
    visibilitychange: 1,
    pagehide: 1
  });
});

test("static preview sends no analytics for rendering, navigation, or local actions", async ({ page }) => {
  const analyticsRequests = [];
  await page.route("**/api/v1/{sessions,events}", (route) => {
    analyticsRequests.push(route.request().url());
    return route.fulfill({ status: 500, json: {} });
  });

  await page.goto("/app-preview/?screen=b4&static=1");
  await page.locator('[data-action="save-place"]').click();
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("app-preview:screen-navigate", { detail: { screenId: "b1" } }));
  });
  await page.waitForTimeout(100);

  expect(analyticsRequests).toEqual([]);
});
