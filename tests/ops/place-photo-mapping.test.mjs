import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  MAPPING_COLUMNS,
  parseCsv,
  parseManifestJson,
  parseMappingCsv,
  validatePlacePhotoMapping,
} from "../../scripts/lib/place-photo-mapping.mjs";

const IDS = Object.freeze({
  photo1: "11111111-1111-4111-8111-111111111111",
  photo2: "22222222-2222-4222-8222-222222222222",
});
const SHA256 = "a".repeat(64);

function storageObject(item, overrides = {}) {
  return {
    bucket: item.storage_bucket,
    path: item.storage_path,
    byte_size: 1024,
    mime_type: item.photo_type === "rights" ? "application/pdf" : "image/jpeg",
    checksum_sha256: SHA256,
    signature_validated: true,
    ...overrides,
  };
}

function row(overrides = {}) {
  return {
    photo_id: IDS.photo1,
    storage_bucket: "place-photos-public",
    storage_path: "example-place/photo-1.jpg",
    place_id: "example-place",
    source_type: "licensed",
    permission_status: "approved",
    photo_type: "cover",
    display_order: "0",
    rights_holder_name: "Example Studio",
    credit_text: "Photo: Example Studio",
    usage_scope: "Doripe app and web",
    license_note: "Contract 2026-01",
    ...overrides,
  };
}

function manifests(rows, overrides = {}) {
  const placeIds = [...new Set(rows.map((item) => item.place_id))];
  return {
    storageObjects: rows.map((item) => storageObject(item)),
    places: placeIds.map((id) => ({
      id,
      status: "ready",
      qa_status: "ready",
      photo_qa_status: "pending",
    })),
    ...overrides,
  };
}

function csv(rows, separator = "\n") {
  const encode = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return `${MAPPING_COLUMNS.join(",")}\n${rows
    .map((item) => MAPPING_COLUMNS.map((column) => encode(item[column] ?? "")).join(","))
    .join(separator)}\n`;
}

function errorCodes(result) {
  return result.errors.map((error) => error.code);
}

async function fixtureFiles(directory, options = {}) {
  const mappingPath = join(directory, "mapping.csv");
  const storagePath = join(directory, "storage.json");
  const placesPath = join(directory, "places.json");
  const rows = options.rows ?? [row()];
  await writeFile(mappingPath, options.mappingText ?? csv(rows));
  await writeFile(storagePath, options.storageText ?? JSON.stringify({ objects: manifests(rows).storageObjects }));
  await writeFile(placesPath, options.placesText ?? JSON.stringify({ places: manifests(rows).places }));
  return { mappingPath, storagePath, placesPath };
}

function runCli(paths, extraArguments = []) {
  return spawnSync(process.execPath, [
    "scripts/place-photo-mapping-preflight.mjs",
    "--dry-run",
    "--mapping",
    paths.mappingPath,
    "--storage-manifest",
    paths.storagePath,
    "--place-manifest",
    paths.placesPath,
    ...extraArguments,
  ], { cwd: process.cwd(), encoding: "utf8" });
}

test("mapping columns exactly match the canonical place_photos input", () => {
  assert.deepEqual(MAPPING_COLUMNS, [
    "photo_id",
    "storage_bucket",
    "storage_path",
    "place_id",
    "source_type",
    "permission_status",
    "photo_type",
    "display_order",
    "rights_holder_name",
    "credit_text",
    "usage_scope",
    "license_note",
  ]);
  assert.equal(MAPPING_COLUMNS.includes("public_url"), false);
  assert.equal(MAPPING_COLUMNS.includes("provider_id"), false);
  assert.equal(MAPPING_COLUMNS.includes("publish_status"), false);
  assert.equal(MAPPING_COLUMNS.includes("rights_status"), false);
  assert.equal(MAPPING_COLUMNS.includes("sort_position"), false);
});

test("parseCsv handles quoted commas, escaped quotes, and embedded newlines", () => {
  const parsed = parseCsv('name,note\r\n"Studio, Inc.","Line 1\nLine ""2"""\r\n');

  assert.deepEqual(parsed, [
    ["name", "note"],
    ["Studio, Inc.", 'Line 1\nLine "2"'],
  ]);
});

