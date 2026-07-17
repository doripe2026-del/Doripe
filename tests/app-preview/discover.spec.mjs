import { expect, test } from "@playwright/test";
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import coverageManifest from "../../public/app-preview/figma/flow-b-coverage-manifest.json" with { type: "json" };
import { MEDIA, PLACES, ROUTES } from "../../public/app-preview/fixtures.js";
import { resolveFlowBCoverage } from "../../scripts/app-preview-semantic-gates.mjs";

const FLOW_B_IDS = Array.from({ length: 13 }, (_, index) => `b${index + 1}`);
const AI_DETAIL_BASELINE_IDS = new Set(["b4", "b5", "b6", "b8", "b10"]);
const FIXTURE_CONTENT_COUNT = PLACES.length + ROUTES.length;
const AI_GEOMETRY_OVERRIDES = Object.freeze({
  b4: Object.freeze({ sheetTop: 480, heroHeight: 658, sheetOffset: 152 }),
  b5: Object.freeze({ sheetTop: 610, heroHeight: 658, sheetOffset: 0 }),
  b6: Object.freeze({ sheetTop: 150, heroHeight: 658, sheetOffset: 0 })
});
const PHOTO_FINGERPRINTS = Object.freeze({
  "/app-preview/assets/discover/feed-1.png": 1154928789,
  "/app-preview/assets/discover/feed-2.png": 2607561978,
  "/app-preview/assets/discover/feed-3.png": 448077360,
  "/app-preview/assets/discover/feed-4.png": 2771716796
});
const REFERENCE_ONLY_MASKS = Object.freeze({
  b2: Object.freeze([measurements.b2.elements["System / bottom crop guard"]]),
  b3: Object.freeze([measurements.b3.elements["System / bottom crop guard"]]),
  b11: Object.freeze([{ x: 14, y: 84, width: 365, height: 74, reason: "data-driven-query-photo" }])
});

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/?static=1");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function gotoScreen(page, screenId) {
  await page.goto(`/app-preview/?screen=${screenId}&static=1`);
  return page.locator(`[data-screen-id="${screenId}"]`);
}

test("discovery renderers resolve selected IDs from an injected data snapshot", async ({ page }) => {
  await page.goto("/app-preview/?static=1");
  const rendered = await page.evaluate(async () => {
    const { normalizeDataSnapshot } = await import("/app-preview/data/contracts.js");
    const { DISCOVER_RENDERERS } = await import("/app-preview/screens/discover.js");
    const data = normalizeDataSnapshot({
      places: [
        {
          id: "place-a", name: "첫 번째 장소", mediaIds: ["media-a"], tagIds: ["tag-a"],
          address: "서울 마포구 첫길 1", hours: [["월", "휴무"]], walkingMinutes: 9, savedCount: 1
        },
        {
          id: "place-b", name: "선택한 두 번째 장소", mediaIds: ["media-b-old", "media-b-selected"],
          tagIds: ["tag-b", "tag-c"], address: "서울 마포구 둘길 2",
          hours: [["월", "09:00 - 18:00"], ["화", "휴무"]], walkingMinutes: 4, savedCount: 2
        }
      ],
      media: [
        { id: "media-a", placeId: "place-a", userId: "profile-a", src: "/app-preview/assets/discover/feed-1.png", alt: "첫 장소 사진" },
        { id: "media-b-old", placeId: "place-b", userId: "profile-a", src: "/app-preview/assets/discover/feed-2.png", alt: "이전 콘텐츠 사진" },
        { id: "media-course-b", placeId: "place-b", userId: "profile-b", src: "/app-preview/assets/discover/feed-3.png", alt: "선택 코스 사진" },
        { id: "media-b-selected", placeId: "place-b", userId: "profile-b", src: "/app-preview/assets/discover/feed-4.png", alt: "선택 콘텐츠 사진" },
        { id: "media-course-a", placeId: "place-a", userId: "profile-a", src: "/app-preview/assets/discover/feed-5.png", alt: "첫 코스 사진" }
      ],
      profiles: [
        { id: "profile-a", handle: "첫번째", name: "첫번째", bio: "첫 번째 프로필", avatarUrl: "/app-preview/assets/discover/avatar-1.png" },
        { id: "profile-b", handle: "선택한프로필", name: "선택한프로필", bio: "두 번째 프로필", avatarUrl: "/app-preview/assets/discover/avatar-2.png" }
      ],
      tags: [
        { id: "tag-a", name: "첫 태그", group: "category" },
        { id: "tag-b", name: "선택 동네", group: "neighborhood" },
        { id: "tag-c", name: "선택 분위기", group: "mood" },
        { id: "tag-yeonnam", name: "관련 없는 고정 태그", group: "neighborhood" }
      ],
      courses: [
        { id: "course-a", name: "첫 코스", userId: "profile-a", placeIds: ["place-a"], tagIds: ["tag-a"], walkingMinutes: 10 },
        { id: "course-b", name: "선택 코스", userId: "profile-b", placeIds: ["place-b"], tagIds: ["tag-c"], walkingMinutes: 20 }
      ],
      contents: [
        { id: "content-place-a", type: "place", placeId: "place-a", authorProfileId: "profile-a", mediaIds: ["media-a"], tagIds: ["tag-a"] },
        { id: "content-place-b-old", type: "place", placeId: "place-b", authorProfileId: "profile-a", mediaIds: ["media-b-old"], tagIds: ["tag-b"] },
        { id: "content-course-b", type: "course", courseId: "course-b", authorProfileId: "profile-b", mediaIds: ["media-course-b"], tagIds: ["tag-c"] },
        { id: "content-place-b-selected", type: "place", placeId: "place-b", authorProfileId: "profile-b", mediaIds: ["media-b-selected"], tagIds: ["tag-b", "tag-c"] },
        { id: "content-course-a", type: "course", courseId: "course-a", authorProfileId: "profile-a", mediaIds: ["media-course-a"], tagIds: ["tag-a"] }
      ],
      comments: [
        { id: "comment-old", contentId: "content-place-b-old", userId: "profile-a", body: "이전 콘텐츠 댓글", likeCount: 1 },
        { id: "comment-selected", contentId: "content-place-b-selected", userId: "profile-b", body: "선택 콘텐츠 댓글", likeCount: 2 },
        { id: "comment-course", contentId: "content-course-b", userId: "profile-b", body: "데이터에서 온 코스 댓글", likeCount: 3 }
      ]
    });
    const state = { selections: {
      selectedPlaceId: "place-b",
      selectedUserId: "profile-b",
      selectedMediaId: "media-b-selected",
      selectedContentId: "content-place-b-selected"
    } };
    const feedData = (screenId) => [...DISCOVER_RENDERERS[screenId](state, data).querySelectorAll("[data-testid=media-tile]")].map((tile) => ({
      contentId: tile.dataset.contentId,
      feedType: tile.dataset.feedType,
      mediaId: tile.dataset.mediaId,
      source: new URL(tile.querySelector("img").src).pathname
    }));
    const b3 = DISCOVER_RENDERERS.b3(state, data);
    const b8 = DISCOVER_RENDERERS.b8(state, data);
    const b9 = DISCOVER_RENDERERS.b9(state, data);
    const b10 = DISCOVER_RENDERERS.b10(state, data);
    const b11 = DISCOVER_RENDERERS.b11(state, data);
    const course = DISCOVER_RENDERERS.b4({ selections: {
      selectedRouteId: "course-b",
      selectedContentId: "content-course-b",
      routeDetailSource: "feed"
    }, submittedComments: [{
      id: "local-course-comment",
      contentId: "content-course-b",
      courseId: "course-b",
      userId: "profile-a",
      body: "다시 그려도 남는 코스 댓글",
      likeCount: 0
    }] }, data);
    const stale = DISCOVER_RENDERERS.b4({ selections: { selectedPlaceId: null } }, data);
    return {
      b1Feed: feedData("b1"),
      b2Feed: feedData("b2"),
      b3Media: [...b3.querySelectorAll("[data-testid=media-tile]")].map((tile) => ({
        mediaId: tile.dataset.mediaId,
        placeId: tile.dataset.placeId,
        source: new URL(tile.querySelector("img").src).pathname
      })),
      b4: DISCOVER_RENDERERS.b4(state, data).textContent,
      b4Support: DISCOVER_RENDERERS.b4(state, data).querySelector(".discover-place-summary small")?.textContent,
      b8: b8.textContent,
      b9: b9.textContent,
      b10: b10.textContent,
      b11TagIds: [...b11.querySelectorAll(".discover-related-query [data-tag-id]")].map((tag) => tag.dataset.tagId),
      b12: DISCOVER_RENDERERS.b12(state, data).textContent,
      courseComments: course.querySelector(".discover-course-comments__list").textContent,
      stale: stale.textContent
    };
  });

  const expectedFeed = [
    { contentId: "content-place-a", feedType: "place", mediaId: "media-a", source: "/app-preview/assets/discover/feed-1.png" },
    { contentId: "content-place-b-old", feedType: "place", mediaId: "media-b-old", source: "/app-preview/assets/discover/feed-2.png" },
    { contentId: "content-course-b", feedType: "route", mediaId: "media-course-b", source: "/app-preview/assets/discover/feed-3.png" },
    { contentId: "content-place-b-selected", feedType: "place", mediaId: "media-b-selected", source: "/app-preview/assets/discover/feed-4.png" },
    { contentId: "content-course-a", feedType: "route", mediaId: "media-course-a", source: "/app-preview/assets/discover/feed-5.png" }
  ];
  expect(rendered.b1Feed).toEqual(expectedFeed);
  expect(rendered.b2Feed).toEqual(expectedFeed);
  expect(rendered.b3Media).toEqual([
    { mediaId: "media-b-old", placeId: "place-b", source: "/app-preview/assets/discover/feed-2.png" },
    { mediaId: "media-b-selected", placeId: "place-b", source: "/app-preview/assets/discover/feed-4.png" }
  ]);
  expect(rendered.b4).toContain("선택한 두 번째 장소");
  expect(rendered.b4Support).toBe("선택 동네");
  expect(rendered.b8).toContain("선택 콘텐츠 댓글");
  expect(rendered.b8).not.toContain("이전 콘텐츠 댓글");
  expect(rendered.b10).toContain("선택 콘텐츠 댓글");
  expect(rendered.b10).not.toContain("이전 콘텐츠 댓글");
  expect(rendered.b9).toContain("월09:00 - 18:00화휴무");
  expect(rendered.b10).toContain("09:00 - 18:00");
  expect(rendered.b10).not.toContain("매일 12:00 - 20:00");
  expect(rendered.b11TagIds).toEqual(["tag-b", "tag-c"]);
  expect(rendered.b12).toContain("선택한프로필");
  expect(rendered.courseComments).toContain("데이터에서 온 코스 댓글");
  expect(rendered.courseComments).toContain("다시 그려도 남는 코스 댓글");
  expect(rendered.courseComments).not.toContain("이 코스 그대로 가보고 싶어요!");
  expect(rendered.stale).toContain("장소를 찾을 수 없어요");
  expect(rendered.stale).not.toContain("첫 번째 장소");
});

