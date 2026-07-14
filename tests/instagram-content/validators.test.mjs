import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseDraft,
  parseTemplateContract,
} from "../../scripts/instagram-content/contracts.mjs";
import {
  validateCaption,
  validateDraftBundle,
  validateLayoutEvidence,
  validateOriginality,
  validateSlideEvidence,
  validateSources,
} from "../../scripts/instagram-content/validators.mjs";

async function readFixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

const validDraft = parseDraft(await readFixture("valid-draft.json"));
const invalidRepostDraft = await readFixture("invalid-repost-draft.json");
const templateContract = parseTemplateContract(JSON.parse(await readFile(
  new URL("../../docs/instagram-content/template-contract.json", import.meta.url),
  "utf8",
)));
const routeTemplate = templateContract.templates.find(({ id }) => id === "route");
const validRouteSlides = [
  {
    role: "cover",
    textSlots: ["slot:title", "slot:subtitle", "slot:credit"],
    visibleText: [validDraft.candidate.title],
    hasDoripeLogo: true,
  },
  ...Array.from({ length: routeTemplate.minSlides - 2 }, () => ({
    role: "content",
    textSlots: [],
    visibleText: [],
    hasDoripeLogo: true,
  })),
  {
    role: "brand_end",
    textSlots: ["slot:brand-question"],
    visibleText: [validDraft.brandQuestion, "Doripe."],
    brandQuestion: validDraft.brandQuestion,
    hasDoripeLogo: true,
    doripeLogoColorHex: "#20F58A",
    hasBrandWordmark: true,
    hasPhoneMockup: true,
    backgroundHex: "#050505",
  },
];
const validLayoutEvidence = {
  templateId: routeTemplate.id,
  rootNodeId: routeTemplate.rootNodeId,
  canvas: { width: 1080, height: 1350 },
  slideCount: routeTemplate.minSlides,
  slides: validRouteSlides,
  slots: routeTemplate.slots.map((name) => name.startsWith("slot:photo:")
    ? { name, editable: true }
    : {
        name,
        editable: true,
        overflows: false,
        midWordBreak: false,
        baseFontSize: 64,
        fontSize: 57.6,
      }),
};
const placeEventTemplate = templateContract.templates.find(({ id }) => id === "place_event");
const placeEventDraft = parseDraft({
  ...structuredClone(validDraft),
  candidate: {
    ...structuredClone(validDraft.candidate),
    type: "place_event",
  },
  brandQuestion: "이 전시 다음에 갈 장소가 궁금하다면?",
});
const validSlides = [
  {
    role: "cover",
    textSlots: ["slot:title", "slot:subtitle", "slot:credit"],
    visibleText: ["서촌의 낯선 기록 실험"],
    hasDoripeLogo: true,
  },
  { role: "photo", textSlots: [], visibleText: [], hasDoripeLogo: true },
  { role: "photo", textSlots: [], visibleText: [], hasDoripeLogo: true },
  { role: "photo", textSlots: [], visibleText: [], hasDoripeLogo: true },
  { role: "photo", textSlots: [], visibleText: [], hasDoripeLogo: true },
  {
    role: "brand_end",
    textSlots: ["slot:brand-question"],
    visibleText: ["이 전시 다음에 갈 장소가 궁금하다면?", "Doripe."],
    brandQuestion: "이 전시 다음에 갈 장소가 궁금하다면?",
    hasDoripeLogo: true,
    doripeLogoColorHex: "#20F58A",
    hasBrandWordmark: true,
    hasPhoneMockup: true,
    backgroundHex: "#050505",
  },
];
const placeEventLayout = {
  templateId: placeEventTemplate.id,
  rootNodeId: placeEventTemplate.rootNodeId,
  canvas: { width: 1080, height: 1350 },
  slideCount: placeEventTemplate.minSlides,
  slides: validSlides,
  slots: placeEventTemplate.slots.map((name) => name.startsWith("slot:photo:")
    ? { name, editable: true }
    : {
        name,
        editable: true,
        overflows: false,
        midWordBreak: false,
        baseFontSize: 64,
        fontSize: 64,
      }),
};

test("simple credit overlay is not meaningful originality", () => {
  assert.throws(
    () => validateOriginality(invalidRepostDraft.candidate),
    /two substantive/i,
  );
  assert.throws(
    () => validateOriginality({
      editorialElements: ["selection_reason", "selection_reason", "credit_overlay"],
    }),
    /two substantive/i,
  );
});

test("originality returns unique allowed substantive elements", () => {
  assert.deepEqual(validateOriginality(validDraft.candidate), {
    ok: true,
    elements: ["selection_reason", "map_or_route"],
  });
});

test("missing editorial element arrays fail with a validation error", () => {
  assert.throws(() => validateOriginality({}), /editorial elements.*array/i);
  assert.throws(() => validateOriginality({ editorialElements: null }), /editorial elements.*array/i);
});

