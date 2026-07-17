# Doripe Landing Static Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four 1440 x 900 static Figma concepts that explain Doripe's discovery-to-day-course flow using the complete latest UI and coherent AI place photography.

**Architecture:** Preserve each latest Doripe screen as its exact high-resolution flattened source image, contained at full aspect ratio with no side crop. Build the advertising explanation around it from editable Figma cards, connectors, photo pins, folders, profile chips, and reactions; only photographic content is AI-generated.

**Tech Stack:** Existing Doripe Figma file, Figma MCP, OpenAI image generation, PNG/JPEG assets, local visual QA screenshots.

## Global Constraints

- Work in the existing Figma file `TfZAtv9JUy508otim4P23w` on page `0:1`.
- Create section `Landing Static Visual Drafts` and four frames: `01 Hero`, `02 Social Discovery`, `03 Nearby Recommendations`, `04 Shared Day Folder`.
- Every frame is exactly 1440 x 900 and includes one complete, uncropped latest Doripe UI screen.
- Use no legacy landing-export UI.
- Do not generate UI, buttons, labels, maps, Korean text, or logos with AI.
- Preserve original UI text, icons, layout, and screen aspect ratio.
- Generate people only as candid background context; faces are not the focal point.
- Do not modify landing-page code during this plan.

---

### Task 1: Lock Source Screens And Campaign Asset Set

**Files:**
- Create: `public/img/landing-static-drafts/restaurant.jpg`
- Create: `public/img/landing-static-drafts/cafe.jpg`
- Create: `public/img/landing-static-drafts/activity.jpg`
- Create: `public/img/landing-static-drafts/dessert.jpg`
- Create: `public/img/landing-static-drafts/alley.jpg`
- Create: `public/img/landing-static-drafts/lifestyle.jpg`
- Create: `public/img/landing-static-drafts/profile-friend-01.jpg`
- Create: `public/img/landing-static-drafts/profile-curator-01.jpg`
- Create: `public/img/landing-static-drafts/asset-manifest.md`

**Interfaces:**
- Consumes: high-resolution embedded source screens from Figma nodes `5:2`, `7:2`, `22:2`, `25:2`, and `33:2`.
- Produces: eight campaign images with fixed roles and a manifest mapping every image to its Figma usage.

- [ ] **Step 1: Verify source-screen dimensions**

Run:

```bash
sips -g pixelWidth -g pixelHeight /tmp/figma-b1-source.png
```

Expected: the Following source is `860 x 1828`, large enough to display near 393 x 836 without upscaling.

- [ ] **Step 2: Generate the six place/lifestyle images**

Use image generation with this shared art direction on every prompt:

```text
Editorial Korean lifestyle photography for Doripe, contemporary Seoul, candid and naturally imperfect, realistic daylight or practical warm lighting, authentic materials, subtle film grain, balanced neutral colors with restrained green accents, no text, no logo, no watermark, no artificial glow, no plastic AI texture, no centered stock-photo composition, people only incidentally and without a clearly visible face.
```

Generate these exact subjects:

```text
restaurant.jpg: intimate modern Korean bistro table viewed at a slight diagonal, two plated dishes and water glasses, warm evening light, neighboring diners softly cropped at the frame edge
cafe.jpg: quiet independent Seoul cafe beside a large window, coffee and an open book on a wooden table, leafy street outside, one seated person seen only from behind
activity.jpg: small contemporary ceramics workshop, hands arranging an unfinished cup beside tools, shelves and other visitors softly out of focus
dessert.jpg: restrained dessert bar, plated seasonal tart and tea, late-afternoon light, tactile stone and wood surfaces
alley.jpg: walkable Seoul side street with independent shops and greenery, one or two pedestrians photographed from behind, observational street-photography angle
lifestyle.jpg: friend arriving at a small neighborhood place and lifting a phone to photograph it, face outside the crop, candid shoulder-level camera angle
```

Expected: all six images read as one campaign while differing clearly by place category.

- [ ] **Step 3: Generate two circular-profile source portraits**

Generate:

```text
profile-friend-01.jpg: candid Korean woman in her twenties photographed by a friend outdoors near a cafe, varied three-quarter angle, natural phone-camera look, enough negative space for a circular crop
profile-curator-01.jpg: Korean place curator in their late twenties inside an independent shop, candid medium-distance portrait, camera strap visible, natural phone-camera look, enough negative space for a circular crop
```

