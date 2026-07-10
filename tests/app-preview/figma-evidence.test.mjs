import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const allowedMaskReasons = new Set(["photo", "video", "map", "user-generated-text"]);
const uniqueAStateNodeIds = new Set([
  "579:991",
  "579:1063",
  "579:1015",
  "579:1039",
  "579:1102",
  "579:1127",
  "579:1162"
]);
const overlaps = (left, right) => (
  left.x < right.x + right.width
  && right.x < left.x + left.width
  && left.y < right.y + right.height
  && right.y < left.y + left.height
);

test("every final screen has complete and internally consistent Figma evidence", async () => {
  assert.ok(inventory.length >= 50);
  assert.equal(new Set(inventory.map((item) => item.id)).size, inventory.length);

  const inventoryIds = inventory.map((item) => item.id).sort();
  assert.deepEqual(Object.keys(measurements).sort(), inventoryIds);
  assert.deepEqual(Object.keys(masks).sort(), inventoryIds);

  const flowAScreens = inventory.filter((item) => item.group === "A");
  assert.equal(flowAScreens.length, 22);
  assert.equal(inventory.find((item) => item.id === "a1")?.nodeId, "446:34");
  for (const nodeId of uniqueAStateNodeIds) {
    assert.ok(flowAScreens.some((screen) => screen.nodeId === nodeId), `missing unique A state ${nodeId}`);
  }

  for (const screen of inventory) {
    assert.match(screen.id, /^[a-e]\d+[a-z0-9-]*$/);
    assert.match(screen.nodeId, /^\d+:\d+$/);
    assert.ok(["A", "B", "C", "D", "E"].includes(screen.group));
    assert.equal(measurements[screen.id].nodeId, screen.nodeId);
    assert.equal(measurements[screen.id].frame.width, 393);
    assert.equal(measurements[screen.id].frame.height, 852);
    assert.equal(screen.reference, `/app-preview/assets/references/${screen.id}.png`);
    assert.ok(Object.hasOwn(masks, screen.id));
    assert.ok(Array.isArray(masks[screen.id]));
    assert.deepEqual(screen.masks, masks[screen.id]);

    if (screen.group === "A") {
      assert.ok(screen.provenance);
      assert.ok([
        "Flow / A Onboarding",
        "Flow / A Onboarding_수정"
      ].includes(screen.provenance.sourceSection));
      assert.ok(screen.provenance.rationale.trim().length > 0);
      assert.ok(Array.isArray(screen.provenance.alternateNodeIds));
      for (const nodeId of screen.provenance.alternateNodeIds) assert.match(nodeId, /^\d+:\d+$/);
    }

    for (const mask of masks[screen.id]) {
      assert.ok(allowedMaskReasons.has(mask.reason));
      for (const key of ["x", "y", "width", "height"]) assert.ok(Number.isFinite(mask[key]));
      assert.ok(mask.x >= 0);
      assert.ok(mask.y >= 0);
      assert.ok(mask.width > 0);
      assert.ok(mask.height > 0);
      assert.ok(mask.x + mask.width <= 393);
      assert.ok(mask.y + mask.height <= 852);
    }

    const png = await readFile(join(repositoryRoot, "public", screen.reference.replace(/^\//, "")));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 393);
    assert.equal(png.readUInt32BE(20), 852);
  }

  const c6MapMasks = masks.c6.filter((mask) => mask.reason === "map");
  assert.ok(c6MapMasks.length > 0);
  assert.ok(c6MapMasks.every((mask) => mask.y + mask.height <= 220));

  const b4ProtectedUi = [
    { x: 17, y: 289, width: 76, height: 32 },
    { x: 327, y: 210, width: 50, height: 50 },
    { x: 327, y: 272, width: 50, height: 50 }
  ];
  const b4PhotoMasks = masks.b4.filter((mask) => mask.reason === "photo");
  assert.ok(b4PhotoMasks.length > 1);
  for (const mask of b4PhotoMasks) {
    assert.ok(b4ProtectedUi.every((fixedUi) => !overlaps(mask, fixedUi)));
  }

  assert.doesNotMatch(JSON.stringify({ inventory, measurements, masks }), /https?:\/\//i);
});
