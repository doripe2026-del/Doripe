# Doripe Instagram Content Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily Codex + Figma workflow that researches up to two Doripe Instagram carousel posts, fills locked templates, validates originality/copy/layout/source records, and saves review-ready image packages without publishing them.

**Architecture:** Keep creative research and Figma manipulation in the Codex automation, while a small deterministic Node.js engine owns contracts, candidate scoring, validation, performance learning, and package writing. Figma templates expose only named `slot:*` layers; the engine never needs a Figma access token. Generated post folders stay outside the git repository, and the recurring task is enabled only after a two-post dry run is approved.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, Zod 3, Figma Design + Codex Figma connector, Codex recurring automation, Markdown/JSON/CSV manifests

## Global Constraints

- Work only in the canonical repo `/Users/cityboy/.config/superpowers/worktrees/Doripe/codex-governance-ci` on a `codex/*` branch.
- Do not run production Vercel commands or alter Supabase schema.
- Generate at most two posts per day; generate one when only one candidate meets quality gates.
- Use only `PLACE/EVENT`, `COLLECTION`, and `ROUTE` information-carousel templates.
- Lock design layers after initial approval; later runs may change only `slot:*` photo and copy layers.
- Use real web photos only. Never use AI-generated imagery or existing AI files under `public/instagram-pinned-feed/assets/`.
- Prefer reuse-permitted photos. Record source URL, credit, and rights status for every photo.
- Treat source credit and Instagram originality as separate checks; neither proves copyright permission.
- Require at least two substantive Doripe editorial elements per post.
- Avoid mid-word line breaks. Shorten only the affected copy, then reduce only that text to no less than 90% of its template font size.
- Optimize for sends, saves, time spent, and non-follower reach; use one save-or-send CTA per post.
- Do not log in to or publish to Instagram.
- Default generated-output root: `/Users/cityboy/Desktop/Doripe/Instagram Content`.

---

## File Map

- Create `scripts/instagram-content/contracts.mjs` — Zod schemas and stable enums for all stages.
- Create `scripts/instagram-content/write-template-contract.mjs` — write the contract from identifiers returned by Figma.
- Create `scripts/instagram-content/scoring.mjs` — candidate scoring, duplicate suppression, and daily selection.
- Create `scripts/instagram-content/validators.mjs` — originality, caption, source, and Figma layout evidence gates.
- Create `scripts/instagram-content/performance.mjs` — CSV parsing and send/save performance feedback.
- Create `scripts/instagram-content/package-writer.mjs` — review-ready folder writer.
- Create `scripts/instagram-content/cli.mjs` — `score`, `validate`, and `finalize` commands.
- Create `docs/instagram-content/template-contract.json` — actual Figma file key, node IDs, sizes, and `slot:*` names.
- Create `docs/ops/instagram-content-daily-runbook.md` — exact daily agent workflow and external-tool boundaries.
- Create `tests/instagram-content/*.test.mjs` — deterministic unit and integration tests.
- Create `tests/instagram-content/fixtures/*.json` — one fixture per content type plus invalid cases.
- Modify `package.json` — add test/check/CLI scripts only; add no dependency.

---

### Task 1: Domain Contracts and Test Command

**Files:**
- Create: `scripts/instagram-content/contracts.mjs`
- Create: `tests/instagram-content/contracts.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: plain JSON from research, Figma metadata, and finalized package manifests.
- Produces: `parseTemplateContract(value)`, `parseCandidate(value)`, `parseDraft(value)`, `parsePackageManifest(value)`, `CONTENT_TYPES`, `RIGHTS_STATUSES`, and `EDITORIAL_ELEMENTS`.

- [ ] **Step 1: Add the failing contract tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCandidate,
  parsePackageManifest,
  parseTemplateContract,
} from "../../scripts/instagram-content/contracts.mjs";

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

test("candidate rejects AI assets and incomplete source records", () => {
  assert.throws(() => parseCandidate({ id: "bad", type: "place_event", assets: [{ kind: "ai" }] }));
});

test("package requires caption, sources, review, and exported PNG files", () => {
  assert.throws(() => parsePackageManifest({ version: 1, files: ["01-cover.png"] }));
});
```

- [ ] **Step 2: Run the contract test and verify the red state**

Run: `node --test tests/instagram-content/contracts.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/instagram-content/contracts.mjs`.

- [ ] **Step 3: Implement strict Zod contracts**

