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
    storageObjects: rows.map((item) => ({ bucket: item.storage_bucket, path: item.storage_path })),
    places: placeIds.map((id) => ({
      id,
      status: "ready",
      qa_status: "ready",
      photo_qa_status: "approved",
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
    errors: 0,
  });
  assert.deepEqual(result.plan.map((item) => item.photo_id), [IDS.photo1, IDS.photo2]);
  assert.equal(result.plan[1].display_order, 1);
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

test("public rows enforce five per place, one cover, and normalized display order uniqueness", () => {
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

test("storage lookup is exact and public places require all three ready states", () => {
  const storageMismatch = validatePlacePhotoMapping([row()], manifests([row()], {
    storageObjects: [{ bucket: "place-photos-public", path: "example-place/Photo-1.jpg" }],
  }));
  assert.ok(errorCodes(storageMismatch).includes("storage_object_not_found"));

  for (const field of ["status", "qa_status", "photo_qa_status"]) {
    const place = manifests([row()]).places[0];
    place[field] = field === "photo_qa_status" ? "pending" : "draft";
    const result = validatePlacePhotoMapping([row()], manifests([row()], { places: [place] }));
    assert.ok(errorCodes(result).includes("place_not_public_ready"), field);
  }
});

test("manifest entries validate canonical storage and place contracts", () => {
  const result = validatePlacePhotoMapping([row()], {
    storageObjects: [{ bucket: "other-bucket", path: "bad path/photo.jpg" }],
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
  assert.deepEqual(result.plan.map((item) => item.place_id), ["A-place", "a-place"]);

  const source = await readFile("scripts/lib/place-photo-mapping.mjs", "utf8");
  assert.doesNotMatch(source, /localeCompare/);
});

test("repository templates and manifests form a valid canonical preflight input", async () => {
  const [mappingText, storageText, placesText, packageText, cliSource, docsFiles] = await Promise.all([
    readFile("docs/ops/place-photo-mapping.template.csv", "utf8"),
    readFile("docs/ops/place-photo-storage-manifest.example.json", "utf8"),
    readFile("docs/ops/place-photo-place-manifest.example.json", "utf8"),
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
