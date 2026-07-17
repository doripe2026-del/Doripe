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
  "public/home/index.html",
  "public/home/business.html",
  "public/home/company.html",
  "public/home/notify.html",
  "public/home/privacy.html",
  "public/home/terms.html",
  "public/admin/index.html",
  "public/booth-demo/index.html",
  "public/booth-demo/app.js",
  "public/booth-demo/demo-state.js",
  "public/booth-demo/places.js",
  "public/app/index.html",
  "public/app/styles.css",
  "public/app/config.js",
  "public/app/state.js",
  "public/app/api.js",
  "public/app/render.js",
  "public/app/main.js",
  "public/app/manifest.webmanifest",
  "public/app/sw.js",
  "public/app/assets/figma-a0-logo.png",
  "public/app/assets/fonts/PretendardVariable.woff2",
  "public/blog/index.html",
  "public/share.html",
  "api/count.ts",
  "api/track.ts",
  "api/track-v2.ts",
  "api/notify-v2.ts",
  "api/business-lead.ts",
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
const index = read("public/app/index.html");
const styles = read("public/app/styles.css");
const vercel = JSON.parse(read("vercel.json"));

assertIncludes(config, 'cardActionLimit: 12', "12 card-action limit");
assertIncludes(config, 'activeNeighborhoodId: "yeonnam"', "active neighborhood");
assertIncludes(config, 'activeNeighborhoodLabel: "연남"', "active neighborhood label");

assertIncludes(render, '["discover", "발견"]', "bottom nav discover");
assertIncludes(render, '["saved", "저장"]', "bottom nav saved");
assertIncludes(render, '["route", "루트"]', "bottom nav route");
assertIncludes(render, "연남으로 시작하기", "Yeonnam start CTA");
assertIncludes(render, "오늘은 어디를", "tag setup screen");
assertIncludes(render, "card-action skip", "discover card controls");
assertIncludes(render, "오늘 볼 수 있는 카드는", "limit screen");
assertIncludes(render, "저장함", "saved screen");
assertIncludes(render, "루트 만들기", "route screen");
assertIncludes(render, "루트 자동 정리는 곧 열릴 예정", "route blocked screen");
assertIncludes(render, 'data-action="previous-photo"', "previous photo tap zone");
assertIncludes(render, 'data-action="next-photo"', "next photo tap zone");
assertIncludes(render, 'data-action="share-place"', "place share action");

assertIncludes(main, "loadBootstrap", "bootstrap loader");
assertIncludes(main, "place_save", "save tracking");
assertIncludes(main, "place_skip", "skip tracking");
assertIncludes(main, "share_button_tap", "share tracking");
assertIncludes(main, "discover_card_view", "card view tracking");
assertIncludes(main, "session_heartbeat", "session heartbeat tracking");
assertIncludes(main, "share_link_open", "share link open tracking");
assertIncludes(main, "error_shown", "error tracking");
assertIncludes(main, "shared_place_open", "shared place deep link handling");
assertIncludes(main, "route_create_blocked", "route blocked tracking");
assertIncludes(main, "startViewTransition", "View Transition API usage");

assertIncludes(config, 'adminApiBase: "/admin/api/public/app"', "admin public API base");

assertIncludes(index, 'rel="manifest"', "PWA manifest link");
assertIncludes(index, "serviceWorker", "service worker registration");

assertIncludes(render, "bindCardGesture", "card gesture binding");
assertIncludes(render, "pointerdown", "pointer events");
assertIncludes(styles, "swipe-out-right", "right swipe animation");
assertIncludes(styles, "swipe-out-left", "left swipe animation");
assertIncludes(styles, "@media (prefers-reduced-motion: reduce)", "reduced motion support");

assertIncludes(share, "og:title", "share page title meta");
assertIncludes(share, "og:image", "share page image meta");
assertIncludes(share, "Doripe로 이동 중", "share page redirect screen");
assertIncludes(share, "/app?shareType=", "share page redirects to app");

const rewrites = vercel.rewrites ?? [];
const sources = rewrites.map((rewrite) => rewrite.source);
const rewriteBySource = new Map(rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
assert(sources.includes("/"), "vercel rewrite missing /");
assert(rewriteBySource.get("/demo") === "/booth-demo", "vercel rewrite missing booth demo");
assert(sources.includes("/business"), "vercel rewrite missing /business");
assert(sources.includes("/company"), "vercel rewrite missing /company");
assert(sources.includes("/notify"), "vercel rewrite missing /notify");
assert(sources.includes("/privacy"), "vercel rewrite missing /privacy");
assert(sources.includes("/terms"), "vercel rewrite missing /terms");
assert(sources.includes("/app"), "vercel rewrite missing /app");
assert(sources.includes("/app/:path*"), "vercel rewrite missing /app/:path*");
assert(sources.includes("/blog"), "vercel rewrite missing /blog");
assert(sources.includes("/p/:shareId"), "vercel rewrite missing /p/:shareId");
assert(sources.includes("/r/:shareId"), "vercel rewrite missing /r/:shareId");

console.log("MVP app checks passed.");
