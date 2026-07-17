import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";
const LOCAL_REVIEW_ORIGIN = `http://localhost:${process.env.APP_PREVIEW_PORT || 4173}`;

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto(reviewRouteUrl());
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

function reviewRouteUrl(screenId) {
  const url = new URL("/app-preview/", LOCAL_REVIEW_ORIGIN);
  if (screenId) url.searchParams.set("screen", screenId);
  url.searchParams.set("static", "1");
  return url.toString();
}

async function mountFixtureRoute(page, screenId, state = {}) {
  await page.goto(reviewRouteUrl(screenId));
  await page.evaluate(async ({ id, suppliedState }) => {
    const [{ createFixtureRepository }, { ROUTE_RENDERERS }] = await Promise.all([
      import("/app-preview/data/fixture-repository.js"),
      import("/app-preview/screens/routes.js")
    ]);
    const data = await createFixtureRepository().getBootstrap();
    const defaults = {
      savedPlaceIds: ["place-1", "place-2", "place-10"],
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-7", "place-8"] },
      routePlaceIds: ["place-1", "place-7", "place-8"],
      selections: { selectedPlaceId: "place-2", selectedRouteId: "route-1" }
    };
    const routeState = {
      ...defaults,
      ...suppliedState,
      selections: { ...defaults.selections, ...(suppliedState.selections || {}) }
    };
    document.body.style.margin = "0";
    document.body.replaceChildren(ROUTE_RENDERERS[id](routeState, data));
  }, { id: screenId, suppliedState: state });
}

async function gotoFixtureRouteComplete(page) {
  await page.goto(reviewRouteUrl("d9"));
  await page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key)) || {};
    localStorage.setItem(key, JSON.stringify({
      ...current,
      selections: { ...(current.selections || {}), selectedRouteId: "route-1" }
    }));
  }, STORAGE_KEY);
  await page.reload();
}

test("course renderers use supplied place and course IDs", async ({ page }) => {
  const rendered = await page.evaluate(async () => {
    const { normalizeDataSnapshot } = await import("/app-preview/data/contracts.js");
    const { ROUTE_RENDERERS } = await import("/app-preview/screens/routes.js");
    const data = normalizeDataSnapshot({
      places: [
        {
          id: "route-place-custom", name: "주입 코스 장소", userId: "route-profile-custom",
          mediaIds: ["route-media-custom"], tagIds: ["route-tag-custom"],
          address: "서울 코스로 1", walkingMinutes: 5, summary: "주입 후보 설명",
          longitude: 126.9, latitude: 37.5
        },
        {
          id: "route-nearby-custom", name: "주입 근처 장소", userId: "route-profile-custom",
          mediaIds: [], tagIds: ["route-tag-custom"], address: "서울 코스로 2", walkingMinutes: 2
        },
        {
          id: "route-name-trap", name: "연남방앗간", userId: "route-profile-custom",
          mediaIds: [], tagIds: ["route-tag-custom"], address: "서울 코스로 3", walkingMinutes: 4
        }
      ],
      media: [{
        id: "route-media-custom", placeId: "route-place-custom", userId: "route-profile-custom",
        src: "/app-preview/assets/discover/feed-2.png", alt: "주입 코스 사진", kind: "image"
      }],
      profiles: [{
        id: "route-profile-custom", name: "주입 코스 사용자", handle: "주입코스사용자",
        avatarUrl: "/app-preview/assets/discover/avatar-2.png"
      }],
      tags: [{ id: "route-tag-custom", name: "주입 코스 태그", group: "mood" }],
      courses: [{
        id: "route-course-custom", name: "주입 완성 코스", userId: "route-profile-custom",
        placeIds: ["route-place-custom"], tagIds: ["route-tag-custom"], walkingMinutes: 9
      }]
    });
    const state = {
      savedPlaceIds: ["route-place-custom"],
      routeDraft: { startPlaceId: "route-place-custom", placeIds: ["route-place-custom"] },
      routePlaceIds: ["route-place-custom"],
      selections: { selectedPlaceId: "route-nearby-custom", selectedRouteId: "route-course-custom" }
    };
    const start = ROUTE_RENDERERS.d1(state, data);
    const complete = ROUTE_RENDERERS.d9(state, data);
    return {
      startPlaceId: start.querySelector("[data-place-id]")?.dataset.placeId,
      startAlt: start.querySelector(".route-start-media img")?.alt,
      savedCandidates: ROUTE_RENDERERS.d5(state, data).textContent,
      discoverCandidates: ROUTE_RENDERERS.d6(state, data).textContent,
      confirmation: ROUTE_RENDERERS.d7(state, data).textContent,
      complete: complete.textContent,
      nearbyPlaceId: complete.querySelector(".route-nearby-card")?.dataset.placeId,
      directStartCardCount: ROUTE_RENDERERS.d1({ savedPlaceIds: [], selections: {} }, data)
        .querySelectorAll(".route-start-media").length,
      directStartText: ROUTE_RENDERERS.d1({ savedPlaceIds: [], selections: {} }, data).textContent
    };
  });

  expect(rendered.startPlaceId).toBe("route-place-custom");
  expect(rendered.startAlt).toBe("주입 코스 사진");
  expect(rendered.savedCandidates).toContain("주입 코스 장소에서 가까운 곳");
  expect(rendered.discoverCandidates).toContain("주입 코스 장소에서 가까운 곳");
  expect(rendered.confirmation).toContain("주입 코스 장소");
  expect(rendered.complete).toContain("주입 완성 코스");
  expect(rendered.nearbyPlaceId).toBe("route-nearby-custom");
  expect(rendered.directStartCardCount).toBe(0);
  expect(rendered.directStartText).toContain("저장한 장소가 필요해요");
  expect(rendered.complete).not.toContain("연남 저녁 데이트");
});

