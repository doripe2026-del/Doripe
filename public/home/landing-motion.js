export function resolveSceneState({ visible, reducedMotion }) {
  if (reducedMotion) return "final";
  return visible ? "playing" : "paused";
}

export function applySceneState(element, state) {
  element.dataset.motionState = state;
}

export function initLandingMotion(documentRef = document, windowRef = window) {
  const scenes = [...documentRef.querySelectorAll("[data-motion-scene]")];
  const media = windowRef.matchMedia("(prefers-reduced-motion: reduce)");

  const updateAll = () => {
    if (!media.matches) return;
    scenes.forEach((scene) => applySceneState(scene, "final"));
  };

  const observer = new windowRef.IntersectionObserver((entries) => {
    for (const entry of entries) {
      applySceneState(entry.target, resolveSceneState({
        visible: entry.isIntersecting,
        reducedMotion: media.matches,
      }));
    }
  }, { threshold: 0.2 });

  scenes.forEach((scene) => {
    applySceneState(scene, media.matches ? "final" : "paused");
    observer.observe(scene);
  });
  media.addEventListener?.("change", updateAll);

  return {
    destroy() {
      observer.disconnect();
      media.removeEventListener?.("change", updateAll);
    },
  };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initLandingMotion();
}
