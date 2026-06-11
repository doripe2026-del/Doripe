# Doripe MVP Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `doripe.kr/app` as a mobile-first web MVP that follows the current Doripe MVP Figma UI, uses real Supabase place data, stores anonymous browser state, tracks behavior events, and supports Pinterest-style place/route share links.

**Architecture:** The public web app lives in `startup-reference/doripe/public/app` as a small static app served by the existing Vercel project. Public data and tracking endpoints live in `doripe-admin/app/api/public/app` so Supabase service-role access stays server-side. Supabase migrations add anonymous web-MVP event tables and extend the existing `shared_links` table for anonymous share links.

**Tech Stack:** Static HTML/CSS/JavaScript, Vercel static routing/functions, Next.js route handlers in `doripe-admin`, Supabase Postgres/Storage, Zod validation, existing Figma MCP/dev-mode measurements.

---

## File Structure

Create or modify these files:

- Create `docs/design/app-web-figma-contract-2026-06-11.json`: exported Figma screen names, node IDs, frame sizes, tokens, and screenshot paths used as the parity contract.
- Create `docs/design/app-web-figma-contract-2026-06-11.md`: human-readable Figma contract summary and screen mapping.
- Create `supabase/migrations/20260611120000_app_web_mvp_events.sql`: anonymous user/session/event tables and `shared_links` anonymous extensions.
- Create `doripe-admin/src/lib/publicAppSchemas.ts`: Zod schemas, event allowlist, response types, Yeonnam-only constants.
- Create `doripe-admin/src/lib/publicAppData.ts`: Supabase reads/writes for bootstrap data, events, local routes, and share links.
- Create `doripe-admin/app/api/public/app/bootstrap/route.ts`: unauthenticated public bootstrap API.
- Create `doripe-admin/app/api/public/app/events/route.ts`: unauthenticated event ingest API.
- Create `doripe-admin/app/api/public/app/share-links/route.ts`: unauthenticated share-link creation API.
- Create `doripe-admin/app/api/public/app/share-links/[shareId]/route.ts`: unauthenticated share-link lookup/open tracking API.
- Modify `startup-reference/doripe/vercel.json`: route `/app`, `/p/:shareId`, and `/r/:shareId`.
- Create `startup-reference/doripe/api/share.ts`: dynamic Open Graph HTML for shared place/route links.
- Create `startup-reference/doripe/public/app/index.html`: app shell matching Figma screens.
- Create `startup-reference/doripe/public/app/styles.css`: Figma-derived mobile UI styling.
- Create `startup-reference/doripe/public/app/config.js`: API base paths, enabled neighborhood config, card limit.
- Create `startup-reference/doripe/public/app/state.js`: local storage anonymous state.
- Create `startup-reference/doripe/public/app/api.js`: bootstrap, event, share API client.
- Create `startup-reference/doripe/public/app/render.js`: screen renderers and Figma-state mapping.
- Create `startup-reference/doripe/public/app/main.js`: controller, event binding, navigation flow.
- Create `startup-reference/doripe/scripts/check-mvp-app.mjs`: smoke checks for static app files and share HTML output.

Do not modify the existing `/admin` UI as part of this plan.

---

### Task 1: Capture The Figma Contract

**Files:**
- Create: `docs/design/app-web-figma-contract-2026-06-11.json`
- Create: `docs/design/app-web-figma-contract-2026-06-11.md`

- [ ] **Step 1: Read the current MVP Figma file**

Use the Figma MCP on the current MVP file:

```text
https://www.figma.com/design/m8pKPheVZTmaVVAUcnr0jh/Doripe-MVP-UI?node-id=179-17
```

Collect these screens/states:

```json
[
  "Neighborhood Select",
  "Discover Filter Setup",
  "Discover Card",
  "Discover Card Detail",
  "Discover Limit / All Seen",
  "Saved Places",
  "Saved Place Detail",
  "Saved Empty",
  "Route Tab",
  "Route Candidate",
  "Route Blocked / Future Feature",
  "Share Open",
  "Top Alert"
]
```

For each screen, return:

```json
{
  "screenName": "Discover Card",
  "figmaNodeId": "node-id-from-figma",
  "frame": { "width": 393, "height": 852 },
  "children": [
    {
      "name": "primary-card",
      "type": "FRAME",
      "x": 0,
      "y": 0,
      "width": 0,
      "height": 0,
      "fills": [],
      "cornerRadius": 0,
      "font": null
    }
  ],
  "screenshotPath": "docs/design/app-web-figma-contract-2026-06-11/discover-card.png"
}
```

Replace each `0` with the actual Figma measurement returned by the MCP. Keep only nodes that affect implementation: frame, top title/subtitle, region filter, bottom nav, card photo, overlay, card actions, top alert, route panels, saved grid/list.

- [ ] **Step 2: Save the machine-readable contract**

Create `docs/design/app-web-figma-contract-2026-06-11.json` with this shape:

```json
{
  "sourceFile": "Doripe MVP UI",
  "sourceUrl": "https://www.figma.com/design/m8pKPheVZTmaVVAUcnr0jh/Doripe-MVP-UI?node-id=179-17",
  "capturedAt": "2026-06-11",
  "viewport": { "width": 393, "height": 852 },
  "rules": [
    "Figma is the visual source of truth.",
    "Only Yeonnam-dong is active in the web MVP.",
    "Do not invent visual styles outside the current Figma system."
  ],
  "screens": []
}
```

Populate `screens` with the measured Figma data from Step 1.

- [ ] **Step 3: Save the human-readable contract**

