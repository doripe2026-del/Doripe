import { EDITORIAL_ELEMENTS } from "./contracts.mjs";

const KOREAN_DIRECT_CTA_PATTERN = /(?:보내\s*(?:주세요|보세요|세요)|전달\s*(?:해\s*주세요|해주세요|하세요|해\s*보세요|해보세요)|(?:저장|공유|팔로우|확인|다운로드|설치|클릭|신청|북마크)\s*(?:해\s*주세요|해주세요|하세요|해\s*보세요|해보세요)|눌러\s*(?:주세요|보세요|세요)|알림(?:을)?\s*(?:신청|설정)?\s*(?:해\s*주세요|해주세요|하세요|해\s*보세요|해보세요))/i;
const ENGLISH_DIRECT_CTA_PATTERN = /^(?:please\s+)?(?:send|save|share|follow|download|install|click|tap|check)\b/i;
const BRAND_QUESTION_KEYWORDS = Object.freeze({
  place_event: ["전시", "행사", "이곳", "이 장소", "갈 장소", "함께 갈"],
  collection: ["취향", "장소", "발견", "모음"],
  route: ["코스", "루트", "하루", "취향", "산책"],
});

function containsDirectCta(value) {
  if (KOREAN_DIRECT_CTA_PATTERN.test(value)) return true;
  return String(value)
    .split(/(?:[.!?,;:]\s+|\n+)/)
    .some((segment) => ENGLISH_DIRECT_CTA_PATTERN.test(
      segment.trim().replace(/^[^A-Za-z]+/, ""),
    ));
}

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
  if (containsDirectCta(draft?.caption ?? "")) {
    throw new Error("Direct CTA is not allowed in the caption");
  }

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
  if (factSourceIds.length === 0) {
    throw new Error("Fact source references are required");
  }

  const candidateSources = requireArray(draft.candidate?.sources, "Candidate sources");
  const candidateSourceIds = new Set(candidateSources.map((source) => source?.id));
  for (const factSourceId of factSourceIds) {
    if (
      typeof factSourceId !== "string"
      || !factSourceId.trim()
      || !candidateSourceIds.has(factSourceId)
    ) {
      throw new Error(`Fact source ID must match a candidate source: ${factSourceId}`);
    }
  }
  return { ok: true };
}