test("D1 direct entry exposes photo controls only when place media exists", async ({ page }) => {
  await page.goto(reviewRouteUrl("d1"));
  await page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key)) || {};
    localStorage.setItem(key, JSON.stringify({
      ...current,
      savedPlaceIds: Array.from({ length: 10 }, (_, index) => `place-${index + 1}`)
    }));
  }, STORAGE_KEY);
  await page.reload();

  const cards = page.locator(".route-start-media");
  await expect(cards).toHaveCount(10);
  await cards.first().getByRole("button", { name: /사진 메뉴/ }).click();
  await page.getByRole("button", { name: "이 사진 숨기기" }).click();
  await expect(cards).toHaveCount(9);
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(persisted.hiddenMediaIds).toHaveLength(1);

  const empty = await page.evaluate(async () => {
    const { normalizeDataSnapshot } = await import("/app-preview/data/contracts.js");
    const { ROUTE_RENDERERS } = await import("/app-preview/screens/routes.js");
    const data = normalizeDataSnapshot({ places: [], media: [], profiles: [], tags: [], courses: [] });
    const screen = ROUTE_RENDERERS.d1({ savedPlaceIds: [], selections: {} }, data);
    return {
      cardCount: screen.querySelectorAll(".route-start-media").length,
      menuCount: screen.querySelectorAll(".route-start-media__menu").length,
      text: screen.textContent
    };
  });
  expect(empty.cardCount).toBe(0);
  expect(empty.menuCount).toBe(0);
  expect(empty.text).toContain("저장한 장소가 필요해요");
});

test("D9 direct entry restores a deterministic complete course", async ({ page }) => {
  await page.goto(reviewRouteUrl("d9"));

  const screen = page.locator('[data-screen-id="d9"]');
  await expect(screen.locator(".route-complete-scroll")).toBeVisible();
  await expect(screen.getByRole("heading", { name: "연남 저녁 데이트 루트" })).toBeVisible();
  await expect(screen.locator(".route-complete-place")).toHaveCount(3);
});

async function gotoRouteConfirmation(page, routePlaceIds = []) {
  await page.goto(reviewRouteUrl("d7"));
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

  await page.goto(reviewRouteUrl("d7"));
  await page.getByRole("button", { name: "코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d8/);

  const destinations = [
    ["발견", "b2"],
    ["저장", "c1"],
    ["코스", "d3"],
    ["MY", "e1"]
  ];
  for (const [label, screenId] of destinations) {
    await page.goto(reviewRouteUrl("d7"));
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`screen=${screenId}`));
  }
});

test("D7 uses the viewport frame without horizontal overflow", async ({ page }) => {
  for (const viewport of [{ width: 393, height: 852 }, { width: 360, height: 780 }]) {
    await page.setViewportSize(viewport);
    const screen = await gotoRouteConfirmation(page);
    const geometry = await screen.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight
    }));
    expect(geometry.width).toBeCloseTo(viewport.width, 1);
    expect(geometry.height).toBeCloseTo(viewport.height, 1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.scrollHeight).toBeGreaterThanOrEqual(Math.min(852, viewport.height));
  }
});

