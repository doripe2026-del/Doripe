import { expect, test } from "@playwright/test";
import { PLACES } from "../../public/booth-demo/places.js";

test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

const [firstPlace, secondPlace] = PLACES;

async function openBuilder(page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "60초 코스 만들기" }).click();
  await page.locator(`[data-place-id="${firstPlace.id}"]`).first().click();
  await page.getByRole("button", { name: "이 장소 주변 둘러보기" }).click();
}

test("visitor builds a course from the photo feed", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.locator('[data-screen="welcome"]')).toBeVisible();

  await page.getByRole("button", { name: "60초 코스 만들기" }).click();
  await expect(page.locator('[data-screen="feed"]')).toBeVisible();
  expect(await page.locator('[data-place-id]').count()).toBeGreaterThanOrEqual(PLACES.length);

  await page.locator(`[data-place-id="${firstPlace.id}"]`).first().click();
  await expect(page.getByRole("heading", { name: firstPlace.name })).toBeVisible();
  await page.getByRole("button", { name: "이 장소 주변 둘러보기" }).click();

  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await expect(page.locator(".floating-action")).toHaveCount(0);
  await page.locator(`[data-place-id="${secondPlace.id}"]`).first().click();
  await expect(page.locator(".floating-action")).toBeVisible();
  await page.waitForTimeout(400);
  const actionBox = await page.locator(".floating-action").boundingBox();
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(1180);
  await page.getByRole("button", { name: /코스 완성하기/ }).click();

  await expect(page.getByRole("heading", { name: "우리의 코스 완성!" })).toBeVisible();
  await expect(page.locator(".completion-place")).toHaveCount(2);
});

test("builder selection toggles without duplicates", async ({ page }) => {
  await openBuilder(page);
  await expect(page.locator(`[data-place-id="${firstPlace.id}"]`)).toHaveCount(0);

  const candidate = page.locator(`[data-place-id="${secondPlace.id}"]`).first();
  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-pressed", "true");
  await expect(candidate).toHaveClass(/is-selected/);
  await expect(candidate.locator(".place-tile__check")).toBeVisible();
  await expect(page.getByRole("button", { name: /1곳으로 코스 완성하기/ })).toBeVisible();

  await candidate.click();
  await expect(candidate).toHaveAttribute("aria-pressed", "false");
  await expect(candidate).not.toHaveClass(/is-selected/);
  await expect(page.locator(".floating-action")).toHaveCount(0);
});

test("photo feed continues with a shuffled copy of every place", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "60초 코스 만들기" }).click();

  const tiles = page.locator("[data-feed-list] [data-place-id]");
  await expect(page.locator('[data-screen="feed"]')).toBeVisible();
  await page.locator("[data-feed-sentinel]").evaluate((sentinel) => {
    sentinel.scrollIntoView({ block: "end" });
  });
  await expect.poll(() => tiles.count()).toBeGreaterThanOrEqual(PLACES.length * 2);

  const secondBatch = await tiles.evaluateAll((items, placeCount) => (
    items.slice(placeCount, placeCount * 2).map((item) => item.dataset.placeId)
  ), PLACES.length);
  const originalOrder = PLACES.map((place) => place.id);
  expect(new Set(secondBatch)).toEqual(new Set(originalOrder));
  expect(secondBatch).not.toEqual(originalOrder);
});

test("inactivity resets the demo", async ({ page }) => {
  await page.clock.install();
  await page.goto("/demo");
  await page.getByRole("button", { name: "60초 코스 만들기" }).click();
  await expect(page.locator('[data-screen="feed"]')).toBeVisible();

  await page.clock.fastForward(60_001);
  await expect(page.locator('[data-screen="welcome"]')).toBeVisible();
});

test("primary touch controls are at least 52 pixels", async ({ page }) => {
  await page.goto("/demo");
  const startButton = page.getByRole("button", { name: "60초 코스 만들기" });
  let box = await startButton.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(52);

  await startButton.click();
  box = await page.locator(`[data-place-id="${firstPlace.id}"]`).first().boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(52);
  expect(box.height).toBeGreaterThanOrEqual(52);
});
