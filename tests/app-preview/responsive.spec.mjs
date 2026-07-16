import { expect, test } from "@playwright/test";

const COMPACT_VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 360, height: 800 }
];

const REQUIRED_MOBILE_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 393, height: 852 }
];

const NAV_VIEWPORTS = [
  { width: 393, height: 852 },
  ...COMPACT_VIEWPORTS
];

async function gotoScreen(page, screenId, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`/app-preview/?screen=${screenId}&static=1`);
  return page.locator(`[data-screen-id="${screenId}"]`);
}

async function seedSavedPlaces(page) {
  await page.addInitScript(() => localStorage.setItem("doripe_app_preview_v1", JSON.stringify({
    savedPlaceIds: ["place-1", "place-2", "place-3", "place-4", "place-5"]
  })));
}

async function expectVisibleInViewport(page, locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectMinimumTouchTarget(locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function expectWithinViewportWidth(page, locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
}

async function expectBoxesNotToOverlap(first, second) {
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  const separated = firstBox.x + firstBox.width <= secondBox.x
    || secondBox.x + secondBox.width <= firstBox.x
    || firstBox.y + firstBox.height <= secondBox.y
    || secondBox.y + secondBox.height <= firstBox.y;
  expect(separated).toBe(true);
}

async function expectStableBox(locator) {
  await expect.poll(async () => {
    const first = await locator.boundingBox();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await locator.boundingBox();
    return Math.abs(first.x - second.x)
      + Math.abs(first.y - second.y)
      + Math.abs(first.width - second.width)
      + Math.abs(first.height - second.height);
  }).toBeLessThan(0.5);
}

for (const viewport of REQUIRED_MOBILE_VIEWPORTS) {
  test(`B1 and B2 keep feed cards and header controls intact at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    for (const screenId of ["b1", "b2"]) {
      const screen = await gotoScreen(page, screenId, viewport);
      const screenBox = await screen.boundingBox();
      const tiles = screen.locator("[data-testid=media-tile]");
      for (const tile of await tiles.all()) {
        const tileBox = await tile.boundingBox();
        expect(tileBox.x, `${screenId} tile left edge`).toBeGreaterThanOrEqual(screenBox.x);
        expect(tileBox.x + tileBox.width, `${screenId} tile right edge`).toBeLessThanOrEqual(screenBox.x + screenBox.width + 1);
      }

      const tabs = screen.locator(".discover-tabs");
      const filter = screen.getByRole("button", { name: /필터/ });
      await expectBoxesNotToOverlap(tabs, filter);
      for (const tab of await tabs.getByRole("button").all()) await expectMinimumTouchTarget(tab);
      await expectMinimumTouchTarget(filter);
      await expectVisibleInViewport(page, screen.getByRole("navigation", { name: "주요 메뉴" }));

      if (screenId === "b1") {
        for (const profile of await screen.locator(".discover-following-strip__profile").all()) {
          await expectMinimumTouchTarget(profile);
        }
      }
    }
  });

  test(`B4 bottom sheet stays usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const screen = await gotoScreen(page, "b4", viewport);
    const sheet = screen.locator("[data-testid=place-sheet]");
    const handle = sheet.getByRole("button", { name: "장소 상세 닫기" });
    await expectWithinViewportWidth(page, sheet);
    await expectMinimumTouchTarget(screen.getByRole("button", { name: "피드로 돌아가기" }));
    await expectMinimumTouchTarget(screen.locator(".discover-detail-social__profile"));
    await expectMinimumTouchTarget(handle);

    const initialSheetBox = await sheet.boundingBox();
    expect(initialSheetBox.y + initialSheetBox.height).toBeLessThanOrEqual(viewport.height + 1);

    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 180, { steps: 8 });
    await page.mouse.up();
    await expect(sheet).toHaveAttribute("data-sheet-state", "expanded");
    await expectStableBox(sheet);
    await expect.poll(async () => {
      const box = await sheet.boundingBox();
      return box.y + box.height;
    }).toBeLessThanOrEqual(viewport.height + 1);

    const infoRows = await sheet.locator(".discover-info-row").all();
    for (const row of infoRows) await expectMinimumTouchTarget(row);
    for (let index = 1; index < infoRows.length; index += 1) {
      await expectBoxesNotToOverlap(infoRows[index - 1], infoRows[index]);
    }
    const placeActions = sheet.locator(".discover-place-actions");
    await expectBoxesNotToOverlap(infoRows.at(-1), placeActions);
    for (const action of await placeActions.getByRole("button").all()) await expectMinimumTouchTarget(action);

    await sheet.hover();
    await page.mouse.wheel(0, 2_000);
    await expect.poll(() => sheet.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test(`C1 saved sheet remains reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await seedSavedPlaces(page);
    const screen = await gotoScreen(page, "c1", viewport);
    const sheet = screen.locator(".saved-sheet--places");
    const list = screen.locator(".saved-place-list");
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    await expectWithinViewportWidth(page, sheet);
    await expectWithinViewportWidth(page, screen.locator(".saved-place-row").first());
    await expectVisibleInViewport(page, nav);
    const recommendationsBox = await screen.locator(".saved-recommendations").boundingBox();
    const initialNavBox = await nav.boundingBox();
    expect(recommendationsBox.y + recommendationsBox.height).toBeLessThanOrEqual(initialNavBox.y);
    if (viewport.height <= 600) {
      const sheetBox = await sheet.boundingBox();
      expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(initialNavBox.y + 1);
    }

    const filters = screen.locator(".saved-filter-row");
    const lastFilter = filters.getByRole("button").last();
    await filters.hover();
    if (await filters.evaluate((element) => element.scrollWidth > element.clientWidth)) {
      await page.mouse.wheel(1_000, 0);
      await expect.poll(() => filters.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    }
    await expectVisibleInViewport(page, lastFilter);
    await expectMinimumTouchTarget(lastFilter);

    const lastSavedItem = screen.locator(".saved-place-row").last();
    const scrollTarget = viewport.height <= 600 ? sheet : list;
    await expect.poll(() => scrollTarget.evaluate((element) => getComputedStyle(element).overflowY)).toMatch(/auto|scroll/);
    await scrollTarget.hover();
    await page.mouse.wheel(0, 2_000);
    await expect.poll(() => scrollTarget.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const lastBox = await lastSavedItem.boundingBox();
    const navBox = await nav.boundingBox();
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(navBox.y);
  });

  test(`D9 keeps controls, text, and navigation separated at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const screen = await gotoScreen(page, "d9", viewport);
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    await expectVisibleInViewport(page, nav);
    for (const control of [
      screen.getByRole("button", { name: "뒤로 가기" }),
      screen.getByRole("button", { name: "코스 공유" }),
      screen.getByRole("button", { name: "길찾기 시작" }),
      screen.getByRole("button", { name: "공유하기" }),
      screen.getByRole("button", { name: "추천 장소 더보기" })
    ]) await expectMinimumTouchTarget(control);

    const title = screen.locator(".route-complete-title");
    const meta = screen.locator(".route-complete-meta");
    await expectBoxesNotToOverlap(title, meta);

    const content = screen.locator(".route-complete-scroll");
    const nearby = screen.locator(".route-nearby-card");
    await content.hover();
    await page.mouse.wheel(0, 2_000);
    await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const nearbyBox = await nearby.boundingBox();
    const navBox = await nav.boundingBox();
    expect(nearbyBox.y + nearbyBox.height).toBeLessThanOrEqual(navBox.y);
  });
}

for (const viewport of NAV_VIEWPORTS) {
  for (const [screenId, selectedIndex, contentSelector] of [
    ["b2", 0, ".discover-feed"],
    ["c1", 1, ".saved-place-list"],
    ["c2", 1, ".saved-route-list"],
    ["d3", 2, ".route-start-grid"],
    ["e1", 3, ".settings-rows"]
  ]) {
    test(`${screenId} bottom navigation is anchored and selected at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("doripe_app_preview_v1", JSON.stringify({
        savedPlaceIds: ["place-1", "place-2", "place-3"],
        savedRoutes: [{ id: "saved-route-nav", name: "탭 테스트 코스", placeIds: ["place-1", "place-2"] }]
      })));
      const screen = await gotoScreen(page, screenId, viewport);
      const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
      const navBox = await nav.boundingBox();
      const screenBox = await screen.boundingBox();
      expect(navBox.x).toBeGreaterThanOrEqual(screenBox.x);
      expect(navBox.x + navBox.width).toBeLessThanOrEqual(screenBox.x + screenBox.width);
      expect(navBox.y + navBox.height).toBeLessThanOrEqual(screenBox.y + screenBox.height);
      expect(navBox.y).toBeGreaterThanOrEqual(screenBox.y + screenBox.height - 90);

      const items = nav.getByRole("button");
      await expect(items.nth(selectedIndex)).toHaveAttribute("aria-current", "page");
      const selectedBox = await items.nth(selectedIndex).boundingBox();
      expect(selectedBox.width).toBeGreaterThanOrEqual(44);
      expect(selectedBox.height).toBeGreaterThanOrEqual(44);
      const background = await items.nth(selectedIndex).evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(background).not.toBe("rgba(0, 0, 0, 0)");

      if (contentSelector) {
        const contentBox = await screen.locator(contentSelector).boundingBox();
        expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(navBox.y + 1);
      }
    });
  }
}

test("course completion scrolls its content without moving the shared navigation", async ({ page }) => {
  const viewport = { width: 375, height: 667 };
  const screen = await gotoScreen(page, "d9", viewport);
  const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
  const before = await nav.boundingBox();
  const content = screen.locator(".route-complete-scroll");

  await content.hover();
  await page.mouse.wheel(0, 2_000);
  await expect.poll(() => content.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await nav.boundingBox()).toEqual(before);
});

for (const viewport of NAV_VIEWPORTS) {
  test(`switching every primary tab keeps one stable navigation frame at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const screen = await gotoScreen(page, "b2", viewport);
    const initialNav = await screen.getByRole("navigation", { name: "주요 메뉴" }).boundingBox();
    for (const [label, destination] of [["저장", "c1"], ["코스", "d3"], ["MY", "e1"], ["발견", "b2"]]) {
      await page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`screen=${destination}`));
      const nav = page.getByRole("navigation", { name: "주요 메뉴" });
      const box = await nav.boundingBox();
      expect(box).toEqual(initialNav);
      const selected = nav.locator('[aria-current="page"]');
      await expect(selected).toHaveCount(1);
      const selectedBox = await selected.boundingBox();
      expect(selectedBox.width).toBe(44);
      expect(selectedBox.height).toBe(44);
    }
  });
}

