import { z } from "zod";
import { optionalUser } from "../core/auth.js";
import { ApiError } from "../core/errors.js";
import { consumeDevelopmentRateLimit } from "../core/rateLimit.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteHandler } from "../core/router.js";
import { createBackendAdminClient } from "../core/supabase.js";

export const analyticsEventNames = [
  "session_start", "signup_complete", "login_complete", "onboarding_complete", "screen_view",
  "content_impression", "content_open", "place_open", "course_open", "filter_apply", "related_place_open",
  "place_save", "place_unsave", "course_save", "course_unsave", "saved_item_open",
  "course_start", "course_start_place_set", "course_place_add", "course_place_remove", "course_place_replace", "course_complete",
  "profile_open", "follow", "unfollow", "content_like", "content_unlike", "comment_create",
  "share_sheet_open", "share_link_copy", "external_map_open", "feedback_submit", "report_submit",
  "content_upload_complete", "notification_open",
] as const;

export const analyticsProperties = z.object({
  appVersion: z.string().max(40).optional(),
  authorType: z.enum(["doripe", "user", "curator", "partner"]).optional(),
  contentId: z.string().uuid().optional(),
  contentType: z.enum(["place", "course"]).optional(),
  courseId: z.string().uuid().optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  experimentId: z.string().max(80).optional(),
  filterIds: z.array(z.string().max(80)).max(20).optional(),
  placeCount: z.number().int().min(0).max(30).optional(),
  placeId: z.string().max(100).optional(),
  position: z.number().int().min(0).max(10000).optional(),
  shareChannel: z.string().max(40).optional(),
  targetId: z.string().max(100).optional(),
  targetType: z.enum(["place", "content", "course", "profile"]).optional(),
  travelMode: z.enum(["walk", "transit"]).optional(),
}).strict();

const event = z.object({
  eventId: z.string().uuid(),
  schemaVersion: z.number().int().min(1).max(1000),
  occurredAt: z.string().datetime({ offset: true }),
  sessionId: z.string().uuid(),
  anonymousId: z.string().min(16).max(96).nullable().optional(),
  name: z.enum(analyticsEventNames),
  sourceScreen: z.string().min(1).max(80),
  properties: analyticsProperties,
}).strict();

const eventBatch = z.object({ events: z.array(event).min(1).max(50) }).strict();
const sessionInput = z.object({
  sessionId: z.string().uuid(),
  anonymousId: z.string().min(16).max(96),
  startedAt: z.string().datetime({ offset: true }),
  entryPath: z.string().startsWith("/").max(300),
  campaignCode: z.string().max(40).nullable().optional(),
}).strict();

function analyticsActor(userId: string | undefined, anonymousId: string | null | undefined): string {
  if (userId) return `user:${userId}`;
  if (anonymousId) return `anonymous:${anonymousId}`;
  throw new ApiError(400, "anonymous_id_required", "로그인 전에는 anonymousId가 필요합니다.");
}

export const createSession: RouteHandler = async (request, context) => {
  const auth = await optionalUser(request);
  const body = await parseJson(request, sessionInput, 16 * 1024);
  const actor = analyticsActor(auth?.user.id, body.anonymousId);
  await consumeDevelopmentRateLimit(`session:${actor}`, { limit: 30, windowMs: 60_000 });
  const client = createBackendAdminClient();
  const result = await client.from("analytics_sessions").upsert({
    id: body.sessionId,
    user_id: auth?.user.id ?? null,
    anonymous_id: body.anonymousId ?? null,
    domain: "app",
    source: body.campaignCode ? "campaign" : "direct",
    started_at: body.startedAt,
    entry_path: body.entryPath,
    referrer: null,
    metadata: body.campaignCode ? { campaign_code: body.campaignCode } : {},
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "id" }).select("id,started_at,last_seen_at").single();
  if (result.error) throw new ApiError(503, "database_unavailable", "세션을 기록하지 못했습니다.");
  return apiSuccess({ sessionId: result.data.id, accepted: true }, context.requestId, {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
};

export const ingestEvents: RouteHandler = async (request, context) => {
  const auth = await optionalUser(request);
  const body = await parseJson(request, eventBatch, 128 * 1024);
  const anonymousId = body.events[0]?.anonymousId;
  const actor = analyticsActor(auth?.user.id, anonymousId);
  if (body.events.some((item) => item.anonymousId !== anonymousId)) {
    throw new ApiError(400, "mixed_anonymous_ids", "한 요청에는 하나의 anonymousId만 사용할 수 있습니다.");
  }
  await consumeDevelopmentRateLimit(`events:${actor}`, { limit: 120, windowMs: 60_000 });
  const client = createBackendAdminClient();
  const rows = body.events.map((item) => ({
    event_id: item.eventId,
    session_id: item.sessionId,
    user_id: auth?.user.id ?? null,
    anonymous_id: item.anonymousId ?? null,
    domain: "app",
    source: item.sourceScreen,
    event_name: item.name,
    schema_version: item.schemaVersion,
    properties: item.properties,
    client_occurred_at: item.occurredAt,
  }));
  const result = await client.from("analytics_events").upsert(rows, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");
  if (result.error) throw new ApiError(503, "database_unavailable", "이벤트를 기록하지 못했습니다.");
  const accepted = result.data?.length ?? 0;
  return apiSuccess({ accepted, duplicates: rows.length - accepted, rejected: 0 }, context.requestId, {
    status: 202,
    headers: { "cache-control": "no-store" },
  });
};
