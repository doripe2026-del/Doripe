#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildStorageManifest } from "./lib/place-photo-storage-manifest.mjs";

const USAGE = `Usage:
  npm run manifest:place-photos -- --bucket <bucket> --output <path> [options]

Required environment:
  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY

Options:
  --prefix <path>       Only inspect objects under this Storage prefix
  --concurrency <1-16>  Concurrent downloads; default 4
  --help                Print this message`;

class CliError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parseArguments(argumentsList) {
  const values = { prefix: "", concurrency: 4 };
  const seen = new Set();
  const keys = {
    "--bucket": "bucket",
    "--output": "output",
    "--prefix": "prefix",
    "--concurrency": "concurrency",
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    const key = keys[argument];
    if (!key) throw new CliError("unknown_argument", `Unknown argument: ${argument}`);
    if (seen.has(key)) throw new CliError("duplicate_argument", `${argument} may only be provided once`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) throw new CliError("missing_argument_value", `${argument} requires a value`);
    seen.add(key);
    values[key] = key === "concurrency" ? Number(value) : value;
    index += 1;
  }
  if (!values.bucket) throw new CliError("bucket_required", "--bucket is required");
  if (!values.output) throw new CliError("output_required", "--output is required");
  return values;
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    throw new CliError("invalid_supabase_url", "NEXT_PUBLIC_SUPABASE_URL is invalid");
  }
}

function printFailure(error) {
  console.log(`${JSON.stringify({
    valid: false,
    error: {
      code: error?.code ?? "manifest_generation_failed",
      message: error instanceof Error ? error.message : String(error),
    },
  }, null, 2)}\n`);
  process.exitCode = 1;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(`${USAGE}\n`);
    return;
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new CliError("missing_environment", "Supabase URL and service role key are required");

  const result = await buildStorageManifest({
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    projectRef: projectRefFromUrl(url),
    bucket: options.bucket,
    prefix: options.prefix,
    concurrency: options.concurrency,
  });
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  console.log(`${JSON.stringify({ valid: result.rejected.length === 0, output: outputPath, summary: result.summary }, null, 2)}\n`);
  if (result.rejected.length) process.exitCode = 1;
}

main().catch(printFailure);
