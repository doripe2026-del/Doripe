import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("operator intake scope migration covers every API intake kind", async () => {
  const migration = await readFile(
    "supabase/migrations/20260714101000_operator_intake_scope_alignment.sql",
    "utf8",
  );

  for (const kind of ["beta", "notify-taste", "notify-event", "creator", "business", "recommendation", "inquiry", "partner", "campaign"]) {
    assert.match(migration, new RegExp(`'${kind.replace("-", "-")}'`), kind);
  }
  assert.match(migration, /recommendation[^\n]+content:write|recommendation[\s\S]+?'content:write'/i);
  assert.match(migration, /inquiry[^\n]+users:moderate|inquiry[\s\S]+?'users:moderate'/i);
  assert.match(migration, /partner[^\n]+business:write|partner[\s\S]+?'business:write'/i);
  assert.match(migration, /campaign[^\n]+business:write|campaign[\s\S]+?'business:write'/i);
});