for (const viewport of [{ width: 393, height: 852 }, { width: 375, height: 667 }]) {
  test(`every selected navigation bubble stays inside the phone at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const screen = await gotoScreen(page, "b2", viewport);
    const items = screen.getByRole("navigation", { name: "주요 메뉴" }).getByRole("button");
    for (let selectedIndex = 0; selectedIndex < 4; selectedIndex += 1) {
      await items.evaluateAll((buttons, activeIndex) => buttons.forEach((button, index) => {
        button.classList.toggle("preview-bottom-nav__item--selected", index === activeIndex);
        button.setAttribute("aria-current", index === activeIndex ? "page" : "false");
      }), selectedIndex);
      const phoneBox = await page.locator("#phone-root").boundingBox();
      const selected = items.nth(selectedIndex);
      const selectedBox = await selected.boundingBox();

      expect(selectedBox.x, `selected index ${selectedIndex}`).toBeGreaterThanOrEqual(phoneBox.x);
      expect(selectedBox.y, `selected index ${selectedIndex}`).toBeGreaterThanOrEqual(phoneBox.y);
      expect(selectedBox.x + selectedBox.width, `selected index ${selectedIndex}`).toBeLessThanOrEqual(phoneBox.x + phoneBox.width);
      expect(selectedBox.y + selectedBox.height, `selected index ${selectedIndex}`).toBeLessThanOrEqual(phoneBox.y + phoneBox.height);
    }
  });
}

for (const viewport of COMPACT_VIEWPORTS) {
  test(`C1 keeps its saved-place sheet inside ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await seedSavedPlaces(page);
    const c1 = await gotoScreen(page, "c1", viewport);
    const sheet = c1.locator(".saved-sheet--places");
    await expectWithinViewportWidth(page, sheet);
    await expectWithinViewportWidth(page, c1.locator(".saved-place-row").first());
  });

  test(`E3 bottom content is reachable by wheel scrolling at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const e3 = await gotoScreen(page, "e3", viewport);
    const deleteAccount = e3.getByRole("button", { name: "회원 탈퇴" });
    await e3.hover({ position: { x: viewport.width / 2, y: viewport.height / 2 } });
    await page.mouse.wheel(0, 2_000);
    await expect.poll(() => e3.evaluate((screen) => screen.scrollTop)).toBeGreaterThan(0);
    await expectVisibleInViewport(page, deleteAccount);
  });

  test(`C7 and E2 representative controls have 44px hit boxes at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const c7 = await gotoScreen(page, "c7", viewport);
    await expectMinimumTouchTarget(c7.getByRole("button", { name: "음식점 필터" }));
    await expectMinimumTouchTarget(c7.locator(".saved-candidate__like").first());
    await expectMinimumTouchTarget(c7.locator(".saved-candidate__replace").first());
    await expectMinimumTouchTarget(c7.locator(".saved-candidate__selected"));
    await expectMinimumTouchTarget(c7.getByRole("button", { name: "선택한 장소로 교체" }));

    const e2 = await gotoScreen(page, "e2", viewport);
    await expectMinimumTouchTarget(e2.getByRole("button", { name: "뒤로 가기" }));
    await expectMinimumTouchTarget(e2.getByRole("button", { name: "사진 편집" }));
    await expectMinimumTouchTarget(e2.getByRole("tab", { name: "장소" }));
    await expectMinimumTouchTarget(e2.getByRole("tab", { name: "코스" }));
    await expectMinimumTouchTarget(e2.getByRole("button", { name: "저장하기" }));
  });
}

