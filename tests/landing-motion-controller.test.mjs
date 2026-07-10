import test from "node:test";
import assert from "node:assert/strict";
import { initLandingMotion, resolveSceneState } from "../public/home/landing-motion.js";

test("reduced motion always resolves to the final state", () => {
  assert.equal(resolveSceneState({ visible: true, reducedMotion: true }), "final");
  assert.equal(resolveSceneState({ visible: false, reducedMotion: true }), "final");
});

test("visible scenes play and offscreen scenes pause", () => {
  assert.equal(resolveSceneState({ visible: true, reducedMotion: false }), "playing");
  assert.equal(resolveSceneState({ visible: false, reducedMotion: false }), "paused");
});

test("ending reduced motion restores each observed scene state", () => {
  const visibleScene = { dataset: {} };
  const offscreenScene = { dataset: {} };
  const listeners = new Set();
  let observer;
  const media = {
    matches: true,
    addEventListener(type, listener) {
      if (type === "change") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") listeners.delete(listener);
    },
  };
  const documentRef = {
    querySelectorAll(selector) {
      assert.equal(selector, "[data-motion-scene]");
      return [visibleScene, offscreenScene];
    },
  };
  const windowRef = {
    matchMedia() {
      return media;
    },
    IntersectionObserver: class {
      constructor(callback) {
        observer = { callback, disconnect() {}, observe() {} };
        return observer;
      }
    },
  };

  initLandingMotion(documentRef, windowRef);
  observer.callback([
    { target: visibleScene, isIntersecting: true },
    { target: offscreenScene, isIntersecting: false },
  ]);

  media.matches = false;
  listeners.forEach((listener) => listener());

  assert.equal(visibleScene.dataset.motionState, "playing");
  assert.equal(offscreenScene.dataset.motionState, "paused");
});
