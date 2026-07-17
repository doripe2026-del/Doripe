import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("visitor can complete the booth flow without viewport overflow", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/booth-demo/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-screen="welcome"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-screen="feed"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollBy(0, 800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.locator(".place-tile").first().click();
  await expect(page.locator('[data-screen="detail"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.locator('[data-action="browse-nearby"]').click();
  await expect(page.locator('[data-screen="builder"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.locator(".builder .place-tile").first().click();
  await expect(page.locator('[data-action="complete"]')).toBeVisible();
  await page.locator('[data-action="complete"]').click();
  await expect(page.locator('[data-screen="complete"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.locator('[data-action="reset"]').click();
  await expect(page.locator('[data-screen="welcome"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('[data-screen="welcome"]')).toHaveJSProperty("offsetTop", 0);
  expect(pageErrors).toEqual([]);
});
