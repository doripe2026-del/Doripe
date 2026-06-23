import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { badRequest, booleanValue, ensureBusinessLeadTable, jsonBody, sendJson, stringValue } from "./_legacy.js";

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!/^01[016789]\d{7,8}$/.test(digits)) {
    throw new Error("Invalid input: phone format");
  }
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = jsonBody(request);
    const phone = normalizePhone(stringValue(body, "phone"));
    if (!booleanValue(body, "consentPrivacy")) {
      throw new Error("Invalid input: required consent is missing");
    }

    await ensureBusinessLeadTable();
    await sql`insert into business_leads (phone, consent_privacy) values (${phone}, true)`;
    sendJson(response, 200, { ok: true });
  } catch (error) {
    badRequest(response, error instanceof Error ? error.message : "Invalid input");
  }
}

