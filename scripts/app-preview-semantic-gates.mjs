const visibleGeometryPatterns = Object.freeze([
  /^screen\/(?:title|subtitle)$/,
  /^state\/helper-text$/,
  /^legal\/privacy-note$/,
  /^ui\/(?:loading|intro-progress)\/(?:track|fill)$/,
  /^Header-\/-brand\/logo\/image$/,
  /^complete hero \/ check halo$/,
  /^codex generated \/ polished check badge$/,
  /^gender(?:#\d+)?$/,
  /^misty map bg$/,
  /^bottom (?:hover|title|sub)$/,
  /^COMPONENT \/.*$/,
  /^travel status \/ icon background$/,
  /^ICON \/ Send Plane$/,
  /^Text \/.*$/,
  /^Loading \/ dot \d+$/
]);

export function authoritativeGeometrySources(screenId, measurements, actionContract) {
  const elements = measurements[screenId]?.elements;
  if (!elements) throw new Error(`Unknown measured screen: ${screenId}`);

  const contracted = new Set([...actionContract.actions, ...actionContract.nonInteractive]
    .filter((record) => record.screenId === screenId)
    .map((record) => record.source));

  return Object.keys(elements).filter((source) => (
    contracted.has(source) || visibleGeometryPatterns.some((pattern) => pattern.test(source))
  ));
}

export function validateFlowAAssetPolicy({
  policy,
  flowAScreenIds,
  onboardingAssets,
  referenceHashes,
  onboardingSource,
  onboardingCss
}) {
  if (policy?.version !== 1 || !Array.isArray(policy.assets)) {
    throw new Error("Invalid Flow A asset policy");
  }

  const flowAScreens = new Set(flowAScreenIds);
  const declared = new Map();
  for (const asset of policy.assets) {
    if (typeof asset.path !== "string" || !asset.path.startsWith("/app-preview/assets/onboarding/")) {
      throw new Error(`Invalid Flow A asset path: ${asset.path}`);
    }
    if (asset.path.includes("..") || declared.has(asset.path)) {
      throw new Error(`Duplicate or unsafe Flow A asset path: ${asset.path}`);
    }
    if (!new Set(["component", "decorative"]).has(asset.role)) {
      throw new Error(`Invalid Flow A asset role: ${asset.path}`);
    }
    if (!Array.isArray(asset.screens) || asset.screens.length === 0) {
      throw new Error(`Flow A asset has no screen ownership: ${asset.path}`);
    }
    if (asset.screens.some((screenId) => !flowAScreens.has(screenId))) {
      throw new Error(`Flow A asset names an unknown screen: ${asset.path}`);
    }
    if (asset.allowLarge === true && asset.role !== "decorative") {
      throw new Error(`Only decorative Flow A assets may be large: ${asset.path}`);
    }
    declared.set(asset.path, asset);
  }

  const actualPaths = new Set();
  for (const asset of onboardingAssets) {
    actualPaths.add(asset.path);
    if (!declared.has(asset.path)) throw new Error(`Flow A asset is not declared: ${asset.path}`);
    if (referenceHashes.has(asset.hash)) {
      throw new Error(`Flow A asset duplicates a full-screen reference: ${asset.path}`);
    }
  }
  for (const path of declared.keys()) {
    if (!actualPaths.has(path)) throw new Error(`Declared Flow A asset is missing: ${path}`);
  }

  const implementationSource = `${onboardingSource}\n${onboardingCss}`;
  if (/\/app-preview\/assets\/references\//i.test(implementationSource)) {
    throw new Error("Flow A semantic implementation may not render reference images");
  }
  if (/background(?:-image)?\s*:[^;}]*url\s*\(/i.test(onboardingCss)) {
    throw new Error("Flow A semantic implementation may not use CSS image backgrounds");
  }

  return declared;
}
