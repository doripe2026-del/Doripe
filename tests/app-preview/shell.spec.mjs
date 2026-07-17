import { expect, test } from "@playwright/test";

test("desktop shell keeps page fixed and review list scrollable", async ({ page }) => {
  await page.goto("/app-preview/");
  await expect(page.locator("#phone-root")).toHaveCSS("width", "393px");
  const viewportHeight = page.viewportSize().height;
  await expect(page.locator("#phone-root")).toHaveCSS("height", `${Math.min(852, viewportHeight)}px`);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(page.locator("#review-list")).toHaveCSS("overflow-y", "auto");
});

test("desktop detail screens stay inside the phone frame", async ({ page }) => {
  await page.goto("/app-preview/?screen=b4&static=1");

  const phone = await page.locator("#phone-root").boundingBox();
  const screen = await page.locator("#phone-root > [data-screen-id='b4']").boundingBox();

  expect(phone).not.toBeNull();
  expect(screen).not.toBeNull();
  expect(screen.x).toBeCloseTo(phone.x, 1);
  expect(screen.y).toBeCloseTo(phone.y, 1);
  expect(screen.width).toBeCloseTo(phone.width, 1);
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

test("startup migrates legacy storage and never copies nested secrets into browser history", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("doripe_app_preview_v1", JSON.stringify({
    currentScreenId: "e3",
    history: [{ snapshot: {
      password: "history-password",
      token: "history-token",
      authToken: "history-auth-token",
      id_token: "history-id-token",
      provider_token: "history-provider-token",
      access_token: "history-access",
      tokenCount: 4
    } }],
    form: { nickname: "도리", currentPassword: "old-password" },
    selections: { nested: { refreshTokenBackup: "history-refresh", safe: "keep" } }
  })));
  await page.goto("/app-preview/?screen=e3&static=1");
  const snapshots = await page.evaluate(() => ({
    persisted: localStorage.getItem("doripe_app_preview_v1"),
    history: JSON.stringify(history.state)
  }));
  expect(snapshots.persisted).not.toMatch(/history-(?:password|token|auth-token|id-token|provider-token|access|refresh)/i);
  expect(snapshots.history).not.toMatch(/history-(?:password|token|auth-token|id-token|provider-token|access|refresh)/i);
  expect(JSON.parse(snapshots.persisted).form.nickname).toBe("도리");
  expect(JSON.parse(snapshots.persisted).history[0].snapshot.tokenCount).toBe(4);
});

async function addActionControl(page, { action, id, type = "button" }) {
  await page.locator("[data-screen-id]").evaluate((screen, options) => {
    const control = document.createElement(options.type);
    control.dataset.action = options.action;
    if (options.id) control.dataset.id = options.id;
    control.textContent = options.action;
    screen.append(control);
  }, { action, id, type });
}

test("place detail survives reload and closes to its exact opener", async ({ page }) => {
  await page.goto("/app-preview/?screen=b1&static=1");
  await addActionControl(page, { action: "open-place", id: "place-1" });
  await page.getByRole("button", { name: "open-place" }).evaluate((button) => button.click());
  await expect(page).toHaveURL(/screen=b4/);

  await page.reload();
  const opened = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(opened.currentScreenId).toBe("b4");
  expect(opened.history).toEqual(["b1"]);
  expect(opened.selections.selectedPlaceId).toBe("place-1");

  await addActionControl(page, { action: "close-place" });
  await page.getByRole("button", { name: "close-place" }).evaluate((button) => button.click());
  await expect(page).toHaveURL(/screen=b1/);
  await page.reload();
  const closed = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(closed.currentScreenId).toBe("b1");
  expect(closed.history).toEqual([]);
});

test("profile content survives reload and closes to its exact opener", async ({ page }) => {
  await page.goto("/app-preview/?screen=b12&static=1");
  await addActionControl(page, { action: "open-content", id: "place-4" });
  await page.getByRole("button", { name: "open-content" }).evaluate((button) => button.click());
  await expect(page).toHaveURL(/screen=b4/);

  await page.reload();
  const opened = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(opened.currentScreenId).toBe("b4");
  expect(opened.history).toEqual(["b12"]);
  expect(opened.selections.selectedPlaceId).toBe("place-4");

  await addActionControl(page, { action: "close-place" });
  await page.getByRole("button", { name: "close-place" }).evaluate((button) => button.click());
  await expect(page).toHaveURL(/screen=b12/);
  await page.reload();
  const closed = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(closed.currentScreenId).toBe("b12");
  expect(closed.history).toEqual([]);
});

