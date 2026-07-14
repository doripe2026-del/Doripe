import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { parsePackageManifest } from "./contracts.mjs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VALIDATION_GATES = Object.freeze(["originality", "caption", "sources", "layout"]);

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

async function requireMissingDirectory(directory) {
  try {
    await lstat(directory);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Package directory already exists: ${directory}`);
}

function validateExportList(exportedPngs) {
  if (!Array.isArray(exportedPngs) || exportedPngs.length === 0) {
    throw new Error("At least one PNG export is required");
  }
  for (const source of exportedPngs) {
    if (typeof source !== "string" || !source.trim() || extname(source).toLowerCase() !== ".png") {
      throw new Error("Every export must be a PNG file path");
    }
  }
}

async function validatePngFile(source) {
  const sourceStat = await stat(source);
  if (!sourceStat.isFile()) throw new Error(`PNG export is not a file: ${source}`);

  const signature = Buffer.alloc(PNG_SIGNATURE.length);
  const handle = await open(source, "r");
  let bytesRead;
  try {
    ({ bytesRead } = await handle.read(signature, 0, signature.length, 0));
  } finally {
    await handle.close();
  }
  if (bytesRead !== PNG_SIGNATURE.length || !signature.equals(PNG_SIGNATURE)) {
    throw new Error(`PNG signature is invalid: ${source}`);
  }
}

function requireSuccessfulValidation(validation) {
  for (const gate of VALIDATION_GATES) {
    if (!validation?.[gate] || validation[gate].ok !== true) {
      throw new Error(`Complete successful validation is required: ${gate}`);
    }
  }
}

function buildSourcesText(draft) {
  const factSources = requireArray(draft.candidate?.sources, "Candidate sources");
  const photoAssets = requireArray(draft.candidate?.assets, "Candidate assets");
  const lines = ["[Fact sources]"];

  for (const source of factSources) {
    lines.push(
      `ID: ${source.id}`,
      `Publisher: ${source.publisher}`,
      `Title: ${source.title}`,
      `URL: ${source.url}`,
      `Checked at: ${source.checkedAt}`,
      "",
    );
  }

  lines.push("[Photo sources]");
  for (const asset of photoAssets) {
    lines.push(
      `ID: ${asset.id}`,
      `Source URL: ${asset.sourceUrl}`,
      `Credit: ${asset.credit}`,
      `Rights status: ${asset.rightsStatus}`,
      "",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function buildReviewText(draft, validation) {
  const photoAssets = requireArray(draft.candidate?.assets, "Candidate assets");
  const validationWarnings = Array.isArray(validation?.sources?.warnings)
    ? validation.sources.warnings
    : [];
  const rightsWarnings = new Set(validationWarnings);
  for (const asset of photoAssets) {
    if (asset.rightsStatus === "not_found") {
      rightsWarnings.add(`Rights not confirmed: ${asset.sourceUrl}`);
    }
  }

  const privacyNotes = photoAssets
    .filter((asset) => typeof asset.privacyNote === "string" && asset.privacyNote.trim())
    .map((asset) => `${asset.id}: ${asset.privacyNote.trim()}`);

  return [
    `Location tag: ${draft.locationTag}`,
    "",
    "Automatic gates:",
    ...VALIDATION_GATES.map((gate) => `- ${gate[0].toUpperCase()}${gate.slice(1)}: PASS`),
    "",
    "Rights warnings:",
    ...(rightsWarnings.size > 0 ? [...rightsWarnings].map((warning) => `- ${warning}`) : ["- None"]),
    "",
    "Privacy notes:",
    ...(privacyNotes.length > 0 ? privacyNotes.map((note) => `- ${note}`) : ["- None recorded"]),
    "",
    "Human checks:",
    "- Confirm every photo's source and reuse permission before publishing.",
    "- Check faces, vehicle plates, and other personal information in every image.",
    "- Recheck factual accuracy, exported layout, and the suggested Instagram location tag.",
    "",
  ].join("\n");
}

export async function writeProductionPackage(options) {
  if (!options || typeof options !== "object") throw new Error("Package options are required");
  const {
    outputRoot,
    sequence,
    draft,
    exportedPngs,
    validation,
    now = new Date(),
  } = options;

  if (typeof outputRoot !== "string" || !outputRoot.trim()) {
    throw new Error("An explicit output root is required");
  }
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error("A safe positive integer sequence is required");
  }
  const candidateId = draft?.candidate?.id;
  if (typeof candidateId !== "string" || !/^[a-z0-9-]+$/.test(candidateId)) {
    throw new Error("A safe candidate ID is required");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("A valid package timestamp is required");
  }
  validateExportList(exportedPngs);
  requireSuccessfulValidation(validation);

  const date = now.toISOString().slice(0, 10);
  const folderName = `${String(sequence).padStart(2, "0")}-${candidateId}`;
  const dayDir = join(resolve(outputRoot), date);
  const directory = join(dayDir, folderName);
  await requireMissingDirectory(directory);
  await mkdir(dayDir, { recursive: true });
  const temporary = await mkdtemp(join(dayDir, `.${folderName}.writing-`));
  let committed = false;

  try {
    const files = [];
    for (const [index, source] of exportedPngs.entries()) {
      const target = `${String(index + 1).padStart(2, "0")}-${index === 0 ? "cover" : "content"}.png`;
      await validatePngFile(source);
      await copyFile(source, join(temporary, target));
      files.push(target);
    }

    await writeFile(join(temporary, "caption.txt"), `${draft.caption.trim()}\n`);
    await writeFile(join(temporary, "sources.txt"), buildSourcesText(draft));
    await writeFile(join(temporary, "review.txt"), buildReviewText(draft, validation));
    files.push("caption.txt", "sources.txt", "review.txt", "manifest.json");

    const manifest = parsePackageManifest({
      version: 1,
      candidateId,
      createdAt: now.toISOString(),
      files,
    });
    await writeFile(
      join(temporary, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await requireMissingDirectory(directory);
    await rename(temporary, directory);
    committed = true;
    return { directory, manifest };
  } finally {
    if (!committed) await rm(temporary, { recursive: true, force: true });
  }
}
