# Doripe B2B Blog Content Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first SEO production package for the Doripe B2B blog: a 100-article content map, reusable article template, and validation notes.

**Architecture:** This plan creates documentation/content artifacts only. It does not add the public blog UI yet. The output lives under `docs/content/b2b-blog/` so the team can review the strategy before turning it into website routes or generated articles.

**Tech Stack:** Markdown, CSV, PowerShell CSV validation, Git.

---

## File Structure

- Create: `docs/content/b2b-blog/README.md`
  - Explains the content package, audience, clusters, and how to use the map.
- Create: `docs/content/b2b-blog/article-template.md`
  - Defines the repeatable Korean article structure and light Doripe CTA rule.
- Create: `docs/content/b2b-blog/content-map.csv`
  - Contains exactly 100 rows with title, category, primary keyword, search intent, audience, priority, and brief angle.
- Create: `docs/content/b2b-blog/content-map-review.md`
  - Summarizes cluster counts, priority logic, internal linking rules, and quality checks.

This is intentionally separate from `startup-reference/doripe/public/` because it is a planning/content production artifact, not a deployed blog implementation.

## Content Map Schema

`docs/content/b2b-blog/content-map.csv` must use this exact header:

```csv
id,priority,cluster,title,primary_keyword,secondary_keywords,search_intent,target_space_types,doripe_angle,cta_strength,internal_links
```

Allowed `priority` values:

- `P0`: first 20 articles to draft manually before scaling.
- `P1`: next 40 articles.
- `P2`: remaining 40 articles.

Allowed `cluster` values and required counts:

| Cluster | Required Count |
| --- | ---: |
| 신규 손님 유입 | 20 |
| 인스타/숏폼 운영 | 15 |
| 네이버 플레이스/지도 | 15 |
| 사진/콘텐츠 소재 | 15 |
| 리뷰/저장/방문 전환 | 10 |
| 공간 브랜딩/분위기 | 10 |
| 재방문/단골/커뮤니티 | 10 |
| Doripe 리포트/케이스 | 5 |

Required `cta_strength` values:

- `light`: standard SEO articles. Use for at least 90 rows.
- `medium`: Doripe report/case-oriented articles. Use for at most 10 rows.

No row should use a hard product CTA.

---

### Task 1: Create Content Package README

**Files:**

- Create: `docs/content/b2b-blog/README.md`

- [ ] **Step 1: Create the README**

Create `docs/content/b2b-blog/README.md` with this content:

```markdown
# Doripe B2B Blog Content Package

This folder contains the first SEO production package for Doripe's B2B blog.

## Positioning

Doripe's B2B blog is a local marketing playbook for small spaces: restaurants, cafes, bars, shops, bookstores, studios, galleries, pop-ups, and other offline spaces that need better discovery.

The blog should not become a cafe-only blog and should not sound like a ranking-hack marketing agency.

## Primary Goal

Long-term organic search traffic from operators searching for practical ways to attract more qualified visitors.

## Product Exposure Rule

Most articles should be useful even if the reader has never heard of Doripe.

- 80-90% practical guidance.
- 10-20% Doripe perspective or soft CTA.
- No hard-selling.
- No promises about top ranking, ROI, or traffic manipulation.

## Files

- `article-template.md`: repeatable writing template.
- `content-map.csv`: 100 article ideas with keywords and search intent.
- `content-map-review.md`: review notes and validation summary.

## Usage

Start by drafting the P0 articles from `content-map.csv`. Review the first 20 manually for usefulness, specificity, and non-duplication before scaling into P1 and P2.
```

- [ ] **Step 2: Verify the README exists**

Run:

```powershell
Test-Path 'docs/content/b2b-blog/README.md'
```

Expected output:

```text
True
```

---

### Task 2: Create Article Template

**Files:**

- Create: `docs/content/b2b-blog/article-template.md`

- [ ] **Step 1: Create the article template**

Create `docs/content/b2b-blog/article-template.md` with this content:

