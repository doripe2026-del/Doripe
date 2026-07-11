# Course Convergence Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세 장소가 중앙 폴더로 모이고 주변에서 실제 반응이 나타나는 마지막 랜딩 모션을 구현한다.

**Architecture:** 기존 `motionSceneCourse`의 HTML 구조와 전용 CSS 애니메이션만 수정한다. 계약 테스트는 장소 3개, 중앙 폴더, 반응 5개와 필수 문구를 검증하고 브라우저 테스트는 320px부터 1440px까지 장면 경계를 검증한다.

**Tech Stack:** HTML, CSS keyframes, Node test runner, Chrome DevTools Protocol geometry test

## Global Constraints

- 기존 랜딩 문구와 CTA는 변경하지 않는다.
- 기존 AVIF 자산만 사용한다.
- production 배포는 실행하지 않는다.

---

### Task 1: Course Contract

**Files:**
- Modify: `tests/landing-route-contract.test.mjs`

- [ ] 중앙 폴더와 반응 5개를 요구하는 실패 테스트를 작성한다.
- [ ] `npm run test:landing-motion`으로 실패를 확인한다.

### Task 2: Course Scene

**Files:**
- Modify: `public/home/index.html`
- Modify: `public/home/landing-motion.css`
- Modify: `public/index.html`

- [ ] 세 갈래 경로와 중앙 수렴 카드 애니메이션을 구현한다.
- [ ] 기존 하단 반응 바를 제거하고 주변 반응 5개를 구현한다.
- [ ] `npm run sync:home`으로 미러 페이지를 갱신한다.

### Task 3: Verification

**Files:**
- Modify: `tests/landing-route-geometry.browser.mjs`

- [ ] 세 경로의 전체 길이와 반응 요소 경계를 검사한다.
- [ ] 랜딩 계약, 자산, 지오메트리, 타입 검사를 모두 통과시킨다.
- [ ] 데스크톱과 모바일 미리보기를 눈으로 확인한다.

