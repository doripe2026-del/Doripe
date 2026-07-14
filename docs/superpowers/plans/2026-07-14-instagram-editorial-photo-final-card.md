# Instagram Editorial Photo and Actual App End Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국내 실제 웹 사진을 밝은 로컬 에디토리얼 기준으로 선별하고, 모든 Instagram 캐러셀의 마지막 장을 실제 Doripe Discover 화면으로 교체한다.

**Architecture:** 사진 asset 계약에 국내 여부, AI 금지, 역할, 구도, 해상도와 감도 점수를 추가하고 별도 감도 validator를 기존 검수 bundle에 연결한다. 마지막 장은 canonical template contract가 실제 Discover 캡처와 Desktop 로고의 경로·크기·SHA-256을 고정하고, Figma evidence가 해당 자산을 그대로 사용했는지 검증한다. 승인 템플릿과 2026-07-14 드라이런 두 건을 같은 규칙으로 다시 만든다.

**Tech Stack:** Node.js ESM, Zod, Node test runner, JSON contracts, Figma Plugin API/connector, PNG SHA-256 검증

## Global Constraints

- 국내에서 촬영된 실제 웹 사진만 사용한다.
- AI 생성·합성 이미지는 사용하지 않는다.
- 사진 분위기는 `밝은 로컬 에디토리얼`로 고정한다.
- 한 캐러셀의 권장 사진 구성은 장소 50%, 사람 25%, 음식·디테일 25%다.
- 모든 콘텐츠의 마지막 장에는 실제 Doripe Discover 화면을 고정 사용한다.
- 마지막 장의 질문 문구만 콘텐츠에 맞춰 바꾼다.
- CTA 버튼과 저장·공유 요청 문구는 넣지 않는다.
- Instagram 캔버스는 정확히 1080×1350이고 좌우 안전영역은 34px이다.
- 사진별 감도 점수는 70점 이상이어야 한다.
- 앱 화면은 `public/app-preview/assets/references/b2.png`, 393×852, SHA-256 `0a1ede7e8b24ab705c4f71a50dab92cfccc8b57a49f8b46451d28da036d4e250`을 사용한다.
- Doripe 심볼은 Desktop의 `/Users/cityboy/Desktop/Doripe Assets/icon removed.png`를 사용한다. repository 사본 `public/instagram-pinned-feed/assets/doripe-icon-green.png`과 SHA-256 `b18f6f59e483b6363a94c96a10b67e092a231df6d29497d2a2f7cbec40905a76`이 같아야 한다.
- Instagram 로그인, 자동 게시, production 배포는 하지 않는다.
- Brain 문서는 수정하지 않는다.

---

## File Map

- `scripts/instagram-content/contracts.mjs`: 사진 역할·구도·국내·AI·해상도·감도 점수 계약과 마지막 장 asset 계약을 파싱한다.
- `scripts/instagram-content/photo-aesthetic.mjs`: 사진 감도 점수와 캐러셀 사진 구성 비율을 계산한다.
- `scripts/instagram-content/validators.mjs`: 사진 감도와 실제 Discover 캡처 사용을 자동 검수한다.
- `scripts/instagram-content/package-writer.mjs`: `sources.txt`와 `review.txt`에 사진 감도 결과를 기록한다.
- `scripts/instagram-content/write-template-contract.mjs`: 실제 Discover 캡처와 Doripe 심볼 manifest를 canonical template contract에 기록한다.
- `docs/instagram-content/template-contract.json`: 승인 Figma root와 실제 마지막 장 asset manifest를 고정한다.
- `docs/ops/instagram-content-daily-runbook.md`: 밝은 로컬 에디토리얼 사진 조사·선별·검수 방법을 설명한다.
- `tests/instagram-content/photo-aesthetic.test.mjs`: 감도 점수와 구성 비율 단위 테스트다.
- `tests/instagram-content/contracts.test.mjs`: 새 사진·마지막 장 schema 회귀 테스트다.
- `tests/instagram-content/validators.test.mjs`: 저감도·저해상도·구도 반복·가짜 UI 차단 테스트다.
- `tests/instagram-content/package-writer.test.mjs`: package에 감도와 권리 기록이 남는지 확인한다.
- `tests/instagram-content/template-contract.test.mjs`: 실제 Discover 캡처와 Desktop 로고 hash를 고정한다.
- `tests/instagram-content/cli.test.mjs`: `aesthetic` gate와 실제 앱 화면 evidence를 포함한 CLI 통합 테스트다.
- `tests/instagram-content/runbook.test.mjs`: 새 운영 규칙을 고정한다.
- `tests/instagram-content/fixtures/candidates.json`: 새 사진 metadata를 포함하는 후보 fixture다.
- `tests/instagram-content/fixtures/valid-draft.json`: 새 사진 metadata를 포함하는 정상 draft fixture다.
- `tests/instagram-content/fixtures/invalid-repost-draft.json`: schema 호환 상태의 비정상 fixture다.
- Figma file `9btf9oUzIvw3JQq4OPyYEn`: 승인 root `43:25`, `50:31`, `46:49`와 드라이런 마지막 장 `64:29`, `64:34`를 수정한다.
- External packages `/Users/cityboy/Desktop/Doripe/Instagram Content/2026-07-14`: 두 드라이런 결과를 안전하게 교체한다.

