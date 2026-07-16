import { readFile } from "node:fs/promises";
import { compareRuntimeContract, isRuntimeReady } from "./lib/supabase-runtime-drift.mjs";

const contractPath = new URL("../docs/ops/backend-runtime-contract.json", import.meta.url);
const snapshotPath = new URL(
  process.argv[2] ?? "../docs/ops/supabase-production-schema-snapshot-2026-07-16.json",
  import.meta.url,
);

const contract = JSON.parse(await readFile(contractPath, "utf8"));
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const drift = compareRuntimeContract(contract, snapshot);

console.log(`Supabase snapshot: ${snapshot.projectId} at ${snapshot.capturedAt}`);
console.log(`Missing runtime tables: ${drift.missingTables.length}`);
console.log(`Missing runtime functions: ${drift.missingFunctions.length}`);
console.log(`Legacy-only tables: ${drift.legacyTables.length}`);

if (!isRuntimeReady(drift)) {
  console.error(`Missing tables: ${drift.missingTables.join(", ")}`);
  console.error(`Missing functions: ${drift.missingFunctions.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Supabase runtime contract is ready.");
}
