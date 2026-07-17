import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkSupabaseBridgeBaseline } from "../../scripts/lib/supabase-bridge-baseline.mjs";

async function fixture() {
  const json = async (path) => JSON.parse(await readFile(path, "utf8"));
  return {
    contract: await json("docs/ops/supabase-bridge-baseline-contract.json"),
    productionSnapshot: await json("docs/ops/supabase-production-schema-snapshot-2026-07-18.json"),
    detailedSchema: await json("docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-schema.json"),
    remoteMigrations: await json("docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-remote-migrations.json"),
    storageInventory: await json("docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-storage-inventory.json"),
    storageChecksums: await json("docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-storage-file-checksums.json"),
  };
}

function clone(value) {
  return structuredClone(value);
}

test("captured production baseline is safe for bridge authoring but not production execution", async () => {
  const result = checkSupabaseBridgeBaseline(await fixture());
  assert.equal(result.readyForBridgeAuthoring, true);
  assert.equal(result.productionMigrationAuthorized, false);
  assert.deepEqual(result.errors, []);
});

test("fails closed when a bridge-sensitive table receives data", async () => {
  const input = await fixture();
  input.productionSnapshot = clone(input.productionSnapshot);
  input.productionSnapshot.rowCounts.places = 1;
  const result = checkSupabaseBridgeBaseline(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("places has 1 rows")));
});

test("fails closed when an overlapping column type changes", async () => {
  const input = await fixture();
  input.detailedSchema = clone(input.detailedSchema);
  const id = input.detailedSchema.columns.find((column) => column.table === "places" && column.column === "id");
  id.udt_name = "text";
  const result = checkSupabaseBridgeBaseline(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("places.id")));
});

test("fails closed when migration history changes", async () => {
  const input = await fixture();
  input.remoteMigrations = clone(input.remoteMigrations);
  input.remoteMigrations.rows.pop();
  const result = checkSupabaseBridgeBaseline(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("missing remote migrations")));
});

test("fails closed when the storage recovery copy is incomplete", async () => {
  const input = await fixture();
  input.storageChecksums = clone(input.storageChecksums);
  input.storageChecksums.objects.pop();
  const result = checkSupabaseBridgeBaseline(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("downloaded storage file count changed")));
});

test("SQL preflight is read-only and cannot be picked up as a migration", async () => {
  const path = "supabase/preflight/web_mvp_bridge_baseline.sql";
  const sql = (await readFile(path, "utf8")).toLowerCase();

  assert.equal(path.startsWith("supabase/migrations/"), false);
  assert.match(sql, /production_migration_authorized', false/);

  const forbiddenMutations = [
    /\bcreate\s+(?:or\s+replace\s+)?(?:table|function|trigger|policy|index|type)\b/,
    /\balter\s+(?:table|function|policy|type)\b/,
    /\bdrop\s+(?:table|function|trigger|policy|index|type)\b/,
    /\binsert\s+into\b/,
    /\bupdate\s+[a-z_]/,
    /\bdelete\s+from\b/,
    /\btruncate\b/,
  ];

  for (const mutation of forbiddenMutations) {
    assert.doesNotMatch(sql, mutation);
  }
});

test("SQL preflight guards schema, data, migration history, and storage inventory", async () => {
  const sql = await readFile("supabase/preflight/web_mvp_bridge_baseline.sql", "utf8");

  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /count\(\*\) from public\.%I/);
  assert.match(sql, /supabase_migrations\.schema_migrations/);
  assert.match(sql, /storage\.objects/);
  assert.match(sql, /bucket_id = 'place-photos-public'/);
  assert.match(sql, /actual_count <> 176/);
});