test("course comments keep their content and viewer links after rerender and reload", async ({ page }) => {
  await page.goto("/app-preview/?screen=b4&static=1");
  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...current,
      currentScreenId: "b4",
      selections: {
        ...current.selections,
        selectedRouteId: "route-1",
        selectedContentId: "content-route-1",
        routeDetailSource: "feed"
      }
    }));
  });
  await page.reload();

  await page.getByRole("button", { name: "코스 댓글 보기" }).click();
  await page.getByRole("textbox", { name: "코스 댓글 입력" }).fill("저장되는 코스 댓글");
  await page.getByRole("button", { name: "코스 댓글 등록" }).click();
  await expect(page.getByRole("dialog", { name: "코스 댓글" })).toContainText("저장되는 코스 댓글");

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(persisted.submittedComments.at(-1)).toMatchObject({
    contentId: "content-route-1",
    courseId: "route-1",
    userId: "user-1",
    body: "저장되는 코스 댓글"
  });

  await page.reload();
  await expect(page.getByRole("dialog", { name: "코스 댓글" })).toContainText("저장되는 코스 댓글");
});

test("B10 full detail keeps the approved AI content hierarchy", async ({ page }) => {
  const screen = await gotoScreen(page, "b10");
  const sheet = screen.locator('[data-testid="place-sheet"]');

  await expect(sheet.locator(".discover-media-strip__item")).toHaveCount(4);
  await expect(sheet.locator(".discover-media-credit")).toHaveCount(4);
  await expect(sheet.locator(".discover-related-mini__card")).toHaveCount(2);

  const metrics = await sheet.evaluate((root) => {
    const rect = (selector) => root.querySelector(selector).getBoundingClientRect();
    const title = rect(".discover-place-title");
    const firstInfo = rect('.discover-info-row[data-info-label="주소"]');
    const actions = rect(".discover-place-actions");
    const comments = rect(".discover-detail-comments-title");
    const media = [...root.querySelectorAll(".discover-media-strip__item")].map((item) => item.getBoundingClientRect());
    return {
      titleSize: Number.parseFloat(getComputedStyle(root.querySelector(".discover-place-title")).fontSize),
      infoHeight: firstInfo.height,
      actionHeight: actions.height,
      ordered: title.bottom < firstInfo.top && firstInfo.bottom < actions.top && actions.bottom < comments.top,
      mediaHeights: media.map((item) => item.height),
      mediaRows: new Set(media.map((item) => Math.round(item.top))).size
    };
  });

  expect(metrics.titleSize).toBeGreaterThanOrEqual(22);
  expect(metrics.infoHeight).toBe(38);
  expect(metrics.actionHeight).toBe(38);
  expect(metrics.ordered).toBe(true);
  expect(metrics.mediaRows).toBe(2);
  expect(metrics.mediaHeights.every((height) => height === 92)).toBe(true);
});

async function assertMeasuredGeometry(screen, screenId) {
  const frame = await screen.boundingBox();
  const owners = await screen.evaluate((root) => [root, ...root.querySelectorAll("[data-measure-key]")]
    .filter((element) => element.dataset.measureKey)
    .map((element) => ({
      source: element.dataset.measureKey,
      rect: element.getBoundingClientRect().toJSON()
    })));
  const coverage = resolveFlowBCoverage({
    screenId,
    nodeId: measurements[screenId].nodeId,
    measurementKeys: Object.keys(measurements[screenId].elements),
    renderedSources: owners.map(({ source }) => source),
    classifications: coverageManifest.classifications
  });
  let maximumDelta = 0;
  for (const source of coverage.rendered) {
    const owner = owners.filter((item) => item.source === source);
    expect(owner, `${screenId}/${source} has one DOM owner`).toHaveLength(1);
    const figmaExpected = measurements[screenId].elements[source];
    const aiOverride = AI_GEOMETRY_OVERRIDES[screenId];
    const expected = { ...figmaExpected };
    if (aiOverride) {
      if (source.includes("Hero / photo") || source.includes("Hero / media and floating actions")) {
        expected.height = aiOverride.heroHeight;
      }
      if (screenId === "b4" && figmaExpected.y >= 328 && !source.startsWith("Hero /")) {
        expected.y += aiOverride.sheetOffset;
      }
    }
    const actual = owner[0].rect;
    const relative = { x: actual.x - frame.x, y: actual.y - frame.y, width: actual.width, height: actual.height };
    for (const property of ["x", "y", "width", "height"]) {
      const delta = Math.abs(relative[property] - expected[property]);
      maximumDelta = Math.max(maximumDelta, delta);
      expect(delta, `${screenId}/${source}/${property}`).toBeLessThanOrEqual(1);
    }
  }
  return maximumDelta;
}

