import assert from "node:assert/strict";
import test from "node:test";
import inventory from "../../public/app-preview/figma/screen-inventory.json" with { type: "json" };
import { getScreen, listScreens } from "../../public/app-preview/screen-registry.js";

test("registry creates one valid screen definition for every evidence item", () => {
  const screens = listScreens();

  assert.equal(screens.length, 59);
  assert.equal(screens.length, inventory.length);
  assert.equal(new Set(screens.map((screen) => screen.id)).size, inventory.length);

  for (const item of inventory) {
    const screen = getScreen(item.id);
    assert.ok(screen, `missing ${item.id}`);
    assert.equal(screen.id, item.id);
    assert.equal(screen.name, item.name);
    assert.equal(screen.group, item.group);
    assert.equal(screen.figmaNodeId, item.nodeId);
    assert.equal(screen.reference, item.reference);
    assert.equal(typeof screen.render, "function");
    assert.ok(Array.isArray(screen.actions));
    assert.match(screen.figmaNodeId, /^\d+:\d+$/);
    assert.ok(["A", "B", "C", "D", "E"].includes(screen.group));
  }
});

test("registry finds screens by id and filters by group", () => {
  assert.equal(getScreen("a1").name, "A1 / 시작");
  assert.equal(getScreen("unknown"), null);
  assert.ok(listScreens("A").every((screen) => screen.group === "A"));
  assert.deepEqual(listScreens("Z"), []);
});
