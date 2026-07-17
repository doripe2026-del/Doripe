import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

test("screen review tables keep public reads and inserts without destructive grants", () => {
  const migrationDirectory = "supabase/migrations";
  const migrationName = readdirSync(migrationDirectory)
    .find((file) => file.endsWith("_harden_screen_review_public_writes.sql"));

  assert.ok(migrationName, "missing screen review public-write hardening migration");

  const migration = readFileSync(path.join(migrationDirectory, migrationName), "utf8");
  for (const table of ["screen_review_screens", "screen_review_tasks"]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }

  assert.match(migration, /to_regclass\(/i);
  assert.match(migration, /revoke all[\s\S]*from anon, authenticated/i);
  assert.match(migration, /grant select, insert[\s\S]*to anon, authenticated/i);
  assert.match(migration, /drop policy if exists "screen review update screens"/i);
  assert.match(migration, /drop policy if exists "screen review update tasks"/i);
  assert.match(migration, /drop policy if exists "screen review delete tasks"/i);
});

test("public place photo URLs do not expose storage object listing", () => {
  const migrationDirectory = "supabase/migrations";
  const migrationName = readdirSync(migrationDirectory)
    .find((file) => file.endsWith("_prevent_public_place_photo_listing.sql"));

  assert.ok(migrationName, "missing public place-photo listing hardening migration");

  const migration = readFileSync(path.join(migrationDirectory, migrationName), "utf8");
  assert.match(migration, /drop policy if exists "Public can read app photo objects" on storage\.objects/i);
  assert.match(migration, /drop policy if exists "Public can read place photos" on storage\.objects/i);
});