async function visualDiffRatio(page, screen, screenId, path) {
  const screenshot = await screen.screenshot({ animations: "disabled", path });
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
    const bands = Array.from({ length: 9 }, () => ({ compared: 0, different: 0 }));
    const cells = Array.from({ length: 9 }, () => Array.from({ length: 4 }, () => ({ compared: 0, different: 0 })));
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
        const band = bands[Math.min(8, Math.floor(y / 100))];
        const cell = cells[Math.min(8, Math.floor(y / 100))][Math.min(3, Math.floor(x / 100))];
        band.compared += 1;
        cell.compared += 1;
        if (delta > maxColorDelta) {
          different += 1;
          band.different += 1;
          cell.different += 1;
        }
      }
    }
    const sampleAt = (data, x, y) => [...data.slice((y * 393 + x) * 4, (y * 393 + x) * 4 + 4)];
    return { ratio: different / compared, bands, cells, samples: Object.fromEntries([[196, 840], [196, 86], [24, 115], [196, 115], [22, 569], [196, 700]].map(([x, y]) => [`${x},${y}`, { actual: sampleAt(actual, x, y), reference: sampleAt(reference, x, y) }])) };
  }, {
    actualBase64: screenshot.toString("base64"),
    referenceUrl: `/app-preview/assets/references/${screenId}.png`,
    screenMasks: [
      ...(masks[screenId] || []),
      ...(REFERENCE_ONLY_MASKS[screenId] || [])
    ]
  });
}

async function waitForSettledGeometry(locator) {
  await locator.evaluate((element) => new Promise((resolve) => {
    let previous = null;
    let stableFrames = 0;
    const sample = () => {
      const rect = element.getBoundingClientRect();
      const current = [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100).join(":");
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 3) resolve();
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
}

test("all current Flow B frames render as semantic screens without full-screen references", async ({ page }) => {
  for (const screenId of FLOW_B_IDS) {
    const screen = await gotoScreen(page, screenId);
    await expect(screen).toHaveAttribute("data-render-mode", "semantic");
    await expect(screen.locator(`img[src="/app-preview/assets/references/${screenId}.png"]`)).toHaveCount(0);
    await expect(screen.locator("button, input").first()).toBeVisible();
  }
});

test("discover and following feeds switch, open the C3 filter sheet, scroll, and open content", async ({ page }) => {
  const following = await gotoScreen(page, "b1");
  const feed = following.locator("[data-testid=discover-feed]");
  await expect(feed).toHaveCSS("overflow-y", "auto");
  await following.getByRole("button", { name: "Discover" }).click();
  await expect(page).toHaveURL(/screen=b2/);
  await page.getByRole("button", { name: "필터" }).click();
  await expect(page).toHaveURL(/screen=b2/);
  const filterSheet = page.locator("[data-testid=feed-filter-sheet]");
  await expect(filterSheet).toBeVisible();
  await expect(filterSheet).toHaveAttribute("data-source-screen", "c3");
  await expect(filterSheet.getByRole("heading", { name: "피드에서 볼 장소를 골라보세요" })).toBeVisible();
  await expect(filterSheet.getByText("저장한 장소를 지금 상황에 맞게 정리해드릴게요", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-testid=filter-menu]")).toHaveCount(0);
  await filterSheet.getByRole("button", { name: "서울 전체 위치 설정" }).click();
  await filterSheet.getByRole("button", { name: "지도에서 핀 위치 선택" }).click({ position: { x: 175, y: 74 } });
  await filterSheet.getByRole("button", { name: "10km 반경" }).click();
  await filterSheet.getByRole("button", { name: "친구랑" }).click();
  await filterSheet.getByRole("button", { name: "필터 적용하기" }).click();
  await expect(filterSheet).toHaveCount(0);
  await expect(page).toHaveURL(/screen=b2/);
  const filteredState = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(filteredState.selections.situation).toBe("tag-friends");
  expect(filteredState.selections.locationMode).toBe("pin");
  expect(filteredState.selections.locationRadiusKm).toBe(10);
  await page.locator("[data-testid=discover-feed]").evaluate((element) => { element.scrollTop = 300; });
  const selectedMediaId = await page.locator("[data-testid=media-tile]").first().getAttribute("data-media-id");
  await page.locator("[data-testid=media-tile]").first().click();
  await expect(page).toHaveURL(/screen=b4/);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(persisted.selections.selectedMediaId).toBe(selectedMediaId);
});

test("feed filter sheet closes from its backdrop or a downward drag", async ({ page }) => {
  const screen = await gotoScreen(page, "b1");
  const openFilter = screen.getByRole("button", { name: "필터", exact: true });

  await openFilter.click();
  let overlay = page.locator("[data-testid=feed-filter-sheet]");
  await expect(overlay).toBeVisible();
  await overlay.click({ position: { x: 20, y: 20 } });
  await expect(overlay).toHaveCount(0);
  await expect(page).toHaveURL(/screen=b1/);

  await openFilter.click();
  overlay = page.locator("[data-testid=feed-filter-sheet]");
  const handle = overlay.locator(".saved-handle");
  await page.waitForTimeout(300);
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(overlay).toHaveCount(0);
  await expect(page).toHaveURL(/screen=b1/);
});

test("B1 and B2 keep a full masonry feed and B1 has no add button", async ({ page }) => {
  for (const screenId of ["b1", "b2"]) {
    const screen = await gotoScreen(page, screenId);
    const feed = screen.locator("[data-testid=discover-feed]");
    await expect(feed.locator("[data-testid=media-tile]")).toHaveCount(FIXTURE_CONTENT_COUNT);

    const dimensions = await feed.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

    await feed.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(feed.locator("[data-testid=media-tile]").last()).toBeInViewport();
  }

  const following = await gotoScreen(page, "b1");
  await expect(following.locator(".discover-route-add")).toHaveCount(0);

  const geometry = await following.evaluate((root) => {
    const relativeRect = (selector) => {
      const frame = root.getBoundingClientRect();
      const rect = root.querySelector(selector).getBoundingClientRect();
      return { x: rect.x - frame.x, y: rect.y - frame.y, width: rect.width, height: rect.height };
    };
    return {
      followingStrip: relativeRect(".discover-following-strip"),
      filter: relativeRect(".discover-filter-button")
    };
  });
  expect(geometry.followingStrip).toEqual({ x: 24, y: 86, width: 345, height: 58 });
  expect(geometry.filter).toEqual({ x: 287, y: 27, width: 93, height: 39 });
});

test("B1 and B2 mix place and user-created route posts with an author on every tile", async ({ page }) => {
  for (const screenId of ["b1", "b2"]) {
    const screen = await gotoScreen(page, screenId);
    const tiles = screen.locator("[data-testid=media-tile]");

    await expect(tiles).toHaveCount(FIXTURE_CONTENT_COUNT);
    await expect(screen.locator('[data-testid=media-tile][data-feed-type="place"]').first()).toBeVisible();
    await expect(screen.locator('[data-testid=media-tile][data-feed-type="route"]').first()).toBeVisible();
    await expect(tiles.locator(".discover-feed-author")).toHaveCount(FIXTURE_CONTENT_COUNT);

    const authorKinds = await tiles.evaluateAll((items) => items.map((item) => ({
      feedType: item.dataset.feedType,
      authorKind: item.dataset.authorKind,
      authorName: item.querySelector(".discover-feed-author__name")?.textContent?.trim(),
      hasBadge: Boolean(item.querySelector(".discover-feed-author__badge"))
    })));
    expect(new Set(authorKinds.map(({ feedType }) => feedType))).toEqual(new Set(["place", "route"]));
    expect(new Set(authorKinds.map(({ authorKind }) => authorKind))).toEqual(new Set(["user", "curator"]));
    expect(authorKinds.every(({ authorName }) => /^[가-힣]{1,4}$/.test(authorName))).toBe(true);
    expect(authorKinds.some(({ authorKind, hasBadge }) => authorKind === "curator" && hasBadge)).toBe(true);
    await expect(screen.locator('[data-testid=media-tile][data-feed-type="route"]').first()).toHaveAttribute("data-action", "open-route-post");
    await expect(screen.locator('[data-testid=media-tile][data-feed-type="route"]').first()).toHaveAttribute("data-route-id", /route-/);
  }
});

test("feed place posts open a backed place detail while route posts open a user-shared course detail", async ({ page }) => {
  const feed = await gotoScreen(page, "b2");
  await feed.locator('[data-testid=media-tile][data-feed-type="place"]').first().click();
  await expect(page).toHaveURL(/screen=b4/);
  await expect(page.getByRole("button", { name: "피드로 돌아가기" })).toBeVisible();

  await page.getByRole("button", { name: "피드로 돌아가기" }).click();
  await expect(page).toHaveURL(/screen=b2/);
  await page.locator('[data-testid=media-tile][data-feed-type="route"]').first().click();
  await expect(page).toHaveURL(/screen=b4/);

  const detail = page.locator('[data-testid="course-detail"]');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute("data-content-type", "route");
  await expect(detail).toHaveAttribute("data-content-origin", "user-shared");
  await expect(detail.locator('[data-testid="course-sheet"]')).toHaveAttribute("data-sheet-state", "medium");
  await expect(detail.getByText("바꾸기", { exact: true })).toHaveCount(0);
  await expect(detail.locator('[data-action*="replace"], [data-action*="refresh"]')).toHaveCount(0);
  await expect(detail.locator(".discover-course-stop")).toHaveCount(3);
  const courseSheet = detail.locator('[data-testid="course-sheet"]');
  const courseHandle = courseSheet.getByRole("button", { name: "코스 상세 시트 이동" });
  const handleBox = await courseHandle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 90, { steps: 8 });
  await page.mouse.up();
  await expect(courseSheet).toHaveAttribute("data-sheet-state", "expanded");
  await detail.getByRole("button", { name: "코스 상세 닫기" }).click();
  await expect(page).toHaveURL(/screen=b2/);

  await page.locator('[data-testid=media-tile][data-feed-type="route"]').first().click();
  await expect(page).toHaveURL(/screen=b4/);
  await page.goBack();
  await expect(page).toHaveURL(/screen=b2/);
});

test("a user-shared course supports comments, native sharing, and quiet saving", async ({ page, browser }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ url }) => { window.__doripeSharedUrl = url; }
    });
  });
  const feed = await gotoScreen(page, "b2");
  const routePost = feed.locator('[data-testid=media-tile][data-feed-type="route"]').nth(1);
  const routeId = await routePost.getAttribute("data-route-id");
  await routePost.click();

  const detail = page.locator('[data-testid="course-detail"]');
  const routeName = (await detail.getByRole("heading", { level: 1 }).textContent()).trim();
  await detail.getByRole("button", { name: "코스 댓글 보기" }).click();
  const comments = detail.getByRole("dialog", { name: "코스 댓글" });
  await expect(comments).toBeVisible();
  await comments.getByRole("textbox", { name: "코스 댓글 입력" }).fill("다음 주말에 가볼게요");
  await comments.getByRole("button", { name: "코스 댓글 등록" }).click();
  await expect(comments).toContainText("다음 주말에 가볼게요");
  await comments.getByRole("button", { name: "코스 댓글 닫기" }).click();

  await detail.getByRole("button", { name: "공유하기" }).click();
  const sharedUrl = await page.evaluate(() => window.__doripeSharedUrl);
  expect(sharedUrl).toContain("type=route");
  expect(sharedUrl).toContain(`id=${routeId}`);

  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  const recipientUrl = new URL(sharedUrl);
  recipientUrl.searchParams.set("static", "1");
  await recipient.goto(recipientUrl.toString());
  await expect(recipient.locator('[data-testid="course-detail"]')).toBeVisible();
  await expect(recipient.getByRole("heading", { name: routeName })).toBeVisible();
  await expect(recipient.locator('[data-content-type="place"]')).toHaveCount(0);
  await recipientContext.close();

  await expect(detail.getByRole("button", { name: "길찾기" })).toHaveCount(0);
  await detail.getByRole("button", { name: "저장하기" }).click();
  await expect(page).toHaveURL(/screen=b4/);
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(state.savedRoutes).toContainEqual(expect.objectContaining({ name: routeName }));
});

