import { expect, test } from "@playwright/test";
import masks from "../../public/app-preview/figma/saved-visual-masks.json" with { type: "json" };

const STORAGE_KEY = "doripe_app_preview_v1";
const FLOW_C = ["c1", "c2", "c3", "c4", "c6", "c7"];
const RESPONSIVE_BASELINE_IDS = new Set(["c1", "c2", "c3", "c7"]);
const PHOTO_FINGERPRINTS = Object.freeze({
  "/app-preview/assets/discover/feed-1.png": 1154928789,
  "/app-preview/assets/discover/feed-2.png": 2607561978,
  "/app-preview/assets/discover/feed-3.png": 448077360,
  "/app-preview/assets/discover/feed-4.png": 2771716796,
  "/app-preview/assets/discover/feed-5.png": 1380485435,
  "/app-preview/assets/discover/feed-6.png": 2778785032,
  "/app-preview/assets/discover/feed-1.jpg": 54357858,
  "/app-preview/assets/discover/feed-2.jpg": 1078603906,
  "/app-preview/assets/discover/feed-3.jpg": 2906205013,
  "/app-preview/assets/discover/feed-4.jpg": 4061396001,
  "/app-preview/assets/discover/feed-5.jpg": 1352858493,
  "/app-preview/assets/discover/feed-6.jpg": 128460893
});
const VISUAL_SAVED_STATE = {
  savedPlaceIds: ["place-1", "place-10", "place-8", "place-11", "place-7"],
  savedRoutes: [
    { id: "saved-route-1", name: "연남 저녁 데이트 루트", placeIds: ["place-1", "place-7", "place-8"] },
    { id: "saved-route-2", name: "조용한 연남 오후", placeIds: ["place-6", "place-2", "place-12"] },
    { id: "saved-route-3", name: "친구와 맛집 산책", placeIds: ["place-3", "place-10", "place-11"] }
  ]
};

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/?static=1");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

async function gotoSaved(page, screenId, state = {}) {
  await page.goto(`/app-preview/?screen=${screenId}&static=1`);
  if (Object.keys(state).length) {
    await page.evaluate(({ key, next }) => {
      const current = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...current, ...next }));
    }, { key: STORAGE_KEY, next: state });
    await page.reload();
  }
  return page.locator(`[data-screen-id="${screenId}"]`);
}

test("saved renderers use supplied places, courses, media, and filter tags", async ({ page }) => {
  const rendered = await page.evaluate(async () => {
    const { normalizeDataSnapshot } = await import("/app-preview/data/contracts.js");
    const { SAVED_RENDERERS } = await import("/app-preview/screens/saved.js");
    const tags = [
      ["tag-date", "주입 데이트", "situation"], ["tag-friends", "주입 친구", "situation"],
      ["tag-alone", "주입 혼자", "situation"], ["tag-family-group", "주입 가족", "situation"],
      ["tag-daytime", "주입 낮", "time"], ["tag-afternoon", "주입 오후", "time"],
      ["tag-evening", "주입 저녁", "time"], ["tag-night", "주입 밤", "time"],
      ["tag-quiet", "주입 조용함", "mood"], ["tag-emotional", "주입 감성", "mood"],
      ["tag-good-for-talking", "주입 대화", "mood"], ["tag-sophisticated", "주입 세련됨", "mood"],
      ["tag-bright", "주입 밝음", "mood"], ["tag-dark", "주입 어두움", "mood"]
    ].map(([id, name, group]) => ({ id, name, group }));
    const data = normalizeDataSnapshot({
      places: [{
        id: "saved-place-custom", name: "주입 저장 장소", userId: "profile-custom",
        mediaIds: ["saved-media-custom"], tagIds: ["tag-date", "tag-afternoon", "tag-quiet"],
        address: "서울 주입로 1", walkingMinutes: 3, savedCount: 7, summary: "주입 장소 설명"
      }],
      media: [{
        id: "saved-media-custom", placeId: "saved-place-custom", userId: "profile-custom",
        src: "/app-preview/assets/discover/feed-1.png", alt: "주입 저장 사진"
      }],
      profiles: [{ id: "profile-custom", name: "주입 사용자", handle: "주입사용자", avatarUrl: "/app-preview/assets/discover/avatar-1.png" }],
      tags,
      courses: [{
        id: "saved-course-custom", name: "주입 저장 루트", userId: "profile-custom",
        placeIds: ["saved-place-custom"], tagIds: ["tag-date"], walkingMinutes: 11
      }]
    });
    const state = {
      savedPlaceIds: ["saved-place-custom"],
      selections: { selectedPlaceId: "saved-place-custom", selectedRouteId: "saved-course-custom" }
    };
    const course = SAVED_RENDERERS.c6(state, data);
    const courseHero = course.querySelector(".saved-route-hero__photo");
    return {
      places: SAVED_RENDERERS.c1(state, data).textContent,
      course: course.textContent,
      courseHeroSrc: new URL(courseHero.src).pathname,
      courseHeroAlt: courseHero.alt,
      filters: SAVED_RENDERERS.c3(state, data).textContent,
      empty: SAVED_RENDERERS.c1({ savedPlaceIds: [], selections: {} }, data).textContent
    };
  });

  expect(rendered.places).toContain("주입 저장 장소");
  expect(rendered.course).toContain("주입 저장 코스");
  expect(rendered.courseHeroSrc).toBe("/app-preview/assets/discover/feed-1.png");
  expect(rendered.courseHeroAlt).toBe("주입 저장 사진");
  expect(rendered.filters).toContain("주입 친구");
  expect(rendered.empty).toContain("저장한 장소가 아직 없어요");
  expect(rendered.places).not.toContain("오브젝트 연남");
});

