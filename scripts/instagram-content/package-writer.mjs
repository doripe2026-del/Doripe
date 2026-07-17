import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { parsePackageManifest } from "./contracts.mjs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IHDR_LENGTH = 13;
const REQUIRED_PNG_WIDTH = 1080;
const REQUIRED_PNG_HEIGHT = 1350;
const REQUIRED_SCANLINE_LENGTH = 1 + REQUIRED_PNG_WIDTH * 4;
const VALIDATION_GATES = Object.freeze([
  "originality",
  "caption",
  "sources",
  "aesthetic",
  "layout",
  "presentation",
]);
const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatSeoulDate(date) {
  const parts = Object.fromEntries(
    SEOUL_DATE_FORMATTER
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

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

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function validatePngFile(source) {
  const sourceStat = await stat(source);
  if (!sourceStat.isFile()) throw new Error(`PNG export is not a file: ${source}`);
  const png = await readFile(source);
  if (png.length < PNG_SIGNATURE.length || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`PNG signature is invalid: ${source}`);
  }

  let offset = PNG_SIGNATURE.length;
  let ihdr = null;
  let sawIend = false;
  const idatChunks = [];

  while (offset < png.length) {
    if (png.length - offset < 12) {
      throw new Error(`PNG chunk structure is truncated: ${source}`);
    }
    const dataLength = png.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > png.length) {
      throw new Error(`PNG chunk data is truncated: ${source}`);
    }
    const typeBytes = png.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + dataLength);
    const storedCrc = png.readUInt32BE(offset + 8 + dataLength);
    if (storedCrc !== crc32(Buffer.concat([typeBytes, data]))) {
      throw new Error(`PNG chunk CRC is invalid for ${type}: ${source}`);
    }

    if (offset === PNG_SIGNATURE.length && type !== "IHDR") {
      throw new Error(`PNG first chunk must be IHDR: ${source}`);
    }
    if (type === "IHDR") {
      if (ihdr || dataLength !== PNG_IHDR_LENGTH) {
        throw new Error(`PNG IHDR chunk is invalid: ${source}`);
      }
      ihdr = Buffer.from(data);
    } else if (type === "IDAT") {
      if (!ihdr || sawIend) throw new Error(`PNG IDAT order is invalid: ${source}`);
      idatChunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      if (dataLength !== 0 || idatChunks.length === 0) {
        throw new Error(`PNG IEND chunk is invalid: ${source}`);
      }
      sawIend = true;
      offset = chunkEnd;
      if (offset !== png.length) {
        throw new Error(`PNG has trailing data after IEND: ${source}`);
      }
      break;
    }
    offset = chunkEnd;
  }

  if (!ihdr) throw new Error(`PNG structure is missing IHDR: ${source}`);
  if (!sawIend) throw new Error(`PNG structure is missing terminal IEND: ${source}`);

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  if (width !== REQUIRED_PNG_WIDTH || height !== REQUIRED_PNG_HEIGHT) {
    throw new Error(`PNG dimensions must be exactly 1080x1350: ${source} is ${width}x${height}`);
  }
  if (
    ihdr[8] !== 8
    || ihdr[9] !== 6
    || ihdr[10] !== 0
    || ihdr[11] !== 0
    || ihdr[12] !== 0
  ) {
    throw new Error(`PNG IHDR must be 8-bit RGBA, non-interlaced: ${source}`);
  }

  const compressedImage = Buffer.concat(idatChunks);
  let decoded;
  try {
    const inflated = inflateSync(compressedImage, { info: true });
    decoded = inflated.buffer;
    if (inflated.engine.bytesWritten !== compressedImage.length) {
      throw new Error("compressed stream has trailing data");
    }
  } catch (error) {
    throw new Error(`PNG IDAT decode failed: ${source}`, { cause: error });
  }
  const expectedLength = REQUIRED_SCANLINE_LENGTH * REQUIRED_PNG_HEIGHT;
  if (decoded.length !== expectedLength) {
    throw new Error(`PNG decoded scanline length is invalid: ${source}`);
  }
  for (let row = 0; row < REQUIRED_PNG_HEIGHT; row += 1) {
    if (decoded[row * REQUIRED_SCANLINE_LENGTH] > 4) {
      throw new Error(`PNG scanline filter is invalid at row ${row}: ${source}`);
    }
  }
}

function requireSuccessfulValidation(validation) {
  for (const gate of VALIDATION_GATES) {
    if (!validation?.[gate] || validation[gate].ok !== true) {
      throw new Error(`Complete successful validation is required: ${gate}`);
    }
  }
}

function buildSourcesText(draft, validation) {
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
      `Photo role: ${asset.photoRole}`,
      `Shot type: ${asset.shotType}`,
      `Dimensions: ${asset.width}x${asset.height}`,
      `Aesthetic score: ${validation.aesthetic.scores.find(({ id }) => id === asset.id)?.score}`,
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
    "Aesthetic warnings:",
    ...(validation.aesthetic.warnings.length > 0
      ? validation.aesthetic.warnings.map((warning) => `- ${warning}`)
      : ["- None"]),
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

  const date = formatSeoulDate(now);
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
    await writeFile(join(temporary, "sources.txt"), buildSourcesText(draft, validation));
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
