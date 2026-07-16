import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import actionContract from "../../public/app-preview/figma/action-contract.json" with { type: "json" };
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };
import { DISCOVER_RENDERERS } from "../../public/app-preview/screens/discover.js";
import { validateFlowBLiveEvidence } from "../../scripts/app-preview-semantic-gates.mjs";

const repositoryRoot = new URL("../../", import.meta.url);
const liveEvidenceUrl = new URL(
  "public/app-preview/figma/flow-b-live-evidence.json",
  repositoryRoot
);
const expectedFlowB = [
  ["b1", "446:507"],
  ["b2", "446:596"],
  ["b3", "446:646"],
  ["b4", "446:682"],
  ["b5", "446:818"],
  ["b6", "446:876"],
  ["b7", "446:1000"],
  ["b8", "446:1017"],
  ["b9", "446:1070"],
  ["b10", "446:1106"],
  ["b11", "446:2667"],
  ["b12", "446:2792"],
  ["b13", "446:3042"]
];

const actionsFor = (screenId, actionId) => actionContract.actions.filter((record) => (
  record.screenId === screenId && record.actionId === actionId
));

test("Flow B discovery renderers accept the loaded data snapshot", () => {
  assert.equal(DISCOVER_RENDERERS.b4.length, 2);
  assert.equal(DISCOVER_RENDERERS.b12.length, 2);
});

test("Flow B inventory contains the 13 exact live top-level screens", () => {
  assert.equal(inventory.length, 55);
  assert.deepEqual(
    inventory.filter(({ group }) => group === "B").map(({ id, nodeId }) => [id, nodeId]),
    expectedFlowB
  );
  assert.ok(!inventory.some(({ nodeId }) => nodeId === "446:1018"));
  assert.ok(!inventory.some(({ nodeId }) => (
    ["446:1348", "446:2341", "446:2462", "446:2530"].includes(nodeId)
  )));
  assert.equal(new Set(inventory.map(({ id }) => id)).size, inventory.length);
  assert.equal(new Set(inventory.map(({ nodeId }) => nodeId)).size, inventory.length);
});

test("Flow B references match the current read-only Figma capture registry", async () => {
  assert.ok(existsSync(liveEvidenceUrl), "missing Flow B live evidence registry");
  const evidence = JSON.parse(await readFile(liveEvidenceUrl, "utf8"));
  const referenceHashes = new Map();

  assert.equal(evidence.version, 1);
  assert.equal(evidence.fileKey, "TfZAtv9JUy508otim4P23w");
  assert.equal(evidence.rootNodeId, "446:33");
  assert.ok(Number.isFinite(Date.parse(evidence.capturedAt)));
  assert.equal(evidence.capture.designContextTool, "get_design_context");
  assert.equal(evidence.capture.screenshotTool, "get_screenshot");
  assert.equal(evidence.capture.readOnly, true);
  assert.deepEqual(evidence.screens.map(({ id, nodeId }) => [id, nodeId]), expectedFlowB);

  for (const record of evidence.screens) {
    assert.equal(record.width, 393, record.id);
    assert.equal(record.height, 852, record.id);
    assert.equal(record.designContextRead, true, record.id);
    assert.match(record.liveScreenshotSha256, /^[a-f0-9]{64}$/, record.id);
    const png = await readFile(new URL(`public${record.reference}`, repositoryRoot));
    assert.equal(png.readUInt32BE(16), 393, record.id);
    assert.equal(png.readUInt32BE(20), 852, record.id);
    const hash = createHash("sha256").update(png).digest("hex");
    referenceHashes.set(record.id, hash);
    assert.equal(hash, record.liveScreenshotSha256, record.id);
  }
  assert.doesNotThrow(() => validateFlowBLiveEvidence({ evidence, inventory, referenceHashes }));
  assert.throws(() => validateFlowBLiveEvidence({
    evidence: { ...evidence, screens: evidence.screens.slice(0, -1) },
    inventory,
    referenceHashes
  }), /missing screen/);
});

test("Flow B measurements and masks cover exact frame geometry and only mask dynamic content", () => {
  const overlaps = (left, right) => (
    left.x < right.x + right.width
    && right.x < left.x + left.width
    && left.y < right.y + right.height
    && right.y < left.y + left.height
  );
  const dynamicSource = /(photo|media|avatar|data\/|user|username|bio|comment|tag|chip|count|stat num|creator|caption|place name|related-place|distance|meta|pill|walk time|following|filter|segment|save|route|address|opening-hours|menu)/i;

  for (const [screenId, nodeId] of expectedFlowB) {
    assert.equal(measurements[screenId].nodeId, nodeId);
    assert.deepEqual(measurements[screenId].frame, { width: 393, height: 852 });
    assert.ok(Array.isArray(masks[screenId]));
    assert.ok(masks[screenId].every(({ reason }) => ["photo", "video", "user-generated-text"].includes(reason)), screenId);
    if (screenId === "b4") {
      let maskedPixels = 0;
      for (let y = 0; y < 852; y += 1) {
        for (let x = 0; x < 393; x += 1) {
          if (masks[screenId].some((mask) => x >= mask.x && x < mask.x + mask.width && y >= mask.y && y < mask.y + mask.height)) maskedPixels += 1;
        }
      }
      assert.ok(maskedPixels / (393 * 852) < 0.7, `${screenId} masks too much of the screen`);
    }
    for (const mask of masks[screenId].filter(({ reason }) => reason === "user-generated-text")) {
      const measuredDynamicRegions = Object.entries(measurements[screenId].elements)
        .filter(([source]) => dynamicSource.test(source))
        .map(([, rect]) => rect);
      assert.ok(measuredDynamicRegions.some((rect) => overlaps(mask, rect)), `${screenId}/${JSON.stringify(mask)}`);
    }
  }
});

test("visual regressions cannot hide current buttons, headings, or text with runtime masks", async () => {
  for (const file of ["discover.spec.mjs", "saved.spec.mjs", "visual.spec.mjs"]) {
    const source = await readFile(new URL(`tests/app-preview/${file}`, repositoryRoot), "utf8");
    assert.doesNotMatch(source, /elementBoundingMasks|TASK5_(?:ATOMIC_)?MASK_SELECTORS/);
    assert.doesNotMatch(source, /locator\((?:"|')button(?:"|')\).*boundingBox/s);
  }
});

test("Flow B action contract preserves Brain navigation truth on visible controls", () => {
  const destinations = [
    ["b1", "open-following-list", "b13"],
    ["b1", "open-profile", "b12"],
    ["b4", "open-profile", "b12"],
    ["b4", "open-official-place", "b10"],
    ["b7", "open-profile", "b12"],
    ["b8", "open-profile", "b12"],
    ["b10", "open-other-media", "b3"],
    ["b10", "open-related-places", "b11"],
    ["b11", "open-place", "b10"],
    ["b12", "open-content", "b4"],
    ["b13", "open-profile", "b12"]
  ];

  for (const [screenId, actionId, destination] of destinations) {
    const records = actionsFor(screenId, actionId);
    assert.ok(records.length > 0, `${screenId}/${actionId}`);
    assert.ok(records.every((record) => record.effect.destination === destination), `${screenId}/${actionId}`);
  }
});
