import assert from "node:assert/strict";
import test from "node:test";

import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import manifest from "../../public/app-preview/figma/flow-b-coverage-manifest.json" with { type: "json" };
import {
  resolveFlowBCoverage,
  validateFlowBCoverageManifest
} from "../../scripts/app-preview-semantic-gates.mjs";

test("every Flow B measurement has exactly one semantic owner or reviewed classification", () => {
  assert.doesNotThrow(() => validateFlowBCoverageManifest({ manifest, inventory, measurements }));

  assert.throws(() => resolveFlowBCoverage({
    screenId: "b1",
    nodeId: "446:507",
    measurementKeys: ["missing"],
    renderedSources: [],
    classifications: []
  }), /absent from rendered DOM and coverage manifest/);
});
