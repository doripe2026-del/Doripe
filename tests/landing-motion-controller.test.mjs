import test from "node:test";
import assert from "node:assert/strict";
import {
  applySceneState,
  initLandingMotion,
  resolveSceneState,
} from "../public/home/landing-motion.js";

test("applySceneState updates only the scene state attribute", () => {
  const element = { dataset: { motionState: "paused" } };
  applySceneState(element, "playing");
  assert.equal(element.dataset.motionState, "playing");
});

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
      if (selector === "[data-motion-scene]") return [visibleScene, offscreenScene];
      if (selector === "[data-motion-scene] img") return [];
      assert.fail(`unexpected selector ${selector}`);
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

test("a failed image marks only its nearest media shell as missing", () => {
  const scene = { dataset: {} };
  const missingClasses = new Set();
  const failedImageClasses = new Set();
  const healthyImageClasses = new Set();
  const listeners = new Map();
  const mediaShell = { classList: { add: (name) => missingClasses.add(name) } };
  const failedImage = {
    classList: { add: (name) => failedImageClasses.add(name) },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    closest() {
      return mediaShell;
    },
  };
  const healthyImage = {
    classList: { add: (name) => healthyImageClasses.add(name) },
    addEventListener() {},
    closest() {
      return mediaShell;
    },
  };
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === "[data-motion-scene]") return [scene];
      if (selector === "[data-motion-scene] img") return [failedImage, healthyImage];
      return [];
    },
  };
  const media = { matches: false, addEventListener() {}, removeEventListener() {} };
  const windowRef = {
    matchMedia: () => media,
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
  };

  initLandingMotion(documentRef, windowRef);
  const handleError = listeners.get("error");
  assert.equal(typeof handleError, "function");
  handleError();

  assert(missingClasses.has("is-media-missing"));
  assert(failedImageClasses.has("is-media-missing__image"));
  assert.equal(healthyImageClasses.size, 0);
});

test("destroy removes controller listeners and disconnects observation", () => {
  const scene = { dataset: {} };
  const imageListeners = new Set();
  const mediaListeners = new Set();
  let disconnected = false;
  const image = {
    addEventListener(type, listener) {
      if (type === "error") imageListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "error") imageListeners.delete(listener);
    },
  };
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === "[data-motion-scene]") return [scene];
      if (selector === "[data-motion-scene] img") return [image];
      return [];
    },
  };
  const media = {
    matches: false,
    addEventListener(type, listener) {
      if (type === "change") mediaListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "change") mediaListeners.delete(listener);
    },
  };
  const windowRef = {
    matchMedia: () => media,
    IntersectionObserver: class {
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  };

  const controller = initLandingMotion(documentRef, windowRef);
  assert.equal(imageListeners.size, 1);
  assert.equal(mediaListeners.size, 1);

  controller.destroy();

  assert.equal(imageListeners.size, 0);
  assert.equal(mediaListeners.size, 0);
  assert.equal(disconnected, true);
});
