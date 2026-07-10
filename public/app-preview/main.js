import { getScreen, listScreens } from "./screen-registry.js";
import { createPreviewState } from "./state.js";

const groups = ["A", "B", "C", "D", "E"];
const state = createPreviewState();
const phoneRoot = document.querySelector("#phone-root");
const reviewList = document.querySelector("#review-list");
const resetButton = document.querySelector("#review-reset");

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
      navigationButton.addEventListener("click", () => navigate(screen.id));

      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.className = "review-status";
      const isComplete = currentState.reviewStatus[screen.id] === "complete";
      statusButton.textContent = isComplete ? "완료" : "미검토";
      statusButton.setAttribute("aria-pressed", String(isComplete));
      statusButton.addEventListener("click", () => {
        state.setReviewStatus(screen.id, isComplete ? "unreviewed" : "complete");
        renderReviewList();
      });

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
  returnButton.addEventListener("click", () => navigate("a1"));
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
  renderScreen(selectedScreenId);
}

window.addEventListener("popstate", renderFromUrl);
resetButton.addEventListener("click", () => {
  state.reset();
  writeScreenIdToUrl("a1", { replace: true });
  renderScreen("a1");
});

renderFromUrl();
