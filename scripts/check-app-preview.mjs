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
  "public/app-preview/figma/screen-measurements.json",
  "public/app-preview/figma/visual-masks.json"
];
const allowedMaskReasons = new Set(["photo", "video", "map", "user-generated-text"]);

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

const registries = new Map();
const registrySource = [];
for (const file of registryFiles) {
  const filePath = join(repositoryRoot, file);
  if (!existsSync(filePath)) throw new Error(`Missing required preview registry: ${file}`);
  const source = await readFile(filePath, "utf8");
  registrySource.push(source);
  registries.set(file, JSON.parse(source));
}

if (/https?:\/\//i.test(registrySource.join("\n"))) {
  throw new Error("Figma evidence registries must not contain temporary URLs");
}

const inventory = registries.get("public/app-preview/figma/screen-inventory.json");
const measurements = registries.get("public/app-preview/figma/screen-measurements.json");
const masks = registries.get("public/app-preview/figma/visual-masks.json");
const inventoryIds = inventory.map((screen) => screen.id);
const sortedInventoryIds = [...inventoryIds].sort();

if (inventory.length < 50) throw new Error("Figma inventory must contain at least 50 final screens");
if (new Set(inventoryIds).size !== inventory.length) throw new Error("Figma screen IDs must be unique");
if (JSON.stringify(Object.keys(measurements).sort()) !== JSON.stringify(sortedInventoryIds)) {
  throw new Error("Figma inventory and measurement keysets must match exactly");
}
if (JSON.stringify(Object.keys(masks).sort()) !== JSON.stringify(sortedInventoryIds)) {
  throw new Error("Figma inventory and mask keysets must match exactly");
}

for (const screen of inventory) {
  if (!/^[a-e]\d+[a-z0-9-]*$/.test(screen.id)) throw new Error(`Invalid Figma screen ID: ${screen.id}`);
  if (!/^\d+:\d+$/.test(screen.nodeId)) throw new Error(`Invalid Figma node ID for ${screen.id}: ${screen.nodeId}`);
  if (!["A", "B", "C", "D", "E"].includes(screen.group)) throw new Error(`Invalid Figma flow group: ${screen.group}`);
  if (
    screen.group === "A"
    && (
      !screen.provenance
      || !screen.provenance.rationale
      || !Array.isArray(screen.provenance.alternateNodeIds)
    )
  ) {
    throw new Error(`Missing A-screen provenance for ${screen.id}`);
  }
  if (measurements[screen.id].nodeId !== screen.nodeId) throw new Error(`Figma node mismatch for ${screen.id}`);
  if (measurements[screen.id].frame.width !== 393 || measurements[screen.id].frame.height !== 852) {
    throw new Error(`Invalid Figma frame size for ${screen.id}`);
  }
  if (!Object.hasOwn(masks, screen.id) || !Array.isArray(masks[screen.id])) {
    throw new Error(`Missing explicit Figma mask array for ${screen.id}`);
  }
  if (JSON.stringify(screen.masks) !== JSON.stringify(masks[screen.id])) {
    throw new Error(`Inventory and mask registry disagree for ${screen.id}`);
  }

  for (const mask of masks[screen.id]) {
    if (!allowedMaskReasons.has(mask.reason)) throw new Error(`Invalid mask reason for ${screen.id}: ${mask.reason}`);
    for (const key of ["x", "y", "width", "height"]) {
      if (!Number.isFinite(mask[key])) throw new Error(`Invalid mask ${key} for ${screen.id}`);
    }
    if (
      mask.x < 0
      || mask.y < 0
      || mask.width <= 0
      || mask.height <= 0
      || mask.x + mask.width > 393
      || mask.y + mask.height > 852
    ) {
      throw new Error(`Out-of-bounds mask for ${screen.id}: ${JSON.stringify(mask)}`);
    }
  }

  if (screen.reference !== `/app-preview/assets/references/${screen.id}.png`) {
    throw new Error(`Invalid Figma reference path for ${screen.id}: ${screen.reference}`);
  }
  const referencePath = join(repositoryRoot, "public", screen.reference.replace(/^\//, ""));
  if (!existsSync(referencePath)) throw new Error(`Missing Figma reference for ${screen.id}: ${screen.reference}`);
  const png = await readFile(referencePath);
  if (
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    || png.readUInt32BE(16) !== 393
    || png.readUInt32BE(20) !== 852
  ) {
    throw new Error(`Invalid Figma reference PNG dimensions for ${screen.id}`);
  }
}

for (const file of await previewJavaScriptFiles(join(repositoryRoot, "public/app-preview"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Syntax check failed for ${file}:\n${result.stderr}`);
}
