import { z } from "zod";
import { requireUser } from "../core/auth.js";
import { databaseData } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteHandler } from "../core/router.js";
import { createBackendAdminClient } from "../core/supabase.js";

const profileUpdate = z.object({
  nickname: z.string().trim().min(1).max(40).optional(),
  introduction: z.string().trim().max(500).optional(),
  profileImageId: z.string().uuid().nullable().optional(),
  expectedVersion: z.number().int().min(1).optional(),
}).strict().refine((value) => value.nickname !== undefined || value.introduction !== undefined || value.profileImageId !== undefined,
  "수정할 값을 입력해 주세요.");

export const onboardingUpdate = z.object({
  birthYear: z.coerce.number().int().min(1900).max(new Date().getUTCFullYear()).optional(),
  gender: z.enum(["female", "male", "unspecified"]).optional(),
  nickname: z.string().trim().min(2).max(40).optional(),
  discoveryHabit: z.enum([
    "instagram-saved", "naver-map-saved", "blog-search", "friend-recommendation",
    "search-as-needed", "good-fit", "unknown",
  ]).optional(),
  neighborhoodIds: z.array(z.string().min(1).max(96)).max(10)
    .refine((items) => new Set(items).size === items.length, "동네를 중복해서 선택할 수 없습니다.").default([]),
  placeTypeTagIds: z.array(z.string().min(1).max(96)).max(20)
    .refine((items) => new Set(items).size === items.length, "장소 유형을 중복해서 선택할 수 없습니다.").default([]),
  situationTagIds: z.array(z.string().min(1).max(96)).max(20)
    .refine((items) => new Set(items).size === items.length, "상황을 중복해서 선택할 수 없습니다.").default([]),
  referralSource: z.enum([
    "friend", "instagram", "tiktok", "tiktok-shorts", "search", "blog-search",
    "community", "community-cafe", "creator", "store", "web-store", "map", "other", "unknown",
  ]),
}).strict();

const notificationsUpdate = z.object({
  all: z.boolean(),
  savedPlaceReminder: z.boolean(),
  courseRecommendation: z.boolean(),
  social: z.boolean(),
  marketing: z.boolean(),
}).strict();

const withdrawalInput = z.object({
  confirmation: z.literal("WITHDRAW"),
  reasonCode: z.enum(["not_useful", "privacy", "duplicate", "other"]).optional(),
}).strict();

function profileOutput(row: Record<string, unknown> | null, isCurator = false, profileImageUrl: string | null = null) {
  if (!row) return null;
  return {
    id: row.user_id,
    nickname: row.display_name,
    introduction: row.bio,
    profileImageUrl,
    isCurator,
    officialBadge: false,
    followedByMe: false,
    followerCount: 0,
  };
}

async function avatarUrl(row: Record<string, unknown> | null): Promise<string | null> {
  if (!row?.avatar_media_id) return null;
  const admin = createBackendAdminClient();
  const media = await admin.from("media_assets").select("owner_user_id,storage_bucket,storage_path,status")
    .eq("id", String(row.avatar_media_id)).maybeSingle();
  if (media.error || !media.data || media.data.owner_user_id !== row.user_id) return null;
  const validLocation = media.data.status === "uploaded" && media.data.storage_bucket === "media-quarantine"
    || media.data.status === "approved" && media.data.storage_bucket === "media-approved";
  if (!validLocation) return null;
  const signed = await admin.storage.from(media.data.storage_bucket).createSignedUrl(media.data.storage_path, 300);
  return signed.data?.signedUrl ?? null;
}

async function curatorStatusForEmail(email?: string): Promise<"applied" | "approved" | "none" | "rejected" | "suspended"> {
  if (!email) return "none";
  const curator = await createBackendAdminClient().from("intake_submissions")
    .select("status").eq("kind", "creator").eq("contact_email", email.toLowerCase())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (curator.error) throw new ApiError(503, "account_state_unavailable", "큐레이터 상태를 확인하지 못했습니다.");
  return curator.data?.status === "accepted" ? "approved"
    : curator.data?.status === "rejected" ? "rejected"
      : curator.data?.status === "closed" ? "suspended"
        : curator.data ? "applied" : "none";
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export const getAccount: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const account = databaseData<Record<string, unknown>>(await auth.userClient.from("user_accounts")
    .select("user_id,status,email_verified_at,restriction_reason,restricted_until,withdrawal_requested_at,created_at,updated_at")
    .eq("user_id", auth.user.id).maybeSingle());
  const curatorStatus = await curatorStatusForEmail(auth.user.email);
  return apiSuccess({
    id: auth.user.id,
    emailMasked: maskEmail(auth.user.email ?? ""),
    emailVerified: Boolean(account.email_verified_at ?? auth.user.email_confirmed_at),
    status: account.status === "restricted" ? "suspended" : account.status,
    curatorStatus,
  }, context.requestId, { headers: { "cache-control": "private, no-store" } });
};

