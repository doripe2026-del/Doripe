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
const motionJs = readFileSync("public/home/landing-motion.js", "utf8");
assert(home === mirror, "public/index.html must mirror public/home/index.html");
assert(home.includes('/home/landing-motion.css'), "missing motion stylesheet link");
assert(home.includes('/home/landing-motion.js'), "missing motion module link");
const noJsFallback = home.match(
  /<noscript\s+data-landing-no-js>\s*<style>([\s\S]*?)<\/style>\s*<\/noscript>/,
)?.[1];
assert(noJsFallback, "landing must include a static no-JS fallback shell");
assert(
  /\.reveal\s*\{[^}]*opacity:\s*1[^}]*transform:\s*none/.test(noJsFallback),
  "no-JS fallback must reveal content without the landing controller",
);
assert(
  /header\s+\.liquid-nav[^}]*display:\s*flex/.test(noJsFallback)
    && /header\s+\.liquid-nav\s+img[^}]*width:\s*36px/.test(noJsFallback),
  "no-JS fallback must keep the navigation and logo bounded",
);
assert(
  /main#home[^}]*max-width:\s*1600px/.test(noJsFallback)
    && /main#home\s*>\s*section:first-child[^}]*display:\s*grid/.test(noJsFallback),
  "no-JS fallback must preserve the hero layout",
);
assert(
  /#mobileNotifyBar[^}]*display:\s*none/.test(noJsFallback),
  "no-JS fallback must avoid a duplicate permanent mobile CTA",
);
assert(home.includes('href="/notify"'), "notification CTA must remain linked to /notify");
assert(home.includes("오늘 어디 갈지,"), "hero copy changed unexpectedly");
assert(home.includes("검색어 대신 분위기로 찾아요."), "Discover copy changed unexpectedly");
assert(home.includes("나중에 다시 찾기 쉬운 방식으로 저장해요."), "Save copy changed unexpectedly");
assert(home.includes("나만의 코스를 만들고, 떠나보세요."), "Go copy changed unexpectedly");

for (const sceneId of [
  "landingMotionHero",
  "motionSceneDiscovery",
  "motionSceneNearby",
  "motionSceneCourse",
]) {
  assert(
    new RegExp(`id="${sceneId}"[\\s\\S]{0,220}?data-motion-state="final"`).test(home),
    `${sceneId} must expose its final composition without JavaScript`,
  );
}

assert(motionCss.includes("prefers-reduced-motion: reduce"), "missing reduced-motion CSS");
assert(motionCss.includes("@media (max-width: 390px)"), "missing narrow-mobile rules");
assert(
  motionCss.lastIndexOf("@media (prefers-reduced-motion: reduce)")
    > motionCss.lastIndexOf("will-change: transform, opacity"),
  "reduced-motion will-change override must follow all scene declarations",
);
assert(motionJs.includes("IntersectionObserver"), "offscreen pause observer missing");
assert(motionJs.includes("is-media-missing"), "media failure fallback missing");
assert(
  /removeEventListener\("error",\s*handleError\)/.test(motionJs),
  "media failure listeners must be removed during cleanup",
);
assert(
  /removeEventListener\?\.\("change",\s*updateAll\)/.test(motionJs)
    && motionJs.includes("observer.disconnect()"),
  "motion controller cleanup must remove media listeners and disconnect observation",
);
assert(!motionJs.includes("fetch("), "landing motion must not call backend APIs");
assert(!motionJs.includes("/notify"), "landing motion must not control notify navigation");

const fallbackShell = cssBlock(motionCss, ".landing-motion .is-media-missing");
assert(/background:\s*#edf1ef\s*;/.test(fallbackShell), "missing neutral media fallback shell");
const fallbackImage = cssBlock(motionCss, ".landing-motion .is-media-missing__image");
assert(
  /visibility:\s*hidden\s*;/.test(fallbackImage),
  "failed images must keep their reserved dimensions",
);
const heroUgcKeyframes = cssBlock(motionCss, "@keyframes heroUgc");
assert(
  /translateX\(-8px\)/.test(heroUgcKeyframes),
  "narrow-screen UGC entrance must remain inside the scene gutter",
);
assert(
  !/font-size\s*:[^;}]*(?:vw|vh|vmin|vmax|cqw|cqh)/i.test(motionCss),
  "landing motion font sizes must not scale with the viewport",
);

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

for (const marker of [
  'id="motionSceneCourse"',
  'data-motion-layer="route-places"',
  'data-motion-layer="route-line"',
  'data-motion-layer="share-card"',
  'data-motion-layer="recipient"',
  'data-motion-layer="navigation-handoff"',
]) {
  assert(home.includes(marker), `course scene missing ${marker}`);
}
assert(
  /<div class="journey-visual">\s*<div\s+id="motionSceneCourse"/.test(home),
  "course scene must be visible without reveal JavaScript",
);

