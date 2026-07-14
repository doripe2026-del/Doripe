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
const validLayoutEvidence = {
  templateId: routeTemplate.id,
  rootNodeId: routeTemplate.rootNodeId,
  canvas: { width: 1080, height: 1350 },
  slideCount: routeTemplate.minSlides,
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
