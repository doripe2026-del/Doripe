import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, basename } from "node:path";

const allowedTopLevel = new Set([
  ".github",
  ".githooks",
  ".gitignore",
  "AGENTS.md",
  "README.md",
  "api",
  "docs",
  "package-lock.json",
  "package.json",
  "public",
  "scripts",
  "src",
  "supabase",
  "tsconfig.json",
  "vercel.json",
]);

const forbiddenPaths = [
  "doripe-admin",
  "doripe-app",
  "doripe-app-server",
  "fusion-starter-512-app",
  "fusion-starter-512-web",
  "outputs",
  "tmp",
  "ui-ai",
  ".vercel",
  "node_modules",
];

const forbiddenFileNames = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const secretPatterns = [
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk_live_[A-Za-z0-9]{20,}/,
  /sk_test_[A-Za-z0-9]{20,}/,
  /OPENAI_API_KEY\s*=\s*sk-[A-Za-z0-9_-]{20,}/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
];

function fail(message) {
  console.error(`Repository guard failed: ${message}`);
  process.exitCode = 1;
}

function trackedFiles() {
  const output = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim();
  return output ? output.split("\n") : [];
}

const files = trackedFiles();

for (const file of files) {
  const top = file.split("/")[0];
  if (!allowedTopLevel.has(top)) {
    fail(`unexpected top-level path: ${top} (${file})`);
  }

  if (forbiddenPaths.some((path) => file === path || file.startsWith(`${path}/`))) {
    fail(`forbidden legacy/local path is tracked: ${file}`);
  }

  if (file.endsWith(".env.example")) {
    continue;
  }

  if (forbiddenFileNames.includes(basename(file)) || basename(file).startsWith(".env.")) {
    fail(`environment file must not be tracked: ${file}`);
  }

  if (!existsSync(file)) continue;
  if (!textExtensions.has(extname(file)) && !file.endsWith(".gitignore")) continue;

  const source = readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(source)) {
      fail(`possible secret found in ${file}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Repository guard passed.");