Create `docs/design/app-web-figma-contract-2026-06-11.md`:

```markdown
# Doripe Web MVP Figma Contract

Source: https://www.figma.com/design/m8pKPheVZTmaVVAUcnr0jh/Doripe-MVP-UI?node-id=179-17

## Implementation Rule

The web app must match the captured Figma screens. CSS values come from the JSON contract, not visual guessing.

## Product Overrides

- The first screen is neighborhood selection.
- Only Yeonnam-dong is active.
- Seongsu and Yongsan/Huam/Haebangchon are disabled and show the top alert.
- Mangwon is not active in the MVP feed.

## Screen Map

| Figma screen | Web route/state | Notes |
| --- | --- | --- |
| Neighborhood Select | `screen=region` | Yeonnam active only |
| Discover Card | `screen=discover` | Real place data |
| Discover Card Detail | `screen=placeDetail` | Same card, detail state |
| Saved Places | `tab=saved` | Local saved IDs |
| Route Tab | `tab=route` | Route intent and selection |
| Share Open | `shareOpen=true` | Native share or copy fallback |
```

- [ ] **Step 4: Verify the contract has no empty screens**

Run:

```bash
node -e "const c=require('./docs/design/app-web-figma-contract-2026-06-11.json'); if (!Array.isArray(c.screens) || c.screens.length < 8) process.exit(1); for (const s of c.screens) { if (!s.screenName || !s.figmaNodeId || !s.frame?.width || !s.frame?.height) process.exit(1); }"
```

Expected: command exits with status `0`.

- [ ] **Step 5: Commit**

```bash
git add docs/design/app-web-figma-contract-2026-06-11.json docs/design/app-web-figma-contract-2026-06-11.md
git commit -m "docs: capture web MVP Figma contract"
```

---

### Task 2: Add Supabase Tables For Anonymous Web MVP Events

**Files:**
- Create: `supabase/migrations/20260611120000_app_web_mvp_events.sql`

- [ ] **Step 1: Create the migration**

Add this SQL:

```sql
create table if not exists public.app_anonymous_users (
  id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  session_count integer not null default 0,
  first_referrer text not null default '',
  first_user_agent text not null default '',
  check (char_length(id) between 12 and 80)
);

create table if not exists public.app_sessions (
  id text primary key,
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_path text not null default '/app',
  referrer text not null default '',
  user_agent text not null default '',
  check (char_length(id) between 12 and 120)
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  session_id text references public.app_sessions(id) on delete set null,
  event_name text not null,
  screen text not null default '',
  place_id text references public.places(id) on delete set null,
  route_id uuid,
  share_id text,
  neighborhood_id text references public.neighborhoods(id) on delete set null,
  category_id text references public.categories(id) on delete set null,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  client_created_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_saved_places (
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  place_id text not null references public.places(id) on delete cascade,
  state text not null check (state in ('saved', 'skipped', 'unsaved')),
  saved_count integer not null default 0,
  skipped_count integer not null default 0,
  first_saved_at timestamptz,
  last_action_at timestamptz not null default now(),
  primary key (anonymous_user_id, place_id)
);

create table if not exists public.app_routes (
  id uuid primary key default gen_random_uuid(),
  anonymous_user_id text not null references public.app_anonymous_users(id) on delete cascade,
  region_id text references public.regions(id) on update cascade,
  neighborhood_id text references public.neighborhoods(id) on update cascade,
  title text not null,
  place_ids text[] not null,
  status text not null default 'draft' check (status in ('draft', 'blocked', 'saved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(place_ids, 1) >= 2)
);

alter table public.shared_links
  add column if not exists anonymous_user_id text references public.app_anonymous_users(id) on delete set null;

alter table public.shared_links
  add column if not exists open_count integer not null default 0;

create index if not exists app_anonymous_users_last_seen_idx
  on public.app_anonymous_users(last_seen_at desc);

create index if not exists app_sessions_user_started_idx
  on public.app_sessions(anonymous_user_id, started_at desc);

create index if not exists app_events_user_created_idx
  on public.app_events(anonymous_user_id, created_at desc);

create index if not exists app_events_name_created_idx
  on public.app_events(event_name, created_at desc);

create index if not exists app_events_place_created_idx
  on public.app_events(place_id, created_at desc);

create index if not exists app_saved_places_state_updated_idx
  on public.app_saved_places(state, last_action_at desc);

create index if not exists app_routes_user_created_idx
  on public.app_routes(anonymous_user_id, created_at desc);

create index if not exists shared_links_anonymous_user_idx
  on public.shared_links(anonymous_user_id, created_at desc);

alter table public.app_anonymous_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_events enable row level security;
alter table public.app_saved_places enable row level security;
alter table public.app_routes enable row level security;
```

- [ ] **Step 2: Run migration locally or against linked Supabase**

Run from repo root:

```bash
supabase db push
```

Expected: migration applies without SQL errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611120000_app_web_mvp_events.sql
git commit -m "feat: add web MVP event tables"
```

---

### Task 3: Add Public App Schemas And Data Helpers

**Files:**
- Create: `doripe-admin/src/lib/publicAppSchemas.ts`
- Create: `doripe-admin/src/lib/publicAppData.ts`

- [ ] **Step 1: Create `publicAppSchemas.ts`**

Add:

```ts
import { z } from "zod";

