# Doripe UI Research

Generated: 2026-05-17  
Purpose: Decide how Doripe should approach UI design before rebuilding the MVP screens.

## Executive Summary

Doripe should not start by polishing every screen. The better MVP path is to define the core flow, create mid-fidelity wireframes for the essential screens, then make one high-fidelity visual direction for the map-to-deck-to-Discover flow and extend that system across the app.

The evidence points to a practical workflow: wireframe structure first, define reusable design tokens and components, implement in React Native, then compare real device screenshots against the design. Figma is still the best handoff surface because Dev Mode exposes specs, annotations, variables, assets, and ready-for-development status for engineers.

For Doripe, the UI must feel like an editorial local guide, not a generic travel/map app. The product memory should be: "a black, map-led and photo-led premium local discovery app with neon green decisions." The current MVP should focus on six main surfaces: access code, fixed Seoul map, region deck picker, discover, saved, route.

## Research Questions

1. What does a normal app UI workflow look like?
2. What should a wireframe decide before visual design starts?
3. How should Figma handoff work for app development?
4. What UI rules matter most for Doripe's React Native MVP?

## Findings

### 1. Wireframes are for structure, not beauty

Wireframes are used to align layout, information architecture, user flow, functionality, and intended behavior before code is built. The UX Design Institute describes a wireframe as a two-dimensional skeleton or blueprint for an app screen, and notes that teams use it to get stakeholders aligned before development starts.

Implication for Doripe: wireframes should answer "what goes where?" and "what happens when tapped?", not "is this final brand design?" We should keep the wireframe grayscale/mid-fidelity and reserve brand polish for the next visual design pass.

