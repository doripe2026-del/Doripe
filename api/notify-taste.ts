import type { VercelRequest, VercelResponse } from "@vercel/node";
import { NotifyTasteCreatePayloadSchema } from "../src/notify/schema.js";
import {
  computeCharacter,
  computeCompatibility,
  createNotifySupabaseClient,
  createShareSlug,
  NOTIFY_TASTE_CHARACTERS,
  toLegacyStorageCharacterKey,
  toPublicResult,
  type NotifyTasteResultRow,
} from "../src/notify/notify-taste.js";

const SHARE_SLUG_RE = /^nt_[a-zA-Z0-9_-]{8,32}$/;
const RESULT_COLUMNS_BASE = "id,email,choices,character_key,character_name,share_slug,referrer_share_slug,compatibility_score,compatibility_summary,created_at";
const RESULT_COLUMNS_WITH_EMAIL_KEY = `id,email,email_key,choices,character_key,character_name,share_slug,referrer_share_slug,compatibility_score,compatibility_summary,created_at`;

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
  const configuredOrigin = process.env.PUBLIC_SITE_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/+$/, "");

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  const host = req.headers.host;
  if (host && (host.includes("localhost") || host.includes("127.0.0.1"))) {
    return `http://${host}`.replace(/\/+$/, "");
  }

  return "https://doripe.kr";
}

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isEmailKeySchemaNotReady(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42P10" ||
    message.includes("email_key") ||
    message.includes("on conflict") ||
    message.includes("schema cache") ||
    message.includes("unique or exclusion constraint")
  );
}

function isDuplicateKeyError(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "23505" || (error.message ?? "").includes("duplicate key")));
}

async function readResultBySlug(shareSlug: string) {
  const supabase = createNotifySupabaseClient();
  const { data, error } = await supabase
    .from("notify_taste_results")
    .select(RESULT_COLUMNS_WITH_EMAIL_KEY)
    .eq("share_slug", shareSlug)
    .maybeSingle();

  if (!error) return data as NotifyTasteResultRow | null;
  if (!isEmailKeySchemaNotReady(error)) throw error;

  const fallback = await supabase
    .from("notify_taste_results")
    .select(RESULT_COLUMNS_BASE)
    .eq("share_slug", shareSlug)
    .maybeSingle();

  if (fallback.error) throw fallback.error;
  return fallback.data as NotifyTasteResultRow | null;
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const shareSlug = getSingleQueryValue(req.query.shareSlug);
  if (!shareSlug || !SHARE_SLUG_RE.test(shareSlug)) {
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
  const emailKey = payload.email.trim().toLowerCase();
  let referrerRow: NotifyTasteResultRow | null = null;
  let compatibility: { available: boolean; score?: number; friendCharacterName?: string; summary?: string } = { available: false };

  if (payload.referrerShareSlug) {
    referrerRow = await readResultBySlug(payload.referrerShareSlug);
  }

  if (referrerRow) {
    const computed = computeCompatibility(
      payload.choices,
      referrerRow.choices,
      character.name === referrerRow.character_name,
    );
    compatibility = {
      available: true,
      score: computed.score,
      friendCharacterName: referrerRow.character_name,
      summary: computed.summary,
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const resultPayload = {
      email: payload.email,
      choices: payload.choices,
      character_key: toLegacyStorageCharacterKey(character.key),
      character_name: character.name,
      share_slug: shareSlug,
      referrer_share_slug: referrerRow?.share_slug ?? null,
      compatibility_score: compatibility.score ?? null,
      compatibility_summary: compatibility.summary ?? null,
      user_agent: req.headers["user-agent"] ?? null,
      referrer: req.headers.referer ?? null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("notify_taste_results")
      .upsert({
        ...resultPayload,
        email_key: emailKey,
      }, { onConflict: "email_key" })
      .select(RESULT_COLUMNS_WITH_EMAIL_KEY)
      .single();

    if (!error) return { row: data as NotifyTasteResultRow, compatibility };
    if (isEmailKeySchemaNotReady(error)) {
      const fallback = await supabase
        .from("notify_taste_results")
        .insert(resultPayload)
        .select(RESULT_COLUMNS_BASE)
        .single();

      if (!fallback.error) return { row: fallback.data as NotifyTasteResultRow, compatibility };
      if (!isDuplicateKeyError(fallback.error)) throw fallback.error;
    } else if (!isDuplicateKeyError(error)) {
      throw error;
    }
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
    character: NOTIFY_TASTE_CHARACTERS[publicResult.characterKey],
    compatibility,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (req.method === "GET") return await handleGet(req, res);
    if (req.method === "POST") return await handlePost(req, res);
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method not allowed" });
  } catch (error) {
    console.error("notify-taste API error", error);
    return res.status(500).json({ ok: false, error: "internal server error" });
  }
}
