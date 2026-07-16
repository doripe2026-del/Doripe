#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  parseCandidate,
  parseDraft,
  parseTemplateContract,
} from "./contracts.mjs";
import {
  createInstagramBufferDraft,
  createInstagramBufferScheduledPost,
  listBufferChannels,
  loadBufferEnv,
  readBufferDraftPackage,
} from "./buffer-client.mjs";
import {
  buildPerformanceBoosts,
  parsePerformanceCsv,
} from "./performance.mjs";
import { writeProductionPackage } from "./package-writer.mjs";
import { selectDailyCandidates } from "./scoring.mjs";
import { validateDraftBundle } from "./validators.mjs";

const CANONICAL_TEMPLATE_URL = new URL(
  "../../docs/instagram-content/template-contract.json",
  import.meta.url,
);
const REPO_ROOT_URL = new URL("../../", import.meta.url);

const COMMANDS = Object.freeze({
  "check-template": {
    argumentCount: 1,
    usage: "Usage: cli.mjs check-template <template-contract.json>",
  },
  score: {
    argumentCount: 4,
    usage:
      "Usage: cli.mjs score <candidates.json> <history.json> <performance.csv> <selected.json>",
  },
  validate: {
    argumentCount: 3,
    usage:
      "Usage: cli.mjs validate <draft.json> <layout-evidence.json> <validation.json>",
  },
  finalize: {
    argumentCount: 4,
    usage:
      "Usage: cli.mjs finalize <draft.json> <layout-evidence.json> <exports.json> <output-root>",
  },
  "buffer-channels": {
    argumentCount: 0,
    usage: "Usage: cli.mjs buffer-channels",
  },
  "buffer-draft": {
    argumentCount: 2,
    usage: "Usage: cli.mjs buffer-draft <package-dir> <image-urls.json>",
  },
  "buffer-schedule": {
    argumentCount: 3,
    usage: "Usage: cli.mjs buffer-schedule <package-dir> <image-urls.json> <due-at-iso>",
  },
});

async function readJson(path) {
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${String(path)}: ${error.message}`, {
      cause: error,
    });
  }
}

async function writeJsonAtomic(path, value) {
  const target = resolve(path);
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let committed = false;

  try {
    await writeFile(
      temporary,
      `${JSON.stringify(value, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(temporary, target);
    committed = true;
  } finally {
    if (!committed) await rm(temporary, { force: true });
  }
}

async function readOptionalPerformance(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function parseHistory(value) {
  if (!Array.isArray(value)) throw new Error("History must be an array");

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`History item ${index + 1} must be an object`);
    }
    if (
      typeof item.createdAt !== "string"
      || !Number.isFinite(Date.parse(item.createdAt))
    ) {
      throw new Error(`History item ${index + 1} needs a valid createdAt date`);
    }
    if (
      !Array.isArray(item.placeIds)
      || item.placeIds.some((placeId) => typeof placeId !== "string" || !placeId)
    ) {
      throw new Error(`History item ${index + 1} needs a placeIds string array`);
    }
    return item;
  });
}

async function verifyTemplateBrandAssets(contract) {
  for (const [label, asset] of [
    ["app screen", contract.brandEnd.appScreen],
    ["Doripe logo", contract.brandEnd.logo],
  ]) {
    const bytes = await readFile(new URL(asset.sourcePath, REPO_ROOT_URL));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== asset.sha256) {
      throw new Error(`${label} SHA-256 does not match template contract`);
    }
  }
}

async function loadCanonicalTemplate() {
  const contract = parseTemplateContract(await readJson(CANONICAL_TEMPLATE_URL));
  await verifyTemplateBrandAssets(contract);
  return contract;
}