test("restricted sources are blocked and unknown rights become warnings", () => {
  assert.throws(
    () => validateSources({
      assets: [{ rightsStatus: "restricted", sourceUrl: "https://example.com/a", credit: "A" }],
    }),
    /restricted/i,
  );
  assert.equal(validateSources({
    assets: [{ rightsStatus: "not_found", sourceUrl: "https://example.com/a", credit: "A" }],
  }).warnings.length, 1);
});

test("every source asset requires a source URL and credit", () => {
  assert.throws(
    () => validateSources({
      assets: [{ rightsStatus: "confirmed", sourceUrl: "", credit: "A" }],
    }),
    /sourceUrl and credit/i,
  );
  assert.throws(
    () => validateSources({
      assets: [{ rightsStatus: "confirmed", sourceUrl: "https://example.com/a", credit: "" }],
    }),
    /sourceUrl and credit/i,
  );
});

test("missing or empty asset arrays fail with a validation error", () => {
  assert.throws(() => validateSources({}), /assets.*array/i);
  assert.throws(() => validateSources({ assets: [] }), /at least one asset/i);
});

test("caption requires location, two keyword phrases, and fact source IDs", () => {
  assert.throws(
    () => validateCaption({ ...validDraft, locationTag: " " }),
    /location tag/i,
  );
  assert.throws(
    () => validateCaption({ ...validDraft, keywordPhrases: ["성수"] }),
    /two keyword phrases/i,
  );
  assert.throws(
    () => validateCaption({ ...validDraft, factSourceIds: [] }),
    /fact source/i,
  );
  assert.deepEqual(validateCaption(validDraft), { ok: true });
});

test("caption blocks direct imperative calls without banning non-imperative words", () => {
  for (const caption of [
    "친구에게 보내주세요.",
    "나중을 위해 저장하세요.",
    "저장해 주세요.",
    "같이 공유해 주세요.",
    "공유하세요.",
    "지금 확인하세요.",
    "다운로드하세요.",
  ]) {
    assert.throws(() => validateCaption({ ...validDraft, caption }), /direct CTA/i);
  }

  assert.deepEqual(validateCaption({
    ...validDraft,
    caption: "저장과 공유가 자연스럽게 이어지는 장소를 확인한 기록입니다.",
  }), { ok: true });
});

test("every caption fact source ID must match a candidate source", () => {
  assert.throws(
    () => validateCaption({
      ...validDraft,
      factSourceIds: [validDraft.factSourceIds[0], "missing-source"],
    }),
    /fact source ID.*candidate source/i,
  );
});

test("missing caption arrays fail with a validation error", () => {
  assert.throws(
    () => validateCaption({ ...validDraft, keywordPhrases: undefined }),
    /keyword phrases.*array/i,
  );
  assert.throws(
    () => validateCaption({ ...validDraft, factSourceIds: undefined }),
    /fact source IDs.*array/i,
  );
});

test("layout blocks overflow and mid-word breaks", () => {
  assert.throws(
    () => validateLayoutEvidence({
      slots: [{ ...validLayoutEvidence.slots[0], overflows: true }],
    }),
    /overflow/i,
  );
  assert.throws(
    () => validateLayoutEvidence({
      slots: [{ ...validLayoutEvidence.slots[0], midWordBreak: true }],
    }),
    /mid-word break/i,
  );
});

test("every text slot requires explicit overflow and mid-word break evidence", () => {
  const titleSlot = validLayoutEvidence.slots.find(({ name }) => name === "slot:title");
  const { overflows: _overflows, ...missingOverflow } = titleSlot;
  const { midWordBreak: _midWordBreak, ...missingMidWordBreak } = titleSlot;

  assert.throws(
    () => validateLayoutEvidence({ slots: [missingOverflow] }),
    /overflows.*boolean/i,
  );
  assert.throws(
    () => validateLayoutEvidence({ slots: [missingMidWordBreak] }),
    /midWordBreak.*boolean/i,
  );
});

test("layout allows exactly 90 percent font size and blocks smaller text", () => {
  assert.deepEqual(validateLayoutEvidence(validLayoutEvidence), { ok: true });
  assert.throws(
    () => validateLayoutEvidence({
      slots: [{ ...validLayoutEvidence.slots[0], fontSize: 57 }],
    }),
    /90%/i,
  );
});

test("missing or empty layout slot arrays fail with a validation error", () => {
  assert.throws(() => validateLayoutEvidence({}), /layout slots.*array/i);
  assert.throws(() => validateLayoutEvidence({ slots: [] }), /at least one layout slot/i);
});

