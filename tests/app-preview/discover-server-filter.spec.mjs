import { expect, test } from "@playwright/test";

const TAG_DATE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TAG_AFTERNOON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TAG_QUIET = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

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
      if (tagIds === TAG_DATE) {
        firstRequestSeen();
        await heldFirstResponse;
        await route.fulfill({ json: { data: { items: [content("stale-content", stalePlace)] }, meta: { nextCursor: null } } });
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
});
