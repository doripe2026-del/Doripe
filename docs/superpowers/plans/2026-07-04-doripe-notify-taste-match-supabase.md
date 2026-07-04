# Doripe Notify Taste Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/notify` as a low-friction place taste test that saves email/results in Supabase and supports friend compatibility through shared links.

**Architecture:** Keep `/notify.html` as a static Vercel page. Add two Vercel serverless APIs as a service-role gateway to new Supabase tables. Leave all legacy waitlist tables untouched.

**Tech Stack:** Static HTML/CSS/vanilla JS, Vercel Functions, TypeScript, Zod, `@supabase/supabase-js`, Supabase Postgres/RLS.

---

## File Structure

- Create: `supabase/migrations/20260704000100_notify_taste_match.sql`
  - Owns new Supabase tables and RLS.
- Modify: `startup-reference/doripe/package.json`
  - Declares `@supabase/supabase-js`.
- Modify: `startup-reference/doripe/package-lock.json`
  - Lockfile update from `npm install`.
- Modify: `startup-reference/doripe/.env.example`
  - Documents required Supabase env vars.
- Modify: `startup-reference/doripe/lib/schema.ts`
  - Adds request schemas for notify taste APIs.
- Create: `startup-reference/doripe/lib/notify-taste.ts`
  - Supabase client, character logic, compatibility logic, slug generation, response mapping.
- Create: `startup-reference/doripe/api/notify-taste.ts`
  - `GET` shared result and `POST` create result.
- Create: `startup-reference/doripe/api/notify-taste-event.ts`
  - Records funnel/share events.
- Modify: `startup-reference/doripe/public/notify.html`
  - Connects UI to APIs, hides preview nav in production, renders compatibility button for shared-link visitors.
- Modify: `doripe-kr-pages.md`
  - Replaces old `/notify` description with the new flow and storage split.

## Task 1: Add Supabase SDK And Env Contract

**Files:**
- Modify: `startup-reference/doripe/package.json`
- Modify: `startup-reference/doripe/package-lock.json`
- Modify: `startup-reference/doripe/.env.example`

- [ ] **Step 1: Add dependency**

Run:

```bash
cd "startup-reference/doripe"
npm install @supabase/supabase-js@2.108.1
```

Expected:

- `package.json` contains `"@supabase/supabase-js": "^2.108.1"`.
- `package-lock.json` contains `node_modules/@supabase/supabase-js`.

- [ ] **Step 2: Document env vars**

Append to `startup-reference/doripe/.env.example`:

```dotenv
# Supabase service-role access for Vercel API routes.
# Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 3: Verify dependency state**

Run:

```bash
cd "startup-reference/doripe"
node -e "const p=require('./package.json'); if (!p.dependencies['@supabase/supabase-js']) process.exit(1); console.log(p.dependencies['@supabase/supabase-js'])"
```

Expected:

```text
^2.108.1
```

- [ ] **Step 4: Commit**

```bash
git add "startup-reference/doripe/package.json" "startup-reference/doripe/package-lock.json" "startup-reference/doripe/.env.example"
git commit -m "chore: add supabase dependency for notify"
```

## Task 2: Add Supabase Migration

**Files:**
- Create: `supabase/migrations/20260704000100_notify_taste_match.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260704000100_notify_taste_match.sql`:

```sql
create table if not exists public.notify_taste_results (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  choices jsonb not null,
  character_key text not null,
  character_name text not null,
  share_slug text not null unique,
  referrer_share_slug text references public.notify_taste_results(share_slug) on delete set null,
  compatibility_score integer,
  compatibility_summary text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now(),
  constraint notify_taste_results_email_valid
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  constraint notify_taste_results_choices_array
    check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 10),
  constraint notify_taste_results_character_key_valid
    check (character_key in ('quiet_collector', 'route_planner')),
  constraint notify_taste_results_score_valid
    check (compatibility_score is null or compatibility_score between 0 and 100)
);

create index if not exists notify_taste_results_share_slug_idx
  on public.notify_taste_results(share_slug);

