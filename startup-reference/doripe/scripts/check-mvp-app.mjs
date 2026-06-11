import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label}: missing ${needle}`);
}

const requiredFiles = [
  "public/app/index.html",
  "public/app/styles.css",
  "public/app/config.js",
  "public/app/state.js",
  "public/app/api.js",
  "public/app/render.js",
  "public/app/main.js",
  "api/share.ts",
  "vercel.json",
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `missing file: ${file}`);
}

for (const file of requiredFiles.filter((file) => file.endsWith(".js"))) {
  execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "inherit" });
}

const config = read("public/app/config.js");
const render = read("public/app/render.js");
const main = read("public/app/main.js");
const api = read("public/app/api.js");
const share = read("api/share.ts");
const vercel = JSON.parse(read("vercel.json"));

assertIncludes(config, 'cardActionLimit: 12', "12 card-action limit");
assertIncludes(config, 'activeNeighborhoodId: "yeonnam"', "active neighborhood");
assertIncludes(config, 'activeNeighborhoodLabel: "연남"', "active neighborhood label");

assertIncludes(render, '["discover", "발견"]', "bottom nav discover");
assertIncludes(render, '["saved", "저장"]', "bottom nav saved");
assertIncludes(render, '["route", "루트"]', "bottom nav route");
assert(!render.includes("크리에이터"), "creator tab must stay removed from public MVP");
assertIncludes(render, "연남으로 시작하기", "Yeonnam start CTA");
assertIncludes(render, "오늘은 어디를", "tag setup screen");
assertIncludes(render, "오늘 발견할 장소", "discover screen");
assertIncludes(render, "12번 넘기기", "limit screen");
assertIncludes(render, "저장함", "saved screen");
assertIncludes(render, "루트 만들기", "route screen");
assertIncludes(render, "추후 제공될 기능", "route blocked screen");
assertIncludes(render, 'data-action="previous-photo"', "previous photo tap zone");
assertIncludes(render, 'data-action="next-photo"', "next photo tap zone");
assertIncludes(render, 'data-action="share-place"', "place share action");

assertIncludes(main, "loadBootstrap", "bootstrap loader");
assertIncludes(main, "place_save", "save tracking");
assertIncludes(main, "place_skip", "skip tracking");
assertIncludes(main, "share_button_tap", "share tracking");
assertIncludes(main, "shared_place_open", "shared place deep link handling");
assertIncludes(main, "route_create_blocked", "route blocked tracking");

assertIncludes(config, 'adminApiBase: "/admin/api/public/app"', "admin public API base");

assertIncludes(share, "og:title", "share page title meta");
assertIncludes(share, "og:image", "share page image meta");
assertIncludes(share, "Doripe로 이동 중", "share page redirect screen");
assertIncludes(share, "/app?shareType=", "share page redirects to app");

const rewrites = vercel.rewrites ?? [];
const sources = rewrites.map((rewrite) => rewrite.source);
assert(sources.includes("/app"), "vercel rewrite missing /app");
assert(sources.includes("/app/:path*"), "vercel rewrite missing /app/:path*");
assert(sources.includes("/p/:shareId"), "vercel rewrite missing /p/:shareId");
assert(sources.includes("/r/:shareId"), "vercel rewrite missing /r/:shareId");

console.log("MVP app checks passed.");