test("place and route details keep a stable 3:4 hero behind a handle-only draggable sheet", async ({ page }) => {
  const place = await gotoScreen(page, "b4");
  const placeHero = place.locator(".discover-detail-hero");
  const placeSheet = place.locator('[data-testid="place-sheet"]');
  const placeGeometry = await place.evaluate((screen) => {
    const hero = screen.querySelector(".discover-detail-hero").getBoundingClientRect();
    const media = screen.querySelector(".discover-detail-hero img");
    const sheet = screen.querySelector('[data-testid="place-sheet"]').getBoundingClientRect();
    const author = screen.querySelector(".discover-author-pill").getBoundingClientRect();
    const social = screen.querySelector(".discover-hero-actions").getBoundingClientRect();
    return {
      sourceRatio: Number(media.getAttribute("width")) / Number(media.getAttribute("height")),
      sheetTop: sheet.top,
      authorBottom: author.bottom,
      socialBottom: social.bottom
    };
  });
  expect(Math.abs(placeGeometry.sourceRatio - 0.75)).toBeLessThanOrEqual(0.01);
  expect(placeGeometry.sheetTop).toBeGreaterThanOrEqual(470);
  expect(placeGeometry.sheetTop).toBeLessThanOrEqual(500);
  expect(placeGeometry.authorBottom).toBeLessThanOrEqual(placeGeometry.sheetTop);
  expect(placeGeometry.socialBottom).toBeLessThanOrEqual(placeGeometry.sheetTop);

  const initialState = await placeSheet.getAttribute("data-sheet-state");
  const summary = placeSheet.locator(".discover-place-summary");
  const summaryBox = await summary.boundingBox();
  await page.mouse.move(summaryBox.x + 40, summaryBox.y + Math.min(70, summaryBox.height * 0.7));
  await page.mouse.down();
  await page.mouse.move(summaryBox.x + 40, summaryBox.y + Math.min(70, summaryBox.height * 0.7) + 90, { steps: 8 });
  await page.mouse.up();
  await expect(placeSheet).toHaveAttribute("data-sheet-state", initialState);

  const collapsed = await gotoScreen(page, "b5");
  const collapsedGeometry = await collapsed.evaluate((screen) => {
    const hero = screen.querySelector(".discover-detail-hero").getBoundingClientRect();
    const sheet = screen.querySelector('[data-testid="place-sheet"]').getBoundingClientRect();
    const backgroundBottom = Number.parseFloat(getComputedStyle(screen, "::before").height);
    return { heroBottom: hero.bottom, backgroundBottom, sheetTop: sheet.top };
  });
  expect(collapsedGeometry.sheetTop).toBeLessThanOrEqual(collapsedGeometry.backgroundBottom + 1);

  await gotoScreen(page, "b2");
  await page.locator('[data-testid=media-tile][data-feed-type="route"]').first().click();
  const routeDetail = page.locator('[data-testid="course-detail"]');
  const routeGeometry = await routeDetail.evaluate((detail) => {
    const hero = detail.querySelector(".discover-course-detail__hero").getBoundingClientRect();
    const media = detail.querySelector(".discover-course-detail__hero img");
    const sheet = detail.querySelector('[data-testid="course-sheet"]').getBoundingClientRect();
    const author = detail.querySelector(".discover-course-author").getBoundingClientRect();
    const social = detail.querySelector(".discover-course-social").getBoundingClientRect();
    return {
      sourceRatio: Number(media.getAttribute("width")) / Number(media.getAttribute("height")),
      sheetTop: sheet.top,
      authorBottom: author.bottom,
      socialBottom: social.bottom
    };
  });
  expect(Math.abs(routeGeometry.sourceRatio - 0.75)).toBeLessThanOrEqual(0.01);
  expect(routeGeometry.sheetTop).toBeGreaterThanOrEqual(470);
  expect(routeGeometry.sheetTop).toBeLessThanOrEqual(500);
  expect(routeGeometry.authorBottom).toBeLessThanOrEqual(routeGeometry.sheetTop);
  expect(routeGeometry.socialBottom).toBeLessThanOrEqual(routeGeometry.sheetTop);
});

