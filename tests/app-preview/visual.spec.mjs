import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import savedMasks from "../../public/app-preview/figma/saved-visual-masks.json" with { type: "json" };

const REPRESENTATIVE_SCREENS = ["b3", "b4", "c1", "c7", "d7", "e2"];
const VISUAL_BUDGETS = { b3: 0.02, b4: 0.02, c1: 0.02, c7: 0.02, d7: 0.02, e2: 0.02 };
const DYNAMIC_BASELINE_IDS = new Set(["b4", "c1", "c7", "e2"]);
const REFERENCE_ONLY_MASKS = Object.freeze({
  b2: Object.freeze([measurements.b2.elements["System / bottom crop guard"]]),
  b3: Object.freeze([measurements.b3.elements["System / bottom crop guard"]])
});
const DYNAMIC_SCREEN_MASKS = Object.freeze({
  b4: Object.freeze([{ x: 0, y: 0, width: 393, height: 480, reason: "hero-media" }]),
  e2: Object.freeze([
    { x: 145, y: 84, width: 102, height: 102, reason: "profile-photo" },
    { x: 34, y: 465, width: 316, height: 325, reason: "uploaded-media" }
  ])
});

test.use({ viewport: { width: 393, height: 852 } });

async function visualDiffRatio(page, screen, screenId, options = {}) {
  const screenshot = await screen.screenshot({ animations: "disabled" });
  return page.evaluate(async ({ actualBase64, referenceUrl, screenMasks }) => {
    const load = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
    const [actualImage, referenceImage] = await Promise.all([
      load(`data:image/png;base64,${actualBase64}`),
      load(referenceUrl)
    ]);
    const pixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 393;
      canvas.height = 852;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, 393, 852);
      context.drawImage(image, 0, 0, 393, 852);
      return context.getImageData(0, 0, 393, 852).data;
    };
    const actual = pixels(actualImage);
    const reference = pixels(referenceImage);
    const masked = (x, y) => screenMasks.some((mask) => x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height);
    let different = 0;
    let compared = 0;
    const maxColorDelta = 35_215 * 0.2 * 0.2;
    for (let y = 0; y < 852; y += 1) {
      for (let x = 0; x < 393; x += 1) {
        if (masked(x, y)) continue;
        const offset = (y * 393 + x) * 4;
        const red = actual[offset] - reference[offset];
        const green = actual[offset + 1] - reference[offset + 1];
        const blue = actual[offset + 2] - reference[offset + 2];
        const yDelta = 0.29889531 * red + 0.58662247 * green + 0.11448223 * blue;
        const iDelta = 0.59597799 * red - 0.2741761 * green - 0.32180189 * blue;
        const qDelta = 0.21147017 * red - 0.52261711 * green + 0.31114694 * blue;
        const delta = 0.5053 * yDelta ** 2 + 0.299 * iDelta ** 2 + 0.1957 * qDelta ** 2;
        compared += 1;
        if (delta > maxColorDelta) different += 1;
      }
    }
    return different / compared;
  }, {
    actualBase64: screenshot.toString("base64"),
    referenceUrl: options.referenceUrl || `/app-preview/assets/references/${screenId}.png`,
    screenMasks: options.screenMasks || [
      ...(savedMasks[screenId] || masks[screenId] || []),
      ...(REFERENCE_ONLY_MASKS[screenId] || [])
    ]
  });
}

async function setRepresentativeState(page, screenId) {
  if (screenId !== "c1") return;
  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const current = JSON.parse(localStorage.getItem(key));
    current.savedPlaceIds = ["place-1", "place-10", "place-8", "place-11", "place-7"];
    localStorage.setItem(key, JSON.stringify(current));
  });
  await page.reload();
}

test("@visual representative B/C/D/E screenshots match reviewed visual baselines", async ({ page }) => {
  for (const screenId of REPRESENTATIVE_SCREENS) {
    await page.goto(`/app-preview/?screen=${screenId}&static=1`);
    await setRepresentativeState(page, screenId);
    const screen = page.locator(`[data-screen-id="${screenId}"]`);
    if (DYNAMIC_BASELINE_IDS.has(screenId)) {
      const baseline = await readFile(new URL(`./visual.spec.mjs-snapshots/representative-${screenId}-chromium-darwin.png`, import.meta.url));
      expect(await visualDiffRatio(page, screen, screenId, {
        referenceUrl: `data:image/png;base64,${baseline.toString("base64")}`,
        screenMasks: DYNAMIC_SCREEN_MASKS[screenId] || savedMasks[screenId] || masks[screenId]
      }), `${screenId} stable UI visual difference`).toBeLessThanOrEqual(VISUAL_BUDGETS[screenId]);
      continue;
    }
    expect(await visualDiffRatio(page, screen, screenId), `${screenId} visual difference`).toBeLessThanOrEqual(VISUAL_BUDGETS[screenId]);
  }
});
