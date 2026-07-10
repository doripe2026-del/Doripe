# Doripe Landing Motion Graphics Design

## Status

- Approved direction: advertising-style social story
- Approved product story: social content discovery -> nearby-place algorithm -> course sharing and navigation
- Scope: landing-page visual areas only

## Goal

Replace the landing page's static product images with short, repeatable motion scenes that explain Doripe's core product flow and lead visitors toward the existing notification CTA.

The motion should communicate this story without depending on the surrounding copy:

1. Users and curators upload place photos and videos.
2. A visitor discovers and selects a place from that content.
3. Doripe recommends nearby places that fit together.
4. The selected places become a day course.
5. The course can be shared with other users and opened for navigation.

## Non-Goals

- Do not change landing-page copy.
- Do not change CTA buttons or their destinations.
- Do not change `/notify`.
- Do not present conceptual advertising overlays as permanent app controls.
- Do not generate complete UI screens with AI.
- Do not add backend or database behavior.

## Visual Strategy

Use current Figma UI as the visual source of truth. Animate real UI layers and add advertising-only overlays for product logic that does not yet have a dedicated Figma screen.

Use AI-generated imagery only for:

- place photos and video thumbnails;
- user and curator profile photos;
- optional photographic backgrounds inside existing Figma frames.

Do not use AI-generated text, buttons, navigation, tags, maps, or app chrome.

## Landing Visual Areas

### 1. Hero: Complete Product Story

An approximately eight-second loop shows the full Doripe experience in one continuous scene.

Sequence:

1. User and curator photo/video posts enter the stage.
2. One place is selected and expands from the real Discover UI.
3. Nearby place cards appear around the selected place with subtle distance and category cues.
4. Chosen place cards align and transform into map pins.
5. A route line draws between the pins and forms a day course.
6. The course becomes a share card, moves toward a friend's avatar, and ends with a navigation arrow.
7. The scene resets without a hard cut.

The hero remains an advertising composition rather than a literal app screen. Figma-derived elements establish product credibility; motion overlays explain the invisible algorithm and social handoff.

### 2. Social Place Discovery

The first lower visual focuses on the content source.

- Show a mix of user, friend, and curator profiles.
- Show photos and video thumbnails inside the real Discover feed structure.
- Use official badges only for curator accounts.
- Add short reactions such as `여기 분위기 좋아` as temporary overlays.
- End with one place becoming the active selection.

### 3. Nearby-Place Algorithm

The second lower visual begins from a selected or saved place.

- Keep the selected place fixed at the center.
- Reveal compatible nearby place cards around it.
- Use walking time, place type, and atmosphere tags as lightweight advertising overlays.
- Let selected candidates move into an ordered course tray.
- Avoid creating a fake permanent algorithm tab or settings screen.

### 4. Course Sharing And Navigation

The third lower visual completes the experience.

- Transform selected place cards into map pins.
- Draw a route line in visit order.
- Show a compact course summary using real Doripe visual language.
- Transform the result into a share card and move it toward another user's profile.
- Briefly show the recipient opening the course.
- End with a navigation arrow following the first route segment.

## Motion Language

- Use Doripe green for selection, connection, route, and completion.
- Use profile photos, place cards, map pins, route lines, and share cards as the repeated visual vocabulary.
- Prefer card movement and transformation over explanatory labels.
- Keep overlays short-lived so they read as advertising effects, not app controls.
- Use soft easing and clear staging; avoid constant floating motion across every element.
- Keep one dominant action on screen at a time.

## Technical Design

Build motion as responsive HTML, CSS, and small JavaScript scene controllers around exported Figma assets.

Recommended structure:

- one shared landing-motion stylesheet;
- one shared motion controller;
- four independent scene containers;
- scene timing controlled with CSS classes and variables;
- `IntersectionObserver` starts lower scenes only when visible;
- the hero loop may start immediately after critical assets load;
- no third-party animation dependency unless CSS and the Web Animations API prove insufficient.

Each scene must be understandable independently. Changes to one scene must not require changes to the other scenes.

## Responsive Behavior

Desktop shows the complete composition. Mobile uses the same story with fewer simultaneous cards.

- Hero: reduce the number of visible UGC cards and nearby candidates.
- Lower scenes: preserve the focal card and remove decorative secondary elements first.
- Do not shrink essential UI until it becomes unreadable.
- Prevent horizontal overflow at common widths from 320px upward.
- Keep existing copy and CTA placement unchanged.

## Accessibility And Fallbacks

- Respect `prefers-reduced-motion`.
- Reduced-motion mode shows each scene's final explanatory state as a static composition.
- Decorative overlays are hidden from assistive technology.
- Existing meaningful image descriptions remain available.
- Pausing or failing animation must not block CTA use.

## Performance

- Reuse current Figma assets where possible.
- Export new photographic assets as responsive WebP or AVIF.
- Lazy-load lower-scene media.
- Avoid autoplay video unless a required motion cannot be represented efficiently in CSS.
- Do not delay the hero headline or notification CTA while motion assets load.
- Show a stable static first frame before optional motion begins.

## Error Handling

- If an image fails, keep a neutral place-card shell rather than collapsing the layout.
- If JavaScript fails, all four scenes remain visible as static final states.
- If a scene is offscreen, pause its timeline to avoid unnecessary CPU use.
- If the browser cannot support a motion feature, fall back to opacity and transform transitions.

## Acceptance Criteria

- The hero communicates the full five-part flow within one loop: UGC discovery, place selection, nearby recommendations, course creation, and sharing/navigation.
- The three lower visuals clearly represent social discovery, nearby-place recommendation, and course sharing/navigation.
- All visible app UI is based on current Figma UI.
- AI imagery appears only inside photographic content and profile areas.
- No landing copy, CTA, CTA destination, or `/notify` behavior changes.
- Desktop and mobile layouts have no clipped or overlapping essential content.
- Reduced-motion mode presents complete static states.
- A JavaScript failure does not hide the visual explanation or CTA.
- Visual QA passes on desktop and mobile screenshots.

## Validation Plan

- Compare each scene against its approved storyboard.
- Test desktop, tablet, and 320px/360px/390px mobile widths.
- Test normal and reduced-motion settings.
- Check horizontal overflow and text/card clipping.
- Confirm lower scenes pause when offscreen.
- Confirm existing notification CTA links still open `/notify`.
- Measure that motion assets do not block the existing page's primary content.
