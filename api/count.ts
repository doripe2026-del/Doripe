import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { ensureHomepageEventTables, sendJson } from "./_legacy.js";

const HOMEPAGE_VIEW_BASELINE = 10_000;

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    await ensureHomepageEventTables();
    const result = await sql<{ count: string }>`
      select count(*)::text as count
      from events
      where type = 'page_view' and route = '/'
    `;
    const pageViews = Number(result.rows[0]?.count ?? 0);
    sendJson(response, 200, {
      ok: true,
      count: HOMEPAGE_VIEW_BASELINE + pageViews,
      pageViews,
      baseline: HOMEPAGE_VIEW_BASELINE,
    });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : "Internal error" });
  }
}
