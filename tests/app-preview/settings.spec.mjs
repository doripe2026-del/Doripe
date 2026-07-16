import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";
const AUTH_SESSION_STORAGE_KEY = "doripe.app_preview.auth.session.v1";
const TEST_SUPABASE_URL = "https://demo-project.supabase.co";
const TEST_PUBLISHABLE_KEY = "sb_publishable_doripe_test_key_1234567890";

test.use({ viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/app-preview/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
});

async function mockLogout(page, onRequest = () => {}) {
  await page.route("**/api/app-auth-config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ supabaseUrl: TEST_SUPABASE_URL, supabaseKey: TEST_PUBLISHABLE_KEY })
  }));
  await page.route(`${TEST_SUPABASE_URL}/auth/v1/logout?scope=local`, async (route) => {
    onRequest(route.request());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function storeAuthSession(page) {
  await page.evaluate((key) => sessionStorage.setItem(key, JSON.stringify({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 60_000
  })), AUTH_SESSION_STORAGE_KEY);
}

const reviewUrl = (screenId) => `/app-preview/?screen=${screenId}&static=1`;

test("MY renderers select the supplied profile and only its media and courses", async ({ page }) => {
  const rendered = await page.evaluate(async () => {
    const { normalizeDataSnapshot } = await import("/app-preview/data/contracts.js");
    const { SETTINGS_RENDERERS } = await import("/app-preview/screens/settings.js");
    const data = normalizeDataSnapshot({
      viewerProfileId: "profile-selected",
      profiles: [
        { id: "profile-other", name: "다른 사용자", handle: "다른사용자", bio: "다른 소개", avatarUrl: "/app-preview/assets/discover/avatar-1.png" },
        { id: "profile-selected", name: "주입 MY 사용자", handle: "주입MY", bio: "주입 MY 소개", avatarUrl: "/app-preview/assets/discover/avatar-2.png" }
      ],
      media: [
        { id: "media-other", userId: "profile-other", src: "/app-preview/assets/discover/feed-1.png", alt: "다른 사진", kind: "image" },
        { id: "media-selected", userId: "profile-selected", src: "/app-preview/assets/discover/feed-2.png", alt: "주입 MY 사진", kind: "image" }
      ],
      courses: [
        { id: "course-other", userId: "profile-other", name: "다른 루트", placeIds: [], walkingMinutes: 1 },
        { id: "course-selected", userId: "profile-selected", name: "주입 MY 루트", placeIds: [], walkingMinutes: 2 }
      ]
    });
    const state = { selections: {} };
    const emptyData = normalizeDataSnapshot({ viewerProfileId: "profile-selected", profiles: [data.profiles[1]], media: [], courses: [] });
    const mediaScreen = SETTINGS_RENDERERS.e2(state, data);
    const foreignSelection = SETTINGS_RENDERERS.e2({
      ...state,
      overlays: ["media-editor"],
      selections: { selectedMediaId: "media-other" }
    }, data);
    const emptyForeignSelection = SETTINGS_RENDERERS.e2({
      ...state,
      overlays: ["media-editor"],
      selections: { selectedMediaId: "media-other" }
    }, normalizeDataSnapshot({ viewerProfileId: "profile-selected", profiles: data.profiles, media: [data.media[0]], courses: [] }));
    return {
      hub: SETTINGS_RENDERERS.e1(state, data).textContent,
      mediaAlts: [...mediaScreen.querySelectorAll(".settings-profile-media > img")].map((image) => image.alt),
      editorAlt: foreignSelection.querySelector(".settings-media-editor img")?.alt,
      emptyEditorText: emptyForeignSelection.querySelector(".settings-media-editor")?.textContent,
      emptyEditorImageCount: emptyForeignSelection.querySelectorAll(".settings-media-editor img").length,
      routes: SETTINGS_RENDERERS.e2({ ...state, selections: { profileTab: "routes" } }, data).textContent,
      empty: SETTINGS_RENDERERS.e2(state, emptyData).textContent
    };
  });

  expect(rendered.hub).toContain("주입MY");
  expect(rendered.mediaAlts).toEqual(["주입 MY 사진"]);
  expect(rendered.editorAlt).toBe("주입 MY 사진");
  expect(rendered.emptyEditorText).toContain("편집할 사진이 없어요");
  expect(rendered.emptyEditorImageCount).toBe(0);
  expect(rendered.routes).toContain("주입 MY 코스");
  expect(rendered.routes).not.toContain("다른 코스");
  expect(rendered.empty).toContain("아직 올린 사진이 없어요");
});

test("all MY screens are semantic and the settings hub has no dead-end rows", async ({ page }) => {
  await page.goto(reviewUrl("e1"));
  for (const screenId of ["e1", "e2", "e3", "e4", "e5"]) {
    await page.goto(reviewUrl(screenId));
    await expect(page.locator(`[data-screen-id="${screenId}"]`)).toHaveAttribute("data-render-mode", "semantic");
  }

  await page.goto(reviewUrl("e1"));
  await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
  for (const [name, target] of [["계정", "e3"], ["알림", "e4"], ["문의", "e5"]]) {
    await page.goto(reviewUrl("e1"));
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`screen=${target}`));
  }
});