async function visualDiffRatio(page, screen, screenId) {
  const screenshot = await screen.screenshot({ animations: "disabled" });
  return page.evaluate(async ({ actualBase64, referenceUrl, screenMasks }) => {
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
    const [actualImage, referenceImage] = await Promise.all([
      load(`data:image/png;base64,${actualBase64}`),
      load(referenceUrl)
    ]);
    const pixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 393;
      canvas.height = 852;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 393, 852);
      context.drawImage(image, 0, 0, 393, 852);
      return context.getImageData(0, 0, 393, 852).data;
    };
    const actual = pixels(actualImage);
    const reference = pixels(referenceImage);
    const masked = (x, y) => screenMasks.some((mask) => x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height);
    const maxColorDelta = 35_215 * 0.2 * 0.2;
    let compared = 0;
    let different = 0;
    for (let y = 0; y < 852; y += 1) {
      for (let x = 0; x < 393; x += 1) {
        if (masked(x, y)) continue;
        const offset = (y * 393 + x) * 4;
        const red = actual[offset] - reference[offset];
        const green = actual[offset + 1] - reference[offset + 1];
        const blue = actual[offset + 2] - reference[offset + 2];
        const yDelta = 0.29889531 * red + 0.58662247 * green + 0.11448223 * blue;
        const iDelta = 0.59597799 * red - 0.2741761 * green - 0.32180189 * blue;
        const qDelta = 0.21147017 * red - 0.52261711 * green + 0.31114694 * blue;
        const delta = 0.5053 * yDelta ** 2 + 0.299 * iDelta ** 2 + 0.1957 * qDelta ** 2;
        compared += 1;
        if (delta > maxColorDelta) different += 1;
      }
    }
    return different / compared;
  }, {
    actualBase64: screenshot.toString("base64"),
    referenceUrl: `/app-preview/assets/references/${screenId}.png`,
    screenMasks: masks[screenId] || []
  });
}

test("C1 visual photos match their reviewed local pixel fingerprints", async ({ page }) => {
  const screen = await gotoSaved(page, "c1", VISUAL_SAVED_STATE);
  const photos = screen.locator(".saved-recommend-card__photo, .saved-place-row__photo");
  expect(await photos.count()).toBeGreaterThan(0);
  for (const photo of await photos.all()) {
    const pixels = await photo.evaluate((image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 16; canvas.height = 16;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, 16, 16);
      const data = context.getImageData(0, 0, 16, 16).data;
      let hash = 2166136261;
      for (const value of data) hash = Math.imul(hash ^ value, 16777619) >>> 0;
      return { hash, loaded: image.complete && image.naturalWidth > 0, source: new URL(image.src).pathname };
    });
    expect(pixels.loaded, pixels.source).toBe(true);
    expect(pixels.hash, pixels.source).toBe(PHOTO_FINGERPRINTS[pixels.source]);
  }
});

