import { createHash } from "node:crypto";

const BUCKET_POLICIES = Object.freeze({
  "place-photos-public": Object.freeze({
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
  }),
  "place-photo-originals": Object.freeze({
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  }),
});

function joinStoragePath(prefix, name) {
  return prefix ? `${prefix}/${name}` : name;
}

function compareByPath(left, right) {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

function normalizedMetadataMime(item) {
  const value = item?.metadata?.mimetype ?? item?.metadata?.contentType ?? "";
  return String(value).trim().toLowerCase();
}

function isStoragePlaceholder(path) {
  return path.split("/").at(-1) === ".emptyFolderPlaceholder";
}

export function detectMimeType(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
    && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export function inspectStorageObject({ bucket, path, bytes, metadataMime = "" }) {
  const policy = BUCKET_POLICIES[bucket];
  if (!policy) {
    return { valid: false, code: "unsupported_bucket", message: `Unsupported bucket: ${bucket}` };
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return { valid: false, code: "empty_object", message: `${bucket}/${path} is empty` };
  }
  if (bytes.byteLength > policy.maxBytes) {
    return { valid: false, code: "object_too_large", message: `${bucket}/${path} exceeds the bucket size limit` };
  }

  const mimeType = detectMimeType(bytes);
  if (!mimeType || !policy.mimeTypes.has(mimeType)) {
    return { valid: false, code: "invalid_signature", message: `${bucket}/${path} has an unsupported file signature` };
  }

  const normalizedMime = String(metadataMime).trim().toLowerCase();
  if (normalizedMime && normalizedMime !== mimeType) {
    return {
      valid: false,
      code: "metadata_mime_mismatch",
      message: `${bucket}/${path} metadata says ${normalizedMime}, signature says ${mimeType}`,
    };
  }

  return {
    valid: true,
    object: {
      bucket,
      path,
      byte_size: bytes.byteLength,
      mime_type: mimeType,
      checksum_sha256: createHash("sha256").update(bytes).digest("hex"),
      signature_validated: true,
    },
  };
}

async function listPage(storage, prefix, offset, pageSize) {
  const { data, error } = await storage.list(prefix, {
    limit: pageSize,
    offset,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`Could not list ${prefix || "bucket root"}: ${error.message}`);
  return data ?? [];
}

export async function listStorageFiles(storage, prefix = "", pageSize = 100) {
  const files = [];
  const directories = [prefix];

  while (directories.length) {
    const currentPrefix = directories.shift();
    for (let offset = 0; ; offset += pageSize) {
      const page = await listPage(storage, currentPrefix, offset, pageSize);
      for (const item of page) {
        const path = joinStoragePath(currentPrefix, item.name);
        if (item.id) {
          files.push({ path, metadataMime: normalizedMetadataMime(item) });
        } else {
          directories.push(path);
        }
      }
      if (page.length < pageSize) break;
    }
    directories.sort();
  }

  return files.sort(compareByPath);
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

export async function buildStorageManifest({ client, projectRef, bucket, prefix = "", concurrency = 4 }) {
  if (!client?.storage?.from) throw new Error("A Supabase client is required");
  if (!BUCKET_POLICIES[bucket]) throw new Error(`Unsupported bucket: ${bucket}`);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new Error("concurrency must be an integer from 1 to 16");
  }

  const storage = client.storage.from(bucket);
  const files = await listStorageFiles(storage, prefix);
  const inspected = await mapWithConcurrency(files, concurrency, async (file) => {
    if (isStoragePlaceholder(file.path)) {
      return {
        ignored: true,
        path: file.path,
        code: "storage_placeholder",
        message: `${bucket}/${file.path} is a Storage folder placeholder`,
      };
    }
    const { data, error } = await storage.download(file.path);
    if (error || !data) {
      return {
        valid: false,
        path: file.path,
        code: "download_failed",
        message: `${bucket}/${file.path} could not be downloaded`,
      };
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    return { path: file.path, ...inspectStorageObject({ bucket, path: file.path, bytes, metadataMime: file.metadataMime }) };
  });

  const objects = inspected.filter((item) => item.valid).map((item) => item.object).sort(compareByPath);
  const ignored = inspected
    .filter((item) => item.ignored)
    .map(({ path, code, message }) => ({ bucket, path, code, message }))
    .sort(compareByPath);
  const rejected = inspected
    .filter((item) => !item.valid && !item.ignored)
    .map(({ path, code, message }) => ({ bucket, path, code, message }))
    .sort(compareByPath);

  return {
    source: {
      project_ref: projectRef,
      bucket,
      prefix,
      read_only: true,
    },
    summary: {
      listed: files.length,
      accepted: objects.length,
      ignored: ignored.length,
      rejected: rejected.length,
      total_bytes: objects.reduce((sum, item) => sum + item.byte_size, 0),
    },
    objects,
    ignored,
    rejected,
  };
}
