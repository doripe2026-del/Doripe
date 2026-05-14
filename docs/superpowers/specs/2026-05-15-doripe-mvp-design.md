# Doripe 5/31 MVP Design

## Goal

Doripe will ship a first mobile MVP by May 31, 2026. The MVP should feel like a real app, not a loose prototype, while staying small enough for a non-technical team to operate and test.

The release target is:

- Android: Google Play closed test in progress
- iOS: TestFlight or App Store submission-ready build
- User test: at least 20 real testers
- Product proof: users can discover places, save or skip cards, open their saved list, and view a route-like visit order

The MVP is not a full routing engine. It helps users turn saved places into a visit order and then hands each segment off to an external map app for actual navigation.

## Product Scope

### Entry

Users enter with a four-digit numeric access code. There is no signup, password, social login, device lock, or rate-limit blocking in the MVP.

Access code rules:

- A code must exist and be active to enter.
- Inactive codes show a "currently unavailable" state.
- Unknown codes show a "check your code" state.
- Codes are issued per email address.
- Admins can activate or deactivate codes.
- Codes are unique.

### Main Navigation

The app has three bottom tabs:

- Discover
- Saved
- Route

The first screen after code entry is Discover, with a place card immediately visible.

### Discover

Users browse place cards and can do only two primary actions:

- Save
- Skip

The card should show little but feel rich:

- Cover photo
- Place name
- Neighborhood/sub-area
- Category
- One-line editorial copy
- Two or three mood tags

### Saved

Saved shows the places the user has saved. It should support reviewing saved places and opening each place in Naver Map.

### Route

Route shows saved places on a map:

- Numbered pins
- A connecting line in saved order
- Segment list below the map
- Segment-level external navigation buttons

The route wording should avoid promising exact optimization. Preferred language:

> Saved places, connected in a visit-friendly order.

Do not call it "optimal route" in the MVP.

## Neighborhoods And Content

The MVP contains 90 place cards:

- Huam-dong / Haebangchon: 30
- Mullae: 30
- Seochon / Wonseo / Gyedong: 30

Each neighborhood should roughly follow this category mix:

- Cafe: 8
- Food: 7
- Bar: 4
- Local shop: 4
- Culture/exhibition: 3
- Walk/view/place: 4

Photos are collected directly by the team. The standard is Instagram-level visual quality, not rough documentation. Cards without approved cover photos should not appear in the public test feed.

Photo QA rejects:

- Blurry or noisy photos
- Dark photos that hide the place
- Photos dominated by signage only
- Photos with prominent identifiable faces
- Photos with visible license plates
- Unlicensed screenshots or copied images

## Technical Direction

The app is a real mobile app:

- React Native
- Expo
- Expo Go is not part of the main workflow
- Expo Development Build is required
- EAS Build is used for app binaries

The existing React web app can be used as brand/content reference, but the MVP app is a mobile app project.

## Map Direction

The first-choice map implementation is Naver Map in React Native, using `@mj-studio/react-native-naver-map` or an equivalent maintained package.

Because Naver Map in React Native requires native integration, the first implementation task must be technical validation:

- Build a development app
- Display a Naver map
- Render one marker
- Render numbered markers
- Render a connecting line
- Open external navigation for a route segment

Fallbacks if native Naver Map blocks delivery:

1. Naver Map via WebView embed
2. `react-native-maps` as temporary map
3. Static map-like route view with external Naver Map buttons

The fallback must preserve the product flow. The MVP cannot fail solely because the preferred map package fails.

## Data Integrity Principles

The MVP must preserve data integrity from day one.

Rules:

- Store each fact in one canonical place.
- Reference relationships by stable IDs, not copied display strings.
- Avoid duplicating names, neighborhood labels, category labels, or emails across event records.
- Event logs are append-only.
- Display names are resolved at read time from canonical records.
- Duplicate snapshots are allowed only when explicitly needed for analysis, and must be named as snapshots.

Canonical entities:

- `neighborhoods`
- `categories`
- `places`
- `accessCodes`
- `savedPlaces`
- `events`

### Neighborhood

```ts
type Neighborhood = {
  id: string;
  name: string;
  displayOrder: number;
  status: "active" | "inactive";
};
```

### Category

```ts
type Category = {
  id: string;
  name: string;
  displayOrder: number;
  status: "active" | "inactive";
};
```

### Place

```ts
type Place = {
  id: string;
  status: "draft" | "ready" | "inactive";
  neighborhoodId: string;
  subArea: string;
  categoryId: string;
  name: string;
  shortCopy: string;
  moodTags: string[];
  bestFor: string[];
  timeTags: string[];
  routeRole: "start" | "middle" | "finish" | "pause";
  lat: number;
  lng: number;
  address: string;
  nearestStation: string;
  naverPlaceUrl: string;
  coverImageUrl: string;
  imageUrls: string[];
  imageCredit: "team";
  photoQaStatus: "pending" | "approved" | "rejected";
  hoursText: string;
  priceHint: string;
  stayTimeMinutes: number;
  editorialNote: string;
  qaStatus: "draft" | "ready" | "needs_fix";
  lastCheckedAt: string;
};
```

### Access Code

```ts
type AccessCode = {
  id: string;
  email: string;
  code: string;
  status: "active" | "inactive";
  cohort: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

`code` must be unique. Events should reference `accessCodeId`, not email or raw code, unless a short-term debug log explicitly needs the raw code.

### Saved Place

```ts
type SavedPlace = {
  id: string;
  accessCodeId: string;
  placeId: string;
  savedOrder: number;
  createdAt: string;
};
```

Route state is computed from saved places. Do not create a separate route table for MVP unless a later feature needs editable route orders.

### Event

```ts
type EventLog = {
  id: string;
  accessCodeId: string;
  eventName:
    | "code_verified"
    | "place_seen"
    | "place_saved"
    | "place_skipped"
    | "saved_list_opened"
    | "route_opened"
    | "route_segment_clicked";
  placeId?: string;
  segmentFromPlaceId?: string;
  segmentToPlaceId?: string;
  createdAt: string;
};
```

Events should not be edited for normal product behavior.

## Operations

Content operations must run in parallel with development.

Content milestones:

- May 18-21: collect 120 candidates
- May 22-25: collect/directly shoot photos
- May 26-28: select 90 cards and write copy
- May 29-30: coordinate, photo, and QA pass
- May 31: tester release

Development milestones:

- Map technical validation first
- Access code gate
- Discover card flow
- Save/skip persistence
- Saved tab
- Route tab
- Event logging
- Android closed test build
- iOS TestFlight/submission-ready build

## Risks

### Naver Map Native Integration

This is the top technical risk. Validate first and keep fallbacks ready.

### Content QA

Ninety cards with direct photos is ambitious. If content lags, release with fewer ready cards rather than lowering photo quality.

Minimum acceptable public-test content:

- 45 ready cards
- At least 15 per neighborhood
- No unapproved cover photos

### Store Accounts

The team currently has no Apple Developer or Google Play Console accounts. Android production release is not the May 31 target because new Google Play accounts can require closed testing before production access.

## Non-Goals

The MVP will not include:

- Full login/signup
- Social login
- Payment
- Push notifications
- User location tracking
- Real-time public transit routing
- Multi-waypoint walking/transit optimization
- Device lock for access codes
- Rate-limit blocking for wrong access codes
- Editable route planning
- Full admin analytics dashboard

## Definition Of Done

The MVP is done when:

- A tester can install or open the mobile app build.
- A tester can enter a valid four-digit access code.
- A tester can save and skip cards.
- Saved places appear in Saved.
- Route shows saved places with numbered pins and a connecting line, or approved fallback equivalent.
- Segment buttons open external navigation.
- Core events are logged with ID-based relationships.
- Inactive access codes cannot enter.
- At least 20 testers can be managed through issued access codes.
- The app has enough visual polish that it feels like a deliberate first version, not a wireframe.