export function validateLayoutEvidence(evidence) {
  const slots = requireArray(evidence?.slots, "Layout slots");
  if (slots.length === 0) throw new Error("At least one layout slot is required");

  for (const slot of slots) {
    if (!slot || typeof slot !== "object") throw new Error("Every layout slot must be an object");
    if (typeof slot.name !== "string" || !slot.name.startsWith("slot:")) {
      throw new Error("Every layout slot needs a slot:* name");
    }
    if (slot.name.startsWith("slot:photo:")) continue;
    if (typeof slot.overflows !== "boolean") {
      throw new Error(`overflows must be a boolean: ${slot.name}`);
    }
    if (typeof slot.midWordBreak !== "boolean") {
      throw new Error(`midWordBreak must be a boolean: ${slot.name}`);
    }
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

export function validateSlideEvidence(draft, evidence) {
  const slides = requireArray(evidence?.slides, "Slide evidence");
  if (slides.length !== evidence.slideCount) {
    throw new Error("Slide evidence count must match slideCount");
  }
  for (const slide of slides) {
    if (typeof slide?.nodeId !== "string" || !/^\d+:\d+$/.test(slide.nodeId)) {
      throw new Error("Every slide requires a valid Figma node ID");
    }
  }
  if (slides[0]?.role !== "cover") throw new Error("First slide must be cover");

  const last = slides.at(-1);
  if (last?.role !== "brand_end") throw new Error("Last slide must be brand_end");
  if (last.backgroundHex?.toUpperCase() !== "#050505") {
    throw new Error("Brand end background must be #050505");
  }
  if (last.hasPhoneMockup !== true) throw new Error("Brand end requires a phone mockup");
  if (last.hasDoripeLogo !== true) throw new Error("Brand end requires a Doripe logo");
  if (last.doripeLogoColorHex !== "#20F58A") {
    throw new Error("Brand end Doripe logo must be #20F58A");
  }
  if (last.hasBrandWordmark !== true) {
    throw new Error("Brand end requires the Doripe wordmark");
  }
  if (!last.textSlots?.includes("slot:brand-question")) {
    throw new Error("Brand end requires slot:brand-question");
  }
  if (last.brandQuestion !== draft.brandQuestion) {
    throw new Error("Brand question must match the draft");
  }
  const relevantKeywords = BRAND_QUESTION_KEYWORDS[draft.candidate?.type] ?? [];
  if (!relevantKeywords.some((keyword) => draft.brandQuestion.includes(keyword))) {
    throw new Error("Brand question must be relevant to the content type");
  }

  const finalVisibleText = requireArray(last.visibleText, "Brand end visible text");
  const visibleQuestions = finalVisibleText.filter(
    (value) => typeof value === "string" && value.trim().endsWith("?"),
  );
  if (
    finalVisibleText.length !== 2
    || finalVisibleText[0] !== draft.brandQuestion
    || finalVisibleText[1] !== "Doripe."
    || visibleQuestions.length !== 1
  ) {
    throw new Error("Brand end visible text must be exactly the draft question and Doripe.");
  }

  for (const slide of slides) {
    const visibleText = requireArray(slide.visibleText, "Visible slide text");
    if (visibleText.some((value) => containsDirectCta(value))) {
      throw new Error("Direct CTA is not allowed on slides");
    }
  }

  if (draft.candidate?.type === "place_event") {
    for (const slide of slides.slice(1, -1)) {
      if (slide.role !== "photo") {
        throw new Error("Place/event middle slides must be photo slides");
      }
      if (!Array.isArray(slide.textSlots) || slide.textSlots.length !== 0) {
        throw new Error("Place/event photo slides may not contain text");
      }
      if (!Array.isArray(slide.visibleText) || slide.visibleText.length !== 0) {
        throw new Error("Place/event photo slides may not contain visible text");
      }
      if (slide.hasDoripeLogo !== true) throw new Error("Photo slide requires Doripe logo");
      if (slide.hasPhoto !== true) throw new Error("Photo slide requires an actual photo");

      const visibleElementKinds = requireArray(
        slide.visibleElementKinds,
        "Photo slide visible element kinds",
      );
      const expectedKinds = ["photo", "safe_region", "doripe_logo"];
      const actualKindSet = new Set(visibleElementKinds);
      if (
        visibleElementKinds.length !== expectedKinds.length
        || actualKindSet.size !== expectedKinds.length
        || expectedKinds.some((kind) => !actualKindSet.has(kind))
      ) {
        throw new Error(
          "Photo slide visible element kinds must be exactly photo, safe_region, doripe_logo",
        );
      }
    }
  }
  return { ok: true };
}

function resolveExpectedTemplate(expectedTemplate, candidateType) {
  if (!expectedTemplate || typeof expectedTemplate !== "object") {
    throw new Error("Expected template is required");
  }

  if (Array.isArray(expectedTemplate.templates)) {
    if (
      expectedTemplate.canvas?.width !== 1080
      || expectedTemplate.canvas?.height !== 1350
    ) {
      throw new Error("Expected template canvas must be exactly 1080x1350");
    }
    const template = expectedTemplate.templates.find(({ id }) => id === candidateType);
    if (!template) throw new Error(`Expected template is missing candidate type: ${candidateType}`);
    return template;
  }

  if (expectedTemplate.id !== candidateType) {
    throw new Error(`Expected template ID must match candidate type: ${candidateType}`);
  }
  if (
    expectedTemplate.canvas
    && (
      expectedTemplate.canvas.width !== 1080
      || expectedTemplate.canvas.height !== 1350
    )
  ) {
    throw new Error("Expected template canvas must be exactly 1080x1350");
  }
  return expectedTemplate;
}

function validateExpectedTemplate(draft, expectedTemplate, layoutEvidence) {
  if (!layoutEvidence || typeof layoutEvidence !== "object") {
    throw new Error("Layout evidence is required");
  }
  const candidateType = draft.candidate?.type;
  const template = resolveExpectedTemplate(expectedTemplate, candidateType);

  if (layoutEvidence?.templateId !== candidateType || template.id !== candidateType) {
    throw new Error(`Layout template ID must match candidate type: ${candidateType}`);
  }
  if (layoutEvidence.rootNodeId !== template.rootNodeId) {
    throw new Error(`Layout root node must match expected template: ${template.rootNodeId}`);
  }

  const canvasWidth = layoutEvidence.canvas?.width ?? layoutEvidence.width;
  const canvasHeight = layoutEvidence.canvas?.height ?? layoutEvidence.height;
  if (canvasWidth !== 1080 || canvasHeight !== 1350) {
    throw new Error("Layout canvas must be exactly 1080x1350");
  }
  if (
    !Number.isInteger(layoutEvidence.slideCount)
    || layoutEvidence.slideCount < template.minSlides
    || layoutEvidence.slideCount > template.maxSlides
  ) {
    throw new Error(
      `Slide count must be between ${template.minSlides} and ${template.maxSlides}`,
    );
  }

  const expectedSlots = requireArray(template.slots, "Expected template slots");
  if (!expectedSlots.some((name) => name.startsWith("slot:photo:"))) {
    throw new Error("Expected template must include a photo slot");
  }
  const evidenceSlots = requireArray(layoutEvidence.slots, "Layout slots");
  const evidenceSlotNames = evidenceSlots.map((slot) => slot?.name);
  const evidenceSlotSet = new Set(evidenceSlotNames);
  const requiredSlotsAreExact = evidenceSlotNames.length === expectedSlots.length
    && evidenceSlotSet.size === expectedSlots.length
    && expectedSlots.every((name) => evidenceSlotSet.has(name));
  if (!requiredSlotsAreExact) {
    throw new Error("Required layout slots must exactly match the expected template");
  }
  for (const slot of evidenceSlots) {
    if (slot.editable !== true) {
      throw new Error(`Required layout slot must be editable: ${slot.name}`);
    }
  }
}

export function validateDraftBundle(input) {
  if (!input || typeof input !== "object") throw new Error("Draft bundle input is required");
  const { draft, expectedTemplate, layoutEvidence } = input;
  if (!draft || typeof draft !== "object") throw new Error("Draft is required");

  const originality = validateOriginality(draft.candidate);
  const caption = validateCaption(draft);
  const sources = validateSources(draft.candidate);
  validateExpectedTemplate(draft, expectedTemplate, layoutEvidence);
  const layout = validateLayoutEvidence(layoutEvidence);
  const presentation = validateSlideEvidence(draft, layoutEvidence);

  return {
    originality,
    caption,
    sources,
    layout,
    presentation,
  };
}
