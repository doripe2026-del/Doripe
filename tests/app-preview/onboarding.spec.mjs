import { expect, test } from "@playwright/test";
import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import assetPolicy from "../../public/app-preview/figma/flow-a-asset-policy.json" with { type: "json" };
import coverageManifest from "../../public/app-preview/figma/flow-a-coverage-manifest.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import { resolveFlowACoverage } from "../../scripts/app-preview-semantic-gates.mjs";

const FLOW_A = Object.freeze([
  { id: "a1", nodeId: "446:34", title: "오늘 갈 곳, 1분 안에 정해요", action: "start", actionLabel: "시작하기" },
  { id: "a1-splash", nodeId: "579:698", title: "Doripe", progress: "Doripe 시작 중" },
  { id: "a3", nodeId: "579:929", title: "다시 만나서 반가워요", action: "submit-login", actionLabel: "로그인" },
  { id: "a4", nodeId: "579:991", title: "다시 로그인해 주세요", action: "submit-login", actionLabel: "로그인" },
  { id: "a5", nodeId: "579:833", title: "이메일을 입력해주세요", action: "send-reset-email", actionLabel: "다음" },
  { id: "a6", nodeId: "579:848", title: "재설정 메일을 보냈어요", action: "return-to-login", actionLabel: "로그인으로 돌아가기" },
  { id: "a7", nodeId: "579:702", title: "새 비밀번호 설정", action: "save-password", actionLabel: "저장하기" },
  { id: "a8", nodeId: "579:1063", title: "비밀번호를 다시 확인해 주세요", action: "save-password", actionLabel: "저장하기" },
  { id: "a9", nodeId: "579:638", title: "이메일을 입력해주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a10", nodeId: "579:1015", title: "이메일을 입력해 주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a11", nodeId: "579:1039", title: "이미 가입된 이메일이에요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a12", nodeId: "579:621", title: "비밀번호를 만들어주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a13", nodeId: "579:660", title: "비밀번호를 만들어주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a14", nodeId: "579:763", title: "태어난 연도를 알려주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a15", nodeId: "579:951", title: "성별을 선택해주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a16", nodeId: "579:739", title: "어떻게 불러드릴까요?", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a17", nodeId: "579:1102", title: "닉네임을 입력해 주세요", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a18", nodeId: "579:781", title: "평소 장소를 어떻게 찾나요?", action: "choose-location", actionLabel: "위치 고르기" },
  { id: "a19", nodeId: "579:863", title: "Doripe를 어디서 알게 됐나요?", action: "continue-sign-up", actionLabel: "다음" },
  { id: "a20", nodeId: "579:1127", title: "동네를 선택해 주세요", action: "confirm-neighborhood", actionLabel: "시작" },
  { id: "a21", nodeId: "579:1173", title: "연남으로 가는 중", progress: "장소 카드 준비 중" },
  { id: "a22", nodeId: "579:1162", title: "성수로 이동 중", progress: "취향 장소 준비 중" }
]);

const EXISTING_EMAIL = "doripe@example.com";
const LOGIN_EMAIL = "dori@doripe.kr";
const VALID_PASSWORD = "Doripe123";

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

async function gotoScreen(page, screenId, { staticFrame = true } = {}) {
  const suffix = staticFrame ? "&static=1" : "";
  await page.goto(`/app-preview/?screen=${screenId}${suffix}`);
  return page.locator(`[data-screen-id="${screenId}"]`);
}

