# Deep Interview Spec: Doripe Landing Motion Graphics

## Metadata

- Interview ID: doripe-landing-motion-20260710
- Rounds: 3
- Final Ambiguity Score: 12%
- Type: brownfield
- Generated: 2026-07-10
- Threshold: 20%
- Initial Context Summarized: no
- Status: PASSED

## Clarity Breakdown

| Dimension | Score | Weight | Weighted |
| --- | ---: | ---: | ---: |
| Goal Clarity | 0.92 | 0.35 | 0.322 |
| Constraint Clarity | 0.90 | 0.25 | 0.225 |
| Success Criteria | 0.80 | 0.25 | 0.200 |
| Context Clarity | 0.90 | 0.15 | 0.135 |
| **Total Clarity** | | | **0.882** |
| **Ambiguity** | | | **0.118** |

## Goal

Replace the Doripe landing page's current product images with advertising-style motion scenes that use real Figma UI to show how user and curator content becomes place discovery, nearby-place recommendations, a shareable day course, and navigation, while driving visitors toward the existing notification CTA.

## Constraints

- Modify visual areas only.
- Preserve all landing-page copy.
- Preserve all CTA buttons and destinations.
- Do not modify `/notify`.
- Use Figma UI as the source of truth.
- Use AI imagery only for photographic content and profiles.
- Represent missing algorithm, sharing, and navigation UI through temporary advertising overlays.
- Support desktop and mobile.

## Non-Goals

- Building the actual recommendation algorithm.
- Building course sharing or navigation product behavior.
- Creating permanent app UI for conceptual overlays.
- Changing backend, analytics, or notification flows.

## Acceptance Criteria

- [ ] Hero motion shows the complete product flow in approximately eight seconds.
- [ ] Lower scenes cover social discovery, nearby-place recommendations, and course sharing/navigation.
- [ ] Existing Figma UI remains visually recognizable.
- [ ] AI-generated assets do not contain UI or text.
- [ ] Copy, buttons, CTA destinations, and `/notify` are unchanged.
- [ ] Mobile keeps the same narrative with reduced simultaneous detail.
- [ ] Reduced-motion and JavaScript-failure fallbacks remain understandable.

## Assumptions Exposed And Resolved

| Assumption | Challenge | Resolution |
| --- | --- | --- |
| Saving is Doripe's central story | The user clarified that saving is only an intermediate action | Center the story on social content, discovery, algorithms, and courses |
| Every motion must mirror an existing app screen | Algorithm and sharing screens do not yet exist | Use temporary advertising overlays over real Figma UI |
| Landing copy should dictate each visual | The user asked to prioritize product truth over current copy | Preserve copy but let visuals carry the broader product story |
| AI can generate complete scenes | AI-generated UI produces unreliable structure and text | Use AI only for photos, thumbnails, and profile imagery |

## Technical Context

- Landing markup and styles currently live in `public/home/index.html`, with a mirrored `public/index.html`.
- The hero currently rotates three phone screenshots using `.phone-stage`, `.orbit`, `.iphone`, and `counterOrbit`.
- Lower product visuals use `.journey-row`, `.journey-visual`, and `.journey-phone`.
- Existing Figma-derived assets are under `public/img/figma-ui/`.
- Current lower visuals are static images for Discover, Saved, and Route states.
- Existing responsive rules already collapse journey rows below 900px.

## Ontology

| Entity | Type | Fields | Relationships |
| --- | --- | --- | --- |
| Visitor | core domain | viewport, motion preference | views Motion Scenes and may click Notification CTA |
| Creator | core domain | profile, account type, official badge | publishes UGC Posts |
| UGC Post | core domain | photo/video, creator, place | enables discovery of a Place |
| Place | core domain | media, tags, location | anchors Nearby Recommendations and belongs to a Course |
| Nearby Recommendation | supporting | walking time, category, atmosphere | connects a selected Place to candidate Places |
| Course | core domain | ordered places, route, duration | can be shared and opened for navigation |
| Share Card | supporting | course summary, sender, recipient | carries a Course to another user |
| Navigation Handoff | external transition | starting place, route segment | opens travel guidance for a Course |
| Motion Scene | presentation | timeline, assets, fallback | visualizes domain relationships on the landing page |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 6 | 6 | - | - | - |
| 2 | 6 | 0 | 1 | 5 | 100% |
| 3 | 9 | 3 | 0 | 6 | 67% |

Round 1 established visitor, creator, place content, place, course, and motion scene. Round 2 retained those entities and refined motion scene into advertising-style motion. Round 3 added nearby recommendation, share card, and navigation handoff after the product story was clarified.

## Interview Transcript

### Round 1

**Q:** What should visitors understand first from the hero?

**A:** Friends and curators recommend places, and the user turns them into a day course.

### Round 2

**Q:** Should the motion prioritize a literal product demo or advertising-style emphasis?

**A:** Advertising-style motion.

### Round 3

**Q:** What action should the motion drive?

**A:** Notification signup. `/notify`, buttons, and copy are already complete and must not be changed; only the image areas should change.

### Clarifications After Threshold

- The core is user and curator photo/video content, place discovery, nearby-place recommendation, course creation, sharing, and navigation.
- The three approved product stages are social content discovery, nearby-place algorithm, and course sharing/navigation.
- Existing Figma UI should remain the base. Missing product surfaces should be communicated through exaggerated advertising overlays.

## Design Reference

See `docs/superpowers/specs/2026-07-10-landing-motion-graphics-design.md`.
