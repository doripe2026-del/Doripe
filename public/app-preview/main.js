import { getScreen, listScreens } from "./screen-registry.js";
import { createPreviewState } from "./state.js";
import { dispatchAction } from "./transitions.js";

const groups = ["A", "B", "C", "D", "E"];
const state = createPreviewState();
const phoneRoot = document.querySelector("#phone-root");
const reviewList = document.querySelector("#review-list");
const resetButton = document.querySelector("#review-reset");
let interactionState = state.getState();
let activePointerTarget = null;

resetButton.dataset.action = "review-reset";

function readScreenIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.has("screen") ? params.get("screen") : null;
}

function writeScreenIdToUrl(screenId, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ screen: screenId }).toString();
  window.history[replace ? "replaceState" : "pushState"]({}, "", url);
}

function renderReviewList() {
  const currentState = state.getState();
  reviewList.replaceChildren(...groups.map((group) => {
    const section = document.createElement("section");
    section.className = "review-group";

    const title = document.createElement("h2");
    title.textContent = `Flow ${group}`;
    section.append(title);

    for (const screen of listScreens(group)) {
      const row = document.createElement("div");
      row.className = "review-screen";
      row.dataset.reviewScreenId = screen.id;

      const navigationButton = document.createElement("button");
      navigationButton.type = "button";
      navigationButton.className = "review-screen-link";
      navigationButton.textContent = screen.name;
      navigationButton.setAttribute("aria-current", currentState.currentScreenId === screen.id ? "page" : "false");
      navigationButton.dataset.action = "review-navigate";
      navigationButton.dataset.id = screen.id;

      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.className = "review-status";
      const isComplete = currentState.reviewStatus[screen.id] === "complete";
      statusButton.textContent = isComplete ? "완료" : "미검토";
      statusButton.setAttribute("aria-pressed", String(isComplete));
      statusButton.dataset.action = "review-toggle-status";
      statusButton.dataset.id = screen.id;

      row.append(navigationButton, statusButton);
      section.append(row);
    }

    return section;
  }));
}

function renderEvidenceScreen(screen) {
  phoneRoot.replaceChildren(screen.render());
  phoneRoot.dataset.previewMode = "evidence";
}

function renderUnknownScreen(screenId) {
  phoneRoot.replaceChildren();
  phoneRoot.dataset.previewMode = "review-error";

  const errorPanel = document.createElement("section");
  errorPanel.className = "review-error";
  const heading = document.createElement("h1");
  heading.textContent = "화면을 찾을 수 없습니다";
  const invalidId = document.createElement("code");
  invalidId.textContent = screenId;
  const returnButton = document.createElement("button");
  returnButton.type = "button";
  returnButton.textContent = "첫 화면으로 돌아가기";
  returnButton.dataset.action = "review-return-home";
  returnButton.dataset.id = "a1";
  errorPanel.append(heading, invalidId, returnButton);
  phoneRoot.append(errorPanel);
}

function renderScreen(screenId) {
  const screen = getScreen(screenId);
  if (!screen) {
    renderUnknownScreen(screenId);
    renderReviewList();
    return;
  }

  renderEvidenceScreen(screen);
  renderReviewList();
}

function navigate(screenId, { replace = false } = {}) {
  const screen = getScreen(screenId);
  if (!screen) {
    renderUnknownScreen(screenId);
    return;
  }

  state.navigate(screenId, { replace });
  interactionState = state.getState();
  writeScreenIdToUrl(screenId, { replace });
  renderScreen(screenId);
}

function renderFromUrl() {
  const screenId = readScreenIdFromUrl();
  if (screenId !== null && !getScreen(screenId)) {
    renderScreen(screenId);
    return;
  }

  const selectedScreenId = screenId || state.getState().currentScreenId;
  state.navigate(selectedScreenId, { replace: true });
  interactionState = state.getState();
  renderScreen(selectedScreenId);
}

function readActionPayload(target) {
  const id = target.getAttribute("data-id");
  const payload = { state: interactionState };

  if (id !== null) payload.id = id;
  if (target.dataset.type) payload.type = target.dataset.type;
  if (target.dataset.placeId) payload.placeId = target.dataset.placeId;
  if (target.dataset.mediaId) payload.mediaId = target.dataset.mediaId;
  if (target.dataset.userId) payload.userId = target.dataset.userId;
  if (target.dataset.routeId) payload.routeId = target.dataset.routeId;
  if (target.dataset.commentId) payload.commentId = target.dataset.commentId;
  if ("value" in target) payload.value = target.value;
  if ("checked" in target) payload.checked = target.checked;

  return payload;
}

