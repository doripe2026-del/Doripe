import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  buildStorageManifest,
  detectMimeType,
  inspectStorageObject,
  listStorageFiles,
  normalizeStoragePrefix,
} from "../../scripts/lib/place-photo-storage-manifest.mjs";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 0xff, 0xd9]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = Uint8Array.from(Buffer.from("%PDF-1.7\n%%EOF", "ascii"));

function blob(bytes) {
  return new Blob([bytes]);
}

function fakeStorage(tree, downloads) {
  return {
    async list(prefix, { limit, offset }) {
      const data = (tree[prefix] ?? []).slice(offset, offset + limit);
      return { data, error: null };
    },
    async download(path) {
      const bytes = downloads[path];
      return bytes ? { data: blob(bytes), error: null } : { data: null, error: { message: "missing" } };
    },
  };
}

test("normalizeStoragePrefix removes boundary slashes and rejects traversal", () => {
  assert.equal(normalizeStoragePrefix("/places/demo/"), "places/demo");
  assert.throws(() => normalizeStoragePrefix("places/../private"), /may not contain/);
});

test("detectMimeType uses file signatures instead of extensions", () => {
  assert.equal(detectMimeType(JPEG), "image/jpeg");
  assert.equal(detectMimeType(PNG), "image/png");
  assert.equal(detectMimeType(WEBP), "image/webp");
  assert.equal(detectMimeType(PDF), "application/pdf");
  assert.equal(detectMimeType(Uint8Array.from([1, 2, 3])), null);
});

test("inspectStorageObject emits the canonical hash manifest contract", () => {
  const result = inspectStorageObject({
    bucket: "place-photos-public",
    path: "places/cover.jpg",
    bytes: JPEG,
    metadataMime: "image/jpeg",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.object, {
    bucket: "place-photos-public",
    path: "places/cover.jpg",
    byte_size: JPEG.byteLength,
    mime_type: "image/jpeg",
    checksum_sha256: createHash("sha256").update(JPEG).digest("hex"),
    signature_validated: true,
  });
});

test("inspectStorageObject rejects empty, mismatched, and bucket-incompatible files", () => {
  assert.equal(inspectStorageObject({ bucket: "place-photos-public", path: "empty", bytes: new Uint8Array() }).code, "empty_object");
  assert.equal(inspectStorageObject({ bucket: "place-photos-public", path: "wrong.jpg", bytes: JPEG, metadataMime: "image/png" }).code, "metadata_mime_mismatch");
  assert.equal(inspectStorageObject({ bucket: "place-photos-public", path: "rights.pdf", bytes: PDF }).code, "invalid_signature");
  assert.equal(inspectStorageObject({ bucket: "unknown", path: "photo.jpg", bytes: JPEG }).code, "unsupported_bucket");
  assert.equal(inspectStorageObject({ bucket: "place-photos-public", path: "truncated.jpg", bytes: Uint8Array.from([0xff, 0xd8, 0xff]) }).code, "invalid_structure");
});

test("listStorageFiles recursively walks folders with deterministic pagination", async () => {
  const storage = fakeStorage({
    "": [
      { id: null, name: "b", metadata: null, updated_at: "1" },
      { id: "root", name: "root.jpg", metadata: { mimetype: "image/jpeg" }, updated_at: "1" },
      { id: null, name: "a", metadata: null, updated_at: "1" },
    ],
    a: [
      { id: "a2", name: "2.jpg", metadata: { mimetype: "image/jpeg" }, updated_at: "1" },
      { id: "a1", name: "1.jpg", metadata: { mimetype: "image/jpeg" }, updated_at: "1" },
    ],
    b: [{ id: "b1", name: "1.png", metadata: { mimetype: "image/png" }, updated_at: "1" }],
  }, {});

  assert.deepEqual(await listStorageFiles(storage, "", 2), [
    { path: "a/1.jpg", metadataMime: "image/jpeg", updatedAt: "1" },
    { path: "a/2.jpg", metadataMime: "image/jpeg", updatedAt: "1" },
    { path: "b/1.png", metadataMime: "image/png", updatedAt: "1" },
    { path: "root.jpg", metadataMime: "image/jpeg", updatedAt: "1" },
  ]);
});

test("buildStorageManifest separates accepted and rejected remote objects without writing", async () => {
  const storage = fakeStorage({
    "demo": [
      { id: "placeholder", name: ".emptyFolderPlaceholder", metadata: { mimetype: "application/octet-stream" } },
      { id: "bad", name: "empty", metadata: { mimetype: "application/octet-stream" } },
      { id: "one", name: "one.jpg", metadata: { mimetype: "image/jpeg" } },
      { id: "two", name: "two.png", metadata: { mimetype: "image/png" } },
    ],
  }, {
    "demo/.emptyFolderPlaceholder": new Uint8Array(),
    "demo/empty": new Uint8Array(),
    "demo/one.jpg": JPEG,
    "demo/two.png": PNG,
  });
  const client = { storage: { from: () => storage } };
  const result = await buildStorageManifest({
    client,
    projectRef: "project-ref",
    bucket: "place-photos-public",
    prefix: "demo",
    concurrency: 2,
  });

  assert.deepEqual(result.source, {
    project_ref: "project-ref",
    bucket: "place-photos-public",
    prefix: "demo",
    read_only: true,
  });
  assert.deepEqual(result.summary, {
    listed: 4,
    accepted: 2,
    ignored: 1,
    rejected: 1,
    total_bytes: JPEG.byteLength + PNG.byteLength,
  });
  assert.deepEqual(result.objects.map((item) => item.path), ["demo/one.jpg", "demo/two.png"]);
  assert.equal(result.ignored[0].code, "storage_placeholder");
  assert.equal(result.rejected[0].code, "empty_object");
});

test("buildStorageManifest rejects unsupported buckets even when they are empty", async () => {
  const client = { storage: { from: () => fakeStorage({}, {}) } };
  await assert.rejects(
    buildStorageManifest({ client, projectRef: "project-ref", bucket: "unknown" }),
    /Unsupported bucket/,
  );
});

test("buildStorageManifest fails closed for empty or changing listings", async () => {
  const emptyClient = { storage: { from: () => fakeStorage({}, {}) } };
  await assert.rejects(
    buildStorageManifest({ client: emptyClient, projectRef: "project-ref", bucket: "place-photos-public" }),
    /No Storage objects found/,
  );

  let calls = 0;
  const changingStorage = {
    async list() {
      calls += 1;
      const name = calls === 1 ? "one.jpg" : "two.jpg";
      return { data: [{ id: name, name, metadata: { mimetype: "image/jpeg" }, updated_at: String(calls) }], error: null };
    },
    async download() {
      return { data: blob(JPEG), error: null };
    },
  };
  await assert.rejects(
    buildStorageManifest({
      client: { storage: { from: () => changingStorage } },
      projectRef: "project-ref",
      bucket: "place-photos-public",
    }),
    /Storage changed/,
  );
});
