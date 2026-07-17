import { expect, test } from "@playwright/test";

const TAG_DATE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TAG_AFTERNOON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TAG_QUIET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_SESSION_STORAGE_KEY = "doripe.app_preview.auth.session.v1";
const SUPABASE_URL = "https://doripe-preview-test.supabase.co";
const SUPABASE_KEY = "sb_publishable_0123456789abcdefghijklmn";

function place(id, name, mediaId) {
  return {
    id,
    name,
    shortCopy: "서버 피드 장소",
    neighborhoodId: "yeonnam",
    address: "서울 마포구 테스트로 1",
    latitude: 37.56,
    longitude: 126.92,
    category: { id: "category-cafe", name: "카페", displayOrder: 1 },
    tags: [], moodTags: [], bestFor: [], timeTags: [],
    media: [{ id: mediaId, kind: "image", url: "https://images.example/place.jpg", position: 0, rightsStatus: "approved", placeId: id }],
    status: "published",
    updatedAt: "2026-07-18T00:00:00.000Z"
  };
}

function content(id, placeData) {
  return {
    id,
    type: "place",
    author: {
      id: PROFILE_ID,
      nickname: "도리",
      introduction: "서울의 좋은 장소를 모아요",
      isCurator: false,
      followedByMe: false
    },
    caption: "서버 피드 콘텐츠",
    placeIds: [placeData.id],
    media: placeData.media,
    status: "published",
    version: 1,
    likedByMe: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z"
  };
}

