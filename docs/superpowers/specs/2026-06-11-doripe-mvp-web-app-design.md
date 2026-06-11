# Doripe MVP Web App Design

## Goal

Build the first web MVP at `doripe.kr/app`.

The web MVP is not a separate redesign. It must implement the current Doripe MVP Figma UI as the visual source of truth. Layout, typography, spacing, colors, icons, card shape, bottom tabs, button states, and screen order should follow Figma as closely as the web platform allows. The only planned UI deviations are the product decisions captured in this spec:

- show a neighborhood selection screen before discovery;
- allow only Yeonnam-dong for this MVP;
- implement web share links that open directly into a shared place or route;
- use browser cache instead of login for user state.

The MVP should let a user open the web app, choose the available neighborhood, browse real place cards, save or skip places, view saved places, attempt route creation, and share places/routes. Every meaningful behavior should be tracked with anonymous IDs so the admin can later report usage without requiring users to log in.

## Non-Goals

- No login, signup, Kakao login, or email login.
- No Kakao Mobility or live route optimization in this phase.
- No full public desktop website experience for shared links; shared links should deep-open the web app content.
- No dummy place data in the public MVP app.
- No admin UI redesign as part of this feature.
- No curator tab in the web MVP unless the current Figma source reintroduces it and the product decision changes.

## Chosen Approach

Use the existing `startup-reference/doripe` Vercel project for the public `/app` web app, and use the existing `doripe-admin` project for Supabase-backed public data/event APIs.

Reasoning:

- `startup-reference/doripe` already owns `doripe.kr` and Vercel routing.
- `doripe-admin` already has the Supabase service-role environment and canonical place-management code.
- Keeping public UI and admin APIs separate avoids exposing admin credentials to the public web app.
- The current admin already has empty states for saved places, created routes, share links, and activity logs, so event data should be shaped to fill those later.

## Routing

Public routes in `startup-reference/doripe`:

- `/app`: web MVP app shell.
- `/app/`: same app shell.
- `/p/:shareId`: shared place landing with Open Graph metadata, then opens the relevant place inside `/app`.
- `/r/:shareId`: shared route landing with Open Graph metadata, then opens the relevant route inside `/app`.

Existing `/admin` rewrites stay untouched.

## Visual Source Of Truth

The current Doripe MVP Figma file is the source of truth for UI implementation.

Implementation rules:

- Do not invent new visual language.
- Do not simplify the UI into generic cards if Figma has a specific screen.
- Use Figma screen names and flow as the implementation map.
- If a required app state is missing in Figma, add a matching state in Figma before treating the app version as final.
- If app UI and Figma disagree, Figma wins unless this spec explicitly says otherwise.
- The web app should be mobile-first and optimized for Android/iPhone browser dimensions.

## Entry Flow

When a user enters `doripe.kr/app`, the first visible screen is the neighborhood selection screen.

Neighborhoods shown:

- Seongsu: visible but disabled.
- Yongsan / Huam / Haebangchon: visible but disabled.
- Yeonnam-dong: active and selectable.

If the current Figma label is `연남·망원`, the MVP implementation should either:

- change the active label to `연남`, or
- keep the visual grouping label only if the data feed is still filtered to Yeonnam-dong places.

Mangwon is not active for this MVP.

Disabled neighborhood behavior:

- tapping a disabled neighborhood does not enter discovery;
- show a top alert using the existing Figma alert style;
- copy: `이 동네는 곧 열릴 예정이에요.`

Selected neighborhood behavior:

- choosing Yeonnam-dong stores the selection in local browser storage;
- discovery opens with Yeonnam-dong place cards only;
- on later visits, the neighborhood screen still appears, but Yeonnam-dong is preselected/available.

## Main App Flow

The app has three core tabs:

- Discover: browse place cards.
- Saved: review saved places and routes.
- Route: create or preview a route attempt from saved/selected places.

The visible tab names, bottom nav icon states, and screen arrangement should follow Figma. If Figma currently labels the route tab as `루트`, use `루트`.

### Discover

Discover uses real place cards from Supabase.

Expected behavior:

- show one place card at a time;
- show 3 to 5 photos per card when available;
- photo dots are centered and match the number of photos;
- tapping right side of the photo advances to the next photo;
- tapping left side returns to the previous photo;
- partial drag/tap should not accidentally advance the photo;
- heart/save action saves the place and advances the card;
- X/skip action skips the place and advances the card;
- info action flips/opens the Figma-defined detail state;
- share action creates a share link for the current place;
- card actions are tracked.

