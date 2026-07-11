import { expect, test } from "@playwright/test";
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import coverageManifest from "../../public/app-preview/figma/flow-b-coverage-manifest.json" with { type: "json" };
import { resolveFlowBCoverage } from "../../scripts/app-preview-semantic-gates.mjs";

const FLOW_B_IDS = Array.from({ length: 13 }, (_, index) => `b${index + 1}`);

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
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

test("discover and following feeds switch, filter, scroll, and open content", async ({ page }) => {
  const following = await gotoScreen(page, "b1");
  const feed = following.locator("[data-testid=discover-feed]");
  await expect(feed).toHaveCSS("overflow-y", "auto");
  await following.getByRole("button", { name: "Discover" }).click();
  await expect(page).toHaveURL(/screen=b2/);
  await page.getByRole("button", { name: "필터" }).click();
  await expect(page.locator("[data-testid=filter-menu]")).toBeVisible();
  await page.getByRole("button", { name: "조용한 곳" }).click();
  await expect(page.locator("[data-testid=filter-menu]")).toHaveCount(0);
  await page.locator("[data-testid=discover-feed]").evaluate((element) => { element.scrollTop = 300; });
  await page.locator("[data-testid=media-tile]").first().click();
  await expect(page).toHaveURL(/screen=b4/);
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
  await page.getByRole("button", { name: "댓글 닫기" }).click();
  await page.getByRole("button", { name: "장소 공식 화면" }).click();
  await expect(page).toHaveURL(/screen=b10/);
  await page.getByRole("button", { name: "이 장소로 코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d4/);
});

test("photo viewer paginates, preloads two media, and canceled drag keeps the current media", async ({ page }) => {
  const viewer = await gotoScreen(page, "b7");
  const media = viewer.locator("[data-testid=viewer-media]");
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

test("detail sheet drag uses a threshold and preserves the selected place on cancel", async ({ page }) => {
  const detail = await gotoScreen(page, "b5");
  const sheet = detail.locator("[data-testid=place-sheet]");
  const placeId = await sheet.getAttribute("data-place-id");
  const initialState = await sheet.getAttribute("data-sheet-state");
  const box = await sheet.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-place-id", placeId);
  await expect(sheet).toHaveAttribute("data-sheet-state", initialState);
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 100);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");
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
  await page.locator("[data-testid=related-place]").first().click();
  await expect(page).toHaveURL(/screen=b10/);
});

test("profiles and following list use dynamic users and toggle follow state", async ({ page }) => {
  await gotoScreen(page, "b13");
  const row = page.locator("[data-testid=following-user]").first();
  await row.getByRole("button", { name: "팔로우" }).click();
  await expect(row.getByRole("button", { name: "언팔로우" })).toBeVisible();
  await row.getByRole("button", { name: /프로필 보기/ }).click();
  await expect(page).toHaveURL(/screen=b12/);
  await page.getByRole("button", { name: "언팔로우" }).click();
  await expect(page.getByRole("button", { name: "팔로우" })).toBeVisible();
  await page.locator("[data-testid=profile-content]").first().click();
  await expect(page).toHaveURL(/screen=b4/);
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

test("Flow B screenshots stay within the committed two-percent visual budget", async ({ page }, testInfo) => {
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
    expect(result.ratio, `${screenId} visual diff ratio`).toBeLessThanOrEqual(0.02);
  }
});