test("parseMappingCsv preserves physical CSV row numbers across blank lines", () => {
  const input = csv([
    row(),
    row({ photo_id: IDS.photo2, place_id: "missing-place", storage_path: "missing/photo.jpg" }),
  ], "\n\n");
  const parsed = parseMappingCsv(input);
  const result = validatePlacePhotoMapping(parsed, manifests([row()]));

  assert.equal(result.errors.find((error) => error.code === "place_not_found")?.row, 4);
  assert.equal(result.errors.find((error) => error.code === "storage_object_not_found")?.row, 4);
});

test("parseMappingCsv rejects malformed CSV and non-canonical headers", () => {
  assert.throws(
    () => parseMappingCsv("photo_id,public_url\nvalue,https://example.com/photo.jpg\n"),
    /CSV header must exactly match/,
  );
  assert.throws(() => parseMappingCsv(`${MAPPING_COLUMNS.join(",")}\n"unterminated`), /Malformed CSV/);
});

test("storage and place manifests are required for a valid plan", () => {
  const result = validatePlacePhotoMapping([row()]);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("missing_storage_manifest"));
  assert.ok(errorCodes(result).includes("missing_place_manifest"));
  assert.deepEqual(result.plan, []);
});

test("valid mapping produces a canonical, deterministic dry-run plan", () => {
  const rows = [
    row({
      photo_id: IDS.photo2,
      place_id: "second-place",
      storage_path: "second-place/gallery.jpg",
      photo_type: "gallery",
      display_order: "01",
    }),
    row(),
  ];
  const result = validatePlacePhotoMapping(rows, manifests(rows));

  assert.equal(result.valid, true);
  assert.deepEqual(result.summary, {
    total_rows: 2,
    public_rows: 2,
    private_rows: 0,
    places: 2,
    storage_objects: 2,
    place_synchronizations: 2,
    errors: 0,
  });
  const mappingSteps = result.plan.filter((item) => item.action === "map_place_photo");
  const syncSteps = result.plan.filter((item) => item.action === "sync_place_photos");
  assert.deepEqual(mappingSteps.map((item) => item.photo_id), [IDS.photo1, IDS.photo2]);
  assert.equal(mappingSteps[1].display_order, 1);
  assert.deepEqual(mappingSteps[0].object_validation, {
    byte_size: 1024,
    mime_type: "image/jpeg",
    checksum_sha256: SHA256,
    signature_validated: true,
  });
  assert.deepEqual(syncSteps, [
    {
      action: "sync_place_photos",
      place_id: "example-place",
      cover_photo_id: IDS.photo1,
      cover_image_url: { public_url_from_photo_id: IDS.photo1 },
      image_urls: [{ public_url_from_photo_id: IDS.photo1 }],
      photo_qa_status: "approved",
    },
    {
      action: "sync_place_photos",
      place_id: "second-place",
      cover_photo_id: IDS.photo2,
      cover_image_url: { public_url_from_photo_id: IDS.photo2 },
      image_urls: [{ public_url_from_photo_id: IDS.photo2 }],
      photo_qa_status: "approved",
    },
  ]);
  assert.equal("provider_id" in result.plan[0], false);
  assert.equal("public_url" in result.plan[0], false);
  assert.equal("publish_status" in result.plan[0], false);
});

test("photo UUID, safe text place ID, field lengths, and object paths are validated", () => {
  const invalid = row({
    photo_id: "legacy-photo",
    place_id: `${"a".repeat(80)}x`,
    storage_path: "../private/photo.jpg",
    rights_holder_name: "x".repeat(121),
    credit_text: "x".repeat(201),
    usage_scope: "x".repeat(301),
    license_note: "x".repeat(1001),
  });
  const result = validatePlacePhotoMapping([invalid], manifests([invalid]));

  assert.ok(errorCodes(result).includes("invalid_uuid"));
  assert.ok(errorCodes(result).includes("invalid_place_id"));
  assert.ok(errorCodes(result).includes("unsafe_storage_path"));
  assert.equal(errorCodes(result).filter((code) => code === "field_too_long").length, 4);

  const nilUuid = row({ photo_id: "00000000-0000-0000-0000-000000000000" });
  assert.equal(errorCodes(validatePlacePhotoMapping([nilUuid], manifests([nilUuid]))).includes("invalid_uuid"), false);
});

