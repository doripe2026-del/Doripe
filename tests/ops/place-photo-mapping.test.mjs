import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
  place1: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  place2: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  provider1: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  provider2: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
});

function row(overrides = {}) {
  return {
    photo_id: IDS.photo1,
    storage_bucket: "place-photos-public",
    storage_path: "places/example/photo-1.jpg",
    place_id: IDS.place1,
    provider_id: IDS.provider1,
    source_type: "licensed",
    rights_status: "approved",
    publish_status: "published",
    photo_type: "cover",
    sort_position: "0",
    rights_holder_name: "Example Studio",
    credit_text: "Photo: Example Studio",
    usage_scope: "Doripe app and web",
    license_note: "Contract 2026-01",
    ...overrides,
  };
}

function csv(rows) {
  const encode = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return `${MAPPING_COLUMNS.join(",")}\n${rows
    .map((item) => MAPPING_COLUMNS.map((column) => encode(item[column] ?? "")).join(","))
    .join("\n")}\n`;
}

function errorCodes(result) {
  return result.errors.map((error) => error.code);
}

test("parseCsv handles quoted commas, escaped quotes, and embedded newlines", () => {
  const parsed = parseCsv('name,note\r\n"Studio, Inc.","Line 1\nLine ""2"""\r\n');

  assert.deepEqual(parsed, [
    ["name", "note"],
    ["Studio, Inc.", 'Line 1\nLine "2"'],
  ]);
});

test("parseMappingCsv requires the exact documented header", () => {
  assert.throws(
    () => parseMappingCsv("photo_id,storage_path\nvalue,path.jpg\n"),
    /CSV header must exactly match/,
  );
});

test("empty mapping is rejected", () => {
  const result = validatePlacePhotoMapping([]);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("empty_mapping"));
});

test("valid mapping produces a deterministic sorted dry-run plan", () => {
  const rows = [
    row({
      photo_id: IDS.photo2,
      place_id: IDS.place2,
      provider_id: IDS.provider2,
      storage_path: "places/second/gallery.jpg",
      photo_type: "gallery",
      sort_position: "1",
    }),
    row(),
  ];
  const result = validatePlacePhotoMapping(rows);

  assert.equal(result.valid, true);
  assert.deepEqual(result.summary, {
    total_rows: 2,
    publishable_rows: 2,
    non_publishable_rows: 0,
    places: 2,
    providers: 2,
    storage_objects: 2,
    errors: 0,
  });
  assert.deepEqual(
    result.plan.map((item) => item.photo_id),
    [IDS.photo1, IDS.photo2],
  );
  assert.equal(JSON.stringify(result), JSON.stringify(validatePlacePhotoMapping([...rows].reverse())));
});

test("required fields, canonical UUIDs, and safe object paths are validated", () => {
  const result = validatePlacePhotoMapping([
    row({
      photo_id: "legacy-photo-1",
      place_id: "legacy-place-1",
      provider_id: "",
      storage_bucket: "Bad Bucket",
      storage_path: "../private/secret.jpg",
      credit_text: "",
    }),
  ]);

  assert.equal(result.valid, false);
  assert.ok(errorCodes(result).includes("invalid_uuid"));
  assert.ok(errorCodes(result).includes("required_field"));
  assert.ok(errorCodes(result).includes("unsafe_storage_bucket"));
  assert.ok(errorCodes(result).includes("unsafe_storage_path"));
  assert.deepEqual(result.plan, []);
});

test("storage paths preserve exact case and reject surrounding whitespace", () => {
  const result = validatePlacePhotoMapping([
    row({ storage_path: "places/example/Photo.JPG " }),
  ], {
    storageObjects: [{ bucket: "place-photos-public", path: "places/example/Photo.JPG " }],
  });

  assert.ok(errorCodes(result).includes("unsafe_storage_path"));
});

test("active or published photos require approved rights and publishable photo metadata", () => {
  const result = validatePlacePhotoMapping([
    row({ rights_status: "pending", photo_type: "rights", usage_scope: "" }),
  ]);

  assert.ok(errorCodes(result).includes("publish_rights_not_approved"));
  assert.ok(errorCodes(result).includes("publish_photo_type_not_allowed"));
  assert.ok(errorCodes(result).includes("required_publish_metadata"));
});

test("draft photos may retain pending rights without counting as publishable", () => {
  const result = validatePlacePhotoMapping([
    row({ rights_status: "pending", publish_status: "draft", photo_type: "original" }),
  ]);

  assert.equal(result.valid, true);
  assert.equal(result.summary.publishable_rows, 0);
  assert.equal(result.summary.non_publishable_rows, 1);
});

