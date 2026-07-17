import { expect, test } from "@playwright/test";
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };

const VIEWPORTS = [
  { width: 393, height: 852 },
  { width: 360, height: 780 }
];

for (const viewport of VIEWPORTS) {
  test(`all ${inventory.length} MVP screens are semantic and fit ${viewport.width}px`, async ({ page }) => {
    test.slow();
    await page.setViewportSize(viewport);
    for (const screenRecord of inventory) {
      await page.goto(`/app-preview/?screen=${screenRecord.id}&static=1`);
      const screen = page.locator(`[data-screen-id="${screenRecord.id}"]`);
      await expect(screen, `${screenRecord.id} renders`).toHaveCount(1);
      await expect(screen, `${screenRecord.id} is implemented`).toHaveAttribute("data-render-mode", "semantic");
      await expect(screen.locator(".evidence-screen"), `${screenRecord.id} has no screenshot fallback`).toHaveCount(0);
      const geometry = await screen.evaluate((element) => ({
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
        viewport: document.documentElement.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      expect(geometry.left, `${screenRecord.id} left edge`).toBeGreaterThanOrEqual(0);
      expect(geometry.right, `${screenRecord.id} right edge`).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.pageOverflow, `${screenRecord.id} page overflow`).toBeLessThanOrEqual(1);
    }
  });
}

test.use({ viewport: { width: 393, height: 852 } });

test("D1 photo menu hides a selected item and persists the choice", async ({ page }) => {
  await page.goto("/app-preview/?screen=d1&static=1");
  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const current = JSON.parse(localStorage.getItem(key)) || {};
    localStorage.setItem(key, JSON.stringify({
      ...current,
      savedPlaceIds: Array.from({ length: 10 }, (_, index) => `place-${index + 1}`)
    }));
  });
  await page.reload();
  const cards = page.locator(".route-start-media");
  const initialCount = await cards.count();
  await cards.first().getByRole("button", { name: /사진 메뉴/ }).click();
  await page.getByRole("button", { name: "이 사진 숨기기" }).click();
  await expect(cards).toHaveCount(initialCount - 1);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(persisted.hiddenMediaIds).toHaveLength(1);
});