Expected: portraits feel like real social profile photos rather than studio headshots.

- [ ] **Step 4: Inspect every generated image at full size**

Open all eight files and reject any asset with visible text, malformed hands, repeated objects, plastic skin, or a face as the primary subject of a place photo.

- [ ] **Step 5: Record the asset mapping**

Create `asset-manifest.md` with this exact mapping:

```markdown
# Landing Static Draft Assets

- `restaurant.jpg`: selected restaurant, Hero expansion, pin 1
- `cafe.jpg`: nearby cafe recommendation, pin 2
- `activity.jpg`: nearby activity recommendation
- `dessert.jpg`: nearby dessert recommendation, pin 3
- `alley.jpg`: Social Discovery selected-place expansion
- `lifestyle.jpg`: Social Discovery UGC expansion
- `profile-friend-01.jpg`: friend reaction avatar
- `profile-curator-01.jpg`: curator reaction avatar
```

- [ ] **Step 6: Commit the approved asset set**

```bash
git add public/img/landing-static-drafts
git commit -m "assets: add landing static campaign photography"
```

### Task 2: Build Figma Section And Hero Concept

**Files:**
- Modify: Figma file `TfZAtv9JUy508otim4P23w`, page `0:1`

**Interfaces:**
- Consumes: Task 1 assets and Following source screen node `5:2`.
- Produces: section `Landing Static Visual Drafts` and frame `01 Hero`.

- [ ] **Step 1: Create the section and frame grid**

Create one section at an unused area of page `0:1`, then create four 1440 x 900 frames in a horizontal row with 120 px gaps. Apply white backgrounds and name them exactly as specified in Global Constraints.

- [ ] **Step 2: Place the complete Following screen**

Place the high-resolution source of node `5:2` at x=522, y=32, width=396, height=836 using `FIT`, without clipping either side. Add a restrained 24 px corner radius and a soft 0 24 80 shadow at 12% black.

- [ ] **Step 3: Add three photographic expansions**

Create editable framed image panels for `restaurant.jpg`, `cafe.jpg`, and `alley.jpg` at approximate positions `(70,145,390,245)`, `(980,88,360,240)`, and `(1010,560,330,220)`. Use 18 px corner radii, thin white borders, and soft shadows.

- [ ] **Step 4: Connect panels to their feed positions**

Draw 2 px Doripe-green connectors from each panel toward the corresponding feed cell. End each connector with a 12 px green focus dot; do not add arrowheads or explanatory copy.

- [ ] **Step 5: Verify Hero acceptance criteria**

Take a screenshot of `01 Hero` and confirm: complete phone visible, no side crop, UI readable at 100%, three external photos visually tied to feed cells, no AI-generated text.

- [ ] **Step 6: Commit the Hero checkpoint**

```bash
git add docs/superpowers/specs/2026-07-11-landing-static-visual-redesign-design.md docs/superpowers/plans/2026-07-11-landing-static-visual-redesign.md
git commit -m "docs: align static landing plan with Figma sources"
```

### Task 3: Build Social Discovery Concept

**Files:**
- Modify: Figma file `TfZAtv9JUy508otim4P23w`, frame `02 Social Discovery`

**Interfaces:**
- Consumes: Discover source screen node `7:2`, `alley.jpg`, `lifestyle.jpg`, and both profile portraits.
- Produces: a static concept explaining discovery through friend and curator content.

- [ ] **Step 1: Place the complete Discover screen**

Place the high-resolution Discover source centered-left at x=110, y=32, width=396, height=836 using `FIT`. Preserve every edge and add the same radius/shadow treatment as Hero.

- [ ] **Step 2: Build the selected-place expansion**

Create a 670 x 520 image frame at x=620, y=105 using `alley.jpg`. Overlay one small editable Doripe place label at the lower-left containing only `연남 골목의 작은 숍` and a green category chip `소품/체험`.

- [ ] **Step 3: Add friend and curator reaction chips**

Create two editable chips outside the enlarged photo. Friend chip: circular `profile-friend-01.jpg`, bold white nickname `오늘도산책`, no official badge, text `여기 분위기 진짜 좋아`. Curator chip: circular `profile-curator-01.jpg`, bold white nickname `동네수집가`, small green verified badge, text `오후 네 시쯤 추천해요`.

