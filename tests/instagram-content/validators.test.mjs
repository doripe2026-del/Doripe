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
  validatePhotoAesthetic,
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
const makeBrandEndSlide = (nodeId, brandQuestion) => ({
  role: "brand_end",
  nodeId,
  textSlots: ["slot:brand-question"],
  visibleText: [brandQuestion],
  brandQuestion,
  hasDoripeLogo: true,
  doripeLogoColorHex: "#20F58A",
  logoSha256: templateContract.brandEnd.logo.sha256,
  hasBrandWordmark: false,
  hasPhoneMockup: true,
  usesActualAppCapture: true,
  appScreenKind: "actual_discover_capture",
  appScreenSourcePath: templateContract.brandEnd.appScreen.sourcePath,
  appScreenWidth: 393,
  appScreenHeight: 852,
  appScreenSha256: templateContract.brandEnd.appScreen.sha256,
  backgroundHex: "#050505",
});
const routeTemplate = templateContract.templates.find(({ id }) => id === "route");
const validRouteSlides = [
  {
    role: "cover",
    nodeId: "100:1",
    textSlots: ["slot:title", "slot:subtitle", "slot:credit"],
    visibleText: [validDraft.candidate.title],
    hasDoripeLogo: true,
  },
  ...Array.from({ length: routeTemplate.minSlides - 2 }, (_, index) => ({
    role: "content",
    nodeId: `100:${index + 2}`,
    textSlots: [],
    visibleText: [],
    hasDoripeLogo: true,
  })),
  makeBrandEndSlide(`100:${routeTemplate.minSlides}`, validDraft.brandQuestion),
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
const collectionDraft = parseDraft({
  ...structuredClone(validDraft),
  candidate: {
    ...structuredClone(validDraft.candidate),
    type: "collection",
  },
  brandQuestion: "오늘의 취향을 더 발견하고 싶다면?",
});
const validSlides = [
  {
    role: "cover",
    nodeId: "200:1",
    textSlots: ["slot:title", "slot:subtitle", "slot:credit"],
    visibleText: ["서촌의 낯선 기록 실험"],
    hasDoripeLogo: true,
  },
  { role: "photo", nodeId: "200:2", textSlots: [], visibleText: [], hasDoripeLogo: true, hasPhoto: true, visibleElementKinds: ["photo", "safe_region", "doripe_logo"] },
  { role: "photo", nodeId: "200:3", textSlots: [], visibleText: [], hasDoripeLogo: true, hasPhoto: true, visibleElementKinds: ["photo", "safe_region", "doripe_logo"] },
  { role: "photo", nodeId: "200:4", textSlots: [], visibleText: [], hasDoripeLogo: true, hasPhoto: true, visibleElementKinds: ["photo", "safe_region", "doripe_logo"] },
  { role: "photo", nodeId: "200:5", textSlots: [], visibleText: [], hasDoripeLogo: true, hasPhoto: true, visibleElementKinds: ["photo", "safe_region", "doripe_logo"] },
  makeBrandEndSlide("200:6", "이 전시 다음에 갈 장소가 궁금하다면?"),
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

test("editorial photos require score 70, short edge 1080, and varied shots", () => {
  const candidate = validDraft.candidate;
  const asset = candidate.assets[0];
  assert.throws(() => validatePhotoAesthetic({
    ...candidate,
    assets: [{ ...asset, aestheticScores: {
      naturalLight: 1,
      placeSpecificity: 1,
      composition: 1,
      livedExperience: 1,
      paletteCoherence: 1,
    } }],
  }), /aesthetic.*70/i);
  assert.throws(() => validatePhotoAesthetic({
    ...candidate,
    assets: [{ ...asset, width: 1079, height: 2000 }],
  }), /short edge.*1080/i);
  assert.throws(() => validatePhotoAesthetic({
    ...candidate,
    assets: Array.from({ length: 4 }, (_, index) => ({
      ...asset,
      id: `same-${index}`,
      shotType: "interior",
    })),
  }), /three shot types/i);
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
    "친구에게 전달해 주세요.",
    "링크를 눌러보세요.",
    "앱을 설치하세요.",
    "버튼을 클릭해 보세요.",
    "지금 신청하세요.",
    "알림 신청해 주세요.",
    "북마크해 주세요.",
    "북마크하세요.",
    "Send this to a friend.",
    "Please save this post.",
    "Share with someone you love.",
    "Follow for more places.",
    "Download the app.",
    "Install Doripe.",
    "Click the link.",
    "Tap here.",
    "Check it out.",
    "👉 Save this post.",
    "If this helped, save this post.",
    "For later, share this with a friend.",
    "Do not forget to save this post.",
    "If this helped—save this post.",
    "Don’t forget to share this.",
    "For later–send this to a friend.",
  ]) {
    assert.throws(() => validateCaption({ ...validDraft, caption }), /direct CTA/i);
  }

  assert.deepEqual(validateCaption({
    ...validDraft,
    caption: "저장과 공유가 자연스럽게 이어지는 장소를 확인한 기록입니다. We check every source before publication. The download page is under review. This guide explains how people save places in Doripe.",
  }), { ok: true });
});

