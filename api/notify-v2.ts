import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import {
  badRequest,
  booleanValue,
  ensureNotifyV2Tables,
  jsonBody,
  optionalNullableString,
  optionalString,
  sendJson,
  stringArray,
  stringValue,
} from "./_legacy.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = jsonBody(request);
    const age = stringValue(body, "age");
    const gender = stringValue(body, "gender");
    const region = stringValue(body, "region");
    const painPoint = stringValue(body, "painPoint");
    const betaResult = stringValue(body, "betaResult");
    const betaCommitment = stringValue(body, "betaCommitment");
    const phone = stringValue(body, "phone");

    if (!booleanValue(body, "consentPrivacy") || !booleanValue(body, "consentTerms") || !booleanValue(body, "consentAge")) {
      throw new Error("Invalid input: required consent is missing");
    }

    await ensureNotifyV2Tables();
    await sql`
      insert into notify_v2_signups (
        age_range,
        gender,
        region,
        pain_point,
        desired_features,
        use_cases,
        recent_search_methods,
        save_locations,
        beta_result,
        beta_commitment,
        opinion,
        phone,
        consent_privacy,
        consent_terms,
        consent_age,
        consent_marketing,
        consent_analytics,
        campaign_code
      )
      values (
        ${age},
        ${gender},
        ${region},
        ${painPoint},
        ${JSON.stringify(stringArray(body, "desiredFeatures"))}::jsonb,
        ${JSON.stringify(stringArray(body, "useCases"))}::jsonb,
        ${JSON.stringify(stringArray(body, "recentSearchMethods"))}::jsonb,
        ${JSON.stringify(stringArray(body, "saveLocations"))}::jsonb,
        ${betaResult},
        ${betaCommitment},
        ${optionalString(body, "opinion")},
        ${phone},
        ${booleanValue(body, "consentPrivacy")},
        ${booleanValue(body, "consentTerms")},
        ${booleanValue(body, "consentAge")},
        ${booleanValue(body, "consentMarketing")},
        ${booleanValue(body, "consentAnalytics")},
        ${optionalNullableString(body, "campaignCode")}
      )
    `;
    sendJson(response, 200, { ok: true });
  } catch (error) {
    badRequest(response, error instanceof Error ? error.message : "Invalid input");
  }
}