- [ ] **Step 4: Add exaggerated social proof**

Add one compact reaction cluster with three overlapping circular avatars, a heart count `128`, a save count `46`, and one small comment bubble. Keep this cluster visually subordinate to the selected-place photo.

- [ ] **Step 5: Verify Social Discovery acceptance criteria**

Take a screenshot and confirm: complete UI remains visible, selected place dominates the explanation, friend has no official badge, curator has one, profile photos remain circular, and discovery through people is understandable without landing copy.

### Task 4: Build Nearby Recommendations Concept

**Files:**
- Modify: Figma file `TfZAtv9JUy508otim4P23w`, frame `03 Nearby Recommendations`

**Interfaces:**
- Consumes: route-candidate source screen node `22:2` and four category images.
- Produces: selected restaurant, ordered recommendations, and a photo-based course-candidate tray.

- [ ] **Step 1: Place the complete route-candidate screen**

Place node `22:2` at x=72, y=32, width=396, height=836 using `FIT`, without edge crop.

- [ ] **Step 2: Create the selected restaurant card**

Create a 430 x 220 Doripe card at x=540, y=70 with `restaurant.jpg`, place name `리틀넥 연남`, category `식당`, and a subtle selected green border.

- [ ] **Step 3: Create three ordered recommendation cards**

Create three 300 x 170 cards arranged from upper-right to lower-right. Use `cafe.jpg` with `카페 · 도보 6분`, `activity.jpg` with `놀거리 · 도보 8분`, and `dessert.jpg` with `디저트 · 도보 5분`. Each card includes a large photo, place name, category, and walking time; no generic floating pill layout.

- [ ] **Step 4: Create the course-candidate tray**

Create one 830 x 180 tray along the bottom-right containing four 112 x 90 thumbnails in visit order `1–4`: restaurant, cafe, activity, dessert. Connect them with restrained green directional separators and label the tray `오늘의 코스 후보`.

- [ ] **Step 5: Verify Nearby Recommendations acceptance criteria**

Take a screenshot and confirm: restaurant is the starting selection; cafe, activity, and dessert are clearly ordered; every card and every course item contains a photo; the complete source screen remains visible.

### Task 5: Build Shared Day Folder Concept And Final QA

**Files:**
- Modify: Figma file `TfZAtv9JUy508otim4P23w`, frame `04 Shared Day Folder`

**Interfaces:**
- Consumes: route-complete screen node `25:2`, restaurant/cafe/dessert images, and both profile portraits.
- Produces: pins-to-folder social sharing concept and final reviewed four-frame Figma section.

- [ ] **Step 1: Place the complete route screen**

Place node `25:2` at x=70, y=32, width=396, height=836 using `FIT`, preserving the entire screen.

- [ ] **Step 2: Create three photo pins**

Create three 150 x 190 vertical photo-pin cards using `restaurant.jpg`, `cafe.jpg`, and `dessert.jpg`. Add visit numbers `1`, `2`, `3` and position them at x=560/800/1040, y=90/150/90.

- [ ] **Step 3: Converge pins into the day folder**

Draw three restrained curved green connectors from the pin cards to a central 610 x 250 folder at x=660, y=420. The folder contains the three thumbnails, the title `연남에서 보내는 하루`, and compact metadata `3곳 · 친구와 공유`.

- [ ] **Step 4: Add exaggerated friend reactions**

Surround the folder with four reaction elements: overlapping friend avatars with `+12`, a pink heart `86`, comment `이 코스 같이 가자`, and save `34`. Keep all reactions separate from route navigation and do not add turn-by-turn language.

- [ ] **Step 5: Run four-frame visual QA**

Capture each frame and a section overview. Confirm at 100% zoom:

```text
01 Hero: full UI + three photo expansions
02 Social Discovery: full UI + friend/curator discovery proof
03 Nearby Recommendations: restaurant → cafe → activity → dessert, photos everywhere
04 Shared Day Folder: three photo pins → one folder + social reactions, no navigation motif
```

- [ ] **Step 6: Correct visual defects**

Fix any clipped UI edge, stretched image, non-circular avatar, overlapping text, mismatched card radius, or illegible label before presenting the drafts.

- [ ] **Step 7: Present the static draft set**

Return the Figma section/frame links and four screenshots. Do not implement landing motion until the user approves these still concepts.
