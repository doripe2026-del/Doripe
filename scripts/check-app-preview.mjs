import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const requiredFiles = [
  "playwright.app-preview.config.mjs",
  "scripts/check-app-preview.mjs",
  "scripts/serve-app-preview.mjs",
  "public/app-preview/index.html",
  "tests/app-preview/shell.spec.mjs"
];
const registryFiles = [
  "public/app-preview/figma/screen-inventory.json",
  "public/app-preview/figma/screen-measurements.json"
];

async function previewJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return previewJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  }));

  return files.flat();
}

for (const file of requiredFiles) {
  if (!existsSync(join(repositoryRoot, file))) throw new Error(`Missing required preview file: ${file}`);
}

for (const file of registryFiles) {
  const filePath = join(repositoryRoot, file);
  if (existsSync(filePath)) JSON.parse(await readFile(filePath, "utf8"));
}

for (const file of await previewJavaScriptFiles(join(repositoryRoot, "public/app-preview"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Syntax check failed for ${file}:\n${result.stderr}`);
}