---

### Task 1: 사진 감도 metadata 계약과 점수 계산

**Files:**
- Create: `scripts/instagram-content/photo-aesthetic.mjs`
- Create: `tests/instagram-content/photo-aesthetic.test.mjs`
- Modify: `scripts/instagram-content/contracts.mjs`
- Modify: `tests/instagram-content/contracts.test.mjs`
- Modify: `tests/instagram-content/fixtures/candidates.json`
- Modify: `tests/instagram-content/fixtures/valid-draft.json`
- Modify: `tests/instagram-content/fixtures/invalid-repost-draft.json`

**Interfaces:**
- Consumes: candidate `assets[]`에 기록된 사진 metadata.
- Produces: `PHOTO_ROLES`, `SHOT_TYPES`, `scorePhotoAesthetic(asset) -> number`, `summarizePhotoMix(assets) -> { counts, ratios, warnings }`.

- [ ] **Step 1: 감도 점수 실패 테스트 작성**

`tests/instagram-content/photo-aesthetic.test.mjs`를 다음 내용으로 만든다.

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  scorePhotoAesthetic,
  summarizePhotoMix,
} from "../../scripts/instagram-content/photo-aesthetic.mjs";

const photo = (overrides = {}) => ({
  id: "photo-a",
  photoRole: "place",
  shotType: "interior",
  aestheticScores: {
    naturalLight: 4,
    placeSpecificity: 5,
    composition: 4,
    livedExperience: 3,
    paletteCoherence: 4,
  },
  ...overrides,
});

test("photo aesthetic score uses the approved 25/25/20/15/15 weights", () => {
  assert.equal(scorePhotoAesthetic(photo()), 82);
  assert.equal(scorePhotoAesthetic(photo({
    aestheticScores: {
      naturalLight: 5,
      placeSpecificity: 5,
      composition: 5,
      livedExperience: 5,
      paletteCoherence: 5,
    },
  })), 100);
});

test("photo mix reports the approved 50/25/25 target", () => {
  const result = summarizePhotoMix([
    photo({ id: "p1", photoRole: "place" }),
    photo({ id: "p2", photoRole: "place" }),
    photo({ id: "person", photoRole: "people" }),
    photo({ id: "detail", photoRole: "food_or_detail" }),
  ]);
  assert.deepEqual(result.counts, { place: 2, people: 1, food_or_detail: 1 });
  assert.deepEqual(result.ratios, { place: 0.5, people: 0.25, food_or_detail: 0.25 });
  assert.deepEqual(result.warnings, []);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test tests/instagram-content/photo-aesthetic.test.mjs`

Expected: `photo-aesthetic.mjs`가 없어 FAIL.

- [ ] **Step 3: 최소 점수 계산 구현**

`scripts/instagram-content/photo-aesthetic.mjs`를 다음 내용으로 만든다.

```js
export const PHOTO_ROLES = Object.freeze(["place", "people", "food_or_detail"]);
export const SHOT_TYPES = Object.freeze([
  "exterior",
  "interior",
  "landscape",
  "people_context",
  "food",
  "detail",
]);

const WEIGHTS = Object.freeze({
  naturalLight: 25,
  placeSpecificity: 25,
  composition: 20,
  livedExperience: 15,
  paletteCoherence: 15,
});
const TARGET_RATIOS = Object.freeze({
  place: 0.5,
  people: 0.25,
  food_or_detail: 0.25,
});

export function scorePhotoAesthetic(asset) {
  return Math.round(Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (asset.aestheticScores[key] / 5) * weight,
    0,
  ));
}

export function summarizePhotoMix(assets) {
  const counts = { place: 0, people: 0, food_or_detail: 0 };
  for (const asset of assets) counts[asset.photoRole] += 1;
  const total = assets.length;
  const ratios = Object.fromEntries(Object.entries(counts).map(
    ([role, count]) => [role, total === 0 ? 0 : count / total],
  ));
  const warnings = Object.entries(TARGET_RATIOS)
    .filter(([role, target]) => Math.abs(ratios[role] - target) >= 0.25)
    .map(([role, target]) => `Photo mix ${role} is ${ratios[role]}, target ${target}`);
  return { counts, ratios, warnings };
}
```

- [ ] **Step 4: asset schema를 확장하는 실패 테스트 작성**

`tests/instagram-content/contracts.test.mjs`에 다음 테스트를 추가한다.

```js
test("candidate requires domestic non-AI editorial photo metadata", () => {
  const asset = domesticCandidate.assets[0];
  assert.equal(parseCandidate(domesticCandidate).assets[0].countryCode, "KR");
  for (const mutation of [
    { countryCode: "JP" },
    { aiGenerated: true },
    { width: 0 },
    { height: 0 },
    { photoRole: "unknown" },
    { shotType: "unknown" },
  ]) {
    assert.throws(() => parseCandidate({
      ...domesticCandidate,
      assets: [{ ...asset, ...mutation }],
    }));
  }
});
```

- [ ] **Step 5: asset schema와 fixtures 갱신**

`scripts/instagram-content/contracts.mjs`에 다음 schema를 추가하고 기존 `assetSchema`에 합친다.

```js
import { PHOTO_ROLES, SHOT_TYPES } from "./photo-aesthetic.mjs";

const aestheticScoresSchema = z.object({
  naturalLight: z.number().min(0).max(5),
  placeSpecificity: z.number().min(0).max(5),
  composition: z.number().min(0).max(5),
  livedExperience: z.number().min(0).max(5),
  paletteCoherence: z.number().min(0).max(5),
}).strict();

const assetSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("web_photo"),
  localPath: z.string().min(1).refine((localPath) => {
    const normalizedPath = posix.normalize(localPath.replaceAll("\\", "/"));
    return !/(?:^|\/)public\/instagram-pinned-feed\/assets(?:\/|$)/.test(normalizedPath);
  }, "AI asset folder is forbidden"),
  sourceUrl: z.string().url(),
  credit: z.string().min(1),
  rightsStatus: z.enum(RIGHTS_STATUSES),
  privacyNote: z.string().default(""),
  countryCode: z.literal("KR"),
  aiGenerated: z.literal(false),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  photoRole: z.enum(PHOTO_ROLES),
  shotType: z.enum(SHOT_TYPES),
  aestheticScores: aestheticScoresSchema,
}).strict();
```

세 fixture의 모든 asset에 다음 고정 테스트 값을 넣는다.

```json
{
  "countryCode": "KR",
  "aiGenerated": false,
  "width": 1600,
  "height": 2000,
  "photoRole": "place",
  "shotType": "interior",
  "aestheticScores": {
    "naturalLight": 4,
    "placeSpecificity": 5,
    "composition": 4,
    "livedExperience": 3,
    "paletteCoherence": 4
  }
}
```

- [ ] **Step 6: Task 1 테스트 통과 확인**

Run: `node --test tests/instagram-content/photo-aesthetic.test.mjs tests/instagram-content/contracts.test.mjs`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add scripts/instagram-content/photo-aesthetic.mjs scripts/instagram-content/contracts.mjs tests/instagram-content/photo-aesthetic.test.mjs tests/instagram-content/contracts.test.mjs tests/instagram-content/fixtures/candidates.json tests/instagram-content/fixtures/valid-draft.json tests/instagram-content/fixtures/invalid-repost-draft.json
git commit -m "feat: add editorial photo aesthetic contract"
```