test("place and official details move through their media by touch zones and horizontal swipe", async ({ page }) => {
  for (const screenId of ["b4", "b10"]) {
    const detail = await gotoScreen(page, screenId);
    const hero = detail.locator(".discover-detail-hero");
    const media = hero.locator("[data-testid=detail-hero-media]");
    const initialId = await media.getAttribute("data-media-id");
    const box = await hero.boundingBox();
    const interactionY = box.y + Math.min(150, box.height * 0.2);

    await page.mouse.click(box.x + box.width - 24, interactionY);
    await expect(media).not.toHaveAttribute("data-media-id", initialId);
    await expect(detail.locator(".discover-detail-dots .is-active")).toHaveAttribute("data-media-index", "1");
    await expect(page).toHaveURL(new RegExp(`screen=${screenId}`));

    await page.mouse.click(box.x + 24, interactionY);
    await expect(media).toHaveAttribute("data-media-id", initialId);

    await page.mouse.move(box.x + box.width - 30, interactionY);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, interactionY, { steps: 8 });
    await page.mouse.up();
    await expect(media).not.toHaveAttribute("data-media-id", initialId);
  }
});

test("related places use the selected place photo behind a dark readable overlay", async ({ page }) => {
  const related = await gotoScreen(page, "b11");
  const query = related.locator(".discover-related-query");
  const background = await query.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(background).toContain("linear-gradient");
  expect(background).toContain("feed-1.jpg");
});

test("detail comments ellipsize long text and keep heart and count legible", async ({ page }) => {
  const detail = await gotoScreen(page, "b4");
  const comment = detail.locator(".discover-detail-comment").first();
  const geometry = await comment.evaluate((element) => {
    const body = element.querySelector("p");
    const icon = element.querySelector(".discover-comment__like-icon");
    const count = element.querySelector(".discover-comment__like span");
    const iconRect = icon.getBoundingClientRect();
    const countRect = count.getBoundingClientRect();
    const bodyStyle = getComputedStyle(body);
    return {
      bodyOverflow: bodyStyle.overflow,
      bodyTextOverflow: bodyStyle.textOverflow,
      bodyWhiteSpace: bodyStyle.whiteSpace,
      iconHeight: iconRect.height,
      countHeight: countRect.height,
      countFontSize: Number.parseFloat(getComputedStyle(count).fontSize)
    };
  });
  expect(geometry).toEqual(expect.objectContaining({
    bodyOverflow: "hidden",
    bodyTextOverflow: "ellipsis",
    bodyWhiteSpace: "nowrap"
  }));
  expect(geometry.iconHeight).toBeGreaterThanOrEqual(16);
  expect(geometry.countHeight).toBeGreaterThanOrEqual(16);
  expect(geometry.countFontSize).toBeGreaterThanOrEqual(12);
});

test("detail comments size to one row and cap the visible list at two rows", async ({ page }) => {
  await gotoScreen(page, "b4");
  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const state = JSON.parse(localStorage.getItem(key));
    state.currentScreenId = "b8";
    state.selections = { ...(state.selections || {}), selectedPlaceId: "place-2" };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto("/app-preview/?screen=b8&static=1");
  const oneRowSheet = page.locator(".discover-comments-sheet");
  await expect(oneRowSheet).toHaveAttribute("data-visible-comment-rows", "1");
  const oneRowHeight = (await oneRowSheet.boundingBox()).height;

  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const state = JSON.parse(localStorage.getItem(key));
    state.currentScreenId = "b4";
    state.selections = { ...(state.selections || {}), selectedPlaceId: "place-1" };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto("/app-preview/?screen=b4&static=1");
  await page.getByRole("button", { name: "댓글 보기" }).click();
  const twoRowSheet = page.locator(".discover-comments-sheet");
  await expect(twoRowSheet).toHaveAttribute("data-visible-comment-rows", "2");
  expect((await twoRowSheet.boundingBox()).height).toBeGreaterThan(oneRowHeight);
});

test("B4 other photos open B3 and related cards keep every label inside the card", async ({ page }) => {
  const detail = await gotoScreen(page, "b4");
  const sheet = detail.locator("[data-testid=place-sheet]");
  await sheet.evaluate((element) => { element.dataset.sheetState = "expanded"; });
  const cardsFit = await detail.locator(".discover-related-mini__card").evaluateAll((cards) => cards.every((card) => {
    const parent = card.getBoundingClientRect();
    return [...card.children].every((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left >= parent.left - 1 && rect.right <= parent.right + 1
        && rect.top >= parent.top - 1 && rect.bottom <= parent.bottom + 1;
    });
  }));
  expect(cardsFit).toBe(true);
  await detail.getByRole("button", { name: "다른 사진 전체보기" }).click();
  await expect(page).toHaveURL(/screen=b3/);
});

test("discover tabs share one centered floating glass navigation above screen content", async ({ page }) => {
  const styles = [];
  for (const screenId of ["b1", "b2"]) {
    await gotoScreen(page, screenId);
    styles.push(await page.locator(".preview-bottom-nav").evaluate((nav) => {
      const style = getComputedStyle(nav);
      const selected = nav.querySelector(".preview-bottom-nav__item--selected");
      const navRect = nav.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const screen = nav.closest(".discover-screen");
      const feed = screen.querySelector(".discover-feed");
      return {
        backdropFilter: style.backdropFilter,
        background: style.backgroundColor,
        zIndex: Number(style.zIndex),
        centerDelta: Math.abs((selectedRect.left + selectedRect.width / 2) - (Math.round(selectedRect.left + selectedRect.width / 2))),
        withinViewport: navRect.bottom <= window.innerHeight,
        feedBottom: getComputedStyle(feed).bottom,
        bottomDecoration: getComputedStyle(screen, "::after").content
      };
    }));
  }
  expect(styles[0].background).toBe(styles[1].background);
  expect(styles[0].backdropFilter).toBe(styles[1].backdropFilter);
  expect(styles.every(({ zIndex }) => zIndex >= 50)).toBe(true);
  expect(styles.every(({ centerDelta }) => centerDelta <= 0.5)).toBe(true);
  expect(styles.every(({ withinViewport }) => withinViewport)).toBe(true);
  expect(styles[0].feedBottom).toBe(styles[1].feedBottom);
  expect(styles.every(({ bottomDecoration }) => bottomDecoration === "none")).toBe(true);
});