```markdown
# Doripe B2B Blog Article Template

## Metadata

- Title:
- Primary keyword:
- Secondary keywords:
- Cluster:
- Search intent:
- Target space types:
- CTA strength: light

## 1. Problem Hook

Start from the operator's concrete problem. Use plain Korean and avoid product language.

Example:

> 손님이 완전히 없는 것은 아닌데, 새로 오는 사람이 늘지 않는다면 노출보다 먼저 점검해야 할 것이 있습니다.

## 2. Why This Happens

Explain the underlying reason without blaming the operator.

Cover one or more of:

- The space is visible but not memorable.
- Photos show the menu but not the visit situation.
- Map information answers facts but not desire.
- Instagram posts look nice but do not create a visit candidate.
- Reviews exist but do not explain who the space is for.

## 3. Practical Checklist

Give 5-7 concrete checks the operator can apply today.

Each checklist item should include:

- What to check.
- Why it matters.
- A small example.

## 4. Examples By Space Type

Include at least 2 examples from different space types when the topic allows.

Possible types:

- Restaurant
- Cafe
- Bar
- Shop
- Bookstore
- Studio
- Gallery
- Pop-up

## 5. Common Mistakes

List 3-5 mistakes.

Avoid generic advice like "post consistently" unless it is tied to a specific operator action.

## 6. Doripe Perspective

Add a short section that connects the topic to Doripe's view of local discovery.

Use this tone:

> Doripe는 공간을 단순한 광고 지면이 아니라, 손님이 저장하고 다시 꺼내볼 수 있는 방문 후보로 바라봅니다.

## 7. Soft CTA

Use a light CTA. Do not overpromise.

Default CTA:

> Doripe는 작은 공간을 취향 기반 카드로 소개하는 파일럿을 준비하고 있습니다. 우리 공간이 어떤 장면으로 보일 수 있을지 궁금하다면 파일럿을 신청해보세요.
```

- [ ] **Step 2: Verify the template exists**

Run:

```powershell
Test-Path 'docs/content/b2b-blog/article-template.md'
```

Expected output:

```text
True
```

---

### Task 3: Create 100-Article Content Map

**Files:**

- Create: `docs/content/b2b-blog/content-map.csv`

- [ ] **Step 1: Create the CSV with exact schema**

Create `docs/content/b2b-blog/content-map.csv` with the exact header from this plan and exactly 100 data rows.

Rules for the rows:

- Use Korean titles.
- Do not make the set cafe-only.
- Include restaurants, cafes, bars, shops, bookstores, studios, galleries, pop-ups, and general local spaces across the map.
- Make every row problem-led.
- Use `light` CTA for most rows.
- Use `medium` CTA only for Doripe report/case rows.
- Fill `internal_links` with 2-3 target clusters separated by `|`.

Example row format:

```csv
id,priority,cluster,title,primary_keyword,secondary_keywords,search_intent,target_space_types,doripe_angle,cta_strength,internal_links
B2B-001,P0,신규 손님 유입,작은 공간이 신규 손님을 늘리기 전에 점검해야 할 7가지,작은 가게 손님 늘리는 법,로컬 마케팅|매장 홍보|신규 고객 유입,신규 손님이 줄어든 이유와 점검 항목을 찾는다,식당|카페|샵|바,공간이 방문 후보로 기억되려면 무엇을 보여줘야 하는지 연결,light,사진/콘텐츠 소재|리뷰/저장/방문 전환
```

- [ ] **Step 2: Validate row count**

Run:

```powershell
$rows = Import-Csv 'docs/content/b2b-blog/content-map.csv'
$rows.Count
```

Expected output:

```text
100
```

- [ ] **Step 3: Validate cluster counts**

Run:

```powershell
Import-Csv 'docs/content/b2b-blog/content-map.csv' |
  Group-Object cluster |
  Sort-Object Name |
  Select-Object Name, Count |
  Format-Table -AutoSize
```

Expected counts:

```text
Name                  Count
----                  -----
Doripe 리포트/케이스      5
공간 브랜딩/분위기        10
네이버 플레이스/지도       15
리뷰/저장/방문 전환       10
사진/콘텐츠 소재          15
신규 손님 유입            20
인스타/숏폼 운영          15
재방문/단골/커뮤니티      10
```

- [ ] **Step 4: Validate CTA strength**

Run:

```powershell
Import-Csv 'docs/content/b2b-blog/content-map.csv' |
  Group-Object cta_strength |
  Select-Object Name, Count |
  Format-Table -AutoSize
```

Expected:

- `light` count is at least 90.
- `medium` count is at most 10.
- No other CTA value appears.

---

### Task 4: Create Content Map Review Notes

**Files:**

- Create: `docs/content/b2b-blog/content-map-review.md`

- [ ] **Step 1: Create review notes**