```js
import { z } from "zod";

export const CONTENT_TYPES = Object.freeze(["place_event", "collection", "route"]);
export const RIGHTS_STATUSES = Object.freeze(["confirmed", "not_found", "restricted"]);
export const EDITORIAL_ELEMENTS = Object.freeze([
  "selection_reason",
  "comparison",
  "recommended_context",
  "map_or_route",
  "practical_info",
  "ordered_story",
]);

const sourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  checkedAt: z.string().datetime(),
});

const assetSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("web_photo"),
  localPath: z.string().min(1),
  sourceUrl: z.string().url(),
  credit: z.string().min(1),
  rightsStatus: z.enum(RIGHTS_STATUSES),
  privacyNote: z.string().default(""),
});

const scoreSchema = z.object({
  sendPotential: z.number().min(0).max(5),
  saveValue: z.number().min(0).max(5),
  brandFit: z.number().min(0).max(5),
  timeliness: z.number().min(0).max(5),
  photoQuality: z.number().min(0).max(5),
  originalityPotential: z.number().min(0).max(5),
  factCompleteness: z.number().min(0).max(5),
  reusePermission: z.number().min(0).max(5),
});

const candidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  type: z.enum(CONTENT_TYPES),
  title: z.string().min(1).max(120),
  hook: z.string().min(1).max(120),
  region: z.string().min(1).max(80),
  placeIds: z.array(z.string().min(1)).min(1),
  expiresAt: z.string().datetime().nullable(),
  sources: z.array(sourceSchema).min(1),
  assets: z.array(assetSchema).min(1),
  editorialElements: z.array(z.enum(EDITORIAL_ELEMENTS)).min(2),
  scores: scoreSchema,
});

const templateSchema = z.object({
  id: z.enum(CONTENT_TYPES),
  minSlides: z.number().int().positive(),
  maxSlides: z.number().int().positive(),
  rootNodeId: z.string().regex(/^\d+:\d+$/),
  slots: z.array(z.string().regex(/^slot:/)).min(3),
});

const templateContractSchema = z.object({
  version: z.literal(1),
  fileKey: z.string().min(1),
  pageName: z.literal("Instagram Content Automation"),
  canvas: z.object({ width: z.literal(1080), height: z.literal(1350), safeInsetX: z.literal(34) }),
  templates: z.array(templateSchema).length(3),
});

const draftSchema = z.object({
  version: z.literal(1),
  candidate: candidateSchema,
  caption: z.string().min(1),
  cta: z.enum(["save", "send"]),
  keywordPhrases: z.array(z.string().min(1)).min(2).max(6),
  locationTag: z.string().min(1),
  factSourceIds: z.array(z.string().min(1)).min(1),
});

const packageManifestSchema = z.object({
  version: z.literal(1),
  candidateId: z.string().min(1),
  createdAt: z.string().datetime(),
  files: z.array(z.string().min(1)).refine((files) =>
    files.includes("caption.txt") && files.includes("sources.txt") && files.includes("review.txt") && files.some((file) => file.endsWith(".png")),
    "package files are incomplete",
  ),
});

export const parseTemplateContract = (value) => templateContractSchema.parse(value);
export const parseCandidate = (value) => candidateSchema.parse(value);
export const parseDraft = (value) => draftSchema.parse(value);
export const parsePackageManifest = (value) => packageManifestSchema.parse(value);
```

- [ ] **Step 4: Add package scripts and run the green state**

Add to `package.json`:

```json
"test:instagram-content": "node --test tests/instagram-content/*.test.mjs",
"check:instagram-content": "npm run test:instagram-content && node scripts/instagram-content/cli.mjs check-template docs/instagram-content/template-contract.json",
"instagram:content": "node scripts/instagram-content/cli.mjs"
```

Run: `npm run test:instagram-content`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add package.json scripts/instagram-content/contracts.mjs tests/instagram-content/contracts.test.mjs
git commit -m "feat: add instagram content contracts"
```

---

### Task 2: Figma Template Pack and Contract

**Files:**
- Create: Figma file `Doripe — Instagram Content Templates`
- Create: `scripts/instagram-content/write-template-contract.mjs`
- Create: `docs/instagram-content/template-contract.json`
- Test: `tests/instagram-content/template-contract.test.mjs`

**Interfaces:**
- Consumes: slot names and size rules from Task 1.
- Produces: a user-approved Figma `fileKey`, three actual `rootNodeId` values, named `slot:*` layers, and a valid template contract JSON.

- [ ] **Step 1: Write the failing template-contract file test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseTemplateContract } from "../../scripts/instagram-content/contracts.mjs";

test("tracked Figma template contract is complete", async () => {
  const raw = JSON.parse(await readFile("docs/instagram-content/template-contract.json", "utf8"));
  const contract = parseTemplateContract(raw);
  assert.deepEqual(contract.templates.map(({ id }) => id).sort(), ["collection", "place_event", "route"]);
  for (const template of contract.templates) assert.equal(new Set(template.slots).size, template.slots.length);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/instagram-content/template-contract.test.mjs`

