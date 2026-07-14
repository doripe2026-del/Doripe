# Instagram Carousel Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 장소 게시물은 표지 이후 사진과 로고만 보여주고, 모든 직접 CTA를 없애며, 모든 캐러셀 끝에 콘텐츠별 질문이 있는 검은 Doripe 브랜드 장을 추가한다.

**Architecture:** Figma의 세 승인 템플릿에 공통 브랜드 마지막 장을 추가하고 `place_event`의 중간 장을 사진 전용으로 단순화한다. 코드에서는 draft의 `cta`를 `brandQuestion`으로 교체하고, layout evidence에 슬라이드 역할을 기록해 사진 전용 장과 브랜드 마지막 장을 자동 검수한다. 일일 가이드는 국내 실제 웹 사진, 출처 package 기록, 비게시 원칙을 유지하면서 새 구조를 생성하도록 갱신한다.

**Tech Stack:** Figma Plugin API, Node.js ESM, Zod, Node test runner, JSON contracts

## Global Constraints

- Instagram 캔버스는 정확히 1080×1350이고 좌우 안전영역은 34px이다.
- 실제 국내 웹 사진만 사용하며 AI 이미지는 사용하지 않는다.
- 한 장소·행사 콘텐츠는 첫 장과 마지막 장 사이에 사진과 Doripe 심볼만 둔다.
- `보내주세요`, `저장하세요`, `공유해 주세요` 같은 직접 CTA를 이미지와 캡션 모두에서 제거한다.
- 마지막 장은 `#050505` 배경, 실제 Doripe 앱을 표현한 휴대폰 목업, 질문형 문구, 녹색 Doripe 심볼과 `Doripe.` 워드마크를 포함한다.
- 마지막 장 질문은 60자 이내이고 `?`로 끝나며 단어 중간 줄바꿈이 없어야 한다.
- Instagram 로그인, 자동 게시, production 배포는 하지 않는다.
- Brain 문서는 수정하지 않는다.

---

## File Map

- `scripts/instagram-content/contracts.mjs`: CTA 없는 draft와 새 템플릿 계약을 파싱한다.
- `scripts/instagram-content/validators.mjs`: 직접 CTA, 사진 전용 중간 장, 공통 브랜드 마지막 장을 검수한다.
- `scripts/instagram-content/write-template-contract.mjs`: Figma 승인 root와 새 slot 구성을 JSON 계약으로 생성한다.
- `docs/instagram-content/template-contract.json`: 자동화가 사용하는 canonical Figma 계약이다.
- `docs/ops/instagram-content-daily-runbook.md`: 조사부터 Figma export까지 새 제작 규칙을 설명한다.
- `tests/instagram-content/contracts.test.mjs`: draft와 템플릿 schema 회귀 테스트다.
- `tests/instagram-content/validators.test.mjs`: CTA·슬라이드 역할·마지막 장 검수 테스트다.
- `tests/instagram-content/template-contract.test.mjs`: 추적 중인 slot과 slide 범위를 고정한다.
- `tests/instagram-content/runbook.test.mjs`: 일일 가이드가 새 규칙을 포함하는지 확인한다.
- `tests/instagram-content/fixtures/valid-draft.json`: `brandQuestion`을 포함한 정상 fixture다.
- `tests/instagram-content/fixtures/invalid-repost-draft.json`: CTA 없는 비정상 재게시 fixture다.
- Figma file `9btf9oUzIvw3JQq4OPyYEn`: 세 승인 템플릿과 2026-07-14 드라이런을 수정한다.

---

### Task 1: CTA 없는 Draft와 Template 계약

**Files:**
- Modify: `scripts/instagram-content/contracts.mjs`
- Modify: `scripts/instagram-content/write-template-contract.mjs`
- Modify: `docs/instagram-content/template-contract.json`
- Modify: `tests/instagram-content/contracts.test.mjs`
- Modify: `tests/instagram-content/template-contract.test.mjs`
- Modify: `tests/instagram-content/fixtures/valid-draft.json`
- Modify: `tests/instagram-content/fixtures/invalid-repost-draft.json`

**Interfaces:**
- Consumes: 기존 `candidateSchema`, 세 Figma root `28:14`, `28:15`, `28:16`.
- Produces: `parseDraft()`가 `brandQuestion: string`을 반환하고 `cta` 입력을 허용하지 않는 strict draft schema.

- [ ] **Step 1: 계약 실패 테스트 작성**

