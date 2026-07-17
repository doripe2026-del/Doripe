import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "../core/auth.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";
import { createBackendAdminClient } from "../core/supabase.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const mediaUploadSchema = z.object({
  kind: z.enum(["image", "video"]),
  mimeType: z.string().max(100),
  fileName: z.string().min(1).max(180),
  byteSize: z.number().int().min(1),
  durationSeconds: z.number().min(0).nullable().optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceType: z.enum(["user", "curator", "partner"]).optional(),
}).strict();

export const mediaCompleteSchema = z.object({
  storagePath: z.string().min(1).max(500),
  byteSize: z.number().int().min(1),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export function safeUploadFileName(fileName: string, mimeType: string): string {
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  const base = fileName.normalize("NFKC").replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 120) || "image";
  return `${base}.${extension}`;
}

function mediaId(context: RouteContext): string {
  const parsed = z.string().uuid().safeParse(context.params.id);
  if (!parsed.success) throw new ApiError(404, "not_found", "미디어를 찾을 수 없습니다.");
  return parsed.data;
}

function mapMediaError(error: { code?: string } | null): never {
  if (error?.code === "P0002") throw new ApiError(404, "not_found", "미디어를 찾을 수 없습니다.");
  if (error?.code === "42501") throw new ApiError(403, "forbidden", "이 미디어를 변경할 수 없습니다.");
  if (error?.code === "55000") throw new ApiError(409, "media_in_use", "검수 또는 공개 중인 콘텐츠의 미디어는 삭제할 수 없습니다.");
  if (error?.code === "22023" || error?.code === "23514") {
    throw new ApiError(422, "media_metadata_mismatch", "업로드한 파일 정보가 처음 요청과 일치하지 않습니다.");
  }
  throw new ApiError(503, "storage_unavailable", "미디어 요청을 처리하지 못했습니다.");
}

export const createMediaUpload: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, mediaUploadSchema, 8 * 1024);
  if (body.kind !== "image") throw new ApiError(422, "video_upload_disabled", "동영상 업로드는 아직 사용할 수 없습니다.");
  if (!allowedImageMimeTypes.includes(body.mimeType as typeof allowedImageMimeTypes[number])) {
    throw new ApiError(422, "unsupported_media_type", "JPEG, PNG, WebP 이미지만 업로드할 수 있습니다.");
  }
  if (body.byteSize > MAX_IMAGE_BYTES) throw new ApiError(413, "payload_too_large", "이미지는 10 MiB 이하여야 합니다.");
  if (body.durationSeconds != null) throw new ApiError(422, "invalid_media_metadata", "이미지에는 재생 시간을 지정할 수 없습니다.");
  const id = randomUUID();
  const fileName = safeUploadFileName(body.fileName, body.mimeType);
  const storagePath = `${auth.user.id}/${id}/${fileName}`;

  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/media/uploads",
    payload: body,
    operation: async () => {
      const insert = await auth.userClient.from("media_assets").insert({
        id,
        owner_user_id: auth.user.id,
        kind: "image",
        mime_type: body.mimeType,
        original_filename: fileName,
        byte_size: body.byteSize,
        checksum_sha256: body.checksumSha256,
        duration_seconds: null,
        source_type: "user",
        storage_bucket: "media-quarantine",
        storage_path: storagePath,
        status: "pending",
        rights_status: "pending",
      }).select("id,storage_path,status").single();
      if (insert.error) mapMediaError(insert.error);
      const signed = await auth.userClient.storage.from("media-quarantine").createSignedUploadUrl(storagePath, { upsert: false });
      if (signed.error || !signed.data) {
        await auth.userClient.rpc("delete_owned_media_asset", { p_asset_id: id });
        throw new ApiError(503, "storage_unavailable", "업로드 주소를 만들지 못했습니다.");
      }
      return {
        status: 201,
        data: {
          id,
          storagePath,
          uploadUrl: signed.data.signedUrl,
          headers: { contentType: body.mimeType },
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          status: "pending",
        },
      };
    },
  });
};

export const completeMediaUpload: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = mediaId(context);
  const body = await parseJson(request, mediaCompleteSchema, 8 * 1024);
  if (body.byteSize > MAX_IMAGE_BYTES) throw new ApiError(413, "payload_too_large", "이미지는 10 MiB 이하여야 합니다.");
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: `/api/v1/media/${id}/complete`,
    payload: body,
    operation: async () => {
      const result = await auth.userClient.rpc("complete_media_upload", {
        p_asset_id: id,
        p_storage_path: body.storagePath,
        p_byte_size: body.byteSize,
        p_checksum_sha256: body.checksumSha256,
      });
      if (result.error) mapMediaError(result.error);
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row) throw new ApiError(404, "not_found", "미디어를 찾을 수 없습니다.");
      return { data: { id, status: row.status, version: Number(row.version) } };
    },
  });
};

export const deleteMedia: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = mediaId(context);
  const result = await auth.userClient.rpc("delete_owned_media_asset", { p_asset_id: id });
  if (result.error) mapMediaError(result.error);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row) throw new ApiError(404, "not_found", "미디어를 찾을 수 없습니다.");
  if (row.storage_bucket && row.storage_path) {
    await createBackendAdminClient().storage.from(String(row.storage_bucket)).remove([String(row.storage_path)]);
  }
  return apiSuccess({ id, status: "deleted", version: Number(row.version) }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};