test("visible entry screens share four navigation-only tab destinations", async ({ page }) => {
  for (const screenId of ["b1", "b2", "c1", "c2", "d3", "d7", "d8", "d9", "e1"]) {
    await page.goto(reviewUrl(screenId));
    const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(navigation, `${screenId} navigation`).toBeVisible();
    await expect(navigation.getByRole("button")).toHaveCount(4);
    for (const [label, destination] of [["발견", "b2"], ["저장", "c1"], ["코스", "d3"], ["MY", "e1"]]) {
      const tab = navigation.getByRole("button", { name: label, exact: true });
      await expect(tab).not.toHaveAttribute("data-action");
      await expect(tab).toHaveAttribute("data-nav-target", destination);
    }
  }
});

test("MY exposes separate public-profile and edit-profile controls", async ({ page }) => {
  await page.goto(reviewUrl("e1"));
  await page.getByRole("button", { name: /프로필 보기/ }).click();
  await expect(page).toHaveURL(/screen=b12/);

  await page.goto(reviewUrl("e1"));
  await page.getByRole("button", { name: "프로필 수정", exact: true }).click();
  await expect(page).toHaveURL(/screen=e2/);
});

test("profile edits and tabs persist before returning to MY", async ({ page }) => {
  await page.goto(reviewUrl("e2"));
  await page.getByLabel("닉네임").fill("도리테스터");
  await page.getByLabel("소개").fill("연남의 좋은 장소를 모아요");
  await page.getByRole("tab", { name: "코스" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("연남 저녁 데이트");
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page).toHaveURL(/screen=e1/);

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.profile).toEqual({ id: "user-1", nickname: "도리테스터", bio: "연남의 좋은 장소를 모아요" });
  expect(state.profileDraft).toBeUndefined();
});