async function compareWithReference(page, screen, screenId, testInfo) {
  const screenshot = await screen.screenshot({
    animations: "disabled",
    path: testInfo.outputPath(`${screenId}.png`)
  });
  const ratio = await page.evaluate(async ({ actualBase64, referenceUrl, screenMasks }) => {
    const loadImage = (source) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
    const [actualImage, referenceImage] = await Promise.all([
      loadImage(`data:image/png;base64,${actualBase64}`),
      loadImage(referenceUrl)
    ]);
    const createPixels = (image) => {
      const canvas = document.createElement("canvas");
      canvas.width = 393;
      canvas.height = 852;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const actual = createPixels(actualImage);
    const reference = createPixels(referenceImage);
    const insideMask = (x, y) => screenMasks.some((mask) => (
      x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height
    ));
    let compared = 0;
    let different = 0;
    const maxColorDelta = 35_215 * 0.2 * 0.2;
    for (let y = 0; y < 852; y += 1) {
      for (let x = 0; x < 393; x += 1) {
        if (insideMask(x, y)) continue;
        const offset = (y * 393 + x) * 4;
        const red = actual[offset] - reference[offset];
        const green = actual[offset + 1] - reference[offset + 1];
        const blue = actual[offset + 2] - reference[offset + 2];
        const yDelta = 0.29889531 * red + 0.58662247 * green + 0.11448223 * blue;
        const iDelta = 0.59597799 * red - 0.2741761 * green - 0.32180189 * blue;
        const qDelta = 0.21147017 * red - 0.52261711 * green + 0.31114694 * blue;
        const delta = 0.5053 * yDelta * yDelta
          + 0.299 * iDelta * iDelta
          + 0.1957 * qDelta * qDelta;
        compared += 1;
        if (delta > maxColorDelta) different += 1;
      }
    }
    return different / compared;
  }, {
    actualBase64: screenshot.toString("base64"),
    referenceUrl: `/app-preview/assets/references/${screenId}.png`,
    screenMasks: masks[screenId] || []
  });

  await testInfo.attach(`${screenId}-visual-diff`, {
    body: Buffer.from(JSON.stringify({ ratio }, null, 2)),
    contentType: "application/json"
  });
  expect(ratio, `${screenId} visual diff ratio`).toBeLessThanOrEqual(0.02);
  return ratio;
}

async function assertMeasuredGeometry(screen, screenId) {
  const frame = await screen.boundingBox();
  expect(frame).not.toBeNull();
  const measuredNodes = await screen.locator("[data-measure-key]").evaluateAll((elements) => (
    elements.map((element) => ({
      source: element.dataset.measureKey,
      rect: element.getBoundingClientRect().toJSON()
    }))
  ));
  const coverage = resolveFlowACoverage({
    screenId,
    nodeId: measurements[screenId].nodeId,
    measurementKeys: Object.keys(measurements[screenId].elements),
    renderedSources: measuredNodes.map(({ source }) => source),
    classifications: coverageManifest.classifications
  });
  let maximumDelta = 0;

  for (const key of coverage.rendered) {
    const matches = measuredNodes.filter((node) => node.source === key);
    expect(matches, `${screenId}/${key} has exactly one measured DOM owner`).toHaveLength(1);
    const expected = measurements[screenId].elements[key];
    const actual = matches[0].rect;
    const relative = {
      x: actual.x - frame.x,
      y: actual.y - frame.y,
      width: actual.width,
      height: actual.height
    };
    for (const property of ["x", "y", "width", "height"]) {
      maximumDelta = Math.max(maximumDelta, Math.abs(relative[property] - expected[property]));
      expect(
        Math.abs(relative[property] - expected[property]),
        `${screenId}/${key}/${property}`
      ).toBeLessThanOrEqual(1);
    }
  }
  return maximumDelta;
}

async function assertSemanticAssets(screen, screenId) {
  const policyByPath = new Map(assetPolicy.assets.map((asset) => [asset.path, asset]));
  const result = await screen.evaluate((root) => {
    const frame = root.getBoundingClientRect();
    return {
      images: [...root.querySelectorAll("img")].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          path: new URL(element.currentSrc || element.src, location.href).pathname,
          areaRatio: (rect.width * rect.height) / (frame.width * frame.height)
        };
      }),
      urlBackgrounds: [...root.querySelectorAll("*")]
        .filter((element) => getComputedStyle(element).backgroundImage.includes("url("))
        .map((element) => element.className || element.tagName)
    };
  });

  expect(result.urlBackgrounds, `${screenId} CSS image backgrounds`).toEqual([]);
  for (const image of result.images) {
    const policy = policyByPath.get(image.path);
    expect(policy, `${screenId} declares ${image.path}`).toBeTruthy();
    expect(policy.screens, `${image.path} screen ownership`).toContain(screenId);
    if (image.areaRatio > 0.7) {
      expect(policy.role, `${image.path} large-image role`).toBe("decorative");
      expect(policy.allowLarge, `${image.path} large-image approval`).toBe(true);
    }
  }
}