`tests/instagram-content/contracts.test.mjs`에 정상 질문과 CTA 거부를 추가한다.

```js
import { readFile } from "node:fs/promises";

test("draft requires a question-shaped brand line and rejects legacy CTA", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("./fixtures/valid-draft.json", import.meta.url),
    "utf8",
  ));
  assert.equal(parseDraft(fixture).brandQuestion.endsWith("?"), true);
  assert.throws(() => parseDraft({ ...fixture, brandQuestion: "장소를 더 발견해요" }), /brand question/i);
  assert.throws(() => parseDraft({ ...fixture, cta: "save" }), /unrecognized|cta/i);
});
```

`tests/instagram-content/template-contract.test.mjs`의 기대 slot을 다음 값으로 바꾼다.

```js
const expectedSlots = {
  place_event: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:credit", "slot:brand-question"],
  collection: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:credit", "slot:brand-question"],
  route: ["slot:title", "slot:subtitle", "slot:photo:01", "slot:place:01", "slot:body:01", "slot:info:location", "slot:credit", "slot:brand-question"],
};
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/instagram-content/contracts.test.mjs tests/instagram-content/template-contract.test.mjs`

Expected: legacy `cta`가 아직 허용되고 `slot:brand-question`이 없어 FAIL.

- [ ] **Step 3: 최소 계약 구현**

`scripts/instagram-content/contracts.mjs`의 draft schema를 strict schema로 바꾼다.

```js
const draftSchema = z.object({
  version: z.literal(1),
  candidate: candidateSchema,
  caption: z.string().min(1),
  brandQuestion: z.string().trim().min(1).max(60).refine(
    (value) => value.endsWith("?"),
    "Brand question must end with ?",
  ),
  keywordPhrases: z.array(z.string().min(1)).min(2).max(6),
  locationTag: z.string().min(1),
  factSourceIds: z.array(z.string().min(1)).min(1),
}).strict();
```

`write-template-contract.mjs`와 tracked JSON에서 `slot:cta`를 삭제하고 `slot:brand-question`을 추가한다. 새 마지막 장 한 장을 포함하도록 범위는 다음처럼 고정한다.

```js
const slideRanges = {
  place_event: { minSlides: 6, maxSlides: 8 },
  collection: { minSlides: 7, maxSlides: 11 },
  route: { minSlides: 7, maxSlides: 9 },
};
```

두 fixture에서는 `cta`를 제거하고 아래 질문을 넣는다.

```json
"brandQuestion": "내 취향으로 새로운 하루를 만들고 싶다면?"
```

- [ ] **Step 4: 계약 테스트 통과 확인**

Run: `node --test tests/instagram-content/contracts.test.mjs tests/instagram-content/template-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add scripts/instagram-content/contracts.mjs scripts/instagram-content/write-template-contract.mjs docs/instagram-content/template-contract.json tests/instagram-content/contracts.test.mjs tests/instagram-content/template-contract.test.mjs tests/instagram-content/fixtures/valid-draft.json tests/instagram-content/fixtures/invalid-repost-draft.json
git commit -m "feat: replace instagram CTA with brand question"
```

---

### Task 2: 슬라이드 역할과 브랜드 마지막 장 자동 검수

**Files:**
- Modify: `scripts/instagram-content/validators.mjs`
- Modify: `scripts/instagram-content/package-writer.mjs`
- Modify: `tests/instagram-content/validators.test.mjs`
- Modify: `tests/instagram-content/cli.test.mjs`
- Modify: `tests/instagram-content/package-writer.test.mjs`

**Interfaces:**
- Consumes: `draft.candidate.type`, `draft.brandQuestion`, `layoutEvidence.slideCount`.
- Produces: `validateSlideEvidence(draft, layoutEvidence) -> { ok: true }`와 `validation.presentation` gate.

- [ ] **Step 1: 실패 테스트 작성**

정상 evidence의 `slides`는 아래 구조를 사용한다.

```js
const validSlides = [
  { role: "cover", textSlots: ["slot:title", "slot:subtitle", "slot:credit"], visibleText: ["서촌의 낯선 기록 실험"], hasDoripeLogo: true },
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
    hasBrandWordmark: true,
    hasPhoneMockup: true,
    backgroundHex: "#050505",
  },
];
```

다음 실패 케이스를 각각 테스트한다.

