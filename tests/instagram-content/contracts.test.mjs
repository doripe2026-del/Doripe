import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseCandidate,
  parseDraft,
  parsePackageManifest,
  parseTemplateContract,
} from "../../scripts/instagram-content/contracts.mjs";

const domesticCandidate = {
  id: "seongsu-route",
  type: "route",
  title: "성수 산책 코스",
  hook: "주말 반나절 코스",
  countryCode: "KR",
  domesticEvidenceSourceId: "official-place",
  region: "서울 성동구",
  placeIds: ["place-a"],
  expiresAt: null,
  sources: [{ id: "official-place", kind: "official", url: "https://example.go.kr/place-a", title: "장소 안내", publisher: "공공기관", checkedAt: "2026-07-14T00:00:00.000Z" }],
  assets: [{ id: "photo-a", kind: "web_photo", localPath: "/tmp/photo-a.jpg", sourceUrl: "https://example.com/photo-a", credit: "Example", rightsStatus: "not_found", privacyNote: "" }],
  editorialElements: ["selection_reason", "map_or_route"],
  scores: { sendPotential: 5, saveValue: 5, brandFit: 5, timeliness: 4, photoQuality: 4, originalityPotential: 5, factCompleteness: 5, reusePermission: 2 },
};

test("template contract accepts three locked carousel templates", () => {
  const contract = parseTemplateContract({
    version: 1,
    fileKey: "figma-file-key",
    pageName: "Instagram Content Automation",
    canvas: { width: 1080, height: 1350, safeInsetX: 34 },
    templates: [
      { id: "place_event", minSlides: 6, maxSlides: 8, rootNodeId: "1:1", slots: ["slot:title", "slot:photo:01", "slot:brand-question"] },
      { id: "collection", minSlides: 7, maxSlides: 11, rootNodeId: "1:2", slots: ["slot:title", "slot:photo:01", "slot:brand-question"] },
      { id: "route", minSlides: 7, maxSlides: 9, rootNodeId: "1:3", slots: ["slot:title", "slot:photo:01", "slot:brand-question"] },
    ],
  });
  assert.equal(contract.templates.length, 3);
});

test("draft requires a question-shaped brand line and rejects legacy CTA", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("./fixtures/valid-draft.json", import.meta.url),
    "utf8",
  ));
  assert.equal(parseDraft(fixture).brandQuestion.endsWith("?"), true);
  assert.throws(() => parseDraft({ ...fixture, brandQuestion: "장소를 더 발견해요" }), /brand question/i);
  assert.throws(() => parseDraft({ ...fixture, cta: "save" }), /unrecognized|cta/i);
});

test("draft schema uses version 2 while template and package contracts remain version 1", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("./fixtures/valid-draft.json", import.meta.url),
    "utf8",
  ));

  assert.equal(parseDraft(fixture).version, 2);
  assert.throws(() => parseDraft({ ...fixture, version: 1 }), /version|invalid/i);
  const canonicalTemplate = parseTemplateContract(JSON.parse(await readFile(
    new URL("../../docs/instagram-content/template-contract.json", import.meta.url),
    "utf8",
  )));
  assert.equal(canonicalTemplate.version, 1);
  assert.equal(parsePackageManifest({
    version: 1,
    candidateId: domesticCandidate.id,
    createdAt: "2026-07-14T00:00:00.000Z",
    files: ["01-cover.png", "caption.txt", "sources.txt", "review.txt"],
  }).version, 1);
});

test("candidate rejects an AI asset kind on an otherwise valid candidate", () => {
  assert.throws(() => parseCandidate({
    ...domesticCandidate,
    assets: [{ ...domesticCandidate.assets[0], kind: "ai" }],
  }), /web_photo/i);
});

test("candidate rejects incomplete source records", () => {
  const { publisher: _publisher, ...incompleteSource } = domesticCandidate.sources[0];
  assert.throws(() => parseCandidate({ ...domesticCandidate, sources: [incompleteSource] }));
});

test("candidate rejects the forbidden AI asset folder in normalized relative and absolute paths", () => {
  const forbiddenPaths = [
    "public/instagram-pinned-feed/assets/generated.png",
    "/tmp/repo/public/instagram-pinned-feed/assets/generated.png",
    "public\\instagram-pinned-feed\\assets\\generated.png",
  ];

  for (const localPath of forbiddenPaths) {
    assert.throws(() => parseCandidate({
      ...domesticCandidate,
      assets: [{ ...domesticCandidate.assets[0], localPath }],
    }), /AI asset folder/i);
  }
});

test("candidate rejects overseas content or domestic claims without official evidence", () => {
  assert.equal(parseCandidate(domesticCandidate).countryCode, "KR");
  assert.throws(() => parseCandidate({ ...domesticCandidate, countryCode: "JP" }));
  assert.throws(() => parseCandidate({ ...domesticCandidate, domesticEvidenceSourceId: "missing" }), /official source/i);
});

test("candidate requires at least two unique editorial elements", () => {
  assert.throws(() => parseCandidate({
    ...domesticCandidate,
    editorialElements: ["selection_reason", "selection_reason"],
  }), /unique editorial elements/i);
});

test("package requires caption, sources, review, and exported PNG files", () => {
  assert.throws(() => parsePackageManifest({
    version: 1,
    candidateId: domesticCandidate.id,
    createdAt: "2026-07-14T00:00:00.000Z",
    files: ["01-cover.png"],
  }), /package files are incomplete/i);
});
