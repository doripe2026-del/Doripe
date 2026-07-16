import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label}: missing ${needle}`);
}

const requiredFiles = [
  "public/home/index.html",
  "public/home/company.html",
  "public/home/notify.html",
  "public/home/privacy.html",
  "public/home/terms.html",
  "public/admin/index.html",
  "public/app-preview/index.html",
  "public/app-preview/main.js",
  "public/app-preview/api-adapter.js",
  "public/app-preview/data/api-repository.js",
  "public/app-preview/analytics-client.js",
  "public/app-preview/figma/screen-inventory.json",
  "public/blog/index.html",
  "public/share.html",
  "api/share.ts",
  "api/v1.ts",
  "tests/app-preview/public-app.spec.mjs",
  "vercel.json"
];

for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `missing file: ${file}`);
}

const index = read("public/app-preview/index.html");
const main = read("public/app-preview/main.js");
const repository = read("public/app-preview/data/api-repository.js");
const analytics = read("public/app-preview/analytics-client.js");
const share = read("api/share.ts");
const inventory = JSON.parse(read("public/app-preview/figma/screen-inventory.json"));
const vercel = JSON.parse(read("vercel.json"));

assert(inventory.length === 55, "current app must keep all 55 reviewed Figma screens");
assertIncludes(index, 'dataset.appSurface = location.pathname.startsWith("/app-preview")', "review/product surface split");
assertIncludes(main, 'getAdapter(isStaticPreview() ? "fixture" : "api"', "live API data mode");
assertIncludes(main, 'new URL("/app", window.location.origin)', "canonical public share link");
assertIncludes(main, "currentAppEntryPath()", "path-safe auth redirect");
assertIncludes(repository, "`/api/v1/${path}`", "public app API boundary");
assertIncludes(analytics, 'apiBase = "/api/v1"', "analytics API boundary");
assertIncludes(share, '<meta http-equiv="refresh"', "legacy share redirect page");

const rewrites = vercel.rewrites ?? [];
const rewriteBySource = new Map(rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
assert(rewriteBySource.get("/") === "/home/index.html", "vercel rewrite missing home");
assert(!rewriteBySource.has("/business"), "retired /business route must stay removed");
assert(rewriteBySource.get("/app") === "/app-preview/index.html", "public /app must serve the current app");
assert(rewriteBySource.get("/app/:path*") === "/app-preview/index.html", "nested /app routes must serve the current app");
assert(rewriteBySource.get("/app-preview") === "/app-preview/index.html", "review route must remain available");
assert(rewriteBySource.has("/p/:shareId"), "vercel rewrite missing place shares");
assert(rewriteBySource.has("/r/:shareId"), "vercel rewrite missing route shares");

console.log("MVP app checks passed.");