test("a shared place URL restores the exact place in a fresh browser", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/app-preview/?screen=b10&type=place&id=place-8&static=1`);

  await expect(page.getByRole("button", { name: "장소 공식 화면" })).toHaveText("카페 노티드");
  await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe("place");
  expect(new URL(page.url()).searchParams.get("id")).toBe("place-8");
  await page.reload();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    screen: "b10", type: "place", id: "place-8", static: "1"
  });

  const copiedUrl = page.url();
  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  await recipient.goto(copiedUrl);
  await expect(recipient.getByRole("button", { name: "장소 공식 화면" })).toHaveText("카페 노티드");

  await page.getByRole("button", { name: "A1 / 시작" }).click();
  await expect(page).toHaveURL(/screen=a1/);
  expect(new URL(page.url()).searchParams.has("type")).toBe(false);
  await page.goBack();
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    screen: "b10", type: "place", id: "place-8", static: "1"
  });
  await expect(page.getByRole("button", { name: "장소 공식 화면" })).toHaveText("카페 노티드");
  await page.goForward();
  await expect(page).toHaveURL(/screen=a1/);
  await page.goBack();
  expect(new URL(page.url()).searchParams.get("id")).toBe("place-8");

  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(restored.selections.selectedPlaceId).toBe("place-8");
  await recipientContext.close();
  await context.close();
});

test("a dynamic route URL survives history and reload and its current URL restores in a fresh context", async ({ browser, baseURL }) => {
  const name = `${"한".repeat(29)}🙂`;
  const url = new URL("/app-preview/", baseURL);
  url.searchParams.set("screen", "d9");
  url.searchParams.set("type", "route");
  url.searchParams.set("id", "saved-route-7");
  url.searchParams.set("rn", name);
  url.searchParams.set("rp", "place-10,place-1,place-11");
  url.searchParams.set("static", "1");

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url.href);
  await expect(page.getByRole("heading", { name })).toHaveText(name);
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    screen: "d9",
    type: "route",
    id: "saved-route-7",
    rn: name,
    rp: "place-10,place-1,place-11",
    static: "1"
  });

  await page.reload();
  expect(new URL(page.url()).searchParams.get("rn")).toBe(name);
  expect(new URL(page.url()).searchParams.get("rp")).toBe("place-10,place-1,place-11");
  const copiedUrl = page.url();
  expect(copiedUrl.length).toBeLessThan(600);

  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  await recipient.goto(copiedUrl);
  await expect(recipient.getByRole("heading", { name })).toHaveText(name);
  await expect(recipient.locator(".route-complete-place strong")).toHaveText([
    "포털로빈", "오브젝트 연남", "소이연남"
  ]);
  const recipientState = await recipient.evaluate(() => JSON.parse(localStorage.getItem("doripe_app_preview_v1")));
  expect(Array.from(recipientState.savedRoutes[0].name)).toHaveLength(30);

  await page.getByRole("button", { name: "A1 / 시작" }).click();
  expect(new URL(page.url()).searchParams.has("rn")).toBe(false);
  await page.goBack();
  expect(new URL(page.url()).searchParams.get("rn")).toBe(name);
  expect(new URL(page.url()).searchParams.get("rp")).toBe("place-10,place-1,place-11");
  await page.goForward();
  await expect(page).toHaveURL(/screen=a1/);
  await page.goBack();
  await expect(page.getByRole("heading", { name })).toHaveText(name);

  await recipientContext.close();
  await context.close();
});

test("deep links reject unknown route IDs and unknown snapshot place IDs", async ({ page }) => {
  await page.goto("/app-preview/");
  await page.evaluate(() => {
    const key = "doripe_app_preview_v1";
    const current = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({
      ...current,
      savedRoutes: [{ id: "saved-route-404", name: "로컬 코스", placeIds: ["place-1", "place-8"] }]
    }));
  });
  await page.goto("/app-preview/?screen=d9&type=route&id=saved-route-404&rn=%EC%97%86%EB%8A%94%20%EC%BD%94%EC%8A%A4&rp=place-1,place-404&static=1");

  await expect(page.locator("#phone-root")).toHaveAttribute("data-preview-mode", "review-error");
  await expect(page.getByText("saved-route-404")).toBeVisible();
  await expect(page.getByRole("heading", { name: "연남 저녁 데이트 코스" })).toHaveCount(0);
  const stripped = new URL(page.url()).searchParams;
  for (const key of ["type", "id", "rn", "rp"]) expect(stripped.has(key)).toBe(false);
});

test("shared URL validation rejects oversized and unsafe values before restoration", async ({ page, baseURL }) => {
  const validRoute = {
    screen: "d9",
    type: "route",
    id: "saved-route-7",
    rn: "안전한 코스",
    rp: "place-1,place-2"
  };
  const cases = [
    { ...validRoute, id: `saved-route-${"1".repeat(40)}` },
    { ...validRoute, id: `saved-route-${"1".repeat(10)}` },
    { ...validRoute, rn: "가".repeat(31) },
    { ...validRoute, rn: "x".repeat(361) },
    { ...validRoute, rn: "<img src=x onerror=alert(1)>" },
    { ...validRoute, rp: `place-1,${"x".repeat(260)}` },
    { ...validRoute, rp: Array.from({ length: 11 }, (_, index) => `place-${index + 1}`).join(",") },
    { screen: "b10", type: "place", id: "place-404" }
  ];

  for (const params of cases) {
    const url = new URL("/app-preview/", baseURL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("static", "1");
    await page.goto(url.pathname + url.search);
    await expect(page.locator("#phone-root")).toHaveAttribute("data-preview-mode", "review-error");
    const current = new URL(page.url()).searchParams;
    for (const key of ["type", "id", "rn", "rp"]) expect(current.has(key), `${key} stripped for ${params.id}`).toBe(false);
    await expect(page.locator(".route-complete-title img, .review-error img")).toHaveCount(0);
  }

  const excessiveTokens = `/app-preview/?screen=d9&type=route&id=saved-route-7&rn=${encodeURIComponent("안전한 코스")}&rp=place-1,place-2&static=1${"&x=1".repeat(20)}`;
  await page.goto(excessiveTokens);
  await expect(page.locator("#phone-root")).toHaveAttribute("data-preview-mode", "review-error");
  const current = new URL(page.url()).searchParams;
  for (const key of ["type", "id", "rn", "rp"]) expect(current.has(key)).toBe(false);
});
