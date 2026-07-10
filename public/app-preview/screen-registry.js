import actionContract from "./figma/action-contract.json" with { type: "json" };
import inventory from "./figma/screen-inventory.json" with { type: "json" };
import { ONBOARDING_RENDERERS } from "./screens/onboarding.js";

const actionsByScreenId = new Map();
for (const record of actionContract.actions) {
  const actionIds = actionsByScreenId.get(record.screenId) || [];
  if (!actionIds.includes(record.actionId)) actionIds.push(record.actionId);
  actionsByScreenId.set(record.screenId, actionIds);
}

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

const screens = Object.freeze(inventory.map((item) => {
  const semanticRenderer = item.group === "A" ? ONBOARDING_RENDERERS[item.id] : null;
  return Object.freeze({
    id: item.id,
    name: item.name,
    group: item.group,
    figmaNodeId: item.nodeId,
    reference: item.reference,
    render: semanticRenderer || (() => renderEvidenceScreen({
      id: item.id,
      figmaNodeId: item.nodeId,
      reference: item.reference
    })),
    actions: Object.freeze(actionsByScreenId.get(item.id) || [])
  });
}));

const screensById = new Map(screens.map((screen) => [screen.id, screen]));

export function getScreen(id) {
  return screensById.get(id) || null;
}

export function listScreens(group) {
  return group ? screens.filter((screen) => screen.group === group) : screens;
}
