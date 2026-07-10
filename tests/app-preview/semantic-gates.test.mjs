import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import assetPolicy from "../../public/app-preview/figma/flow-a-asset-policy.json" with { type: "json" };
import {
  authoritativeGeometrySources,
  validateFlowAAssetPolicy
} from "../../scripts/app-preview-semantic-gates.mjs";

const repositoryRoot = new URL("../../", import.meta.url);
const digest = (contents) => createHash("sha256").update(contents).digest("hex");

async function actualAssetInputs() {
  const onboardingDirectory = new URL("public/app-preview/assets/onboarding/", repositoryRoot);
  const referenceDirectory = new URL("public/app-preview/assets/references/", repositoryRoot);
  const onboardingFiles = await readdir(onboardingDirectory);
  const referenceFiles = await readdir(referenceDirectory);

  return {
    onboardingAssets: await Promise.all(onboardingFiles.map(async (name) => ({
      path: `/app-preview/assets/onboarding/${name}`,
      hash: digest(await readFile(new URL(name, onboardingDirectory)))
    }))),
    referenceHashes: new Set(await Promise.all(referenceFiles.map(async (name) => (
      digest(await readFile(new URL(name, referenceDirectory)))
    )))),
    onboardingSource: await readFile(new URL("public/app-preview/screens/onboarding.js", repositoryRoot), "utf8"),
    onboardingCss: await readFile(new URL("public/app-preview/styles/onboarding.css", repositoryRoot), "utf8")
  };
}

test("authoritative Flow A geometry is derived from measurements and contracts, not DOM opt-in", () => {
  const a3 = authoritativeGeometrySources("a3", measurements, actionContract);
  assert.ok(a3.includes("screen/title"));
  assert.ok(a3.includes("action/primary"));
  assert.ok(a3.includes("action/primary/bg#2"));
  assert.ok(!a3.includes("Vector"));

  const a21 = authoritativeGeometrySources("a21", measurements, actionContract);
  assert.deepEqual(a21, [
    "COMPONENT / floating glass travel status",
    "travel status / icon background",
    "ICON / Send Plane",
    "Text / TravelTransition / Destination",
    "Text / travel subtitle",
    "COMPONENT / loading dots",
    "Loading / dot 1",
    "Loading / dot 2",
    "Loading / dot 3"
  ]);
});

test("the Flow A asset policy covers every onboarding asset and rejects reference-screen substitutes", async () => {
  const inputs = await actualAssetInputs();
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
        allowLarge: true
      }]
    },
    flowAScreenIds: ["a1"],
    onboardingAssets: [{ path: "/app-preview/assets/onboarding/copied-screen.png", hash: "reference-hash" }],
    referenceHashes: new Set(["reference-hash"]),
    onboardingSource: "",
    onboardingCss: ""
  }), /duplicates a full-screen reference/);
});

test("the Flow A asset gate rejects CSS image backgrounds and undeclared files", () => {
  const base = {
    policy: {
      version: 1,
      assets: [{ path: "/app-preview/assets/onboarding/icon.svg", role: "component", screens: ["a1"] }]
    },
    flowAScreenIds: ["a1"],
    onboardingAssets: [{ path: "/app-preview/assets/onboarding/icon.svg", hash: "component-hash" }],
    referenceHashes: new Set(["reference-hash"]),
    onboardingSource: "",
    onboardingCss: ""
  };

  assert.throws(() => validateFlowAAssetPolicy({
    ...base,
    onboardingAssets: [...base.onboardingAssets, {
      path: "/app-preview/assets/onboarding/undeclared.png",
      hash: "other-hash"
    }]
  }), /not declared/);

  assert.throws(() => validateFlowAAssetPolicy({
    ...base,
    onboardingCss: ".screen { background-image: url('/app-preview/assets/onboarding/icon.svg'); }"
  }), /CSS image backgrounds/);
});
