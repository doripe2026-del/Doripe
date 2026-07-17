import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compareRuntimeContract,
  isRuntimeReady,
} from "../../scripts/lib/supabase-runtime-drift.mjs";

test("production snapshot exposes the current launch-blocking schema drift", async () => {
  const contract = JSON.parse(await readFile("docs/ops/backend-runtime-contract.json", "utf8"));
  const snapshot = JSON.parse(
    await readFile("docs/ops/supabase-production-schema-snapshot-2026-07-18.json", "utf8"),
  );
  const drift = compareRuntimeContract(contract, snapshot);

  assert.equal(isRuntimeReady(drift), false);
  assert.ok(drift.missingTables.includes("contents"));
  assert.ok(drift.missingTables.includes("user_accounts"));
  assert.ok(drift.missingFunctions.includes("submit_content"));
  assert.ok(drift.legacyTables.includes("app_users"));
  assert.ok(drift.legacyTables.includes("routes"));
});

test("matching snapshot satisfies the runtime contract", () => {
  const contract = { tables: ["places"], functions: ["save_place"] };
  const snapshot = { publicTables: ["places"], publicFunctions: ["save_place"] };

  assert.equal(isRuntimeReady(compareRuntimeContract(contract, snapshot)), true);
});
