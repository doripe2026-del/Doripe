import { expect, test } from "@playwright/test";

test("the public app route serves the current app without review controls", async ({ page }) => {
  await page.goto("/app?screen=a1&static=1");

  await expect(page.locator('[data-screen-id="a1"]')).toBeVisible();
  await expect(page.locator("#review-panel")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-app-surface", "product");
  expect(new URL(page.url()).pathname).toBe("/app");
});

test("public app sharing keeps the canonical public path", async ({ page }) => {
  const placeId = "22222222-2222-4222-8222-222222222222";
  const mediaId = "44444444-4444-4444-8444-444444444444";
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: { regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {} } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      await route.fulfill({ json: { data: { items: [] }, meta: { nextCursor: null } } });
      return;
    }
    if (url.pathname.endsWith(`/places/${placeId}`)) {
      await route.fulfill({ json: { data: {
        id: placeId,
        name: "공유할 장소",
        shortCopy: "공개 앱 경로를 확인해요",
        address: "서울 마포구 테스트로 1",
        nearestStation: "홍대입구역",
        latitude: 37.56,
        longitude: 126.92,
        category: { id: "category-cafe", name: "카페" },
        tags: [],
        media: [{ id: mediaId, kind: "image", url: "https://images.example/shared.jpg", placeId }],
        status: "published"
      } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => window.sessionStorage.setItem("copied-link", value) }
    });
  });
  await page.goto(`/app?screen=b4&type=place&id=${placeId}&static=1`);

  await page.getByRole("button", { name: "공유하기" }).click();
  const copied = await page.evaluate(() => window.sessionStorage.getItem("copied-link"));

  expect(new URL(copied).pathname).toBe("/app");
  expect(new URL(copied).searchParams.get("screen")).toBe("b4");
  expect(new URL(copied).searchParams.get("type")).toBe("place");
  expect(new URL(copied).searchParams.get("id")).toBe(placeId);
});

test("a live shared place outside the initial feed is hydrated from its public detail", async ({ page }) => {
  const placeId = "22222222-2222-4222-8222-222222222222";
  const mediaId = "44444444-4444-4444-8444-444444444444";
  const requested = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.pathname);
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: { regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {} } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      await route.fulfill({ json: { data: { items: [] }, meta: { nextCursor: null } } });
      return;
    }
    if (url.pathname.endsWith(`/places/${placeId}`)) {
      await route.fulfill({ json: { data: {
        id: placeId,
        name: "공유로 처음 만난 장소",
        shortCopy: "첫 피드 밖에서도 열려요",
        address: "서울 마포구 테스트로 1",
        nearestStation: "홍대입구역",
        latitude: 37.56,
        longitude: 126.92,
        category: { id: "category-cafe", name: "카페" },
        tags: [{ id: "tag-quiet", kind: "mood", name: "조용한" }],
        media: [{ id: mediaId, kind: "image", url: "https://images.example/shared.jpg", placeId }],
        status: "published"
      } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto(`/app?screen=b10&type=place&id=${placeId}`);

  await expect(page.getByRole("button", { name: "장소 공식 화면" })).toHaveText("공유로 처음 만난 장소");
  expect(new URL(page.url()).searchParams.get("id")).toBe(placeId);
  expect(requested.filter((path) => path.endsWith(`/places/${placeId}`))).toHaveLength(1);
});

test("a live shared course hydrates its owner and every referenced place", async ({ page }) => {
  const courseId = "66666666-6666-4666-8666-666666666666";
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const placeIds = [
    "22222222-2222-4222-8222-222222222222",
    "77777777-7777-4777-8777-777777777777"
  ];
  const requested = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.pathname);
    if (url.pathname.endsWith("/bootstrap")) {
      await route.fulfill({ json: { data: { regions: [], categories: [], tags: [], featureFlags: {}, contractVersions: {} } } });
      return;
    }
    if (url.pathname.endsWith("/feed")) {
      await route.fulfill({ json: { data: { items: [] }, meta: { nextCursor: null } } });
      return;
    }
    if (url.pathname.endsWith(`/courses/${courseId}`)) {
      await route.fulfill({ json: { data: {
        id: courseId,
        ownerId,
        name: "공유로 처음 만난 코스",
        visibility: "public",
        version: 1,
        totalTravelMinutes: 35,
        places: placeIds.map((placeId, index) => ({ id: `course-place-${index + 1}`, placeId, position: index + 1 }))
      } } });
      return;
    }
    if (url.pathname.endsWith(`/profiles/${ownerId}`)) {
      await route.fulfill({ json: { data: {
        id: ownerId,
        nickname: "도리",
        introduction: "서울의 좋은 장소를 모아요",
        profileImageUrl: "https://images.example/dori.jpg",
        isCurator: true,
        officialBadge: true
      } } });
      return;
    }
    const placeIndex = placeIds.findIndex((placeId) => url.pathname.endsWith(`/places/${placeId}`));
    if (placeIndex >= 0) {
      const placeId = placeIds[placeIndex];
      await route.fulfill({ json: { data: {
        id: placeId,
        name: placeIndex === 0 ? "첫 번째 장소" : "두 번째 장소",
        shortCopy: "공유 코스의 장소",
        address: `서울 마포구 테스트로 ${placeIndex + 1}`,
        nearestStation: "홍대입구역",
        latitude: 37.56 + placeIndex * 0.001,
        longitude: 126.92 + placeIndex * 0.001,
        category: { id: "category-cafe", name: "카페" },
        tags: [],
        media: [{
          id: `44444444-4444-4444-8444-44444444444${placeIndex}`,
          kind: "image",
          url: `https://images.example/course-${placeIndex + 1}.jpg`,
          placeId
        }],
        status: "published"
      } } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "not_found", message: "not found" } } });
  });

  await page.goto(`/app?screen=b4&type=route&id=${courseId}`);

  await expect(page.locator('[data-testid="course-detail"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "공유로 처음 만난 코스" })).toBeVisible();
  await expect(page.locator(".discover-course-stop")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "도리 프로필 보기" })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("rn")).toBe(false);
  expect(new URL(page.url()).searchParams.has("rp")).toBe(false);
  expect(requested.filter((path) => placeIds.some((placeId) => path.endsWith(`/places/${placeId}`)))).toHaveLength(2);
});

test("a failed live bootstrap offers a working retry", async ({ page }) => {
  let bootstrapRequests = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/bootstrap")) bootstrapRequests += 1;
    await route.fulfill({
      status: 503,
      json: { error: { code: "temporarily_unavailable", message: "temporarily unavailable" } }
    });
  });

  await page.goto("/app?screen=b1");

  const retry = page.getByRole("button", { name: "다시 시도" });
  await expect(retry).toBeVisible();
  const previousRequests = bootstrapRequests;
  await retry.click();
  await expect.poll(() => bootstrapRequests).toBeGreaterThan(previousRequests);
});
