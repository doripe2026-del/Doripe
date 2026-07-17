import { readFile } from "node:fs/promises";
import { checkSupabaseBridgeBaseline } from "./lib/supabase-bridge-baseline.mjs";

async function json(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

const result = checkSupabaseBridgeBaseline({
  contract: await json("../docs/ops/supabase-bridge-baseline-contract.json"),
  productionSnapshot: await json("../docs/ops/supabase-production-schema-snapshot-2026-07-18.json"),
  detailedSchema: await json("../docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-schema.json"),
  remoteMigrations: await json("../docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-remote-migrations.json"),
  storageInventory: await json("../docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-storage-inventory.json"),
  storageChecksums: await json("../docs/ops/backups/2026-07-18/dcyjrsxnpujslbxtitqj-storage-file-checksums.json"),
});

if (!result.readyForBridgeAuthoring) {
  for (const error of result.errors) console.error(`Supabase bridge baseline failed: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Supabase bridge baseline matches the recovery checkpoint.");
  console.log("Production migration remains unauthorized until staging validation passes.");
}