Source: [UX Design Institute - What is wireframing?](https://www.uxdesigninstitute.com/blog/what-is-wireframing/)

### 2. Fidelity should increase in stages

Low-fidelity wireframes are useful for mapping flow and navigation. Mid-fidelity wireframes clarify spacing, buttons, and screen components without committing to final images or typography. High-fidelity wireframes/prototypes use real content, imagery, and typography when the structure is already agreed.

Implication for Doripe: start with mid-fidelity now. Doripe already has a product direction, so pure boxes are too vague, but full visual polish would slow decisions. A mid-fidelity set is the right bridge.

Source: [UX Design Institute - Wireframe fidelity types](https://www.uxdesigninstitute.com/blog/what-is-wireframing/)

### 3. Figma is useful because it carries specs into development

Figma Dev Mode is built for design-to-development handoff. It lets developers inspect layout, spacing, colors, variables, assets, annotations, and component information. It also supports "ready for dev" statuses so developers can distinguish approved screens from work-in-progress screens.

Implication for Doripe: if you design in Figma, each screen should be marked clearly by status:

- `Wireframe`
- `Visual direction`
- `Ready for dev`
- `Needs QA`

Source: [Figma - Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode)

### 4. Handoff is ongoing, not a one-time dump

Figma's Dev Mode supports comparing changes, annotations, status notifications, component metadata, and resource links. This implies a workflow where design and implementation stay connected as screens change, rather than a single "final file" being thrown over the wall.

Implication for Doripe: after I implement screens, we should screenshot the actual app and compare it to the Figma/wireframe. Design QA becomes a loop:

1. Design screen.
2. Implement screen.
3. Screenshot real app.
4. Fix spacing, hierarchy, typography, and broken states.

Source: [Figma - Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode)

### 5. Mobile UI must adapt to screen and font scaling

React Native's `useWindowDimensions` updates when screen size or font scale changes, and exposes width, height, and font scale. This matters because a screen that looks perfect on one phone can break on another phone if the layout assumes fixed dimensions.

Implication for Doripe: the final app should use responsive constraints for image cards, bottom navigation, tags, and route lists. We should design for a primary reference size, then test smaller Android widths.

Source: [React Native - useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions)

### 6. Touch targets must be large enough

Android Accessibility guidance recommends interactive elements be at least 48dp by 48dp, with enough spacing to avoid overlapping touch regions. It also notes that visible icons can be smaller as long as padding creates a larger touch target.

Implication for Doripe: save/skip buttons, bottom tabs, route segment buttons, and code input controls must be at least 48px/dp tall in implementation.

Source: [Android Accessibility Help - Touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en)

### 7. Accessibility labels and roles are part of UI quality

React Native provides accessibility APIs for iOS VoiceOver and Android TalkBack. Touchable elements are accessible by default, and custom labels, roles, hints, and states help screen readers explain the UI.

Implication for Doripe: UI design should include not only what the button says visually, but what it means. For example, the save button should have an accessibility label like "오월의 커피 저장".

Source: [React Native - Accessibility](https://reactnative.dev/docs/accessibility)

### 8. Bottom tabs are appropriate for Doripe's MVP

Doripe has three stable top-level destinations after access: Map, Saved, and Route. Discover is a flow that starts from a selected region deck, not the default tab. React Navigation supports bottom tabs with labels, accessibility state, and custom tab bars. This fits the product better than a hidden menu because users need repeated access to the map, saved places, and route planning.

Implication for Doripe: keep the bottom tab structure for MVP, but rename the first tab from Discover to Map. Improve its visual design later, but do not replace it with a hamburger menu.

Source: [React Navigation - Bottom Tabs Navigator](https://reactnavigation.org/docs/bottom-tab-navigator/)

## Doripe Design Direction

### Product Feeling

Doripe should feel like:

- editorial local guide
- premium but not cold
- photographic and tactile
- fast to understand
- opinionated, not directory-like

Doripe should not feel like:

- generic travel planner
- dense map utility
- coupon/commerce app
- SaaS dashboard
- template app with random cards

### Primary Visual System

Recommended direction:

- Background: near-black
- Accent: Doripe neon green
- Content: large neighborhood photography
- Typography: bold Korean title hierarchy
- Layout: image-led, not list-led
- Surfaces: restrained dark panels, low border radius
- Motion later: simple card transition, no decorative animation

### Core UI Principle

The Map screen is the product entry.
The Deck Picker is the personalization moment.
The Discover screen is the place-card experience.
Saved and Route are utility screens.
Access Code is a gate, not a landing page.

## What To Wireframe Now

Do wireframe:

- Access code entry
- Fixed Seoul map with three region pins
- Region deck picker
- Discover/place card
- Discover empty/end state
- Saved list
- Saved empty state
- Route preview
- Route empty state
- External map handoff button/segment

Do not wireframe yet:

- Full account system
- Social sharing
- Admin dashboard
- In-app place editing
- Complex route optimization
- Chatbot or AI itinerary generation

## Doripe MVP UI Requirements

### Access Code

Goal: let invited testers enter quickly.  
Needs:

- Doripe mark/wordmark area
- 4-digit code input
- single primary CTA
- inactive/wrong code error
- small trust copy

### Fixed Seoul Map

Goal: show the three active Doripe neighborhoods before any deck starts.
Needs:

- fixed Seoul map visual
- three visible pins: Seongsu, Yongsan/Huam/Haebangchon, Yeonnam/Mangwon
- selected pin state
- short instruction copy
- bottom navigation with Map selected

### Region Deck Picker

Goal: choose the right discovery deck from a selected neighborhood.
Needs:

- selected region label
- bottom sheet or panel
- mood chips
- visit condition chips
- deck card
- primary start CTA
- clear transition into Discover

### Discover

Goal: decide quickly whether to save a place.  
Needs:

- large photo card
- neighborhood/category metadata
- place name
- one-sentence editorial hook
- mood chips
- skip/save actions
- saved/skip loading state

### Saved

Goal: review saved places and open Naver place pages.  
Needs:

- compact list
- place order/count
- photo thumbnail or visual marker
- short copy
- open map/place action
- empty state with clear next action

### Route

Goal: understand a visit order and open segment directions.  
Needs:

- no "optimal route" claim
- numbered route preview
- saved place count
- segment list
- Naver directions action per segment
- empty state if fewer than two places

## Figma Setup Recommendation

Create one Figma file named `Doripe MVP Wireframes`.

Pages:

1. `00 Research Notes`
2. `01 Wireframes`
3. `02 Visual Direction`
4. `03 Components`
5. `04 Ready for Dev`

Frames:

- Use `393 x 852` as the primary iPhone reference.
- Also test `360 x 800` for common Android width.

Components:

- `AccessCodeInput`
- `PrimaryButton`
- `PlaceCard`
- `MoodChip`
- `BottomTab`
- `SavedPlaceRow`
- `RoutePin`
- `RouteSegment`
- `EmptyState`

## Design QA Checklist

Before implementation:

- Does each screen have one obvious primary action?
- Does every tappable item have enough touch area?
- Can text fit in Korean without looking cramped?
- Does the screen work with zero saved places?
- Does the screen work with many saved places?
- Does route wording avoid overpromising optimization?
- Are states clear: loading, error, empty, disabled?

After implementation:

- Compare app screenshot to design at `393 x 852`.
- Check Android narrow width around `360`.
- Confirm bottom tab never overlaps content.
- Confirm buttons are not below safe area.
- Confirm all primary buttons are at least 48dp tall.
- Confirm screen reader labels exist for main buttons.

## Methodology

Searched and reviewed official or reputable sources for:

- wireframing process
- Figma handoff and Dev Mode
- mobile touch target accessibility
- React Native responsive behavior
- React Native accessibility
- bottom tab navigation

Also ran local `ui-ux-pro-max` recommendations for Doripe's product type and React Native stack. The generated design-system suggestion was treated as inspiration, not as a final decision, because it recommended purple/rose colors that conflict with Doripe's established black/neon-green identity.

## Sources

1. [Figma - Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) - Developer handoff, inspect, ready-for-dev status, annotations, variables, assets.
2. [UX Design Institute - What is wireframing?](https://www.uxdesigninstitute.com/blog/what-is-wireframing/) - Wireframe definition, fidelity levels, and role in product design.
3. [Android Accessibility Help - Touch target size](https://support.google.com/accessibility/android/answer/7101858?hl=en) - 48dp touch target guidance and spacing notes.
4. [React Native - useWindowDimensions](https://reactnative.dev/docs/usewindowdimensions) - Screen and font-scale responsiveness.
5. [React Native - Accessibility](https://reactnative.dev/docs/accessibility) - Accessibility labels, roles, states, VoiceOver/TalkBack support.
6. [React Navigation - Bottom Tabs Navigator](https://reactnavigation.org/docs/bottom-tab-navigator/) - Bottom tab structure and accessibility state support.
