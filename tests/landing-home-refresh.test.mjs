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
  assert.match(home, /뭐라고 검색해야 할지 모르겠어요/);
  assert.match(home, /저장한 곳은 많은데 오늘 갈 곳은 못 고르겠어요/);
  assert.match(home, /마음에 든 장소들을 하루 코스로 잇기 어려워요/);
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
