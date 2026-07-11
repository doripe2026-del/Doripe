import { expect, test } from "@playwright/test";
import masks from "../../public/app-preview/figma/saved-visual-masks.json" with { type: "json" };

const STORAGE_KEY = "doripe_app_preview_v1";
const FLOW_C = ["c1", "c2", "c3", "c4", "c6", "c7"];

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

async function gotoSaved(page, screenId, state = {}) {
  await page.goto(`/app-preview/?screen=${screenId}`);
  if (Object.keys(state).length) {
    await page.evaluate(({ key, next }) => {
      const current = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...current, ...next }));
    }, { key: STORAGE_KEY, next: state });
    await page.reload();
  }
  return page.locator(`[data-screen-id="${screenId}"]`);
}

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
  await page.goto("/app-preview/?screen=c5");
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

test("place cards open map detail and its selected place route", async ({ page }) => {
  await gotoSaved(page, "c1");
  await page.getByRole("button", { name: /오브젝트 연남 상세/ }).first().click();
  await expect(page).toHaveURL(/screen=c4/);
  await expect(page.getByRole("heading", { name: "오브젝트 연남" })).toBeVisible();
  await page.getByRole("button", { name: "오브젝트 연남 장소 보기" }).click();
  await expect(page).toHaveURL(/screen=b10/);
});

test("route cards open route details and replacement flow", async ({ page }) => {
  await gotoSaved(page, "c2");
  await page.getByRole("button", { name: "연남 저녁 데이트 코스 경로 보기" }).click();
  const mapState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(mapState.overlays).toContain("saved-route-map");
  expect(mapState.selections.selectedRouteId).toBe("route-1");

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
      expect(geometry.width).toBe(393);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(393);
      expect(geometry.viewportWidth).toBe(viewport.width);
    }
  }
});

test("Flow C fixed UI stays within two percent of current Figma", async ({ page }) => {
  for (const screenId of FLOW_C) {
    await page.goto(`/app-preview/?screen=${screenId}&static=1`);
    const screen = page.locator(`[data-screen-id="${screenId}"]`);
    const ratio = await visualDiffRatio(page, screen, screenId);
    expect(ratio, `${screenId} visual difference`).toBeLessThanOrEqual(0.0201);
  }
});
