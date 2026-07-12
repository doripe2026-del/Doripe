import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

test("all MY screens are semantic and the settings hub has no dead-end rows", async ({ page }) => {
  await page.goto("/app-preview/?screen=e1");
  for (const screenId of ["e1", "e2", "e3", "e4", "e5"]) {
    await page.goto(`/app-preview/?screen=${screenId}`);
    await expect(page.locator(`[data-screen-id="${screenId}"]`)).toHaveAttribute("data-render-mode", "semantic");
  }

  await page.goto("/app-preview/?screen=e1");
  await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
  for (const [name, target] of [["계정", "e3"], ["알림", "e4"], ["문의", "e5"]]) {
    await page.goto("/app-preview/?screen=e1");
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`screen=${target}`));
  }
});

test("profile edits and tabs persist before returning to MY", async ({ page }) => {
  await page.goto("/app-preview/?screen=e2");
  await page.getByLabel("닉네임").fill("도리테스터");
  await page.getByLabel("소개").fill("연남의 좋은 장소를 모아요");
  await page.getByRole("tab", { name: "코스" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("연남 저녁 데이트");
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page).toHaveURL(/screen=e1/);

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.form).toMatchObject({ nickname: "도리테스터", bio: "연남의 좋은 장소를 모아요" });
});

test("account validation, notification master toggle, and contact submission work", async ({ page }) => {
  await page.goto("/app-preview/?screen=e3");
  await page.getByLabel("현재 비밀번호").fill("Doripe123");
  await page.getByLabel("새 비밀번호", { exact: true }).fill("Newpass123");
  await page.getByLabel("새 비밀번호 확인").fill("mismatch123");
  await page.getByRole("button", { name: "비밀번호 저장" }).click();
  await expect(page.getByRole("status")).toContainText("일치하지 않아요");
  await page.getByLabel("현재 비밀번호").fill("Wrong123");
  await page.getByLabel("새 비밀번호 확인").fill("Newpass123");
  await page.getByRole("button", { name: "비밀번호 저장" }).click();
  await expect(page.getByRole("status")).toContainText("현재 비밀번호가 올바르지 않아요");
  await page.getByLabel("현재 비밀번호").fill("Doripe123");
  await page.getByRole("button", { name: "비밀번호 저장" }).click();
  await expect(page.getByRole("status")).toContainText("변경했어요");

  await page.goto("/app-preview/?screen=e4");
  const master = page.getByRole("switch", { name: "전체 알림" });
  const switches = page.getByRole("switch");
  await expect(switches.nth(0)).not.toBeChecked();
  for (const index of [1, 2]) await expect(switches.nth(index)).toBeChecked();
  for (const index of [3, 4]) await expect(switches.nth(index)).not.toBeChecked();
  await master.click();
  for (const toggle of await page.getByRole("switch").all()) await expect(toggle).toBeChecked();
  await master.click();
  for (const toggle of await page.getByRole("switch").all()) await expect(toggle).not.toBeChecked();

  await page.goto("/app-preview/?screen=e5");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByRole("status")).toContainText("문의 내용을 입력");
  await page.getByLabel("문의 내용").fill("저장한 장소가 보이지 않아요.");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByRole("status")).toContainText("문의가 접수");
});
