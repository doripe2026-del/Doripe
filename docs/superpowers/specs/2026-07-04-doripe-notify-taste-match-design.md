# Doripe Notify Taste Match Design

Date: 2026-07-04

## Goal

Replace `/notify` with a lightweight viral waitlist flow:

1. User chooses one of two place images for 10 rounds.
2. User enters email.
3. User receives a place taste character and a share link.
4. A friend opens the shared link, completes the same flow, and sees a compatibility score with the original sharer.

Primary objective: collect waitlist emails with lower friction and stronger sharing motivation.

## Approved Approach

Use the existing static Vercel site for the page and Vercel serverless APIs as the backend gateway.

Store new notify taste data in Supabase only.

Do not modify or migrate existing legacy waitlist data:

- `signups`
- `events`
- `notify_v2_signups`
- `notify_v2_events`
- `notify_v2_campaign_labels`

These legacy tables stay intact for historical stats.

## Scope

In scope:

- Convert the current local `public/notify.html` demo into the production `/notify` page.
- Add Supabase tables for taste results and events.
- Add Vercel API endpoints for creating results, reading shared results, and recording events.
- Make `/notify?ref=<shareSlug>` work as a friend compatibility entry.
- Show `궁합보기` next to `공유하기` when a visitor arrived from a valid shared result and has completed the test.
- Use Web Share API for sharing, with clipboard fallback.

Out of scope:

- Rebuilding admin dashboards.
- Migrating legacy notify data.
- Full Figma reimplementation.
- Real AI image generation pipeline.
- Authentication.
- Payment or app install deep links.

## User Flow

### Normal Visitor

1. Opens `/notify`.
2. Sees intro.
3. Clicks `시작하기`.
4. Chooses A or B for 10 rounds.
5. Enters email.
6. API saves result.
7. Result screen shows:
   - character image
   - character name
   - short description
   - tags
   - share teaser card
   - share link
   - `공유하기`

### Shared-Link Visitor

1. Opens `/notify?ref=<shareSlug>`.
2. Page loads the referrer result through API.
3. Completes the same 10-choice flow.
4. Enters email.
5. API saves result with `referrer_share_slug`.
6. Result screen shows:
   - own character
   - `공유하기`
   - `궁합보기`
7. `궁합보기` opens the compatibility screen.

## Page Behavior

`/notify.html` remains a static page with vanilla JavaScript.

The preview navigation used for local review must be hidden in production by default. It can be exposed only through an explicit debug flag such as `/notify?debug=1`.

On page load:

- Parse `ref` from query string.
- If present, call `GET /api/notify-taste?shareSlug=<ref>`.
- If valid, store referrer result in memory for compatibility.
- Record page view event.

On each choice:

- Save choice locally.
- Move to next round.
- Record `choice_complete` event with the round number and selected value.

On email submit:

- Validate email on client.
- Submit email, picks, computed character, and optional referrer slug.
- Receive `shareSlug`, `shareUrl`, and optional compatibility payload.
- Render result screen.

On share click:

- Call `navigator.share({ title, text, url })`.
- If unavailable or failed for non-cancel reason, copy URL to clipboard.
- Record share event.

## API Design

### `POST /api/notify-taste`

Creates a taste result.

Request:

```json
{
  "email": "user@example.com",
  "choices": ["A", "B", "A", "A", "B", "A", "B", "A", "B", "A"],
  "characterKey": "quiet_collector",
  "referrerShareSlug": "dori7"
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "shareSlug": "nt_ab12cd34",
    "shareUrl": "https://doripe.kr/notify?ref=nt_ab12cd34",
    "characterKey": "quiet_collector",
    "characterName": "조용한 감도 수집가"
  },
  "compatibility": {
    "available": true,
    "score": 86,
    "friendCharacterName": "하루 루트 설계자",
    "summary": "조용한 카페 → 골목 산책 → 작은 디저트샵 조합이 잘 맞아요."
  }
}
```

If no valid referrer is provided, `compatibility.available` is false.

### `GET /api/notify-taste?shareSlug=<slug>`

Reads a public-safe referrer result.

Response must not include email.

Response:

```json
{
  "ok": true,
  "result": {
    "shareSlug": "nt_ab12cd34",
    "characterKey": "quiet_collector",
    "characterName": "조용한 감도 수집가",
    "tags": ["조용함", "감성적인", "동네감"]
  }
}
```