for (const viewport of [{ width: 375, height: 667 }, { width: 360, height: 800 }]) {
  test(`D7 keeps both CTAs and navigation stable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const screen = await gotoRouteConfirmation(page, ["place-1", "place-7", "place-8"]);
    const create = page.getByRole("button", { name: "코스 만들기" });
    const change = page.getByRole("button", { name: "장소 바꾸기" });
    const nav = page.getByRole("navigation", { name: "주요 메뉴" });

    await expect(change).toBeInViewport();
    await expect(create).toBeInViewport();
    await expect(nav).toBeInViewport();
    const before = await nav.boundingBox();
    await screen.hover();
    await page.mouse.wheel(0, 900);
    const after = await nav.boundingBox();
    expect(after.y).toBeCloseTo(before.y, 1);
    expect(await screen.evaluate((element) => element.scrollTop)).toBe(0);
  });
}

test("D7 stays within 2.6 percent of the Figma frame after shared navigation normalization", async ({ page }) => {
  const screen = await gotoRouteConfirmation(page, ["place-1", "place-7", "place-8"]);
  expect(await visualDiffRatio(page, screen)).toBeLessThanOrEqual(0.026);
});

test("the complete course flow works from saved places to a saved course", async ({ page }) => {
  await page.goto(reviewRouteUrl("d3"));
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    savedPlaceIds: ["place-1", "place-10", "place-11"]
  })), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('[data-screen-id="d3"]')).toHaveAttribute("data-render-mode", "semantic");
  await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
  await page.getByRole("button", { name: "오브젝트 연남에서 시작" }).click();
  await expect(page).toHaveURL(/screen=d4/);
  await page.evaluate(({ key, ids }) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...current, savedPlaceIds: ids }));
  }, { key: STORAGE_KEY, ids: ["place-10", "place-11"] });
  await page.reload();
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
  await page.getByRole("button", { name: "코스 공유" }).click();
  const shared = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(shared.selections.shareTarget).toEqual({ type: "route", id: "saved-route-1" });
});

test("D3 shows one preferred media item per unique saved place", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    savedPlaceIds: ["place-1", "place-1", "place-2", "place-3"]
  })), STORAGE_KEY);
  await page.goto(reviewRouteUrl("d3"));

  const cards = page.locator('[data-testid="route-start-media"]');
  await expect(cards).toHaveCount(3);
  const places = await cards.evaluateAll((items) => items.map((item) => item.dataset.placeId));
  const media = await cards.evaluateAll((items) => items.map((item) => item.dataset.mediaId));
  expect(new Set(places).size).toBe(3);
  expect(new Set(media).size).toBe(3);
});

test("D3 empty state does not invent unsaved places", async ({ page }) => {
  await page.goto(reviewRouteUrl("d3"));
  await expect(page.locator('[data-testid="route-start-media"]')).toHaveCount(0);
  await expect(page.getByText("저장한 장소가 아직 없어요", { exact: true })).toBeVisible();
});

test("course source toggle preserves the phone layout", async ({ page }) => {
  await page.goto(reviewRouteUrl("d5"));
  const savedScreen = page.locator('[data-screen-id="d5"]');
  const savedTabs = page.getByRole("tablist", { name: "코스 후보 출처" });
  const savedGeometry = await Promise.all([savedScreen.boundingBox(), savedTabs.boundingBox()]);

  await page.getByRole("tab", { name: "발견하기" }).click();
  await expect(page).toHaveURL(/screen=d6/);
  const discoverScreen = page.locator('[data-screen-id="d6"]');
  const discoverTabs = page.getByRole("tablist", { name: "코스 후보 출처" });
  await expect(page.getByRole("tab", { name: "발견하기" })).toHaveAttribute("aria-selected", "true");
  const discoverGeometry = await Promise.all([discoverScreen.boundingBox(), discoverTabs.boundingBox()]);

  expect(discoverGeometry[0].x).toBeCloseTo(savedGeometry[0].x, 1);
  expect(discoverGeometry[0].y).toBeCloseTo(savedGeometry[0].y, 1);
  expect(discoverGeometry[0].width).toBeCloseTo(savedGeometry[0].width, 1);
  expect(discoverGeometry[1].x).toBeCloseTo(savedGeometry[1].x, 1);
  expect(discoverGeometry[1].y).toBeCloseTo(savedGeometry[1].y, 1);
  expect(discoverGeometry[1].width).toBeCloseTo(savedGeometry[1].width, 1);
});

test("candidate source labels stay visible above the animated selected surface", async ({ page }) => {
  for (const screenId of ["d5", "d6"]) {
    await page.goto(reviewRouteUrl(screenId));
    const selected = page.locator(".route-source-tabs .preview-segmented-control__item.is-selected");
    await expect(selected).toBeVisible();
    const presentation = await selected.evaluate((element) => {
      const style = getComputedStyle(element);
      return { text: element.textContent.trim(), color: style.color, zIndex: style.zIndex };
    });
    expect(presentation.text.length).toBeGreaterThan(0);
    expect(presentation.color).toBe("rgb(255, 255, 255)");
    expect(Number(presentation.zIndex)).toBeGreaterThanOrEqual(1);
  }
});

test("course back controls reuse the place detail position and size", async ({ page }) => {
  await page.goto(reviewRouteUrl());
  await page.evaluate(() => {
    const reference = document.createElement("button");
    reference.className = "discover-detail-back";
    document.body.style.margin = "0";
    document.body.replaceChildren(reference);
  });
  const reference = await page.locator(".discover-detail-back").boundingBox();

  for (const screenId of ["d5", "d6", "d7", "d8", "d9"]) {
    await mountFixtureRoute(page, screenId);
    const back = await page.evaluate(() => {
      const node = document.querySelector(".route-shared-back");
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    expect(back, `${screenId} shared back control`).not.toBeNull();
    expect(back.x).toBeCloseTo(reference.x, 1);
    expect(back.y).toBeCloseTo(reference.y, 1);
    expect(back.width).toBeCloseTo(reference.width, 1);
    expect(back.height).toBeCloseTo(reference.height, 1);
  }
});

test("route sheets snap from either a deliberate drag or a quick flick", async ({ page }) => {
  const targets = await page.evaluate(async () => {
    const { routeSheetSnapTarget } = await import("/app-preview/screens/routes.js");
    const options = { up: "d3", down: "d2" };
    return {
      longUp: routeSheetSnapTarget({ deltaY: -72, durationMs: 420, ...options }),
      fastUp: routeSheetSnapTarget({ deltaY: -22, durationMs: 24, ...options }),
      longDown: routeSheetSnapTarget({ deltaY: 72, durationMs: 420, ...options }),
      fastDown: routeSheetSnapTarget({ deltaY: 22, durationMs: 24, ...options }),
      shortSlow: routeSheetSnapTarget({ deltaY: 22, durationMs: 420, ...options }),
      unavailableDirection: routeSheetSnapTarget({ deltaY: 72, durationMs: 24, up: "d3", down: null })
    };
  });

  expect(targets).toEqual({
    longUp: "d3",
    fastUp: "d3",
    longDown: "d2",
    fastDown: "d2",
    shortSlow: null,
    unavailableDirection: null
  });
});

test("D5 and D6 hero tags come from the selected start place", async ({ page }) => {
  const heroTags = await page.evaluate(async () => {
    const { normalizeDataSnapshot } = await import("/app-preview/data/contracts.js");
    const { ROUTE_RENDERERS } = await import("/app-preview/screens/routes.js");
    const data = normalizeDataSnapshot({
      places: [{
        id: "hero-place", name: "데이터 영웅 장소", userId: "hero-profile",
        mediaIds: [], tagIds: ["hero-category", "hero-neighborhood"],
        address: "서울 데이터로 1", latitude: 37.5, longitude: 126.9
      }],
      media: [],
      profiles: [{ id: "hero-profile", name: "데이터 사용자", handle: "data", avatarUrl: "" }],
      tags: [
        { id: "hero-category", name: "데이터 카테고리", group: "category" },
        { id: "hero-neighborhood", name: "데이터 동네", group: "neighborhood" }
      ],
      courses: []
    });
    const state = {
      savedPlaceIds: ["hero-place"],
      routeDraft: { startPlaceId: "hero-place", placeIds: ["hero-place"] },
      routePlaceIds: ["hero-place"],
      selections: {}
    };
    const text = (screenId) => [...ROUTE_RENDERERS[screenId](state, data)
      .querySelectorAll(".route-candidate-hero span")]
      .map((tag) => tag.textContent);
    return { d5: text("d5"), d6: text("d6") };
  });

  expect(heroTags.d5).toEqual(["데이터 카테고리", "데이터 동네"]);
  expect(heroTags.d6).toEqual(heroTags.d5);
});

test("D5 and D6 secondary text keeps accessible contrast", async ({ page }) => {
  const contrastRatios = [];
  const cases = [
    ["d5", ".route-candidate-heading p", "#fffdf9"],
    ["d5", ".route-saved-candidate__copy p", "#ffffff"],
    ["d5", ".route-candidate-tags span", "#eefff4"],
    ["d6", ".route-discover-candidate__meta > small", "#ffffff"],
    ["d6", ".route-discover-candidate__meta p", "#ffffff"],
    ["d6", ".route-candidate-tags span", "#eefff4"]
  ];

  for (const [screenId, selector, background] of cases) {
    await mountFixtureRoute(page, screenId);
    const ratio = await page.locator(selector).first().evaluate((node, backgroundColor) => {
      const channels = (value) => {
        if (value.startsWith("#")) {
          const hex = value.slice(1);
          const normalized = hex.length === 3
            ? [...hex].map((digit) => digit + digit).join("")
            : hex;
          return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
        }
        return value.match(/[\d.]+/g).slice(0, 3).map(Number);
      };
      const luminance = (value) => {
        const [red, green, blue] = channels(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const foreground = luminance(getComputedStyle(node).color);
      const backdrop = luminance(backgroundColor);
      return (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05);
    }, background);
    contrastRatios.push({ screenId, selector, ratio });
  }

  for (const result of contrastRatios) {
    expect(result.ratio, `${result.screenId} ${result.selector}`).toBeGreaterThanOrEqual(4.5);
  }
});

test("course filter sheet supports selection, reset, backdrop dismissal, and drag dismissal", async ({ page }) => {
  await page.goto(reviewRouteUrl("d5"));
  await page.getByRole("button", { name: "조건 변경" }).click();
  const dialog = page.getByRole("dialog", { name: "다음 장소 조건" });
  await expect(dialog).toBeVisible();

  await page.getByRole("button", { name: "데이트", exact: true }).click();
  await page.getByRole("button", { name: "오후", exact: true }).click();
  await page.getByRole("button", { name: "조용함", exact: true }).click();
  await expect(dialog.getByText("데이트", { exact: true })).toHaveCount(2);
  await expect(dialog.getByText("오후", { exact: true })).toHaveCount(2);
  await expect(dialog.getByText("조용함", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "필터 초기화" }).click();
  await expect(page.getByRole("dialog", { name: "다음 장소 조건" })).toBeVisible();
  await expect(page.getByRole("button", { name: "데이트", exact: true })).toHaveAttribute("aria-pressed", "false");

  const handle = page.getByRole("button", { name: "필터 창 닫기" });
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "다음 장소 조건" })).toBeHidden();

  await page.getByRole("button", { name: "조건 변경" }).click();
  await page.locator(".route-filter-sheet-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole("dialog", { name: "다음 장소 조건" })).toBeHidden();
});

test("course filter supports a Seoul-wide default and a pin radius", async ({ page }) => {
  await page.goto(reviewRouteUrl("d5"));
  await page.getByRole("button", { name: "조건 변경" }).click();

  const dialog = page.getByRole("dialog", { name: "다음 장소 조건" });
  await expect(dialog.getByRole("button", { name: "서울 전체 위치 설정" })).toBeVisible();
  await dialog.getByRole("button", { name: "서울 전체 위치 설정" }).click();
  await dialog.getByRole("button", { name: "지도에서 핀 위치 선택" }).click({ position: { x: 185, y: 112 } });
  await dialog.getByRole("button", { name: "10km 반경" }).click();
  await dialog.getByRole("button", { name: "필터 적용하기" }).click();

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.selections.locationMode).toBe("pin");
  expect(state.selections.locationRadiusKm).toBe(10);
  expect(state.selections.locationCenter).toMatchObject({
    latitude: expect.any(Number),
    longitude: expect.any(Number)
  });
  await expect(page.getByRole("button", { name: "핀 주변 10km 위치 필터" })).toBeVisible();
});

test("every course filter option resolves to the canonical tag IDs", async ({ page }) => {
  const cases = [
    { label: "가족/단체", placeId: "place-10", placeName: "포털로빈" },
    { label: "대화하기 좋은", placeId: "place-5", placeName: "연남 라운지" },
    { label: "세련된", placeId: "place-9", placeName: "연남방앗간" }
  ];

  for (const filterCase of cases) {
    await page.addInitScript(({ key, placeId }) => localStorage.setItem(key, JSON.stringify({
      savedPlaceIds: [placeId],
      selections: {}
    })), { key: STORAGE_KEY, placeId: filterCase.placeId });
    await page.goto(reviewRouteUrl("d5"));
    await page.getByRole("button", { name: "조건 변경" }).click();
    await page.getByRole("button", { name: filterCase.label, exact: true }).click();
    await page.getByRole("button", { name: "필터 적용하기" }).click();
    await expect(page.getByRole("heading", { name: filterCase.placeName })).toBeVisible();
  }
});

test("course candidates update immediately and saving reopens the canonical route from C2", async ({ page }) => {
  await page.goto(reviewRouteUrl("d4"));
  await page.evaluate(({ key, ids }) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...current,
      savedPlaceIds: ids,
      selections: { ...current.selections, selectedPlaceId: "place-1", startPlaceCardOpen: true }
    }));
  }, { key: STORAGE_KEY, ids: ["place-10", "place-11"] });
  await page.reload();
  await page.getByRole("button", { name: "여기서 시작하기" }).click();
  await expect(page.getByText("0곳 선택됨", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /포털로빈.*추가/ }).click();
  await page.getByRole("button", { name: /소이연남.*추가/ }).click();
  await expect(page.getByText("2곳 선택됨", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "선택한 장소로 코스 만들기" }).click();
  await page.getByRole("button", { name: "코스 만들기" }).click();
  await page.getByRole("textbox", { name: "코스 이름" }).fill("연남 친구 산책");
  await page.getByRole("button", { name: "코스 저장하기" }).click();

  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(saved.savedRoutes).toEqual([{ id: "saved-route-1", name: "연남 친구 산책", placeIds: ["place-1", "place-10", "place-11"] }]);

  await page.goto(reviewRouteUrl("c2"));
  await page.getByRole("button", { name: "연남 친구 산책 상세 보기" }).click();
  await expect(page.locator(".saved-route-stop strong")).toHaveText(["오브젝트 연남", "포털로빈", "소이연남"]);
});

test("D5 excludes the start place and visibly retains an added candidate", async ({ page }) => {
  await page.goto(reviewRouteUrl("d5"));
  await page.evaluate(({ key, next }) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...current, ...next }));
  }, {
    key: STORAGE_KEY,
    next: {
      savedPlaceIds: ["place-1", "place-10", "place-11"],
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1"] },
      routePlaceIds: ["place-1"]
    }
  });
  await page.reload();

  await expect(page.locator(".route-saved-candidate h3")).toHaveText(["포털로빈", "소이연남"]);
  await expect(page.getByText("0곳 선택됨", { exact: true })).toBeVisible();

  const toggle = page.getByRole("button", { name: "포털로빈 추가" });
  await toggle.click();
  const added = page.getByRole("button", { name: "포털로빈 추가됨" });
  await expect(added).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1곳 선택됨", { exact: true })).toBeVisible();

  await added.click();
  await expect(page.getByRole("button", { name: "포털로빈 추가됨" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("1곳 선택됨", { exact: true })).toBeVisible();
});

test("saving the same route draft and name reuses the canonical route", async ({ page }) => {
  await page.goto(reviewRouteUrl("d8"));
  await page.evaluate(({ key, next }) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...current, ...next }));
  }, {
    key: STORAGE_KEY,
    next: {
      form: { routeName: "연남 오후 코스" },
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-2"] },
      routePlaceIds: ["place-1", "place-2"],
      savedRoutes: [{ id: "saved-route-1", name: "연남 오후 코스", placeIds: ["place-1", "place-2"] }],
      selections: { selectedRouteId: "saved-route-1" }
    }
  });
  await page.reload();
  await page.getByRole("button", { name: "코스 저장하기" }).click();

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.savedRoutes).toEqual([
    { id: "saved-route-1", name: "연남 오후 코스", placeIds: ["place-1", "place-2"] }
  ]);
  expect(state.selections.selectedRouteId).toBe("saved-route-1");
});

test("course candidate filters remove nonmatching D5 and D6 places and additions stay selected", async ({ page }) => {
  await page.goto(reviewRouteUrl("d5"));
  await page.evaluate(({ key, ids }) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...current, savedPlaceIds: ids }));
  }, { key: STORAGE_KEY, ids: ["place-10", "place-11", "place-2"] });
  await page.reload();
  const firstBefore = await page.locator(".route-saved-candidate h3").first().textContent();
  await page.getByRole("button", { name: "오후 필터" }).click();
  await expect(page.getByRole("button", { name: "오후 필터" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".route-saved-candidate h3")).toHaveText(["브런치가든 연남"]);
  expect(firstBefore).not.toBe("브런치가든 연남");

  await page.getByRole("button", { name: "오후 필터" }).click();
  const add = page.getByRole("button", { name: "포털로빈 추가" });
  await add.click();
  const added = page.getByRole("button", { name: "포털로빈 추가됨" });
  await expect(added).toHaveAttribute("aria-pressed", "true");
  await added.click();
  await expect(page.getByRole("button", { name: "포털로빈 추가됨" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("tab", { name: "발견하기" }).click();
  await expect(page).toHaveURL(/screen=d6/);
  await expect(page.locator('[data-screen-id="d6"]')).toHaveAttribute("data-render-mode", "semantic");
  await page.getByRole("button", { name: "데이트 필터" }).click();
  await expect(page.locator(".route-discover-candidate h3")).toHaveText(["오브젝트 연남", "무드키친", "리틀넬 연남"]);
});

test("course start, nearby recommendation, and sheet keyboard controls keep valid state", async ({ page }) => {
  await page.goto(reviewRouteUrl("d1"));
  await page.locator(".route-start-handle").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/screen=d3/);
  await page.locator(".route-start-handle").focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/screen=d2/);
  await expect(page.getByRole("button", { name: "여기서 시작하기" })).toBeDisabled();
  await page.locator(".route-start-handle").focus();
  await page.keyboard.press("ArrowUp");
  await expect(page).toHaveURL(/screen=d3/);
  await page.locator(".route-start-handle").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/screen=d2/);

  await page.goto(reviewRouteUrl("d4"));
  await expect(page.getByRole("button", { name: "여기서 시작하기" })).toBeDisabled();

  await gotoFixtureRouteComplete(page);
  const nearby = page.locator(".route-nearby-card");
  await expect(nearby).toHaveAttribute("data-place-id", "place-2");
  await nearby.click();
  await expect(page).toHaveURL(/screen=b10/);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.selections.selectedPlaceId).toBe("place-2");
});

test("route detail and map screens expose a working back control", async ({ page }) => {
  for (const screenId of ["d2", "d4", "d7", "d8", "d9"]) {
    await page.goto(reviewRouteUrl(screenId));
    await expect(page.getByRole("button", { name: "뒤로 가기" })).toBeVisible();
  }
});

test("a course detail opened from feed is attributed as shared and exposes no edit controls", async ({ page }) => {
  await gotoFixtureRouteComplete(page);
  await page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...current,
      routeDraft: { startPlaceId: "place-1", placeIds: ["place-1", "place-7", "place-8"] },
      routePlaceIds: ["place-1", "place-7", "place-8"],
      selections: { selectedRouteId: "route-1", routeDetailSource: "feed" }
    }));
  }, STORAGE_KEY);
  await page.reload();

  await expect(page.getByRole("button", { name: "뒤로 가기" })).toBeVisible();
  await expect(page.locator(".route-complete-author")).toContainText("도리");
  await expect(page.locator(".route-complete-author")).toContainText("큐레이터");
  await expect(page.getByRole("button", { name: /바꾸기|수정|삭제/ })).toHaveCount(0);
});

test("a dynamic route share URL deterministically restores the exact route without local storage", async ({ page, browser }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ url }) => { window.__doripeSharedUrl = url; }
    });
  });
  await page.goto(reviewRouteUrl("d9"));
  await page.evaluate(({ key, next }) => {
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...current, ...next }));
  }, {
    key: STORAGE_KEY,
    next: {
      savedRoutes: [{ id: "saved-route-7", name: "친구와 세 곳", placeIds: ["place-10", "place-1", "place-11"] }],
      routeDraft: { startPlaceId: "place-10", placeIds: ["place-10", "place-1", "place-11"] },
      routePlaceIds: ["place-10", "place-1", "place-11"],
      selections: { selectedRouteId: "saved-route-7" }
    }
  });
  await page.reload();

  await page.getByRole("button", { name: "코스 공유" }).click();
  const firstUrl = await page.evaluate(() => window.__doripeSharedUrl);
  await page.getByRole("button", { name: "코스 공유" }).click();
  const secondUrl = await page.evaluate(() => window.__doripeSharedUrl);
  expect(secondUrl).toBe(firstUrl);
  expect(firstUrl).toContain("type=route");
  expect(firstUrl).toContain("id=saved-route-7");

  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  const recipientUrl = new URL(firstUrl);
  recipientUrl.protocol = "http:";
  recipientUrl.hostname = "localhost";
  recipientUrl.port = String(process.env.APP_PREVIEW_PORT || 4173);
  recipientUrl.searchParams.set("static", "1");
  await recipient.goto(recipientUrl.toString());
  await expect(recipient.getByRole("heading", { name: "친구와 세 곳" })).toBeVisible();
  await expect(recipient.locator(".route-complete-place strong")).toHaveText([
    "포털로빈",
    "오브젝트 연남",
    "소이연남"
  ]);
  const restored = await recipient.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(restored.savedRoutes).toEqual([
    { id: "saved-route-7", name: "친구와 세 곳", placeIds: ["place-10", "place-1", "place-11"] }
  ]);
  await recipientContext.close();
});

test("native share cancellation is silent and does not fall back to copying", async ({ page }) => {
  await page.addInitScript(() => {
    window.__doripeCopyCount = 0;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => { throw new DOMException("Share canceled", "AbortError"); }
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { window.__doripeCopyCount += 1; } }
    });
  });
  await gotoFixtureRouteComplete(page);
  await page.getByRole("button", { name: "코스 공유" }).click();

  await expect.poll(() => page.evaluate(() => window.__doripeCopyCount)).toBe(0);
  await expect(page.getByText("링크를 복사했어요", { exact: true })).toHaveCount(0);
});

test("D9 nearby recommendation follows the course list without overlapping it", async ({ page }) => {
  await mountFixtureRoute(page, "d9");
  const geometry = await page.locator(".route-nearby").evaluate((section) => {
    const sectionBox = section.getBoundingClientRect();
    const cardBox = section.querySelector(".route-nearby-card").getBoundingClientRect();
    const previousBox = section.previousElementSibling.getBoundingClientRect();
    return {
      section: { x: sectionBox.x, y: sectionBox.y, width: sectionBox.width, height: sectionBox.height },
      card: { x: cardBox.x, y: cardBox.y, width: cardBox.width, height: cardBox.height },
      previousBottom: previousBox.bottom
    };
  });
  expect(geometry.section.x).toBe(24);
  expect(geometry.section.width).toBe(345);
  expect(geometry.section.y).toBeGreaterThanOrEqual(geometry.previousBottom);
  expect(geometry.card.x).toBe(24);
  expect(geometry.card.width).toBe(345);
  expect(geometry.card.y).toBeGreaterThan(geometry.section.y);
});

for (const viewport of [{ width: 393, height: 852 }, { width: 360, height: 667 }]) {
  test(`D9 keeps its top and bottom positions stable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mountFixtureRoute(page, "d9");

    const screen = page.locator('[data-screen-id="d9"]');
    const scroll = screen.locator(".route-complete-scroll");
    const nav = screen.getByRole("navigation", { name: "주요 메뉴" });
    const before = {
      screen: await screen.boundingBox(),
      nav: await nav.boundingBox()
    };

    await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    const after = {
      screen: await screen.boundingBox(),
      nav: await nav.boundingBox(),
      nearby: await screen.locator(".route-nearby").boundingBox()
    };

    expect(before.screen.y).toBeCloseTo(0, 1);
    expect(before.screen.height).toBeCloseTo(viewport.height, 1);
    expect(after.screen.y).toBeCloseTo(before.screen.y, 1);
    expect(after.screen.height).toBeCloseTo(before.screen.height, 1);
    expect(after.nav.y).toBeCloseTo(before.nav.y, 1);
    expect(after.nav.y + after.nav.height).toBeLessThanOrEqual(viewport.height);
    expect(after.nearby.y).toBeGreaterThanOrEqual(0);
    expect(after.nearby.y + after.nearby.height).toBeLessThanOrEqual(after.nav.y - 8);
  });
}