---

### Task 2: 감도 validator와 package 기록

**Files:**
- Modify: `scripts/instagram-content/validators.mjs`
- Modify: `scripts/instagram-content/package-writer.mjs`
- Modify: `tests/instagram-content/validators.test.mjs`
- Modify: `tests/instagram-content/package-writer.test.mjs`
- Modify: `tests/instagram-content/cli.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `scorePhotoAesthetic()`와 `summarizePhotoMix()`.
- Produces: `validatePhotoAesthetic(candidate) -> { ok, scores, mix, warnings }`와 `validation.aesthetic` gate.

- [ ] **Step 1: 감도 validator 실패 테스트 작성**

`tests/instagram-content/validators.test.mjs`에 import와 다음 테스트를 추가한다.

```js
import { validatePhotoAesthetic } from "../../scripts/instagram-content/validators.mjs";

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
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/instagram-content/validators.test.mjs`

Expected: `validatePhotoAesthetic`가 없어 FAIL.

- [ ] **Step 3: 최소 감도 validator 구현**

`scripts/instagram-content/validators.mjs`에 다음 함수를 추가한다.

```js
import {
  scorePhotoAesthetic,
  summarizePhotoMix,
} from "./photo-aesthetic.mjs";

export function validatePhotoAesthetic(candidate) {
  const assets = requireArray(candidate?.assets, "Assets");
  if (assets.length === 0) throw new Error("At least one asset is required");
  const scores = assets.map((asset) => ({
    id: asset.id,
    score: scorePhotoAesthetic(asset),
  }));
  for (const [index, asset] of assets.entries()) {
    if (asset.countryCode !== "KR" || asset.aiGenerated !== false) {
      throw new Error(`Photo must be domestic and non-AI: ${asset.id}`);
    }
    if (Math.min(asset.width, asset.height) < 1080) {
      throw new Error(`Photo short edge must be at least 1080: ${asset.id}`);
    }
    if (scores[index].score < 70) {
      throw new Error(`Photo aesthetic score must be at least 70: ${asset.id}`);
    }
  }
  if (assets.length >= 4 && new Set(assets.map(({ shotType }) => shotType)).size < 3) {
    throw new Error("Four or more photos require at least three shot types");
  }
  const mix = summarizePhotoMix(assets);
  return { ok: true, scores, mix, warnings: mix.warnings };
}
```

`validateDraftBundle()`에 다음 순서로 gate를 추가한다.

```js
const sources = validateSources(draft.candidate);
const aesthetic = validatePhotoAesthetic(draft.candidate);
validateExpectedTemplate(draft, expectedTemplate, layoutEvidence);
const layout = validateLayoutEvidence(layoutEvidence);
const presentation = validateSlideEvidence(draft, layoutEvidence, expectedTemplate);
return { originality, caption, sources, aesthetic, layout, presentation };
```

- [ ] **Step 4: package 기록 실패 테스트 작성**

`tests/instagram-content/package-writer.test.mjs`의 validation fixture에 `aesthetic`을 추가하고 첫 테스트에 다음 assertion을 추가한다.

```js
aesthetic: {
  ok: true,
  scores: [{ id: draft.candidate.assets[0].id, score: 82 }],
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

assert.match(sources, /Photo role: place/);
assert.match(sources, /Shot type: interior/);
assert.match(sources, /Dimensions: 1600x2000/);
assert.match(sources, /Aesthetic score: 82/);
assert.match(review, /Aesthetic: PASS/i);
assert.match(review, /Photo mix people is 0/);
```

- [ ] **Step 5: package writer에 aesthetic gate와 기록 추가**

`VALIDATION_GATES`에 `aesthetic`을 `sources` 다음에 추가한다.

`buildSourcesText()`의 사진별 줄에 다음 값을 추가한다.

```js
`Photo role: ${asset.photoRole}`,
`Shot type: ${asset.shotType}`,
`Dimensions: ${asset.width}x${asset.height}`,
`Aesthetic score: ${validation.aesthetic.scores.find(({ id }) => id === asset.id)?.score}`,
```

이를 위해 `buildSourcesText(draft, validation)`으로 signature를 바꾸고 호출부도 같은 signature를 사용한다. `buildReviewText()`에는 다음 section을 추가한다.

```js
"Aesthetic warnings:",
...(validation.aesthetic.warnings.length > 0
  ? validation.aesthetic.warnings.map((warning) => `- ${warning}`)
  : ["- None"]),
```

- [ ] **Step 6: CLI 통합 기대값 갱신**

`tests/instagram-content/cli.test.mjs`의 검수 gate 기대값에 `aesthetic: true`를 추가하고, `validRouteLayoutEvidence()`는 Task 3의 실제 앱 화면 evidence를 적용할 준비가 되도록 마지막 slide builder를 한 곳에 유지한다.

- [ ] **Step 7: Task 2 테스트 통과 확인**

Run: `node --test tests/instagram-content/validators.test.mjs tests/instagram-content/package-writer.test.mjs tests/instagram-content/cli.test.mjs`

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add scripts/instagram-content/validators.mjs scripts/instagram-content/package-writer.mjs tests/instagram-content/validators.test.mjs tests/instagram-content/package-writer.test.mjs tests/instagram-content/cli.test.mjs
git commit -m "feat: validate and report editorial photo quality"
```

---

### Task 3: 실제 Discover 화면과 Desktop 로고 계약

**Files:**
- Modify: `scripts/instagram-content/contracts.mjs`
- Modify: `scripts/instagram-content/write-template-contract.mjs`
- Modify: `scripts/instagram-content/validators.mjs`
- Modify: `scripts/instagram-content/cli.mjs`
- Modify: `docs/instagram-content/template-contract.json`
- Modify: `tests/instagram-content/contracts.test.mjs`
- Modify: `tests/instagram-content/template-contract.test.mjs`
- Modify: `tests/instagram-content/validators.test.mjs`
- Modify: `tests/instagram-content/cli.test.mjs`

**Interfaces:**
- Consumes: 실제 캡처 `b2.png`, Desktop와 동일 hash인 repository logo 사본.
- Produces: `templateContract.brandEnd`와 실제 앱 화면을 증명하는 `brand_end` evidence.

- [ ] **Step 1: asset hash와 크기 확인**

Run:

```bash
shasum -a 256 public/app-preview/assets/references/b2.png \
  '/Users/cityboy/Desktop/Doripe Assets/icon removed.png' \
  public/instagram-pinned-feed/assets/doripe-icon-green.png
file public/app-preview/assets/references/b2.png \
  '/Users/cityboy/Desktop/Doripe Assets/icon removed.png'
```

Expected:

```text
0a1ede7e8b24ab705c4f71a50dab92cfccc8b57a49f8b46451d28da036d4e250  public/app-preview/assets/references/b2.png
b18f6f59e483b6363a94c96a10b67e092a231df6d29497d2a2f7cbec40905a76  /Users/cityboy/Desktop/Doripe Assets/icon removed.png
b18f6f59e483b6363a94c96a10b67e092a231df6d29497d2a2f7cbec40905a76  public/instagram-pinned-feed/assets/doripe-icon-green.png
```

- [ ] **Step 2: template contract 실패 테스트 작성**

`tests/instagram-content/template-contract.test.mjs`에 다음 expectation을 추가하고 approved roots를 최신 값으로 바꾼다.

```js
const approvedRoots = {
  place_event: "43:25",
  collection: "50:31",
  route: "46:49",
};

const assertNoDaytripReferenceMetadata = (contract) => {
  assert.doesNotMatch(JSON.stringify(contract), /daytrip|daytrip-reference|imageHash/i);
};

assert.deepEqual(contract.brandEnd, {
  backgroundHex: "#050505",
  appScreen: {
    kind: "actual_discover_capture",
    sourcePath: "public/app-preview/assets/references/b2.png",
    width: 393,
    height: 852,
    sha256: "0a1ede7e8b24ab705c4f71a50dab92cfccc8b57a49f8b46451d28da036d4e250",
  },
  logo: {
    sourcePath: "public/instagram-pinned-feed/assets/doripe-icon-green.png",
    width: 500,
    height: 500,
    colorHex: "#20F58A",
    sha256: "b18f6f59e483b6363a94c96a10b67e092a231df6d29497d2a2f7cbec40905a76",
  },
});
```

- [ ] **Step 3: template contract schema와 writer 구현**

`scripts/instagram-content/contracts.mjs`에 다음 schema를 추가하고 `templateContractSchema`에 `brandEnd`를 요구한다.

```js
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const brandEndSchema = z.object({
  backgroundHex: z.literal("#050505"),
  appScreen: z.object({
    kind: z.literal("actual_discover_capture"),
    sourcePath: z.literal("public/app-preview/assets/references/b2.png"),
    width: z.literal(393),
    height: z.literal(852),
    sha256: sha256Schema,
  }).strict(),
  logo: z.object({
    sourcePath: z.literal("public/instagram-pinned-feed/assets/doripe-icon-green.png"),
    width: z.literal(500),
    height: z.literal(500),
    colorHex: z.literal("#20F58A"),
    sha256: sha256Schema,
  }).strict(),
}).strict();

const templateContractSchema = z.object({
  version: z.literal(1),
  fileKey: z.string().min(1),
  pageName: z.literal("Instagram Content Automation"),
  canvas: z.object({
    width: z.literal(1080),
    height: z.literal(1350),
    safeInsetX: z.literal(34),
  }),
  brandEnd: brandEndSchema,
  templates: z.array(templateSchema).length(3),
});
```

`write-template-contract.mjs`와 tracked JSON에 Step 2의 `brandEnd` object를 그대로 추가하고 root IDs를 `43:25`, `50:31`, `46:49`로 갱신한다.

`tests/instagram-content/contracts.test.mjs`의 수동 template contract fixture에도 Step 2의 `brandEnd` object를 그대로 추가해 schema 성공 경로를 유지한다.

기존 `assertNoReferenceAssetMetadata`는 `sourcePath` 자체를 금지하므로 Step 2의 `assertNoDaytripReferenceMetadata`로 교체한다. 실제 Doripe asset metadata는 허용하되 Daytrip reference만 계속 차단한다.

- [ ] **Step 4: CLI가 canonical asset hash를 실제 파일과 대조하도록 구현**

`scripts/instagram-content/cli.mjs`에 다음 함수를 추가하고 `check-template`과 `loadCanonicalTemplate()` 양쪽에서 호출한다.

```js
const REPO_ROOT_URL = new URL("../../", import.meta.url);

async function verifyTemplateBrandAssets(contract) {
  for (const [label, asset] of [
    ["app screen", contract.brandEnd.appScreen],
    ["Doripe logo", contract.brandEnd.logo],
  ]) {
    const bytes = await readFile(new URL(asset.sourcePath, REPO_ROOT_URL));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== asset.sha256) {
      throw new Error(`${label} SHA-256 does not match template contract`);
    }
  }
}

async function loadCanonicalTemplate() {
  const contract = parseTemplateContract(await readJson(CANONICAL_TEMPLATE_URL));
  await verifyTemplateBrandAssets(contract);
  return contract;
}
```

`check-template` branch는 다음 순서로 바꾼다.

```js
const contract = parseTemplateContract(await readJson(args[0]));
await verifyTemplateBrandAssets(contract);
console.log("Instagram template contract passed.");
```

- [ ] **Step 5: 실제 앱 화면 evidence 실패 테스트 작성**

`tests/instagram-content/validators.test.mjs`의 정상 마지막 slide를 다음 구조로 바꾼다.

```js
{
  role: "brand_end",
  nodeId: "200:6",
  textSlots: ["slot:brand-question"],
  visibleText: [placeEventDraft.brandQuestion],
  brandQuestion: placeEventDraft.brandQuestion,
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
  backgroundHex: "#050505"
}
```

다음 mutation을 각각 실패시킨다.

```js
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
```

- [ ] **Step 6: 마지막 장 validator 구현**

`validateSlideEvidence()`가 `expectedTemplate`도 받도록 signature를 바꾸고 `validateDraftBundle()`에서 전달한다.

```js
export function validateSlideEvidence(draft, evidence, expectedTemplate) {
  const last = evidence.slides.at(-1);
  const brandEnd = expectedTemplate.brandEnd;
  if (last.usesActualAppCapture !== true) throw new Error("Brand end requires actual app capture");
  if (last.appScreenKind !== brandEnd.appScreen.kind) throw new Error("App screen kind must match actual capture");
  if (last.appScreenSourcePath !== brandEnd.appScreen.sourcePath) throw new Error("App screen source must match contract");
  if (last.appScreenWidth !== brandEnd.appScreen.width || last.appScreenHeight !== brandEnd.appScreen.height) {
    throw new Error("App screen dimensions must match contract");
  }
  if (last.appScreenSha256 !== brandEnd.appScreen.sha256) throw new Error("App screen SHA-256 must match contract");
  if (last.logoSha256 !== brandEnd.logo.sha256) throw new Error("Doripe logo SHA-256 must match contract");
  if (last.hasBrandWordmark !== false) throw new Error("Brand end uses the icon asset without a wordmark");
  const finalVisibleText = requireArray(last.visibleText, "Brand end visible text");
  if (finalVisibleText.length !== 1 || finalVisibleText[0] !== draft.brandQuestion) {
    throw new Error("Brand end visible text must be exactly the draft question");
  }
  return { ok: true };
}
```

기존 `validateSlideEvidence(draft, evidence)` 직접 호출은 모두 `validateSlideEvidence(draft, evidence, templateContract)`로 바꾼다. 함수 시작의 slide 배열, node ID, cover, CTA, 콘텐츠 유형별 사진 장 검수는 삭제하지 않는다.

- [ ] **Step 7: CLI 정상 evidence와 계약 테스트 갱신**

`tests/instagram-content/cli.test.mjs`의 `validRouteLayoutEvidence()` 마지막 slide에도 Step 5의 필드를 그대로 넣는다. `validate` 결과 gate 기대값은 다음과 같아야 한다.

```js
{
  originality: true,
  caption: true,
  sources: true,
  aesthetic: true,
  layout: true,
  presentation: true,
}
```

같은 테스트 파일에서 app screen 또는 logo hash를 `"0".repeat(64)`로 바꾼 임시 contract를 `check-template`에 전달하고 `/SHA-256.*template contract/i`로 실패하는 경우를 추가한다.

- [ ] **Step 8: Task 3 테스트 통과 확인**

Run: `node --test tests/instagram-content/contracts.test.mjs tests/instagram-content/template-contract.test.mjs tests/instagram-content/validators.test.mjs tests/instagram-content/cli.test.mjs`

Expected: PASS.

- [ ] **Step 9: 커밋**

```bash
git add scripts/instagram-content/contracts.mjs scripts/instagram-content/write-template-contract.mjs scripts/instagram-content/validators.mjs scripts/instagram-content/cli.mjs docs/instagram-content/template-contract.json tests/instagram-content/contracts.test.mjs tests/instagram-content/template-contract.test.mjs tests/instagram-content/validators.test.mjs tests/instagram-content/cli.test.mjs
git commit -m "feat: require actual Doripe discover end card"
```

---

### Task 4: 일일 운영 가이드와 회귀 테스트

**Files:**
- Modify: `docs/ops/instagram-content-daily-runbook.md`
- Modify: `tests/instagram-content/runbook.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3의 metadata, validator, 실제 앱 화면 계약.
- Produces: 매일 같은 기준으로 사진을 조사하고 마지막 장을 만드는 운영 절차.

- [ ] **Step 1: runbook 실패 테스트 작성**

`tests/instagram-content/runbook.test.mjs`에 다음 테스트를 추가한다.

```js
test("daily runbook enforces the bright local editorial photo contract", async () => {
  const text = await readRunbook();
  requirePhrases(text, [
    "밝은 로컬 에디토리얼",
    "장소 50%",
    "사람 25%",
    "음식·디테일 25%",
    "감도 점수 70점",
    "short edge 1080px",
    "최소 3개의 shotType",
    "어둡고 탁한 사진",
    "회색 하늘",
    "자연스러운 뒷모습",
  ]);
});

test("daily runbook uses the real fixed Discover capture and Desktop logo", async () => {
  const text = await readRunbook();
  requirePhrases(text, [
    "public/app-preview/assets/references/b2.png",
    "actual_discover_capture",
    "393 × 852",
    "/Users/cityboy/Desktop/Doripe Assets/icon removed.png",
    "Figma 도형으로 다시 그리지 않는다",
    "모든 콘텐츠에서 같은 Discover 화면",
  ]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/instagram-content/runbook.test.mjs`

Expected: 새 문구가 없어 FAIL.

- [ ] **Step 3: runbook 사진 조사 절차 갱신**

사진 단계에 다음 순서를 명시한다.

1. 장소별 후보 사진을 필요한 수량의 최소 2배 수집한다.
2. `countryCode: "KR"`, `aiGenerated: false`, 실제 픽셀 크기, `photoRole`, `shotType`, 다섯 감도 점수를 기록한다.
3. short edge 1080px 미만, 감도 점수 70점 미만, 어둡고 탁한 사진, 회색 하늘 위주의 사진을 제외한다.
4. 4장 이상이면 최소 3개의 `shotType`을 사용한다.
5. 장소 50%, 사람 25%, 음식·디테일 25%를 목표로 하고 자연스러운 뒷모습과 환경 속 인물을 우선한다.
6. 관련 사진이 부족하면 비율을 억지로 채우지 않고 warning을 남기거나 후보를 교체한다.

Figma 마지막 장 단계에는 Step 1 테스트의 실제 asset 경로·크기와 다음 고정 구조를 적는다.

```text
BRAND_END 1080×1350
├─ background #050505
├─ slot:brand-question (질문 한 문장)
├─ phone shell
│  └─ actual_discover_capture 393×852
└─ Desktop Doripe icon asset
```

- [ ] **Step 4: runbook 전체 테스트 통과 확인**

Run: `node --test tests/instagram-content/runbook.test.mjs`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add docs/ops/instagram-content-daily-runbook.md tests/instagram-content/runbook.test.mjs
git commit -m "docs: add editorial photo and real app runbook"
```

---

### Task 5: Figma 승인 템플릿과 드라이런 실제 수정

**Files:**
- External edit: Figma file `9btf9oUzIvw3JQq4OPyYEn`, page `Instagram Content Automation`
- Verify: `docs/instagram-content/template-contract.json`
- Read-only source: `public/app-preview/assets/references/b2.png`
- Read-only source: `/Users/cityboy/Desktop/Doripe Assets/icon removed.png`
- External output: `/Users/cityboy/Desktop/Doripe/Instagram Content/2026-07-14`

**Interfaces:**
- Consumes: 승인 roots `43:25`, `50:31`, `46:49`, 실제 앱 캡처와 Desktop icon, Tasks 1–4의 검수 규칙.
- Produces: 실제 Discover 화면이 있는 승인 `BRAND_END`, 새 사진이 적용된 드라이런 두 건, 검수 가능한 package.

- [ ] **Step 1: Figma 작업 전 기준 확인**

Figma connector로 file `9btf9oUzIvw3JQq4OPyYEn`의 다음 node를 읽고 각 root가 1080×1350 slide들을 포함하는지 확인한다.

```text
place_event approved root: 43:25
collection approved root: 50:31
route approved root: 46:49
collection dry-run final: 64:29
place_event dry-run final: 64:34
```

Expected: node가 모두 존재하고 `slot:brand-question`이 있다. 하나라도 없으면 Figma 수정을 중단하고 contract와 실제 node 불일치를 보고한다.

- [ ] **Step 2: 승인 BRAND_END를 실제 앱 화면으로 교체**

각 승인 root의 마지막 frame에 다음 구조를 적용한다.

```text
V3/{TYPE}/BRAND_END — APPROVED (1080×1350)
├─ design:brand-background  x=0   y=0    w=1080 h=1350 fill=#050505
├─ slot:brand-question      x=100 y=110  w=880  h=150  align=center fill=#FFFFFF
├─ design:phone-shell       x=324 y=312  w=433  h=908  fill=#111312 radius=48
│  └─ design:actual-discover-capture
│     x=344 y=340 w=393 h=852 image=b2.png
└─ design:doripe-mark       x=512 y=1260 w=56 h=56 image=icon removed.png
```

앱 화면을 Figma 도형으로 다시 그리지 않는다. 기존 가짜 masonry 카드, route line, 앱에 없는 버튼과 텍스트를 삭제한다. `Doripe.` wordmark와 CTA 버튼도 삭제한다.

- [ ] **Step 3: 컬렉션 드라이런 사진 후보 재수집**

아래 다섯 공식 전시 페이지에서 각 3장 이상, 총 15장 이상의 실제 사진 후보를 조사한다.

```text
https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1529410
https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1509709
https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1523485
https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1538201
https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1498975
```

공식 페이지에서 밝은 현장 사진이 부족할 때만 작가·전시장 공식 계정과 신뢰 가능한 국내 매거진으로 넓힌다. 각 후보에 Task 1 metadata를 기록하고 short edge 1080px, 감도 70점, 권리 상태를 검사한다. 최종 5장은 `place` 3장, `people` 1장, `food_or_detail` 1장을 목표로 하며 전시에서는 작품 세부 사진을 `food_or_detail`로 기록한다.

- [ ] **Step 4: 단일 전시 드라이런 사진 후보 재수집**

다음 공식 페이지와 더레퍼런스 공식 채널에서 총 12장 이상의 실제 후보를 조사한다.

```text
https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1554633
```

최종 6장은 `place` 3장, `people` 1장, `food_or_detail` 2장을 목표로 한다. 식별 가능한 사람 사진이 권리·초상 검수를 통과하지 못하면 관련 없는 인물을 넣지 않고 `place` 4장, `food_or_detail` 2장으로 구성한 뒤 mix warning을 남긴다.

- [ ] **Step 5: 두 드라이런과 승인 template에 asset 적용**

- collection dry run은 cover 다음 장들에 Step 3 사진을 서로 다른 구도로 적용한다.
- place_event dry run은 cover와 마지막 장 사이에 Step 4 사진만 full-bleed로 적용하고 작은 Doripe symbol 외 텍스트는 넣지 않는다.
- 두 마지막 장은 Step 2의 동일한 실제 Discover 화면을 사용한다.
- 질문은 기존 draft의 `brandQuestion`만 넣고 직접 CTA를 넣지 않는다.

- [ ] **Step 6: Figma evidence 작성과 자동 검수**

각 dry run의 `layout-evidence.json`에서 마지막 slide는 Task 3 Step 5의 실제 app fields를 사용한다. 사진 asset에는 실제 점수와 role을 넣고 다음 명령을 실행한다.

```bash
npm run instagram:content -- validate "$DRAFT_JSON" "$LAYOUT_JSON" "$VALIDATION_JSON"
```

Expected: `originality`, `caption`, `sources`, `aesthetic`, `layout`, `presentation`이 모두 `ok: true`.

- [ ] **Step 7: 시각 검수**

각 슬라이드를 Figma screenshot으로 확인한다.

- 사진이 밝고 명확한 피사체를 갖는다.
- 장소·사람·세부 구도가 반복되지 않는다.
- 마지막 앱 화면이 `b2.png`와 픽셀 내용상 동일하다.
- 질문과 phone이 34px safe inset 안에 있다.
- 단어 중간 줄바꿈과 overflow가 없다.
- Desktop Doripe symbol이 작게 보이고 wordmark·CTA가 없다.

실패한 slide만 수정한 뒤 다시 screenshot을 확인한다.

- [ ] **Step 8: 기존 package 보존 후 재생성**

기존 두 package를 다음 archive 경로에 그대로 복사한다.

```text
/Users/cityboy/Desktop/Doripe/Instagram Content/2026-07-14/_before-editorial/
├─ 01-seoul-free-exhibitions-weekend/
└─ 02-private-protocol-last-week/
```

새 PNG를 1080×1350으로 export하고 `exports.json`의 실제 node IDs와 SHA-256을 기록한다. 임시 output root에서 `finalize`를 통과시킨 뒤 기존 두 package만 새 결과로 교체한다. archive와 다른 날짜의 package는 수정하지 않는다.

- [ ] **Step 9: package 최종 확인**

두 package에서 다음을 확인한다.

```text
모든 PNG: 1080×1350
sources.txt: 사진 role, shot type, dimensions, aesthetic score, source, rights status
review.txt: Aesthetic PASS, mix warning, rights warning, privacy note
마지막 PNG: 실제 Discover 화면 + 질문 + Desktop Doripe symbol
```

Instagram 로그인과 게시는 수행하지 않는다.

---

### Task 6: 전체 회귀 검증과 작업 기록

**Files:**
- Verify only: Instagram automation code, tests, contract, runbook
- External verify: Figma file and two package directories

**Interfaces:**
- Consumes: Tasks 1–5의 완료 결과.
- Produces: 테스트 통과 증거와 최종 사용자 검수용 결과.

- [ ] **Step 1: Instagram 테스트 전체 실행**

Run: `node --test tests/instagram-content/*.test.mjs`

Expected: 모든 Instagram content test PASS.

- [ ] **Step 2: canonical template 검사**

Run: `npm run instagram:content -- check-template docs/instagram-content/template-contract.json`

Expected: `Instagram template contract passed.`

- [ ] **Step 3: 전체 repository 관련 검증**

Run: `npm test`

Expected: 기존 unrelated test를 포함해 PASS. 기존 사용자 변경 때문에 unrelated failure가 있으면 Instagram 전용 테스트 결과와 분리해 정확한 실패 파일을 보고한다.

- [ ] **Step 4: spec coverage와 불완전 문구 검사**

Run:

```bash
rg -n "T[B]D|T[O]DO|F[I]XME|place[Hh]older|미[정]|추후 결[정]" \
  docs/superpowers/specs/2026-07-14-instagram-editorial-photo-final-card-design.md \
  docs/superpowers/plans/2026-07-14-instagram-editorial-photo-final-card.md
git diff --check
```

Expected: 불완전 문구 match 없음, `git diff --check` 성공.

- [ ] **Step 5: 최종 상태 확인**

Run: `git status --short`

Expected: 이번 작업 파일만 명확히 식별된다. 기존 unrelated dirty files는 수정·stage하지 않는다.

- [ ] **Step 6: 최종 커밋**

Instagram 관련 남은 tracked 변경만 stage한다.

```bash
git add scripts/instagram-content docs/instagram-content docs/ops/instagram-content-daily-runbook.md tests/instagram-content
git diff --cached --name-only
git commit -m "feat: finish editorial instagram carousel workflow"
```

Expected: Figma 외부 변경과 Desktop package는 commit 대상이 아니며, repository의 unrelated 변경도 포함되지 않는다.
