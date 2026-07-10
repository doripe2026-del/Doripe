export const ALLOWED_COVERAGE_REASONS = new Set([
  "brand-layer-owned-by-rendered-brand",
  "component-text-owned-by-rendered-composite",
  "control-background-owned-by-semantic-control",
  "control-label-owned-by-semantic-control",
  "decorative-crop-source-owned-by-rendered-media",
  "field-placeholder-owned-by-semantic-input",
  "picker-layer-owned-by-semantic-picker",
  "validation-layer-owned-by-rendered-status",
  "vector-child-owned-by-component-asset"
]);

export function authoritativeGeometrySources(screenId, measurements) {
  const elements = measurements[screenId]?.elements;
  if (!elements) throw new Error(`Unknown measured screen: ${screenId}`);
  return Object.keys(elements);
}

export function validateFlowALiveEvidence({ evidence, inventory, referenceHashes }) {
  if (
    evidence?.version !== 1
    || evidence.fileKey !== "TfZAtv9JUy508otim4P23w"
    || evidence.rootNodeId !== "446:33"
    || !Number.isFinite(Date.parse(evidence.capturedAt))
    || evidence.capture?.designContextTool !== "get_design_context"
    || evidence.capture?.screenshotTool !== "get_screenshot"
    || evidence.capture?.readOnly !== true
    || evidence.capture?.contentsOnly !== true
    || evidence.capture?.maxDimension !== 852
    || !Array.isArray(evidence.screens)
  ) {
    throw new Error("Invalid Flow A live Figma evidence registry");
  }

  const expected = new Map(inventory
    .filter(({ group }) => group === "A")
    .map((screen) => [screen.id, screen]));
  const seen = new Set();

  for (const record of evidence.screens) {
    const screen = expected.get(record.id);
    if (!screen) throw new Error(`Unknown Flow A live evidence screen: ${record.id}`);
    if (seen.has(record.id)) throw new Error(`Duplicate Flow A live evidence screen: ${record.id}`);
    seen.add(record.id);

    if (
      record.nodeId !== screen.nodeId
      || record.reference !== screen.reference
      || record.width !== 393
      || record.height !== 852
      || record.designContextRead !== true
      || !/^[a-f0-9]{64}$/.test(record.liveScreenshotSha256)
    ) {
      throw new Error(`Invalid Flow A live evidence record: ${record.id}`);
    }
    const referenceHash = referenceHashes instanceof Map
      ? referenceHashes.get(record.id)
      : referenceHashes?.[record.id];
    if (referenceHash !== record.liveScreenshotSha256) {
      throw new Error(`Flow A reference does not match live Figma: ${record.id}`);
    }
  }

  for (const screenId of expected.keys()) {
    if (!seen.has(screenId)) throw new Error(`Flow A live evidence is missing screen: ${screenId}`);
  }
  if (seen.size !== expected.size) throw new Error("Flow A live evidence screen count mismatch");

  return seen;
}

const EXPECTED_FLOW_B_NODES = Object.freeze([
  ["b1", "446:507"], ["b2", "446:596"], ["b3", "446:646"], ["b4", "446:682"],
  ["b5", "446:818"], ["b6", "446:876"], ["b7", "446:1000"], ["b8", "446:1017"],
  ["b9", "446:1070"], ["b10", "446:1106"], ["b11", "446:2667"],
  ["b12", "446:2792"], ["b13", "446:3042"]
]);

