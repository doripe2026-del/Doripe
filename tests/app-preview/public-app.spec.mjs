import { expect, test } from "@playwright/test";

test("the public app route serves the current app without review controls", async ({ page }) => {
  await page.goto("/app?screen=b1&static=1");

  await expect(page.locator('[data-screen-id="b1"]')).toBeVisible();
  await expect(page.locator("#review-panel")).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-app-surface", "product");
  expect(new URL(page.url()).pathname).toBe("/app");
});

test("public app sharing keeps the canonical public path", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => window.sessionStorage.setItem("copied-link", value) }
    });
  });
  await page.goto("/app?screen=b4&type=place&id=place-1&static=1");

  await page.getByRole("button", { name: "공유하기" }).click();
  const copied = await page.evaluate(() => window.sessionStorage.getItem("copied-link"));

  expect(new URL(copied).pathname).toBe("/app");
  expect(new URL(copied).searchParams.get("screen")).toBe("b4");
  expect(new URL(copied).searchParams.get("type")).toBe("place");
  expect(new URL(copied).searchParams.get("id")).toBe("place-1");
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
