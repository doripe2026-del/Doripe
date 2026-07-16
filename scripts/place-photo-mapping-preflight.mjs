#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  parseManifestJson,
  parseMappingCsv,
  validatePlacePhotoMapping,
} from "./lib/place-photo-mapping.mjs";

const USAGE = `Usage:
  npm run preflight:place-photos -- --mapping <mapping.csv> [options]

Required:
  --dry-run                      Read and print a plan only; npm script supplies this
  --mapping <path>               Place photo mapping CSV

Required for a valid plan:
  --storage-manifest <path>      JSON storage object manifest
  --place-manifest <path>        JSON canonical place manifest`;

class PreflightError extends Error {
  constructor(code, field, message) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

function emptySummary(errorCount = 0) {
  return {
    total_rows: 0,
    public_rows: 0,
    private_rows: 0,
    places: 0,
    storage_objects: 0,
    errors: errorCount,
  };
}

function printResult(result) {
  console.log(`${JSON.stringify({ mode: "dry-run", ...result }, null, 2)}\n`);
}

function printFailure(error) {
  const item = {
    code: error?.code ?? "preflight_error",
    row: null,
    field: error?.field ?? "preflight",
    message: error instanceof Error ? error.message : String(error),
  };
  printResult({ valid: false, summary: emptySummary(1), errors: [item], plan: [] });
  process.exitCode = 1;
}

function parseArguments(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--dry-run") {
      if (values.dryRun) throw new PreflightError("duplicate_argument", "arguments", "--dry-run may only be provided once");
      values.dryRun = true;
      continue;
    }
    const keys = {
      "--mapping": "mapping",
      "--storage-manifest": "storageManifest",
      "--place-manifest": "placeManifest",
    };
    const key = keys[argument];
    if (!key) throw new PreflightError("unknown_argument", "arguments", `Unknown argument: ${argument}`);
    if (values[key]) throw new PreflightError("duplicate_argument", "arguments", `${argument} may only be provided once`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) {
      throw new PreflightError("missing_argument_value", "arguments", `${argument} requires a file path`);
    }
    values[key] = value;
    index += 1;
  }
  if (!values.dryRun) {
    throw new PreflightError("dry_run_required", "arguments", "--dry-run is required; this command has no write mode");
  }
  if (!values.mapping) throw new PreflightError("mapping_required", "arguments", "--mapping is required");
  return values;
}

async function readInput(path, field) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new PreflightError("input_read_error", field, `Could not read ${field}: ${error.message}`);
  }
}

async function readManifest(path, kind) {
  if (!path) return undefined;
  const text = await readInput(path, `${kind}_manifest`);
  try {
    return parseManifestJson(text, kind);
  } catch (error) {
    throw new PreflightError("invalid_manifest", `${kind}_manifest`, error.message);
  }
}

async function main() {
  const argumentValues = parseArguments(process.argv.slice(2));
  if (argumentValues.help) {
    printResult({ valid: true, summary: emptySummary(), errors: [], plan: [], usage: USAGE });
    return;
  }

  const mappingText = await readInput(argumentValues.mapping, "mapping");
  let mappingRows;
  try {
    mappingRows = parseMappingCsv(mappingText);
  } catch (error) {
    throw new PreflightError("invalid_mapping_csv", "mapping", error.message);
  }

  const [storageObjects, places] = await Promise.all([
    readManifest(argumentValues.storageManifest, "storage"),
    readManifest(argumentValues.placeManifest, "place"),
  ]);
  const result = validatePlacePhotoMapping(mappingRows, { storageObjects, places });
  printResult(result);
  if (!result.valid) process.exitCode = 1;
}

main().catch(printFailure);