test("Discover ignores a stale filtered response and reset restores the initial feed", async ({ page }) => {
  const initialPlace = place("22222222-2222-4222-8222-222222222222", "처음 피드 장소", "33333333-3333-4333-8333-333333333333");
  const stalePlace = place("44444444-4444-4444-8444-444444444444", "늦게 온 장소", "55555555-5555-4555-8555-555555555555");
  const latestPlace = place("66666666-6666-4666-8666-666666666666", "최신 서버 장소", "77777777-7777-4777-8777-777777777777");
  let releaseFirstResponse;
  let firstRequestSeen;
  let dateRequestCount = 0;
  let failNextFilteredRequest = false;
  const waitForFirstRequest = new Promise((resolve) => { firstRequestSeen = resolve; });
  const heldFirstResponse = new Promise((resolve) => { releaseFirstResponse = resolve; });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [
          { id: TAG_DATE, key: "date", kind: "situation", name: "데이트" },
          { id: TAG_AFTERNOON, key: "afternoon", kind: "time", name: "오후" },
          { id: TAG_QUIET, key: "quiet", kind: "mood", name: "조용함" }
        ], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      const tagIds = url.searchParams.get("tagIds");
      if (!tagIds) {
        await route.fulfill({ json: { data: { items: [content("initial-content", initialPlace)] }, meta: { nextCursor: null } } });
        return;
      }
      if (failNextFilteredRequest) {
        failNextFilteredRequest = false;
        await route.fulfill({ status: 503, json: { error: { code: "temporary", message: "temporary" } } });
        return;
      }
      if (tagIds === TAG_DATE) {
        dateRequestCount += 1;
        if (dateRequestCount === 1) {
          firstRequestSeen();
          await heldFirstResponse;
          await route.fulfill({ json: { data: { items: [content("stale-content", stalePlace)] }, meta: { nextCursor: null } } });
          return;
        }
        await route.fulfill({ json: { data: { items: [content("latest-content", latestPlace)] }, meta: { nextCursor: null } } });
        return;
      }
      await route.fulfill({ json: { data: { items: [content("latest-content", latestPlace)] }, meta: { nextCursor: null } } });
      return;
    }
    const details = [initialPlace, stalePlace, latestPlace];
    const match = details.find((item) => url.pathname.endsWith(`/places/${item.id}`));
    if (match) {
      await route.fulfill({ json: { data: match } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${initialPlace.id}"]`)).toBeVisible();

  await page.locator(".discover-filter-button").click();
  await page.getByRole("button", { name: "데이트", exact: true }).click();
  await page.getByRole("button", { name: "필터 적용하기" }).click();
  await waitForFirstRequest;

  await page.locator(".discover-filter-button").click();
  await page.getByRole("button", { name: "오후", exact: true }).click();
  await page.getByRole("button", { name: "필터 적용하기" }).click();
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${latestPlace.id}"]`)).toBeVisible();

  releaseFirstResponse();
  await page.waitForTimeout(100);
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${latestPlace.id}"]`)).toBeVisible();
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${stalePlace.id}"]`)).toHaveCount(0);

  await page.locator(".discover-filter-button").click();
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${initialPlace.id}"]`)).toBeVisible();

  failNextFilteredRequest = true;
  await page.getByRole("button", { name: "조용함", exact: true }).click();
  await page.getByRole("button", { name: "필터 적용하기" }).click();
  await expect(page.getByText("피드를 불러오지 못했어요")).toBeVisible();
  await page.getByRole("button", { name: "피드 다시 시도" }).click();
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${latestPlace.id}"]`)).toBeVisible();
});

test("Discover appends the next server page without replacing the current feed", async ({ page }) => {
  const firstPlace = place("88888888-8888-4888-8888-888888888888", "첫 페이지 장소", "99999999-9999-4999-8999-999999999999");
  const secondPlace = place("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "다음 페이지 장소", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  const feedRequests = [];

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      feedRequests.push(url.search);
      const cursor = url.searchParams.get("cursor");
      await route.fulfill({ json: cursor
        ? { data: { items: [content("next-content", secondPlace)] }, meta: { nextCursor: null } }
        : { data: { items: [content("first-content", firstPlace)] }, meta: { nextCursor: "next-page" } }
      });
      return;
    }
    const details = [firstPlace, secondPlace];
    const match = details.find((item) => url.pathname.endsWith(`/places/${item.id}`));
    if (match) {
      await route.fulfill({ json: { data: match } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  const feed = page.getByTestId("discover-feed");
  await expect(feed.locator(`[data-place-id="${firstPlace.id}"]`)).toBeVisible();
  await expect(feed.locator(`[data-place-id="${secondPlace.id}"]`)).toBeVisible();
  await expect(feed.locator(`[data-place-id="${firstPlace.id}"]`)).toBeVisible();
  expect(feedRequests.some((query) => query.includes("cursor=next-page"))).toBe(true);
});

test("Discover retries the same next page after a temporary failure", async ({ page }) => {
  const firstPlace = place("31313131-3131-4131-8131-313131313131", "재시도 전 장소", "32323232-3232-4232-8232-323232323232");
  const secondPlace = place("33333333-3333-4333-8333-333333333333", "재시도 성공 장소", "34343434-3434-4434-8434-343434343434");
  let nextPageAttempts = 0;

  await page.addInitScript(() => { delete window.IntersectionObserver; });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      const cursor = url.searchParams.get("cursor");
      if (!cursor) {
        await route.fulfill({ json: {
          data: { items: [content("retry-first-content", firstPlace)] },
          meta: { nextCursor: "retry-page" }
        } });
        return;
      }
      nextPageAttempts += 1;
      if (nextPageAttempts === 1) {
        await route.fulfill({ status: 503, json: { error: { code: "temporary", message: "temporary" } } });
        return;
      }
      await route.fulfill({ json: {
        data: { items: [content("retry-second-content", secondPlace)] },
        meta: { nextCursor: null }
      } });
      return;
    }
    const match = [firstPlace, secondPlace].find((item) => url.pathname.endsWith(`/places/${item.id}`));
    if (match) {
      await route.fulfill({ json: { data: match } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  const feed = page.getByTestId("discover-feed");
  await expect(feed.locator(`[data-place-id="${firstPlace.id}"]`)).toBeVisible();
  await page.getByRole("button", { name: "다음 피드 불러오기" }).click();
  await expect(page.getByRole("button", { name: "다음 피드 다시 불러오기" })).toBeEnabled();
  await page.getByRole("button", { name: "다음 피드 다시 불러오기" }).click();
  await expect(feed.locator(`[data-place-id="${secondPlace.id}"]`)).toBeVisible();
  expect(nextPageAttempts).toBe(2);
});

test("a signed-out Following feed never reuses Discover results", async ({ page }) => {
  const discoverPlace = place("12121212-1212-4212-8212-121212121212", "발견 피드 장소", "13131313-1313-4313-8313-131313131313");
  const feedScopes = [];

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      feedScopes.push(url.searchParams.get("scope"));
      await route.fulfill({ json: {
        data: { items: [content("discover-only-content", discoverPlace)] },
        meta: { nextCursor: null }
      } });
      return;
    }
    if (url.pathname.endsWith(`/places/${discoverPlace.id}`)) {
      await route.fulfill({ json: { data: discoverPlace } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b1");
  await expect(page.getByText("조건에 맞는 장소가 아직 없어요")).toBeVisible();
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${discoverPlace.id}"]`)).toHaveCount(0);

  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${discoverPlace.id}"]`)).toBeVisible();
  expect(feedScopes).toEqual(["discover", "discover"]);
});

test("Discover stops when the server repeats the same next cursor", async ({ page }) => {
  const firstPlace = place("14141414-1414-4414-8414-141414141414", "반복 전 장소", "15151515-1515-4515-8515-151515151515");
  const secondPlace = place("16161616-1616-4616-8616-161616161616", "반복 뒤 장소", "17171717-1717-4717-8717-171717171717");
  let cursorRequests = 0;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      const cursor = url.searchParams.get("cursor");
      if (cursor) cursorRequests += 1;
      await route.fulfill({ json: cursor
        ? { data: { items: [content("repeated-cursor-next", secondPlace)] }, meta: { nextCursor: "repeat-me" } }
        : { data: { items: [content("repeated-cursor-first", firstPlace)] }, meta: { nextCursor: "repeat-me" } }
      });
      return;
    }
    const match = [firstPlace, secondPlace].find((item) => url.pathname.endsWith(`/places/${item.id}`));
    if (match) {
      await route.fulfill({ json: { data: match } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  const feed = page.getByTestId("discover-feed");
  await expect(feed.locator(`[data-place-id="${secondPlace.id}"]`)).toBeVisible();
  await page.waitForTimeout(250);
  expect(cursorRequests).toBe(1);
  await expect(feed.locator(".discover-feed__load-more")).toHaveCount(0);
});

test("a late Discover response never replaces a screen opened afterward", async ({ page }) => {
  const initialPlace = place("18181818-1818-4818-8818-181818181818", "상세로 이동할 장소", "19191919-1919-4919-8919-191919191919");
  const latePlace = place("20202020-2020-4020-8020-202020202020", "늦게 도착한 장소", "21212121-2121-4121-8121-212121212121");
  let releaseFilteredResponse;
  let filteredRequestSeen;
  const filteredSeen = new Promise((resolve) => { filteredRequestSeen = resolve; });
  const filteredHold = new Promise((resolve) => { releaseFilteredResponse = resolve; });

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [
          { id: TAG_DATE, key: "date", kind: "situation", name: "데이트" }
        ], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      if (url.searchParams.has("tagIds")) {
        filteredRequestSeen();
        await filteredHold;
        await route.fulfill({ json: { data: { items: [content("late-content", latePlace)] }, meta: { nextCursor: null } } });
      } else {
        await route.fulfill({ json: { data: { items: [content("detail-content", initialPlace)] }, meta: { nextCursor: null } } });
      }
      return;
    }
    const match = [initialPlace, latePlace].find((item) => url.pathname.endsWith(`/places/${item.id}`));
    if (match) {
      await route.fulfill({ json: { data: match } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${initialPlace.id}"]`)).toBeVisible();
  await page.locator(".discover-filter-button").click();
  await page.getByRole("button", { name: "데이트", exact: true }).click();
  await page.getByRole("button", { name: "필터 적용하기" }).click();
  await filteredSeen;
  await page.locator(`[data-action="review-navigate"][data-id="b4"]`).click();
  await expect(page.locator("#phone-root [data-screen-id='b4']")).toBeVisible();

  releaseFilteredResponse();
  await page.waitForTimeout(150);
  await expect(page.locator("#phone-root [data-screen-id='b4']")).toBeVisible();
  await expect(page.locator("#phone-root [data-screen-id='b2']")).toHaveCount(0);
});

test("Discover leaves loading state when an authenticated filter session expires", async ({ page }) => {
  const initialPlace = place("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "세션 만료 전 장소", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  let filteredAttempts = 0;

  await page.addInitScript((authKey) => {
    sessionStorage.setItem(authKey, JSON.stringify({
      accessToken: "expired-on-filter-access",
      refreshToken: "refresh-on-filter",
      expiresAt: Date.now() + 60_000,
      flow: "auth"
    }));
  }, AUTH_SESSION_STORAGE_KEY);
  await page.route("**/api/app-auth-config", (route) => route.fulfill({
    status: 200,
    json: { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY }
  }));
  await page.route(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, (route) => route.fulfill({
    status: 200,
    json: {
      access_token: "refreshed-but-rejected-access",
      refresh_token: "refreshed-token",
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
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [
          { id: TAG_DATE, key: "date", kind: "situation", name: "데이트" }
        ], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (path === "feed") {
      if (url.searchParams.has("tagIds")) {
        filteredAttempts += 1;
        await route.fulfill({ status: 401, json: { error: { code: "unauthenticated", message: "expired" } } });
      } else {
        await route.fulfill({ json: { data: { items: [content("session-content", initialPlace)] }, meta: { nextCursor: null } } });
      }
      return;
    }
    if (path === `places/${initialPlace.id}`) {
      await route.fulfill({ json: { data: initialPlace } });
      return;
    }
    if (path === "me/profile") {
      await route.fulfill({ json: { data: {
        id: PROFILE_ID,
        nickname: "도리",
        introduction: "서울의 좋은 장소를 모아요",
        profileImageUrl: null,
        isCurator: false,
        officialBadge: false,
        followedByMe: false,
        followerCount: 0
      } } });
      return;
    }
    if (path === "me/saves" || path === "courses") {
      await route.fulfill({ json: { data: { items: [] }, meta: { nextCursor: null } } });
      return;
    }
    if (path === "sessions") {
      await route.fulfill({ status: 201, json: { data: { sessionId: request.postDataJSON().sessionId, accepted: true } } });
      return;
    }
    if (path === "events") {
      await route.fulfill({ status: 202, json: { data: { accepted: 0, duplicates: 0, rejected: 0 } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  await expect(page.getByTestId("discover-feed").locator(`[data-place-id="${initialPlace.id}"]`)).toBeVisible();
  await page.locator(".discover-filter-button").click();
  await page.getByRole("button", { name: "데이트", exact: true }).click();
  await page.getByRole("button", { name: "필터 적용하기" }).click();

  await expect(page.getByText("피드를 불러오지 못했어요")).toBeVisible();
  await expect(page.getByText("로그인이 만료되었어요. 다시 로그인해 주세요.")).toBeVisible();
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), AUTH_SESSION_STORAGE_KEY)).toBeNull();
  expect(filteredAttempts).toBe(2);
});

test("Discover releases the load-more control when the authenticated session expires", async ({ page }) => {
  const firstPlace = place("23232323-2323-4323-8323-232323232323", "다음 페이지 전 장소", "24242424-2424-4424-8424-242424242424");
  let nextPageAttempts = 0;

  await page.addInitScript(({ authKey }) => {
    delete window.IntersectionObserver;
    sessionStorage.setItem(authKey, JSON.stringify({
      accessToken: "expired-on-next-page-access",
      refreshToken: "refresh-on-next-page",
      expiresAt: Date.now() + 60_000,
      flow: "auth"
    }));
  }, { authKey: AUTH_SESSION_STORAGE_KEY });
  await page.route("**/api/app-auth-config", (route) => route.fulfill({
    status: 200,
    json: { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY }
  }));
  await page.route(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, (route) => route.fulfill({
    status: 200,
    json: {
      access_token: "refreshed-next-page-access",
      refresh_token: "refreshed-next-page-token",
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
      await route.fulfill({ json: { data: {
        regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {}
      } } });
      return;
    }
    if (path === "feed") {
      if (url.searchParams.has("cursor")) {
        nextPageAttempts += 1;
        await route.fulfill({ status: 401, json: { error: { code: "unauthenticated", message: "expired" } } });
      } else {
        await route.fulfill({ json: {
          data: { items: [content("next-page-session-content", firstPlace)] },
          meta: { nextCursor: "expired-next-page" }
        } });
      }
      return;
    }
    if (path === `places/${firstPlace.id}`) {
      await route.fulfill({ json: { data: firstPlace } });
      return;
    }
    if (path === "me/profile") {
      await route.fulfill({ json: { data: {
        id: PROFILE_ID,
        nickname: "도리",
        introduction: "서울의 좋은 장소를 모아요",
        profileImageUrl: null,
        isCurator: false,
        officialBadge: false,
        followedByMe: false,
        followerCount: 0
      } } });
      return;
    }
    if (path === "me/saves" || path === "courses") {
      await route.fulfill({ json: { data: { items: [] }, meta: { nextCursor: null } } });
      return;
    }
    if (path === "sessions") {
      await route.fulfill({ status: 201, json: { data: { sessionId: request.postDataJSON().sessionId, accepted: true } } });
      return;
    }
    if (path === "events") {
      await route.fulfill({ status: 202, json: { data: { accepted: 0, duplicates: 0, rejected: 0 } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto("/app-preview/?screen=b2");
  const loadMore = page.getByRole("button", { name: "다음 피드 불러오기" });
  await expect(loadMore).toBeVisible();
  await loadMore.click();

  await expect(page.getByText("로그인이 만료되었어요. 다시 로그인해 주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 피드 다시 불러오기" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "다음 피드 다시 불러오기" })).toHaveAttribute("aria-busy", "false");
  expect(nextPageAttempts).toBe(2);
});
