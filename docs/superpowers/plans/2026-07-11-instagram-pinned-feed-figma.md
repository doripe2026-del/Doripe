# Doripe Instagram Pinned Feed Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an editable Figma design containing three connected 1080 × 1080 Instagram pinned-feed images for Doripe.

**Architecture:** Build one 3240 × 1080 combined composition first so the route and background remain continuous, then create three export frames that reproduce the left, center, and right sections. Use named layers for copy, route, product screens, place imagery, and supporting details.

**Tech Stack:** Figma Design, Figma Plugin API, Pretendard, Doripe design tokens

## Global Constraints

- Output consists of three single-image posts; no carousel and no caption.
- Each export frame is exactly 1080 × 1080px.
- The combined preview is exactly 3240 × 1080px.
- Copy is fixed to `INSPIRE / 누군가의 취향에서 시작해`, `EXPLORE / 가까운 장소들을 잇고`, and `SHARE / 함께 걷고 싶은 루트가 되다`.
- Colors are `#10C76F`, `#0AC75C`, `#FAF8F1`, `#0E131E`, and `#E0EAD7`.
- Typeface is Pretendard.
- Do not modify Doripe Brain documents.

---

### Task 1: Create and inspect the Figma file

**Files:**
- Create: Figma design file `Doripe — Instagram Pinned Feed`

**Interfaces:**
- Consumes: approved design spec at `docs/superpowers/specs/2026-07-11-instagram-pinned-feed-design.md`
- Produces: Figma `fileKey` used by Tasks 2–5

- [ ] **Step 1:** Resolve the user's Figma plan with `whoami`.
- [ ] **Step 2:** Create a blank design file named `Doripe — Instagram Pinned Feed`.
- [ ] **Step 3:** Inspect pages, local variables, available fonts, and existing top-level nodes.
- [ ] **Step 4:** Confirm Pretendard availability; if unavailable, use `Noto Sans KR` and record the fallback in the final handoff.

### Task 2: Build the combined composition skeleton

**Files:**
- Modify: Figma page `Instagram Pinned Feed`

**Interfaces:**
- Consumes: Figma `fileKey` from Task 1
- Produces: node ID for `Pinned Feed — Combined Preview`

- [ ] **Step 1:** Rename the page to `Instagram Pinned Feed`.
- [ ] **Step 2:** Create a 3240 × 1080 combined frame with Doripe cream background.
- [ ] **Step 3:** Add three 1080px guide regions named `01 INSPIRE`, `02 EXPLORE`, and `03 SHARE`.
- [ ] **Step 4:** Add the continuous green route and three route nodes across the complete width.
- [ ] **Step 5:** Capture a screenshot and verify that the route crosses both frame boundaries without a jump.

### Task 3: Add copy and product-flow visuals

**Files:**
- Modify: Figma frame `Pinned Feed — Combined Preview`

**Interfaces:**
- Consumes: combined frame node ID from Task 2
- Produces: completed editable composition

- [ ] **Step 1:** Add the INSPIRE English label, Korean line, curator badge, and discover-screen mockup.
- [ ] **Step 2:** Add the EXPLORE English label, Korean line, walking-distance chip, and nearby-place mockup.
- [ ] **Step 3:** Add the SHARE English label, Korean line, share chip, and completed-route mockup.
- [ ] **Step 4:** Offset the three phone mockups in height, angle, and scale so they visually follow the route.
- [ ] **Step 5:** Add restrained place-photo blocks and map-green supporting shapes without covering the copy.
- [ ] **Step 6:** Capture a screenshot and check typography, contrast, clipping, and visual flow.

### Task 4: Create three export frames

**Files:**
- Modify: Figma page `Instagram Pinned Feed`

**Interfaces:**
- Consumes: completed combined composition from Task 3
- Produces: export-ready frames `01 INSPIRE`, `02 EXPLORE`, and `03 SHARE`

- [ ] **Step 1:** Create three 1080 × 1080 export frames below the combined preview.
- [ ] **Step 2:** Reproduce the corresponding left, center, and right visual sections inside each frame.
- [ ] **Step 3:** Set PNG export settings at 1× for each export frame.
- [ ] **Step 4:** Capture a screenshot of all three export frames placed side by side.
- [ ] **Step 5:** Verify that no critical copy or product screen is clipped at an edge.

### Task 5: Final visual verification

**Files:**
- Verify: Figma file `Doripe — Instagram Pinned Feed`

**Interfaces:**
- Consumes: combined preview and three export frames
- Produces: verified Figma URL and export-ready node IDs

- [ ] **Step 1:** Inspect metadata for exact frame names and dimensions.
- [ ] **Step 2:** Compare the combined preview with the three export frames for continuous route alignment.
- [ ] **Step 3:** Check that all placeholders are removed and all text is editable.
- [ ] **Step 4:** Return the Figma URL and summarize the three export frames.
