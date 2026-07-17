import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const home = await readFile(new URL("../public/home/index.html", import.meta.url), "utf8");
const motionCss = await readFile(new URL("../public/home/landing-motion.css", import.meta.url), "utf8");

function count(pattern) {
  return [...home.matchAll(pattern)].length;
}

test("home SEO uses the production domain and current product promise", () => {
  assert.doesNotMatch(home, /doripe\.vercel\.app/);
  assert.match(home, /<link rel="canonical" href="https:\/\/doripe\.kr\/"/);
  assert.match(home, /사진에서 장소를 발견하고, 가까운 장소를 이어 오늘의 코스를/);
});

test("home removes fabricated signup counts while preserving the approved survey proof", () => {
  assert.match(home, />\s*92\.1%\s*</);
  assert.doesNotMatch(home, /signupCount|fallback-count|\/api\/count|명이 Doripe를 먼저 확인했어요/);
});

test("home tells the inspire, explore, share story with three concise pains", () => {
  for (const label of ["INSPIRE", "EXPLORE", "SHARE"]) {
    assert.match(home, new RegExp(`>${label}<`));
  }
  assert.equal(count(/class="chat-bubble /g), 3);
  assert.match(home, /글보다 사진과 영상으로 분위기를 먼저 보고 싶어요/);
  assert.match(home, /밥 먹고 갈 카페와 놀 거리도 따로 찾아야 해요/);
  assert.match(home, /큐레이터가 고른 장소와 하루 코스를 따라가고 싶어요/);
});

test("home uses local compiled styles and optimized loading priorities", () => {
  assert.doesNotMatch(home, /cdn\.tailwindcss\.com|tailwind\.config/);
  assert.match(home, /<link rel="stylesheet" href="\/home\/home\.css"/);
  assert.match(home, /hero-discover-feed\.avif[^>]*loading="eager"[^>]*fetchpriority="high"/);
  assert.match(home, /c5-route-view\.avif[^>]*loading="lazy"/);
  assert.doesNotMatch(home, /c5-route-view\.avif[^>]*fetchpriority="high"/);
});

test("every home notify CTA has a distinct analytics location", () => {
  assert.equal(count(/data-cta-location="(?:header|hero|final|mobile)"/g), 4);
  assert.match(home, /type:\s*'cta_click'/);
  assert.match(home, /ctaLocation/);
});

test("mobile CTA visibility is driven by hero and final CTA visibility", () => {
  assert.match(home, /id="heroSection"/);
  assert.match(home, /id="finalCtaSection"/);
  assert.doesNotMatch(home, /getElementById\('business'\)/);
  assert.match(home, /mobileNotifyBar\.classList\.toggle\('is-hidden'/);
});

test("green is primary while motion completion holds for a readable beat", () => {
  assert.match(home, /--primary:\s*#0[0-9a-f]{5}/i);
  assert.doesNotMatch(home, /--primary:\s*#0084ff/i);
  assert.match(motionCss, /--scene-duration:\s*(?:8|9|10)(?:\.\d+)?s/);
});