Expected: FAIL with `ENOENT: docs/instagram-content/template-contract.json`.

- [ ] **Step 3: Create the Figma file and visual system**

Use the Figma skills in this order during execution: `figma:figma-create-new-file`, then `figma:figma-use`.

Create page `Instagram Content Automation` with:

- 1080 × 1350 frames and a central profile-grid safe region from x=34 to x=1046.
- Doripe green `#10C76F`, route green `#0AC75C`, cream `#FAF8F1`, ink `#0E131E`, soft green `#E0EAD7`.
- Noto Sans KR if Pretendard remains unavailable.
- Full-bleed real-photo areas, high-contrast headline blocks, small Doripe icon, and restrained route/map graphics.
- `PLACE/EVENT`: 7 source frames; first 5 required.
- `COLLECTION`: 10 source frames; first 6 required.
- `ROUTE`: 8 source frames; first 6 required.
- All design-only layers locked.
- Editable layers named exactly with `slot:*` prefixes from the contract.

- [ ] **Step 4: Run a visual review checkpoint**

Show the three cover frames and one representative inner frame per type to the user. Do not lock the template contract until the user approves the visuals. After approval, record the exact Figma file key and returned root node IDs.

- [ ] **Step 5: Add the contract writer**

Create `scripts/instagram-content/write-template-contract.mjs`:

```js
#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseTemplateContract } from "./contracts.mjs";

const entries = process.argv.slice(2).map((value) => value.split("=", 2));
const input = Object.fromEntries(entries);
const required = ["fileKey", "placeEventNodeId", "collectionNodeId", "routeNodeId", "output"];
for (const key of required) if (!input[key]) throw new Error(`Missing ${key}= value`);

const contract = parseTemplateContract({
  version: 1,
  fileKey: input.fileKey,
  pageName: "Instagram Content Automation",
  canvas: { width: 1080, height: 1350, safeInsetX: 34 },
  templates: [
    { id: "place_event", minSlides: 5, maxSlides: 7, rootNodeId: input.placeEventNodeId, slots: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:info:location", "slot:info:date", "slot:cta", "slot:credit"] },
    { id: "collection", minSlides: 6, maxSlides: 10, rootNodeId: input.collectionNodeId, slots: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:cta", "slot:credit"] },
    { id: "route", minSlides: 6, maxSlides: 8, rootNodeId: input.routeNodeId, slots: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:info:location", "slot:cta", "slot:credit"] },
  ],
});

await mkdir(dirname(input.output), { recursive: true });
await writeFile(input.output, `${JSON.stringify(contract, null, 2)}\n`);
```

- [ ] **Step 6: Write the contract with the returned identifiers and verify it**

After the Figma tools return identifiers, pass those exact values to the writer as `key=value` arguments:

```bash
node scripts/instagram-content/write-template-contract.mjs fileKey="$FIGMA_FILE_KEY" placeEventNodeId="$PLACE_EVENT_NODE_ID" collectionNodeId="$COLLECTION_NODE_ID" routeNodeId="$ROUTE_NODE_ID" output=docs/instagram-content/template-contract.json
```

Set the four shell variables directly from the Figma response before running this command. The parser rejects missing or malformed node IDs.

Run: `node --test tests/instagram-content/template-contract.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add scripts/instagram-content/write-template-contract.mjs docs/instagram-content/template-contract.json tests/instagram-content/template-contract.test.mjs
git commit -m "feat: register instagram Figma templates"
```

---

### Task 3: Candidate Scoring, Performance Boosts, and Duplicate Suppression

**Files:**
- Create: `scripts/instagram-content/scoring.mjs`
- Create: `tests/instagram-content/scoring.test.mjs`
- Create: `tests/instagram-content/fixtures/candidates.json`

**Interfaces:**
- Consumes: parsed candidates, 30-day production history, and optional performance boosts.
- Produces: `scoreCandidate(candidate, boosts)`, `isDuplicateCandidate(candidate, history)`, and `selectDailyCandidates(candidates, history, boosts, limit)`.