async function validateBoundExports(exports, layoutEvidence) {
  if (!exports || typeof exports !== "object" || Array.isArray(exports)) {
    throw new Error("Exports must be an object with sequence, files, nodeIds, and sha256");
  }
  const slideCount = layoutEvidence.slideCount;
  for (const field of ["files", "nodeIds", "sha256"]) {
    if (!Array.isArray(exports[field]) || exports[field].length !== slideCount) {
      throw new Error(`Exports ${field} must be an array matching slideCount ${slideCount}`);
    }
  }
  if (new Set(exports.files).size !== slideCount) {
    throw new Error("PNG export paths must be unique for every slide");
  }
  if (new Set(exports.nodeIds).size !== slideCount) {
    throw new Error("Export node IDs must be unique for every slide");
  }

  for (let index = 0; index < slideCount; index += 1) {
    const nodeId = exports.nodeIds[index];
    if (typeof nodeId !== "string" || !/^\d+:\d+$/.test(nodeId)) {
      throw new Error(`Export node ID is invalid at slide ${index + 1}`);
    }
    if (nodeId !== layoutEvidence.slides[index].nodeId) {
      throw new Error(`Export node ID must match layout evidence at slide ${index + 1}`);
    }
    if (typeof exports.sha256[index] !== "string" || !/^[a-f0-9]{64}$/.test(exports.sha256[index])) {
      throw new Error(`Export SHA-256 digest is invalid at slide ${index + 1}`);
    }
  }

  const actualDigests = await Promise.all(exports.files.map(async (path) =>
    createHash("sha256").update(await readFile(path)).digest("hex")));
  for (let index = 0; index < slideCount; index += 1) {
    if (actualDigests[index] !== exports.sha256[index]) {
      throw new Error(`Export SHA-256 must match the actual file at slide ${index + 1}`);
    }
  }
}

function printUsage(command) {
  if (COMMANDS[command]) {
    console.error(COMMANDS[command].usage);
    return;
  }

  console.error(
    "Usage: cli.mjs <check-template|score|validate|finalize|buffer-channels|buffer-draft|buffer-schedule> ...",
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const commandDefinition = COMMANDS[command];

  if (!commandDefinition || args.length !== commandDefinition.argumentCount) {
    printUsage(command);
    process.exitCode = 1;
    return;
  }

  if (command === "check-template") {
    const contract = parseTemplateContract(await readJson(args[0]));
    await verifyTemplateBrandAssets(contract);
    console.log("Instagram template contract passed.");
    return;
  }

  if (command === "score") {
    const rawCandidates = await readJson(args[0]);
    if (!Array.isArray(rawCandidates)) {
      throw new Error("Candidates must be an array");
    }
    const candidates = rawCandidates.map(parseCandidate);
    const history = parseHistory(await readJson(args[1]));
    const performanceText = await readOptionalPerformance(args[2]);
    const boosts = buildPerformanceBoosts(parsePerformanceCsv(performanceText));
    const selected = selectDailyCandidates(candidates, history, boosts, 2);
    await writeJsonAtomic(args[3], selected);
    return;
  }

  if (command === "buffer-channels") {
    const env = await loadBufferEnv();
    const channels = await listBufferChannels({ accessToken: env.accessToken });
    for (const channel of channels) {
      console.log(`${channel.service}\t${channel.displayName || channel.name}\t${channel.id}`);
    }
    return;
  }

  if (command === "buffer-draft") {
    const env = await loadBufferEnv();
    const draftPackage = await readBufferDraftPackage(args[0], args[1]);
    const post = await createInstagramBufferDraft({
      accessToken: env.accessToken,
      channelId: env.channelId,
      caption: draftPackage.caption,
      imageUrls: draftPackage.imageUrls,
    });
    console.log(`Created Buffer draft ${post.id} for ${draftPackage.candidateId}`);
    return;
  }

  if (command === "buffer-schedule") {
    const env = await loadBufferEnv();
    const draftPackage = await readBufferDraftPackage(args[0], args[1]);
    const post = await createInstagramBufferScheduledPost({
      accessToken: env.accessToken,
      channelId: env.channelId,
      caption: draftPackage.caption,
      imageUrls: draftPackage.imageUrls,
      dueAt: args[2],
    });
    console.log(`Scheduled Buffer post ${post.id} for ${post.dueAt} (${draftPackage.candidateId})`);
    return;
  }

  const draft = parseDraft(await readJson(args[0]));
  const layoutEvidence = await readJson(args[1]);
  const expectedTemplate = await loadCanonicalTemplate();
  const validation = validateDraftBundle({
    draft,
    expectedTemplate,
    layoutEvidence,
  });

  if (command === "validate") {
    await writeJsonAtomic(args[2], validation);
    return;
  }

  const exports = await readJson(args[2]);
  await validateBoundExports(exports, layoutEvidence);
  const result = await writeProductionPackage({
    outputRoot: args[3],
    sequence: exports.sequence,
    draft,
    exportedPngs: exports.files,
    validation,
  });
  console.log(result.directory);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Instagram content CLI failed: ${message}`);
  process.exitCode = 1;
}
