import test from "node:test";
import assert from "node:assert/strict";
import { resolveSceneState } from "../public/home/landing-motion.js";

test("reduced motion always resolves to the final state", () => {
  assert.equal(resolveSceneState({ visible: true, reducedMotion: true }), "final");
  assert.equal(resolveSceneState({ visible: false, reducedMotion: true }), "final");
});

test("visible scenes play and offscreen scenes pause", () => {
  assert.equal(resolveSceneState({ visible: true, reducedMotion: false }), "playing");
  assert.equal(resolveSceneState({ visible: false, reducedMotion: false }), "paused");
});
