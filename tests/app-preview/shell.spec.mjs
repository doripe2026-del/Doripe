import { expect, test } from "@playwright/test";

test("desktop shell keeps page fixed and review list scrollable", async ({ page }) => {
  await page.goto("/app-preview/");
  await expect(page.locator("#phone-root")).toHaveCSS("width", "393px");
  await expect(page.locator("#phone-root")).toHaveCSS("height", "852px");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(page.locator("#review-list")).toHaveCSS("overflow-y", "auto");
});

test("mobile hides review controls", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/app-preview/");
  await expect(page.locator("#review-panel")).toBeHidden();
  await expect(page.locator("#phone-root")).toHaveCSS("width", "393px");
});

test("direct screen URLs render evidence mode", async ({ page }) => {
  await page.goto("/app-preview/?screen=a1");

  await expect(page.locator("#phone-root")).toHaveAttribute("data-preview-mode", "evidence");
  await expect(page.locator("#phone-root [data-screen-id='a1']")).toHaveAttribute("data-figma-node", "446:34");
});

test("unknown screen URLs show a review-only error without replacing the ID", async ({ page }) => {
  await page.goto("/app-preview/?screen=does-not-exist");

  await expect(page.locator("#phone-root")).toHaveAttribute("data-preview-mode", "review-error");
  await expect(page.getByText("does-not-exist")).toBeVisible();
  await expect(page.getByRole("button", { name: "첫 화면으로 돌아가기" })).toBeVisible();
  await expect(page).toHaveURL(/screen=does-not-exist/);
});

test("only a review status control can mark a screen complete", async ({ page }) => {
  await page.goto("/app-preview/?screen=a1");
  const firstScreen = page.locator("[data-review-screen-id='a1']");

  await firstScreen.getByRole("button", { name: "미검토" }).click();
  await expect(firstScreen.getByRole("button", { name: "완료" })).toBeVisible();

  await page.getByRole("button", { name: "A3 / 로그인" }).click();
  await expect(page).toHaveURL(/screen=a3/);
  await expect(page.locator("[data-review-screen-id='a3']").getByRole("button", { name: "미검토" })).toBeVisible();
});

async function addActionControl(page, { action, id, type = "button" }) {
  await page.locator(".evidence-screen").evaluate((screen, options) => {
    const control = document.createElement(options.type);
    control.dataset.action = options.action;
    if (options.id) control.dataset.id = options.id;
    control.textContent = options.action;
    screen.append(control);
  }, { action, id, type });
}

test("place detail survives reload and closes to its exact opener", async ({ page }) => {
  await page.goto("/app-preview/?screen=b1");
  await addActionControl(page, { action: "open-place", id: "place-1" });
  await page.getByRole("button", { name: "open-place" }).click();
  await expect(page).toHaveURL(/screen=b4/);

  await page.reload();
  const opened = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(opened.currentScreenId).toBe("b4");
  expect(opened.history).toEqual(["b1"]);
  expect(opened.selections.selectedPlaceId).toBe("place-1");

  await addActionControl(page, { action: "close-place" });
  await page.getByRole("button", { name: "close-place" }).click();
  await expect(page).toHaveURL(/screen=b1/);
  await page.reload();
  const closed = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(closed.currentScreenId).toBe("b1");
  expect(closed.history).toEqual([]);
});

test("profile media survives reload and closes to its exact opener", async ({ page }) => {
  await page.goto("/app-preview/?screen=e1");
  await addActionControl(page, { action: "open-media", id: "media-4" });
  await page.getByRole("button", { name: "open-media" }).click();
  await expect(page).toHaveURL(/screen=b7/);

  await page.reload();
  const opened = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(opened.currentScreenId).toBe("b7");
  expect(opened.history).toEqual(["e1"]);
  expect(opened.selections.selectedMediaId).toBe("media-4");

  await addActionControl(page, { action: "close-photo" });
  await page.getByRole("button", { name: "close-photo" }).click();
  await expect(page).toHaveURL(/screen=e1/);
  await page.reload();
  const closed = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(closed.currentScreenId).toBe("e1");
  expect(closed.history).toEqual([]);
});
