import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cssBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert(markerIndex >= 0, `missing CSS marker ${marker}`);
  const openIndex = source.indexOf("{", markerIndex);
  assert(openIndex >= 0, `missing CSS block for ${marker}`);

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] !== "}") continue;
    depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }

  throw new Error(`unclosed CSS block for ${marker}`);
}

const required = [
  "public/home/landing-motion.css",
  "public/home/landing-motion.js",
  "public/home/index.html",
  "public/index.html",
];

for (const file of required) assert(existsSync(file), `missing ${file}`);

const home = readFileSync("public/home/index.html", "utf8");
const mirror = readFileSync("public/index.html", "utf8");
const motionCss = readFileSync("public/home/landing-motion.css", "utf8");
assert(home === mirror, "public/index.html must mirror public/home/index.html");
assert(home.includes('/home/landing-motion.css'), "missing motion stylesheet link");
assert(home.includes('/home/landing-motion.js'), "missing motion module link");
assert(home.includes('href="/notify"'), "notification CTA must remain linked to /notify");
assert(home.includes("오늘 어디 갈지,"), "hero copy changed unexpectedly");
assert(home.includes("검색어 대신 분위기로 찾아요."), "Discover copy changed unexpectedly");
assert(home.includes("나중에 다시 찾기 쉬운 방식으로 저장해요."), "Save copy changed unexpectedly");
assert(home.includes("나만의 코스를 만들고, 떠나보세요."), "Go copy changed unexpectedly");

for (const marker of [
  'id="landingMotionHero"',
  'data-motion-layer="ugc"',
  'data-motion-layer="selection"',
  'data-motion-layer="nearby"',
  'data-motion-layer="course"',
  'data-motion-layer="share"',
  'data-motion-layer="navigation"',
]) {
  assert(home.includes(marker), `hero motion missing ${marker}`);
}

for (const marker of [
  'id="motionSceneDiscovery"',
  'data-motion-layer="creator-posts"',
  'data-motion-layer="creator-reaction"',
  'data-motion-layer="place-selection"',
]) {
  assert(home.includes(marker), `discovery scene missing ${marker}`);
}
assert(
  /<div class="journey-visual">\s*<div\s+id="motionSceneDiscovery"/.test(home),
  "discovery scene must be visible without reveal JavaScript",
);

for (const marker of [
  'id="motionSceneNearby"',
  'data-motion-layer="anchor-place"',
  'data-motion-layer="nearby-candidates"',
  'data-motion-layer="course-tray"',
]) {
  assert(home.includes(marker), `nearby scene missing ${marker}`);
}
assert(
  /<div class="journey-visual">\s*<div\s+id="motionSceneNearby"/.test(home),
  "nearby scene must be visible without reveal JavaScript",
);

for (const [selector, opacity] of [
  ['.landing-motion.landing-motion--nearby[data-motion-state="final"] .anchor-place', "1"],
  ['.landing-motion.landing-motion--nearby[data-motion-state="final"] .nearby-candidates span', "0"],
  ['.landing-motion.landing-motion--nearby[data-motion-state="final"] .nearby-candidates .is-selected', "1"],
  ['.landing-motion.landing-motion--nearby[data-motion-state="final"] .course-tray', "1"],
]) {
  const block = cssBlock(motionCss, selector);
  assert(
    new RegExp(`opacity:\\s*${opacity}(?:\\s*;|\\s*$)`).test(block),
    `nearby final composition requires ${selector} opacity ${opacity}`,
  );
}

for (const stop of ["1", "2", "3"]) {
  assert(home.includes(`data-course-stop="${stop}"`), `nearby course tray missing stop ${stop}`);
}

for (const [selector, opacity] of [
  ['.landing-motion.landing-motion--discovery[data-motion-state="final"] .discovery-ui', "1"],
  ['.landing-motion.landing-motion--discovery[data-motion-state="final"] .creator-reaction', "0"],
  ['.landing-motion.landing-motion--discovery[data-motion-state="final"] .video-indicator', "0"],
  ['.landing-motion.landing-motion--discovery[data-motion-state="final"] .place-selection', "1"],
]) {
  const block = cssBlock(motionCss, selector);
  assert(
    new RegExp(`opacity:\\s*${opacity}(?:\\s*;|\\s*$)`).test(block),
    `discovery final composition requires ${selector} opacity ${opacity}`,
  );
}

