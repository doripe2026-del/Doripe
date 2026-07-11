import { existsSync, readFileSync, statSync } from "node:fs";
import { assertProtectedLandingSurface } from "./landing-protected-surface.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredFiles = [
  "public/home/index.html",
  "public/index.html",
  "public/home/landing-motion.css",
  "public/home/landing-motion.js",
  "scripts/serve-landing.mjs",
  "tests/landing-route-contract.test.mjs",
  "tests/landing-route-geometry.browser.mjs",
];

const requiredAssets = [
  "public/img/landing-motion/hero-discover-feed.avif",
  "public/img/landing-motion/c5-route-view.png",
  "public/img/landing-motion/campaign-restaurant.avif",
  "public/img/landing-motion/campaign-cafe.avif",
  "public/img/landing-motion/campaign-activity.avif",
  "public/img/landing-motion/campaign-alley.avif",
  "public/img/landing-motion/profile-friend-01.avif",
  "public/img/landing-motion/profile-friend-02.avif",
  "public/img/landing-motion/profile-curator-01.avif",
  "public/img/landing-motion/profile-curator-02.avif",
];

for (const file of [...requiredFiles, ...requiredAssets]) {
  assert(existsSync(file), `missing ${file}`);
}

const assetBytes = requiredAssets.reduce((total, file) => total + statSync(file).size, 0);
assert(assetBytes < 1_500_000, `new motion assets exceed 1.5MB (${assetBytes} bytes)`);

const home = readFileSync("public/home/index.html", "utf8");
const mirror = readFileSync("public/index.html", "utf8");
const css = readFileSync("public/home/landing-motion.css", "utf8");
const motionJs = readFileSync("public/home/landing-motion.js", "utf8");
const workflow = readFileSync(".github/workflows/build.yml", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert(home === mirror, "public/index.html must mirror public/home/index.html");
assertProtectedLandingSurface(home);
assert(home.includes('/home/landing-motion.css'), "missing motion stylesheet");
assert(home.includes('/home/landing-motion.js'), "missing motion controller");

assert(packageJson.scripts["dev:landing"] === "node scripts/serve-landing.mjs", "landing preview script changed");
assert(packageJson.scripts["test:landing-motion"] === "node --test tests/landing-*.test.mjs", "landing test script changed");
for (const command of ["npm run test:landing-motion", "npm run check:landing-motion"]) {
  assert(workflow.includes(command), `build workflow missing ${command}`);
}

const motionMarkup = home.slice(home.indexOf('id="landingMotionHero"'), home.indexOf("</main>"));
const lowerMotionMarkup = home.slice(home.indexOf('id="motionSceneDiscovery"'), home.indexOf("</main>"));
const imageTags = [...motionMarkup.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
assert(imageTags.length >= 20, "motion scenes do not contain the complete photo set");
for (const tag of imageTags) {
  assert(/src="\/img\/landing-motion\/(?:[^\"]+\.avif|c5-route-view\.png)"/.test(tag), `motion image is not optimized: ${tag}`);
  assert(/decoding="async"/.test(tag), `motion image must decode asynchronously: ${tag}`);
}
for (const tag of lowerMotionMarkup.matchAll(/<img\b[^>]*>/g)) {
  if (/c5-route-view\.png/.test(tag[0])) {
    assert(/loading="eager"[^>]*fetchpriority="high"/.test(tag[0]), `C5 screen must be prioritized: ${tag[0]}`);
    continue;
  }
  assert(/loading="lazy"/.test(tag[0]), `lower motion image must load lazily: ${tag[0]}`);
}
assert(
  /hero-discover-feed\.avif"[^>]*loading="eager"[^>]*fetchpriority="high"/.test(motionMarkup),
  "primary hero screen must be prioritized",
);

for (const sceneId of ["landingMotionHero", "motionSceneDiscovery", "motionSceneNearby", "motionSceneCourse"]) {
  assert(
    new RegExp(`id="${sceneId}"[\\s\\S]{0,220}?data-motion-state="final"`).test(home),
    `${sceneId} must expose a no-JavaScript final state`,
  );
}

for (const marker of [
  'class="hero-feed-screen"',
  'class="hero-photo-expansion',
  'class="discovery-place-photo"',
  'class="photo-engagement"',
  'class="nearby-c5-screen"',
  'class="nearby-place-grid"',
  'class="nearby-course-tray"',
  'class="folder-route-line"',
  'class="day-folder"',
  'class="course-reaction ',
]) {
  assert(home.includes(marker), `motion markup missing ${marker}`);
}

assert((home.match(/data-course-candidate="[123]"/g) ?? []).length === 3, "nearby scene must contain three candidates");
assert((home.match(/class="photo-engagement__item"/g) ?? []).length === 3, "discovery needs three icon counters");
assert((home.match(/class="folder-route-card/g) ?? []).length === 3, "course needs three routed place cards");
assert((home.match(/class="course-reaction /g) ?? []).length === 5, "course needs five scattered reactions");

const discoveryStart = home.indexOf('id="motionSceneDiscovery"');
const discoveryEnd = home.indexOf('<div class="journey-copy', discoveryStart);
const discovery = home.slice(discoveryStart, discoveryEnd);
assert(!discovery.includes("댓글 96") && !discovery.includes("저장 312"), "discovery photo counters must be icon-only");

const courseStart = home.indexOf('id="motionSceneCourse"');
const courseEnd = home.indexOf('<div class="journey-copy', courseStart);
const course = home.slice(courseStart, courseEnd);
assert(!/navigation-handoff|navigation-marker|길찾기/.test(course), "course scene must end with the social folder, not navigation");
assert(!/<(?:a|button|input|select)\b/i.test(course), "motion overlays must remain non-interactive");

assert(css.includes("@media (max-width: 480px)"), "missing mobile motion rules");
assert(css.includes("@media (max-width: 390px)"), "missing narrow-mobile motion rules");
assert(css.includes("@media (prefers-reduced-motion: reduce)"), "missing reduced-motion rules");
assert(!/font-size\s*:[^;}]*(?:vw|vh|vmin|vmax|cqw|cqh)/i.test(css), "motion font sizes must not scale with viewport width");
assert(css.includes("@keyframes folderRouteDraw"), "folder route animation missing");
assert(css.includes("@keyframes folderComplete"), "folder completion animation missing");
assert(css.includes("@keyframes engagementPulse"), "photo engagement animation missing");

assert(motionJs.includes("IntersectionObserver"), "offscreen pause observer missing");
assert(motionJs.includes('applySceneState(scene, "final")'), "motion controller final-state fallback missing");
assert(motionJs.includes("is-media-missing"), "media error fallback missing");
assert(!motionJs.includes("fetch("), "landing motion must not call backend APIs");
assert(!motionJs.includes("/notify"), "landing motion must not control notify navigation");

console.log(`Landing motion checks passed (${requiredAssets.length} assets, ${assetBytes} bytes).`);
