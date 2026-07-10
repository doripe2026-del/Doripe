import assert from "node:assert/strict";
import test from "node:test";
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import measurements from "../../public/app-preview/figma/screen-measurements.json" with { type: "json" };
import masks from "../../public/app-preview/figma/visual-masks.json" with { type: "json" };

test("every final screen has complete Figma evidence", () => {
  assert.ok(inventory.length >= 50);
  assert.equal(new Set(inventory.map((item) => item.id)).size, inventory.length);
  for (const screen of inventory) {
    assert.match(screen.id, /^[a-e]\d+[a-z0-9-]*$/);
    assert.match(screen.nodeId, /^\d+:\d+$/);
    assert.ok(["A", "B", "C", "D", "E"].includes(screen.group));
    assert.equal(measurements[screen.id].frame.width, 393);
    assert.equal(measurements[screen.id].frame.height, 852);
    assert.equal(screen.reference, `/app-preview/assets/references/${screen.id}.png`);
    assert.ok(Array.isArray(masks[screen.id] ?? []));
  }
});
