import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

async function gotoRouteConfirmation(page, routePlaceIds = []) {
  await page.goto("/app-preview/?screen=d7");
  if (routePlaceIds.length) {
    await page.evaluate(({ key, ids }) => {
      const current = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...current, routePlaceIds: ids }));
    }, { key: STORAGE_KEY, ids: routePlaceIds });
    await page.reload();
  }
  return page.locator('[data-screen-id="d7"]');
}

async function visualDiffRatio(page, screen) {
  const screenshot = await screen.screenshot({ animations: "disabled" });
  return page.evaluate(async (actualBase64) => {
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
    const [actualImage, referenceImage] = await Promise.all([
      load(`data:image/png;base64,${actualBase64}`),
      load("/app-preview/assets/references/d7.png")
    ]);
    const pixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 393;
      canvas.height = 852;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, 393, 852);
      return context.getImageData(0, 0, 393, 852).data;
    };
    const actual = pixels(actualImage);
    const reference = pixels(referenceImage);
    let different = 0;
    for (let offset = 0; offset < actual.length; offset += 4) {
      const delta = Math.abs(actual[offset] - reference[offset])
        + Math.abs(actual[offset + 1] - reference[offset + 1])
        + Math.abs(actual[offset + 2] - reference[offset + 2]);
      if (delta > 75) different += 1;
    }
    return different / (actual.length / 4);
  }, screenshot.toString("base64"));
}

test("D7 is a semantic route confirmation screen backed by selected places", async ({ page }) => {
  const screen = await gotoRouteConfirmation(page, ["place-1", "place-7", "place-8"]);

  await expect(screen).toHaveAttribute("data-figma-node", "446:2166");
  await expect(screen).toHaveAttribute("data-render-mode", "semantic");
  await expect(page.getByText("선택한 장소 3개", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "코스 후보 3개 추가됨" })).toBeVisible();
  await expect(page.getByText("오브젝트 연남 · 리틀넬 연남 · 카페 노티드", { exact: true })).toBeVisible();
});

test("D7 exposes every visible Figma control as a working button", async ({ page }) => {
  await gotoRouteConfirmation(page, ["place-1", "place-7", "place-8"]);

  await page.getByRole("button", { name: "장소 바꾸기" }).click();
  await expect(page).toHaveURL(/screen=d5/);

  await page.goto("/app-preview/?screen=d7");
  await page.getByRole("button", { name: "코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d8/);

  const destinations = [
    ["발견", "b2"],
    ["저장", "c1"],
    ["코스", "d1"],
    ["설정", "e1"]
  ];
  for (const [label, screenId] of destinations) {
    await page.goto("/app-preview/?screen=d7");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`screen=${screenId}`));
  }
});

test("D7 uses the measured fixed frame without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 393, height: 852 }, { width: 360, height: 780 }]) {
    await page.setViewportSize(viewport);
    const screen = await gotoRouteConfirmation(page);
    const geometry = await screen.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      scrollWidth: element.scrollWidth
    }));
    expect(geometry).toEqual({ width: 393, height: 852, scrollWidth: 393 });
  }
});

test("D7 stays within two percent of the current Figma frame", async ({ page }) => {
  const screen = await gotoRouteConfirmation(page, ["place-1", "place-7", "place-8"]);
  expect(await visualDiffRatio(page, screen)).toBeLessThanOrEqual(0.02);
});
