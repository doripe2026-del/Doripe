function normalized(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
}

export function extractMigrationSchema(sql) {
  const source = String(sql);
  const tables = [...source.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi,
  )].map((match) => match[1]);
  const functions = [...source.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/gi,
  )].map((match) => match[1]);

  return {
    tables: new Set(normalized(tables)),
    functions: new Set(normalized(functions)),
  };
}

export function compareRuntimeSchema(contract, actual) {
  const requiredTables = normalized(contract.tables ?? []);
  const requiredFunctions = normalized(contract.functions ?? []);
  const actualTables = actual.tables instanceof Set ? actual.tables : new Set(actual.tables ?? []);
  const actualFunctions = actual.functions instanceof Set ? actual.functions : new Set(actual.functions ?? []);
  const missingTables = requiredTables.filter((name) => !actualTables.has(name));
  const missingFunctions = requiredFunctions.filter((name) => !actualFunctions.has(name));

  return {
    missingTables,
    missingFunctions,
    ready: missingTables.length === 0 && missingFunctions.length === 0,
  };
}