create index if not exists notify_taste_results_referrer_share_slug_idx
  on public.notify_taste_results(referrer_share_slug);

create index if not exists notify_taste_results_created_at_idx
  on public.notify_taste_results(created_at desc);

create index if not exists notify_taste_results_email_idx
  on public.notify_taste_results(email);

alter table public.notify_taste_results enable row level security;

create table if not exists public.notify_taste_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  share_slug text,
  referrer_share_slug text,
  metadata jsonb not null default '{}'::jsonb,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now(),
  constraint notify_taste_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists notify_taste_events_name_created_at_idx
  on public.notify_taste_events(event_name, created_at desc);

create index if not exists notify_taste_events_share_slug_idx
  on public.notify_taste_events(share_slug);

create index if not exists notify_taste_events_referrer_share_slug_idx
  on public.notify_taste_events(referrer_share_slug);

alter table public.notify_taste_events enable row level security;
```

- [ ] **Step 2: Static migration check**

Run:

```bash
rg -n "notify_taste_results|notify_taste_events|enable row level security" "supabase/migrations/20260704000100_notify_taste_match.sql"
```

Expected:

- Both table names appear.
- Both `enable row level security` statements appear.

- [ ] **Step 3: Commit**

```bash
git add "supabase/migrations/20260704000100_notify_taste_match.sql"
git commit -m "feat: add notify taste supabase tables"
```

## Task 3: Add Schemas And Notify Helper

**Files:**
- Modify: `startup-reference/doripe/lib/schema.ts`
- Create: `startup-reference/doripe/lib/notify-taste.ts`

- [ ] **Step 1: Add API schemas**

Append to `startup-reference/doripe/lib/schema.ts`:

```ts
const NotifyChoiceSchema = z.enum(["A", "B"]);

export const NotifyTasteCreatePayloadSchema = z.object({
  email: z.string().email().max(254),
  choices: z.array(NotifyChoiceSchema).length(10),
  characterKey: z.enum(["quiet_collector", "route_planner"]).optional(),
  referrerShareSlug: z.string().regex(/^nt_[a-zA-Z0-9_-]{8,32}$/).optional().nullable(),
});

export type NotifyTasteCreatePayload = z.infer<typeof NotifyTasteCreatePayloadSchema>;