export const getProfile: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const result = await auth.userClient.from("public_profiles")
    .select("user_id,display_name,bio,avatar_path,avatar_media_id,version,updated_at")
    .eq("user_id", auth.user.id).maybeSingle();
  if (result.error) throw new ApiError(503, "database_unavailable", "프로필을 불러오지 못했습니다.");
  return apiSuccess(profileOutput(
    result.data,
    await curatorStatusForEmail(auth.user.email) === "approved",
    await avatarUrl(result.data as Record<string, unknown> | null),
  ), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const patchProfile: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, profileUpdate);
  const current = databaseData<Record<string, unknown>>(await auth.userClient.from("public_profiles")
    .select("user_id,display_name,bio,avatar_path,avatar_media_id,version,updated_at")
    .eq("user_id", auth.user.id).maybeSingle());
  const result = await auth.userClient.rpc("update_my_profile", {
    p_display_name: body.nickname ?? current.display_name,
    p_bio: body.introduction ?? current.bio,
    p_avatar_media_id: body.profileImageId === undefined ? current.avatar_media_id : body.profileImageId,
    p_expected_version: body.expectedVersion ?? current.version,
  });
  if (result.error) {
    if (result.error.code === "40001") throw new ApiError(409, "version_conflict", "프로필이 다른 기기에서 변경됐습니다.");
    if (result.error.code === "22023") throw new ApiError(422, "invalid_profile", "프로필 이미지와 입력값을 확인해 주세요.");
    throw new ApiError(503, "database_unavailable", "프로필을 저장하지 못했습니다.");
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown> | null;
  if (!row) throw new ApiError(503, "database_unavailable", "프로필을 저장하지 못했습니다.");
  return apiSuccess(profileOutput(
    row,
    await curatorStatusForEmail(auth.user.email) === "approved",
    await avatarUrl(row),
  ), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const putOnboarding: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, onboardingUpdate, 32 * 1024);
  const result = await auth.userClient.from("user_onboarding").upsert({
    user_id: auth.user.id,
    schema_version: 1,
    answers: body,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("schema_version,answers,completed_at,updated_at").single();
  if (result.error) throw new ApiError(503, "database_unavailable", "온보딩 정보를 저장하지 못했습니다.");
  return apiSuccess({ id: auth.user.id, status: "completed", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const getNotifications: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const result = await auth.userClient.from("notification_preferences")
    .select("schema_version,enabled,preferences,updated_at").eq("user_id", auth.user.id).maybeSingle();
  if (result.error) throw new ApiError(503, "database_unavailable", "알림 설정을 불러오지 못했습니다.");
  const stored = result.data as Record<string, unknown> | null;
  const preferences = (stored?.preferences ?? {}) as Record<string, unknown>;
  return apiSuccess(stored ? {
    all: stored.enabled,
    savedPlaceReminder: Boolean(preferences.savedPlaceReminder),
    courseRecommendation: Boolean(preferences.courseRecommendation),
    social: Boolean(preferences.social),
    marketing: Boolean(preferences.marketing),
    schemaVersion: 1,
  } : { all: true, savedPlaceReminder: true, courseRecommendation: true, social: true, marketing: false, schemaVersion: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const putNotifications: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, notificationsUpdate, 16 * 1024);
  const result = await auth.userClient.from("notification_preferences").upsert({
    user_id: auth.user.id,
    schema_version: 1,
    enabled: body.all,
    preferences: {
      savedPlaceReminder: body.savedPlaceReminder,
      courseRecommendation: body.courseRecommendation,
      social: body.social,
      marketing: body.marketing,
    },
  }, { onConflict: "user_id" }).select("schema_version,enabled,preferences,updated_at").single();
  if (result.error) throw new ApiError(503, "database_unavailable", "알림 설정을 저장하지 못했습니다.");
  return apiSuccess({ ...body, schemaVersion: 1 }, context.requestId, { headers: { "cache-control": "private, no-store" } });
};

export const requestWithdrawal: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, withdrawalInput, 4 * 1024);
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/me/withdrawal",
    payload: body,
    operation: async () => {
      const result = await auth.userClient.rpc("request_account_withdrawal");
      if (result.error) throw new ApiError(503, "database_unavailable", "탈퇴 요청을 접수하지 못했습니다.");
      return { data: { id: auth.user.id, status: "withdrawal_requested", version: 1 }, status: 202 };
    },
  });
};