Swipe/card limit:

- a user gets 12 card actions per discovery run;
- both save and skip count toward the 12;
- photo browsing does not count;
- when the user reaches 12, show the Figma limit/end state;
- if the available Yeonnam-dong feed is exhausted before 12, show the all-seen state.

### Saved

Saved reads from local browser storage first.

Expected behavior:

- saved places persist without login on the same browser/device;
- saved places are rendered using the Figma saved-place layout;
- tapping a saved place opens the Figma place-detail state;
- long-press/selection states should follow the Figma saved selection design if implemented;
- unsave/delete updates local storage and sends an event.

Saved routes should use the Figma route saved/detail states when the app has a local ordered route. If the current Figma/product state blocks route creation, the app should show that blocked state and still track route intent.

### Route

Route MVP behavior is route intent and route preview, not true navigation optimization.

Expected behavior:

- users can select saved/available places for route creation;
- selected places retain the order selected by the user;
- if fewer than two places are selected, the route creation button is disabled;
- route creation attempt is tracked;
- if live route generation is unavailable, show the Figma “추후 제공”/blocked state rather than pretending a real route was generated;
- external map opening can use each place’s `naver_place_url` or public map URL when present.

## Data Source

The public app must use real data from the existing Supabase-backed admin system.

Canonical source tables already managed by admin:

- `places`
- `place_photos`
- `categories`
- `neighborhoods`
- `regions`

Public place API should expose only safe fields:

- `id`
- `name`
- `status`
- `neighborhood_id`
- `neighborhood_name`
- `category_id`
- `category_name`
- `sub_area`
- `short_copy`
- `mood_tags`
- `best_for`
- `address`
- `naver_place_url`
- `cover_photo_id`
- `cover_image_url`
- ordered public photo URLs

Do not expose internal QA notes, audit logs, admin-only contact information, unpublished creator/provider metadata, or service-role details.

Public feed filter:

- only `places.status = "ready"`;
- only active categories/neighborhoods;
- only Yeonnam-dong for the first MVP;
- places without usable photos can appear only if Figma has a graceful placeholder state, otherwise exclude them.

If the database only has a combined `연남·망원` neighborhood, the API must still filter the first MVP feed to Yeonnam-dong using `sub_area`, address, or another available canonical field. Do not silently include Mangwon cards.

## Browser State

Because there is no login, the browser stores an anonymous profile.

Local storage keys:

- `doripe_app_anonymous_id`
- `doripe_app_session_id`
- `doripe_app_state_v1`

Stored state:

- selected neighborhood;
- saved place IDs;
- skipped place IDs;
- current card progress;
- card action count for the 12-card limit;
- route draft place IDs;
- opened shared place/route IDs.

The app must tolerate cache loss. If local storage is empty, create a new anonymous profile and show the neighborhood selection screen.

## Behavior Tracking

All meaningful actions should be sent to public admin API endpoints and stored append-only.

Minimum events:

- `app_open`
- `session_start`
- `session_heartbeat`
- `neighborhood_select`
- `disabled_neighborhood_tap`
- `discover_card_view`
- `discover_photo_next`
- `discover_photo_previous`
- `place_save`
- `place_skip`
- `place_detail_open`
- `saved_tab_open`
- `saved_place_open`
- `place_unsave`
- `route_tab_open`
- `route_place_select`
- `route_create_attempt`
- `route_create_blocked`
- `share_button_tap`
- `share_link_created`
- `share_link_open`
- `shared_place_open`
- `shared_route_open`
- `external_map_open`
- `error_shown`

Event records should reference stable IDs. Do not duplicate display names unless the field is explicitly a snapshot for analytics/debugging.

Recommended tables:

- `app_anonymous_users`
- `app_sessions`
- `app_events`
- `app_saved_places`
- `app_routes`
- `app_share_links`

The implementation must create migrations or setup SQL for these tables if they do not already exist. The admin UI does not need to be changed in the first pass, but the data model should support the existing admin sections later:

- Dashboard saved count;
- Dashboard route creation count;
- Funnel progression;
- Share link performance;
- Saved places;
- Created routes;
- Activity logs.