export const NotifyTasteEventPayloadSchema = z.object({
  eventName: z.enum(["page_view", "choice_complete", "email_submit", "result_view", "share_click", "compatibility_view"]),
  shareSlug: z.string().regex(/^nt_[a-zA-Z0-9_-]{8,32}$/).optional().nullable(),
  referrerShareSlug: z.string().regex(/^nt_[a-zA-Z0-9_-]{8,32}$/).optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type NotifyTasteEventPayload = z.infer<typeof NotifyTasteEventPayloadSchema>;
```

- [ ] **Step 2: Create helper**

Create `startup-reference/doripe/lib/notify-taste.ts`:

```ts
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

type Choice = "A" | "B";

export type NotifyTasteCharacterKey = "quiet_collector" | "route_planner";

export interface NotifyTasteResultRow {
  id: string;
  email: string;
  choices: Choice[];
  character_key: NotifyTasteCharacterKey;
  character_name: string;
  share_slug: string;
  referrer_share_slug: string | null;
  compatibility_score: number | null;
  compatibility_summary: string | null;
  created_at: string;
}

export const NOTIFY_TASTE_CHARACTERS: Record<NotifyTasteCharacterKey, {
  key: NotifyTasteCharacterKey;
  name: string;
  description: string;
  tags: string[];
}> = {
  quiet_collector: {
    key: "quiet_collector",
    name: "조용한 감도 수집가",
    description: "복잡한 곳보다 오래 머물고 싶은 장면을 먼저 고르는 타입이에요.",
    tags: ["조용함", "감성적인", "동네감"],
  },
  route_planner: {
    key: "route_planner",
    name: "하루 루트 설계자",
    description: "한 곳보다 이어지는 하루의 흐름을 중요하게 보는 타입이에요.",
    tags: ["루트형", "활동적인", "균형감"],
  },
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function createNotifySupabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function createShareSlug() {
  return `nt_${randomBytes(8).toString("base64url")}`;
}

export function computeCharacter(choices: Choice[]) {
  const bCount = choices.filter((choice) => choice === "B").length;
  const key: NotifyTasteCharacterKey = bCount >= 5 ? "route_planner" : "quiet_collector";
  return NOTIFY_TASTE_CHARACTERS[key];
}

export function computeCompatibility(myChoices: Choice[], friendChoices: Choice[], sameCharacter: boolean) {
  const sameCount = myChoices.reduce((count, choice, index) => (
    count + (choice === friendChoices[index] ? 1 : 0)
  ), 0);
  const raw = 25 + sameCount * 6 + (sameCharacter ? 13 : 0);
  const score = Math.max(40, Math.min(98, raw));
  const summary = score >= 80
    ? "조용한 카페 → 골목 산책 → 작은 디저트샵 조합이 잘 맞아요."
    : score >= 65
      ? "한두 곳은 각자 고르고, 마지막 장소를 같이 정하면 잘 맞아요."
      : "서로 다른 취향을 번갈아 넣으면 새로운 하루가 만들어져요.";
  return { score, summary };
}

export function toPublicResult(row: NotifyTasteResultRow) {
  const character = NOTIFY_TASTE_CHARACTERS[row.character_key];
  return {
    shareSlug: row.share_slug,
    characterKey: row.character_key,
    characterName: row.character_name,
    description: character.description,
    tags: character.tags,
  };
}
```

- [ ] **Step 3: Run typecheck for new imports**

Run:

```bash
cd "startup-reference/doripe"
npm run typecheck
```

Expected:

- If unrelated existing admin imports fail, record them.
- There must be no errors from `lib/schema.ts` or `lib/notify-taste.ts`.

- [ ] **Step 4: Commit**

```bash
git add "startup-reference/doripe/lib/schema.ts" "startup-reference/doripe/lib/notify-taste.ts"
git commit -m "feat: add notify taste schemas"
```

## Task 4: Add Result Create/Read API

**Files:**
- Create: `startup-reference/doripe/api/notify-taste.ts`

- [ ] **Step 1: Create API route**

Create `startup-reference/doripe/api/notify-taste.ts`:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { NotifyTasteCreatePayloadSchema } from "../lib/schema.js";
import {
  computeCharacter,
  computeCompatibility,
  createNotifySupabaseClient,
  createShareSlug,
  NOTIFY_TASTE_CHARACTERS,
  toPublicResult,
  type NotifyTasteResultRow,
} from "../lib/notify-taste.js";

function readBody(req: VercelRequest) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

function getRequestOrigin(req: VercelRequest) {
  const host = req.headers.host || "doripe.kr";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function readResultBySlug(shareSlug: string) {
  const supabase = createNotifySupabaseClient();
  const { data, error } = await supabase
    .from("notify_taste_results")
    .select("id,email,choices,character_key,character_name,share_slug,referrer_share_slug,compatibility_score,compatibility_summary,created_at")
    .eq("share_slug", shareSlug)
    .maybeSingle();

  if (error) throw error;
  return data as NotifyTasteResultRow | null;
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const shareSlug = getSingleQueryValue(req.query.shareSlug);
  if (!shareSlug || !/^nt_[a-zA-Z0-9_-]{8,32}$/.test(shareSlug)) {
    return res.status(400).json({ ok: false, error: "invalid shareSlug" });
  }

  const row = await readResultBySlug(shareSlug);
  if (!row) return res.status(404).json({ ok: false, error: "not found" });

  return res.status(200).json({ ok: true, result: toPublicResult(row) });
}

async function insertResult(payload: ReturnType<typeof NotifyTasteCreatePayloadSchema.parse>, req: VercelRequest) {
  const supabase = createNotifySupabaseClient();
  const character = computeCharacter(payload.choices);
  let shareSlug = createShareSlug();
  let referrerRow: NotifyTasteResultRow | null = null;
  let compatibility: { available: boolean; score?: number; friendCharacterName?: string; summary?: string } = { available: false };

  if (payload.referrerShareSlug) {
    referrerRow = await readResultBySlug(payload.referrerShareSlug);
  }

  if (referrerRow) {
    const computed = computeCompatibility(
      payload.choices,
      referrerRow.choices,
      character.key === referrerRow.character_key,
    );
    compatibility = {
      available: true,
      score: computed.score,
      friendCharacterName: referrerRow.character_name,
      summary: computed.summary,
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("notify_taste_results")
      .insert({
        email: payload.email,
        choices: payload.choices,
        character_key: character.key,
        character_name: character.name,
        share_slug: shareSlug,
        referrer_share_slug: referrerRow?.share_slug ?? null,
        compatibility_score: compatibility.score ?? null,
        compatibility_summary: compatibility.summary ?? null,
        user_agent: req.headers["user-agent"] ?? null,
        referrer: req.headers.referer ?? null,
      })
      .select("id,email,choices,character_key,character_name,share_slug,referrer_share_slug,compatibility_score,compatibility_summary,created_at")
      .single();

    if (!error) return { row: data as NotifyTasteResultRow, compatibility };
    if (!String(error.message).includes("duplicate key")) throw error;
    shareSlug = createShareSlug();
  }

  throw new Error("Unable to create unique share slug.");
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const parsed = NotifyTasteCreatePayloadSchema.safeParse(readBody(req));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ ok: false, error: first?.message ?? "validation failed" });
  }

  const { row, compatibility } = await insertResult(parsed.data, req);
  const publicResult = toPublicResult(row);
  return res.status(200).json({
    ok: true,
    result: {
      ...publicResult,
      shareUrl: `${getRequestOrigin(req)}/notify?ref=${encodeURIComponent(row.share_slug)}`,
    },
    character: NOTIFY_TASTE_CHARACTERS[row.character_key],
    compatibility,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    return res.status(405).json({ ok: false, error: "method not allowed" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message });
  }
}
```

- [ ] **Step 2: Run isolated typecheck command**

Run:

```bash
cd "startup-reference/doripe"
npx tsc --noEmit --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop --strict --skipLibCheck --types node api/notify-taste.ts lib/notify-taste.ts lib/schema.ts
```

Expected:

- PASS.

- [ ] **Step 3: Commit**

```bash
git add "startup-reference/doripe/api/notify-taste.ts"
git commit -m "feat: add notify taste API"
```

## Task 5: Add Event API

**Files:**
- Create: `startup-reference/doripe/api/notify-taste-event.ts`

- [ ] **Step 1: Create event route**

Create `startup-reference/doripe/api/notify-taste-event.ts`:

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { NotifyTasteEventPayloadSchema } from "../lib/schema.js";
import { createNotifySupabaseClient } from "../lib/notify-taste.js";

function readBody(req: VercelRequest) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  const parsed = NotifyTasteEventPayloadSchema.safeParse(readBody(req));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ ok: false, error: first?.message ?? "validation failed" });
  }

  try {
    const supabase = createNotifySupabaseClient();
    const payload = parsed.data;
    const { error } = await supabase.from("notify_taste_events").insert({
      event_name: payload.eventName,
      share_slug: payload.shareSlug ?? null,
      referrer_share_slug: payload.referrerShareSlug ?? null,
      metadata: payload.metadata,
      user_agent: req.headers["user-agent"] ?? null,
      referrer: req.headers.referer ?? null,
    });

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: (error as Error).message });
  }
}
```

- [ ] **Step 2: Run isolated typecheck command**

Run:

```bash
cd "startup-reference/doripe"
npx tsc --noEmit --target ES2022 --module esnext --moduleResolution bundler --esModuleInterop --strict --skipLibCheck --types node api/notify-taste-event.ts lib/notify-taste.ts lib/schema.ts
```

Expected:

- PASS.

- [ ] **Step 3: Commit**

```bash
git add "startup-reference/doripe/api/notify-taste-event.ts"
git commit -m "feat: track notify taste events"
```

## Task 6: Wire `/notify.html`

**Files:**
- Modify: `startup-reference/doripe/public/notify.html`

- [ ] **Step 1: Add CSS for hidden preview nav and match action**

In the `<style>` block, add after `.preview-nav button.is-active`:

```css
  body:not(.debug-nav) .preview-nav {
    display: none;
  }
  .result-actions .compat-action {
    border: 0;
    background:
      radial-gradient(circle at 12% 18%, rgba(255, 255, 255, .55), transparent 30%),
      linear-gradient(135deg, #ff6aa2 0%, #ff8bb8 48%, #ffc3a3 100%);
    color: #fff;
    box-shadow: 0 18px 32px rgba(230, 78, 126, .20);
  }
  .result-actions .is-hidden {
    display: none;
  }
```

- [ ] **Step 2: Add compatibility button in result actions**

Replace:

```html
<div class="result-actions">
  <button class="primary" type="button" data-share>공유하기</button>
</div>
```

with:

```html
<div class="result-actions">
  <button class="primary" type="button" data-share>공유하기</button>
  <button id="compatButton" class="primary compat-action is-hidden" type="button">궁합보기</button>
</div>
```

- [ ] **Step 3: Replace hardcoded script state**

Replace the current `<script>...</script>` content with:

```html
<script>
  const screens = ["intro", "choice", "email", "result", "match"];
  const params = new URLSearchParams(window.location.search);
  const debugNav = params.get("debug") === "1";
  const referrerShareSlug = params.get("ref");
  const picks = [];
  let round = 1;
  let activeResult = null;
  let referrerResult = null;
  let activeCompatibility = null;

  if (debugNav) document.body.classList.add("debug-nav");

  const refs = {
    roundNum: document.getElementById("roundNum"),
    progressValue: document.getElementById("progressValue"),
    choiceA: document.getElementById("choiceA"),
    choiceB: document.getElementById("choiceB"),
    thumbRow: document.getElementById("thumbRow"),
    emailForm: document.getElementById("emailForm"),
    emailInput: document.getElementById("emailInput"),
    toast: document.getElementById("toast"),
    compatButton: document.getElementById("compatButton"),
    resultLink: document.querySelector(".share-box:not(.compat-box) strong"),
    resultTitle: document.querySelector("#screen-result h2"),
    resultLead: document.querySelector("#screen-result .lead"),
    resultEyebrow: document.querySelector("#screen-result .eyebrow"),
    resultTags: document.querySelector("#screen-result .tags"),
    resultCharacterImage: document.querySelector("#screen-result .character-img")
  };

  function isValidShareSlug(value) {
    return /^nt_[a-zA-Z0-9_-]{8,32}$/.test(String(value || ""));
  }

  function show(screen) {
    screens.forEach((name) => {
      document.getElementById(`screen-${name}`).classList.toggle("is-active", name === screen);
      const navButton = document.querySelector(`[data-goto="${name}"]`);
      if (navButton) navButton.classList.toggle("is-active", name === screen);
    });
    if (screen === "match") {
      trackEvent("compatibility_view", { screen: "match" });
    }
  }

  function updateRound() {
    refs.roundNum.textContent = String(round);
    refs.progressValue.style.width = `${Math.max(10, ((round - 1) / 10) * 100)}%`;
    refs.choiceA.classList.remove("is-selected");
    refs.choiceB.classList.remove("is-selected");
  }

  function renderThumbs() {
    refs.thumbRow.innerHTML = "";
    const completed = picks.length ? picks : Array.from({ length: 10 }, (_, index) => index % 2 === 0 ? "A" : "B");
    completed.slice(0, 10).forEach((pick) => {
      const thumb = document.createElement("span");
      thumb.className = "thumb";
      const img = document.createElement("img");
      img.src = pick === "A" ? "/img/notify-demo/place-a.svg" : "/img/notify-demo/place-b.svg";
      img.alt = "";
      thumb.appendChild(img);
      refs.thumbRow.appendChild(thumb);
    });
  }

  function renderResult(data) {
    activeResult = data.result;
    activeCompatibility = data.compatibility || { available: false };
    refs.resultLink.textContent = activeResult.shareUrl.replace(/^https?:\/\//, "");
    refs.resultTitle.textContent = activeResult.characterName;
    refs.resultLead.textContent = activeResult.description;
    refs.resultTags.innerHTML = "";
    activeResult.tags.forEach((tag) => {
      const el = document.createElement("span");
      el.className = "tag";
      el.textContent = tag;
      refs.resultTags.appendChild(el);
    });
    refs.resultCharacterImage.src = activeResult.characterKey === "route_planner"
      ? "/img/notify-demo/character-route.svg"
      : "/img/notify-demo/character-quiet.svg";
    refs.compatButton.classList.toggle("is-hidden", !activeCompatibility.available);
    trackEvent("result_view", { screen: "result", characterKey: activeResult.characterKey });
  }

  function renderMatch() {
    if (!activeCompatibility?.available) return;
    document.querySelector("#screen-match .score").innerHTML = `${activeCompatibility.score}<span>점</span>`;
    document.querySelector(".person.me strong").textContent = activeResult.characterName;
    document.querySelector(".person.friend strong").textContent = activeCompatibility.friendCharacterName || "친구의 장소 취향";
    document.querySelector(".route-insight").textContent = activeCompatibility.summary;
    show("match");
  }

  async function trackEvent(eventName, metadata = {}) {
    fetch("/api/notify-taste-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        shareSlug: activeResult?.shareSlug || null,
        referrerShareSlug: isValidShareSlug(referrerShareSlug) ? referrerShareSlug : null,
        metadata
      })
    }).catch(() => {});
  }

  async function loadReferrer() {
    if (!isValidShareSlug(referrerShareSlug)) return;
    try {
      const response = await fetch(`/api/notify-taste?shareSlug=${encodeURIComponent(referrerShareSlug)}`);
      const body = await response.json();
      if (response.ok && body.ok) referrerResult = body.result;
    } catch {
      referrerResult = null;
    }
  }

  function pick(value) {
    const target = value === "A" ? refs.choiceA : refs.choiceB;
    target.classList.add("is-selected");
    picks.push(value);
    trackEvent("choice_complete", { round, choice: value });
    setTimeout(() => {
      if (round >= 10) {
        renderThumbs();
        show("email");
        return;
      }
      round += 1;
      updateRound();
    }, 220);
  }

  async function fallbackCopyLink() {
    const link = activeResult?.shareUrl || "https://doripe.kr/notify";
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(link).catch(() => {});
    }
    refs.toast.classList.add("is-visible");
    setTimeout(() => refs.toast.classList.remove("is-visible"), 1600);
  }

  async function shareLink() {
    const url = activeResult?.shareUrl || "https://doripe.kr/notify";
    const shareData = {
      title: "Doripe 장소 취향 테스트",
      text: "사진 2장 중 더 끌리는 장소를 골라보고 우리 장소 취향 궁합을 확인해봐.",
      url
    };
    trackEvent("share_click", { screen: document.querySelector(".screen.is-active")?.id || "" });
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error && error.name === "AbortError") return;
        await fallbackCopyLink();
      }
      return;
    }
    await fallbackCopyLink();
  }

  async function submitEmail(email) {
    trackEvent("email_submit", { completedChoices: picks.length });
    const response = await fetch("/api/notify-taste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        choices: picks,
        referrerShareSlug: referrerResult?.shareSlug || null
      })
    });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || "submit failed");
    renderResult(body);
    show("result");
  }

  document.querySelectorAll("[data-goto]").forEach((button) => {
    button.addEventListener("click", () => {
      const screen = button.dataset.goto;
      if (screen === "choice") updateRound();
      if (screen === "email") renderThumbs();
      show(screen);
    });
  });

  document.querySelector("[data-start]").addEventListener("click", () => {
    round = 1;
    picks.length = 0;
    updateRound();
    show("choice");
  });

  refs.choiceA.addEventListener("click", () => pick("A"));
  refs.choiceB.addEventListener("click", () => pick("B"));
  refs.compatButton.addEventListener("click", renderMatch);

  refs.emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = refs.emailInput.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      refs.emailInput.focus();
      refs.emailInput.style.borderColor = "#e25f4c";
      return;
    }
    refs.emailInput.style.borderColor = "#dedbd3";
    try {
      await submitEmail(email);
    } catch {
      refs.emailInput.focus();
      refs.toast.textContent = "잠시 후 다시 시도해주세요.";
      refs.toast.classList.add("is-visible");
      setTimeout(() => {
        refs.toast.classList.remove("is-visible");
        refs.toast.textContent = "링크를 복사했어요.";
      }, 1800);
    }
  });

  document.querySelectorAll("[data-share]").forEach((button) => {
    button.addEventListener("click", shareLink);
  });

  updateRound();
  renderThumbs();
  loadReferrer();
  trackEvent("page_view", { route: "/notify", hasRef: isValidShareSlug(referrerShareSlug) });
