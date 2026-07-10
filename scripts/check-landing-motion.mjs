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

console.log("Landing motion contracts passed.");
