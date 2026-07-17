import { readdir, readFile } from "node:fs/promises";
import { checkSupabaseBridgePlan } from "./lib/supabase-bridge-plan.mjs";

const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const localMigrations = (await readdir("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const remoteSnapshot = await json(
  "docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-remote-migrations.json",
);

const result = checkSupabaseBridgePlan({
  manifest: await json("docs/ops/supabase-bridge-execution-plan.json"),
  localMigrations,
  remoteMigrations: remoteSnapshot.rows ?? [],
});

if (!result.readyForBridgeAuthoring) {
  for (const error of result.errors) console.error(`Supabase bridge plan failed: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Supabase bridge plan accounts for all ${result.classifiedMigrationCount} local migrations.`);
  console.log(`All ${result.remoteMigrationCount} captured remote migrations are mapped or preserved.`);
  console.log("Production and staging execution remain unauthorized.");
}
