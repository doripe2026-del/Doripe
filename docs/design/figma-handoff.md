# Doripe Figma Handoff

Generated: 2026-05-17

## Figma File

[Doripe MVP Wireframes + UI Direction](https://www.figma.com/design/rkQHMzub9wDyahTHF0mykD)

## What Is Inside

- `00 Cover / UI strategy`
- `01 Design System / Tokens`
- `WF 00 / Seoul map after access`
- `WF 00B / Region deck gallery`
- `WF 00C / Deck place picker`
- `03 New Flow / Map to Deck to Discover`
- Generated iOS-style status bars applied to all mobile frames
- `WF 01 / Access code`
- `WF 02 / Discover card`
- `WF 03 / Saved list`
- `WF 04 / Route preview`
- `WF 05 / Empty states`
- `HI-FI Direction / Discover editorial`
- `02 Handoff Notes / Ready for implementation`

## Design Basis

This file combines:

- Doripe UI research in `docs/design/doripe-ui-research.md`
- MVP wireframe scope in `docs/design/doripe-mvp-wireframes.md`
- `ui-ux-pro-max` accessibility, touch target, typography, and layout principles
- `frontend-design` direction: commit to one coherent visual point of view
- Existing Doripe brand references: black background, neon green accent, bold Korean typography, image-led layout

## Intended Workflow

1. Review the Figma file.
2. Review the updated `WF 00 / Seoul map after access`, `WF 00B / Region deck gallery`, and `WF 00C / Deck place picker` frames.
3. Pick whether the map-first flow feels right.
4. Pick whether the `HI-FI Direction / Discover editorial` screen feels right.
5. Adjust references/colors/copy in Figma if needed.
6. Mark approved frames as ready for dev.
7. Implement the approved direction in the React Native app.
8. Compare real app screenshots against Figma and do design QA.

## Current Status

The Figma file is a first structured design pass, not final production UI.

All 393 x 852 mobile frames now include a generated iOS-style status bar. It is editable vector/text content inside Figma, not a pasted web screenshot.

It is ready for:

- discussion
- visual direction feedback
- deciding the map-first product flow
- deciding the Discover screen style
- converting the approved structure into app code

## Flow Update

After access code verification, Doripe should show a fixed Seoul map with three region pins:

- Seongsu
- Yongsan / Huam / Haebangchon
- Yeonnam / Mangwon

Tapping a pin opens a full-screen deck gallery. Deck cards can show mood/visit-condition chips, but the chips are labels, not filters. After the user selects a deck, the app opens a gallery-style place picker for that deck. Confirming selected places starts the selected deck experience.

It is not yet ready for:

- final app store screenshots
- complete brand system
- full pixel QA across Android/iOS
