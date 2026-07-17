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

export function normalizeStoragePrefix(prefix = "") {
  const segments = String(prefix).split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Storage prefix may not contain . or .. segments");
  }
  return segments.join("/");
}

function compareByPath(left, right) {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

function normalizedMetadataMime(item) {
  const value = item?.metadata?.mimetype ?? item?.metadata?.contentType ?? "";
  return String(value).trim().toLowerCase();
}

function normalizedUpdatedAt(item) {
  return String(item?.updated_at ?? item?.created_at ?? "");
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

function hasCompleteFileStructure(bytes, mimeType) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 5 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  }
  if (mimeType === "image/png") {
    const trailer = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    return bytes.length >= 20 && Buffer.from(bytes.subarray(bytes.length - 8)).equals(trailer);
  }
  if (mimeType === "image/webp") {
    if (bytes.length < 12) return false;
    return Buffer.from(bytes).readUInt32LE(4) === bytes.length - 8;
  }
  if (mimeType === "application/pdf") {
    if (bytes.length < 10) return false;
    return Buffer.from(bytes.subarray(Math.max(0, bytes.length - 1024))).includes(Buffer.from("%%EOF", "ascii"));
  }
  return false;
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
  if (!hasCompleteFileStructure(bytes, mimeType)) {
    return { valid: false, code: "invalid_structure", message: `${bucket}/${path} appears truncated or malformed` };
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
  const normalizedPrefix = normalizeStoragePrefix(prefix);
  const files = [];
  const directories = [normalizedPrefix];

  while (directories.length) {
    const currentPrefix = directories.shift();
    for (let offset = 0; ; offset += pageSize) {
      const page = await listPage(storage, currentPrefix, offset, pageSize);
      for (const item of page) {
        const path = joinStoragePath(currentPrefix, item.name);
        if (item.id) {
          files.push({
            path,
            metadataMime: normalizedMetadataMime(item),
            updatedAt: normalizedUpdatedAt(item),
          });
        } else {
          directories.push(path);
        }
      }
      if (page.length < pageSize) break;
    }
    directories.sort();
  }

  files.sort(compareByPath);
  for (let index = 1; index < files.length; index += 1) {
    if (files[index - 1].path === files[index].path) {
      throw new Error(`Storage listing returned a duplicate path: ${files[index].path}`);
    }
  }
  return files;
}

function sameFileSnapshot(left, right) {
  return left.length === right.length && left.every((item, index) => (
    item.path === right[index].path
    && item.metadataMime === right[index].metadataMime
    && item.updatedAt === right[index].updatedAt
  ));
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
  const normalizedPrefix = normalizeStoragePrefix(prefix);
  const files = await listStorageFiles(storage, normalizedPrefix);
  if (files.length === 0) {
    throw new Error(`No Storage objects found under ${normalizedPrefix || "bucket root"}`);
  }
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
  const finalFiles = await listStorageFiles(storage, normalizedPrefix);
  if (!sameFileSnapshot(files, finalFiles)) {
    throw new Error("Storage changed during manifest generation; retry the command");
  }

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
      prefix: normalizedPrefix,
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