test("duplicate object paths and photo IDs are rejected", () => {
  const result = validatePlacePhotoMapping([
    row(),
    row({ sort_position: "1", photo_type: "gallery" }),
  ]);

  assert.ok(errorCodes(result).includes("duplicate_storage_path"));
  assert.ok(errorCodes(result).includes("duplicate_photo_id"));
});

test("publishable photos enforce five per place, one cover, and unique sort positions", () => {
  const rows = Array.from({ length: 6 }, (_, index) => row({
    photo_id: `0000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
    storage_path: `places/example/photo-${index + 1}.jpg`,
    photo_type: index < 2 ? "cover" : "gallery",
    sort_position: index === 5 ? "4" : String(index),
  }));
  const result = validatePlacePhotoMapping(rows);

  assert.ok(errorCodes(result).includes("too_many_publishable_photos"));
  assert.ok(errorCodes(result).includes("multiple_covers"));
  assert.ok(errorCodes(result).includes("duplicate_sort_position"));
});

test("cover and sort position uniqueness apply across every row for a place", () => {
  const result = validatePlacePhotoMapping([
    row({ publish_status: "draft" }),
    row({
      photo_id: IDS.photo2,
      storage_path: "places/example/photo-2.jpg",
      publish_status: "inactive",
    }),
  ]);

  assert.ok(errorCodes(result).includes("multiple_covers"));
  assert.ok(errorCodes(result).includes("duplicate_sort_position"));
});

test("optional manifests cross-check storage objects, places, providers, and source type", () => {
  const result = validatePlacePhotoMapping([row()], {
    storageObjects: [{ bucket: "place-photos-public", path: "another/photo.jpg" }],
    places: [{ id: IDS.place2, status: "ready" }],
    providers: [{ id: IDS.provider1, status: "inactive", source_type: "owner" }],
  });

  assert.ok(errorCodes(result).includes("storage_object_not_found"));
  assert.ok(errorCodes(result).includes("place_not_found"));
  assert.ok(errorCodes(result).includes("provider_not_publishable"));
  assert.ok(errorCodes(result).includes("provider_source_type_mismatch"));
});

test("canonical place and provider manifests reject non-UUID identifiers", () => {
  const result = validatePlacePhotoMapping([row()], {
    places: [{ id: "legacy-place", status: "ready" }],
    providers: [{ id: "legacy-provider", status: "active", source_type: "licensed" }],
  });

  assert.equal(errorCodes(result).filter((code) => code === "invalid_manifest_uuid").length, 2);
});

test("repository template and example manifests form a valid preflight input", async () => {
  const [mappingText, storageText, placesText, providersText, packageText, cliSource] = await Promise.all([
    readFile("docs/ops/place-photo-mapping.template.csv", "utf8"),
    readFile("docs/ops/place-photo-storage-manifest.example.json", "utf8"),
    readFile("docs/ops/place-photo-place-manifest.example.json", "utf8"),
    readFile("docs/ops/place-photo-provider-manifest.example.json", "utf8"),
    readFile("package.json", "utf8"),
    readFile("scripts/place-photo-mapping-preflight.mjs", "utf8"),
  ]);
  const result = validatePlacePhotoMapping(parseMappingCsv(mappingText), {
    storageObjects: parseManifestJson(storageText, "storage"),
    places: parseManifestJson(placesText, "place"),
    providers: parseManifestJson(providersText, "provider"),
  });

  assert.equal(result.valid, true);
  assert.equal(JSON.parse(packageText).scripts["preflight:place-photos"].endsWith("--dry-run"), true);
  assert.doesNotMatch(cliSource, /\b(?:writeFile|appendFile|fetch|createClient)\b/);
});

test("dry-run CLI is deterministic, leaves inputs unchanged, and rejects non-dry-run use", async () => {
  const directory = await mkdtemp(join(tmpdir(), "doripe-photo-preflight-"));
  const mappingPath = join(directory, "mapping.csv");
  const input = csv([row()]);
  await writeFile(mappingPath, input);
  const command = ["scripts/place-photo-mapping-preflight.mjs", "--dry-run", "--mapping", mappingPath];

  const first = spawnSync(process.execPath, command, { cwd: process.cwd(), encoding: "utf8" });
  const second = spawnSync(process.execPath, command, { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(JSON.parse(first.stdout).mode, "dry-run");
  assert.equal(await readFile(mappingPath, "utf8"), input);

  const unsafe = spawnSync(
    process.execPath,
    ["scripts/place-photo-mapping-preflight.mjs", "--mapping", mappingPath],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.notEqual(unsafe.status, 0);
  assert.match(unsafe.stderr, /--dry-run is required/);
});
