export function compareRuntimeContract(contract, snapshot) {
  const requiredTables = new Set(contract.tables ?? []);
  const requiredFunctions = new Set(contract.functions ?? []);
  const remoteTables = new Set(snapshot.publicTables ?? []);
  const remoteFunctions = new Set(snapshot.publicFunctions ?? []);

  return {
    missingTables: [...requiredTables].filter((name) => !remoteTables.has(name)).sort(),
    missingFunctions: [...requiredFunctions].filter((name) => !remoteFunctions.has(name)).sort(),
    legacyTables: [...remoteTables].filter((name) => !requiredTables.has(name)).sort(),
    legacyFunctions: [...remoteFunctions].filter((name) => !requiredFunctions.has(name)).sort(),
  };
}

export function isRuntimeReady(result) {
  return result.missingTables.length === 0 && result.missingFunctions.length === 0;
}