function canonicalPreviewLink(screenId, payload) {
  const url = new URL("/app-preview/", window.location.origin);
  const target = interactionState.selections?.shareTarget;
  const type = target?.type || payload.type;
  const id = target?.id || payload.id;

  url.searchParams.set("screen", screenId);
  if (type) url.searchParams.set("type", type);
  if (id) url.searchParams.set("id", id);
  return url.href;
}

async function copyCanonicalLink(link) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(link);
    return;
  }

  const input = document.createElement("textarea");
  input.value = link;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Preview link copy failed");
}

function setEffectToast(kind, message) {
  interactionState = {
    ...interactionState,
    toast: { kind, message, duration: 2500 }
  };
  state.replace(interactionState);
  interactionState = state.getState();
  phoneRoot.dataset.toastKind = kind;
}

async function runDomEffect(effect, screenId, payload) {
  if (!effect || effect === "none") return;

  const link = canonicalPreviewLink(screenId, payload);
  if (effect === "share" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Doripe", url: link });
      return;
    } catch {
      // Rejected and unsupported shares use the same deterministic copy fallback.
    }
  }

  try {
    await copyCanonicalLink(link);
    setEffectToast("success", "링크를 복사했어요");
  } catch {
    setEffectToast("error", "링크를 복사하지 못했어요");
  }
}

function dispatchTargetAction(target) {
  const actionId = target.dataset.action;
  const screenId = target.closest("[data-screen-id]")?.dataset.screenId
    || interactionState.currentScreenId;
  const payload = readActionPayload(target);
  const result = dispatchAction(screenId, actionId, payload);

  state.replace(result.state);
  interactionState = state.getState();
  if (result.nextScreenId) {
    writeScreenIdToUrl(result.nextScreenId);
    renderScreen(result.nextScreenId);
  }
  void runDomEffect(result.effect, screenId, payload);
}

function handleReviewAction(actionId, id) {
  if (actionId === "review-navigate" || actionId === "review-return-home") {
    navigate(id || "a1");
    return true;
  }

  if (actionId === "review-toggle-status") {
    const isComplete = state.getState().reviewStatus[id] === "complete";
    state.setReviewStatus(id, isComplete ? "unreviewed" : "complete");
    interactionState = {
      ...interactionState,
      reviewStatus: { ...state.getState().reviewStatus }
    };
    renderReviewList();
    return true;
  }

  if (actionId === "review-reset") {
    state.reset();
    interactionState = state.getState();
    writeScreenIdToUrl("a1", { replace: true });
    renderScreen("a1");
    return true;
  }

  return false;
}

function isActionFormControl(target) {
  return target.matches("input, select, textarea");
}

function isChangeOnlyControl(target) {
  return target.matches([
    "select",
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="date"]',
    'input[type="file"]'
  ].join(", "));
}

window.addEventListener("popstate", renderFromUrl);
document.addEventListener("click", (event) => {
  const target = event.target.closest?.("[data-action]");
  if (!target) return;

  const actionId = target.dataset.action;
  const id = target.getAttribute("data-id");
  if (handleReviewAction(actionId, id)) return;
  if (isActionFormControl(target)) return;
  dispatchTargetAction(target);
});

document.addEventListener("input", (event) => {
  const target = event.target.closest?.("[data-action]");
  if (!target || handleReviewAction(target.dataset.action, target.getAttribute("data-id"))) return;
  if (isChangeOnlyControl(target)) return;
  dispatchTargetAction(target);
});

document.addEventListener("change", (event) => {
  const target = event.target.closest?.("[data-action]");
  if (!target || !isChangeOnlyControl(target)) return;
  dispatchTargetAction(target);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const target = phoneRoot.querySelector("[data-escape-action]");
  if (target) dispatchTargetAction(target);
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target.closest?.("[data-pointer-effect]");
  if (!target) return;
  activePointerTarget = target;
  target.dataset.pointerActive = "true";
});

document.addEventListener("pointerup", () => {
  if (activePointerTarget) delete activePointerTarget.dataset.pointerActive;
  activePointerTarget = null;
});

document.addEventListener("pointercancel", () => {
  if (activePointerTarget) delete activePointerTarget.dataset.pointerActive;
  activePointerTarget = null;
});

renderFromUrl();
