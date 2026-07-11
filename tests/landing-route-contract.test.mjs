import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const home = await readFile(new URL("../public/home/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/home/landing-motion.css", import.meta.url), "utf8");

function scene(id, nextMarker) {
  const start = home.indexOf(`id="${id}"`);
  const end = home.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, `could not isolate ${id}`);
  return home.slice(start, end);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

test("hero uses one complete feed and three expanded photos with social identities", () => {
  const hero = scene("landingMotionHero", "</section>");
  assert.match(hero, /class="hero-feed-screen"/);
  assert.match(hero, /\/img\/figma-ui\/hero-discover-feed\.png/);
  assert.equal(count(hero, /class="hero-photo-expansion/g), 3);
  assert.ok(count(hero, /class="hero-profile-chip/g) >= 3);
  assert.equal(count(hero, /data-profile-kind="friend"/g), 2);
  assert.ok(count(hero, /data-profile-kind="curator"/g) >= 1);
});

test("discovery overlays large icon-only engagement counts on the place photo", () => {
  const discovery = scene("motionSceneDiscovery", '<div class="journey-copy');
  assert.match(discovery, /\/img\/figma-ui\/hero-discover-feed\.png/);
  assert.match(discovery, /class="discovery-place-photo"/);
  assert.equal(count(discovery, /class="discovery-quote/g), 2);
  assert.equal(count(discovery, /class="photo-engagement__item/g), 3);
  assert.match(discovery, /data-engagement="likes"[\s\S]*?>1,284</);
  assert.match(discovery, /data-engagement="comments"[\s\S]*?>96</);
  assert.match(discovery, /data-engagement="saves"[\s\S]*?>312</);
  assert.doesNotMatch(discovery, /Engagement bar|댓글 96|저장 312/);
  assert.match(css, /\.photo-engagement\s*\{[^}]*position:\s*absolute/s);
});

test("nearby uses C5 and exactly three photo candidates", () => {
  const nearby = scene("motionSceneNearby", "</div>\n            </div>\n          </article>");
  assert.match(nearby, /c5-route-view\.png/);
  assert.match(nearby, /c5-route-view\.png[^>]*loading="eager"/);
  assert.equal(count(nearby, /class="nearby-place-card/g), 3);
  assert.equal(count(nearby, /data-course-candidate="[123]"/g), 3);
  assert.equal(count(nearby, /class="nearby-tray__item/g), 3);
  assert.doesNotMatch(nearby, /data-course-candidate="4"/);
});

test("course connects three place cards into a social folder without navigation", () => {
  const course = scene("motionSceneCourse", '<div class="journey-copy');
  assert.equal(count(course, /class="folder-route-card/g), 3);
  assert.match(course, /class="folder-route-line"/);
  assert.equal(count(course, /<path d=/g), 1);
  assert.match(css, /course-map-background\.jpg/);
  assert.match(course, /class="day-folder"/);
  assert.equal(count(course, /class="course-reaction /g), 5);
  for (const reaction of ["saved", "invite", "curator", "likes", "complete"]) {
    assert.match(course, new RegExp(`data-course-reaction="${reaction}"`));
  }
  assert.match(course, /여기 저장했어요/);
  assert.match(course, /다음 주에 같이 가자!/);
  assert.match(course, /이 코스 진짜 좋아요/);
  assert.match(course, /코스 저장 완료/);
  assert.doesNotMatch(course, /navigation-handoff|navigation-marker|길찾기/);
});

test("all motion photos are optimized and responsive rules are present", () => {
  const motion = home.slice(home.indexOf('id="landingMotionHero"'), home.indexOf("</main>"));
  for (const tag of motion.matchAll(/<img\b[^>]*>/g)) {
    assert.match(tag[0], /src="(?:\/img\/landing-motion\/(?:[^\"]+\.avif|c5-route-view\.png)|\/img\/figma-ui\/hero-discover-feed\.png)"/);
    assert.match(tag[0], /decoding="async"/);
  }
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /font-size\s*:[^;}]*(?:vw|vh|vmin|vmax|cqw|cqh)/i);
});

test("nested discovery and save animations inherit the scene playback clock", () => {
  for (const selector of ["photo-engagement__item", "nearby-place-card"]) {
    assert.match(css, new RegExp(`\\.${selector}\\s*\\{[^}]*animation-play-state:\\s*inherit`, "s"));
  }
  assert.doesNotMatch(css, /\.folder-route-card--(?:two|three)\s*\{[^}]*animation-delay/s);
});