const courseSceneStart = home.indexOf('id="motionSceneCourse"');
const courseSceneEnd = home.indexOf('<div class="journey-copy reveal">', courseSceneStart);
assert(courseSceneStart >= 0 && courseSceneEnd > courseSceneStart, "could not isolate course scene");
const courseScene = home.slice(courseSceneStart, courseSceneEnd);
assert(
  /data-motion-state="final"/.test(courseScene),
  "course no-JS state must start on the final composition",
);
assert(
  !/<(?:a|button|input|select)\b/i.test(courseScene)
    && !/role="(?:button|tab|switch)"/i.test(courseScene),
  "course advertising overlays must remain non-interactive markup",
);

const orderedCoursePlaces = [...courseScene.matchAll(/data-course-place="([123])"/g)]
  .map((match) => match[1]);
assert(
  orderedCoursePlaces.join("") === "123",
  "course scene must contain exactly three places in route order",
);
assert(
  /<svg[^>]*data-motion-layer="route-line"[^>]*viewBox="0 0 320 420"[^>]*width="320"[^>]*height="420"/.test(courseScene),
  "course route SVG must have a stable 320 by 420 coordinate system",
);
assert(
  /<img[^>]+(?:discover\.png|discover-photo-next\.png|route-plan-generated\.png)/.test(courseScene),
  "course scene must use current Figma-derived place assets",
);
assert(
  /creator-photos\/creator-04\.png/.test(courseScene),
  "course recipient must use the existing creator profile",
);

const courseRouteBox = cssBlock(motionCss, ".landing-motion--course .route-places,");
assert(
  /width:\s*min\(78%,\s*320px\)\s*;/.test(courseRouteBox)
    && /aspect-ratio:\s*320\s*\/\s*420\s*;/.test(courseRouteBox)
    && /overflow:\s*visible\s*;/.test(courseRouteBox),
  "course route layers must keep stable dimensions without clipping",
);
const coursePlaceImage = cssBlock(motionCss, ".route-place-card img");
assert(
  /width:\s*126px\s*;/.test(coursePlaceImage)
    && /height:\s*61px\s*;/.test(coursePlaceImage),
  "course place images must reserve stable dimensions",
);
for (const selector of [".route-place-card", ".route-pin"]) {
  const block = cssBlock(motionCss, selector);
  assert(
    /animation-delay:\s*calc\(var\(--place-order\)\s*\*\s*\.16s\)\s*;/.test(block),
    `${selector} must keep the ordered 160ms stagger`,
  );
  assert(
    /animation-fill-mode:\s*(?:backwards|both)\s*;/.test(block),
    `${selector} must apply its hidden first frame during positive delays`,
  );
}

for (const [selector, opacity] of [
  ['.landing-motion.landing-motion--course[data-motion-state="final"] .route-places', "1"],
  ['.landing-motion.landing-motion--course[data-motion-state="final"] .route-line', "1"],
  ['.landing-motion.landing-motion--course[data-motion-state="final"] .share-card', "1"],
  ['.landing-motion.landing-motion--course[data-motion-state="final"] .recipient', "1"],
  ['.landing-motion.landing-motion--course[data-motion-state="final"] .navigation-handoff', "1"],
]) {
  const block = cssBlock(motionCss, selector);
  assert(
    new RegExp(`opacity:\\s*${opacity}(?:\\s*;|\\s*$)`).test(block),
    `course final composition requires ${selector} opacity ${opacity}`,
  );
}

const courseFinalCards = cssBlock(
  motionCss,
  '.landing-motion.landing-motion--course[data-motion-state="final"] .route-place-card',
);
assert(
  /opacity:\s*0(?:\s*;|\s*$)/.test(courseFinalCards),
  "course final composition must replace transitional place cards with pins",
);
const courseFinalPins = cssBlock(
  motionCss,
  '.landing-motion.landing-motion--course[data-motion-state="final"] .route-pin',
);
assert(
  /opacity:\s*1(?:\s*;|\s*$)/.test(courseFinalPins),
  "course final composition must show ordered route pins",
);
const courseFinalRoute = cssBlock(
  motionCss,
  '.landing-motion.landing-motion--course[data-motion-state="final"] .route-line path',
);
assert(
  /stroke-dashoffset:\s*0(?:\s*;|\s*$)/.test(courseFinalRoute),
  "course final route line must be complete",
);

const nearbySceneStart = home.indexOf('id="motionSceneNearby"');
const nearbySceneEnd = home.indexOf('<article class="journey-row">', nearbySceneStart);
assert(nearbySceneStart >= 0 && nearbySceneEnd > nearbySceneStart, "could not isolate nearby scene");
const nearbyScene = home.slice(nearbySceneStart, nearbySceneEnd);
assert(
  !nearbyScene.includes("anchor-place__label"),
  "nearby anchor must not have a redundant visible badge",
);