### `POST /api/notify-taste-event`

Records funnel and sharing events.

Request:

```json
{
  "eventName": "share_click",
  "shareSlug": "nt_ab12cd34",
  "referrerShareSlug": "nt_ref12345",
  "metadata": {
    "screen": "result"
  }
}
```

## Supabase Schema

Add a new migration under `supabase/migrations`.

### `notify_taste_results`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `email text not null`
- `choices jsonb not null`
- `character_key text not null`
- `character_name text not null`
- `share_slug text not null unique`
- `referrer_share_slug text`
- `compatibility_score integer`
- `compatibility_summary text`
- `user_agent text`
- `referrer text`
- `created_at timestamptz not null default now()`

Indexes:

- `share_slug`
- `referrer_share_slug`
- `created_at desc`
- `email`

RLS:

- Enable RLS.
- No public insert/select policy.
- Vercel API uses service role key.

### `notify_taste_events`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `event_name text not null`
- `share_slug text`
- `referrer_share_slug text`
- `metadata jsonb not null default '{}'::jsonb`
- `user_agent text`
- `referrer text`
- `created_at timestamptz not null default now()`

Indexes:

- `event_name, created_at desc`
- `share_slug`
- `referrer_share_slug`

RLS:

- Enable RLS.
- No public insert/select policy.
- Vercel API uses service role key.

## Character Logic

Keep character logic deterministic and simple for launch.

Initial version:

- Count A/B pattern and weighted dimensions from the 10 choices.
- Map result to one of a small fixed character set.
- Store `character_key` and `character_name`.

Minimum character set:

- `quiet_collector`: 조용한 감도 수집가
- `route_planner`: 하루 루트 설계자

The UI already has two placeholder character assets. More characters can be added later without changing the data model.

## Compatibility Logic

Initial score can be deterministic:

- Compare two `choices` arrays.
- Same pick per round adds base points.
- Similar character adds bonus.
- Clamp score to 40-98 to avoid meaningless extremes.

Example:

- `sameChoiceRatio * 60`
- `characterBonus * 20`
- `baseline 25`
- clamp to 40-98

Store compatibility score on the friend's result row when the friend submits through a `ref` link.

## Frontend Changes

Update `startup-reference/doripe/public/notify.html`:

- Replace hardcoded `dori7` link with API result `shareUrl`.
- On load, parse `ref`.
- Submit email and choices to `POST /api/notify-taste`.
- Render `궁합보기` only when compatibility is available.
- Style `궁합보기` with the same pink gradient visual language as the compatibility teaser card.
- Keep `공유하기` using Web Share API.
- Remove separate link-copy CTA from result actions.

## Error Handling

Frontend:

- Invalid email: focus input and show inline error state.
- API failure: keep user on email/result screen and show short retry message.
- Invalid `ref`: continue normal flow without compatibility.
- Web Share cancel: no error toast.
- Web Share unsupported: copy link fallback.

Backend:

- Validate email, choices length, choice values, character key, and slug.
- Return `400` for invalid payload.
- Return `404` for missing share slug.
- Return `500` only for unexpected storage errors.
- Never return emails from public GET endpoint.

## Privacy

Collect only email and quiz choices.

Do not expose email in shared-link API responses.

Do not modify legacy waitlist records.

Use Supabase service role only in Vercel serverless functions, never in the browser.

## Verification

Local:

- Serve `/notify.html` and complete the flow.
- Submit result with no ref.
- Open returned `shareUrl`.
- Submit friend result.
- Confirm `궁합보기` appears.
- Confirm compatibility screen renders.
- Confirm share button calls Web Share or clipboard fallback.

API:

- `POST /api/notify-taste` creates row in Supabase.
- `GET /api/notify-taste?shareSlug=...` returns public-safe result.
- `POST /api/notify-taste-event` creates event row.

Production:

- Deploy `startup-reference/doripe` to Vercel.
- Alias deployment to `doripe.kr`.
- Confirm `https://doripe.kr/notify` returns 200.
- Confirm real Supabase rows are created.
- Confirm existing legacy tables still have their previous data.

## Rollback

Rollback is simple because legacy notify data is untouched.

Options:

1. Revert `/notify.html` and new API files.
2. Keep Supabase new tables unused.
3. Re-alias Vercel to previous deployment.

No destructive database operation is needed.
