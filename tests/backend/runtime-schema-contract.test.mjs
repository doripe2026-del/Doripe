import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  compareRuntimeSchema,
  extractMigrationSchema,
} from "../../scripts/lib/backend-runtime-schema.mjs";

test("migration schema extraction recognizes public tables and functions", () => {
  const schema = extractMigrationSchema(`
    create table if not exists public.places (id uuid primary key);
    create table public.saved_places (id uuid primary key);
    create or replace function public.save_place() returns void language sql as $$ select; $$;
  `);

  assert.deepEqual([...schema.tables].sort(), ["places", "saved_places"]);
  assert.deepEqual([...schema.functions], ["save_place"]);
});

test("runtime comparison reports only missing resources", () => {
  const result = compareRuntimeSchema(
    { tables: ["places", "contents"], functions: ["save_place"] },
    { tables: new Set(["places"]), functions: new Set(["save_place"]) },
  );

  assert.deepEqual(result, {
    missingTables: ["contents"],
    missingFunctions: [],
    ready: false,
  });
});

test("the repository migrations satisfy the checked-in MVP runtime contract", async () => {
  const contract = JSON.parse(await readFile("docs/ops/backend-runtime-contract.json", "utf8"));
  const { readdir } = await import("node:fs/promises");
  const migrations = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const sql = (await Promise.all(
    migrations.map((name) => readFile(`supabase/migrations/${name}`, "utf8")),
  )).join("\n");

  const result = compareRuntimeSchema(contract, extractMigrationSchema(sql));
  assert.deepEqual(result, { missingTables: [], missingFunctions: [], ready: true });
});

test("the public app routes use the canonical content and discovery domains", async () => {
  const routes = await readFile("src/backend/routes.ts", "utf8");
  const source = await readFile("src/backend/domains/discovery.ts", "utf8");

  assert.doesNotMatch(routes, /appCatalog/);
  assert.match(routes, /handler: bootstrap[^\n]+path: "bootstrap"/);
  assert.match(routes, /handler: listFeed[^\n]+path: "feed"/);
  assert.match(routes, /handler: getContent[^\n]+path: "contents\/:id"/);
  assert.match(source, /from\("content_tags"\)/);
  assert.match(source, /from\("categories"\)/);
  assert.match(source, /\.eq\("status", "ready"\)/);
  assert.match(source, /\.eq\("qa_status", "ready"\)/);
  assert.match(source, /\.eq\("photo_qa_status", "approved"\)/);
  assert.match(source, /\.eq\("permission_status", "approved"\)/);
  assert.doesNotMatch(source, /from\("tag_groups"\)/);
  assert.doesNotMatch(source, /from\("tags"\)/);
  assert.doesNotMatch(source, /app_status|place_type_tag_id|opening_hours_text|is_cover|alt_text/);
});
