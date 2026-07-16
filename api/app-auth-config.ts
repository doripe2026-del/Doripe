import type { VercelRequest, VercelResponse } from "@vercel/node";

const PUBLISHABLE_KEY_NAMES = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
] as const;

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value || value.length > 200) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function legacyKeyRole(key: string) {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function isPublicSupabaseKey(value: string | undefined) {
  if (!value || value.length > 4096) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(value)) return true;
  return legacyKeyRole(value) === "anon";
}

function readPublicKey() {
  for (const name of PUBLISHABLE_KEY_NAMES) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export default function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ available: false });
  }

  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKey = readPublicKey();
  if (!supabaseUrl || !isPublicSupabaseKey(supabaseKey)) {
    return response.status(503).json({ available: false });
  }

  return response.status(200).json({ supabaseUrl, supabaseKey });
}
