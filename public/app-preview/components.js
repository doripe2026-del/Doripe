const ICON_FILES = Object.freeze({
  back: "back.svg",
  close: "close.svg",
  heart: "heart.svg",
  info: "info.svg",
  "map-pin": "map-pin.svg",
  "official-badge": "official-badge.svg",
  share: "share.svg"
});

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

  return `<img class="preview-icon" src="/app-preview/assets/icons/${file}" ${accessibility} style="--preview-icon-size: ${measuredSize}px" draggable="false">`;
}

export function primaryButton({ label, action, disabled = false } = {}) {
  const disabledAttributes = disabled ? ' disabled aria-disabled="true"' : ' aria-disabled="false"';
  return `<button class="preview-primary-button" type="button" ${actionAttribute(action)}${disabledAttributes}>${escapeHtml(requiredText(label, "label"))}</button>`;
}

export function backButton({ action, label = "뒤로 가기" } = {}) {
  return `<button class="preview-back-button" type="button" ${actionAttribute(action)} aria-label="${escapeHtml(requiredText(label, "label"))}"><span class="preview-back-button__visible" aria-hidden="true">${icon("back", { decorative: true, size: 26 })}</span></button>`;
}

export function bottomNav({ items, label = "주요 메뉴" } = {}) {
  if (!Array.isArray(items) || items.length !== 4) {
    throw new TypeError("bottom nav requires the four measured navigation items");
  }
  if (!items[2]?.selected || items.some((item, index) => index !== 2 && item.selected)) {
    throw new TypeError("bottom nav selection must be the third measured navigation item");
  }

  const navItems = items.map((item) => {
    const selected = item.selected === true;
    const selectedClass = selected ? " preview-bottom-nav__item--selected" : "";
    return `<button class="preview-bottom-nav__item${selectedClass}" type="button" ${actionAttribute(item.action)} aria-current="${selected ? "page" : "false"}" aria-pressed="${selected}" aria-label="${escapeHtml(requiredText(item.label, "item label"))}">${icon(item.icon, { decorative: true, size: 26 })}</button>`;
  }).join("");

  return `<nav class="preview-bottom-nav" aria-label="${escapeHtml(requiredText(label, "label"))}">${navItems}</nav>`;
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
