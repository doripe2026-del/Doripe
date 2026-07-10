import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
