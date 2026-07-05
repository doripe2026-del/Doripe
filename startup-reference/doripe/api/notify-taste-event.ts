import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createNotifySupabaseClient } from "../lib/notify-taste.js";
import { NotifyTasteEventPayloadSchema } from "../lib/schema.js";

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

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(", ") : value ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  }

  const parsed = NotifyTasteEventPayloadSchema.safeParse(readBody(req));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ ok: false, error: first?.message ?? "validation failed" });
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
