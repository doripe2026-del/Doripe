const ALLOWED_ACTIONS = new Set(["do_not_replay", "defer", "staging_only", "staging_after_bridge"]);

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

export function checkSupabaseBridgePlan({ manifest, localMigrations, remoteMigrations }) {
  const errors = [];
  const phases = manifest.phases ?? [];
  const classified = phases.flatMap((phase) => phase.migrations ?? []);
  const local = [...localMigrations].sort();
  const remote = remoteMigrations.map((migration) => String(migration.version)).sort();

  if (manifest.productionExecutionAuthorized !== false) {
    errors.push("production execution must remain explicitly unauthorized");
  }
  if (manifest.stagingExecutionAuthorized !== false) {
    errors.push("staging execution must remain unauthorized until a staging target is recorded");
  }

  for (const phase of phases) {
    if (!phase.id || !Number.isInteger(phase.order)) errors.push("every phase needs an id and integer order");
    if (!ALLOWED_ACTIONS.has(phase.action)) errors.push(`unsupported phase action: ${phase.action ?? "missing"}`);
    if (!phase.reason || !phase.requiredGate) errors.push(`phase ${phase.id ?? "unknown"} needs a reason and required gate`);
  }

  const duplicatePhaseOrders = duplicates(phases.map((phase) => phase.order));
  if (duplicatePhaseOrders.length) errors.push(`duplicate phase orders: ${duplicatePhaseOrders.join(", ")}`);

  const duplicateClassifications = duplicates(classified);
  if (duplicateClassifications.length) {
    errors.push(`migrations classified more than once: ${duplicateClassifications.join(", ")}`);
  }

  const classifiedSet = new Set(classified);
  const localSet = new Set(local);
  const unclassified = local.filter((name) => !classifiedSet.has(name));
  const unknown = classified.filter((name) => !localSet.has(name)).sort();
  if (unclassified.length) errors.push(`unclassified local migrations: ${unclassified.join(", ")}`);
  if (unknown.length) errors.push(`plan references missing local migrations: ${unknown.join(", ")}`);

  const equivalentPhase = phases.find((phase) => phase.id === "remote_equivalent_do_not_replay");
  const equivalentLocals = new Set(equivalentPhase?.migrations ?? []);
  const mappings = manifest.equivalentRemoteMappings ?? [];
  const mappedLocals = mappings.map((mapping) => mapping.local);
  const mappedRemote = mappings.map((mapping) => String(mapping.remoteVersion));
  for (const localName of equivalentLocals) {
    if (!mappedLocals.includes(localName)) errors.push(`missing remote equivalent mapping for ${localName}`);
  }
  for (const localName of mappedLocals) {
    if (!equivalentLocals.has(localName)) errors.push(`remote equivalent mapping is outside its phase: ${localName}`);
  }
  for (const version of mappedRemote) {
    if (!remote.includes(version)) errors.push(`mapped remote migration does not exist: ${version}`);
  }
  for (const value of duplicates(mappedLocals)) errors.push(`duplicate local equivalent mapping: ${value}`);
  for (const value of duplicates(mappedRemote)) errors.push(`duplicate remote equivalent mapping: ${value}`);

  const preservedRemote = (manifest.preservedRemoteOnlyMigrations ?? []).map((migration) => String(migration.version));
  const accountedRemote = new Set([...mappedRemote, ...preservedRemote]);
  const unaccountedRemote = remote.filter((version) => !accountedRemote.has(version));
  const unknownPreserved = preservedRemote.filter((version) => !remote.includes(version)).sort();
  if (unaccountedRemote.length) errors.push(`unaccounted remote migrations: ${unaccountedRemote.join(", ")}`);
  if (unknownPreserved.length) errors.push(`plan preserves missing remote migrations: ${unknownPreserved.join(", ")}`);

  return {
    readyForBridgeAuthoring: errors.length === 0,
    productionExecutionAuthorized: false,
    stagingExecutionAuthorized: false,
    classifiedMigrationCount: classifiedSet.size,
    remoteMigrationCount: remote.length,
    errors,
  };
}
