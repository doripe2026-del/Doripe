import inventory from "./figma/screen-inventory.json" with { type: "json" };
import { ACTIONS_BY_SCREEN } from "./transitions.js";

export function renderEvidenceScreen(screen) {
  const evidence = document.createElement("div");
  evidence.className = "evidence-screen";
  evidence.dataset.screenId = screen.id;
  evidence.dataset.figmaNode = screen.figmaNodeId;
  evidence.dataset.renderMode = "evidence";

  const image = document.createElement("img");
  image.src = screen.reference;
  image.alt = "";
  image.width = 393;
  image.height = 852;
  evidence.append(image);

  return evidence;
}

const screens = Object.freeze(inventory.map((item) => Object.freeze({
  id: item.id,
  name: item.name,
  group: item.group,
  figmaNodeId: item.nodeId,
  reference: item.reference,
  render: () => renderEvidenceScreen({
    id: item.id,
    figmaNodeId: item.nodeId,
    reference: item.reference
  }),
  actions: ACTIONS_BY_SCREEN[item.id]
})));

const screensById = new Map(screens.map((screen) => [screen.id, screen]));

export function getScreen(id) {
  return screensById.get(id) || null;
}

export function listScreens(group) {
  return group ? screens.filter((screen) => screen.group === group) : screens;
}
