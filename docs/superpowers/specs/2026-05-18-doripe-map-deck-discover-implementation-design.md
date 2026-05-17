# Doripe Map-Deck-Discover MVP Implementation Design

## Context

Doripe already has an Expo React Native app with access-code entry, Discover, Saved, Route, storage services, and a place-centered domain model. The approved design source for this implementation is the Figma file `Doripe MVP UI Bright States Working Copy`:

https://www.figma.com/design/m8pKPheVZTmaVVAUcnr0jh/Doripe-MVP-UI---Bright-States-Working-Copy

Figma Dev Mode/design context was sampled from:

- `02 Map / default`
- `03 Deck Gallery / default`
- `05 Discover / card`
- `04 Place Gallery / selected`

The implementation should translate the Figma layout into React Native styles. Tailwind/web code from Figma is reference material only.

## User Flow

The MVP flow is:

`Access Code -> Map -> Deck Gallery -> Discover -> Place Gallery -> Saved / Route`

Important correction: Discover comes before Place Gallery. A user chooses a region pin, chooses a deck, explores the deck through Discover cards, then uses Place Gallery to select the final places to keep for Saved and Route.

## Visual Direction

Use the approved Bright States file as the visual baseline.

- Phone canvas: `393 x 852`.
- App background: `#f6f4ec`.
- Primary text: `#090b0a`.
- Muted text: `#5c6159`.
- CTA green: `#21f073`.
- Dark green CTA text: `#052e14`.
- Surface card: `#fffff9`.
- Main card radius: `14-24`.
- Primary CTA height: `52`, radius `18`.
- Chips: height `30`, pill radius.
- Use image/gradient card surfaces for decks, Discover, and place cards.

Saved and Route also use the bright background. Do not keep the old dark Saved/Route treatment.

## Navigation Design

After access is accepted, the app uses a stack for the selection flow and keeps bottom tabs for persistent destinations.

- `MapTab` is the default tab after access.
- `SavedTab` shows saved places for the current access code.
- `RouteTab` shows a visit-order preview from selected/saved places.

Within `MapTab`, use stack screens:

- `MapScreen`
- `DeckGalleryScreen`
- `DiscoverScreen`
- `PlaceGalleryScreen`

Back behavior:

- Deck Gallery returns to Map.
- Discover returns to Deck Gallery.
- Place Gallery returns to Discover.
- Saved and Route are reachable from tabs and from CTA actions after place selection.

## Domain Model

Keep existing place ID based storage. Add the minimum model needed for region/deck selection:

- `Region`: canonical target area such as `seongsu`, `yongsan_hbc`, `yeonnam_mangwon`.
- `Deck`: belongs to one region, has title, copy, tags, display order, and card visual metadata.
- `DeckPlace`: relation between deck and place, with display order and optional featured flag.
- `ActiveDeckSession`: current access-code specific session containing `regionId`, `deckId`, seen `placeIds`, and selected `placeIds`.

Rules:

- Places remain canonical. Do not duplicate place names/copy into saved/session records.
- Saved places store `placeId` only.
- Route reads selected/saved `placeId` values and resolves canonical places at render time.
- Do not claim optimal routing. Use language like "방문하기 좋은 순서".

## Data Scope For MVP

Seed the MVP with the three target regions:

- 성수
- 용산·후암·해방촌
- 연남·망원

Deck data should be expandable to `3 regions x 30 decks = 90 decks`, but the initial app implementation can include a smaller representative fixture set as long as the structure supports all 90 without schema changes.

The first implementation can use generated gradients or remote placeholder photos. Real venue images can be swapped later through the same `coverImageUrl` fields.

## Screen Responsibilities

### Access Code

Existing access-code logic stays. Fix broken Korean strings. States:

- Default
- Invalid code
- Checking/loading
- Inactive code

On success, navigate to Map.

### Map

Shows a fixed Seoul-style map surface with three region pins. It does not need a live map API for MVP.

Pin tap behavior:

- Highlight selected pin.
- Navigate to Deck Gallery for that region, or show a small selected-region state before navigation if needed.

### Deck Gallery

Displays full-screen vertical deck cards for the selected region. Deck cards are not filters. Tapping a deck starts Discover for that deck.

States:

- Region has decks
- Region has no active decks
- Loading
- Network/storage error

### Discover

Shows one card at a time from the selected deck's places. Save/skip actions mark places as selected or skipped in the active session and advance the card.

When the deck is finished:

- Show finished state.
- CTA goes to Place Gallery for review/final selection.

### Place Gallery

Shows the deck's places in a gallery layout and allows final selection toggles. Minimum selection is two places for Route.

States:

- One or more selected
- Zero selected
- Below minimum

CTA persists the final selected place IDs and navigates to Saved. Route remains available through the Route tab once at least two places are selected.

### Saved

Bright background. Shows saved/selected places for the access code. Empty state uses the bright Figma state.

### Route

Bright background. Shows selected places in a simple visit order. Route segments can open Naver Map links for each place/segment.

## Implementation Boundaries

Do now:

- Add the navigation flow.
- Add minimum domain types and fixtures.
- Fix Korean mojibake in visible UI strings touched by this work.
- Build reusable UI primitives for cards, chips, top bars, CTA buttons, and empty/loading states.
- Preserve existing tests where possible and update them to new flow.

Do not do now:

- Live Kakao/Naver route optimization.
- User accounts.
- Device binding.
- Block-list mechanics.
- Admin tooling for all 90 decks.

## Testing

Required checks before completion:

- TypeScript typecheck.
- Existing Jest tests, updated for navigation/domain changes.
- Content validation if fixture schema changes.
- Manual preview on web or Expo where available:
  - Access code accepted.
  - Map pins navigate to deck gallery.
  - Deck card starts Discover.
  - Discover advances and finishes.
  - Place Gallery selection changes CTA state.
  - Saved and Route render without corrupted Korean.

## Open Decisions

Discover writes to the active deck session only. Place Gallery confirmation persists the final selected place IDs to saved storage, then navigates to Saved. Route reads those saved IDs and shows the visit-order preview.
