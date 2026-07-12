import { expect, test } from "@playwright/test";
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import coverageManifest from "../../public/app-preview/figma/flow-b-coverage-manifest.json" with { type: "json" };
import { resolveFlowBCoverage } from "../../scripts/app-preview-semantic-gates.mjs";

const FLOW_B_IDS = Array.from({ length: 13 }, (_, index) => `b${index + 1}`);

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function gotoScreen(page, screenId) {
  await page.goto(`/app-preview/?screen=${screenId}&static=1`);
  return page.locator(`[data-screen-id="${screenId}"]`);
}

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
    const expected = measurements[screenId].elements[source];
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
        band.compared += 1;
        if (delta > maxColorDelta) {
          different += 1;
          band.different += 1;
        }
      }
    }
    const sampleAt = (data, x, y) => [...data.slice((y * 393 + x) * 4, (y * 393 + x) * 4 + 4)];
    return { ratio: different / compared, bands, samples: Object.fromEntries([[196, 840], [196, 86], [24, 115], [196, 115], [22, 569], [196, 700]].map(([x, y]) => [`${x},${y}`, { actual: sampleAt(actual, x, y), reference: sampleAt(reference, x, y) }])) };
  }, {
    actualBase64: screenshot.toString("base64"),
    referenceUrl: `/app-preview/assets/references/${screenId}.png`,
    screenMasks: masks[screenId]
  });
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
  await expect(filterSheet.getByRole("heading", { name: "어떤 장소를 다시 볼까요?" })).toBeVisible();
  await expect(page.locator("[data-testid=filter-menu]")).toHaveCount(0);
  await filterSheet.getByRole("button", { name: "친구랑" }).click();
  await filterSheet.getByRole("button", { name: "저장 장소 다시 정렬하기" }).click();
  await expect(filterSheet).toHaveCount(0);
  await expect(page).toHaveURL(/screen=b2/);
  const filteredState = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(filteredState.selections.situation).toBe("tag-friends");
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
  await overlay.click({ position: { x: 20, y: 100 } });
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
    await expect(feed.locator("[data-testid=media-tile]")).toHaveCount(36);

    const dimensions = await feed.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }));
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight * 2);

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

test("content details expose working media, social, place, and route actions", async ({ page }) => {
  await gotoScreen(page, "b4");
  await page.getByRole("button", { name: "좋아요", exact: true }).click();
  await expect(page.getByRole("button", { name: "좋아요 취소", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  await page.getByRole("button", { name: "댓글 보기" }).click();
  await expect(page).toHaveURL(/screen=b8/);
  await page.getByPlaceholder("댓글 추가하기").fill("다시 가고 싶어요");
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(page.locator("[data-testid=comment-list]")).toContainText("다시 가고 싶어요");
  await page.getByRole("button", { name: /댓글 좋아요/ }).first().click();
  await expect(page.locator("[data-testid=comment-list]")).toContainText("다시 가고 싶어요");
  await page.getByRole("button", { name: "댓글 닫기" }).click();
  await page.getByRole("button", { name: "장소 공식 화면" }).click();
  await expect(page).toHaveURL(/screen=b10/);
  await page.getByRole("button", { name: "이 장소로 코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d4/);
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
  let box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-place-id", placeId);
  await expect(sheet).toHaveAttribute("data-sheet-state", "medium");

  box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-sheet-state", "collapsed");

  box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 100);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-sheet-state", "medium");

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
  await expect(page).toHaveURL(/screen=d1/);
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

test("place and profile media screens never borrow unrelated media", async ({ page }) => {
  await gotoScreen(page, "b11");
  await page.locator("[data-testid=related-place]").first().click();
  const selectedPlaceId = await page.locator("[data-testid=place-sheet]").getAttribute("data-place-id");
  await page.getByRole("button", { name: "다른 사진 전체보기" }).click();
  const otherPlaceIds = await page.locator("[data-testid=media-tile]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.placeId));
  expect(otherPlaceIds).toHaveLength(3);
  expect(new Set(otherPlaceIds)).toEqual(new Set([selectedPlaceId]));

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
    await page.goto("/app-preview/?screen=b2");
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

test("Flow B screenshots stay within their reviewed visual budgets", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const ratios = {};
  for (const screenId of FLOW_B_IDS) {
    const screen = await gotoScreen(page, screenId);
    if (await screen.locator("img").count()) await screen.locator("img").first().waitFor({ state: "visible" });
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
