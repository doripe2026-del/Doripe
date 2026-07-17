#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  inspectStorageObject,
  listStorageFiles,
  normalizeStoragePrefix,
} from "./lib/place-photo-storage-manifest.mjs";

const USAGE = `Usage:
  npm run backup:place-photos -- --bucket <bucket> --output <directory> [options]

Required environment:
  SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for a readable public bucket)

Options:
  --prefix <path>       Only back up objects under this Storage prefix
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
  if (!Number.isInteger(values.concurrency) || values.concurrency < 1 || values.concurrency > 16) {
    throw new CliError("invalid_concurrency", "--concurrency must be an integer from 1 to 16");
  }
  return values;
}

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split(".")[0];
  } catch {
    throw new CliError("invalid_supabase_url", "Supabase URL is invalid");
  }
}

function safeOutputPath(root, storagePath) {
  const outputPath = resolve(root, storagePath);
  const relativePath = relative(root, outputPath);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || resolve(root) === outputPath) {
    throw new CliError("unsafe_storage_path", `Unsafe Storage path: ${storagePath}`);
  }
  return outputPath;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function sameSnapshot(before, after) {
  return before.length === after.length && before.every((item, index) => (
    item.path === after[index].path
    && item.metadataMime === after[index].metadataMime
    && item.updatedAt === after[index].updatedAt
  ));
}

function printFailure(error) {
  console.log(`${JSON.stringify({
    valid: false,
    error: {
      code: error?.code ?? "storage_backup_failed",
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new CliError("missing_environment", "Supabase URL and a read-capable key are required");

  const root = resolve(options.output);
  const prefix = normalizeStoragePrefix(options.prefix);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = client.storage.from(options.bucket);
  const before = await listStorageFiles(storage, prefix);
  if (before.length === 0) throw new CliError("empty_backup", "No Storage objects were found");

  await mkdir(root, { recursive: false });
  const inspected = await mapWithConcurrency(before, options.concurrency, async (file) => {
    if (file.path.split("/").at(-1) === ".emptyFolderPlaceholder") {
      return { ignored: true, path: file.path, code: "storage_placeholder" };
    }
    const { data, error } = await storage.download(file.path);
    if (error || !data) {
      return { valid: false, path: file.path, code: "download_failed", message: error?.message ?? "No data" };
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    const inspection = inspectStorageObject({
      bucket: options.bucket,
      path: file.path,
      bytes,
      metadataMime: file.metadataMime,
    });
    if (!inspection.valid) return { path: file.path, ...inspection };

    const outputPath = safeOutputPath(root, file.path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes, { flag: "wx" });
    return { path: file.path, ...inspection };
  });

  const after = await listStorageFiles(storage, prefix);
  if (!sameSnapshot(before, after)) {
    throw new CliError("storage_changed", "Storage changed during backup; keep this copy but run a fresh backup");
  }

  const objects = inspected.filter((item) => item.valid).map((item) => item.object);
  const ignored = inspected.filter((item) => item.ignored);
  const rejected = inspected.filter((item) => !item.valid && !item.ignored);
  const manifest = {
    source: {
      project_ref: projectRefFromUrl(url),
      bucket: options.bucket,
      prefix,
      read_only: true,
    },
    captured_at: new Date().toISOString(),
    summary: {
      listed: before.length,
      accepted: objects.length,
      ignored: ignored.length,
      rejected: rejected.length,
      total_bytes: objects.reduce((sum, item) => sum + item.byte_size, 0),
    },
    objects,
    ignored,
    rejected,
  };
  await writeFile(resolve(root, "_manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });

  console.log(`${JSON.stringify({ valid: rejected.length === 0, output: root, summary: manifest.summary }, null, 2)}\n`);
  if (rejected.length) process.exitCode = 1;
}

main().catch(printFailure);
