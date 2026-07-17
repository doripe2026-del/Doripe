const ICON_FILES = Object.freeze({
  back: "icons/back.svg",
  bookmark: "icons/bookmark.svg",
  close: "icons/close.svg",
  heart: "icons/heart.svg",
  info: "icons/info.svg",
  "message-circle": "icons/message-circle.svg",
  "map-pin": "icons/map-pin.svg",
  "nav-discover": "settings/nav-discover.svg",
  "nav-route": "settings/nav-route.svg",
  "nav-saved": "settings/nav-saved.svg",
  "nav-settings": "settings/nav-settings.svg",
  "official-badge": "icons/official-badge.svg",
  share: "icons/share.svg",
  "discover-send": "discover/send.svg",
  "saved-check": "saved/check.svg",
  "saved-chevron-down": "saved/chevron-down.svg",
  "saved-chevron-right": "saved/chevron-right.svg",
  "saved-directions": "saved/footprints.svg",
  "saved-more": "saved/more-vertical.svg",
  "saved-refresh": "saved/refresh.svg",
  "saved-sliders": "saved/sliders.svg",
  "saved-sun": "saved/sun.svg",
  "route-check": "routes/check-selected.svg",
  "route-chevron-down": "routes/chevron-down.svg",
  "route-plus": "routes/plus.svg",
  "route-play": "routes/play.svg",
  "settings-check": "settings/check.svg",
  "settings-image": "settings/image.svg",
  "settings-play": "settings/play.svg"
});