test.describe("Flow A direct-entry renderers", () => {
  for (const entry of FLOW_A) {
    test(`${entry.id} renders semantic Figma frame`, async ({ page }, testInfo) => {
      const screen = await gotoScreen(page, entry.id);

      await expect(screen).toHaveAttribute("data-figma-node", entry.nodeId);
      await expect(screen).toHaveAttribute("data-render-mode", "semantic");
      await expect(screen.getByRole("heading", { name: entry.title, exact: true })).toBeVisible();
      await expect(screen.locator('img[src*="/assets/references/"]')).toHaveCount(0);

      const expectedActions = [...new Set(actionContract.actions
        .filter((record) => record.screenId === entry.id)
        .map((record) => record.actionId))].sort();
      const renderedActions = [...new Set(await screen.locator("[data-action]")
        .evaluateAll((elements) => elements.map((element) => element.dataset.action)))].sort();
      expect(renderedActions, `${entry.id} action contract`).toEqual(expectedActions);

      const actionSources = await screen.locator("[data-action][data-measure-key]")
        .evaluateAll((elements) => elements.map((element) => ({
          actionId: element.dataset.action,
          source: element.dataset.measureKey
        })));
      for (const record of actionContract.actions.filter(({ screenId }) => screenId === entry.id)) {
        const matches = actionSources.filter(({ source }) => source === record.source);
        expect(matches, `${entry.id}/${record.source} has one action owner`).toHaveLength(1);
        expect(matches[0].actionId, `${entry.id}/${record.source} action pairing`).toBe(record.actionId);
      }

      if (entry.action) {
        const primary = screen.locator(`[data-action="${entry.action}"]`);
        await expect(primary).toBeVisible();
        await expect(primary).toHaveAccessibleName(entry.actionLabel);
      } else {
        await expect(screen.getByRole("progressbar", { name: entry.progress, exact: true })).toBeVisible();
      }

      const maximumGeometryDelta = await assertMeasuredGeometry(screen, entry.id);
      await assertSemanticAssets(screen, entry.id);
      const visualDiffRatio = await compareWithReference(page, screen, entry.id, testInfo);
      console.log(`FLOW_A_METRIC ${entry.id} visual=${visualDiffRatio.toFixed(6)} geometry=${maximumGeometryDelta.toFixed(3)}`);
    });
  }
});

test("start, login, failure, and reset-password states follow the A contract", async ({ page }) => {
  await gotoScreen(page, "a1");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/screen=a3/);

  await page.getByLabel("이메일").fill(EXISTING_EMAIL);
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/screen=a4/);
  await expect(page.getByText("이메일 또는 비밀번호가 맞지 않아요.")).toBeVisible();

  await page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }).click();
  await expect(page).toHaveURL(/screen=a5/);
  await page.getByLabel("이메일 주소").fill(LOGIN_EMAIL);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a6/);
  await page.getByRole("button", { name: "로그인으로 돌아가기" }).click();
  await expect(page).toHaveURL(/screen=a3/);

  await page.getByLabel("이메일").fill(LOGIN_EMAIL);
  await page.getByLabel("비밀번호").fill(VALID_PASSWORD);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/screen=b1/);
});

test("signup shows email format and already-used email frames", async ({ page }) => {
  await gotoScreen(page, "a1");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL(/screen=a9/);

  await page.getByLabel("이메일").fill("doripe@");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a10/);
  await expect(page.getByText("올바른 이메일 형식이 아니에요.")).toBeVisible();

  await page.getByLabel("이메일").fill(EXISTING_EMAIL);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a11/);
  await expect(page.getByText("로그인하거나 비밀번호를 재설정해 주세요.")).toBeVisible();

  await page.getByLabel("이메일").fill("new-user@doripe.kr");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a12/);
});

test("password rules and reset confirmation validate before continuing", async ({ page }) => {
  await gotoScreen(page, "a12");
  const signupPassword = page.getByLabel("비밀번호");
  const next = page.getByRole("button", { name: "다음", exact: true });

  await signupPassword.fill("weak");
  await expect(next).toBeDisabled();
  await signupPassword.fill(VALID_PASSWORD);
  await expect(page.getByText("안전한 비밀번호입니다")).toBeVisible();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page).toHaveURL(/screen=a14/);

  await gotoScreen(page, "a7");
  await page.getByLabel("새 비밀번호", { exact: true }).fill(VALID_PASSWORD);
  await page.getByLabel("비밀번호 확인").fill("Doripe124");
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page).toHaveURL(/screen=a8/);
  await expect(page.getByText("비밀번호가 일치하지 않아요.")).toBeVisible();

  await page.getByLabel("비밀번호 확인").fill(VALID_PASSWORD);
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page).toHaveURL(/screen=a3/);
});