const creatorProfile = cssBlock(motionCss, ".creator-reaction img");
assert(
  /border-radius:\s*50%\s*;/.test(creatorProfile),
  "discovery creator profile must remain circular",
);

const mobileMotion = cssBlock(motionCss, "@media (max-width: 480px)");
const mobileVideo = cssBlock(mobileMotion, ".landing-motion--discovery .video-indicator");
assert(
  /display:\s*none\s*;/.test(mobileVideo),
  "320px discovery must hide the secondary video overlay",
);
const mobileNearbyAnchor = cssBlock(mobileMotion, ".landing-motion--nearby .anchor-place");
assert(
  /inset:\s*8% 14% 29%\s*;/.test(mobileNearbyAnchor),
  "320px nearby scene must preserve a large anchor place",
);
const mobileNearbyCandidates = cssBlock(
  mobileMotion,
  ".landing-motion--nearby .nearby-candidates span:nth-child(n+3)",
);
assert(
  /display:\s*none\s*;/.test(mobileNearbyCandidates),
  "320px nearby scene must simplify the candidate count",
);

const discoveryKeyframes = Object.fromEntries(
  ["discoveryFeed", "discoveryReaction", "discoveryVideo", "discoverySelect"].map((name) => [
    name,
    cssBlock(motionCss, `@keyframes ${name}`),
  ]),
);
for (const [name, block] of Object.entries(discoveryKeyframes)) {
  const properties = [...block.matchAll(/([a-z][a-z-]*)\s*:/g)].map((match) => match[1]);
  assert(
    properties.every((property) => property === "opacity" || property === "transform"),
    `${name} may animate only transform and opacity`,
  );
}

const nearbyKeyframes = Object.fromEntries(
  ["anchorFocus", "candidateReveal", "courseTray"].map((name) => [
    name,
    cssBlock(motionCss, `@keyframes ${name}`),
  ]),
);
for (const [name, block] of Object.entries(nearbyKeyframes)) {
  const properties = [...block.matchAll(/([a-z][a-z-]*)\s*:/g)].map((match) => match[1]);
  assert(
    properties.every((property) => property === "opacity" || property === "transform"),
    `${name} may animate only transform and opacity`,
  );
}

assert(
  /32%,\s*100%\s*\{[^}]*opacity:\s*0/.test(discoveryKeyframes.discoveryReaction),
  "discovery reaction must finish before the video stage",
);
assert(
  /0%,\s*34%\s*\{[^}]*opacity:\s*0/.test(discoveryKeyframes.discoveryVideo)
    && /60%,\s*100%\s*\{[^}]*opacity:\s*0/.test(discoveryKeyframes.discoveryVideo),
  "discovery video must occupy only the middle stage",
);
assert(
  /0%,\s*62%\s*\{[^}]*opacity:\s*0/.test(discoveryKeyframes.discoverySelect)
    && /78%,\s*100%\s*\{[^}]*opacity:\s*1/.test(discoveryKeyframes.discoverySelect),
  "discovery timeline must end on selection",
);
assert(!home.includes('class="phone-stage reveal"'), "legacy hero orbit still present");
assert(
  !home.includes('class="landing-motion landing-motion--hero reveal"'),
  "hero motion must be visible without reveal JavaScript",
);
assert(
  /@media \(max-width: 480px\)[\s\S]*?\.motion-ugc-card--two\s*\{\s*display:\s*none;/.test(motionCss),
  "320px motion must hide the secondary UGC card",
);
assert(
  /@media \(max-width: 480px\)[\s\S]*?\.motion-nearby-card:nth-child\(n\+2\)\s*\{\s*display:\s*none;/.test(motionCss),
  "320px motion must hide nonessential nearby cards",
);
assert(
  /@media \(max-width: 480px\)[\s\S]*?\.motion-selected-place\s*\{\s*inset:\s*9% 16% 9% 30%;/.test(motionCss),
  "320px motion must enlarge the selected place UI",
);
assert(
  /\.motion-ugc-card\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/.test(motionCss),
  "UGC cards must reserve a visible caption row",
);
for (const legacySelector of [
  ".phone-stage {",
  ".phone-stage::before",
  ".orbit {",
  ".iphone {",
  ".iphone::before",
  ".iphone::after",
  ".screen {",
  ".screen img",
  ".phone-shadow {",
  "@keyframes counterOrbit",
]) {
  assert(!home.includes(legacySelector), `legacy hero CSS remains: ${legacySelector}`);
}

console.log("Landing motion contracts passed.");