test("place and event photo slides may not contain text", () => {
  assert.throws(() => validateSlideEvidence(placeEventDraft, {
    ...placeEventLayout,
    slides: validSlides.map((slide, index) => index === 1
      ? { ...slide, textSlots: ["slot:body:01"] }
      : slide),
  }), /photo.*text/i);

  assert.throws(() => validateSlideEvidence(placeEventDraft, {
    ...placeEventLayout,
    slides: validSlides.map((slide, index) => index === 1
      ? { ...slide, visibleText: ["중간 장 문구"] }
      : slide),
  }), /photo.*text/i);
});

test("slides reject direct imperative calls", () => {
  for (const visibleText of [
    "저장해 주세요.",
    "공유하세요.",
    "지금 확인하세요.",
    "다운로드하세요.",
  ]) {
    assert.throws(() => validateSlideEvidence(validDraft, {
      ...validLayoutEvidence,
      slides: validRouteSlides.map((slide, index) => index === 0
        ? { ...slide, visibleText: [visibleText] }
        : slide),
    }), /direct CTA/i);
  }
});

test("the brand end slide requires the exact green Doripe logo color", () => {
  for (const doripeLogoColorHex of [undefined, "#20f58a", "#FFFFFF"]) {
    assert.throws(() => validateSlideEvidence(placeEventDraft, {
      ...placeEventLayout,
      slides: validSlides.map((slide, index) => index === 5
        ? { ...slide, doripeLogoColorHex }
        : slide),
    }), /logo.*#20F58A/i);
  }
});

test("the brand end slide rejects every missing required condition", () => {
  const missingConditions = [
    ["role", /brand_end/i],
    ["backgroundHex", /background.*#050505/i],
    ["hasPhoneMockup", /phone mockup/i],
    ["hasDoripeLogo", /Doripe logo/i],
    ["hasBrandWordmark", /wordmark/i],
    ["textSlots", /slot:brand-question/i],
    ["brandQuestion", /brand question.*match/i],
  ];

  for (const [field, expectedError] of missingConditions) {
    const finalSlide = { ...validSlides.at(-1) };
    delete finalSlide[field];
    assert.throws(() => validateSlideEvidence(placeEventDraft, {
      ...placeEventLayout,
      slides: [...validSlides.slice(0, -1), finalSlide],
    }), expectedError, `missing ${field} should fail`);
  }
});

test("valid slide evidence passes presentation validation", () => {
  assert.deepEqual(validateSlideEvidence(placeEventDraft, placeEventLayout), { ok: true });
});

test("draft bundle validates every quality gate", () => {
  assert.deepEqual(
    validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: validLayoutEvidence,
    }),
    {
      originality: {
        ok: true,
        elements: ["selection_reason", "map_or_route"],
      },
      caption: { ok: true },
      sources: { ok: true, warnings: [] },
      layout: { ok: true },
      presentation: { ok: true },
    },
  );
});

test("draft bundle requires template type and root consistency", () => {
  assert.throws(
    () => validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: { ...validLayoutEvidence, templateId: "collection" },
    }),
    /template ID.*candidate type/i,
  );
  assert.throws(
    () => validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: { ...validLayoutEvidence, rootNodeId: "28:15" },
    }),
    /root node/i,
  );
});

test("draft bundle requires exact 1080 by 1350 dimensions", () => {
  assert.throws(
    () => validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: {
        ...validLayoutEvidence,
        canvas: { width: 1080, height: 1349 },
      },
    }),
    /1080x1350/i,
  );
});

test("draft bundle requires layout evidence before template comparison", () => {
  assert.throws(
    () => validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: undefined,
    }),
    /layout evidence is required/i,
  );
});

test("draft bundle enforces the selected template slide range", () => {
  for (const slideCount of [routeTemplate.minSlides - 1, routeTemplate.maxSlides + 1]) {
    assert.throws(
      () => validateDraftBundle({
        draft: validDraft,
        expectedTemplate: templateContract,
        layoutEvidence: { ...validLayoutEvidence, slideCount },
      }),
      /slide count/i,
    );
  }
});

test("draft bundle requires every contracted editable slot including photo slots", () => {
  assert.throws(
    () => validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: {
        ...validLayoutEvidence,
        slots: validLayoutEvidence.slots.filter(({ name }) => name !== "slot:photo:01"),
      },
    }),
    /required layout slots/i,
  );
  assert.throws(
    () => validateDraftBundle({
      draft: validDraft,
      expectedTemplate: templateContract,
      layoutEvidence: {
        ...validLayoutEvidence,
        slots: validLayoutEvidence.slots.map((slot) => slot.name === "slot:photo:01"
          ? { ...slot, editable: false }
          : slot),
      },
    }),
    /editable/i,
  );
});

test("draft bundle blocks the invalid repost fixture", () => {
  assert.throws(
    () => validateDraftBundle({
      draft: invalidRepostDraft,
      expectedTemplate: templateContract,
      layoutEvidence: validLayoutEvidence,
    }),
    /two substantive/i,
  );
});