export function validateFlowBLiveEvidence({ evidence, inventory, referenceHashes }) {
  if (
    evidence?.version !== 1
    || evidence.fileKey !== "TfZAtv9JUy508otim4P23w"
    || evidence.rootNodeId !== "446:33"
    || !Number.isFinite(Date.parse(evidence.capturedAt))
    || evidence.capture?.designContextTool !== "get_design_context"
    || evidence.capture?.screenshotTool !== "get_screenshot"
    || evidence.capture?.readOnly !== true
    || evidence.capture?.contentsOnly !== true
    || evidence.capture?.maxDimension !== 852
    || !Array.isArray(evidence.screens)
  ) {
    throw new Error("Invalid Flow B live Figma evidence registry");
  }

  const flowB = inventory.filter(({ group }) => group === "B");
  if (
    flowB.length !== EXPECTED_FLOW_B_NODES.length
    || JSON.stringify(flowB.map(({ id, nodeId }) => [id, nodeId])) !== JSON.stringify(EXPECTED_FLOW_B_NODES)
    || flowB.some(({ nodeId }) => nodeId === "446:1018")
  ) {
    throw new Error("Flow B inventory does not match the exact reviewed live top-level nodes");
  }

  const expected = new Map(flowB.map((screen) => [screen.id, screen]));
  const seen = new Set();
  for (const record of evidence.screens) {
    const screen = expected.get(record.id);
    if (!screen) throw new Error(`Unknown Flow B live evidence screen: ${record.id}`);
    if (seen.has(record.id)) throw new Error(`Duplicate Flow B live evidence screen: ${record.id}`);
    seen.add(record.id);

    if (
      record.nodeId !== screen.nodeId
      || record.reference !== screen.reference
      || record.width !== 393
      || record.height !== 852
      || record.designContextRead !== true
      || !/^[a-f0-9]{64}$/.test(record.liveScreenshotSha256)
    ) {
      throw new Error(`Invalid Flow B live evidence record: ${record.id}`);
    }
    const referenceHash = referenceHashes instanceof Map
      ? referenceHashes.get(record.id)
      : referenceHashes?.[record.id];
    if (referenceHash !== record.liveScreenshotSha256) {
      throw new Error(`Flow B reference does not match live Figma: ${record.id}`);
    }
  }

  const b1 = evidence.screens.find(({ id }) => id === "b1");
  if (
    b1?.sourceScreenshot?.width !== 465
    || b1.sourceScreenshot.height !== 924
    || b1.sourceScreenshot.maxDimension !== 924
    || !/^[a-f0-9]{64}$/.test(b1.sourceScreenshot.sha256)
    || b1.normalization?.type !== "center-crop-to-frame-bounds"
    || ["insetTop", "insetRight", "insetBottom", "insetLeft"]
      .some((key) => b1.normalization[key] !== 36)
  ) {
    throw new Error("B1 live evidence must record the reviewed shadow-bound frame crop");
  }

  for (const [screenId] of EXPECTED_FLOW_B_NODES) {
    if (!seen.has(screenId)) throw new Error(`Flow B live evidence is missing screen: ${screenId}`);
  }
  if (seen.size !== EXPECTED_FLOW_B_NODES.length) {
    throw new Error("Flow B live evidence screen count mismatch");
  }
  return seen;
}

export function validateFlowACoverageManifest({ manifest, inventory, measurements }) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.rendered) || !Array.isArray(manifest.classifications)) {
    throw new Error("Invalid Flow A coverage manifest");
  }

  const flowAScreens = new Map(inventory
    .filter((screen) => screen.group === "A")
    .map((screen) => [screen.id, screen]));
  const coverage = new Map();

  const claim = (screenId, figmaNodeId, source, kind) => {
    const screen = flowAScreens.get(screenId);
    if (!screen) throw new Error(`Unknown Flow A coverage screen: ${screenId}`);
    if (figmaNodeId !== screen.nodeId || measurements[screenId]?.nodeId !== figmaNodeId) {
      throw new Error(`Flow A coverage node mismatch: ${screenId}/${figmaNodeId}`);
    }
    if (!Object.hasOwn(measurements[screenId].elements, source)) {
      throw new Error(`Unknown Flow A measurement coverage source: ${screenId}/${source}`);
    }
    const key = `${screenId}\0${source}`;
    if (coverage.has(key)) throw new Error(`Duplicate Flow A measurement coverage: ${screenId}/${source}`);
    coverage.set(key, kind);
  };

  for (const record of manifest.rendered) {
    if (!Array.isArray(record.sources) || record.sources.length === 0) {
      throw new Error(`Flow A rendered coverage has no sources: ${record.screenId}`);
    }
    for (const source of record.sources) claim(record.screenId, record.figmaNodeId, source, "rendered");
  }

  for (const record of manifest.classifications) {
    claim(record.screenId, record.figmaNodeId, record.source, "classified");
    if (!ALLOWED_COVERAGE_REASONS.has(record.reason)) {
      throw new Error(`Unsupported Flow A coverage reason: ${record.screenId}/${record.source}/${record.reason}`);
    }
    if (
      typeof record.evidence !== "string"
      || !record.evidence.includes(record.screenId.toUpperCase())
      || !record.evidence.includes(record.source)
      || record.evidence.length < 40
    ) {
      throw new Error(`Missing narrow Flow A coverage evidence: ${record.screenId}/${record.source}`);
    }
  }

  for (const [screenId, screen] of flowAScreens) {
    for (const source of Object.keys(measurements[screenId].elements)) {
      if (!coverage.has(`${screenId}\0${source}`)) {
        throw new Error(`Flow A measurement absent from rendered DOM and coverage manifest: ${screenId}/${source}`);
      }
    }
    const renderedRecord = manifest.rendered.find((record) => record.screenId === screenId);
    if (!renderedRecord || renderedRecord.figmaNodeId !== screen.nodeId) {
      throw new Error(`Missing Flow A rendered coverage record: ${screenId}`);
    }
  }

  return coverage;
}