</script>
```

- [ ] **Step 4: Verify static page still loads**

Run:

```bash
python3 -m http.server 4176 --directory "startup-reference/doripe/public"
```

Open:

```text
http://127.0.0.1:4176/notify.html?debug=1
```

Expected:

- Preview nav is visible with `debug=1`.
- Preview nav is hidden without `debug=1`.
- Static page loads even though API calls fail on the Python server.

- [ ] **Step 5: Commit**

```bash
git add "startup-reference/doripe/public/notify.html"
git commit -m "feat: connect notify page to taste API"
```

## Task 7: Full Local API Verification

**Files:**
- No source changes unless verification exposes a bug.

- [ ] **Step 1: Run Vercel dev**

Run:

```bash
cd "startup-reference/doripe"
npx vercel dev --listen 3000
```

Expected:

- Local site is available at `http://127.0.0.1:3000`.
- Required env vars are loaded from `.env.local` or Vercel env.

- [ ] **Step 2: Create a normal result**

Run in another terminal:

```bash
NORMAL_JSON="$(curl -s -X POST "http://127.0.0.1:3000/api/notify-taste" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-normal@example.com","choices":["A","A","B","A","B","A","A","B","A","A"]}')"
echo "$NORMAL_JSON" | jq .
SLUG="$(echo "$NORMAL_JSON" | jq -r '.result.shareSlug')"
echo "$SLUG"
```

