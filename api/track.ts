import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { badRequest, ensureHomepageEventTables, jsonBody, optionalNullableString, sendJson, stringValue } from "./_legacy.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = jsonBody(request);
    const type = stringValue(body, "type");
    const route = stringValue(body, "route");
    const step = typeof body.step === "number" ? Math.trunc(body.step) : null;
    const campaignCode = optionalNullableString(body, "campaignCode");

    await ensureHomepageEventTables();
    await sql`
      insert into events (type, route, step, campaign_code, metadata)
      values (${type}, ${route}, ${step}, ${campaignCode}, ${JSON.stringify(body)}::jsonb)
    `;
    sendJson(response, 200, { ok: true });
  } catch (error) {
    badRequest(response, error instanceof Error ? error.message : "Invalid input");
  }
}