export const BOTTOM_NAV_DESTINATIONS = Object.freeze([
  Object.freeze({ label: "발견", screenId: "b2", icon: "discover" }),
  Object.freeze({ label: "저장", screenId: "c1", icon: "saved" }),
  Object.freeze({ label: "코스", screenId: "d3", icon: "route" }),
  Object.freeze({ label: "MY", screenId: "e1", icon: "settings" })
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requiredText(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function actionAttribute(action) {
  requiredText(action, "action");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(action)) {
    throw new TypeError("action must be a stable kebab-case identifier");
  }
  return `data-action="${escapeHtml(action)}"`;
}

function iconSize(size) {
  if (!Number.isFinite(size) || size <= 0) throw new TypeError("icon size must be a positive number");
  return size;
}

function localAssetPath(value) {
  const source = requiredText(value, "avatar src");
  let decoded = source;

  try {
    for (let pass = 0; pass < 4; pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    throw new TypeError("avatar src must be a local app-preview asset");
  }

  if (
    decoded.includes("%")
    || /[\\?#\u0000-\u001f\u007f]/.test(decoded)
    || !decoded.startsWith("/app-preview/assets/")
  ) {
    throw new TypeError("avatar src must be a local app-preview asset");
  }

  const relativePath = decoded.slice("/app-preview/assets/".length);
  const segments = relativePath.split("/");
  if (
    relativePath === ""
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError("avatar src must be a local app-preview asset");
  }

  const normalized = new URL(decoded, "https://preview.invalid");
  if (normalized.origin !== "https://preview.invalid" || normalized.pathname !== decoded) {
    throw new TypeError("avatar src must be a local app-preview asset");
  }

  return decoded;
}

export function icon(name, { label, decorative = false, size = 24 } = {}) {
  const file = ICON_FILES[name];
  if (!file) throw new TypeError(`Unknown icon: ${name}`);
  const measuredSize = iconSize(size);
  const accessibility = decorative
    ? 'alt="" aria-hidden="true"'
    : `alt="${escapeHtml(requiredText(label, "icon label"))}"`;

  return `<img class="preview-icon" src="/app-preview/assets/${file}" ${accessibility} style="--preview-icon-size: ${measuredSize}px" draggable="false">`;
}

export function primaryButton({ label, action, disabled = false } = {}) {
  const disabledAttributes = disabled ? ' disabled aria-disabled="true"' : ' aria-disabled="false"';
  return `<button class="preview-primary-button" type="button" ${actionAttribute(action)}${disabledAttributes}>${escapeHtml(requiredText(label, "label"))}</button>`;
}

export function createPrimaryActionButton({
  label,
  action,
  disabled = false,
  className = "",
  iconName,
  values = {}
} = {}) {
  const template = document.createElement("template");
  template.innerHTML = primaryButton({ label, action, disabled });
  const button = template.content.firstElementChild;
  const text = document.createElement("span");
  text.textContent = button.textContent;
  button.replaceChildren();
  if (className) button.classList.add(...className.split(/\s+/).filter(Boolean));
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) button.dataset[key] = String(value);
  }
  if (iconName) {
    const iconTemplate = document.createElement("template");
    iconTemplate.innerHTML = icon(iconName, { decorative: true, size: 22 });
    button.append(iconTemplate.content.firstElementChild);
  }
  button.append(text);
  return button;
}

export function backButton({ action, label = "뒤로 가기" } = {}) {
  return `<button class="preview-back-button" type="button" ${actionAttribute(action)} aria-label="${escapeHtml(requiredText(label, "label"))}"><span class="preview-back-button__visible" aria-hidden="true">${icon("back", { decorative: true, size: 26 })}</span></button>`;
}

export function bottomNav({ selectedIndex, label = "주요 메뉴" } = {}) {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= BOTTOM_NAV_DESTINATIONS.length) {
    throw new TypeError("bottom nav selected index must identify one destination");
  }

  const navItems = BOTTOM_NAV_DESTINATIONS.map((item, index) => {
    const selected = index === selectedIndex;
    const selectedClass = selected ? " preview-bottom-nav__item--selected" : "";
    return `<button class="preview-bottom-nav__item${selectedClass}" type="button" data-nav-target="${item.screenId}" aria-current="${selected ? "page" : "false"}" aria-label="${escapeHtml(item.label)}"><span class="preview-bottom-nav__icon preview-bottom-nav__icon--${item.icon}" aria-hidden="true"></span></button>`;
  }).join("");

  return `<nav class="preview-bottom-nav" aria-label="${escapeHtml(requiredText(label, "label"))}">${navItems}</nav>`;
}

export function createBottomNav({ selectedIndex, label = "주요 메뉴" } = {}) {
  const template = document.createElement("template");
  template.innerHTML = bottomNav({ selectedIndex, label });
  const nav = template.content.firstElementChild;
  nav.addEventListener("click", (event) => {
    const target = event.target.closest("[data-nav-target]");
    if (!target || !nav.contains(target)) return;
    document.dispatchEvent(new CustomEvent("app-preview:screen-navigate", {
      detail: { screenId: target.dataset.navTarget }
    }));
  });
  return nav;
}

export function createSegmentedControl({ items, selectedIndex, label, className = "" } = {}) {
  if (!Array.isArray(items) || items.length < 2) throw new TypeError("segmented control requires at least two items");
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= items.length) {
    throw new TypeError("segmented control selected index must identify one item");
  }

  const control = document.createElement("div");
  control.className = `preview-segmented-control ${className}`.trim();
  control.setAttribute("role", "tablist");
  control.setAttribute("aria-label", requiredText(label, "label"));
  control.style.setProperty("--preview-segment-count", String(items.length));
  control.style.setProperty("--preview-segment-index", String(selectedIndex));

  items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `preview-segmented-control__item${index === selectedIndex ? " is-selected" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === selectedIndex));
    button.setAttribute("aria-label", requiredText(item.label, "item label"));
    if (item.action) button.dataset.action = requiredText(item.action, "item action");
    if (item.value !== undefined) button.value = String(item.value);
    if (item.iconName) {
      const iconTemplate = document.createElement("template");
      iconTemplate.innerHTML = icon(item.iconName, { decorative: true, size: 18 });
      button.append(iconTemplate.content.firstElementChild);
    }
    button.append(document.createTextNode(item.label));
    control.append(button);
  });

  return control;
}

export function chip({ label, action, selected = false } = {}) {
  const content = escapeHtml(requiredText(label, "label"));
  const selectedClass = selected ? " preview-chip--selected" : "";
  if (action === undefined) {
    return `<span class="preview-chip${selectedClass}">${content}</span>`;
  }

  return `<button class="preview-chip${selectedClass}" type="button" ${actionAttribute(action)} aria-pressed="${selected}">${content}</button>`;
}

export function avatar({ src, alt, action, label } = {}) {
  const safeSrc = localAssetPath(src);
  const image = `<img class="preview-avatar" src="${escapeHtml(safeSrc)}" alt="${escapeHtml(requiredText(alt, "avatar alt"))}">`;
  if (action === undefined) return image;

  return `<button class="preview-avatar-action" type="button" ${actionAttribute(action)} aria-label="${escapeHtml(requiredText(label, "label"))}">${image}</button>`;
}

export function sheetHandle() {
  return '<span class="preview-sheet-handle" aria-hidden="true"></span>';
}

export function toast({ message, kind = "info" } = {}) {
  if (!["error", "info", "success"].includes(kind)) throw new TypeError(`Unknown toast kind: ${kind}`);
  return `<output class="preview-toast preview-toast--${kind}" role="status" aria-live="polite" aria-atomic="true" data-kind="${kind}">${escapeHtml(requiredText(message, "message"))}</output>`;
}

export function confirmDialog({
  id = "preview-confirm-dialog",
  title,
  message,
  confirmLabel,
  confirmAction,
  cancelLabel,
  cancelAction,
  destructive = false
} = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError("dialog id must be a stable kebab-case identifier");
  const confirmModifier = destructive ? " preview-confirm-dialog__confirm--destructive" : "";

  return `<section class="preview-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="${id}-title" aria-describedby="${id}-message" tabindex="-1"><h2 id="${id}-title">${escapeHtml(requiredText(title, "title"))}</h2><p id="${id}-message">${escapeHtml(requiredText(message, "message"))}</p><div class="preview-confirm-dialog__actions"><button class="preview-confirm-dialog__cancel" type="button" ${actionAttribute(cancelAction)}>${escapeHtml(requiredText(cancelLabel, "cancel label"))}</button><button class="preview-confirm-dialog__confirm${confirmModifier}" type="button" ${actionAttribute(confirmAction)}>${escapeHtml(requiredText(confirmLabel, "confirm label"))}</button></div></section>`;
}
