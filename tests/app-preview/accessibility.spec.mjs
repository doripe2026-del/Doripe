import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 393, height: 852 },
  { width: 360, height: 800 }
];

const REPRESENTATIVE_TEXT = Object.freeze({
  b4: [
    [".discover-place-title", 13, "primary"],
    [".discover-place-summary small", 11, "support"],
    [".discover-fill-action > span", 13, "action"],
    [".discover-detail-comment p", 13, "body"]
  ],
  b8: [
    [".discover-comment__profile strong", 13, "primary"],
    [".discover-comments-list .discover-comment p", 13, "body"],
    [".discover-comments-list .discover-comment time", 11, "support"],
    [".discover-comment-composer input", 13, "action"]
  ],
  b10: [
    [".discover-info-row__label", 13, "action"],
    [".discover-info-row__value", 11, "support"],
    [".discover-text-action", 13, "action"],
    [".discover-detail-comment p", 13, "body"]
  ],
  c1: [
    [".saved-tab", 13, "action"],
    [".saved-filter-row .saved-chip", 13, "action"],
    [".saved-section-heading small", 11, "support"],
    [".saved-place-row__copy strong", 13, "primary"],
    [".saved-place-row__copy small", 11, "support"],
    [".saved-place-row__score", 11, "support"]
  ],
  c4: [
    [".saved-map-place-card small", 11, "support"],
    [".saved-static-tag", 11, "support"],
    [".saved-transit__row strong", 13, "primary"],
    [".saved-transit__row small", 11, "support"],
    [".saved-transit__row em", 11, "support"]
  ],
  c7: [
    [".saved-replace-filters .saved-chip", 13, "action"],
    [".saved-replace-excluded strong", 13, "primary"],
    [".saved-replace-excluded small", 11, "support"],
    [".saved-candidate__user", 11, "support"],
    [".saved-candidate p", 13, "body"],
    [".saved-candidate__tags span", 11, "support"],
    [".saved-candidate__replace", 13, "action"]
  ],
  d4: [
    [".route-selected-place__copy span", 11, "support"],
    [".route-selected-place__copy p", 11, "support"],
    [".route-map-start-button span", 13, "action"]
  ],
  d5: [
    [".route-source-tabs .preview-segmented-control__item", 13, "action"],
    [".route-filter-chip", 13, "action"],
    [".route-filter-change", 13, "action"],
    [".route-candidate-heading p", 13, "body"],
    [".route-saved-candidate__copy p", 11, "support"],
    [".route-candidate-tags span", 11, "support"],
    [".route-fit-score", 11, "support"]
  ],
  d6: [
    [".route-source-tabs .preview-segmented-control__item", 13, "action"],
    [".route-filter-change", 13, "action"],
    [".route-discover-candidate__meta > small", 11, "support"],
    [".route-discover-candidate__meta > strong", 11, "support"],
    [".route-discover-candidate__meta h3", 13, "primary"],
    [".route-discover-candidate__meta p", 13, "body"],
    [".route-candidate-tags span", 11, "support"]
  ],
  e3: [
    [".settings-account-label", 13, "primary"],
    [".settings-account-email", 13, "primary"],
    [".settings-account-verified", 11, "support"],
    [".settings-account-field", 13, "primary"],
    [".settings-account-save", 13, "action"],
    [".settings-account-forgot", 13, "action"],
    [".settings-delete-account", 13, "action"]
  ],
  e4: [
    [".settings-notification-row strong", 13, "primary"],
    [".settings-notification-row small", 11, "support"]
  ],
  e5: [
    [".settings-contact-message", 13, "body"],
    [".settings-contact-send", 13, "action"]
  ]
});

const DECORATIVE_COUNTER_EXCEPTIONS = Object.freeze({
  b1: [".discover-following-strip__more"],
  b4: [".discover-comment__like span"],
  b6: [".discover-comment__like span"],
  b8: [".discover-comment__like span"],
  b10: [".discover-comment__like span"],
  b11: [".discover-related-card__like span"],
  c7: [".saved-candidate__like-count", ".saved-candidate__like-count span"],
  e5: [".settings-contact-counter"]
});