Expected:

- `.ok` is `true`.
- `.result.shareSlug` starts with `nt_`.
- `.compatibility.available` is `false`.

- [ ] **Step 3: Read public result**

Run:

```bash
curl -s "http://127.0.0.1:3000/api/notify-taste?shareSlug=${SLUG}" | jq .
```

Expected:

- `.ok` is `true`.
- Response has no `.result.email`.

- [ ] **Step 4: Create friend result**

Run:

```bash
curl -s -X POST "http://127.0.0.1:3000/api/notify-taste" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-friend@example.com\",\"choices\":[\"A\",\"B\",\"B\",\"A\",\"B\",\"A\",\"B\",\"B\",\"A\",\"A\"],\"referrerShareSlug\":\"${SLUG}\"}" | jq .
```

Expected:

- `.ok` is `true`.
- `.compatibility.available` is `true`.
- `.compatibility.score` is a number.

- [ ] **Step 5: Record event**

Run:

```bash
curl -s -X POST "http://127.0.0.1:3000/api/notify-taste-event" \
  -H "Content-Type: application/json" \
  -d "{\"eventName\":\"share_click\",\"shareSlug\":\"${SLUG}\",\"metadata\":{\"screen\":\"result\"}}" | jq .
```

Expected:

- `.ok` is `true`.