test("offline account and contact actions give honest preview feedback", async ({ page }) => {
  await page.goto(reviewUrl("e3"));
  await page.getByLabel("현재 비밀번호").fill("DefinitelyWrong123");
  await page.getByLabel("새 비밀번호", { exact: true }).fill("Newpass123");
  await page.getByLabel("새 비밀번호 확인").fill("Newpass123");
  await page.getByRole("button", { name: "비밀번호 저장" }).click();
  await expect(page.getByRole("status")).toContainText("현재 비밀번호가 일치하지 않아요");

  await page.getByLabel("현재 비밀번호").fill("Doripe123");
  await page.getByLabel("새 비밀번호", { exact: true }).fill("Newpass123");
  await page.getByLabel("새 비밀번호 확인").fill("mismatch123");
  await page.getByRole("button", { name: "비밀번호 저장" }).click();
  await expect(page.getByRole("status")).toContainText("새 비밀번호가 서로 일치하지 않아요");
  await expect(page.getByLabel("현재 비밀번호")).toHaveValue("");
  await expect(page.getByLabel("새 비밀번호", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("새 비밀번호 확인")).toHaveValue("");
  let stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(JSON.stringify(stored)).not.toContain("Doripe123");
  expect(JSON.stringify(stored)).not.toContain("Newpass123");

  await page.getByRole("button", { name: "회원 탈퇴" }).click();
  await expect(page).toHaveURL(/screen=e3/);
  await expect(page.getByRole("status")).toContainText("미리보기에서는 회원 탈퇴를 처리할 수 없어요");

  await page.goto(reviewUrl("e4"));
  const master = page.getByRole("switch", { name: "전체 알림" });
  const switches = page.getByRole("switch");
  await expect(switches.nth(0)).not.toBeChecked();
  for (const index of [1, 2]) await expect(switches.nth(index)).toBeChecked();
  for (const index of [3, 4]) await expect(switches.nth(index)).not.toBeChecked();
  await master.click();
  for (const toggle of await page.getByRole("switch").all()) await expect(toggle).toBeChecked();
  await master.click();
  for (const toggle of await page.getByRole("switch").all()) await expect(toggle).not.toBeChecked();

  await page.reload();
  const savedReminder = page.getByRole("switch", { name: "저장한 장소 리마인드" });
  await expect(savedReminder).not.toBeChecked();
  await savedReminder.click();
  await expect(savedReminder).toBeChecked();
  await expect(page.getByRole("switch", { name: "전체 알림" })).not.toBeChecked();

  await page.goto(reviewUrl("e5"));
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByRole("status")).toContainText("문의 내용을 입력");
  await page.getByLabel("문의 내용").fill("저장한 장소가 보이지 않아요.");
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByRole("status")).toContainText("미리보기에서는 문의를 전송할 수 없어요");
});

test("logout clears session-like and password data before returning to login", async ({ page }) => {
  let authorization = null;
  await mockLogout(page, (request) => { authorization = request.headers().authorization; });
  await storeAuthSession(page);
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({
    currentScreenId: "e3",
    history: ["e1"],
    form: { email: "dori@doripe.kr", password: "secret", currentPassword: "old", nickname: "도리" },
    selections: { session: { userId: "user-1" }, authenticated: true }
  })), STORAGE_KEY);
  await page.goto("/app-preview/?screen=e3");
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/screen=a3/);
  await expect.poll(() => authorization).toBe("Bearer access-token");

  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.form.nickname).toBe("도리");
  expect(JSON.stringify(stored)).not.toContain("secret");
  expect(stored.selections.session).toBeUndefined();
  expect(stored.selections.authenticated).toBeUndefined();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_SESSION_STORAGE_KEY)).toBeNull();
});

test("logout cannot be undone by browser history or reload", async ({ page }) => {
  await mockLogout(page);
  await storeAuthSession(page);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    currentScreenId: "e1",
    history: ["b2"],
    form: { password: "history-secret", nickname: "도리" },
    selections: { authenticated: true, session: { userId: "user-1" } }
  })), STORAGE_KEY);
  await page.goto("/app-preview/?screen=e1");
  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/screen=a3/);

  await page.goBack();
  await expect(page).toHaveURL(/screen=a3/);
  await expect(page.locator('[data-screen-id="a3"]')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/screen=a3/);
  await page.reload();
  await expect(page).toHaveURL(/screen=a3/);

  const snapshots = await page.evaluate((key) => ({
    storage: localStorage.getItem(key),
    history: JSON.stringify(history.state)
  }), STORAGE_KEY);
  expect(snapshots.storage).not.toContain("history-secret");
  expect(snapshots.history).not.toContain("history-secret");
});