test("photo types require their exact canonical storage bucket", () => {
  const rows = [
    row({
      storage_bucket: "place-photo-originals",
      permission_status: "pending",
      source_type: "owner",
      usage_scope: "",
      license_note: "",
    }),
    row({
      photo_id: IDS.photo2,
      storage_bucket: "place-photos-public",
      storage_path: "example-place/rights.pdf",
      photo_type: "rights",
      permission_status: "pending",
      source_type: "owner",
      usage_scope: "",
      license_note: "",
    }),
  ];
  const result = validatePlacePhotoMapping(rows, manifests(rows));

  assert.equal(errorCodes(result).filter((code) => code === "bucket_photo_type_mismatch").length, 2);
  assert.deepEqual(result.errors.filter((error) => error.code === "public_photo_not_approved").map((error) => error.row), [2]);
  assert.deepEqual(result.errors.filter((error) => error.code === "public_photo_missing_usage_scope").map((error) => error.row), [2]);
});

test("public photos require approval and usage scope, and licensed rows require a license note", () => {
  const rows = [
    row({ permission_status: "pending", usage_scope: "", license_note: "" }),
    row({
      photo_id: IDS.photo2,
      storage_bucket: "place-photo-originals",
      storage_path: "example-place/original.jpg",
      photo_type: "original",
      permission_status: "pending",
      usage_scope: "",
      license_note: "",
    }),
  ];
  const result = validatePlacePhotoMapping(rows, manifests(rows));

  assert.ok(errorCodes(result).includes("public_photo_not_approved"));
  assert.ok(errorCodes(result).includes("public_photo_missing_usage_scope"));
  assert.equal(errorCodes(result).filter((code) => code === "licensed_photo_missing_license_note").length, 2);
});

