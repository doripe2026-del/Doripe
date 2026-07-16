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

Optional local cross-checks:
  --storage-manifest <path>      JSON storage object manifest
  --place-manifest <path>        JSON canonical place manifest
  --provider-manifest <path>     JSON canonical provider manifest`;

function parseArguments(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--dry-run") {
      if (values.dryRun) throw new Error("--dry-run may only be provided once");
      values.dryRun = true;
      continue;
    }
    const keys = {
      "--mapping": "mapping",
      "--storage-manifest": "storageManifest",
      "--place-manifest": "placeManifest",
      "--provider-manifest": "providerManifest",
    };
    const key = keys[argument];
    if (!key) throw new Error(`Unknown argument: ${argument}`);
    if (values[key]) throw new Error(`${argument} may only be provided once`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a file path`);
    values[key] = value;
    index += 1;
  }
  if (!values.dryRun) throw new Error("--dry-run is required; this command has no write mode");
  if (!values.mapping) throw new Error("--mapping is required");
  return values;
}

async function readManifest(path, kind) {
  if (!path) return undefined;
  return parseManifestJson(await readFile(path, "utf8"), kind);
}

async function main() {
  const argumentsValues = parseArguments(process.argv.slice(2));
  if (argumentsValues.help) {
    console.log(USAGE);
    return;
  }

  const [mappingText, storageObjects, places, providers] = await Promise.all([
    readFile(argumentsValues.mapping, "utf8"),
    readManifest(argumentsValues.storageManifest, "storage"),
    readManifest(argumentsValues.placeManifest, "place"),
    readManifest(argumentsValues.providerManifest, "provider"),
  ]);
  const result = validatePlacePhotoMapping(parseMappingCsv(mappingText), {
    storageObjects,
    places,
    providers,
  });
  console.log(`${JSON.stringify({ mode: "dry-run", ...result }, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Place photo mapping preflight failed: ${error.message}`);
  process.exitCode = 1;
});
