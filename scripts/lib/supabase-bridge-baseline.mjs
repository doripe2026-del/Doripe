function sorted(values) {
  return [...new Set(values.map(String))].sort();
}

function columnIndex(columns) {
  return new Map(columns.map((column) => [`${column.table}.${column.column}`, column]));
}

export function checkSupabaseBridgeBaseline({
  contract,
  productionSnapshot,
  detailedSchema,
  remoteMigrations,
  storageInventory,
  storageChecksums,
}) {
  const errors = [];
  const notes = [];

  if (productionSnapshot.projectId !== contract.projectId) {
    errors.push(`project mismatch: expected ${contract.projectId}, got ${productionSnapshot.projectId}`);
  }
  if (detailedSchema.projectId !== contract.projectId) {
    errors.push(`detailed schema project mismatch: expected ${contract.projectId}, got ${detailedSchema.projectId}`);
  }
  if (remoteMigrations.projectId !== contract.projectId) {
    errors.push(`migration export project mismatch: expected ${contract.projectId}, got ${remoteMigrations.projectId}`);
  }

  const expectedMigrations = sorted(contract.requiredRemoteMigrations ?? []);
  const actualMigrations = sorted((remoteMigrations.rows ?? []).map((row) => row.version));
  const missingMigrations = expectedMigrations.filter((version) => !actualMigrations.includes(version));
  const unexpectedMigrations = actualMigrations.filter((version) => !expectedMigrations.includes(version));
  if (missingMigrations.length) errors.push(`missing remote migrations: ${missingMigrations.join(", ")}`);
  if (unexpectedMigrations.length) errors.push(`unexpected remote migrations: ${unexpectedMigrations.join(", ")}`);

  const tables = new Set(productionSnapshot.publicTables ?? []);
  const columns = columnIndex(detailedSchema.columns ?? []);
  for (const [table, expectation] of Object.entries(contract.requiredTables ?? {})) {
    if (!tables.has(table)) {
      errors.push(`missing baseline table: ${table}`);
      continue;
    }
    const actualCount = productionSnapshot.rowCounts?.[table];
    if (actualCount !== expectation.rowCount) {
      errors.push(`row count changed for ${table}: expected ${expectation.rowCount}, got ${actualCount ?? "missing"}`);
    }
    for (const [column, expectedType] of Object.entries(expectation.columns ?? {})) {
      const actual = columns.get(`${table}.${column}`);
      if (!actual) {
        errors.push(`missing baseline column: ${table}.${column}`);
      } else if (actual.udt_name !== expectedType) {
        errors.push(`column type changed for ${table}.${column}: expected ${expectedType}, got ${actual.udt_name}`);
      }
    }
  }

  for (const table of contract.mustRemainEmptyBeforeBridge ?? []) {
    const actualCount = productionSnapshot.rowCounts?.[table];
    if (actualCount === undefined) errors.push(`missing row count for bridge-sensitive table: ${table}`);
    else if (actualCount !== 0) errors.push(`bridge-sensitive table is no longer empty: ${table} has ${actualCount} rows`);
  }

  const bucket = (productionSnapshot.storageBuckets ?? []).find(
    (candidate) => candidate.id === contract.storage?.bucketId,
  );
  if (!bucket) {
    errors.push(`missing storage bucket: ${contract.storage?.bucketId}`);
  } else {
    for (const key of ["objectCount", "totalBytes", "orderedNameChecksum"]) {
      if (bucket[key] !== contract.storage[key]) {
        errors.push(`storage ${key} changed: expected ${contract.storage[key]}, got ${bucket[key]}`);
      }
    }
  }

  const inventoryRows = storageInventory.rows ?? storageInventory.objects ?? [];
  if (inventoryRows.length !== contract.storage?.objectCount) {
    errors.push(`storage inventory count changed: expected ${contract.storage?.objectCount}, got ${inventoryRows.length}`);
  }
  const checksumRows = storageChecksums.files ?? storageChecksums.rows ?? storageChecksums.objects ?? [];
  if (checksumRows.length !== contract.storage?.downloadedFileCount) {
    errors.push(`downloaded storage file count changed: expected ${contract.storage?.downloadedFileCount}, got ${checksumRows.length}`);
  }
  const downloadedBytes = checksumRows.reduce(
    (total, row) => total + Number(row.size ?? row.bytes ?? row.byte_size ?? 0),
    0,
  );
  if (downloadedBytes !== contract.storage?.downloadedFileBytes) {
    errors.push(`downloaded storage bytes changed: expected ${contract.storage?.downloadedFileBytes}, got ${downloadedBytes}`);
  }

  if (!errors.length) {
    notes.push("The read-only production baseline still matches the captured recovery checkpoint.");
    notes.push("This does not authorize a production migration; staging restoration and bridge execution remain required.");
  }

  return {
    readyForBridgeAuthoring: errors.length === 0,
    productionMigrationAuthorized: false,
    errors,
    notes,
  };
}