test("caption blocks the 보내세요 direct imperative form", () => {
  assert.throws(
    () => validateCaption({ ...validDraft, caption: "친구에게 보내세요." }),
    /direct CTA/i,
  );
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
  }, templateContract), /photo.*text/i);

  assert.throws(() => validateSlideEvidence(placeEventDraft, {
    ...placeEventLayout,
    slides: validSlides.map((slide, index) => index === 1
      ? { ...slide, visibleText: ["중간 장 문구"] }
      : slide),
  }, templateContract), /photo.*text/i);
});

test("every slide requires a Figma node ID", () => {
  for (const nodeId of [undefined, "100", "node:1", "1:two"]) {
    assert.throws(() => validateSlideEvidence(validDraft, {
      ...validLayoutEvidence,
      slides: validRouteSlides.map((slide, index) => index === 1
        ? { ...slide, nodeId }
        : slide),
    }, templateContract), /node ID/i);
  }
});

test("place and event photo slides require a photo and only the exact allowed element kinds", () => {
  for (const replacement of [
    { hasPhoto: false },
    { visibleElementKinds: ["safe_region", "doripe_logo"] },
    { visibleElementKinds: ["photo", "safe_region", "doripe_logo", "gradient"] },
    { visibleElementKinds: ["photo", "safe_region", "doripe_logo", "accent"] },
    { visibleElementKinds: ["photo", "safe_region", "doripe_logo", "badge"] },
    { visibleElementKinds: ["photo", "doripe_logo"] },
  ]) {
    assert.throws(() => validateSlideEvidence(placeEventDraft, {
      ...placeEventLayout,
      slides: validSlides.map((slide, index) => index === 1
        ? { ...slide, ...replacement }
        : slide),
    }, templateContract), /photo|element kinds/i);
  }
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
    }, templateContract), /direct CTA/i);
  }
});