const nearbyCandidateCues = [...nearbyScene.matchAll(
  /<span class="nearby-candidate[^"]*"[^>]*>[\s\S]*?<small>([^<]+)<\/small>\s*<\/span>/g,
)].map((match) => match[1].trim());
assert(nearbyCandidateCues.length === 4, "nearby scene must contain exactly four candidates");
assert(
  nearbyCandidateCues.join("|") === [
    "카페 · 도보 6분",
    "소품샵 · 도보 8분",
    "식당 · 도보 11분",
    "바 · 도보 13분",
  ].join("|"),
  "each nearby candidate must include its category and walking-time cue",
);
assert(
  !/<(?:a|button|input|select)\b/i.test(nearbyScene)
    && !/role="(?:button|tab|switch)"/i.test(nearbyScene),
  "nearby advertising overlays must remain non-interactive markup",
);
assert(
  !nearbyScene.includes("--x:"),
  "nearby candidate positions must not use fixed inline offsets",
);

const nearbyCandidateBase = cssBlock(motionCss, ".landing-motion--nearby .nearby-candidates span");
assert(
  /max-width:\s*calc\(100%\s*-\s*24px\)\s*;/.test(nearbyCandidateBase),
  "nearby candidates must reserve responsive scene gutters",
);
for (const [index, edge] of [[1, "left"], [2, "right"], [3, "left"], [4, "right"]]) {
  const selector = `.landing-motion--nearby .nearby-candidates span:nth-child(${index})`;
  const block = cssBlock(motionCss, selector);
  assert(
    new RegExp(`${edge}:\\s*clamp\\(`).test(block),
    `nearby candidate ${index} must use clamped ${edge} positioning`,
  );
}
const nearbyFinalSelection = cssBlock(
  motionCss,
  '.landing-motion.landing-motion--nearby[data-motion-state="final"] .nearby-candidates .is-selected',
);
assert(
  /top:\s*95%\s*;/.test(nearbyFinalSelection),
  "nearby final selection must clear the anchor screenshot",
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
const mobileCourseCards = cssBlock(mobileMotion, ".landing-motion--course .route-place-card");
assert(
  !/display:\s*none\s*;/.test(mobileCourseCards)
    && /width:\s*84px\s*;/.test(mobileCourseCards)
    && /height:\s*58px\s*;/.test(mobileCourseCards)
    && /animation-name:\s*coursePlaceCard\s*;/.test(mobileCourseCards),
  "320px course scene must retain compact animated place thumbnails",
);
const mobileCourseImages = cssBlock(mobileMotion, ".landing-motion--course .route-place-card img");
assert(
  /width:\s*84px\s*;/.test(mobileCourseImages)
    && /height:\s*58px\s*;/.test(mobileCourseImages),
  "320px course thumbnails must reserve compact photographic dimensions",
);
const mobileCoursePins = cssBlock(mobileMotion, ".landing-motion--course .route-pin");
assert(
  !/animation(?:-name)?:\s*none\s*;/.test(mobileCoursePins)
    && /animation-name:\s*coursePin\s*;/.test(mobileCoursePins),
  "320px course scene must retain the ordered pin animation",
);
const mobileCourseRoute = cssBlock(mobileMotion, ".landing-motion--course .route-line");
assert(
  !/display:\s*none\s*;/.test(mobileCourseRoute)
    && /width:\s*min\(100%,\s*320px\)\s*;/.test(mobileCourseRoute),
  "320px course scene must preserve a readable focal route",
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

const courseKeyframes = Object.fromEntries(
  ["coursePlaceCard", "coursePin", "shareCourse", "openCourse", "startNavigation"].map((name) => [
    name,
    cssBlock(motionCss, `@keyframes ${name}`),
  ]),
);
assert(
  /0%\s*\{[^}]*opacity:\s*0/.test(courseKeyframes.coursePlaceCard)
    && /4%,\s*25%\s*\{[^}]*opacity:\s*1/.test(courseKeyframes.coursePlaceCard),
  "course place cards must reveal early enough to verify the 160ms order",
);
for (const [name, block] of Object.entries(courseKeyframes)) {
  const properties = [...block.matchAll(/([a-z][a-z-]*)\s*:/g)].map((match) => match[1]);
  assert(
    properties.every((property) => property === "opacity" || property === "transform"),
    `${name} may animate only transform and opacity`,
  );
}
const courseRouteKeyframes = cssBlock(motionCss, "@keyframes drawCourse");
const courseRouteProperties = [...courseRouteKeyframes.matchAll(/([a-z][a-z-]*)\s*:/g)]
  .map((match) => match[1]);
assert(
  courseRouteProperties.every((property) => property === "stroke-dashoffset"),
  "drawCourse may animate only stroke-dashoffset",
);
assert(
  /0%,\s*34%\s*\{[^}]*stroke-dashoffset:\s*700/.test(courseRouteKeyframes)
    && /64%,\s*100%\s*\{[^}]*stroke-dashoffset:\s*0/.test(courseRouteKeyframes),
  "course route must finish drawing before sharing begins",
);

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
