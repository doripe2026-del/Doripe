import { readFile } from "node:fs/promises";

const sqlPath = new URL("./backend/remote-inventory.sql", import.meta.url);
const manifestPath = new URL("../docs/ops/backend-inventory-manifest.example.json", import.meta.url);
const sql = await readFile(sqlPath, "utf8");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const withoutComments = sql.replace(/--.*$/gm, "").trim();
const statements = withoutComments.split(";").map((value) => value.trim()).filter(Boolean);
const unsafe = statements.filter((statement) => !/^select\b/i.test(statement));
if (unsafe.length) {
  throw new Error(`Inventory SQL must remain read-only. Unsafe statements: ${unsafe.length}`);
}

for (const key of [
  "migrationHistory",
  "publicTables",
  "rls",
  "policies",
  "grants",
  "storageBuckets",
  "rowEstimates",
  "storageObjectCounts",
]) {
  if (!(key in manifest)) throw new Error(`Inventory manifest is missing ${key}`);
}

console.log(`Backend inventory checks passed (${statements.length} read-only queries).`);