test("logout network failure still completes locally and cannot restore authenticated history", async ({ page }) => {
  await page.route("**/api/app-auth-config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ supabaseUrl: TEST_SUPABASE_URL, supabaseKey: TEST_PUBLISHABLE_KEY })
  }));
  await page.route(`${TEST_SUPABASE_URL}/auth/v1/logout?scope=local`, (route) => route.abort("failed"));
  await storeAuthSession(page);
  await page.goto("/app-preview/?screen=e3");

  await page.getByRole("button", { name: "로그아웃" }).click();

  await expect(page).toHaveURL(/screen=a3/);
  await expect(page.getByRole("status")).toContainText("로그아웃");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_SESSION_STORAGE_KEY)).toBeNull();
  await page.goBack();
  await expect(page).toHaveURL(/screen=a(?:1|3)/);
  await expect(page.locator('[data-screen-id="e3"]')).toHaveCount(0);
});

test("logout clears local state and history before the remote request settles", async ({ page }) => {
  let releaseRemote;
  const remoteReleased = new Promise((resolve) => { releaseRemote = resolve; });
  await page.route("**/api/app-auth-config", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ supabaseUrl: TEST_SUPABASE_URL, supabaseKey: TEST_PUBLISHABLE_KEY })
  }));
  await page.route(`${TEST_SUPABASE_URL}/auth/v1/logout?scope=local`, async (route) => {
    await remoteReleased;
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await storeAuthSession(page);
  await page.goto("/app-preview/?screen=e3");
  await page.getByRole("button", { name: "로그아웃" }).click({ noWaitAfter: true });

  await expect(page).toHaveURL(/screen=a3/, { timeout: 500 });
  expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_SESSION_STORAGE_KEY)).toBeNull();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(state.history).toEqual([]);
  releaseRemote();
});

test("profile draft is discarded on back and committed only on save", async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    currentScreenId: "e1",
    history: [],
    profile: { nickname: "기존도리", bio: "기존 소개" }
  })), STORAGE_KEY);
  await page.goto(reviewUrl("e1"));
  const edit = page.getByRole("button", { name: "프로필 수정", exact: true });
  await expect(edit).toHaveClass(/settings-profile-edit-entry/);
  await expect(edit).not.toHaveClass(/settings-profile-edit(?:\s|$)/);
  const editBox = await edit.boundingBox();
  expect(editBox.width).toBeGreaterThanOrEqual(44);
  expect(editBox.height).toBeGreaterThanOrEqual(44);
  await expect(edit).toHaveCSS("white-space", "nowrap");
  expect(await edit.evaluate((button) => button.scrollHeight <= button.clientHeight)).toBe(true);

  await edit.click();
  await page.getByLabel("닉네임").fill("취향도리");
  await page.getByLabel("소개").fill("성수와 연남을 기록해요");
  let stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.profile).toEqual({ nickname: "기존도리", bio: "기존 소개" });
  expect(stored.profileDraft).toEqual({ id: "user-1", nickname: "취향도리", bio: "성수와 연남을 기록해요" });

  await page.getByRole("button", { name: "뒤로 가기" }).click();
  await expect(page.getByText("기존도리", { exact: true })).toBeVisible();
  stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  expect(stored.profileDraft).toBeUndefined();

  await page.getByRole("button", { name: "프로필 수정", exact: true }).click();
  await page.getByLabel("닉네임").fill("취향도리");
  await page.getByLabel("소개").fill("성수와 연남을 기록해요");
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByText("취향도리", { exact: true })).toBeVisible();
  await expect(page.getByText("성수와 연남을 기록해요", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /프로필 보기/ }).click();
  await expect(page.locator('[data-screen-id="b12"]')).toContainText("취향도리");
  await expect(page.locator('[data-screen-id="b12"]')).toContainText("성수와 연남을 기록해요");
});