test("place and course details share the same social overlay layout and local official badge", async ({ page }) => {
  const assertSocialOverlay = async (detail, contentType) => {
    const overlay = detail.locator('[data-testid="detail-social-overlay"]');
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveAttribute("data-content-type", contentType);
    await expect(overlay.locator(".discover-detail-social__profile")).toHaveCount(1);
    await expect(overlay.locator(".discover-detail-social__actions")).toHaveCount(1);
    await expect(overlay.getByRole("button", { name: /좋아요/ })).toHaveCount(1);
    await expect(overlay.getByRole("button", { name: /댓글/ })).toHaveCount(1);

    const badge = overlay.locator('.discover-detail-social__badge img[src="/app-preview/assets/icons/official-badge.svg"]');
    await expect(badge).toHaveCount(1);
    const geometry = await overlay.evaluate((node) => {
      const root = node.closest(".discover-screen").getBoundingClientRect();
      const profile = node.querySelector(".discover-detail-social__profile").getBoundingClientRect();
      const actions = [...node.querySelectorAll(".discover-detail-social__action")].map((action) => action.getBoundingClientRect());
      const badgeIcon = node.querySelector(".discover-detail-social__badge img").getBoundingClientRect();
      return {
        profileCenter: profile.left + profile.width / 2 - root.left,
        actionCenters: actions.map((action) => ({
          x: action.left + action.width / 2 - root.left,
          y: action.top + action.height / 2 - root.top
        })),
        badge: { width: badgeIcon.width, height: badgeIcon.height }
      };
    });
    expect(geometry.profileCenter).toBeLessThan(393 / 2);
    expect(geometry.actionCenters).toHaveLength(2);
    expect(geometry.actionCenters[0].x).toBeGreaterThan(393 / 2);
    expect(Math.abs(geometry.actionCenters[0].x - geometry.actionCenters[1].x)).toBeLessThanOrEqual(1);
    expect(geometry.actionCenters[1].y).toBeGreaterThan(geometry.actionCenters[0].y);
    expect(geometry.badge.width).toBeLessThanOrEqual(16);
    expect(geometry.badge.height).toBeLessThanOrEqual(16);
  };

  const place = await gotoScreen(page, "b4");
  await assertSocialOverlay(place, "place");

  await gotoScreen(page, "b2");
  await page.locator('[data-testid=media-tile][data-feed-type="route"][data-route-id="route-1"]').first().click();
  const course = page.locator('[data-testid="course-detail"]');
  await assertSocialOverlay(course, "route");
  await expect(course.locator('[data-testid="course-sheet"] .discover-place-actions > button')).toHaveText([
    "공유하기",
    "저장하기"
  ]);
});

test("detail social overlays stay synchronized with their sheets during and after drag", async ({ page }) => {
  const assertDragSync = async ({ detail, sheet, handleName }) => {
    const overlay = detail.locator('[data-testid="detail-social-overlay"]');
    await waitForSettledGeometry(sheet);
    await waitForSettledGeometry(overlay);
    const initialSheet = await sheet.boundingBox();
    const initialOverlay = await overlay.boundingBox();
    const handle = sheet.getByRole("button", { name: handleName });
    const handleBox = await handle.boundingBox();

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 80, { steps: 8 });
    const draggedSheet = await sheet.boundingBox();
    const draggedOverlay = await overlay.boundingBox();
    expect(Math.abs(
      (draggedSheet.y - initialSheet.y) - (draggedOverlay.y - initialOverlay.y)
    )).toBeLessThanOrEqual(1);
    await page.mouse.up();

    await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");
    await waitForSettledGeometry(sheet);
    await waitForSettledGeometry(overlay);
    const settledSheet = await sheet.boundingBox();
    const settledOverlay = await overlay.boundingBox();
    expect(Math.abs(
      (settledSheet.y - initialSheet.y) - (settledOverlay.y - initialOverlay.y)
    )).toBeLessThanOrEqual(1);
  };

  const place = await gotoScreen(page, "b4");
  await assertDragSync({
    detail: place,
    sheet: place.locator('[data-testid="place-sheet"]'),
    handleName: "장소 상세 닫기"
  });

  await gotoScreen(page, "b2");
  await page.locator('[data-testid=media-tile][data-feed-type="route"]').first().click();
  const course = page.locator('[data-testid="course-detail"]');
  await assertDragSync({
    detail: course,
    sheet: course.locator('[data-testid="course-sheet"]'),
    handleName: "코스 상세 시트 이동"
  });
});

test("raising a place detail sheet keeps the white surface covering the viewport bottom", async ({ page }) => {
  const detail = await gotoScreen(page, "b4");
  const sheet = detail.locator('[data-testid="place-sheet"]');
  const handle = sheet.getByRole("button", { name: "장소 상세 닫기" });
  const handleBox = await handle.boundingBox();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 - 100, { steps: 8 });
  const coverage = await sheet.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { bottom: box.bottom, viewportBottom: window.innerHeight };
  });
  expect(coverage.bottom).toBeGreaterThanOrEqual(coverage.viewportBottom - 1);
  await page.mouse.up();
});

test("detail sheet and social overlay motion is removed when reduced motion is preferred", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const detail = await gotoScreen(page, "b4");
  const transitions = await detail.evaluate((root) => [
    root.querySelector('[data-testid="place-sheet"]'),
    root.querySelector('[data-testid="detail-social-overlay"]')
  ].map((element) => getComputedStyle(element).transitionDuration));
  expect(transitions.every((value) => value.split(",").every((duration) => Number.parseFloat(duration) === 0))).toBe(true);
});

test("filter control uses a centered sliders icon and all visible tags stay inside their pills", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const screen = await gotoScreen(page, "b2");
  const filter = screen.getByRole("button", { name: /필터/ });
  const icon = filter.locator(".discover-filter-button__icon");
  await expect(icon).toBeVisible();
  const alignment = await filter.evaluate((button) => {
    const buttonRect = button.getBoundingClientRect();
    const iconRect = button.querySelector(".discover-filter-button__icon").getBoundingClientRect();
    return {
      iconCenter: iconRect.top + iconRect.height / 2,
      buttonCenter: buttonRect.top + buttonRect.height / 2
    };
  });
  expect(Math.abs(alignment.iconCenter - alignment.buttonCenter)).toBeLessThanOrEqual(1);

  await screen.locator('[data-testid=media-tile][data-feed-type="place"]').first().click();
  const overflowed = await page.locator(".discover-tag").evaluateAll((tags) => tags.some((tag) => (
    tag.scrollWidth > tag.clientWidth || tag.scrollHeight > tag.clientHeight
  )));
  expect(overflowed).toBe(false);
});

async function b2PlaceOrder(page, selections = {}) {
  await page.evaluate(({ nextSelections }) => localStorage.setItem("doripe_app_preview_v1", JSON.stringify({
    currentScreenId: "b2",
    selections: nextSelections
  })), { nextSelections: selections });
  await page.goto("/app-preview/?screen=b2&static=1");
  return page.locator('[data-testid="media-tile"][data-feed-type="place"]').evaluateAll((tiles) => (
    [...new Set(tiles.map((tile) => tile.dataset.placeId))]
  ));
}

test("B2 deterministically orders real places for default, map-search, and social-photo habits", async ({ page }) => {
  expect((await b2PlaceOrder(page)).slice(0, 3)).toEqual(["place-1", "place-2", "place-3"]);
  expect((await b2PlaceOrder(page, { placeSource: "naver-map-saved" })).slice(0, 3)).toEqual(["place-1", "place-8", "place-2"]);
  expect((await b2PlaceOrder(page, { placeSource: "instagram-saved" })).slice(0, 3)).toEqual(["place-12", "place-11", "place-10"]);
});

test("B2 ignores legacy neighborhood selections and only applies an explicit pin radius", async ({ page }) => {
  expect((await b2PlaceOrder(page, { neighborhood: "yongsan" })).slice(0, 3)).toEqual(["place-1", "place-2", "place-3"]);
  await expect(page.getByRole("button", { name: /필터/ })).toHaveText("필터");

  expect((await b2PlaceOrder(page, { feedNeighborhood: "yeonnam" })).slice(0, 3)).toEqual(["place-1", "place-2", "place-3"]);
  await expect(page.getByRole("button", { name: /필터/ })).toHaveText("필터");

  expect(await b2PlaceOrder(page, {
    locationMode: "pin",
    locationCenter: { latitude: 37.5624, longitude: 126.9257 },
    locationRadiusKm: 0.05
  })).toEqual(["place-1"]);
  await expect(page.getByRole("button", { name: /필터/ })).toHaveText("필터");
});

test("B3 contains only the selected place media and preserves each supplied source", async ({ page }) => {
  const screen = await gotoScreen(page, "b3");
  const feed = screen.locator("[data-testid=discover-feed]");
  const tiles = feed.locator("[data-testid=media-tile]");
  const rendered = await tiles.evaluateAll((items) => items.map((tile) => ({
    mediaId: tile.dataset.mediaId,
    placeId: tile.dataset.placeId,
    source: new URL(tile.querySelector("img").src).pathname
  })));

  expect(rendered).toEqual(PLACES[0].mediaIds.map((mediaId) => ({
    mediaId,
    placeId: PLACES[0].id,
    source: MEDIA.find((media) => media.id === mediaId).src
  })));
});