const SUPPORTING_TEXT_SELECTORS = Object.freeze([
  "small", "time", "em", ".discover-place-summary small", ".discover-info-row__value",
  ".discover-tag", ".discover-comment__profile span", ".discover-comment__profile time", ".discover-card small",
  ".discover-hours-list dt", ".discover-hours-list dd", ".discover-hours-note",
  ".discover-related-card small", ".discover-related-card__distance span", ".discover-related-mini span",
  ".discover-detail-comment span", ".discover-media-credit > span",
  ".discover-profile-info p", ".discover-profile-stats dt", ".discover-following-count", ".discover-following-user__profile > span",
  ".saved-static-tag", ".saved-place-row__score", ".saved-candidate__user",
  ".saved-candidate__user span", ".saved-candidate__tags span", ".saved-candidate__foot span",
  ".saved-inline-tags span", ".saved-filter-summary span", ".saved-map-toast", ".saved-map-place-card__address span",
  ".saved-route-stop__number", ".saved-map-marker",
  ".route-order", ".route-fit-score", ".route-candidate-tags span",
  ".route-selected-place__copy span", ".route-selected-place__copy p", ".route-candidate-hero span",
  ".route-saved-candidate__copy p", ".route-discover-candidate__meta > small", ".route-discover-candidate__meta > strong",
  ".route-confirm-summary__copy p", ".route-name-sheet > p", ".route-complete-meta", ".route-complete-tags span",
  ".route-complete-place__copy span", ".route-complete-place__copy small",
  ".settings-account-verified", ".settings-account-verified span", ".settings-contact-counter"
]);

const ORDERED_REGIONS = Object.freeze({
  b4: [
    ".discover-place-summary",
    '.discover-info-row[data-info-label="주소"]',
    '.discover-info-row[data-info-label="영업시간"]',
    '.discover-info-row[data-info-label="대표 메뉴"]',
    ".discover-place-actions",
    ".discover-detail-comments-title",
    '.discover-detail-comment[data-comment-index="0"]',
    '.discover-detail-comment[data-comment-index="1"]',
    ".discover-detail-other-title",
    ".discover-media-strip"
  ],
  b10: [
    ".discover-place-summary",
    '.discover-info-row[data-info-label="주소"]',
    '.discover-info-row[data-info-label="영업시간"]',
    '.discover-info-row[data-info-label="대표 메뉴"]',
    ".discover-place-actions",
    ".discover-detail-comments-title",
    '.discover-detail-comment[data-comment-index="0"]',
    '.discover-detail-comment[data-comment-index="1"]',
    ".discover-detail-other-title",
    ".discover-media-strip",
    ".discover-related-header",
    ".discover-create-route"
  ],
  c1: [".saved-tabs", ".saved-filter-row", ".saved-section-heading", ".saved-recommendations", ".saved-place-list"],
  d5: [".route-candidate-hero", ".route-source-tabs", ".route-filter-row", ".route-candidate-heading", ".route-saved-list", ".route-candidate-footer"],
  d6: [".route-candidate-hero", ".route-source-tabs", ".route-filter-row", ".route-discover-grid", ".route-candidate-footer"],
  e5: [".settings-titlebar", ".settings-contact-message", ".settings-contact-send"]
});

const FLOW_SCREENS = [
  ...Array.from({ length: 13 }, (_, index) => `b${index + 1}`),
  "c1", "c2", "c3", "c4", "c6", "c7",
  ...Array.from({ length: 9 }, (_, index) => `d${index + 1}`),
  ...Array.from({ length: 5 }, (_, index) => `e${index + 1}`)
];

async function seedPreview(page) {
  await page.addInitScript(() => {
    const key = "doripe_app_preview_v1";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify({
      savedPlaceIds: ["place-1", "place-2", "place-3", "place-4", "place-5"],
      routePlaceIds: ["place-1", "place-2", "place-3"],
      routeDraft: { startPlaceId: "place-1" },
      selections: { selectedPlaceId: "place-1", selectedMediaId: "media-1" }
    }));
  });
}

async function gotoScreen(page, screenId, viewport = VIEWPORTS[0]) {
  await page.setViewportSize(viewport);
  await page.goto(`/app-preview/?screen=${screenId}&static=1`);
  await page.evaluate(() => document.fonts.ready);
  return page.locator(`[data-screen-id="${screenId}"]`);
}

