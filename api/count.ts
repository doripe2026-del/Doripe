import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { ensureNotifyV2Tables, sendJson } from "./_legacy.js";

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    await ensureNotifyV2Tables();
    const result = await sql<{ count: string }>`select count(*)::text as count from notify_v2_signups`;
    sendJson(response, 200, { ok: true, count: Number(result.rows[0]?.count ?? 0) });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Internal error" });
  }
}