test("C6 uses the selected route's data-driven hero media", async ({ page }) => {
  const screen = await gotoSaved(page, "c6", VISUAL_SAVED_STATE);
  const hero = screen.locator(".saved-route-hero__photo");
  await expect(hero).toBeVisible();
  const result = await hero.evaluate((image) => {
    const canvas = document.createElement("canvas");
    canvas.width = 16; canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 16, 16);
    const data = context.getImageData(0, 0, 16, 16).data;
    let hash = 2166136261;
    for (const value of data) hash = Math.imul(hash ^ value, 16777619) >>> 0;
    const style = getComputedStyle(image);
    return {
      hash,
      loaded: image.complete && image.naturalWidth > 0,
      source: new URL(image.src).pathname,
      objectFit: style.objectFit,
      width: image.getBoundingClientRect().width,
      heroHeight: image.closest(".saved-route-hero").getBoundingClientRect().height
    };
  });
  expect(result).toEqual({
    hash: PHOTO_FINGERPRINTS["/app-preview/assets/discover/feed-2.jpg"],
    loaded: true,
    source: "/app-preview/assets/discover/feed-2.jpg",
    objectFit: "cover",
    width: 393,
    heroHeight: 386
  });
});

test("Flow C exposes only the current six semantic Figma frames", async ({ page }) => {
  const nodes = {
    c1: "446:1787", c2: "446:1631", c3: "446:1223",
    c4: "446:1715", c6: "446:2394", c7: "446:1474"
  };
  for (const screenId of FLOW_C) {
    const screen = await gotoSaved(page, screenId);
    await expect(screen).toHaveAttribute("data-figma-node", nodes[screenId]);
    await expect(screen).toHaveAttribute("data-render-mode", "semantic");
  }
  await page.goto("/app-preview/?screen=c5&static=1");
  await expect(page.locator("[data-screen-id='c5']")).toHaveCount(0);
});

test("saved tabs switch between places and routes", async ({ page }) => {
  await gotoSaved(page, "c1");
  await page.getByRole("tab", { name: "코스" }).click();
  await expect(page).toHaveURL(/screen=c2/);
  await expect(page.getByRole("heading", { name: "저장한 코스" })).toBeVisible();

  await page.getByRole("tab", { name: "장소" }).click();
  await expect(page).toHaveURL(/screen=c1/);
  await expect(page.getByRole("heading", { name: "오늘 어울리는 장소 추천" })).toBeVisible();
});

test("filter choices persist and apply to saved places", async ({ page }) => {
  await gotoSaved(page, "c3");
  await page.getByRole("button", { name: "친구랑" }).click();
  await page.getByRole("button", { name: "저녁" }).click();
  await page.getByRole("button", { name: "밝은" }).click();
  await page.getByRole("button", { name: "저장 장소 다시 정렬하기" }).click();
  await expect(page).toHaveURL(/screen=c1/);

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.selections).toMatchObject({ situation: "tag-friends", time: "tag-evening", mood: "tag-bright" });
  await expect(page.locator(".saved-filter-row").getByRole("button", { name: "친구랑 필터" })).toHaveAttribute("aria-pressed", "true");
});

test("location picker stores a pin and radius while Seoul-wide remains the default", async ({ page }) => {
  await gotoSaved(page, "c3");
  await expect(page.getByRole("button", { name: "서울 전체 위치 설정" })).toBeVisible();
  await page.getByRole("button", { name: "서울 전체 위치 설정" }).click();
  await page.getByRole("button", { name: "지도에서 핀 위치 선택" }).click({ position: { x: 180, y: 70 } });
  await page.getByRole("button", { name: "5km 반경" }).click();
  await page.getByRole("button", { name: "저장 장소 다시 정렬하기" }).click();

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.selections.locationMode).toBe("pin");
  expect(saved.selections.locationRadiusKm).toBe(5);
  expect(saved.selections.locationCenter.latitude).toBeGreaterThan(37.4);
  expect(saved.selections.locationCenter.longitude).toBeGreaterThan(126.8);
});