- [ ] **Step 1: Write failing scoring tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { isDuplicateCandidate, scoreCandidate, selectDailyCandidates } from "../../scripts/instagram-content/scoring.mjs";

const base = {
  id: "seongsu-weekend-route",
  type: "route",
  title: "성수 주말 코스",
  placeIds: ["place-a", "place-b"],
  scores: { sendPotential: 5, saveValue: 5, brandFit: 5, timeliness: 4, photoQuality: 4, originalityPotential: 5, factCompleteness: 5, reusePermission: 2 },
};

test("weighted score prioritizes sends and saves", () => {
  assert.equal(scoreCandidate(base, {}), 92);
});

test("same place within 30 days is duplicate", () => {
  assert.equal(isDuplicateCandidate(base, [{ createdAt: "2026-07-01T00:00:00.000Z", placeIds: ["place-b"] }], new Date("2026-07-14T00:00:00.000Z")), true);
});

test("daily selection returns at most two non-duplicates", () => {
  const selected = selectDailyCandidates([base, { ...base, id: "new-event", type: "place_event", placeIds: ["place-c"], scores: { ...base.scores, sendPotential: 4 } }], [], {}, 2);
  assert.deepEqual(selected.map(({ id }) => id), ["seongsu-weekend-route", "new-event"]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/instagram-content/scoring.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement scoring and duplicate rules**

```js
const WEIGHTS = Object.freeze({
  sendPotential: 20,
  saveValue: 15,
  brandFit: 15,
  timeliness: 15,
  photoQuality: 10,
  originalityPotential: 10,
  factCompleteness: 10,
  reusePermission: 5,
});

export function scoreCandidate(candidate, boosts = {}) {
  const base = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + (candidate.scores[key] / 5) * weight, 0);
  return Math.max(0, Math.min(100, Math.round(base + (boosts[candidate.type] ?? 0))));
}

export function isDuplicateCandidate(candidate, history, now = new Date()) {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return history.some((item) =>
    Date.parse(item.createdAt) >= cutoff && item.placeIds.some((id) => candidate.placeIds.includes(id)),
  );
}

export function selectDailyCandidates(candidates, history, boosts = {}, limit = 2) {
  return candidates
    .filter((candidate) => !isDuplicateCandidate(candidate, history))
    .map((candidate) => ({ ...candidate, totalScore: scoreCandidate(candidate, boosts) }))
    .filter(({ totalScore }) => totalScore >= 70)
    .sort((a, b) => b.totalScore - a.totalScore || a.id.localeCompare(b.id))
    .slice(0, Math.min(2, limit));
}
```

- [ ] **Step 4: Run scoring tests**

Run: `node --test tests/instagram-content/scoring.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add scripts/instagram-content/scoring.mjs tests/instagram-content/scoring.test.mjs tests/instagram-content/fixtures/candidates.json
git commit -m "feat: rank instagram content candidates"
```

---

### Task 4: Originality, Caption, Source, and Layout Gates

**Files:**
- Create: `scripts/instagram-content/validators.mjs`
- Create: `tests/instagram-content/validators.test.mjs`
- Create: `tests/instagram-content/fixtures/valid-draft.json`
- Create: `tests/instagram-content/fixtures/invalid-repost-draft.json`

**Interfaces:**
- Consumes: parsed draft, expected template, and Figma-produced layout evidence.
- Produces: `validateOriginality(draft)`, `validateCaption(draft)`, `validateSources(draft)`, `validateLayoutEvidence(evidence)`, and `validateDraftBundle(input)`.

- [ ] **Step 1: Write the failing validator tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  validateLayoutEvidence,
  validateOriginality,
  validateSources,
} from "../../scripts/instagram-content/validators.mjs";

test("simple credit overlay is not meaningful originality", () => {
  assert.throws(() => validateOriginality({ editorialElements: ["selection_reason"] }), /two substantive/i);
});

test("restricted sources are blocked and unknown rights become warnings", () => {
  assert.throws(() => validateSources({ assets: [{ rightsStatus: "restricted", sourceUrl: "https://example.com/a", credit: "A" }] }), /restricted/i);
  assert.deepEqual(validateSources({ assets: [{ rightsStatus: "not_found", sourceUrl: "https://example.com/a", credit: "A" }] }).warnings.length, 1);
});

test("layout blocks overflow, mid-word breaks, and more than ten percent shrink", () => {
  assert.throws(() => validateLayoutEvidence({ slots: [{ name: "slot:title", overflows: false, midWordBreak: false, baseFontSize: 64, fontSize: 57 }] }), /90%/i);
});
```

- [ ] **Step 2: Run validators tests to verify failure**

Run: `node --test tests/instagram-content/validators.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic gates**

```js
import { EDITORIAL_ELEMENTS } from "./contracts.mjs";

export function validateOriginality(draft) {
  const unique = new Set(draft.editorialElements.filter((item) => EDITORIAL_ELEMENTS.includes(item)));
  if (unique.size < 2) throw new Error("At least two substantive Doripe editorial elements are required");
  return { ok: true, elements: [...unique] };
}

export function validateSources(draft) {
  const warnings = [];
  for (const asset of draft.assets) {
    if (asset.rightsStatus === "restricted") throw new Error(`Restricted asset: ${asset.sourceUrl}`);
    if (!asset.sourceUrl || !asset.credit) throw new Error("Every asset needs sourceUrl and credit");
    if (asset.rightsStatus === "not_found") warnings.push(`Rights not confirmed: ${asset.sourceUrl}`);
  }
  return { ok: true, warnings };
}

export function validateCaption(draft) {
  if (!draft.locationTag) throw new Error("Location tag is required");
  if (draft.keywordPhrases.length < 2) throw new Error("At least two keyword phrases are required");
  if (!draft.factSourceIds.length) throw new Error("Fact source references are required");
  return { ok: true };
}

export function validateLayoutEvidence(evidence) {
  for (const slot of evidence.slots) {
    if (slot.overflows) throw new Error(`Text overflow: ${slot.name}`);
    if (slot.midWordBreak) throw new Error(`Mid-word break: ${slot.name}`);
    if (slot.fontSize < slot.baseFontSize * 0.9) throw new Error(`Text may not shrink below 90%: ${slot.name}`);
  }
  return { ok: true };
}

export function validateDraftBundle({ draft, layoutEvidence }) {
  return {
    originality: validateOriginality(draft.candidate),
    caption: validateCaption(draft),
    sources: validateSources(draft.candidate),
    layout: validateLayoutEvidence(layoutEvidence),
  };
}
```

- [ ] **Step 4: Run validator tests**

Run: `node --test tests/instagram-content/validators.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add scripts/instagram-content/validators.mjs tests/instagram-content/validators.test.mjs tests/instagram-content/fixtures/valid-draft.json tests/instagram-content/fixtures/invalid-repost-draft.json
git commit -m "feat: validate instagram content quality"
```

---

### Task 5: Performance Feedback Loop

**Files:**
- Create: `scripts/instagram-content/performance.mjs`
- Create: `tests/instagram-content/performance.test.mjs`

**Interfaces:**
- Consumes: `performance.csv` with fixed headers.
- Produces: `PERFORMANCE_HEADER`, `parsePerformanceCsv(text)`, `appendPerformanceRow(text, row)`, and `buildPerformanceBoosts(rows)`.

- [ ] **Step 1: Write failing performance tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { appendPerformanceRow, buildPerformanceBoosts, parsePerformanceCsv } from "../../scripts/instagram-content/performance.mjs";

test("performance feedback prioritizes high send and save ratios", () => {
  const csv = appendPerformanceRow("", { postId: "p1", postedAt: "2026-07-14", type: "route", topic: "seongsu", reach: 1000, views: 1300, nonFollowerReachRate: 0.7, sends: 80, saves: 120, likes: 50, profileVisits: 20, follows: 8 });
  const rows = parsePerformanceCsv(csv);
  assert.deepEqual(buildPerformanceBoosts(rows), { route: 5 });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test tests/instagram-content/performance.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement fixed CSV handling and boosts**

Use this fixed header and JSON-safe quoting; do not implement a general CSV dialect.

```js
export const PERFORMANCE_HEADER = "post_id,posted_at,type,topic,reach,views,non_follower_reach_rate,sends,saves,likes,profile_visits,follows";

const columns = PERFORMANCE_HEADER.split(",");
const keys = ["postId", "postedAt", "type", "topic", "reach", "views", "nonFollowerReachRate", "sends", "saves", "likes", "profileVisits", "follows"];

export function appendPerformanceRow(text, row) {
  const values = keys.map((key) => JSON.stringify(String(row[key] ?? "")));
  return `${text.trim() || PERFORMANCE_HEADER}\n${values.join(",")}\n`;
}

export function parsePerformanceCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines[0]) return [];
  if (lines[0] !== PERFORMANCE_HEADER) throw new Error("Unexpected performance.csv header");
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.match(/"(?:[^"]|"")*"/g)?.map((value) => JSON.parse(value)) ?? [];
    return Object.fromEntries(keys.map((key, index) => [key, index < 4 ? values[index] : Number(values[index])]));
  });
}

export function buildPerformanceBoosts(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const ratio = row.reach > 0 ? (row.sends + row.saves) / row.reach : 0;
    const list = grouped.get(row.type) ?? [];
    list.push(ratio);
    grouped.set(row.type, list);
  }
  const boosts = {};
  for (const [type, ratios] of grouped) {
    const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    boosts[type] = average >= 0.15 ? 5 : average >= 0.08 ? 2 : 0;
  }
  return boosts;
}
```

- [ ] **Step 4: Run performance tests**

Run: `node --test tests/instagram-content/performance.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add scripts/instagram-content/performance.mjs tests/instagram-content/performance.test.mjs
git commit -m "feat: learn from instagram performance"
```

---

### Task 6: Review-Ready Package Writer

**Files:**
- Create: `scripts/instagram-content/package-writer.mjs`
- Create: `tests/instagram-content/package-writer.test.mjs`

**Interfaces:**
- Consumes: validated draft, exported PNG paths, validation results, and an explicit output root.
- Produces: `writeProductionPackage({ outputRoot, sequence, draft, exportedPngs, validation })` returning `{ directory, manifest }`.

- [ ] **Step 1: Write the failing package test**

```js
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeProductionPackage } from "../../scripts/instagram-content/package-writer.mjs";

test("writer creates image, caption, source, review, and manifest files", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "doripe-instagram-"));
  const png = join(outputRoot, "source.png");
  await import("node:fs/promises").then(({ writeFile }) => writeFile(png, Buffer.from([0x89, 0x50, 0x4e, 0x47])));
  const result = await writeProductionPackage({
    outputRoot,
    sequence: 1,
    draft: { candidate: { id: "seongsu-route", sources: [], assets: [] }, caption: "성수 코스", locationTag: "성수동" },
    exportedPngs: [png],
    validation: { sources: { warnings: ["Rights not confirmed"] } },
    now: new Date("2026-07-14T00:00:00.000Z"),
  });
  assert.match(await readFile(join(result.directory, "caption.txt"), "utf8"), /성수 코스/);
  assert.deepEqual(result.manifest.files.sort(), ["01-cover.png", "caption.txt", "manifest.json", "review.txt", "sources.txt"].sort());
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test tests/instagram-content/package-writer.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement atomic package creation**

```js
import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export async function writeProductionPackage({ outputRoot, sequence, draft, exportedPngs, validation, now = new Date() }) {
  const date = now.toISOString().slice(0, 10);
  const folderName = `${String(sequence).padStart(2, "0")}-${draft.candidate.id}`;
  const dayDir = join(outputRoot, date);
  const temporary = join(dayDir, `.${folderName}.writing`);
  const directory = join(dayDir, folderName);
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  const files = [];
  for (const [index, source] of exportedPngs.entries()) {
    const target = `${String(index + 1).padStart(2, "0")}-${index === 0 ? "cover" : "content"}.png`;
    await copyFile(source, join(temporary, target));
    files.push(target);
  }
  await writeFile(join(temporary, "caption.txt"), `${draft.caption.trim()}\n`);
  await writeFile(join(temporary, "sources.txt"), `${draft.candidate.sources.map((item) => `${item.publisher}\t${item.url}`).join("\n")}\n`);
  await writeFile(join(temporary, "review.txt"), `Location tag: ${draft.locationTag}\n${validation.sources.warnings.join("\n")}\n`);
  files.push("caption.txt", "sources.txt", "review.txt", "manifest.json");
  const manifest = { version: 1, candidateId: draft.candidate.id, createdAt: now.toISOString(), files };
  await writeFile(join(temporary, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(directory, { recursive: true, force: true });
  await rename(temporary, directory);
  return { directory, manifest };
}
```

- [ ] **Step 4: Run package tests**

Run: `node --test tests/instagram-content/package-writer.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add scripts/instagram-content/package-writer.mjs tests/instagram-content/package-writer.test.mjs
git commit -m "feat: package instagram content drafts"
```

---

### Task 7: CLI Orchestrator

**Files:**
- Create: `scripts/instagram-content/cli.mjs`
- Create: `tests/instagram-content/cli.test.mjs`

**Interfaces:**
- Consumes: JSON paths supplied by the daily runbook.
- Produces commands:
  - `check-template <template-contract.json>`
  - `score <candidates.json> <history.json> <performance.csv> <selected.json>`
  - `validate <draft.json> <layout-evidence.json> <validation.json>`
  - `finalize <draft.json> <layout-evidence.json> <exports.json> <output-root>`

- [ ] **Step 1: Write failing CLI tests using a temporary directory**

```js
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("CLI prints usage and exits non-zero without a command", () => {
  const result = spawnSync(process.execPath, ["scripts/instagram-content/cli.mjs"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /check-template|score|validate|finalize/);
});
```

- [ ] **Step 2: Run CLI test to verify failure**

Run: `node --test tests/instagram-content/cli.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement command dispatch with explicit JSON reads/writes**

```js
#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { parseTemplateContract, parseCandidate, parseDraft } from "./contracts.mjs";
import { buildPerformanceBoosts, parsePerformanceCsv } from "./performance.mjs";
import { selectDailyCandidates } from "./scoring.mjs";
import { validateDraftBundle } from "./validators.mjs";
import { writeProductionPackage } from "./package-writer.mjs";

const [command, ...args] = process.argv.slice(2);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

if (command === "check-template") {
  parseTemplateContract(await readJson(args[0]));
  console.log("Instagram template contract passed.");
} else if (command === "score") {
  const candidates = (await readJson(args[0])).map(parseCandidate);
  const history = await readJson(args[1]);
  const boosts = buildPerformanceBoosts(parsePerformanceCsv(await readFile(args[2], "utf8").catch(() => "")));
  await writeJson(args[3], selectDailyCandidates(candidates, history, boosts, 2));
} else if (command === "validate") {
  const draft = parseDraft(await readJson(args[0]));
  await writeJson(args[2], validateDraftBundle({ draft, layoutEvidence: await readJson(args[1]) }));
} else if (command === "finalize") {
  const draft = parseDraft(await readJson(args[0]));
  const validation = validateDraftBundle({ draft, layoutEvidence: await readJson(args[1]) });
  const exports = await readJson(args[2]);
  const result = await writeProductionPackage({ outputRoot: args[3], sequence: exports.sequence, draft, exportedPngs: exports.files, validation });
  console.log(result.directory);
} else {
  console.error("Usage: cli.mjs <check-template|score|validate|finalize> ...");
  process.exitCode = 1;
}
```

- [ ] **Step 4: Run CLI and full unit tests**

Run: `npm run test:instagram-content`

Expected: all Instagram-content tests PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add scripts/instagram-content/cli.mjs tests/instagram-content/cli.test.mjs
git commit -m "feat: orchestrate instagram content workflow"
```

---

### Task 8: Daily Agent Runbook

**Files:**
- Create: `docs/ops/instagram-content-daily-runbook.md`
- Test: `tests/instagram-content/runbook.test.mjs`

**Interfaces:**
- Consumes: Brain marketing rules, template contract, CLI, Figma connector, web research, and the output root.
- Produces: one reproducible daily instruction set that the recurring Codex task executes at 08:00 Asia/Seoul.

- [ ] **Step 1: Write the failing runbook contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("daily runbook contains every required safety and output gate", async () => {
  const text = await readFile("docs/ops/instagram-content-daily-runbook.md", "utf8");
  for (const phrase of [
    "매일 최대 2개",
    "AI 이미지 금지",
    "비팔로워 도달",
    "원본성 검수",
    "단어 중간 줄바꿈",
    "Instagram 자동 게시 금지",
    "/Users/cityboy/Desktop/Doripe/Instagram Content",
  ]) assert.ok(text.includes(phrase), `missing runbook phrase: ${phrase}`);
});
```

- [ ] **Step 2: Run the runbook test and verify failure**

Run: `node --test tests/instagram-content/runbook.test.mjs`

Expected: FAIL with `ENOENT`.

- [ ] **Step 3: Write the exact daily sequence**

The runbook must instruct the automation to:

1. Read the Doripe Brain home, brand message, marketing content operation, and content-rights documents.
2. Read `docs/instagram-content/template-contract.json`, 30-day history, and `performance.csv`.
3. Research current places/routes/events with official sources first and record the verification time.
4. Generate at least six candidates, score them with the fixed eight dimensions, and use the CLI to select at most two.
5. Collect only real web photos; never call image generation. Reject `restricted` assets and flag `not_found` rights.
6. Write a specific hook, one send-or-save CTA, natural location keywords, fact source IDs, and at least two editorial elements.
7. Duplicate the correct Figma template, replace only `slot:*` layers, and hide unused optional slides.
8. Inspect screenshots and correct line breaks by shortening copy first, then shrinking only the affected text to 90% minimum.
9. Write layout evidence JSON for every text slot and run `instagram:content validate`.
10. Export 1080 × 1350 PNGs, run `instagram:content finalize`, and save to `/Users/cityboy/Desktop/Doripe/Instagram Content`.
11. Report the two package paths, or the reason only one/zero passed. Never log in to or publish on Instagram.

- [ ] **Step 4: Run the runbook and full check**

Run: `npm run check:instagram-content`

Expected: template contract passes and all tests PASS.

- [ ] **Step 5: Commit Task 8**

```bash
git add docs/ops/instagram-content-daily-runbook.md tests/instagram-content/runbook.test.mjs
git commit -m "docs: define daily instagram content runbook"
```

---

### Task 9: Two-Post End-to-End Dry Run

**Files:**
- Verify: Figma file `Doripe — Instagram Content Templates`
- Generate outside repo under the current date inside `/Users/cityboy/Desktop/Doripe/Instagram Content/`.
- Do not commit generated images or downloaded source photos.

**Interfaces:**
- Consumes: all modules, approved Figma templates, current public-web research, and daily runbook.
- Produces: two review-ready real-content folders and visual evidence that every gate works.

- [ ] **Step 1: Run all deterministic checks before external work**

Run:

```bash
npm run test:instagram-content
npm run typecheck
npm run guard:repo
```

Expected: every command exits 0.

- [ ] **Step 2: Execute one dry daily run without scheduling**

Follow the runbook once. Require two different content types among the selected posts. If only one candidate scores at least 70, produce one and record the shortage rather than lowering the threshold.

- [ ] **Step 3: Verify each Figma result visually**

For every exported frame confirm:

- 1080 × 1350 size.
- Critical copy stays inside the 34px horizontal safe inset.
- No missing photos, overflow, mid-word break, or more-than-10% text reduction.
- At least two substantive Doripe editorial elements.
- One CTA, one location tag suggestion, source records, and rights warnings.
- No AI-generated asset.

- [ ] **Step 4: Verify package contents from disk**

Run:

```bash
RUN_DATE="$(date +%F)"
find "/Users/cityboy/Desktop/Doripe/Instagram Content/$RUN_DATE" -maxdepth 2 -type f -print | sort
```

Expected per package: sequential PNGs, `caption.txt`, `sources.txt`, `review.txt`, and `manifest.json`.

- [ ] **Step 5: Present the dry-run folders and Figma frames for user approval**

Do not create the recurring automation until the user approves both the visual result and the caption/source/review files.

---

### Task 10: Enable the Daily Codex Automation

**Files:**
- Read: `docs/ops/instagram-content-daily-runbook.md`
- External state: Codex recurring automation

**Interfaces:**
- Consumes: user-approved dry run and the final runbook.
- Produces: one daily 08:00 Asia/Seoul automation that generates at most two draft packages and reports their paths.

- [ ] **Step 1: Confirm the dry-run approval is recorded**

Evidence must include the approved Figma file URL and both package paths. If only one package passed quality gates, require approval of that one plus the recorded reason the second was skipped.

- [ ] **Step 2: Create the recurring automation**

Use the product's automation tool with:

- Title: `Doripe 인스타 피드 2개 만들기`
- Schedule: every day at `08:00` in `Asia/Seoul`
- Prompt: execute `docs/ops/instagram-content-daily-runbook.md` from the canonical worktree; never publish to Instagram; report output folders and quality-gate failures.
- Workspace: `/Users/cityboy/.config/superpowers/worktrees/Doripe/codex-governance-ci`

- [ ] **Step 3: Trigger one monitored run**

Verify that the automation reads the canonical worktree, does not modify locked Figma layers, writes outside the repo, and reports completion or shortage clearly.

- [ ] **Step 4: Run final repository checks**

Run:

```bash
npm run test:instagram-content
npm run typecheck
npm run guard:repo
git status --short
```

Expected: tests/typecheck/guard exit 0; generated images are absent from git status; only intentional source changes remain.

- [ ] **Step 5: Commit any final tracked runbook corrections**

```bash
git add docs/ops/instagram-content-daily-runbook.md scripts/instagram-content tests/instagram-content package.json docs/instagram-content/template-contract.json
git commit -m "feat: automate daily instagram content drafts"
```
