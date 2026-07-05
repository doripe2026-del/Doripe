import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createNotifySupabaseClient } from "../lib/notify-taste.js";
import { NotifyTasteEventPayloadSchema } from "../lib/schema.js";

const MAX_RAW_BODY_CHARS = 10_000;
const MAX_METADATA_CHARS = 2_048;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 120;
const RATE_LIMIT_MAX_BUCKETS = 1_000;
const RATE_LIMIT_OVERFLOW_KEY = "overflow";

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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

function isRawBodyTooLarge(req: VercelRequest) {
  return typeof req.body === "string" && req.body.length > MAX_RAW_BODY_CHARS;
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(", ") : value ?? null;
}

function getClientKey(req: VercelRequest) {
  return req.socket.remoteAddress || "unknown";
}

function pruneExpiredBuckets(now: number) {
  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function isRateLimited(req: VercelRequest) {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const clientKey = getClientKey(req);
  const key = rateLimitBuckets.has(clientKey) || rateLimitBuckets.size < RATE_LIMIT_MAX_BUCKETS
    ? clientKey
    : RATE_LIMIT_OVERFLOW_KEY;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_EVENTS;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  if (isRawBodyTooLarge(req)) {
    return res.status(413).json({ ok: false, error: "payload too large" });
  }

  if (isRateLimited(req)) {
    return res.status(429).json({ ok: false, error: "too many requests" });
  }

  const parsed = NotifyTasteEventPayloadSchema.safeParse(readBody(req));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ ok: false, error: first?.message ?? "validation failed" });
  }

  if (JSON.stringify(parsed.data.metadata).length > MAX_METADATA_CHARS) {
    return res.status(400).json({ ok: false, error: "metadata too large" });
  }

  try {
    const payload = parsed.data;
    const supabase = createNotifySupabaseClient();
    const { error } = await supabase
      .from("notify_taste_events")
      .insert({
        event_name: payload.eventName,
        share_slug: payload.shareSlug ?? null,
        referrer_share_slug: payload.referrerShareSlug ?? null,
        metadata: payload.metadata,
        user_agent: getHeaderValue(req.headers["user-agent"]),
        referrer: getHeaderValue(req.headers.referer),
      });

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("notify-taste-event API error", error);
    return res.status(500).json({ ok: false, error: "internal server error" });
  }
}
