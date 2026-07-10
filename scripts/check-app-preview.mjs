import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  authoritativeGeometrySources,
  validateFlowAAssetPolicy
} from "./app-preview-semantic-gates.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const requiredFiles = [
  "playwright.app-preview.config.mjs",
  "scripts/check-app-preview.mjs",
  "scripts/serve-app-preview.mjs",
  "public/app-preview/index.html",
  "tests/app-preview/shell.spec.mjs"
];
const registryFiles = [
  "public/app-preview/figma/action-contract.json",
  "public/app-preview/figma/flow-a-asset-policy.json",
  "public/app-preview/figma/screen-inventory.json",
  "public/app-preview/figma/screen-measurements.json",
  "public/app-preview/figma/visual-masks.json"
];
const allowedMaskReasons = new Set(["photo", "video", "map", "user-generated-text"]);
const expectedASelection = [
  ["a1", "446:34", "Flow / A Onboarding", "Brief-required a1 retained; current equivalent is 579:603.", ["579:603"]],
  ["a1-splash", "579:698", "Flow / A Onboarding_수정", "Current modified splash selected over the original splash.", ["446:134"]],
  ["a3", "579:929", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original login screen.", ["446:430"]],
  ["a4", "579:991", "Flow / A Onboarding_수정", "Unique current login-failure state; no original equivalent.", []],
  ["a5", "579:833", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original reset-email screen.", ["446:281"]],
  ["a6", "579:848", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original reset-sent screen.", ["446:298"]],
  ["a7", "579:702", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original new-password screen.", ["446:146"]],
  ["a8", "579:1063", "Flow / A Onboarding_수정", "Unique current password-mismatch state; no original equivalent.", []],
  ["a9", "579:638", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original signup-email screen.", ["446:75"]],
  ["a10", "579:1015", "Flow / A Onboarding_수정", "Unique current email-format error state; no original equivalent.", []],
  ["a11", "579:1039", "Flow / A Onboarding_수정", "Unique current existing-email error state; no original equivalent.", []],
  ["a12", "579:621", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original password-creation screen.", ["446:56"]],
  ["a13", "579:660", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original password-entry screen.", ["446:98"]],
  ["a14", "579:763", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original birth-year screen.", ["446:206"]],
  ["a15", "579:951", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original gender screen.", ["446:457"]],
  ["a16", "579:739", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original nickname screen.", ["446:182"]],
  ["a17", "579:1102", "Flow / A Onboarding_수정", "Unique current duplicate-nickname error state; no original equivalent.", []],
  ["a18", "579:781", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original acquisition-source screen.", ["446:226"]],
  ["a19", "579:863", "Flow / A Onboarding_수정", "Current modified equivalent selected over the original awareness-source screen.", ["446:321"]],
  ["a20", "579:1127", "Flow / A Onboarding_수정", "Current modified neighborhood-selection state selected over the original screen.", ["446:391"]],
  ["a21", "579:1173", "Flow / A Onboarding_수정", "Unique current neighborhood-transition frame; no original equivalent.", []],
  ["a22", "579:1162", "Flow / A Onboarding_수정", "Unique current completion-loading state; no original equivalent.", []]
];
const overlaps = (left, right) => (
  left.x < right.x + right.width
  && right.x < left.x + left.width
  && left.y < right.y + right.height
  && right.y < left.y + left.height
);

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
const actionContract = registries.get("public/app-preview/figma/action-contract.json");
const flowAAssetPolicy = registries.get("public/app-preview/figma/flow-a-asset-policy.json");
const inventoryIds = inventory.map((screen) => screen.id);
const sortedInventoryIds = [...inventoryIds].sort();

if (inventory.length < 50) throw new Error("Figma inventory must contain at least 50 final screens");
if (new Set(inventoryIds).size !== inventory.length) throw new Error("Figma screen IDs must be unique");
if (new Set(inventory.map((screen) => screen.nodeId)).size !== inventory.length) {
  throw new Error("Figma node IDs must be globally unique");
}
if (JSON.stringify(Object.keys(measurements).sort()) !== JSON.stringify(sortedInventoryIds)) {
  throw new Error("Figma inventory and measurement keysets must match exactly");
}
if (JSON.stringify(Object.keys(masks).sort()) !== JSON.stringify(sortedInventoryIds)) {
  throw new Error("Figma inventory and mask keysets must match exactly");
}
if (actionContract.version !== 1 || !Array.isArray(actionContract.actions) || !Array.isArray(actionContract.nonInteractive)) {
  throw new Error("Invalid Figma action contract shape");
}

const inventoryIdSet = new Set(inventoryIds);
for (const record of [...actionContract.actions, ...actionContract.nonInteractive]) {
  if (!inventoryIdSet.has(record.screenId)) throw new Error(`Unknown action-contract screen: ${record.screenId}`);
  if (!Object.hasOwn(measurements[record.screenId].elements, record.source)) {
    throw new Error(`Unknown action-contract element: ${record.screenId}/${record.source}`);
  }
}

for (const screen of inventory.filter((entry) => entry.group === "A")) {
  const geometrySources = authoritativeGeometrySources(screen.id, measurements, actionContract);
  if (geometrySources.length === 0) {
    throw new Error(`Flow A screen has no authoritative geometry: ${screen.id}`);
  }
}
for (const record of actionContract.actions) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.actionId)) {
    throw new Error(`Invalid action ID: ${record.screenId}/${record.actionId}`);
  }
  if (record.effect.destination && !inventoryIdSet.has(record.effect.destination)) {
    throw new Error(`Unknown action destination: ${record.screenId}/${record.actionId} -> ${record.effect.destination}`);
  }
}

const actualASelection = inventory
  .filter((screen) => screen.group === "A")
  .map((screen) => [
    screen.id,
    screen.nodeId,
    screen.provenance?.sourceSection,
    screen.provenance?.rationale,
    screen.provenance?.alternateNodeIds
  ]);
if (JSON.stringify(actualASelection) !== JSON.stringify(expectedASelection)) {
  throw new Error("Flow A node and provenance selection must match the reviewed mapping exactly");
}

const referenceHashes = new Set();
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
  referenceHashes.add(createHash("sha256").update(png).digest("hex"));
  if (
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    || png.readUInt32BE(16) !== 393
    || png.readUInt32BE(20) !== 852
  ) {
    throw new Error(`Invalid Figma reference PNG dimensions for ${screen.id}`);
  }
}

const onboardingAssetDirectory = join(repositoryRoot, "public/app-preview/assets/onboarding");
const onboardingAssets = await Promise.all((await readdir(onboardingAssetDirectory)).map(async (name) => {
  const contents = await readFile(join(onboardingAssetDirectory, name));
  return {
    path: `/app-preview/assets/onboarding/${name}`,
    hash: createHash("sha256").update(contents).digest("hex")
  };
}));
validateFlowAAssetPolicy({
  policy: flowAAssetPolicy,
  flowAScreenIds: inventory.filter((screen) => screen.group === "A").map((screen) => screen.id),
  onboardingAssets,
  referenceHashes,
  onboardingSource: await readFile(join(repositoryRoot, "public/app-preview/screens/onboarding.js"), "utf8"),
  onboardingCss: await readFile(join(repositoryRoot, "public/app-preview/styles/onboarding.css"), "utf8")
});

const flattenedRouteHero = { x: 0, y: 0, width: 393, height: 386 };
for (const screenId of ["d8", "d9"]) {
  if (masks[screenId].some((mask) => overlaps(mask, flattenedRouteHero))) {
    throw new Error(`${screenId.toUpperCase()} masks must not intersect the flattened composite hero`);
  }
}

for (const file of await previewJavaScriptFiles(join(repositoryRoot, "public/app-preview"))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Syntax check failed for ${file}:\n${result.stderr}`);
}