export const APP_CARD_ACTION_LIMIT = 12;
export const ACTIVE_WEB_NEIGHBORHOOD_NAME = "연남";
export const ACTIVE_WEB_NEIGHBORHOOD_ID_HINTS = ["yeonnam", "yeonnam-mangwon", "hongdae-yeonnam-mangwon"];
export const DISABLED_WEB_NEIGHBORHOODS = [
  { id: "seongsu", label: "성수" },
  { id: "yongsan-huam-haebangchon", label: "용산·후암·해방촌" },
] as const;

export const appEventNames = [
  "app_open",
  "session_start",
  "session_heartbeat",
  "neighborhood_select",
  "disabled_neighborhood_tap",
  "discover_card_view",
  "discover_photo_next",
  "discover_photo_previous",
  "place_save",
  "place_skip",
  "place_detail_open",
  "saved_tab_open",
  "saved_place_open",
  "place_unsave",
  "route_tab_open",
  "route_place_select",
  "route_create_attempt",
  "route_create_blocked",
  "share_button_tap",
  "share_link_created",
  "share_link_open",
  "shared_place_open",
  "shared_route_open",
  "external_map_open",
  "error_shown"
] as const;

export const anonymousIdSchema = z.string().trim().min(12).max(80).regex(/^[a-zA-Z0-9_-]+$/);
export const sessionIdSchema = z.string().trim().min(12).max(120).regex(/^[a-zA-Z0-9_-]+$/);
export const safeTextSchema = z.string().trim().max(500);