- [ ] **Step 6: Browser verification**

Open:

```text
http://127.0.0.1:3000/notify.html?debug=1
```

Expected:

- Complete 10 picks.
- Email submit reaches result screen.
- Share link is not hardcoded to `dori7`.
- Opening `http://127.0.0.1:3000/notify.html?ref=${SLUG}&debug=1` and completing the flow shows `궁합보기`.

- [ ] **Step 7: Commit verification fixes**

If fixes were required:

```bash
git add "startup-reference/doripe"
git commit -m "fix: verify notify taste flow"
```

If no fixes were required, do not create an empty commit.

## Task 8: Update Docs

**Files:**
- Modify: `doripe-kr-pages.md`

- [ ] **Step 1: Replace `/notify` section**

Replace the old `/notify` section with:

```md
## /notify

URL: https://doripe.kr/notify

역할: 장소 취향 테스트 기반 베타 알림신청 페이지.

핵심 흐름:

- 사진 2장 중 더 끌리는 장소를 10번 선택한다.
- 이메일만 입력하면 장소 취향 캐릭터를 바로 확인한다.
- 결과 링크를 공유할 수 있다.
- 공유 링크로 들어온 친구가 테스트를 완료하면 원 공유자와의 장소 궁합 점수를 볼 수 있다.

수집 항목:

- 이메일
- 10개 선택값
- 산출된 캐릭터
- 공유 링크 slug
- 친구 유입 ref slug

저장 위치:

- 새 결과/이벤트: Supabase `notify_taste_results`, `notify_taste_events`
- 기존 `signups`, `events`, `notify_v2_signups`, `notify_v2_events`, `notify_v2_campaign_labels`는 수정하지 않는다.

주요 기능:

- `/api/notify-taste`로 결과 생성/조회.
- `/api/notify-taste-event`로 퍼널 이벤트 기록.
- `navigator.share()` 기반 공유.
- Web Share API 미지원 브라우저는 링크 복사 fallback.
```