## Public API Design

Admin-backed public APIs:

- `GET /admin/api/public/app/bootstrap`
- `POST /admin/api/public/app/events`
- `POST /admin/api/public/app/share-links`
- `GET /admin/api/public/app/share-links/:shareId`

`bootstrap` returns:

- active neighborhood list with only Yeonnam-dong enabled;
- Yeonnam-dong places;
- category/tag metadata needed for rendering;
- app config such as card action limit.

`events` accepts:

- anonymous user ID;
- session ID;
- event name;
- screen;
- related IDs;
- metadata JSON;
- client timestamp.

The server should add its own `created_at` timestamp and validate event names.

`share-links` creates a short share ID for:

- place share;
- route share.

Share links should store enough snapshot data to render Open Graph previews even if the place text changes later:

- share type;
- target place/route IDs;
- title;
- description;
- image URL;
- creator anonymous ID;
- created timestamp.

## Sharing

The intended sharing behavior is Pinterest-like.

For a place:

- user taps share on a place card;
- server creates `https://doripe.kr/p/{shareId}`;
- browser opens native `navigator.share()` when available;
- fallback copies the link;
- receiving user opens the link;
- link preview shows Doripe title, place name, short copy, and representative photo;
- landing opens the `/app` UI directly into that place card/detail.

For a route:

- user taps share from the route saved/preview state;
- server creates `https://doripe.kr/r/{shareId}`;
- preview shows route title, first place image or generated route image, and route summary;
- opening the link loads `/app` with the shared route context.

Open Graph fields:

- `og:site_name = Doripe`
- `og:title`
- `og:description`
- `og:image`
- `og:url`
- `twitter:card = summary_large_image`

The visible web page behind `/p/:shareId` and `/r/:shareId` can be minimal because the main experience is `/app`, but the metadata must be server-rendered so KakaoTalk, SMS, Instagram DM, and similar apps can generate previews.

## Error Handling

Use the existing Figma top-alert/error style.

Cases:

- data loading fails: show retry action;
- event tracking fails: do not block the user;
- share creation fails: show a share error alert;
- no Yeonnam-dong ready places: show an empty state, do not inject dummy cards;
- disabled neighborhood tap: show coming-soon alert;
- local storage unavailable: keep in-memory state and warn only if persistence fails.

## Data Integrity Rules

- `places`, `categories`, and `neighborhoods` remain canonical.
- Public app state references place/category/neighborhood IDs, not copied names.
- Event logs are append-only.
- Saved place state is upserted by anonymous user ID + place ID.
- Share links may store display snapshots because previews need stable text/images.
- Route drafts store ordered place IDs.
- If a tag/category name changes in admin, the public app should reflect it on next bootstrap unless the field is part of an intentional share snapshot.

## Security And Privacy

- No service-role key in the public app.
- Public APIs validate payload sizes and event names.
- Public data endpoint exposes only published/safe fields.
- Anonymous ID is not a login identity and should not be treated as a user account.
- Do not collect precise personal data in the MVP web app.
- Avoid storing full IP addresses in app tables unless required by existing Vercel/server logs.

## Testing And Verification

Local verification:

- `startup-reference/doripe` typecheck;
- `doripe-admin` typecheck;
- `/app` loads in local Vercel dev;
- `/app` shows neighborhood selection first;
- only Yeonnam-dong is selectable;
- disabled neighborhoods show alert;
- real place cards load from API;
- no dummy place data is rendered;
- save/skip/photo/share buttons work;
- 12-card limit works;
- saved places survive refresh in the same browser;
- event API receives key actions;
- `/p/:shareId` returns Open Graph metadata;
- `/r/:shareId` returns Open Graph metadata.

Production verification after deploy:

- `https://doripe.kr/app` loads;
- `https://doripe.kr/admin` still loads;
- existing home/notify pages still load;
- shared place link previews contain the correct title/image;
- shared route link previews contain the correct title/image;
- admin API does not expose admin-only fields.

## Open Implementation Notes

The app can be implemented as a static mobile-first HTML/CSS/TypeScript bundle inside `startup-reference/doripe`, matching the current project style. If a build step becomes necessary, it should stay small and not disturb the existing static pages.

Before implementation, create a detailed plan that maps each Figma screen/state to code modules and API endpoints.
