import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const migrationDir = "supabase/migrations";
const migrationNamePattern = /^(\d{14})_[a-z0-9_]+\.sql$/;
const timestamps = new Set();
let failed = false;

function fail(message) {
  console.error(`Supabase migration check failed: ${message}`);
  failed = true;
}

if (!existsSync(migrationDir)) {
  fail(`missing ${migrationDir}`);
} else {
  const migrations = readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrations) {
    const match = file.match(migrationNamePattern);
    if (!match) {
      fail(`invalid migration filename: ${file}`);
      continue;
    }

    const timestamp = match[1];
    if (timestamps.has(timestamp)) {
      fail(`duplicate migration timestamp: ${timestamp}`);
    }
    timestamps.add(timestamp);

    const source = readFileSync(join(migrationDir, file), "utf8");
    if (/SUPABASE_SERVICE_ROLE_KEY\s*=/.test(source) || /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(source)) {
      fail(`possible Supabase key committed in ${file}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("Supabase migration checks passed.");
