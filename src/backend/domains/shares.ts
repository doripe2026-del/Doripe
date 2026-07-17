import { randomBytes } from "node:crypto";
import { z } from "zod";
import { optionalUser, requireUser } from "../core/auth.js";
import { databaseData } from "../core/database.js";
import { backendEnvironment } from "../core/env.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";
import { createBackendAuthClient } from "../core/supabase.js";

const shareInput = z.object({
  targetType: z.enum(["place", "course"]),
  targetId: z.string().min(1).max(100),
  regionId: z.string().min(1).max(80),
}).strict();
const revokeInput = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
const slugSchema = z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/);

function shareSlug(context: RouteContext): string {
  const parsed = slugSchema.safeParse(context.params.slug);
  if (!parsed.success) throw new ApiError(404, "not_found", "공유 링크를 찾을 수 없습니다.");
  return parsed.data;
}

function publicShareUrl(slug: string, fallbackOrigin: string): string {
  const configured = backendEnvironment().appUrl;
  const base = configured ? (/^https?:\/\//.test(configured) ? configured : `https://${configured}`) : fallbackOrigin;
  return new URL(`/shares/${slug}`, base).toString();
}

async function shareTargetPayload(client: ReturnType<typeof createBackendAuthClient>, body: z.infer<typeof shareInput>) {
  if (body.targetType === "place") {
    const place = databaseData<Record<string, unknown>>(await client.from("places")
      .select("id,name,cover_image_url")
      .eq("id", body.targetId).eq("status", "ready").eq("qa_status", "ready").eq("photo_qa_status", "approved")
      .maybeSingle());
    return {
      legacy: {
        content_type: "place",
        title: place.name,
        cover_image_url: place.cover_image_url ?? "",
        place_id: place.id,
        place_ids: [],
      },
      canonical: { target_type: "place", target_place_id: place.id, target_course_id: null },
    };
  }

  const id = z.string().uuid().safeParse(body.targetId);
  if (!id.success) throw new ApiError(404, "not_found", "공유할 코스를 찾을 수 없습니다.");
  const course = databaseData<Record<string, unknown>>(await client.from("courses")
    .select("id,name,is_public,status")
    .eq("id", id.data).eq("status", "active").maybeSingle());
  const places = await client.from("course_places").select("place_id,position")
    .eq("course_id", id.data).order("position", { ascending: true });
  if (places.error || !places.data || places.data.length < 2) {
    throw new ApiError(422, "invalid_share_target", "공유할 수 있는 코스가 아닙니다.");
  }
  return {
    legacy: {
      content_type: "route",
      title: course.name,
      cover_image_url: "",
      place_id: null,
      place_ids: places.data.map((row) => row.place_id),
    },
    canonical: { target_type: "course", target_place_id: null, target_course_id: course.id },
  };
}

export const createShare: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, shareInput, 8 * 1024);
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/shares",
    payload: body,
    operation: async () => {
      const target = await shareTargetPayload(auth.userClient, body);
      const slug = `ds_${randomBytes(12).toString("base64url")}`;
      const result = await auth.userClient.from("shared_links").insert({
        id: slug,
        created_by: auth.user.id,
        region_id: body.regionId,
        ...target.legacy,
        ...target.canonical,
        payload: {},
      }).select("id,target_type,target_place_id,target_course_id,created_at,expires_at").single();
      if (result.error) {
        if (result.error.code === "23503") throw new ApiError(404, "not_found", "공유 대상을 찾을 수 없습니다.");
        throw new ApiError(503, "database_unavailable", "공유 링크를 만들지 못했습니다.");
      }
      return { data: {
        slug: result.data.id,
        targetType: result.data.target_type,
        targetId: body.targetId,
        title: target.legacy.title,
        description: "",
        coverImageUrl: target.legacy.cover_image_url || null,
        url: publicShareUrl(result.data.id, context.url.origin),
        expiresAt: result.data.expires_at,
      }, status: 201 };
    },
  });
};

export const getShare: RouteHandler = async (_request, context) => {
  const slug = shareSlug(context);
  const client = createBackendAuthClient();
  const row = databaseData<Record<string, unknown>>(await client.from("shared_links")
    .select("id,target_type,target_place_id,target_course_id,target_content_id,title,cover_image_url,created_at,expires_at")
    .eq("id", slug).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle());
  return apiSuccess({
    slug: row.id,
    targetType: row.target_type,
    targetId: row.target_place_id ?? row.target_course_id ?? row.target_content_id,
    title: row.title,
    description: "",
    coverImageUrl: row.cover_image_url || null,
    url: publicShareUrl(slug, context.url.origin),
    expiresAt: row.expires_at,
  }, context.requestId, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" } });
};

export const revokeShare: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const slug = shareSlug(context);
  const body = await parseJson(request, revokeInput, 4 * 1024);
  const existing = await auth.userClient.from("shared_links").select("id,revoked_at")
    .eq("id", slug).eq("created_by", auth.user.id).maybeSingle();
  if (existing.error) throw new ApiError(503, "database_unavailable", "공유 링크를 확인하지 못했습니다.");
  if (!existing.data) throw new ApiError(404, "not_found", "공유 링크를 찾을 수 없습니다.");
  if (existing.data.revoked_at) {
    return apiSuccess({ id: slug, status: "revoked", version: 1, duplicate: true }, context.requestId, {
      headers: { "cache-control": "private, no-store" },
    });
  }
  const result = await auth.userClient.from("shared_links").update({
    revoked_at: new Date().toISOString(),
    revoked_by: auth.user.id,
    revocation_reason: body.reason,
  }).eq("id", slug).eq("created_by", auth.user.id).select("id").maybeSingle();
  if (result.error) throw new ApiError(503, "database_unavailable", "공유 링크를 해제하지 못했습니다.");
  if (!result.data) throw new ApiError(404, "not_found", "공유 링크를 찾을 수 없습니다.");
  return apiSuccess({ id: slug, status: "revoked", version: 1, duplicate: false }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};