test("the brand end slide requires the exact green Doripe logo color", () => {
  for (const doripeLogoColorHex of [undefined, "#20f58a", "#FFFFFF"]) {
    assert.throws(() => validateSlideEvidence(placeEventDraft, {
      ...placeEventLayout,
      slides: validSlides.map((slide, index) => index === 5
        ? { ...slide, doripeLogoColorHex }
        : slide),
    }, templateContract), /logo.*#20F58A/i);
  }
});

test("the brand end slide rejects every missing required condition", () => {
  const missingConditions = [
    ["role", /brand_end/i],
    ["backgroundHex", /background.*#050505/i],
    ["hasPhoneMockup", /phone mockup/i],
    ["hasDoripeLogo", /Doripe logo/i],
    ["hasBrandWordmark", /wordmark/i],
    ["usesActualAppCapture", /actual app capture/i],
    ["appScreenKind", /app screen kind/i],
    ["appScreenSourcePath", /app screen source/i],
    ["appScreenWidth", /app screen dimensions/i],
    ["appScreenHeight", /app screen dimensions/i],
    ["appScreenSha256", /app screen SHA-256/i],
    ["logoSha256", /logo SHA-256/i],
    ["textSlots", /slot:brand-question/i],
    ["brandQuestion", /brand question.*match/i],
  ];

  for (const [field, expectedError] of missingConditions) {
    const finalSlide = { ...validSlides.at(-1) };
    delete finalSlide[field];
    assert.throws(() => validateSlideEvidence(placeEventDraft, {
      ...placeEventLayout,
      slides: [...validSlides.slice(0, -1), finalSlide],
    }, templateContract), expectedError, `missing ${field} should fail`);
  }
});

test("the brand end slide requires exactly the draft question without a wordmark", () => {
  for (const visibleText of [
    [],
    ["이 전시가 아닌 다른 질문?"],
    [placeEventDraft.brandQuestion, "Doripe."],
    [placeEventDraft.brandQuestion, "추가 문구"],
    ["다른 질문?", placeEventDraft.brandQuestion],
  ]) {
    assert.throws(() => validateSlideEvidence(placeEventDraft, {
      ...placeEventLayout,
      slides: [...validSlides.slice(0, -1), { ...validSlides.at(-1), visibleText }],
    }, templateContract), /visible text|question|wordmark/i);
  }
});

test("the brand end slide uses the exact actual Discover capture and Desktop logo", () => {
  for (const mutation of [
    { usesActualAppCapture: false },
    { appScreenKind: "figma_redraw" },
    { appScreenSourcePath: "fake.png" },
    { appScreenWidth: 392 },
    { appScreenHeight: 851 },
    { appScreenSha256: "0".repeat(64) },
    { logoSha256: "0".repeat(64) },
    { hasBrandWordmark: true },
  ]) {
    assert.throws(() => validateDraftBundle({
      draft: placeEventDraft,
      expectedTemplate: templateContract,
      layoutEvidence: {
        ...placeEventLayout,
        slides: [...placeEventLayout.slides.slice(0, -1), {
          ...placeEventLayout.slides.at(-1),
          ...mutation,
        }],
      },
    }), /actual|capture|app screen|logo|wordmark/i);
  }
});

test("brand questions must be deterministically relevant to the content type", () => {
  for (const [draft, layout] of [
    [validDraft, validLayoutEvidence],
    [placeEventDraft, placeEventLayout],
    [collectionDraft, {
      ...validLayoutEvidence,
      slides: validLayoutEvidence.slides.map((slide, index) =>
        index === validLayoutEvidence.slides.length - 1
          ? {
              ...slide,
              brandQuestion: collectionDraft.brandQuestion,
              visibleText: [collectionDraft.brandQuestion],
            }
          : slide),
    }],
  ]) {
    assert.throws(() => validateSlideEvidence(
      { ...draft, brandQuestion: "오늘 저녁 뭐 먹을까?" },
      {
        ...layout,
        slides: layout.slides.map((slide, index) => index === layout.slides.length - 1
          ? {
              ...slide,
              brandQuestion: "오늘 저녁 뭐 먹을까?",
              visibleText: ["오늘 저녁 뭐 먹을까?"],
            }
          : slide),
      },
      templateContract,
    ), /relevant|content type/i);
  }
});

test("valid slide evidence passes presentation validation", () => {
  assert.deepEqual(validateSlideEvidence(placeEventDraft, placeEventLayout, templateContract), { ok: true });
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
      aesthetic: {
        ok: true,
        scores: [{ id: "photo-seongsu-route", score: 82 }],
        mix: {
          counts: { place: 1, people: 0, food_or_detail: 0 },
          ratios: { place: 1, people: 0, food_or_detail: 0 },
          warnings: [
            "Photo mix place is 1, target 0.5",
            "Photo mix people is 0, target 0.25",
            "Photo mix food_or_detail is 0, target 0.25",
          ],
        },
        warnings: [
          "Photo mix place is 1, target 0.5",
          "Photo mix people is 0, target 0.25",
          "Photo mix food_or_detail is 0, target 0.25",
        ],
      },
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