export function resolveFlowACoverage({
  screenId,
  nodeId,
  measurementKeys,
  renderedSources,
  classifications
}) {
  const renderedCounts = new Map();
  for (const source of renderedSources) {
    renderedCounts.set(source, (renderedCounts.get(source) || 0) + 1);
  }
  const classified = new Map(classifications
    .filter((record) => record.screenId === screenId)
    .map((record) => [record.source, record]));

  for (const source of measurementKeys) {
    const renderedCount = renderedCounts.get(source) || 0;
    const classification = classified.get(source);
    if (renderedCount > 1) throw new Error(`Flow A measurement has multiple DOM owners: ${screenId}/${source}`);
    if (renderedCount === 0 && !classification) {
      throw new Error(`Flow A measurement absent from rendered DOM and coverage manifest: ${screenId}/${source}`);
    }
    if (renderedCount === 1 && classification) {
      throw new Error(`Flow A measurement is both rendered and classified: ${screenId}/${source}`);
    }
    if (classification && classification.figmaNodeId !== nodeId) {
      throw new Error(`Flow A classification node mismatch: ${screenId}/${source}`);
    }
  }

  for (const source of renderedCounts.keys()) {
    if (!measurementKeys.includes(source)) throw new Error(`Unknown rendered Flow A measurement: ${screenId}/${source}`);
  }

  return {
    rendered: measurementKeys.filter((source) => renderedCounts.has(source)),
    classified: measurementKeys.filter((source) => classified.has(source))
  };
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
    if (typeof asset.path !== "string" || !asset.path.startsWith("/app-preview/assets/")) {
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
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isFinite(asset.width) || !Number.isFinite(asset.height)) {
      throw new Error(`Flow A asset lacks hash/dimension evidence: ${asset.path}`);
    }
    if (asset.allowLarge === true && (
      asset.role !== "decorative"
      || typeof asset.largeAssetEvidence !== "string"
      || asset.largeAssetEvidence.length < 40
    )) {
      throw new Error(`Invalid large Flow A asset approval: ${asset.path}`);
    }
    declared.set(asset.path, asset);
  }

  const actualPaths = new Set();
  for (const asset of onboardingAssets) {
    actualPaths.add(asset.path);
    const policyAsset = declared.get(asset.path);
    if (!policyAsset) throw new Error(`Flow A asset is not declared: ${asset.path}`);
    if (asset.hash !== policyAsset.sha256) throw new Error(`Flow A asset hash mismatch: ${asset.path}`);
    if (asset.width !== policyAsset.width || asset.height !== policyAsset.height) {
      throw new Error(`Flow A asset dimension mismatch: ${asset.path}`);
    }
    if (referenceHashes.has(asset.hash)) {
      throw new Error(`Flow A asset duplicates a full-screen reference: ${asset.path}`);
    }

    const frameAspect = 393 / 852;
    const aspectSimilarity = Math.abs((asset.width / asset.height) / frameAspect - 1) <= 0.2;
    const nearFullScreen = asset.width >= 393 * 0.9
      && asset.height >= 852 * 0.7
      && aspectSimilarity;
    const nearNativeFrameSize = asset.width <= 393 * 1.25 && asset.height <= 852 * 1.25;
    if (nearFullScreen && nearNativeFrameSize) {
      throw new Error(`Flow A asset is native full-screen or near-full-screen evidence: ${asset.path}`);
    }
    if (nearFullScreen && policyAsset.allowLarge !== true) {
      throw new Error(`Flow A asset is full-screen or near-full-screen evidence: ${asset.path}`);
    }
  }
  for (const path of declared.keys()) {
    if (!actualPaths.has(path)) throw new Error(`Declared Flow A asset is missing: ${path}`);
  }

  const implementationSource = `${onboardingSource}\n${onboardingCss}`;
  if (/\/app-preview\/assets\/references\//i.test(implementationSource)) {
    throw new Error("Flow A semantic implementation may not render reference images");
  }
  if (/background(?:-image)?\s*:[^;}]*url\s*\(/i.test(onboardingCss)
    || /backgroundImage\s*=\s*["'`][^"'`]*url\s*\(/i.test(onboardingSource)) {
    throw new Error("Flow A semantic implementation may not use CSS image backgrounds");
  }

  return declared;
}
