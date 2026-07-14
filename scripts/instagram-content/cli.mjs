#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  parseCandidate,
  parseDraft,
  parseTemplateContract,
} from "./contracts.mjs";
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

async function loadCanonicalTemplate() {
  return parseTemplateContract(await readJson(CANONICAL_TEMPLATE_URL));
}

function printUsage(command) {
  if (COMMANDS[command]) {
    console.error(COMMANDS[command].usage);
    return;
  }

  console.error(
    "Usage: cli.mjs <check-template|score|validate|finalize> ...",
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
    parseTemplateContract(await readJson(args[0]));
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
  if (!exports || typeof exports !== "object" || Array.isArray(exports)) {
    throw new Error("Exports must be an object with sequence and files");
  }
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
