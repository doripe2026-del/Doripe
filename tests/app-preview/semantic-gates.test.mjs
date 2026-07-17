import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import assetPolicy from "../../public/app-preview/figma/flow-a-asset-policy.json" with { type: "json" };
import coverageManifest from "../../public/app-preview/figma/flow-a-coverage-manifest.json" with { type: "json" };
import {
  authoritativeGeometrySources,
  resolveFlowACoverage,
  validateFlowACoverageManifest,
  validateFlowAAssetPolicy
} from "../../scripts/app-preview-semantic-gates.mjs";
import { readAssetMetadata } from "../../scripts/app-preview-asset-metadata.mjs";

const repositoryRoot = new URL("../../", import.meta.url);
const digest = (contents) => createHash("sha256").update(contents).digest("hex");

async function actualAssetInputs() {
  const onboardingDirectory = new URL("public/app-preview/assets/onboarding/", repositoryRoot);
  const referenceDirectory = new URL("public/app-preview/assets/references/", repositoryRoot);
  const onboardingFiles = await readdir(onboardingDirectory);
  const referenceFiles = await readdir(referenceDirectory);
  const localAssetPaths = new Set([
    ...onboardingFiles.map((name) => `/app-preview/assets/onboarding/${name}`),
    ...assetPolicy.assets.map((asset) => asset.path)
  ]);

  return {
    onboardingAssets: await Promise.all([...localAssetPaths].map(async (path) => {
      const contents = await readFile(new URL(`public${path}`, repositoryRoot));
      return { path, ...readAssetMetadata(contents, path) };
    })),
    referenceHashes: new Set(await Promise.all(referenceFiles.map(async (name) => (
      digest(await readFile(new URL(name, referenceDirectory)))
    )))),
    onboardingSource: await readFile(new URL("public/app-preview/screens/onboarding.js", repositoryRoot), "utf8"),
    onboardingCss: await readFile(new URL("public/app-preview/styles/onboarding.css", repositoryRoot), "utf8")
  };
}

test("authoritative Flow A geometry is derived from measurements and contracts, not DOM opt-in", () => {
  const a3 = authoritativeGeometrySources("a3", measurements, actionContract);
  assert.deepEqual(a3, Object.keys(measurements.a3.elements));

  const a21 = authoritativeGeometrySources("a21", measurements, actionContract);
  assert.deepEqual(a21, Object.keys(measurements.a21.elements));
});

test("every Flow A measurement requires one DOM owner or one exact reviewed classification", () => {
  assert.doesNotThrow(() => validateFlowACoverageManifest({
    manifest: coverageManifest,
    inventory,
    measurements
  }));

  assert.throws(() => resolveFlowACoverage({
    screenId: "a1",
    nodeId: "446:34",
    measurementKeys: ["rendered", "missing"],
    renderedSources: ["rendered"],
    classifications: []
  }), /absent from rendered DOM and coverage manifest/);

  assert.throws(() => resolveFlowACoverage({
    screenId: "a1",
    nodeId: "446:34",
    measurementKeys: ["duplicate"],
    renderedSources: ["duplicate"],
    classifications: [{
      screenId: "a1",
      figmaNodeId: "446:34",
      source: "duplicate",
      reason: "vector-child-owned-by-component-asset",
      evidence: "The vector is owned by a separately rendered component asset."
    }]
  }), /both rendered and classified/);
});

test("the Flow A asset policy covers every onboarding asset and rejects reference-screen substitutes", async () => {
  const inputs = await actualAssetInputs();
  assert.ok(assetPolicy.assets.some(({ path }) => path === "/app-preview/assets/icons/back.svg"));
  assert.ok(assetPolicy.assets.every(({ sha256, width, height }) => (
    /^[a-f0-9]{64}$/.test(sha256) && Number.isFinite(width) && Number.isFinite(height)
  )));
  assert.doesNotThrow(() => validateFlowAAssetPolicy({
    policy: assetPolicy,
    flowAScreenIds: inventory.filter((screen) => screen.group === "A").map((screen) => screen.id),
    ...inputs
  }));

  assert.throws(() => validateFlowAAssetPolicy({
    policy: {
      version: 1,
      assets: [{
        path: "/app-preview/assets/onboarding/copied-screen.png",
        role: "decorative",
        screens: ["a1"],
        allowLarge: true,
        largeAssetEvidence: "A reviewed synthetic large decorative asset used to exercise exact-reference rejection.",
        sha256: "b".repeat(64),
        width: 100,
        height: 100
      }]
    },
    flowAScreenIds: ["a1"],
    onboardingAssets: [{
      path: "/app-preview/assets/onboarding/copied-screen.png",
      hash: "b".repeat(64),
      width: 100,
      height: 100
    }],
    referenceHashes: new Set(["b".repeat(64)]),
    onboardingSource: "",
    onboardingCss: ""
  }), /duplicates a full-screen reference/);

  assert.throws(() => validateFlowAAssetPolicy({
    policy: {
      version: 1,
      assets: [{
        path: "/app-preview/assets/renamed-current-screen.png",
        role: "decorative",
        screens: ["a1"],
        allowLarge: true,
        largeAssetEvidence: "Synthetic approval that must not override the native full-screen evidence rejection rule.",
        sha256: "a".repeat(64),
        width: 393,
        height: 852
      }]
    },
    flowAScreenIds: ["a1"],
    onboardingAssets: [{
      path: "/app-preview/assets/renamed-current-screen.png",
      hash: "a".repeat(64),
      width: 393,
      height: 852
    }],
    referenceHashes: new Set(["reference-hash"]),
    onboardingSource: "",
    onboardingCss: ""
  }), /native full-screen or near-full-screen/);
});

test("the Flow A asset gate rejects CSS image backgrounds and undeclared files", () => {
  const base = {
    policy: {
      version: 1,
      assets: [{
        path: "/app-preview/assets/onboarding/icon.svg",
        role: "component",
        screens: ["a1"],
        sha256: "c".repeat(64),
        width: 24,
        height: 24
      }]
    },
    flowAScreenIds: ["a1"],
    onboardingAssets: [{
      path: "/app-preview/assets/onboarding/icon.svg",
      hash: "c".repeat(64),
      width: 24,
      height: 24
    }],
    referenceHashes: new Set(["reference-hash"]),
    onboardingSource: "",
    onboardingCss: ""
  };

  assert.throws(() => validateFlowAAssetPolicy({
    ...base,
    onboardingAssets: [...base.onboardingAssets, {
      path: "/app-preview/assets/onboarding/undeclared.png",
      hash: "d".repeat(64),
      width: 20,
      height: 20
    }]
  }), /not declared/);

  assert.throws(() => validateFlowAAssetPolicy({
    ...base,
    onboardingCss: ".screen { background-image: url('/app-preview/assets/onboarding/icon.svg'); }"
  }), /CSS image backgrounds/);
});