```js
assert.throws(() => validateSlideEvidence(placeEventDraft, {
  ...placeEventLayout,
  slides: validSlides.map((slide, index) => index === 1
    ? { ...slide, textSlots: ["slot:body:01"] }
    : slide),
}), /photo.*text/i);

assert.throws(() => validateSlideEvidence(placeEventDraft, {
  ...placeEventLayout,
  slides: validSlides.map((slide, index) => index === 5
    ? { ...slide, hasPhoneMockup: false }
    : slide),
}), /phone mockup/i);
```

캡션 검수에는 직접 CTA 실패를 추가한다.

```js
for (const caption of ["친구에게 보내주세요.", "나중을 위해 저장하세요.", "같이 공유해 주세요."]) {
  assert.throws(() => validateCaption({ ...validDraft, caption }), /direct CTA/i);
}
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/instagram-content/validators.test.mjs tests/instagram-content/cli.test.mjs tests/instagram-content/package-writer.test.mjs`

Expected: `validateSlideEvidence`가 없어 FAIL.

- [ ] **Step 3: 최소 검수 구현**

`scripts/instagram-content/validators.mjs`에 다음 상수와 함수를 추가한다.

```js
const DIRECT_CTA_PATTERN = /(보내\s*주세요|저장\s*하세요|공유해\s*주세요|팔로우\s*하세요)/i;

export function validateSlideEvidence(draft, evidence) {
  const slides = requireArray(evidence?.slides, "Slide evidence");
  if (slides.length !== evidence.slideCount) {
    throw new Error("Slide evidence count must match slideCount");
  }
  if (slides[0]?.role !== "cover") throw new Error("First slide must be cover");

  const last = slides.at(-1);
  if (last?.role !== "brand_end") throw new Error("Last slide must be brand_end");
  if (last.backgroundHex?.toUpperCase() !== "#050505") throw new Error("Brand end background must be #050505");
  if (last.hasPhoneMockup !== true) throw new Error("Brand end requires a phone mockup");
  if (last.hasDoripeLogo !== true) throw new Error("Brand end requires a Doripe logo");
  if (last.hasBrandWordmark !== true) throw new Error("Brand end requires the Doripe wordmark");
  if (!last.textSlots?.includes("slot:brand-question")) throw new Error("Brand end requires slot:brand-question");
  if (last.brandQuestion !== draft.brandQuestion) throw new Error("Brand question must match the draft");

  for (const slide of slides) {
    const visibleText = requireArray(slide.visibleText, "Visible slide text");
    if (visibleText.some((value) => DIRECT_CTA_PATTERN.test(value))) {
      throw new Error("Direct CTA is not allowed on slides");
    }
  }

  if (draft.candidate?.type === "place_event") {
    for (const slide of slides.slice(1, -1)) {
      if (slide.role !== "photo") throw new Error("Place/event middle slides must be photo slides");
      if (!Array.isArray(slide.textSlots) || slide.textSlots.length !== 0) {
        throw new Error("Place/event photo slides may not contain text");
      }
      if (slide.hasDoripeLogo !== true) throw new Error("Photo slide requires Doripe logo");
    }
  }
  return { ok: true };
}
```

`validateCaption()`에서 `draft.caption`에 `DIRECT_CTA_PATTERN`이 있으면 실패시킨다. `validateDraftBundle()`은 다음 gate를 반환한다.

```js
const presentation = validateSlideEvidence(draft, layoutEvidence);
return { originality, caption, sources, layout, presentation };
```

`scripts/instagram-content/package-writer.mjs`의 package 필수 gate에도 presentation을 추가한다.

```js
const VALIDATION_GATES = Object.freeze([
  "originality",
  "caption",
  "sources",
  "layout",
  "presentation",
]);
```

- [ ] **Step 4: 검수 테스트 통과 확인**