test("A7 persists its visible password before matching confirmation is saved", async ({ page }) => {
  await gotoScreen(page, "a7");
  await page.getByLabel("비밀번호 확인").fill("Doripe12");
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await expect(page).toHaveURL(/screen=a3/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(stored.form.newPassword).toBe("Doripe12");
  expect(stored.form.passwordConfirmation).toBe("Doripe12");
});

test("profile setup validates birth year, gender, and nickname", async ({ page }) => {
  await gotoScreen(page, "a14");
  await page.getByLabel("출생연도").selectOption("2000");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a15/);

  await page.getByRole("radio", { name: "남성" }).check();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a16/);

  await page.getByLabel("닉네임").fill("도리");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a17/);
  await expect(page.getByText("이미 사용 중인 닉네임이에요.")).toBeVisible();

  await page.getByLabel("닉네임").fill("새도리");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a18/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(stored.form.birthYear).toBe("2000");
  expect(stored.form.gender).toBe("male");
  expect(stored.form.nickname).toBe("새도리");
});

test("visible Flow A defaults persist before their continuation actions", async ({ page }) => {
  for (const [screenId, field, value] of [
    ["a9", "email", "dori@doripe.kr"],
    ["a13", "password", "Doripe1234"],
    ["a14", "birthYear", "2000"],
    ["a15", "gender", "female"],
    ["a16", "nickname", "dori"],
    ["a18", "habit", "instagram-saved"],
    ["a19", "source", "instagram"],
    ["a20", "neighborhoodId", "seongsu"]
  ]) {
    await gotoScreen(page, screenId);
    await expect.poll(async () => page.evaluate((key) => {
      const stored = JSON.parse(localStorage.getItem("doripe_app_preview_v1") || "null");
      return stored?.form?.[key];
    }, field), `${screenId} persists ${field}`).toBe(value);
  }
});

test("A6 resend is an interactive contracted control", async ({ page }) => {
  await gotoScreen(page, "a6");
  const resend = page.getByRole("button", { name: "메일을 못 받았어요", exact: true });
  await expect(resend).toHaveAttribute("data-action", "resend-reset-email");
  await resend.click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(stored.form.resetEmailResent).toBe(true);
  await expect(page).toHaveURL(/screen=a6/);
});

