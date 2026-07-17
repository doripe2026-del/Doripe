import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import type { RouteHandler } from "../core/router.js";
import { createBackendAdminClient } from "../core/supabase.js";

const deduplicationKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const consentVersion = z.string().trim().min(1).max(40);
const source = z.string().trim().min(1).max(80);
const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const safeId = z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const common = { consentVersion, source, deduplicationKey };

export const publicFormSchemas = {
  beta: z.object({
    ...common,
    email,
    regionId: safeId,
    displayName: z.string().trim().max(80).optional(),
  }).strict(),
  creator: z.object({
    ...common,
    email,
    displayName: z.string().trim().min(1).max(80),
    portfolioUrl: z.string().url().max(1000),
    introduction: z.string().trim().max(2000).optional(),
  }).strict(),
  business: z.object({
    ...common,
    organizationName: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(80),
    contactEmail: email,
    contactPhone: z.string().trim().regex(/^[0-9+() -]{7,30}$/),
    message: z.string().trim().max(3000).optional(),
  }).strict(),
  recommendation: z.object({
    ...common,
    email: email.optional(),
    placeName: z.string().trim().min(1).max(160),
    mapUrl: z.string().url().max(1000).optional(),
    message: z.string().trim().max(3000).optional(),
  }).strict(),
  inquiry: z.object({
    ...common,
    contactEmail: email,
    category: z.enum(["bug", "feedback", "account", "content", "other"]),
    text: z.string().trim().min(1).max(5000),
  }).strict(),
  partner: z.object({
    ...common,
    organizationName: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(80),
    contactEmail: email,
    contactPhone: z.string().trim().regex(/^[0-9+() -]{7,30}$/).optional(),
    message: z.string().trim().max(3000).optional(),
  }).strict(),
  campaign: z.object({
    ...common,
    organizationName: z.string().trim().min(1).max(160),
    contactName: z.string().trim().min(1).max(80),
    contactEmail: email,
    campaignName: z.string().trim().min(1).max(120),
    message: z.string().trim().max(3000).optional(),
  }).strict(),
  "notify-taste": z.object({
    ...common,
    email,
    tasteIds: z.array(safeId).min(1).max(20).refine((items) => new Set(items).size === items.length, "취향 값이 중복됐습니다."),
  }).strict(),
  "notify-event": z.object({
    ...common,
    email,
    eventCode: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  }).strict(),
} as const;

export type PublicFormKind = keyof typeof publicFormSchemas;

function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "";
  return createHash("sha256").update(`${address}|${userAgent}`).digest("hex");
}

export async function consumePublicFormRateLimit(request: Request, kind: PublicFormKind): Promise<string> {
  const fingerprint = clientFingerprint(request);
  const client = createBackendAdminClient();
  const result = await client.rpc("consume_rate_limit", {
    p_bucket_key_hash: fingerprint,
    p_route_key: `forms:${kind}`,
    p_limit: 10,
    p_window_seconds: 600,
    p_cost: 1,
  });
  if (result.error || !Array.isArray(result.data) || !result.data[0]) {
    throw new ApiError(503, "rate_limit_unavailable", "제출 보호 기능을 확인하지 못했습니다.");
  }
  const decision = result.data[0] as { is_allowed?: boolean; reset_at?: string };
  if (!decision.is_allowed) {
    const retryAfter = Math.max(1, Math.ceil((new Date(decision.reset_at ?? Date.now()).getTime() - Date.now()) / 1000));
    throw new ApiError(429, "rate_limited", "잠시 뒤 다시 시도해 주세요.", { retryAfter });
  }
  return fingerprint;
}

function contactEmail(kind: PublicFormKind, payload: Record<string, unknown>): string | null {
  if (typeof payload.email === "string") return payload.email;
  if (typeof payload.contactEmail === "string") return payload.contactEmail;
  return null;
}

function submissionLabel(kind: PublicFormKind, payload: Record<string, unknown>): string {
  for (const key of ["organizationName", "campaignName", "placeName", "displayName", "contactEmail", "email"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 200);
  }
  return kind;
}

function publicFormHandler<K extends PublicFormKind>(kind: K): RouteHandler {
  return async (request, context) => {
    const schema = publicFormSchemas[kind] as unknown as z.ZodType<Record<string, unknown>>;
    const body = await parseJson(request, schema, 32 * 1024) as Record<string, unknown> & {
      consentVersion: string;
      deduplicationKey: string;
      source: string;
    };
    const fingerprint = await consumePublicFormRateLimit(request, kind);
    return executeIdempotent({
      actorId: fingerprint,
      actorType: "anonymous",
      payload: body,
      request,
      requestId: context.requestId,
      route: `/api/v1/forms/${kind}`,
      operation: async () => {
        const client = createBackendAdminClient();
        const existing = await client.from("intake_submissions")
          .select("id,status,version")
          .eq("kind", kind)
          .eq("deduplication_key", body.deduplicationKey)
          .maybeSingle();
        if (existing.error) throw new ApiError(503, "intake_unavailable", "신청을 확인하지 못했습니다.");
        if (existing.data) return {
          data: { id: existing.data.id, status: existing.data.status, version: existing.data.version, duplicate: true },
          status: 202,
        };

        const inserted = await client.from("intake_submissions").insert({
          kind,
          label: submissionLabel(kind, body),
          contact_email: contactEmail(kind, body),
          deduplication_key: body.deduplicationKey,
          consent_version: body.consentVersion,
          source: body.source,
          payload: body,
        }).select("id,status,version").single();
        if (inserted.error || !inserted.data) throw new ApiError(503, "intake_unavailable", "신청을 저장하지 못했습니다.");
        return { data: { id: inserted.data.id, status: inserted.data.status, version: inserted.data.version, duplicate: false }, status: 202 };
      },
    });
  };
}

export const createBetaApplication = publicFormHandler("beta");
export const createCreatorApplication = publicFormHandler("creator");
export const createBusinessApplication = publicFormHandler("business");
export const createRecommendationApplication = publicFormHandler("recommendation");
export const createPublicInquiryApplication = publicFormHandler("inquiry");
export const createPartnerApplication = publicFormHandler("partner");
export const createCampaignApplication = publicFormHandler("campaign");
export const createTasteNotificationRequest = publicFormHandler("notify-taste");
export const createEventNotificationRequest = publicFormHandler("notify-event");