test("public rows enforce exact cover and gallery slots, count, and normalized uniqueness", () => {
  const rows = Array.from({ length: 6 }, (_, index) => row({
    photo_id: `0000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
    storage_path: `example-place/photo-${index + 1}.jpg`,
    photo_type: index < 2 ? "cover" : "gallery",
    display_order: index === 5 ? "04" : String(index),
  }));
  const result = validatePlacePhotoMapping(rows, manifests(rows));

  assert.ok(errorCodes(result).includes("too_many_public_photos"));
  assert.ok(errorCodes(result).includes("multiple_covers"));
  assert.ok(errorCodes(result).includes("duplicate_display_order"));
  assert.ok(errorCodes(result).includes("invalid_cover_slot"));

  const wrongGallery = row({ photo_type: "gallery", display_order: "0" });
  assert.ok(errorCodes(validatePlacePhotoMapping([wrongGallery], manifests([wrongGallery]))).includes("invalid_gallery_slot"));
});

test("display order is bounded at 10000 for every photo type", () => {
  for (const photoType of ["cover", "gallery", "original", "rights"]) {
    const item = row({
      storage_bucket: photoType === "original" || photoType === "rights" ? "place-photo-originals" : "place-photos-public",
      photo_type: photoType,
      display_order: "10001",
    });
    const result = validatePlacePhotoMapping([item], manifests([item]));
    assert.ok(errorCodes(result).includes("invalid_display_order"), photoType);
  }
});

test("private rows do not consume public limits or display slots", () => {
  const rows = [
    row(),
    row({
      photo_id: IDS.photo2,
      storage_bucket: "place-photo-originals",
      storage_path: "example-place/original.jpg",
      photo_type: "original",
      permission_status: "pending",
      source_type: "owner",
      display_order: "0",
      usage_scope: "",
      license_note: "",
    }),
  ];
  const result = validatePlacePhotoMapping(rows, manifests(rows));

  assert.equal(result.valid, true);
  assert.equal(result.summary.public_rows, 1);
  assert.equal(result.summary.private_rows, 1);
});

test("duplicate object identity is the exact bucket and path pair", () => {
  const duplicateRows = [row(), row({ photo_id: IDS.photo2 })];
  const duplicateResult = validatePlacePhotoMapping(duplicateRows, manifests(duplicateRows));
  assert.ok(errorCodes(duplicateResult).includes("duplicate_storage_object"));

  const distinctRows = [
    row(),
    row({
      photo_id: IDS.photo2,
      storage_bucket: "place-photo-originals",
      photo_type: "original",
      permission_status: "pending",
      source_type: "owner",
      usage_scope: "",
      license_note: "",
    }),
  ];
  const distinctResult = validatePlacePhotoMapping(distinctRows, manifests(distinctRows));
  assert.equal(errorCodes(distinctResult).includes("duplicate_storage_object"), false);
});

test("storage lookup is exact and public places require status and qa readiness before synchronization", () => {
  const storageMismatch = validatePlacePhotoMapping([row()], manifests([row()], {
    storageObjects: [storageObject(row(), { path: "example-place/Photo-1.jpg" })],
  }));
  assert.ok(errorCodes(storageMismatch).includes("storage_object_not_found"));

  for (const field of ["status", "qa_status"]) {
    const place = manifests([row()]).places[0];
    place[field] = "draft";
    const result = validatePlacePhotoMapping([row()], manifests([row()], { places: [place] }));
    assert.ok(errorCodes(result).includes("place_not_public_ready"), field);
  }

  for (const photoQaStatus of ["pending", "rejected", "approved"]) {
    const place = { ...manifests([row()]).places[0], photo_qa_status: photoQaStatus };
    const result = validatePlacePhotoMapping([row()], manifests([row()], { places: [place] }));
    assert.equal(result.valid, true, photoQaStatus);
    assert.equal(result.plan.at(-1).photo_qa_status, "approved");
  }
});

test("storage manifest rejects zero-byte, oversized, MIME-invalid, and unvalidated objects", () => {
  const invalidObjects = [
    storageObject(row(), { path: "example-place/zero.jpg", byte_size: 0 }),
    storageObject(row(), { path: "example-place/large.jpg", byte_size: 10 * 1024 * 1024 + 1 }),
    storageObject(row(), { path: "example-place/type.gif", mime_type: "image/gif" }),
    storageObject(row(), { path: "example-place/signature.jpg", signature_validated: false }),
    storageObject(row(), { path: "example-place/hash.jpg", checksum_sha256: "not-a-sha256" }),
  ];
  const result = validatePlacePhotoMapping([row()], {
    storageObjects: invalidObjects,
    places: manifests([row()]).places,
  });

  assert.ok(errorCodes(result).includes("invalid_storage_byte_size"));
  assert.ok(errorCodes(result).includes("storage_object_too_large"));
  assert.ok(errorCodes(result).includes("invalid_storage_mime_type"));
  assert.ok(errorCodes(result).includes("storage_signature_not_validated"));
  assert.ok(errorCodes(result).includes("invalid_storage_checksum"));
});

test("private storage permits PDFs up to 50 MiB and public storage does not", () => {
  const rights = row({
    storage_bucket: "place-photo-originals",
    storage_path: "example-place/rights.pdf",
    photo_type: "rights",
    permission_status: "pending",
    source_type: "owner",
    usage_scope: "",
    license_note: "",
  });
  const valid = validatePlacePhotoMapping([rights], manifests([rights], {
    storageObjects: [storageObject(rights, { byte_size: 50 * 1024 * 1024, mime_type: "application/pdf" })],
  }));
  assert.equal(valid.valid, true);

  const publicPdf = validatePlacePhotoMapping([row()], manifests([row()], {
    storageObjects: [storageObject(row(), { mime_type: "application/pdf" })],
  }));
  assert.ok(errorCodes(publicPdf).includes("invalid_storage_mime_type"));
});

test("manifest entries validate canonical storage and place contracts", () => {
  const result = validatePlacePhotoMapping([row()], {
    storageObjects: [storageObject(row(), { bucket: "other-bucket", path: "bad path/photo.jpg" })],
    places: [{ id: "bad place", status: "published", qa_status: "ok", photo_qa_status: "yes" }],
  });

  assert.ok(errorCodes(result).includes("invalid_storage_manifest_entry"));
  assert.ok(errorCodes(result).includes("invalid_place_manifest_entry"));
});

test("plan and errors use locale-independent lexical ordering", async () => {
  const rows = [
    row({ photo_id: IDS.photo2, place_id: "a-place", storage_path: "a-place/photo.jpg" }),
    row({ place_id: "A-place", storage_path: "A-place/photo.jpg" }),
  ];
  const result = validatePlacePhotoMapping(rows, manifests(rows));
  assert.deepEqual(
    result.plan.filter((item) => item.action === "map_place_photo").map((item) => item.place_id),
    ["A-place", "a-place"],
  );

  const source = await readFile("scripts/lib/place-photo-mapping.mjs", "utf8");
  assert.doesNotMatch(source, /localeCompare/);
});

test("repository templates and manifests form a valid canonical preflight input", async () => {
  const [mappingText, storageText, placesText, packageText, cliSource, docsFiles] = await Promise.all([
    readFile("docs/ops/place-photo-mapping.template.csv", "utf8"),
    readFile("docs/ops/place-photo-mapping-storage-manifest.example.json", "utf8"),
    readFile("docs/ops/place-photo-mapping-place-manifest.example.json", "utf8"),
    readFile("package.json", "utf8"),
    readFile("scripts/place-photo-mapping-preflight.mjs", "utf8"),
    readdir("docs/ops"),
  ]);
  const result = validatePlacePhotoMapping(parseMappingCsv(mappingText), {
    storageObjects: parseManifestJson(storageText, "storage"),
    places: parseManifestJson(placesText, "place"),
  });

  assert.equal(result.valid, true);
  assert.equal(JSON.parse(packageText).scripts["preflight:place-photos"].endsWith("--dry-run"), true);
  assert.equal(docsFiles.includes("place-photo-provider-manifest.example.json"), false);
  assert.doesNotMatch(cliSource, /\b(?:writeFile|appendFile|fetch|createClient)\b/);
});

test("dry-run CLI is deterministic, structured, and leaves inputs unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "doripe-photo-preflight-"));
  const paths = await fixtureFiles(directory);
  const before = await Promise.all(Object.values(paths).map((path) => readFile(path, "utf8")));

  const first = runCli(paths);
  const second = runCli(paths);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stderr, "");
  assert.equal(JSON.parse(first.stdout).mode, "dry-run");
  assert.deepEqual(await Promise.all(Object.values(paths).map((path) => readFile(path, "utf8"))), before);
});

test("CLI returns structured JSON and a nonzero exit for malformed inputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "doripe-photo-preflight-errors-"));
  const validPaths = await fixtureFiles(directory);
  const cases = [
    spawnSync(process.execPath, ["scripts/place-photo-mapping-preflight.mjs", "--dry-run", "--wat"], {
      cwd: process.cwd(), encoding: "utf8",
    }),
    runCli({ ...validPaths, mappingPath: join(directory, "missing.csv") }),
    runCli(await fixtureFiles(directory, { mappingText: `${MAPPING_COLUMNS.join(",")}\n"unterminated` })),
    runCli(await fixtureFiles(directory, { storageText: "{" })),
  ];

  for (const result of cases) {
    assert.notEqual(result.status, 0);
    assert.equal(result.stderr, "");
    const output = JSON.parse(result.stdout);
    assert.equal(output.mode, "dry-run");
    assert.equal(output.valid, false);
    assert.equal(typeof output.summary, "object");
    assert.ok(output.errors.length > 0);
    assert.deepEqual(output.plan, []);
  }
});

test("CLI reports omitted required manifests as structured validation errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "doripe-photo-preflight-manifests-"));
  const paths = await fixtureFiles(directory);
  const result = spawnSync(process.execPath, [
    "scripts/place-photo-mapping-preflight.mjs",
    "--dry-run",
    "--mapping",
    paths.mappingPath,
  ], { cwd: process.cwd(), encoding: "utf8" });

  assert.notEqual(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.ok(errorCodes(output).includes("missing_storage_manifest"));
  assert.ok(errorCodes(output).includes("missing_place_manifest"));
  assert.deepEqual(output.plan, []);
});

test("CLI reports multiple manifest read failures in a deterministic structured order", async () => {
  const directory = await mkdtemp(join(tmpdir(), "doripe-photo-preflight-read-errors-"));
  const paths = await fixtureFiles(directory);
  const missingPaths = {
    ...paths,
    storagePath: join(directory, "missing-storage.json"),
    placesPath: join(directory, "missing-places.json"),
  };

  const first = runCli(missingPaths);
  const second = runCli(missingPaths);
  assert.notEqual(first.status, 0);
  assert.equal(first.stdout, second.stdout);
  const output = JSON.parse(first.stdout);
  assert.deepEqual(output.errors, [
    {
      code: "input_read_error",
      row: null,
      field: "place_manifest",
      message: "Could not read place_manifest file",
    },
    {
      code: "input_read_error",
      row: null,
      field: "storage_manifest",
      message: "Could not read storage_manifest file",
    },
  ]);
  assert.equal(output.summary.errors, 2);
  assert.deepEqual(output.plan, []);
});