export const appEventPayloadSchema = z.object({
  anonymousUserId: anonymousIdSchema,
  sessionId: sessionIdSchema.optional().nullable(),
  eventName: z.enum(appEventNames),
  screen: z.string().trim().max(80).optional().default(""),
  placeId: z.string().trim().max(80).optional().nullable(),
  routeId: z.string().uuid().optional().nullable(),
  shareId: z.string().trim().max(80).optional().nullable(),
  neighborhoodId: z.string().trim().max(80).optional().nullable(),
  categoryId: z.string().trim().max(80).optional().nullable(),
  durationMs: z.number().int().min(0).max(86_400_000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
  clientCreatedAt: z.string().datetime().optional().nullable()
});

export const shareLinkPayloadSchema = z.object({
  anonymousUserId: anonymousIdSchema,
  type: z.enum(["place", "route"]),
  placeId: z.string().trim().max(80).optional().nullable(),
  placeIds: z.array(z.string().trim().max(80)).max(12).optional().default([]),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(240).optional().default("")
}).refine((value) => {
  if (value.type === "place") return Boolean(value.placeId);
  return value.placeIds.length >= 2;
}, { message: "Invalid share target" });

export type AppEventPayload = z.infer<typeof appEventPayloadSchema>;
export type ShareLinkPayload = z.infer<typeof shareLinkPayloadSchema>;
```

- [ ] **Step 2: Create `publicAppData.ts`**

Implement these exported functions:

```ts
import { randomBytes } from "crypto";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import {
  ACTIVE_WEB_NEIGHBORHOOD_NAME,
  APP_CARD_ACTION_LIMIT,
  DISABLED_WEB_NEIGHBORHOODS,
  AppEventPayload,
  ShareLinkPayload
} from "./publicAppSchemas";

type PublicPlacePhoto = {
  id: string;
  public_url: string;
  display_order: number;
  photo_type: string;
  permission_status: string;
};

type PublicPlaceRow = {
  id: string;
  name: string;
  status: string;
  neighborhood_id: string;
  sub_area: string;
  category_id: string;
  short_copy: string;
  mood_tags: string[];
  best_for: string[];
  address: string;
  naver_place_url: string;
  cover_photo_id: string | null;
  cover_image_url: string;
  image_urls: string[];
  place_photos?: PublicPlacePhoto[];
};

function publicPlaceImages(place: PublicPlaceRow): string[] {
  const photoUrls = (place.place_photos ?? [])
    .filter((photo) => photo.permission_status === "approved")
    .filter((photo) => photo.photo_type === "cover" || photo.photo_type === "gallery")
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((photo) => photo.public_url)
    .filter(Boolean);
  const merged = [place.cover_image_url, ...photoUrls, ...(place.image_urls ?? [])].filter(Boolean);
  return Array.from(new Set(merged)).slice(0, 5);
}

function isYeonnamPlace(place: PublicPlaceRow, neighborhoodName: string): boolean {
  const haystack = [neighborhoodName, place.sub_area, place.address].join(" ");
  return haystack.includes("연남");
}

function shareId(): string {
  return randomBytes(7).toString("base64url");
}

export async function loadPublicAppBootstrap() {
  const supabase = createSupabaseAdminClient();
  const [placesResult, neighborhoodsResult, categoriesResult, regionsResult] = await Promise.all([
    supabase
      .from("places")
      .select("id,name,status,neighborhood_id,sub_area,category_id,short_copy,mood_tags,best_for,address,naver_place_url,cover_photo_id,cover_image_url,image_urls,place_photos!place_photos_place_id_fkey(id,public_url,display_order,photo_type,permission_status)")
      .eq("status", "ready")
      .eq("photo_qa_status", "approved")
      .eq("qa_status", "ready")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("neighborhoods").select("id,name,display_order,status").eq("status", "active").order("display_order"),
    supabase.from("categories").select("id,name,display_order,status").eq("status", "active").order("display_order"),
    supabase.from("regions").select("id,name,short_name,display_order,status").eq("status", "active").order("display_order")
  ]);

  const error = placesResult.error ?? neighborhoodsResult.error ?? categoriesResult.error ?? regionsResult.error;
  if (error) throw new Error(error.message);

  const neighborhoods = neighborhoodsResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const neighborhoodById = new Map(neighborhoods.map((neighborhood) => [neighborhood.id, neighborhood]));
  const yeonnamPlaces = ((placesResult.data ?? []) as PublicPlaceRow[])
    .filter((place) => {
      const neighborhoodName = neighborhoodById.get(place.neighborhood_id)?.name ?? "";
      return isYeonnamPlace(place, neighborhoodName) && publicPlaceImages(place).length > 0;
    })
    .map((place) => {
      const neighborhood = neighborhoodById.get(place.neighborhood_id);
      const category = categoryById.get(place.category_id);
      return {
        id: place.id,
        name: place.name,
        neighborhoodId: place.neighborhood_id,
        neighborhoodName: neighborhood?.name ?? ACTIVE_WEB_NEIGHBORHOOD_NAME,
        categoryId: place.category_id,
        categoryName: category?.name ?? "미분류",
        subArea: place.sub_area,
        shortCopy: place.short_copy,
        moodTags: place.mood_tags ?? [],
        bestFor: place.best_for ?? [],
        address: place.address,
        naverPlaceUrl: place.naver_place_url,
        coverPhotoId: place.cover_photo_id,
        coverImageUrl: place.cover_image_url,
        images: publicPlaceImages(place)
      };
    });

  return {
    config: { cardActionLimit: APP_CARD_ACTION_LIMIT, activeNeighborhoodLabel: ACTIVE_WEB_NEIGHBORHOOD_NAME },
    neighborhoods: [
      ...DISABLED_WEB_NEIGHBORHOODS.map((item) => ({ ...item, enabled: false })),
      { id: "yeonnam", label: ACTIVE_WEB_NEIGHBORHOOD_NAME, enabled: true }
    ],
    categories,
    regions: regionsResult.data ?? [],
    places: yeonnamPlaces
  };
}

export async function recordAppEvent(payload: AppEventPayload, headers: Headers) {
  const supabase = createSupabaseAdminClient();
  const userAgent = headers.get("user-agent") ?? "";
  const referrer = headers.get("referer") ?? "";

  await supabase.from("app_anonymous_users").upsert({
    id: payload.anonymousUserId,
    last_seen_at: new Date().toISOString(),
    first_referrer: referrer,
    first_user_agent: userAgent
  }, { onConflict: "id" });

  if (payload.sessionId) {
    await supabase.from("app_sessions").upsert({
      id: payload.sessionId,
      anonymous_user_id: payload.anonymousUserId,
      last_seen_at: new Date().toISOString(),
      entry_path: "/app",
      referrer,
      user_agent: userAgent
    }, { onConflict: "id" });
  }

  const { error } = await supabase.from("app_events").insert({
    anonymous_user_id: payload.anonymousUserId,
    session_id: payload.sessionId ?? null,
    event_name: payload.eventName,
    screen: payload.screen,
    place_id: payload.placeId ?? null,
    route_id: payload.routeId ?? null,
    share_id: payload.shareId ?? null,
    neighborhood_id: payload.neighborhoodId ?? null,
    category_id: payload.categoryId ?? null,
    duration_ms: payload.durationMs ?? null,
    metadata: payload.metadata,
    client_created_at: payload.clientCreatedAt ?? null
  });
  if (error) throw new Error(error.message);
}

export async function createPublicShareLink(payload: ShareLinkPayload) {
  const bootstrap = await loadPublicAppBootstrap();
  const placeById = new Map(bootstrap.places.map((place) => [place.id, place]));
  const firstPlace = payload.type === "place"
    ? placeById.get(payload.placeId ?? "")
    : placeById.get(payload.placeIds[0] ?? "");
  if (!firstPlace) throw new Error("공유할 수 있는 장소를 찾을 수 없습니다.");

  const id = shareId();
  const title = payload.title || (payload.type === "place" ? firstPlace.name : `${firstPlace.neighborhoodName} 루트`);
  const description = payload.description || firstPlace.shortCopy || "Doripe에서 이 장소를 확인해보세요.";
  const coverImageUrl = firstPlace.images[0] || firstPlace.coverImageUrl || "";
  const regionId = (bootstrap.regions[0]?.id as string | undefined) ?? "seoul";

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("shared_links").insert({
    id,
    anonymous_user_id: payload.anonymousUserId,
    content_type: payload.type,
    region_id: regionId,
    title,
    cover_image_url: coverImageUrl,
    place_id: payload.type === "place" ? payload.placeId : null,
    place_ids: payload.type === "route" ? payload.placeIds : [],
    payload: { description, webMvp: true }
  });
  if (error) throw new Error(error.message);

  return {
    id,
    type: payload.type,
    url: payload.type === "place" ? `https://doripe.kr/p/${id}` : `https://doripe.kr/r/${id}`,
    title,
    description,
    imageUrl: coverImageUrl
  };
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd doripe-admin
npm run typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 4: Commit**

```bash
git add doripe-admin/src/lib/publicAppSchemas.ts doripe-admin/src/lib/publicAppData.ts
git commit -m "feat: add public app data helpers"
```

---

### Task 4: Add Admin Public APIs

**Files:**
- Create: `doripe-admin/app/api/public/app/bootstrap/route.ts`
- Create: `doripe-admin/app/api/public/app/events/route.ts`
- Create: `doripe-admin/app/api/public/app/share-links/route.ts`
- Create: `doripe-admin/app/api/public/app/share-links/[shareId]/route.ts`

- [ ] **Step 1: Create bootstrap route**

```ts
import { NextResponse } from "next/server";
import { loadPublicAppBootstrap } from "../../../../../src/lib/publicAppData";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadPublicAppBootstrap();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Bootstrap failed"
    }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create event route**

```ts
import { NextResponse } from "next/server";
import { recordAppEvent } from "../../../../../src/lib/publicAppData";
import { appEventPayloadSchema } from "../../../../../src/lib/publicAppSchemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = appEventPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  try {
    await recordAppEvent(parsed.data, request.headers);
    return NextResponse.json({ ok: true }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Event ingest failed"
    }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create share creation route**

```ts
import { NextResponse } from "next/server";
import { createPublicShareLink, recordAppEvent } from "../../../../../src/lib/publicAppData";
import { shareLinkPayloadSchema } from "../../../../../src/lib/publicAppSchemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = shareLinkPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  try {
    const share = await createPublicShareLink(parsed.data);
    await recordAppEvent({
      anonymousUserId: parsed.data.anonymousUserId,
      eventName: "share_link_created",
      metadata: { type: parsed.data.type, shareId: share.id },
      screen: parsed.data.type === "place" ? "discover" : "route"
    }, request.headers);
    return NextResponse.json({ ok: true, share }, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Share link creation failed"
    }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create share lookup route**

```ts
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../src/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await context.params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shared_links")
    .select("*")
    .eq("id", shareId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: "Share link not found" }, { status: 404 });

  await supabase
    .from("shared_links")
    .update({ open_count: Number(data.open_count ?? 0) + 1 })
    .eq("id", shareId);

  return NextResponse.json({ share: data }, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
```

- [ ] **Step 5: Run admin typecheck**

```bash
cd doripe-admin
npm run typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 6: Commit**

```bash
git add doripe-admin/app/api/public/app doripe-admin/src/lib/publicAppData.ts doripe-admin/src/lib/publicAppSchemas.ts
git commit -m "feat: add public web app APIs"
```

---

### Task 5: Add Public `/app` Shell And App State

**Files:**
- Create: `startup-reference/doripe/public/app/index.html`
- Create: `startup-reference/doripe/public/app/styles.css`
- Create: `startup-reference/doripe/public/app/config.js`
- Create: `startup-reference/doripe/public/app/state.js`
- Create: `startup-reference/doripe/public/app/api.js`
- Create: `startup-reference/doripe/public/app/render.js`
- Create: `startup-reference/doripe/public/app/main.js`

- [ ] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Doripe</title>
    <link rel="icon" href="/favicon.png" />
    <link rel="stylesheet" href="/app/styles.css" />
  </head>
  <body>
    <main id="app" class="app-shell" aria-live="polite">
      <section class="screen screen-loading">
        <div class="brand-mark" aria-hidden="true"></div>
        <p>도리페를 여는 중...</p>
      </section>
    </main>
    <script type="module" src="/app/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `config.js`**

```js
export const CONFIG = {
  adminApiBase: "/admin/api/public/app",
  cardActionLimit: 12,
  activeNeighborhoodId: "yeonnam",
  activeNeighborhoodLabel: "연남",
  disabledNeighborhoodMessage: "이 동네는 곧 열릴 예정이에요.",
  storageKey: "doripe_app_state_v1",
  anonymousIdKey: "doripe_app_anonymous_id",
  sessionIdKey: "doripe_app_session_id"
};
```

- [ ] **Step 3: Create `state.js`**

```js
import { CONFIG } from "./config.js";

function randomId(prefix) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getAnonymousId() {
  let id = localStorage.getItem(CONFIG.anonymousIdKey);
  if (!id) {
    id = randomId("anon");
    localStorage.setItem(CONFIG.anonymousIdKey, id);
  }
  return id;
}

export function getSessionId() {
  let id = sessionStorage.getItem(CONFIG.sessionIdKey);
  if (!id) {
    id = randomId("sess");
    sessionStorage.setItem(CONFIG.sessionIdKey, id);
  }
  return id;
}

export function initialState() {
  return {
    screen: "region",
    tab: "discover",
    selectedNeighborhoodId: CONFIG.activeNeighborhoodId,
    selectedPlaceId: null,
    currentIndex: 0,
    currentPhotoIndex: 0,
    cardActionCount: 0,
    savedPlaceIds: [],
    skippedPlaceIds: [],
    routePlaceIds: [],
    alert: null,
    shareOpen: false,
    sharedContext: null
  };
}

export function loadState() {
  return { ...initialState(), ...readJson(CONFIG.storageKey, {}) };
}

export function saveState(state) {
  writeJson(CONFIG.storageKey, state);
}

export function rememberSavedPlace(state, placeId) {
  return {
    ...state,
    savedPlaceIds: Array.from(new Set([...state.savedPlaceIds, placeId])),
    skippedPlaceIds: state.skippedPlaceIds.filter((id) => id !== placeId),
    cardActionCount: state.cardActionCount + 1,
    currentPhotoIndex: 0
  };
}

export function rememberSkippedPlace(state, placeId) {
  return {
    ...state,
    skippedPlaceIds: Array.from(new Set([...state.skippedPlaceIds, placeId])),
    savedPlaceIds: state.savedPlaceIds.filter((id) => id !== placeId),
    cardActionCount: state.cardActionCount + 1,
    currentPhotoIndex: 0
  };
}
```

- [ ] **Step 4: Create `api.js`**

```js
import { CONFIG } from "./config.js";
import { getAnonymousId, getSessionId } from "./state.js";

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);
  return data;
}

export function loadBootstrap() {
  return jsonFetch(`${CONFIG.adminApiBase}/bootstrap`);
}

export function track(eventName, payload = {}) {
  return jsonFetch(`${CONFIG.adminApiBase}/events`, {
    method: "POST",
    body: JSON.stringify({
      anonymousUserId: getAnonymousId(),
      sessionId: getSessionId(),
      eventName,
      screen: payload.screen || "",
      placeId: payload.placeId || null,
      routeId: payload.routeId || null,
      shareId: payload.shareId || null,
      neighborhoodId: payload.neighborhoodId || null,
      categoryId: payload.categoryId || null,
      durationMs: payload.durationMs || null,
      metadata: payload.metadata || {},
      clientCreatedAt: new Date().toISOString()
    })
  }).catch(() => ({ ok: false }));
}

export function createShareLink(payload) {
  return jsonFetch(`${CONFIG.adminApiBase}/share-links`, {
    method: "POST",
    body: JSON.stringify({ anonymousUserId: getAnonymousId(), ...payload })
  });
}
```

- [ ] **Step 5: Create `styles.css` from Figma contract**

Use `docs/design/app-web-figma-contract-2026-06-11.json` for exact values. The first pass must include these classes:

```css
:root {
  --doripe-green: #26c47a;
  --doripe-ink: #08111f;
  --doripe-muted: #6f7682;
  --doripe-bg: #faf8f1;
  --doripe-card: #ffffff;
  --doripe-line: rgba(8, 17, 31, 0.11);
  --screen-w: 393px;
  --screen-h: 852px;
}

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: #e8e5dc; font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; color: var(--doripe-ink); }
button, input { font: inherit; }
button { border: 0; cursor: pointer; }
.app-shell { width: min(100vw, var(--screen-w)); min-height: 100svh; margin: 0 auto; background: var(--doripe-bg); position: relative; overflow: hidden; }
.screen { min-height: 100svh; padding: max(22px, env(safe-area-inset-top)) 24px max(22px, env(safe-area-inset-bottom)); }
.top-alert { position: fixed; top: max(16px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); width: min(345px, calc(100vw - 32px)); z-index: 20; background: #ffffff; border: 1px solid var(--doripe-line); border-radius: 16px; padding: 13px 16px; box-shadow: 0 16px 44px rgba(8, 17, 31, 0.16); font-weight: 750; }
.bottom-nav { position: fixed; left: 50%; bottom: max(14px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(345px, calc(100vw - 32px)); height: 64px; display: grid; grid-template-columns: repeat(3, 1fr); align-items: center; border-radius: 999px; background: rgba(255,255,255,0.94); border: 1px solid var(--doripe-line); box-shadow: 0 16px 44px rgba(8, 17, 31, 0.12); }
.nav-item { height: 48px; border-radius: 999px; background: transparent; color: #7a808a; font-weight: 800; }
.nav-item.is-active { background: var(--doripe-green); color: #ffffff; }
```

Then add screen-specific classes using measured Figma values:

```css
.region-grid {}
.region-card {}
.region-card.is-disabled {}
.place-card {}
.place-photo {}
.photo-dots {}
.card-action {}
.saved-grid {}
.route-sheet {}
.share-popover {}
```

No class can be left empty in the final implementation. Each selector must contain the measured Figma dimensions, spacing, color, or layout rule it controls.

- [ ] **Step 6: Create `render.js` and `main.js`**

Implement render functions with these exact exports:

```js
export function renderApp(root, model, handlers) {}
export function visibleDiscoverPlaces(places, state) {}
export function currentDiscoverPlace(places, state) {}
```

`renderApp` must support:

```js
[
  "region",
  "discover",
  "placeDetail",
  "saved",
  "savedPlaceDetail",
  "route",
  "routeBlocked",
  "empty"
]
```

`main.js` must:

```js
import { loadBootstrap, track, createShareLink } from "./api.js";
import { loadState, saveState, rememberSavedPlace, rememberSkippedPlace } from "./state.js";
import { CONFIG } from "./config.js";
import { renderApp, currentDiscoverPlace } from "./render.js";

const root = document.getElementById("app");
let state = loadState();
let data = { places: [], neighborhoods: [], categories: [], config: {} };

function commit(nextState) {
  state = nextState;
  saveState(state);
  render();
}

function advanceAfterAction(nextState) {
  const nextIndex = nextState.currentIndex + 1;
  return { ...nextState, currentIndex: nextIndex };
}

const handlers = {
  selectNeighborhood(neighborhood) {
    if (!neighborhood.enabled) {
      track("disabled_neighborhood_tap", { screen: "region", metadata: { neighborhoodId: neighborhood.id } });
      commit({ ...state, alert: CONFIG.disabledNeighborhoodMessage });
      return;
    }
    track("neighborhood_select", { screen: "region", neighborhoodId: neighborhood.id });
    commit({ ...state, screen: "discover", selectedNeighborhoodId: neighborhood.id, alert: null });
  },
  saveCurrentPlace() {
    const place = currentDiscoverPlace(data.places, state);
    if (!place) return;
    track("place_save", { screen: "discover", placeId: place.id, categoryId: place.categoryId, neighborhoodId: place.neighborhoodId });
    commit(advanceAfterAction(rememberSavedPlace(state, place.id)));
  },
  skipCurrentPlace() {
    const place = currentDiscoverPlace(data.places, state);
    if (!place) return;
    track("place_skip", { screen: "discover", placeId: place.id, categoryId: place.categoryId, neighborhoodId: place.neighborhoodId });
    commit(advanceAfterAction(rememberSkippedPlace(state, place.id)));
  },
  nextPhoto() {
    const place = currentDiscoverPlace(data.places, state);
    if (!place) return;
    const next = Math.min((place.images.length || 1) - 1, state.currentPhotoIndex + 1);
    track("discover_photo_next", { screen: "discover", placeId: place.id });
    commit({ ...state, currentPhotoIndex: next });
  },
  previousPhoto() {
    const place = currentDiscoverPlace(data.places, state);
    if (!place) return;
    const next = Math.max(0, state.currentPhotoIndex - 1);
    track("discover_photo_previous", { screen: "discover", placeId: place.id });
    commit({ ...state, currentPhotoIndex: next });
  },
  openPlaceDetail(placeId) {
    track("place_detail_open", { screen: state.tab, placeId });
    commit({ ...state, screen: "placeDetail", selectedPlaceId: placeId });
  },
  setTab(tab) {
    const eventName = tab === "saved" ? "saved_tab_open" : tab === "route" ? "route_tab_open" : "app_open";
    track(eventName, { screen: tab });
    commit({ ...state, tab, screen: tab === "discover" ? "discover" : tab });
  },
  async sharePlace(placeId) {
    track("share_button_tap", { screen: state.screen, placeId });
    const response = await createShareLink({ type: "place", placeId });
    const share = response.share;
    if (navigator.share) {
      await navigator.share({ title: share.title, text: share.description, url: share.url });
    } else {
      await navigator.clipboard.writeText(share.url);
      commit({ ...state, alert: "공유 링크를 복사했어요." });
    }
  },
  createRoute() {
    track("route_create_attempt", { screen: "route", metadata: { placeIds: state.routePlaceIds } });
    commit({ ...state, screen: "routeBlocked" });
  }
};

function render() {
  renderApp(root, { state, data, cardActionLimit: data.config.cardActionLimit || CONFIG.cardActionLimit }, handlers);
}

async function boot() {
  data = await loadBootstrap();
  track("app_open", { screen: "region" });
  track("session_start", { screen: "region" });
  render();
}

boot().catch((error) => {
  root.innerHTML = `<section class="screen"><div class="top-alert">${error.message}</div><button class="primary-button" onclick="location.reload()">다시 시도</button></section>`;
});
```

- [ ] **Step 7: Run static project typecheck**

```bash
cd startup-reference/doripe
npm run typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 8: Commit**

```bash
git add startup-reference/doripe/public/app
git commit -m "feat: add web MVP app shell"
```

---

### Task 6: Add Pinterest-Style Share Pages

**Files:**
- Modify: `startup-reference/doripe/vercel.json`
- Create: `startup-reference/doripe/api/share.ts`

- [ ] **Step 1: Update Vercel rewrites**

Add these rewrites before the `/` rewrite:

```json
{ "source": "/app", "destination": "/app/index.html" },
{ "source": "/app/:path*", "destination": "/app/index.html" },
{ "source": "/p/:shareId", "destination": "/api/share?type=place&shareId=:shareId" },
{ "source": "/r/:shareId", "destination": "/api/share?type=route&shareId=:shareId" }
```

Keep existing `/admin` rewrites first.

- [ ] **Step 2: Create `api/share.ts`**

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adminBaseUrl(request: VercelRequest): string {
  const configured = process.env.DORIPE_ADMIN_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = request.headers.host || "doripe.kr";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/admin/api/public/app`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const type = request.query.type === "route" ? "route" : "place";
  const shareId = Array.isArray(request.query.shareId) ? request.query.shareId[0] : request.query.shareId;
  if (!shareId || !/^[a-zA-Z0-9_-]{6,80}$/.test(shareId)) {
    response.status(404).send("Not found");
    return;
  }

  const lookup = await fetch(`${adminBaseUrl(request)}/share-links/${encodeURIComponent(shareId)}`);
  if (!lookup.ok) {
    response.status(404).send("Not found");
    return;
  }
  const body = await lookup.json();
  const share = body.share || {};
  const title = escapeHtml(share.title || "Doripe에서 이 장소를 확인해보세요");
  const description = escapeHtml(share.payload?.description || "저장하고 싶은 동네 장소를 Doripe에서 확인해보세요.");
  const image = escapeHtml(share.cover_image_url || "https://doripe.kr/og-image.png");
  const url = `https://doripe.kr/${type === "route" ? "r" : "p"}/${encodeURIComponent(shareId)}`;
  const appUrl = `/app?shareType=${type}&shareId=${encodeURIComponent(shareId)}`;

  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "public, max-age=60");
  response.status(200).send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta property="og:site_name" content="Doripe">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f1;color:#08111f;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif}.box{text-align:center;padding:32px}.mark{width:56px;height:56px;margin:0 auto 18px;border-radius:18px;background:#26c47a}</style>
</head>
<body>
  <main class="box">
    <div class="mark"></div>
    <strong>Doripe로 이동 중</strong>
  </main>
  <script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`);
}
```

- [ ] **Step 3: Run main project typecheck**

```bash
cd startup-reference/doripe
npm run typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 4: Commit**

```bash
git add startup-reference/doripe/vercel.json startup-reference/doripe/api/share.ts
git commit -m "feat: add web MVP share pages"
```

---

### Task 7: Add Smoke Checks And Verify Locally

**Files:**
- Create: `startup-reference/doripe/scripts/check-mvp-app.mjs`
- Modify: `startup-reference/doripe/package.json`

- [ ] **Step 1: Add smoke checker**

```js
import { readFileSync } from "node:fs";

const requiredFiles = [
  "public/app/index.html",
  "public/app/styles.css",
  "public/app/config.js",
  "public/app/state.js",
  "public/app/api.js",
  "public/app/render.js",
  "public/app/main.js",
  "api/share.ts",
  "vercel.json"
];

for (const file of requiredFiles) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  if (!text.trim()) throw new Error(`${file} is empty`);
}

