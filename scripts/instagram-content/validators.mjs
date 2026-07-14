import { EDITORIAL_ELEMENTS } from "./contracts.mjs";

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

export function validateOriginality(draft) {
  const editorialElements = requireArray(draft?.editorialElements, "Editorial elements");
  const unique = new Set(
    editorialElements.filter((item) => EDITORIAL_ELEMENTS.includes(item)),
  );
  if (unique.size < 2) {
    throw new Error("At least two substantive Doripe editorial elements are required");
  }
  return { ok: true, elements: [...unique] };
}

export function validateSources(draft) {
  const assets = requireArray(draft?.assets, "Assets");
  if (assets.length === 0) throw new Error("At least one asset is required");

  const warnings = [];
  for (const asset of assets) {
    if (!asset || typeof asset !== "object") throw new Error("Every asset must be an object");
    if (asset.rightsStatus === "restricted") {
      throw new Error(`Restricted asset: ${asset.sourceUrl ?? "unknown source"}`);
    }
    if (
      typeof asset.sourceUrl !== "string"
      || !asset.sourceUrl.trim()
      || typeof asset.credit !== "string"
      || !asset.credit.trim()
    ) {
      throw new Error("Every asset needs sourceUrl and credit");
    }
    if (asset.rightsStatus === "not_found") {
      warnings.push(`Rights not confirmed: ${asset.sourceUrl}`);
    }
  }
  return { ok: true, warnings };
}

export function validateCaption(draft) {
  if (typeof draft?.locationTag !== "string" || !draft.locationTag.trim()) {
    throw new Error("Location tag is required");
  }

  const keywordPhrases = requireArray(draft.keywordPhrases, "Keyword phrases");
  const substantivePhrases = keywordPhrases.filter(
    (phrase) => typeof phrase === "string" && phrase.trim(),
  );
  if (substantivePhrases.length < 2) {
    throw new Error("At least two keyword phrases are required");
  }

  const factSourceIds = requireArray(draft.factSourceIds, "Fact source IDs");
  if (!factSourceIds.some((sourceId) => typeof sourceId === "string" && sourceId.trim())) {
    throw new Error("Fact source references are required");
  }
  return { ok: true };
}

export function validateLayoutEvidence(evidence) {
  const slots = requireArray(evidence?.slots, "Layout slots");
  if (slots.length === 0) throw new Error("At least one layout slot is required");

  for (const slot of slots) {
    if (!slot || typeof slot !== "object") throw new Error("Every layout slot must be an object");
    if (slot.overflows) throw new Error(`Text overflow: ${slot.name}`);
    if (slot.midWordBreak) throw new Error(`Mid-word break: ${slot.name}`);
    if (
      !Number.isFinite(slot.baseFontSize)
      || slot.baseFontSize <= 0
      || !Number.isFinite(slot.fontSize)
      || slot.fontSize <= 0
    ) {
      throw new Error(`Valid font sizes are required: ${slot.name ?? "unnamed slot"}`);
    }
    if (slot.fontSize < slot.baseFontSize * 0.9) {
      throw new Error(`Text may not shrink below 90%: ${slot.name}`);
    }
  }
  return { ok: true };
}

export function validateDraftBundle(input) {
  if (!input || typeof input !== "object") throw new Error("Draft bundle input is required");
  const { draft, layoutEvidence } = input;
  if (!draft || typeof draft !== "object") throw new Error("Draft is required");

  return {
    originality: validateOriginality(draft.candidate),
    caption: validateCaption(draft),
    sources: validateSources(draft.candidate),
    layout: validateLayoutEvidence(layoutEvidence),
  };
}