- [ ] **Step 2: Verify docs mention storage split**

Run:

```bash
rg -n "notify_taste_results|notify_v2_signups|Supabase" "doripe-kr-pages.md"
```

Expected:

- New Supabase tables appear.
- Existing legacy table names still appear only as preserved historical data.

- [ ] **Step 3: Commit**

```bash
git add "doripe-kr-pages.md"
git commit -m "docs: update notify page architecture"
```

## Task 9: Production Deployment Verification

**Files:**
- No source changes unless deployment exposes a bug.

- [ ] **Step 1: Run final checks**

Run:

```bash
cd "startup-reference/doripe"
npm run typecheck
cd ../..
git diff --check
```

Expected:

- `git diff --check` passes.
- If `npm run typecheck` fails from pre-existing admin imports, confirm no notify files are in the error list.

- [ ] **Step 2: Deploy to Vercel**

Run:

```bash
cd "startup-reference/doripe"
npx vercel --prod --yes
```

Expected:

- Vercel returns a production deployment URL.

- [ ] **Step 3: Alias to doripe.kr**

Run with the returned URL:

```bash
npx vercel alias set "https://DEPLOYMENT_URL" doripe.kr
```

Expected:

- Alias succeeds.

- [ ] **Step 4: Production smoke test**

Run:

```bash
curl -L -s -o /tmp/doripe-notify.html -w "%{http_code}\n" "https://doripe.kr/notify"
```

Expected:

```text
200
```

- [ ] **Step 5: Verify no legacy data mutation**

Check Supabase has new rows in:

- `notify_taste_results`
- `notify_taste_events`

Check no migration or code path updates:

- `signups`
- `events`
- `notify_v2_signups`
- `notify_v2_events`
- `notify_v2_campaign_labels`

## Self-Review

Spec coverage:

- Supabase-only new storage: Task 2, Task 4, Task 5.
- Legacy data untouched: Task 2, Task 8, Task 9.
- `/notify?ref=` friend flow: Task 4, Task 6, Task 7.
- `궁합보기` beside `공유하기`: Task 6.
- Web Share with fallback: Task 6.
- Event tracking: Task 5, Task 6, Task 7.
- Production verification: Task 9.

Placeholder scan:

- No unresolved values or unspecified implementation steps remain.
- Runtime slugs are stored in `SLUG` during verification commands.

Type consistency:

- `shareSlug` maps to DB `share_slug`.
- `referrerShareSlug` maps to DB `referrer_share_slug`.
- Character keys are limited to `quiet_collector` and `route_planner` across schema, helper, and migration.
