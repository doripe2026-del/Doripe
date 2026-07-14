import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCandidate,
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
      { id: "place_event", minSlides: 5, maxSlides: 7, rootNodeId: "1:1", slots: ["slot:title", "slot:photo:01", "slot:cta"] },
      { id: "collection", minSlides: 6, maxSlides: 10, rootNodeId: "1:2", slots: ["slot:title", "slot:photo:01", "slot:cta"] },
      { id: "route", minSlides: 6, maxSlides: 8, rootNodeId: "1:3", slots: ["slot:title", "slot:photo:01", "slot:cta"] },
    ],
  });
  assert.equal(contract.templates.length, 3);
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
