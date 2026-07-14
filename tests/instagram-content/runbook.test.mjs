import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runbookPath = fileURLToPath(
  new URL("../../docs/ops/instagram-content-daily-runbook.md", import.meta.url),
);

async function readRunbook() {
  return readFile(runbookPath, "utf8");
}

function requirePhrases(text, phrases) {
  for (const phrase of phrases) {
    assert.ok(text.includes(phrase), `missing runbook phrase: ${phrase}`);
  }
}

test("daily runbook starts from the required Brain and repository contracts", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "매일 08:00 Asia/Seoul",
    "Doripe 브레인.md",
    "01. 브랜드와 핵심 메시지.md",
    "04. 콘텐츠 운영.md",
    "03. 콘텐츠 권리 기준.md",
    "docs/instagram-content/template-contract.json",
    "30일 history.json",
    "performance.csv",
  ]);
});

test("daily runbook enforces Korean-only research and a six-candidate minimum", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "대한민국 국내만",
    "공식 출처 우선",
    "확인 시각",
    "countryCode: \"KR\"",
    "domesticEvidenceSourceId",
    "최소 6개",
    "sendPotential: 20",
    "saveValue: 15",
    "brandFit: 15",
    "timeliness: 15",
    "photoQuality: 10",
    "originalityPotential: 10",
    "factCompleteness: 10",
    "reusePermission: 5",
    "매일 최대 2개",
    "가능하면 서로 다른 콘텐츠 유형",
  ]);
});

test("daily runbook bans generated images and records photo rights", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "실제 웹 사진만",
    "AI 이미지 금지",
    "imagegen을 호출하지 않는다",
    "rightsStatus: \"confirmed\"",
    "rightsStatus: \"restricted\"",
    "rightsStatus: \"not_found\"",
    "권리 경고",
    "원본 사진을 Git에 커밋하지 않는다",
  ]);
});

test("daily runbook defines copy and editorial quality gates", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "구체적인 hook",
    "60자 이내의 질문",
    "자연스러운 장소 키워드",
    "factSourceIds",
    "최소 2개의 editorialElements",
    "원본성 검수",
    "비팔로워 도달",
  ]);
});

test("daily runbook documents the CTA-free carousel presentation contract", async () => {
  const runbook = await readRunbook();

  for (const phrase of [
    "brandQuestion",
    "brand_end",
    "사진과 Doripe 심볼만",
    "직접 CTA를 넣지 않는다",
    "hasPhoneMockup",
  ]) {
    assert.match(runbook, new RegExp(phrase));
  }
});

test("daily runbook locks Figma roots, slot edits, and visual correction order", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "PLACE_EVENT: 28:14",
    "COLLECTION: 28:15",
    "ROUTE: 28:16",
    "Figma connector",
    "slot:* 레이어만",
    "사용하지 않는 선택 슬라이드는 숨긴다",
    "스크린샷",
    "문구를 먼저 줄인다",
    "해당 텍스트만",
    "90%",
    "단어 중간 줄바꿈",
    "34px",
  ]);
});

test("daily runbook requires complete canonical layout evidence and matching exports", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "expectedTemplate",
    "templateId",
    "rootNodeId",
    "slideCount",
    "editable",
    "overflows",
    "midWordBreak",
    "baseFontSize",
    "fontSize",
    "모든 slot을 정확히 한 번",
    "1080 × 1350",
    "exports.files.length === layoutEvidence.slideCount",
    "서로 다른 PNG 경로",
    "draft version은 2",
    "PNG IHDR",
    "첫 번째 선택 게시물: sequence 1",
    "두 번째 선택 게시물: sequence 2",
    "같은 날짜에 sequence를 중복 사용하지 않는다",
  ]);
});

test("daily runbook uses every actual CLI interface", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "npm run instagram:content -- check-template docs/instagram-content/template-contract.json",
    "npm run instagram:content -- score \"$CANDIDATES_JSON\" \"$HISTORY_JSON\" \"$PERFORMANCE_CSV\" \"$SELECTED_JSON\"",
    "npm run instagram:content -- validate \"$DRAFT_JSON\" \"$LAYOUT_JSON\" \"$VALIDATION_JSON\"",
    "npm run instagram:content -- finalize \"$DRAFT_JSON\" \"$LAYOUT_JSON\" \"$EXPORTS_JSON\" \"$OUTPUT_ROOT\"",
  ]);
});

test("daily runbook saves review packages without publishing and reports shortages", async () => {
  const text = await readRunbook();

  requirePhrases(text, [
    "/Users/cityboy/Desktop/Doripe/Instagram Content",
    "$OUTPUT_ROOT/YYYY-MM-DD/NN-candidate-id",
    "성공한 package만 history.json에 추가",
    "createdAt",
    "placeIds",
    "30일보다 오래된 기록",
    "두 package 경로",
    "1개 또는 0개",
    "부족 사유",
    "점수 기준을 낮추지 않는다",
    "Instagram 로그인 금지",
    "Instagram 자동 게시 금지",
  ]);
});