test("saved filters change visible canonical places and reset restores them", async ({ page }) => {
  await gotoSaved(page, "c1", { savedPlaceIds: ["place-1", "place-8", "place-11"] });
  await expect(page.locator(".saved-place-row strong")).toHaveText(["오브젝트 연남", "카페 노티드", "소이연남"]);

  await page.getByRole("button", { name: "조건 변경 필터" }).click();
  await page.getByRole("button", { name: "친구랑" }).click();
  await page.getByRole("button", { name: "저장 장소 다시 정렬하기" }).click();
  await expect(page.locator(".saved-place-row strong")).toHaveText(["카페 노티드", "소이연남"]);

  await page.getByRole("button", { name: "조건 변경 필터" }).click();
  await page.getByRole("button", { name: "초기화" }).click();
  await page.getByRole("button", { name: "저장 장소 다시 정렬하기" }).click();
  await expect(page.locator(".saved-place-row strong")).toHaveText(["오브젝트 연남", "카페 노티드", "소이연남"]);
});

test("C2 renders only canonical saved routes and opens the selected saved route", async ({ page }) => {
  await gotoSaved(page, "c2", {
    savedRoutes: [{ id: "saved-route-1", name: "주말 산책", placeIds: ["place-1", "place-8"] }]
  });

  await expect(page.locator(".saved-route-card strong")).toHaveText(["주말 산책"]);
  await expect(page.getByText(/undefined/)).toHaveCount(0);
  await page.getByRole("button", { name: "주말 산책 상세 보기" }).click();
  await expect(page.getByRole("heading", { name: "주말 산책" })).toBeVisible();
  await expect(page.getByText(/undefined/)).toHaveCount(0);
  await expect(page.locator(".saved-route-stop strong")).toHaveText(["오브젝트 연남", "카페 노티드"]);
});

test("empty canonical saved lists stay empty in static review mode", async ({ page }) => {
  await page.goto("/app-preview/?screen=c1&static=1");
  await expect(page.getByText("저장한 장소가 아직 없어요", { exact: true })).toBeVisible();
  await expect(page.getByText("저장한 장소가 없어요", { exact: true })).toHaveCount(0);
  await expect(page.locator(".saved-place-row")).toHaveCount(0);
  await expect(page.locator(".saved-recommend-card")).toHaveCount(0);

  await page.goto("/app-preview/?screen=c2&static=1");
  await expect(page.getByText("저장한 코스가 없어요", { exact: true })).toBeVisible();
  await expect(page.locator(".saved-route-card")).toHaveCount(0);
});

test("place cards open map detail and its selected place route", async ({ page }) => {
  await gotoSaved(page, "c1", { savedPlaceIds: ["place-1"] });
  await page.getByRole("button", { name: /오브젝트 연남 상세/ }).first().click();
  await expect(page).toHaveURL(/screen=c4/);
  await expect(page.getByRole("heading", { name: "오브젝트 연남" })).toBeVisible();
  await page.getByRole("button", { name: "오브젝트 연남 장소 보기" }).click();
  await expect(page).toHaveURL(/screen=b10/);
});