test("source, habit, and neighborhood selections persist exact values", async ({ page }) => {
  await gotoScreen(page, "a18");
  await page.getByRole("button", { name: "인스타 저장" }).click();
  await page.getByRole("button", { name: "모르겠어요" }).click();
  await expect(page).toHaveURL(/screen=a19/);

  await page.getByRole("button", { name: "인스타그램" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a20/);
  await page.getByRole("button", { name: "연남" }).click();
  await expect(page.getByText("연남에서 시작할게요")).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(stored.form.habit).toBe("instagram-saved");
  expect(stored.form.source).toBe("instagram");
  expect(stored.form.neighborhoodId).toBe("yeonnam");
});

test("the selected neighborhood labels both completion frames", async ({ page }) => {
  await gotoScreen(page, "a20", { staticFrame: false });
  await page.getByRole("button", { name: "용산", exact: true }).click();
  await page.getByRole("button", { name: "시작", exact: true }).click();

  await expect(page.getByRole("heading", { name: "용산으로 가는 중", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/screen=a22/, { timeout: 5_000 });
  await expect(page.getByRole("heading", { name: "용산으로 이동 중", exact: true })).toBeVisible();
});

test("completion loading progresses monotonically and enters Flow B once", async ({ page }) => {
  await gotoScreen(page, "a20", { staticFrame: false });
  await page.getByRole("button", { name: "시작" }).click();
  await expect(page).toHaveURL(/screen=a21/);
  await expect(page.locator('[data-screen-id="a21"]')).toBeVisible();
  await expect(page).toHaveURL(/screen=a22/, { timeout: 5_000 });

  const fill = page.locator('[data-screen-id="a22"] [role="progressbar"]');
  const widths = [];
  for (let index = 0; index < 3; index += 1) {
    widths.push(await fill.evaluate((element) => Number(element.getAttribute("aria-valuenow"))));
    await page.waitForTimeout(120);
  }
  expect(widths[1]).toBeGreaterThanOrEqual(widths[0]);
  expect(widths[2]).toBeGreaterThanOrEqual(widths[1]);

  await expect(page).toHaveURL(/screen=b1/, { timeout: 5_000 });
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/screen=b1/);
});

test("back actions use contextual history", async ({ page }) => {
  await gotoScreen(page, "a1");
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL(/screen=a9/);
  await page.getByRole("button", { name: "뒤로 가기" }).click();
  await expect(page).toHaveURL(/screen=a1/);

  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByRole("button", { name: "비밀번호를 잊으셨나요?" }).click();
  await page.getByRole("button", { name: "뒤로 가기" }).click();
  await expect(page).toHaveURL(/screen=a3/);
});

test("browser Back then in-app back preserve one coherent history", async ({ page }) => {
  await gotoScreen(page, "a1");
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await expect(page).toHaveURL(/screen=a12/);

  await page.goBack();
  await expect(page).toHaveURL(/screen=a9/);
  await page.getByRole("button", { name: "뒤로 가기", exact: true }).click();
  await expect(page).toHaveURL(/screen=a1/);

  await page.goForward();
  await expect(page).toHaveURL(/screen=a9/);
});

test("timed Flow A screens cancel handles during teardown", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.addInitScript(() => {
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    window.__flowAClearedTimers = { timeouts: 0, intervals: 0 };
    window.clearTimeout = (handle) => {
      window.__flowAClearedTimers.timeouts += 1;
      return nativeClearTimeout(handle);
    };
    window.clearInterval = (handle) => {
      window.__flowAClearedTimers.intervals += 1;
      return nativeClearInterval(handle);
    };
  });

  await gotoScreen(page, "a21", { staticFrame: false });
  await page.locator('[data-action="review-navigate"][data-id="a22"]').click();
  await expect(page).toHaveURL(/screen=a22/);
  expect(await page.evaluate(() => window.__flowAClearedTimers.timeouts)).toBeGreaterThan(0);

  await page.locator('[data-action="review-navigate"][data-id="a1"]').click();
  await expect(page).toHaveURL(/screen=a1/);
  expect(await page.evaluate(() => window.__flowAClearedTimers.intervals)).toBeGreaterThan(0);
});

for (const viewport of [
  { width: 375, height: 667 },
  { width: 430, height: 932 }
]) {
  test(`Flow A has no control clipping at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const entry of FLOW_A) {
      const screen = await gotoScreen(page, entry.id);
      const result = await screen.evaluate((root) => {
        const rootBox = root.getBoundingClientRect();
        const controls = [...root.querySelectorAll("button, input, select, [role='progressbar']")]
          .filter((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
          });
        const clipped = controls.filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < rootBox.left - 1
            || box.right > rootBox.right + 1
            || box.top < rootBox.top - 1
            || box.bottom > rootBox.bottom + 1;
        }).map((element) => element.getAttribute("aria-label") || element.textContent.trim());
        const overlaps = [];
        for (let first = 0; first < controls.length; first += 1) {
          for (let second = first + 1; second < controls.length; second += 1) {
            if (controls[first].contains(controls[second]) || controls[second].contains(controls[first])) continue;
            const firstBox = controls[first].getBoundingClientRect();
            const secondBox = controls[second].getBoundingClientRect();
            const overlapWidth = Math.min(firstBox.right, secondBox.right) - Math.max(firstBox.left, secondBox.left);
            const overlapHeight = Math.min(firstBox.bottom, secondBox.bottom) - Math.max(firstBox.top, secondBox.top);
            if (overlapWidth > 1 && overlapHeight > 1) {
              overlaps.push([
                controls[first].getAttribute("aria-label") || controls[first].textContent.trim(),
                controls[second].getAttribute("aria-label") || controls[second].textContent.trim()
              ]);
            }
          }
        }
        return {
          clipped,
          overlaps,
          viewportBounds: {
            left: rootBox.left,
            right: rootBox.right,
            width: rootBox.width,
            viewportWidth: window.innerWidth
          },
          horizontalOverflow: root.scrollWidth - root.clientWidth,
          documentOverflow: document.documentElement.scrollWidth - window.innerWidth
        };
      });

      expect(result.clipped, `${entry.id} clipped controls`).toEqual([]);
      expect(result.overlaps, `${entry.id} overlapping controls`).toEqual([]);
      expect(result.viewportBounds.left, `${entry.id} left viewport crop`).toBeGreaterThanOrEqual(-1);
      expect(result.viewportBounds.right, `${entry.id} right viewport crop`)
        .toBeLessThanOrEqual(result.viewportBounds.viewportWidth + 1);
      expect(result.viewportBounds.width, `${entry.id} viewport width`)
        .toBeLessThanOrEqual(result.viewportBounds.viewportWidth + 1);
      expect(result.horizontalOverflow, `${entry.id} horizontal overflow`).toBeLessThanOrEqual(1);
      expect(result.documentOverflow, `${entry.id} document overflow`).toBeLessThanOrEqual(1);
    }
  });
}