const html = readFileSync(new URL("../public/app/index.html", import.meta.url), "utf8");
if (!html.includes("/app/main.js")) throw new Error("index.html does not load main.js");

const config = readFileSync(new URL("../public/app/config.js", import.meta.url), "utf8");
if (!config.includes("activeNeighborhoodLabel: \"연남\"")) throw new Error("Yeonnam must be the only active label");
if (!config.includes("cardActionLimit: 12")) throw new Error("Card action limit must be 12");

const render = readFileSync(new URL("../public/app/render.js", import.meta.url), "utf8");
for (const required of ["region", "discover", "saved", "route", "routeBlocked"]) {
  if (!render.includes(required)) throw new Error(`render.js missing state: ${required}`);
}

const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
for (const route of ["/app", "/p/:shareId", "/r/:shareId"]) {
  if (!vercel.includes(route)) throw new Error(`vercel.json missing route: ${route}`);
}

console.log("MVP app smoke check passed");
```

- [ ] **Step 2: Add npm script**

In `startup-reference/doripe/package.json`, add:

```json
"check:mvp-app": "node scripts/check-mvp-app.mjs"
```

- [ ] **Step 3: Run static smoke checks**

```bash
cd startup-reference/doripe
npm run check:mvp-app
npm run typecheck
```

Expected:

```text
MVP app smoke check passed
```

and TypeScript exits successfully.

- [ ] **Step 4: Run admin checks**

```bash
cd doripe-admin
npm run typecheck
```

Expected: TypeScript exits successfully.

- [ ] **Step 5: Run local preview**

Use two terminals:

```bash
cd doripe-admin
npm run dev
```

```bash
cd startup-reference/doripe
npm run dev
```

Open the public app:

```text
http://localhost:3000/app
```

Verify manually:

- neighborhood selection appears first;
- only Yeonnam is selectable;
- disabled neighborhoods show the top alert;
- real place cards load;
- save advances card and persists after refresh;
- skip advances card;
- left/right photo tap changes only photos;
- 12 card actions show the limit/end state;
- saved tab shows saved places;
- route tab blocks route creation with the Figma future-state copy;
- share button creates a `/p/` link and copies or opens native share;
- `/p/{shareId}` returns an HTML page with `og:title`, `og:description`, and `og:image`.

- [ ] **Step 6: Commit**

```bash
git add startup-reference/doripe/scripts/check-mvp-app.mjs startup-reference/doripe/package.json
git commit -m "test: add web MVP smoke checks"
```

---

### Task 8: Deploy And Verify Production

**Files:**
- No source files unless production verification reveals a defect.

- [ ] **Step 1: Deploy admin API**

```bash
cd doripe-admin
npx vercel --prod --yes
```

Expected: Vercel production deployment succeeds.

- [ ] **Step 2: Deploy public app**

```bash
cd startup-reference/doripe
npx vercel --prod --yes
```

Expected: Vercel production deployment succeeds.

- [ ] **Step 3: Verify production URLs**

Run:

```bash
curl -I https://doripe.kr/app
curl -I https://doripe.kr/admin
curl -s https://doripe.kr/admin/api/public/app/bootstrap | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); if(!Array.isArray(j.places)) process.exit(1); console.log(j.places.length);})"
```

Expected:

- `/app` returns `200`;
- `/admin` returns `200` or an auth/login page response;
- bootstrap returns JSON with `places` array.

- [ ] **Step 4: Verify in browser**

Open:

```text
https://doripe.kr/app
```

Confirm the same manual checklist from Task 7 Step 5.

- [ ] **Step 5: Commit production verification note**

Create `docs/superpowers/plans/2026-06-11-doripe-mvp-web-app-verification.md`:

```markdown
# Doripe MVP Web App Production Verification