async function expectOrderedRegions(screen, selectors, label) {
  const boxes = [];
  for (const selector of selectors) {
    const locator = screen.locator(selector).first();
    await expect(locator, `${label} ${selector}`).toBeVisible();
    boxes.push([selector, await locator.boundingBox()]);
  }
  for (let index = 0; index < boxes.length - 1; index += 1) {
    const [currentSelector, current] = boxes[index];
    const [nextSelector, next] = boxes[index + 1];
    expect(current.y + current.height, `${label}: ${currentSelector} overlaps ${nextSelector}`).toBeLessThanOrEqual(next.y + 1);
  }
}

test.beforeEach(async ({ page }) => {
  await seedPreview(page);
});

for (const viewport of VIEWPORTS) {
  test(`representative text uses practical computed sizes at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    for (const [screenId, checks] of Object.entries(REPRESENTATIVE_TEXT)) {
      const screen = await gotoScreen(page, screenId, viewport);
      for (const [selector, minimum, role] of checks) {
        const locator = screen.locator(selector).first();
        await expect(locator, `${screenId} ${role} ${selector}`).toBeVisible();
        const size = await locator.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        expect(size, `${screenId} ${role} ${selector}`).toBeGreaterThanOrEqual(minimum);
      }
    }
  });

  test(`representative screens avoid horizontal overflow and incoherent overlap at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    for (const screenId of Object.keys(REPRESENTATIVE_TEXT)) {
      const screen = await gotoScreen(page, screenId, viewport);
      const dimensions = await screen.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
      expect(dimensions.scrollWidth, `${screenId} horizontal overflow`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      if (ORDERED_REGIONS[screenId]) await expectOrderedRegions(screen, ORDERED_REGIONS[screenId], screenId);
    }
  });
}

test("B-E use one Pretendard-first Korean font stack while A remains outside the rule", async ({ page }) => {
  const families = new Set();
  for (const screenId of ["b4", "b8", "b10", "c1", "c4", "c7", "d4", "d5", "d6", "e3", "e4", "e5"]) {
    const screen = await gotoScreen(page, screenId);
    const family = await screen.evaluate((element) => getComputedStyle(element).fontFamily);
    expect(family, screenId).toMatch(/^Pretendard\b|^"Pretendard"/);
    families.add(family);
  }
  expect([...families]).toHaveLength(1);
});

test("reported text glyph controls and indicators are absent from B-E markup", async ({ page }) => {
  const forbiddenAnywhere = /[✓♡♥☼☷▶▧➤⌯↻⋮♙]|⌄|•••/;
  const forbiddenAction = /[✓♡♥☼☷▶▧➤⌯↻⋮♙+]|⌄|•••/;
  for (const screenId of FLOW_SCREENS) {
    const screen = await gotoScreen(page, screenId);
    const text = await screen.evaluate((element) => element.innerText);
    expect(text, `${screenId} visible icon substitute`).not.toMatch(forbiddenAnywhere);
    const actionableText = await screen.locator("button, a, [role=button], input, textarea").evaluateAll((elements) => elements.map((element) => element.textContent || element.value || "").join("\n"));
    expect(actionableText, `${screenId} actionable icon substitute`).not.toMatch(forbiddenAction);
  }
});

