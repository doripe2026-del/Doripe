import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { checkSupabaseBridgePlan } from "../../scripts/lib/supabase-bridge-plan.mjs";

async function fixture() {
  const json = async (path) => JSON.parse(await readFile(path, "utf8"));
  return {
    manifest: await json("docs/ops/supabase-bridge-execution-plan.json"),
    localMigrations: (await readdir("supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort(),
    remoteMigrations: (
      await json("docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-remote-migrations.json")
    ).rows,
  };
}

test("every local and remote migration has exactly one bridge disposition", async () => {
  const result = checkSupabaseBridgePlan(await fixture());
  assert.equal(result.readyForBridgeAuthoring, true);
  assert.equal(result.productionExecutionAuthorized, false);
  assert.equal(result.stagingExecutionAuthorized, false);
  assert.equal(result.classifiedMigrationCount, 50);
  assert.equal(result.remoteMigrationCount, 9);
  assert.deepEqual(result.errors, []);
});

test("a newly added local migration fails closed until it is classified", async () => {
  const input = await fixture();
  input.localMigrations.push("20990101000000_unreviewed.sql");
  const result = checkSupabaseBridgePlan(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("unclassified local migrations")));
});

test("a migration cannot be assigned to two execution phases", async () => {
  const input = await fixture();
  input.manifest = structuredClone(input.manifest);
  input.manifest.phases[1].migrations.push(input.manifest.phases[0].migrations[0]);
  const result = checkSupabaseBridgePlan(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("classified more than once")));
});

test("a new remote migration fails closed until it is mapped or preserved", async () => {
  const input = await fixture();
  input.remoteMigrations = [...input.remoteMigrations, { version: "20990101000000", name: "unknown" }];
  const result = checkSupabaseBridgePlan(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("unaccounted remote migrations")));
});

test("execution cannot be authorized by editing the classification manifest", async () => {
  const input = await fixture();
  input.manifest = structuredClone(input.manifest);
  input.manifest.productionExecutionAuthorized = true;
  input.manifest.stagingExecutionAuthorized = true;
  const result = checkSupabaseBridgePlan(input);
  assert.equal(result.readyForBridgeAuthoring, false);
  assert.ok(result.errors.some((error) => error.includes("production execution")));
  assert.ok(result.errors.some((error) => error.includes("staging execution")));
});
