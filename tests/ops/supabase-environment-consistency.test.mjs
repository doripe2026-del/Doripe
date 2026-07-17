import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const WEB_MVP_PROJECT_ID = "dcyjrsxnpujslbxtitqj";
const LEGACY_PROJECT_ID = "qfvirakzxtcgoerrqumh";

test("web MVP operations docs and runtime snapshot use one Supabase project", async () => {
  const [environmentRules, bridgePlan, snapshot] = await Promise.all([
    readFile("docs/ops/supabase-environments.md", "utf8"),
    readFile("docs/ops/supabase-schema-bridge-plan.md", "utf8"),
    readFile("docs/ops/supabase-production-schema-snapshot-2026-07-18.json", "utf8").then(
      JSON.parse,
    ),
  ]);

  assert.equal(snapshot.projectId, WEB_MVP_PROJECT_ID);
  assert.match(environmentRules, new RegExp(WEB_MVP_PROJECT_ID));
  assert.match(bridgePlan, new RegExp(WEB_MVP_PROJECT_ID));
  assert.match(environmentRules, new RegExp(LEGACY_PROJECT_ID));
  assert.match(environmentRules, /legacy project/i);
  assert.doesNotMatch(
    environmentRules,
    new RegExp(`production Supabase project must be[\\s\\S]*${LEGACY_PROJECT_ID}`, "i"),
  );
});
