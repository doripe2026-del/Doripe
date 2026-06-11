# Doripe Web MVP Figma Contract

Source: https://www.figma.com/design/m8pKPheVZTmaVVAUcnr0jh/Doripe-MVP-UI?node-id=179-17

Captured: 2026-06-11

## Implementation Rule

The `/app` web MVP must match the captured Figma screens. CSS values should come from the Figma contract JSON and Figma measurements, not from visual guessing.

## Product Overrides

- The first screen is `C1 / First Region Setup`.
- Only `연남` is active in the web MVP.
- `성수`, `용산·후암·해방촌`, and `망원` are disabled and show the top alert: `이 동네는 곧 열릴 예정이에요.`
- If the Figma frame still says `연남·망원`, the web app must display/filter as `연남` only.
- No login appears in the web MVP.
- Public place cards must use real admin/Supabase data.
- The card action limit is 12. Save and skip count; photo browsing does not.

## Screen Map

| Figma screen | Web state | Purpose |
| --- | --- | --- |
| `C1 / First Region Setup` | `region` | First neighborhood selection |
| `C1A / Neighborhood Travel Transition` | `regionTransition` | Short transition after selecting Yeonnam |
| `C2 / Discovery Tag Setup` | `tagSetup` | Optional pre-discovery tag selection |
| `C3 / Region Selector Open` | `discoverRegionOpen` | Region selector open over discover |
| `D1 / Discover Place Card` | `discover` | Main real-data place card |
| `D1I / Discover Place Card Detail` | `placeDetail` | Place card detail/back side |
| `D7 / Discover Complete` | `discoverComplete` | No more Yeonnam cards |
| `D8 / Swipe Limit Reached` | `swipeLimit` | 12-card action limit |
| `F1E / Saved Places Empty` | `savedEmpty` | Saved tab with no places |
| `F1 / Saved Places List` | `saved` | Saved place grid/list |
| `F1F` | `savedFilterOpen` | Saved filter popover |
| `F1D / Saved Place Detail` | `savedPlaceDetail` | Saved place detail |
| `F1DS / Saved Place Detail Share Open` | `savedPlaceShareOpen` | Share popover from saved place |
| `F1R / Saved Routes List` | `savedRoutes` | Saved route list |
| `F1RD / Saved Route Detail` | `savedRouteDetail` | Saved route detail |
| `G1E / Route Places Empty` | `routeEmpty` | Route tab without saved places |
| `Route 후보` | `route` | Route place candidate selection |
| `Route 후보 Filter Open` | `routeFilterOpen` | Route filter popover |
| `G2 / Route Building Loading` | `routeBlocked` | MVP route-generation unavailable state |
| `G6 / Route Saved Result` | `routeSaved` | Route saved/result state |
| `G8 / Share Open` | `shareOpen` | Share icon popover |
| `ERR / Top Alert Pattern` | `topAlert` | Shared top alert pattern |

## Core Measurements

- Mobile frame: `393 x 852`.
- Canonical bottom nav: `x=24`, `y=774`, `w=345`, `h=58`.
- Bottom nav active pill: `w=66`, `h=42`, `y=8`.
- Canonical region selector: `x=24`, `y=48`, `w=112`, `h=42`, radius `21`.
- First region map card: `x=24`, `y=224`, `w=345`, `h=410`, radius `28`.
- Main CTA in region setup: `x=24`, `y=760`, `w=345`, `h=54`, radius `15`.
- Route candidate white sheet: `x=26`, `y=134`, `w=341`, `h=640`.
- Route candidate action button: `x=44`, `y=704`, `w=301`, `h=50`.

## Implementation Notes

Use the Figma JSON contract as the first-pass parity checklist. If later Figma changes are made, regenerate this contract before changing `/app` UI.