test("content details expose working media, social, place, and route actions", async ({ page }) => {
  await gotoScreen(page, "b4");
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByRole("button", { name: "좋아요 취소", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  await page.getByRole("button", { name: "댓글 보기" }).click();
  await expect(page).toHaveURL(/screen=b8/);
  await expect(page.getByRole("dialog", { name: "댓글" })).toBeVisible();
  await expect(page.locator(".discover-comments-background .discover-place-title")).toHaveText("오브젝트 연남");
  await page.getByPlaceholder("댓글 추가하기").fill("다시 가고 싶어요");
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(page.locator("[data-testid=comment-list]")).toContainText("다시 가고 싶어요");
  await page.getByRole("button", { name: /댓글 좋아요/ }).first().click();
  await expect(page.locator("[data-testid=comment-list]")).toContainText("다시 가고 싶어요");
  await page.getByRole("button", { name: "댓글 배경 닫기" }).click({ position: { x: 12, y: 12 } });
  await page.getByRole("button", { name: "장소 공식 화면" }).click();
  await expect(page).toHaveURL(/screen=b10/);
  await page.getByRole("button", { name: "이 장소로 코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d4/);
});

test("comment sheet grows from one visible comment row to at most two rows", async ({ page }) => {
  const openCommentsForPlace = async (placeId) => {
    await gotoScreen(page, "b2");
    await page.locator(`[data-testid="media-tile"][data-feed-type="place"][data-place-id="${placeId}"]`).first().click();
    await page.getByRole("button", { name: "댓글 보기" }).click();
    const sheet = page.getByRole("dialog", { name: "댓글" });
    await expect(sheet).toBeVisible();
    return {
      height: (await sheet.boundingBox()).height,
      visibleRows: await sheet.getAttribute("data-visible-comment-rows")
    };
  };

  const oneComment = await openCommentsForPlace("place-2");
  const twoComments = await openCommentsForPlace("place-1");

  expect(oneComment.visibleRows).toBe("1");
  expect(twoComments.visibleRows).toBe("2");
  expect(twoComments.height).toBeGreaterThan(oneComment.height);
});

test("saving and unsaving a place in discovery keeps C1 exactly in sync with canonical saved places", async ({ page }) => {
  await gotoScreen(page, "b10");
  const selectedPlaceId = await page.locator("[data-testid=place-sheet]").getAttribute("data-place-id");
  await page.getByRole("button", { name: "저장하기" }).click();

  await page.goto("/app-preview/?screen=c1&static=1");
  await expect(page.locator(".saved-place-row strong")).toHaveText(["오브젝트 연남"]);
  await expect(page.locator(".saved-recommend-card strong")).toHaveText(["오브젝트 연남"]);

  await page.goto("/app-preview/?screen=d4&static=1");
  await page.evaluate((placeId) => {
    const key = "doripe_app_preview_v1";
    const state = JSON.parse(localStorage.getItem(key));
    state.selections = { ...state.selections, selectedPlaceId: placeId, startPlaceCardOpen: true };
    state.routeDraft = { startPlaceId: placeId, placeIds: [placeId] };
    state.routePlaceIds = [placeId];
    localStorage.setItem(key, JSON.stringify(state));
  }, selectedPlaceId);
  await page.reload();
  await page.getByRole("button", { name: "여기서 시작하기" }).click();
  await expect(page.locator(".route-saved-candidate h3")).toHaveCount(0);
  await expect(page.getByText("0곳 선택됨", { exact: true })).toBeVisible();

  await page.goto("/app-preview/?screen=b10&static=1");
  await page.getByRole("button", { name: "저장됨" }).click();
  await page.goto("/app-preview/?screen=c1&static=1");
  await expect(page.getByText("저장한 장소가 아직 없어요", { exact: true })).toBeVisible();
  await expect(page.locator(".saved-place-row")).toHaveCount(0);
});

test("photo viewer paginates, preloads two media, and canceled drag keeps the current media", async ({ page }) => {
  const viewer = await gotoScreen(page, "b7");
  const media = viewer.locator("[data-testid=viewer-media]");
  await expect(viewer.locator(".discover-viewer__metadata")).toHaveCount(0);
  const alignment = await viewer.evaluate((root) => {
    const rootRect = root.getBoundingClientRect();
    const frameRect = root.querySelector(".discover-viewer__frame").getBoundingClientRect();
    const dotsRect = root.querySelector(".discover-viewer__dots").getBoundingClientRect();
    return {
      frameCenterX: frameRect.left + frameRect.width / 2 - rootRect.left,
      frameCenterY: frameRect.top + frameRect.height / 2 - rootRect.top,
      dotsCenterX: dotsRect.left + dotsRect.width / 2 - rootRect.left,
      rootCenterX: rootRect.width / 2,
      rootCenterY: rootRect.height / 2
    };
  });
  expect(Math.abs(alignment.frameCenterX - alignment.rootCenterX)).toBeLessThanOrEqual(1);
  expect(Math.abs(alignment.frameCenterY - alignment.rootCenterY)).toBeLessThanOrEqual(1);
  expect(Math.abs(alignment.dotsCenterX - alignment.rootCenterX)).toBeLessThanOrEqual(1);
  const initialId = await media.getAttribute("data-media-id");
  await expect(viewer.locator('link[rel="preload"]')).toHaveCount(2);
  await viewer.getByRole("button", { name: "다음 사진" }).click();
  await expect(media).not.toHaveAttribute("data-media-id", initialId);
  await viewer.getByRole("button", { name: "이전 사진" }).click();
  await expect(media).toHaveAttribute("data-media-id", initialId);
  const box = await media.boundingBox();
  await page.mouse.move(box.x + 160, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 175, box.y + 200);
  await page.mouse.up();
  await expect(media).toHaveAttribute("data-media-id", initialId);
});

test("B4 detail sheet drags through collapsed, medium, and expanded states", async ({ page }) => {
  const detail = await gotoScreen(page, "b4");
  const sheet = detail.locator("[data-testid=place-sheet]");
  const placeId = await sheet.getAttribute("data-place-id");
  await expect(sheet).toHaveAttribute("data-sheet-state", "medium");
  await waitForSettledGeometry(sheet);
  let box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-place-id", placeId);
  await expect(sheet).toHaveAttribute("data-sheet-state", "medium");

  await waitForSettledGeometry(sheet);
  box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

  await waitForSettledGeometry(sheet);
  box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 100);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-sheet-state", "medium");

  await waitForSettledGeometry(sheet);
  box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 100);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");
  await sheet.getByRole("button", { name: "저장하기" }).click();
  await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");
  await sheet.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(sheet.getByText("관련 장소", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "이 장소로 코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d3/);
});

test("detail sheet handle closes by keyboard while a downward drag collapses it", async ({ page }) => {
  await gotoScreen(page, "b2");
  await page.locator("[data-testid=media-tile]").first().click();
  await expect(page).toHaveURL(/screen=b4/);
  await page.getByRole("button", { name: "장소 상세 닫기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/screen=b2/);

  await page.locator("[data-testid=media-tile]").first().click();
  const handle = page.getByRole("button", { name: "장소 상세 닫기" });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  await page.mouse.up();
  await expect(page).toHaveURL(/screen=b4/);
  await expect(page.locator("[data-testid=place-sheet]")).toHaveAttribute("data-sheet-state", "collapsed");
});

test("official place links to hours, media, related places, map, and browser back", async ({ page }) => {
  await gotoScreen(page, "b10");
  await page.getByRole("button", { name: "영업시간 보기" }).click();
  await expect(page).toHaveURL(/screen=b9/);
  await page.getByRole("button", { name: "영업시간 닫기" }).click();
  await expect(page).toHaveURL(/screen=b10/);
  await page.getByRole("button", { name: "다른 사진 전체보기" }).click();
  await expect(page).toHaveURL(/screen=b3/);
  await page.goBack();
  await expect(page).toHaveURL(/screen=b10/);
  await page.getByRole("button", { name: "관련 장소 전체보기" }).click();
  await expect(page).toHaveURL(/screen=b11/);
  const originalPlaceName = await page.locator(".discover-related-query strong").textContent();
  await page.locator("[data-testid=related-place]").first().click();
  await expect(page).toHaveURL(/screen=b10/);
  await page.goBack();
  await expect(page.locator(".discover-related-query strong")).toHaveText(originalPlaceName);
});

test("profiles and following list use dynamic users and toggle follow state", async ({ page }) => {
  await gotoScreen(page, "b13");
  const row = page.locator("[data-testid=following-user]").first();
  await expect(page.locator(".discover-following-count")).toHaveText("6명 팔로잉");
  await row.getByRole("button", { name: /프로필 보기/ }).click();
  await expect(page).toHaveURL(/screen=b12/);
  await page.getByRole("button", { name: "언팔로우" }).click();
  await expect(page.getByRole("button", { name: "팔로우" })).toBeVisible();
  await page.locator("[data-testid=profile-content]").first().click();
  await expect(page).toHaveURL(/screen=b4/);
});

test("the Following strip derives its overflow count from actual followed profiles", async ({ page }) => {
  await gotoScreen(page, "b1");
  await expect(page.locator(".discover-following-strip__profile")).toHaveCount(4);
  await expect(page.locator(".discover-following-strip__more")).toHaveText("+2");
});

test("B3 switches completely to a newly selected place", async ({ page }) => {
  await gotoScreen(page, "b11");
  await page.locator("[data-testid=related-place]").first().click();
  const selectedPlaceId = await page.locator("[data-testid=place-sheet]").getAttribute("data-place-id");
  await page.getByRole("button", { name: "다른 사진 전체보기" }).click();
  const tiles = await page.locator("[data-testid=media-tile]").evaluateAll((items) => items.map((tile) => ({
    mediaId: tile.dataset.mediaId,
    placeId: tile.dataset.placeId,
    source: tile.querySelector("img").src
  })));
  expect(tiles).toHaveLength(5);
  expect(tiles.every(({ placeId }) => placeId === selectedPlaceId)).toBe(true);
  expect(tiles.map(({ source }) => new URL(source).pathname)).toEqual([
    "/app-preview/assets/discover/feed-2.jpg",
    "/app-preview/assets/discover/feed-3.jpg",
    "/app-preview/assets/discover/feed-4.jpg",
    "/app-preview/assets/discover/feed-5.jpg",
    "/app-preview/assets/discover/feed-6.jpg"
  ]);

  await gotoScreen(page, "b12");
  const selectedUser = await page.locator(".discover-profile-header h1").textContent();
  const profileMedia = await page.locator("[data-testid=profile-content]").count();
  expect(selectedUser).toBe("dori");
  expect(profileMedia).toBeGreaterThan(0);
});

test("related-place navigation clears media from the previous place", async ({ page }) => {
  await gotoScreen(page, "b4");
  await page.getByRole("button", { name: /브런치가든 연남 열기/ }).click();
  await expect(page).toHaveURL(/screen=b10/);
  await expect(page.locator(".discover-detail-hero img")).toHaveAttribute("alt", /브런치가든 연남/);
});

test("feed collection exposes loading, error, and empty states", async ({ page }) => {
  for (const [status, text] of [
    ["loading", null],
    ["error", "피드를 불러오지 못했어요"],
    ["empty", "조건에 맞는 장소가 아직 없어요"]
  ]) {
    await page.goto("/app-preview/?screen=b2&static=1");
    await page.evaluate((nextStatus) => {
      const state = JSON.parse(localStorage.getItem("doripe_app_preview_v1"));
      state.selections = { ...state.selections, feedStatus: nextStatus };
      localStorage.setItem("doripe_app_preview_v1", JSON.stringify(state));
    }, status);
    await page.reload();
    const feed = page.locator("[data-testid=discover-feed]");
    await expect(feed).toHaveAttribute("data-feed-status", status);
    if (text) await expect(feed).toContainText(text);
    else await expect(feed.locator(".discover-feed-skeleton")).toHaveCount(6);
    if (status === "error") {
      await page.getByRole("button", { name: "피드 다시 시도" }).click();
      await expect(page.locator("[data-testid=media-tile]").first()).toBeVisible();
      await page.reload();
      await expect(page.locator("[data-testid=media-tile]").first()).toBeVisible();
    }
  }
});

test("Flow B remains usable without crop or overlap at supported viewport sizes", async ({ page }) => {
  for (const viewport of [{ width: 375, height: 667 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    for (const screenId of FLOW_B_IDS) {
      const screen = await gotoScreen(page, screenId);
      const result = await screen.evaluate((root) => ({
        width: root.getBoundingClientRect().width,
        scrollWidth: root.scrollWidth,
        controls: [...root.querySelectorAll("button, input")].filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !(rect.right >= 0 && rect.left <= innerWidth);
        }).map((element) => element.getAttribute("aria-label") || element.tagName)
      }));
      expect(result.scrollWidth).toBeLessThanOrEqual(result.width + 1);
      expect(result.controls, `${screenId} controls at ${viewport.width}x${viewport.height}`).toEqual([]);
    }
  }
});

test("Flow B rendered geometry stays within one pixel at the canonical viewport", async ({ page }) => {
  let maximumDelta = 0;
  for (const screenId of FLOW_B_IDS) {
    const screen = await gotoScreen(page, screenId);
    maximumDelta = Math.max(maximumDelta, await assertMeasuredGeometry(screen, screenId));
  }
  expect(maximumDelta).toBeLessThanOrEqual(1);
});

test("B4 B5 and B6 use the explicit AI sheet positions over immutable Figma evidence", async ({ page }) => {
  for (const screenId of ["b4", "b5", "b6"]) {
    const screen = await gotoScreen(page, screenId);
    const geometry = await screen.evaluate((root) => ({
      heroHeight: root.querySelector(".discover-detail-hero").getBoundingClientRect().height,
      sheetTop: root.querySelector('[data-testid="place-sheet"]').getBoundingClientRect().top
    }));
    expect(geometry).toEqual({
      heroHeight: AI_GEOMETRY_OVERRIDES[screenId].heroHeight,
      sheetTop: AI_GEOMETRY_OVERRIDES[screenId].sheetTop
    });
  }
});

test("@visual Flow B screenshots stay within their reviewed visual budgets", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const ratios = {};
  for (const screenId of FLOW_B_IDS) {
    const screen = await gotoScreen(page, screenId);
    if (await screen.locator("img").count()) await screen.locator("img").first().waitFor({ state: "visible" });
    if (AI_DETAIL_BASELINE_IDS.has(screenId)) {
      await expect(screen).toHaveScreenshot(`flow-b-${screenId}.png`, {
        animations: "disabled",
        maxDiffPixelRatio: 0.003
      });
      continue;
    }
    ratios[screenId] = await visualDiffRatio(page, screen, screenId, testInfo.outputPath(`${screenId}.png`));
  }
  await testInfo.attach("flow-b-visual-diff", {
    body: Buffer.from(JSON.stringify(ratios, null, 2)),
    contentType: "application/json"
  });
  for (const [screenId, result] of Object.entries(ratios)) {
    const budget = screenId === "b7" ? 0.055 : 0.02;
    expect(result.ratio, `${screenId} visual diff ratio`).toBeLessThanOrEqual(budget);
  }
});

test("B4 reflow keeps its visible local photos pixel-checked", async ({ page }) => {
  const screen = await gotoScreen(page, "b4");
  const photos = screen.locator(".discover-detail-hero > img, .discover-place-summary > img, .discover-media-strip .discover-media > img, .discover-related-mini .discover-media > img");
  expect(await photos.count()).toBeGreaterThan(0);
  for (const photo of await photos.all()) {
    const box = await photo.boundingBox();
    if (!box || box.y + box.height <= 0 || box.y >= 852) continue;
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
