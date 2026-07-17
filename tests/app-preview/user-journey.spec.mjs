import { expect, test } from "@playwright/test";

const STORAGE_KEY = "doripe_app_preview_v1";
const LOCAL_REVIEW_ORIGIN = `http://localhost:${process.env.APP_PREVIEW_PORT || 4173}`;

test.use({ viewport: { width: 393, height: 852 } });
test.setTimeout(60_000);

function reviewUrl(screenId) {
  const url = new URL("/app-preview/", LOCAL_REVIEW_ORIGIN);
  url.searchParams.set("screen", screenId);
  url.searchParams.set("static", "1");
  return url.toString();
}

async function savePlaceFromFeed(page, placeId, placeName, { reload = false } = {}) {
  await page.locator(`[data-testid="media-tile"][data-place-id="${placeId}"]`).first().click();
  await expect(page).toHaveURL(/screen=b4/);
  await expect(page.getByRole("button", { name: "장소 공식 화면" })).toHaveText(placeName);
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  if (reload) {
    await page.reload();
    await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  }
  await page.getByRole("button", { name: "장소 상세 닫기" }).click();
  await expect(page).toHaveURL(/screen=b2/);
}

test("a first user can discover, save, build, reopen, share, and leave a course", async ({ browser, page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ url }) => { window.__doripeSharedUrl = url; }
    });
  });
  await page.goto(reviewUrl("a1"));
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();

  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/screen=a3/);
  await page.getByLabel("이메일").fill("dori@doripe.kr");
  await page.getByLabel("비밀번호").fill("Doripe123");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/screen=b1/);
  const selectedFeedTab = page.locator(".discover-tabs .is-selected");
  await expect(selectedFeedTab).toHaveText("팔로잉");
  await expect(page.getByRole("button", { name: "팔로잉 목록 보기" })).toBeVisible();
  await expect(page.locator("[data-testid=discover-feed] [data-testid=media-tile]").first()).toBeVisible();

  await page.getByRole("button", { name: "Discover" }).click();
  await expect(page).toHaveURL(/screen=b2/);
  await expect(selectedFeedTab).toHaveText("Discover");
  await expect(page.getByRole("button", { name: "팔로잉 목록 보기" })).toHaveCount(0);
  await expect(page.locator("[data-testid=discover-feed] [data-testid=media-tile]").first()).toBeVisible();

  await savePlaceFromFeed(page, "place-1", "오브젝트 연남", { reload: true });
  await savePlaceFromFeed(page, "place-10", "포털로빈");
  await savePlaceFromFeed(page, "place-11", "소이연남");

  await page.locator('[data-testid="media-tile"][data-place-id="place-1"]').first().click();
  await page.getByRole("button", { name: "댓글 보기" }).click();
  await page.getByPlaceholder("댓글 추가하기").fill("다음 주말에 다시 가고 싶어요");
  await page.getByRole("button", { name: "댓글 등록" }).click();
  await expect(page.locator("[data-testid=comment-list]")).toContainText("다음 주말에 다시 가고 싶어요");

  await page.getByRole("button", { name: /프로필 보기/ }).first().click();
  await expect(page).toHaveURL(/screen=b12/);
  await page.getByRole("button", { name: "언팔로우" }).click();
  await expect(page.getByRole("button", { name: "팔로우" })).toBeVisible();
  await page.getByRole("button", { name: "팔로우" }).click();
  await expect(page.getByRole("button", { name: "언팔로우" })).toBeVisible();
  await page.getByRole("button", { name: "뒤로 가기" }).click();
  await expect(page).toHaveURL(/screen=b8/);
  await expect(page.locator("[data-testid=comment-list]")).toContainText("다음 주말에 다시 가고 싶어요");
  await page.getByRole("button", { name: "댓글 닫기" }).click();
  await page.getByRole("button", { name: "장소 상세 닫기" }).click();
  await expect(page).toHaveURL(/screen=b2/);

  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page).toHaveURL(/screen=c1/);
  await expect(page.locator(".saved-place-row strong")).toHaveText([
    "오브젝트 연남",
    "포털로빈",
    "소이연남"
  ]);

  await page.getByRole("button", { name: "코스", exact: true }).click();
  await expect(page).toHaveURL(/screen=d3/);
  await page.getByRole("button", { name: "오브젝트 연남에서 시작" }).click();
  await expect(page).toHaveURL(/screen=d4/);
  await page.getByRole("button", { name: "여기서 시작하기" }).click();
  await expect(page).toHaveURL(/screen=d5/);

  await page.getByRole("button", { name: "포털로빈 추가" }).click();
  await page.getByRole("button", { name: "소이연남 추가" }).click();
  await page.getByRole("button", { name: "선택한 장소로 코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d7/);
  await page.getByRole("button", { name: "코스 만들기" }).click();
  await expect(page).toHaveURL(/screen=d8/);

  await page.getByRole("textbox", { name: "코스 이름" }).fill("연남 저녁 산책");
  await page.getByRole("button", { name: "코스 저장하기" }).click();
  await expect(page).toHaveURL(/screen=d9/);
  await expect(page.getByRole("heading", { name: "연남 저녁 산책" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "연남 저녁 산책" })).toBeVisible();

  await page.getByRole("button", { name: "코스 공유" }).click();
  const sharedUrl = await page.evaluate(() => window.__doripeSharedUrl);
  expect(sharedUrl).toContain("type=route");

  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("tab", { name: "코스" }).click();
  await expect(page.getByText("연남 저녁 산책", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "연남 저녁 산책 경로 보기" }).click();
  const map = page.getByRole("dialog", { name: "연남 저녁 산책 경로" });
  await expect(map.locator("[data-route-stop] strong")).toHaveText([
    "오브젝트 연남",
    "포털로빈",
    "소이연남"
  ]);
  await map.getByRole("button", { name: "경로 닫기" }).click();

  const recipientContext = await browser.newContext();
  const recipient = await recipientContext.newPage();
  const recipientUrl = new URL(sharedUrl);
  recipientUrl.protocol = "http:";
  recipientUrl.hostname = "localhost";
  recipientUrl.port = String(process.env.APP_PREVIEW_PORT || 4173);
  recipientUrl.pathname = "/app-preview/";
  recipientUrl.searchParams.set("static", "1");
  await recipient.goto(recipientUrl.toString());
  await expect(recipient.getByRole("heading", { name: "연남 저녁 산책" })).toBeVisible();
  await expect(recipient.locator(".route-complete-place strong")).toHaveText([
    "오브젝트 연남",
    "포털로빈",
    "소이연남"
  ]);
  await recipientContext.close();

  await page.getByRole("button", { name: "MY", exact: true }).click();
  await page.getByRole("button", { name: "계정", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/screen=a3/);
  await page.goBack();
  await expect(page).toHaveURL(/screen=a3/);
});