Create `docs/content/b2b-blog/content-map-review.md` with this content:

```markdown
# B2B Blog Content Map Review

## What This Map Optimizes For

The first 100 articles are problem-led, not industry-led. This keeps Doripe from becoming a cafe-only blog while still allowing article-level keywords for restaurants, cafes, shops, bars, and cultural spaces.

## P0 Review Rule

Draft the first 20 P0 articles manually before scaling.

Each P0 article should pass these checks:

- The first screen answers a real operator question.
- The advice is usable without knowing Doripe.
- At least two space types appear when relevant.
- Doripe is mentioned lightly, usually near the end.
- No top-ranking or ROI promise appears.
- The article links to at least two related problem clusters.

## Internal Linking Rule

Every article should link to:

1. One article in the same cluster.
2. One article in a supporting cluster.
3. One conversion-adjacent article when natural, such as save behavior, visit candidate framing, or a Doripe report.

## Scaling Rule

Do not generate all full articles blindly. Use the 100-row map to draft P0 first, review tone and usefulness, then scale into P1 and P2.
```

- [ ] **Step 2: Verify review notes exist**

Run:

```powershell
Test-Path 'docs/content/b2b-blog/content-map-review.md'
```

Expected output:

```text
True
```

---

### Task 5: Final Validation And Commit

**Files:**

- Verify: `docs/content/b2b-blog/README.md`
- Verify: `docs/content/b2b-blog/article-template.md`
- Verify: `docs/content/b2b-blog/content-map.csv`
- Verify: `docs/content/b2b-blog/content-map-review.md`

- [ ] **Step 1: Run path validation**

Run:

```powershell
@(
  'docs/content/b2b-blog/README.md',
  'docs/content/b2b-blog/article-template.md',
  'docs/content/b2b-blog/content-map.csv',
  'docs/content/b2b-blog/content-map-review.md'
) | ForEach-Object {
  if (-not (Test-Path $_)) { throw "Missing $_" }
  "OK $_"
}
```

Expected output:

```text
OK docs/content/b2b-blog/README.md
OK docs/content/b2b-blog/article-template.md
OK docs/content/b2b-blog/content-map.csv
OK docs/content/b2b-blog/content-map-review.md
```

- [ ] **Step 2: Run CSV integrity validation**

Run:

```powershell
$rows = Import-Csv 'docs/content/b2b-blog/content-map.csv'
if ($rows.Count -ne 100) { throw "Expected 100 rows, got $($rows.Count)" }
$required = @{
  '신규 손님 유입' = 20
  '인스타/숏폼 운영' = 15
  '네이버 플레이스/지도' = 15
  '사진/콘텐츠 소재' = 15
  '리뷰/저장/방문 전환' = 10
  '공간 브랜딩/분위기' = 10
  '재방문/단골/커뮤니티' = 10
  'Doripe 리포트/케이스' = 5
}
foreach ($cluster in $required.Keys) {
  $count = ($rows | Where-Object { $_.cluster -eq $cluster }).Count
  if ($count -ne $required[$cluster]) { throw "$cluster expected $($required[$cluster]), got $count" }
}
$badCta = $rows | Where-Object { $_.cta_strength -notin @('light','medium') }
if ($badCta) { throw "Unexpected CTA strength found" }
"CSV OK"
```

Expected output:

```text
CSV OK
```

- [ ] **Step 3: Inspect git diff**

Run:

```powershell
git diff -- docs/content/b2b-blog
```

Expected:

- Diff shows only the four new content package files.
- No unrelated mobile app or reference files are staged.

- [ ] **Step 4: Commit**

Run:

```powershell
git add -- docs/content/b2b-blog
git commit -m "Add B2B blog content map"
```

Expected:

- Commit succeeds with the four content package files.

---

## Self-Review

Spec coverage:

- The plan implements the approved positioning as a local marketing playbook for small spaces.
- The required 8 clusters and 100-article allocation are represented in the CSV schema and validation.
- The article template enforces light Doripe exposure.
- The plan avoids deploying a blog UI before the content map is reviewed.

Placeholder scan:

- No TBD, TODO, or "fill later" instructions remain.
- The only generated content not embedded directly in this plan is the 100-row CSV itself, which is the main execution artifact of Task 3 and is fully constrained by schema, counts, and validation commands.

Type consistency:

- CSV column names are consistent across schema, examples, validation, and review notes.

