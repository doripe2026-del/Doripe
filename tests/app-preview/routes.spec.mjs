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
    const scale = viewport.width < 393 ? viewport.width / 393 : 1;
    expect(geometry.width).toBeCloseTo(393 * scale, 1);
    expect(geometry.height).toBeCloseTo(852 * scale, 1);
    expect(geometry.scrollWidth).toBe(393);
  }
});

test("D7 stays within two percent of the current Figma frame", async ({ page }) => {
  const screen = await gotoRouteConfirmation(page, ["place-1", "place-7", "place-8"]);
  expect(await visualDiffRatio(page, screen)).toBeLessThanOrEqual(0.02);
});

test("the complete course flow works from the draggable start sheet to a saved course", async ({ page }) => {
  await page.goto("/app-preview/?screen=d1");
  await expect(page.locator('[data-screen-id="d1"]')).toHaveAttribute("data-render-mode", "semantic");
  await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();

  const handle = page.locator(".route-start-handle");
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 140, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/screen=d2/);

  await page.getByRole("button", { name: "여기서 시작하기" }).click();
  await expect(page).toHaveURL(/screen=d4/);
  await page.getByRole("button", { name: "여기서 시작하기" }).click();
  await expect(page).toHaveURL(/screen=d5/);

  await page.getByRole("button", { name: /포털로빈.*추가/ }).click();
  await page.getByRole("button", { name: /소이연남.*추가/ }).click();
  await expect(page.getByText("2곳 선택됨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "선택한 장소로 코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d7/);
  await page.getByRole("button", { name: "코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d8/);

  const routeName = page.getByRole("textbox", { name: "코스 이름" });
  await routeName.fill("연남 저녁 산책 코스");
  await page.getByRole("button", { name: "코스 저장하기" }).click();
  await expect(page).toHaveURL(/screen=d9/);
  await expect(page.getByRole("heading", { name: "연남 저녁 산책 코스" })).toBeVisible();
});

test("course candidate cards toggle, filters persist, and Discover candidates share the selection", async ({ page }) => {
  await page.goto("/app-preview/?screen=d5");
  const firstBefore = await page.locator(".route-saved-candidate h3").first().textContent();
  await page.getByRole("button", { name: "오후 필터" }).click();
  await expect(page.getByRole("button", { name: "오후 필터" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".route-saved-candidate h3").first()).toHaveText("브런치가든 연남");
  expect(firstBefore).not.toBe("브런치가든 연남");

  const add = page.getByRole("button", { name: /포털로빈/ });
  await add.click();
  await expect(add).toHaveAttribute("aria-pressed", "true");
  await add.click();
  await expect(add).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("tab", { name: "발견하기" }).click();
  await expect(page).toHaveURL(/screen=d6/);
  await expect(page.locator('[data-screen-id="d6"]')).toHaveAttribute("data-render-mode", "semantic");
});

test("course start, nearby recommendation, and sheet keyboard controls keep valid state", async ({ page }) => {
  await page.goto("/app-preview/?screen=d1");
  await page.locator(".route-start-handle").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/screen=d2/);

  await page.goto("/app-preview/?screen=d4");
  await page.getByRole("button", { name: "선택 장소 닫기" }).click();
  await expect(page.getByRole("button", { name: "여기서 시작하기" })).toBeDisabled();

  await page.goto("/app-preview/?screen=d9");
  await page.getByRole("button", { name: "연남방앗간 장소 보기" }).click();
  await expect(page).toHaveURL(/screen=b10/);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.selections.selectedPlaceId).toBe("place-9");
});

test("D9 nearby recommendation matches the Figma position and width", async ({ page }) => {
  await page.goto("/app-preview/?screen=d9&static=1");
  const geometry = await page.locator(".route-nearby").evaluate((section) => {
    const sectionBox = section.getBoundingClientRect();
    const cardBox = section.querySelector(".route-nearby-card").getBoundingClientRect();
    return {
      section: { x: sectionBox.x, y: sectionBox.y, width: sectionBox.width, height: sectionBox.height },
      card: { x: cardBox.x, y: cardBox.y, width: cardBox.width, height: cardBox.height }
    };
  });
  expect(geometry).toEqual({
    section: { x: 24, y: 699, width: 345, height: 89 },
    card: { x: 24, y: 722, width: 345, height: 66 }
  });
});