Date: 2026-06-11

## Verified

- `https://doripe.kr/app` loaded.
- `https://doripe.kr/admin` still loaded.
- Bootstrap API returned real place data.
- Yeonnam was the only active neighborhood.
- Save, skip, saved tab, route blocked state, and share link creation worked.

## Remaining Product Review

- Pixel parity against Figma should be reviewed on a real phone after the first production deploy.
```

Commit:

```bash
git add docs/superpowers/plans/2026-06-11-doripe-mvp-web-app-verification.md
git commit -m "docs: verify web MVP production deploy"
```

---

## Self-Review

Spec coverage:

- `/app` route: Task 5 and Task 6.
- Figma-as-source: Task 1 and Task 5.
- Neighborhood selection with Yeonnam-only activation: Task 5 and Task 7.
- Real Supabase place data: Task 3 and Task 4.
- No dummy public data: Task 3 filters real `places`; Task 7 checks live bootstrap.
- Anonymous browser cache: Task 5.
- Behavior events: Task 2, Task 3, Task 4.
- Pinterest-style sharing: Task 4 and Task 6.
- Existing admin UI untouched: file structure excludes `doripe-admin/src/components/AdminShell.tsx`.
- Production verification: Task 8.

Type consistency:

- Client sends `anonymousUserId`, `sessionId`, `eventName`, and IDs matching `publicAppSchemas.ts`.
- Server inserts snake_case fields into Supabase.
- Share pages read from `shared_links`, which already exists and is extended by Task 2.

Execution note:

- Use Figma MCP before writing CSS values.
- Use Supabase migration before calling event APIs.
- Keep each task committed before moving to the next task.