Run: `node --test tests/instagram-content/validators.test.mjs tests/instagram-content/cli.test.mjs tests/instagram-content/package-writer.test.mjs`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add scripts/instagram-content/validators.mjs scripts/instagram-content/package-writer.mjs tests/instagram-content/validators.test.mjs tests/instagram-content/cli.test.mjs tests/instagram-content/package-writer.test.mjs
git commit -m "feat: validate photo-only and Doripe end slides"
```

---

### Task 3: Figma 승인 템플릿 수정

**Files:**
- External edit: Figma file `9btf9oUzIvw3JQq4OPyYEn`, page `Instagram Content Automation`
- Verify: `docs/instagram-content/template-contract.json`

**Interfaces:**
- Consumes: approved roots `28:14`, `28:15`, `28:16`, component `Doripe/Mark` node `4:2`.
- Produces: 각 root의 `BRAND_END` frame과 `slot:brand-question`; `place_event`의 사진 전용 `INNER` frame.

- [ ] **Step 1: 수정 전 구조와 디자인 context 확인**

Figma `get_design_context`로 roots `28:14`, `28:15`, `28:16`을 확인한다. 세 root가 각각 COVER와 INNER를 포함하고 모든 frame이 1080×1350인지 확인한다.

- [ ] **Step 2: place_event 중간 장 단순화**

`21:11`에서 `design:bottom-dark-gradient`, `design:green-accent`, `slot:place:01`, `slot:body:01`, `slot:info:location`, `slot:credit`을 삭제한다. `slot:photo:01`은 full-bleed로 유지하고 `design:doripe-mark`는 `(960, 54)`에 유지한다.

- [ ] **Step 3: 공통 마지막 장 생성**

세 root 안에 각각 다음 구조를 가진 1080×1350 frame을 `y=2800`에 만든다.

```text
V2/{TYPE}/BRAND_END — APPROVED
├─ design:brand-background (#050505, 1080×1350)
├─ design:safe-region-x34-1046 (hidden)
├─ slot:brand-question (x=100, y=120, w=880, h=170, centered, white)
├─ design:phone-mockup (x=290, y=330, w=500, h=760)
│  ├─ black device shell
│  ├─ green Doripe header mark
│  └─ simple real-product masonry cards and route line drawn as Figma shapes
├─ design:doripe-mark (green, x=436, y=1150, 52×52)
└─ design:brand-wordmark (`Doripe.`, centered, y=1216, white)
```

목업에는 외부 또는 AI 이미지를 넣지 않고, 현재 제품의 Pinterest형 발견 피드와 코스선을 Figma 도형으로 단순화해 표현한다.

- [ ] **Step 4: 시각 검수**

각 `BRAND_END` screenshot과 `21:11` screenshot을 1080×1350으로 확인한다. 질문과 워드마크가 좌우 34px 안에 있고, 검은 배경·휴대폰 목업·녹색 로고가 명확한지 확인한다.

- [ ] **Step 5: root 구조 감사**

세 root ID가 그대로 `28:14`, `28:15`, `28:16`인지, 각 root가 COVER/INNER/BRAND_END 세 frame을 갖는지, `slot:cta`가 전혀 없는지 확인한다.

---

### Task 4: 일일 실행 가이드 갱신

**Files:**
- Modify: `docs/ops/instagram-content-daily-runbook.md`
- Modify: `tests/instagram-content/runbook.test.mjs`

**Interfaces:**
- Consumes: `brandQuestion`, `layoutEvidence.slides`, 수정된 Figma root.
- Produces: 반복 작업자가 새 carousel을 같은 방식으로 만들 수 있는 절차.

- [ ] **Step 1: 실패 테스트 작성**

`tests/instagram-content/runbook.test.mjs`에 다음 필수 문구 검사를 추가한다.

```js
for (const phrase of [
  "brandQuestion",
  "brand_end",
  "사진과 Doripe 심볼만",
  "직접 CTA를 넣지 않는다",
  "hasPhoneMockup",
]) {
  assert.match(runbook, new RegExp(phrase));
}
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/instagram-content/runbook.test.mjs`

Expected: 새 용어가 없어 FAIL.

- [ ] **Step 3: 가이드 수정**

draft 단계에서 `cta`를 삭제하고 `brandQuestion`을 60자 이내 질문으로 작성한다. Figma 단계에는 place_event 중간 장의 텍스트를 모두 제거하고 공통 마지막 장을 복제하는 절차를 넣는다. layout evidence 예시는 `slides` 배열과 `brand_end` 증거를 포함한다. 캡션에는 사실·출처·방문정보는 유지하되 직접 send/save 문구를 넣지 않는다고 명시한다.

- [ ] **Step 4: 가이드 테스트 통과 확인**

Run: `node --test tests/instagram-content/runbook.test.mjs`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add docs/ops/instagram-content-daily-runbook.md tests/instagram-content/runbook.test.mjs
git commit -m "docs: update Instagram carousel daily workflow"
```

---

### Task 5: 2026-07-14 드라이런 재제작

**Files:**
- Modify outside Git: `/tmp/doripe-instagram-content/2026-07-14/seoul-free-exhibitions-weekend/draft.json`
- Modify outside Git: `/tmp/doripe-instagram-content/2026-07-14/private-protocol-last-week/draft.json`
- Replace package: `/Users/cityboy/Desktop/Doripe/Instagram Content/2026-07-14/01-seoul-free-exhibitions-weekend`
- Replace package: `/Users/cityboy/Desktop/Doripe/Instagram Content/2026-07-14/02-private-protocol-last-week`
- External edit: Figma dry-run wrapper `34:14`

**Interfaces:**
- Consumes: 새 Figma 템플릿과 검수 계약.
- Produces: collection 7장, place_event 6장의 검수 package.

- [ ] **Step 1: draft에서 CTA 제거**

두 caption의 마지막 send 문장을 삭제하고 `cta` 필드를 제거한다. 다음 질문을 추가한다.

```json
// collection
"brandQuestion": "오늘의 취향을 더 발견하고 싶다면?"

// place_event
"brandQuestion": "이 전시 다음에 갈 장소가 궁금하다면?"
```

- [ ] **Step 2: Figma dry-run 수정**

collection의 기존 6장은 정보형 구성을 유지하되 `35:79`를 삭제하고 마지막에 collection `BRAND_END`를 복제한다. place_event의 `36:30`, `36:41`, `36:52`, `36:63`은 photo와 Doripe mark만 남기고 나머지 텍스트·gradient·accent를 삭제한다. 마지막에 place_event `BRAND_END`를 복제한다.

- [ ] **Step 3: layout evidence 갱신과 검증**

collection은 `slideCount: 7`, place_event는 `slideCount: 6`으로 갱신한다. `slides`의 첫 role은 `cover`, 마지막 role은 `brand_end`이고, place_event의 중간 네 장은 `textSlots: []`, `hasDoripeLogo: true`로 기록한다.

Run:

```bash
npm run instagram:content -- validate /tmp/doripe-instagram-content/2026-07-14/seoul-free-exhibitions-weekend/draft.json /tmp/doripe-instagram-content/2026-07-14/seoul-free-exhibitions-weekend/layout-evidence.json /tmp/doripe-instagram-content/2026-07-14/seoul-free-exhibitions-weekend/validation.json
npm run instagram:content -- validate /tmp/doripe-instagram-content/2026-07-14/private-protocol-last-week/draft.json /tmp/doripe-instagram-content/2026-07-14/private-protocol-last-week/layout-evidence.json /tmp/doripe-instagram-content/2026-07-14/private-protocol-last-week/validation.json
```

Expected: originality, caption, sources, layout, presentation이 모두 `ok: true`.

- [ ] **Step 4: PNG export와 package 재생성**

모든 slide를 1080×1350 PNG로 export한다. 기존 package는 `/tmp/doripe-instagram-content/2026-07-14/pre-carousel-simplification/`에 보존한 뒤 같은 sequence 1, 2로 재생성한다. history는 두 항목만 유지하고 새 manifest의 `createdAt`으로 바꾼다.

- [ ] **Step 5: 시각 검수**

13개 PNG 전부에서 안전영역, 어색한 줄바꿈, 로고 가시성, 마지막 장 일관성을 확인한다. 웹 사진 권리 미확인과 인물 초상권 경고는 `review.txt`에 남아 있어야 한다.

---

### Task 6: 전체 회귀 검수

**Files:**
- Verify only: repository and generated packages

**Interfaces:**
- Consumes: Tasks 1–5의 코드, Figma, package.
- Produces: 사용자 시각 승인용 링크와 검수 결과.

- [ ] **Step 1: 전체 자동 테스트**

Run:

```bash
npm run guard:repo
npm run check:session
npm run check:instagram-content
npm run typecheck
```

Expected: 모든 command exit 0, Instagram test fail 0.

- [ ] **Step 2: Figma와 package 일치 확인**

Figma screenshot과 package PNG의 SHA-256을 비교하고, 두 package의 PNG 수가 각각 7개와 6개인지 확인한다.

- [ ] **Step 3: 완료 보고**

Figma dry-run 링크, 두 package 폴더, 두 cover와 두 brand-end 미리보기, 권리 경고를 사용자에게 전달한다. Instagram 게시와 자동화 예약은 시각 승인 전 실행하지 않는다.
