export function resolveSceneState({ visible, reducedMotion }) {
  if (reducedMotion) return "final";
  return visible ? "playing" : "paused";
}

export function applySceneState(element, state) {
  element.dataset.motionState = state;
}

export function initLandingMotion(documentRef = document, windowRef = window) {
  const scenes = [...documentRef.querySelectorAll("[data-motion-scene]")];
  const images = [...documentRef.querySelectorAll("[data-motion-scene] img")];
  const visibility = new Map(scenes.map((scene) => [scene, false]));
  const media = windowRef.matchMedia("(prefers-reduced-motion: reduce)");
  const imageErrorHandlers = new Map();

  const updateAll = () => {
    scenes.forEach((scene) => applySceneState(scene, resolveSceneState({
      visible: visibility.get(scene),
      reducedMotion: media.matches,
    })));
  };

  const observer = new windowRef.IntersectionObserver((entries) => {
    for (const entry of entries) {
      visibility.set(entry.target, entry.isIntersecting);
      applySceneState(entry.target, resolveSceneState({
        visible: entry.isIntersecting,
        reducedMotion: media.matches,
      }));
    }
  }, { threshold: 0.2 });

  scenes.forEach((scene) => {
    applySceneState(scene, resolveSceneState({
      visible: visibility.get(scene),
      reducedMotion: media.matches,
    }));
    observer.observe(scene);
  });
  images.forEach((image) => {
    const handleError = () => {
      image.closest("figure, article, div")?.classList.add("is-media-missing");
      image.classList.add("is-media-missing__image");
    };
    imageErrorHandlers.set(image, handleError);
    image.addEventListener("error", handleError);
  });
  media.addEventListener?.("change", updateAll);

  return {
    destroy() {
      observer.disconnect();
      media.removeEventListener?.("change", updateAll);
      imageErrorHandlers.forEach((handleError, image) => {
        image.removeEventListener("error", handleError);
      });
    },
  };
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initLandingMotion();
}