test("route cards open route details and replacement flow", async ({ page }) => {
  await gotoSaved(page, "c2", {
    savedRoutes: [{
      id: "saved-route-1",
      name: "연남 저녁 데이트 루트",
      placeIds: ["place-1", "place-7", "place-8"]
    }]
  });
  await page.getByRole("button", { name: "연남 저녁 데이트 코스 경로 보기" }).click();
  const mapState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(mapState.overlays).toContain("saved-route-map");
  expect(mapState.selections.selectedRouteId).toBe("saved-route-1");
  await page.getByRole("button", { name: "경로 닫기" }).click();

  await page.getByRole("button", { name: "연남 저녁 데이트 코스 상세 보기" }).click();
  await expect(page).toHaveURL(/screen=c6/);
  await expect(page.getByRole("heading", { name: "연남 저녁 데이트 코스" })).toBeVisible();

  await page.getByRole("button", { name: "리틀넬 연남 바꾸기" }).click();
  await expect(page).toHaveURL(/screen=c7/);
  await page.getByRole("button", { name: "브런치가든 연남으로 교체" }).click();
  await page.getByRole("button", { name: "선택한 장소로 교체" }).click();
  await expect(page).toHaveURL(/screen=c6/);
  await expect(page.getByText("브런치가든 연남", { exact: true })).toBeVisible();
});

test("C2 route map visibly connects the ordered stops and closes back to C2", async ({ page }) => {
  await gotoSaved(page, "c2", {
    savedRoutes: [{
      id: "saved-route-1",
      name: "연남 세 곳 산책",
      placeIds: ["place-1", "place-7", "place-8"]
    }]
  });

  await page.getByRole("button", { name: "연남 세 곳 산책 경로 보기" }).click();
  const dialog = page.getByRole("dialog", { name: "연남 세 곳 산책 경로" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-route-path]")).toBeVisible();
  await expect(dialog.locator("[data-route-stop] strong")).toHaveText([
    "오브젝트 연남",
    "리틀넬 연남",
    "카페 노티드"
  ]);

  await dialog.getByRole("button", { name: "경로 닫기" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-screen-id="c2"]')).toBeVisible();
  await expect(page).toHaveURL(/screen=c2/);
});

test("C6 directions use the canonical start and destination and show remaining stops", async ({ page }) => {
  await gotoSaved(page, "c2", {
    savedRoutes: [{
      id: "saved-route-1",
      name: "연남 세 곳 산책",
      placeIds: ["place-1", "place-7", "place-8"]
    }]
  });
  await page.getByRole("button", { name: "연남 세 곳 산책 상세 보기" }).click();
  await page.getByRole("button", { name: "길찾기" }).click();

  const link = page.getByRole("link", { name: "지도 앱으로 이동" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /126\.9257,37\.5624.*%EC%98%A4%EB%B8%8C%EC%A0%9D%ED%8A%B8%20%EC%97%B0%EB%82%A8.*126\.9268,37\.5598.*%EC%B9%B4%ED%8E%98%20%EB%85%B8%ED%8B%B0%EB%93%9C/);
  await expect(page.getByText("남은 경유지 1곳: 리틀넬 연남", { exact: true })).toBeVisible();
  await expect(link).not.toHaveAttribute("href", "https://map.naver.com/");
});

test("all Flow C screens keep fixed frame geometry without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 393, height: 852 }, { width: 360, height: 780 }]) {
    await page.setViewportSize(viewport);
    for (const screenId of FLOW_C) {
      const screen = await gotoSaved(page, screenId);
      const geometry = await screen.evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        scrollWidth: element.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      }));
      expect(geometry.width).toBeCloseTo(Math.min(393, viewport.width), 1);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(393);
      expect(geometry.viewportWidth).toBe(viewport.width);
    }
  }
});

test("Flow C screenshots match Figma or the approved responsive baseline", async ({ page }) => {
  for (const screenId of FLOW_C) {
    await page.goto(`/app-preview/?screen=${screenId}&static=1`);
    await page.evaluate(({ key, state }) => {
      const current = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...current, ...state }));
    }, { key: STORAGE_KEY, state: VISUAL_SAVED_STATE });
    await page.reload();
    const screen = page.locator(`[data-screen-id="${screenId}"]`);
    if (RESPONSIVE_BASELINE_IDS.has(screenId)) {
      await expect(screen).toHaveScreenshot(`responsive-${screenId}.png`, {
        animations: "disabled",
        maxDiffPixelRatio: 0.003
      });
      continue;
    }
    const ratio = await visualDiffRatio(page, screen, screenId);
    expect(ratio, `${screenId} visual difference`).toBeLessThanOrEqual(0.02);
  }
});