test("rendered SVG icons are local, present, and free of active or external content", async ({ page }) => {
  const seen = new Set();
  for (const screenId of FLOW_SCREENS) {
    const screen = await gotoScreen(page, screenId);
    const sources = await screen.locator('img[src$=".svg"]').evaluateAll((images) => images.map((image) => image.getAttribute("src")));
    for (const source of sources) seen.add(source);
  }

  expect(seen.size).toBeGreaterThan(0);
  for (const source of seen) {
    expect(source).toMatch(/^\/app-preview\/assets\/[a-z0-9./-]+\.svg$/);
    expect(source).not.toContain("..");
    const response = await page.request.get(source);
    expect(response.status(), source).toBe(200);
    const svg = await response.text();
    expect(svg, source).toMatch(/^\s*<svg\b/);
    expect(svg, source).not.toMatch(/<(?:script|foreignObject|iframe|object|embed|image|use|animate|set)\b/i);
    expect(svg, source).not.toMatch(/\bon[a-z]+\s*=|(?:href|src)\s*=|url\(\s*['"]?(?:https?:|\/\/|data:|javascript:)/i);
  }
});

for (const viewport of VIEWPORTS) {
  test(`all visible B-E text meets its DOM-classified minimum at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const failures = [];
    for (const screenId of FLOW_SCREENS) {
      const screen = await gotoScreen(page, screenId, viewport);
      const audit = await screen.evaluate((element, { supportSelectors, exceptionSelectors }) => {
        const support = supportSelectors.join(",");
        const exceptions = exceptionSelectors.join(",");
        const hasOwnText = (element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        return [...element.querySelectorAll("*")].filter((candidate) => {
          const style = getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();
          return hasOwnText(candidate) && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        }).map((candidate) => {
          const text = [...candidate.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent.trim()).filter(Boolean).join(" ");
          const exception = exceptions && candidate.matches(exceptions);
          return {
            selector: candidate.className ? `${candidate.tagName.toLowerCase()}.${String(candidate.className).trim().replaceAll(" ", ".")}` : candidate.tagName.toLowerCase(),
            text,
            size: Number.parseFloat(getComputedStyle(candidate).fontSize),
            minimum: exception ? 0 : (support && candidate.matches(support) ? 11 : 13),
            exception
          };
        });
      }, {
        supportSelectors: SUPPORTING_TEXT_SELECTORS,
        exceptionSelectors: DECORATIVE_COUNTER_EXCEPTIONS[screenId] || []
      });
      for (const item of audit) {
        if (item.exception && !/^\+?\d+(?:\/\d+)?$/.test(item.text)) failures.push(`${screenId} invalid exception ${item.selector}=${item.text}`);
        if (item.size < item.minimum) failures.push(`${screenId} ${item.selector} "${item.text}" ${item.size}px < ${item.minimum}px`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
}

test("B4, B6, and B10 compact comments use a readable single-line ellipsis", async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    for (const screenId of ["b4", "b6", "b10"]) {
      const screen = await gotoScreen(page, screenId, viewport);
      const comments = screen.locator(".discover-detail-comment p");
      expect(await comments.count(), screenId).toBeGreaterThan(0);
      for (let index = 0; index < await comments.count(); index += 1) {
        const geometry = await comments.nth(index).evaluate((element) => ({
          whiteSpace: getComputedStyle(element).whiteSpace,
          overflow: getComputedStyle(element).overflow,
          textOverflow: getComputedStyle(element).textOverflow,
          lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
          height: element.getBoundingClientRect().height
        }));
        expect(geometry.whiteSpace, `${screenId} ${viewport.width}px comment ${index}`).toBe("nowrap");
        expect(geometry.overflow, `${screenId} ${viewport.width}px comment ${index}`).toBe("hidden");
        expect(geometry.textOverflow, `${screenId} ${viewport.width}px comment ${index}`).toBe("ellipsis");
        expect(geometry.height, `${screenId} ${viewport.width}px comment ${index}`).toBeGreaterThanOrEqual(geometry.lineHeight);
      }
    }
  }
});

for (const screenId of ["c1", "c3", "c6", "e2"]) {
  test(`${screenId} gives every visible action a 44px hit box`, async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      const screen = await gotoScreen(page, screenId, viewport);
      const controls = await screen.locator("button, input, textarea, a, [role=button]").evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          label: element.getAttribute("aria-label") || element.textContent.trim() || element.getAttribute("placeholder") || element.tagName,
          visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right
        };
      }).filter((item) => item.visible));
      expect(controls.length).toBeGreaterThan(0);
      const failures = controls.flatMap((control) => [
        control.width < 44 ? `${control.label} width ${control.width}` : null,
        control.height < 44 ? `${control.label} height ${control.height}` : null,
        screenId === "e2" && control.left < 0 ? `${control.label} left ${control.left}` : null,
        screenId === "e2" && control.right > viewport.width ? `${control.label} right ${control.right}` : null
      ].filter(Boolean));
      expect(failures, `${screenId} ${viewport.width}px\n${failures.join("\n")}`).toEqual([]);
    }
  });
}

test("C1 empty state starts below its section heading", async ({ page }) => {
  await gotoScreen(page, "c1");
  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const state = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...state, savedPlaceIds: [] }));
  });
  await page.reload();

  const heading = page.locator(".saved-section-heading");
  const emptyState = page.getByText("저장한 장소가 아직 없어요", { exact: true });
  const headingBox = await heading.boundingBox();
  const emptyBox = await emptyState.boundingBox();
  expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(emptyBox.y);
});