test("C1 wheel-scrolls to the last saved item at 375x667", async ({ page }) => {
  const viewport = { width: 375, height: 667 };
  await seedSavedPlaces(page);
  const c1 = await gotoScreen(page, "c1", viewport);
  const savedList = c1.locator(".saved-place-list");
  const lastSavedItem = c1.locator(".saved-place-row").last();
  const before = await lastSavedItem.boundingBox();
  expect(before.y + before.height).toBeGreaterThan(viewport.height);

  await savedList.hover();
  await page.mouse.wheel(0, 2_000);

  await expect.poll(() => savedList.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
  await expectVisibleInViewport(page, lastSavedItem);
});

test("the C7 filter strip wheel-scrolls to and activates its last item", async ({ page }) => {
  const c7 = await gotoScreen(page, "c7", { width: 375, height: 667 });
  const filters = c7.locator(".saved-replace-filters");
  const lastFilter = filters.getByRole("button").last();
  expect(await filters.evaluate((element) => element.scrollWidth)).toBeGreaterThan(await filters.evaluate((element) => element.clientWidth));
  await filters.hover();
  await page.mouse.wheel(1_000, 0);
  await expect.poll(() => filters.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expectVisibleInViewport(page, lastFilter);
  await lastFilter.click();
  await expect(lastFilter).toHaveAttribute("aria-pressed", "true");
});

test("B3 reveals genuinely new media after wheel scrolling", async ({ page }) => {
  const b3 = await gotoScreen(page, "b3", { width: 393, height: 852 });
  const feed = b3.locator("[data-testid=discover-feed]");
  const visibleMediaIds = () => feed.locator("[data-testid=media-tile]").evaluateAll((items) => {
    const feedRect = items[0]?.parentElement?.getBoundingClientRect();
    if (!feedRect) return [];
    return items
      .filter((item) => {
        const itemRect = item.getBoundingClientRect();
        return itemRect.bottom > feedRect.top && itemRect.top < feedRect.bottom;
      })
      .map((item) => item.dataset.mediaId)
      .filter(Boolean);
  });
  const initiallyVisibleIds = await visibleMediaIds();
  expect(initiallyVisibleIds.length).toBeGreaterThan(0);

  await feed.hover();
  await page.mouse.wheel(0, 2_000);

  await expect.poll(() => feed.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(async () => {
    const revealedIds = await visibleMediaIds();
    return revealedIds.some((id) => !initiallyVisibleIds.includes(id));
  }).toBe(true);
});
