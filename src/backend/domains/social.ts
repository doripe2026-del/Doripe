import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "../core/auth.js";
import { decodeCursor, encodeCursor, parseLimit } from "../core/cursor.js";
import { databaseData, databaseList } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import { publicAvatarUrls } from "../core/profile-avatar.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";
import { createBackendAdminClient, createBackendAuthClient } from "../core/supabase.js";

const uuid = z.string().uuid();
export const commentCreateSchema = z.object({ text: z.string().trim().min(1).max(1000) }).strict();
export const commentUpdateSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  expectedVersion: z.number().int().min(1),
}).strict();

type ProfileRow = {
  avatar_media_id: string | null;
  avatar_path: string | null;
  bio: string;
  display_name: string;
  follower_count: number;
  user_id: string;
};

type CommentRow = {
  author_id: string;
  body: string;
  content_id: string;
  created_at: string;
  id: string;
  like_count: number;
  status: string;
  updated_at: string;
  version: number;
};

function routeUuid(context: RouteContext, field: string, message: string): string {
  const parsed = uuid.safeParse(context.params[field]);
  if (!parsed.success) throw new ApiError(404, "not_found", message);
  return parsed.data;
}

function profileOutput(row: ProfileRow, followedByMe = false, isCurator = false, profileImageUrl: string | null = null) {
  return {
    id: row.user_id,
    nickname: row.display_name,
    introduction: row.bio,
    profileImageUrl,
    isCurator,
    officialBadge: false,
    followedByMe,
    followerCount: row.follower_count,
  };
}

async function curatorUserIds(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const admin = createBackendAdminClient();
  const accounts = databaseList<{ email: string | null; user_id: string }>(await admin.from("user_accounts")
    .select("user_id,email").in("user_id", userIds));
  const emails = accounts.flatMap((account) => account.email ? [account.email.toLowerCase()] : []);
  if (!emails.length) return new Set();
  const accepted = databaseList<{ contact_email: string }>(await admin.from("intake_submissions")
    .select("contact_email").eq("kind", "creator").eq("status", "accepted").in("contact_email", emails));
  const acceptedEmails = new Set(accepted.map((item) => item.contact_email));
  return new Set(accounts.filter((account) => account.email && acceptedEmails.has(account.email.toLowerCase()))
    .map((account) => account.user_id));
}

function mapSocialWriteError(error: { code?: string } | null, resource: "comment" | "content" | "profile"): never {
  if (error?.code === "40001") throw new ApiError(409, "version_conflict", "다른 기기에서 먼저 변경됐습니다.");
  if (error?.code === "P0002") throw new ApiError(404, "not_found", `${resource} 정보를 찾을 수 없습니다.`);
  if (error?.code === "42501") throw new ApiError(403, "forbidden", "이 작업을 수행할 수 없습니다.");
  if (error?.code === "22023" || error?.code === "23514") throw new ApiError(422, "invalid_social_action", "요청 내용을 확인해 주세요.");
  throw new ApiError(503, "database_unavailable", "요청을 저장하지 못했습니다.");
}

async function commentOutput(client: ReturnType<typeof createBackendAuthClient>, row: CommentRow) {
  const profile = databaseData<ProfileRow>(await client.from("public_profiles")
    .select("user_id,display_name,bio,avatar_path,avatar_media_id,follower_count").eq("user_id", row.author_id).maybeSingle());
  const avatarUrls = await publicAvatarUrls([profile]);
  return {
    id: row.id,
    contentId: row.content_id,
    author: profileOutput(profile, false, (await curatorUserIds([profile.user_id])).has(profile.user_id), avatarUrls.get(profile.user_id) ?? null),
    text: row.body,
    likeCount: Number(row.like_count ?? 0),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const followProfile: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const followedId = routeUuid(context, "id", "프로필을 찾을 수 없습니다.");
  if (followedId === auth.user.id) throw new ApiError(422, "cannot_follow_self", "자기 자신은 팔로우할 수 없습니다.");
  databaseData(await auth.userClient.from("public_profiles").select("user_id")
    .eq("user_id", followedId).eq("visibility", "public").maybeSingle());
  const result = await auth.userClient.from("profile_follows").upsert({
    follower_user_id: auth.user.id,
    followed_user_id: followedId,
  }, { onConflict: "follower_user_id,followed_user_id", ignoreDuplicates: true });
  if (result.error) mapSocialWriteError(result.error, "profile");
  return apiSuccess({ id: followedId, status: "following", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const unfollowProfile: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const followedId = routeUuid(context, "id", "프로필을 찾을 수 없습니다.");
  const result = await auth.userClient.from("profile_follows").delete()
    .eq("follower_user_id", auth.user.id).eq("followed_user_id", followedId);
  if (result.error) mapSocialWriteError(result.error, "profile");
  return apiSuccess({ id: followedId, status: "not_following", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const listMyFollowing: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  let query = auth.userClient.from("profile_follows").select("id,followed_user_id,created_at")
    .eq("follower_user_id", auth.user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.value},and(created_at.eq.${cursor.value},id.lt.${cursor.id})`);
  const rows = databaseList<Record<string, unknown>>(await query);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const ids = page.map((row) => String(row.followed_user_id));
  const profiles = ids.length ? databaseList<ProfileRow>(await auth.userClient.from("public_profiles")
    .select("user_id,display_name,bio,avatar_path,avatar_media_id,follower_count").in("user_id", ids)) : [];
  const byId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const curators = await curatorUserIds(ids);
  const avatarUrls = await publicAvatarUrls(profiles);
  const last = page.at(-1);
  return apiSuccess({ items: ids.flatMap((id) => {
    const profile = byId.get(id);
    return profile ? [profileOutput(profile, true, curators.has(id), avatarUrls.get(id) ?? null)] : [];
  }) }, context.requestId, {
    meta: { nextCursor: hasMore && last ? encodeCursor(String(last.created_at), String(last.id), context.url.searchParams) : null },
    headers: { "cache-control": "private, no-store" },
  });
};

export const likeContent: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const contentId = routeUuid(context, "id", "콘텐츠를 찾을 수 없습니다.");
  databaseData(await auth.userClient.from("contents").select("id").eq("id", contentId).eq("status", "published").maybeSingle());
  const result = await auth.userClient.from("content_likes").upsert({ user_id: auth.user.id, content_id: contentId }, {
    onConflict: "user_id,content_id",
    ignoreDuplicates: true,
  });
  if (result.error) mapSocialWriteError(result.error, "content");
  return apiSuccess({ id: contentId, status: "liked", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const unlikeContent: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const contentId = routeUuid(context, "id", "콘텐츠를 찾을 수 없습니다.");
  const result = await auth.userClient.from("content_likes").delete().eq("user_id", auth.user.id).eq("content_id", contentId);
  if (result.error) mapSocialWriteError(result.error, "content");
  return apiSuccess({ id: contentId, status: "not_liked", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const likeComment: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const commentId = routeUuid(context, "id", "댓글을 찾을 수 없습니다.");
  databaseData(await auth.userClient.from("comments").select("id")
    .eq("id", commentId).eq("status", "visible").maybeSingle());
  const result = await auth.userClient.from("comment_likes").upsert({ user_id: auth.user.id, comment_id: commentId }, {
    onConflict: "user_id,comment_id",
    ignoreDuplicates: true,
  });
  if (result.error) mapSocialWriteError(result.error, "comment");
  return apiSuccess({ id: commentId, status: "liked", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const unlikeComment: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const commentId = routeUuid(context, "id", "댓글을 찾을 수 없습니다.");
  const result = await auth.userClient.from("comment_likes").delete()
    .eq("user_id", auth.user.id).eq("comment_id", commentId);
  if (result.error) mapSocialWriteError(result.error, "comment");
  return apiSuccess({ id: commentId, status: "not_liked", version: 1 }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const listContentComments: RouteHandler = async (_request, context) => {
  const contentId = routeUuid(context, "id", "콘텐츠를 찾을 수 없습니다.");
  const client = createBackendAuthClient();
  databaseData(await client.from("contents").select("id").eq("id", contentId).eq("status", "published").maybeSingle());
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  let query = client.from("comments").select("id,content_id,author_id,body,status,like_count,version,created_at,updated_at")
    .eq("content_id", contentId).eq("status", "visible")
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(limit + 1);
  if (cursor) query = query.or(`created_at.gt.${cursor.value},and(created_at.eq.${cursor.value},id.gt.${cursor.id})`);
  const rows = databaseList<CommentRow>(await query);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const authorIds = [...new Set(page.map((row) => row.author_id))];
  const profiles = authorIds.length ? databaseList<ProfileRow>(await client.from("public_profiles")
    .select("user_id,display_name,bio,avatar_path,avatar_media_id,follower_count").in("user_id", authorIds)) : [];
  const byId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const curators = await curatorUserIds(authorIds);
  const avatarUrls = await publicAvatarUrls(profiles);
  const items = page.flatMap((row) => {
    const author = byId.get(row.author_id);
    return author ? [{
      id: row.id,
      contentId: row.content_id,
      author: profileOutput(author, false, curators.has(author.user_id), avatarUrls.get(author.user_id) ?? null),
      text: row.body,
      likeCount: Number(row.like_count ?? 0),
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }] : [];
  });
  const last = page.at(-1);
  return apiSuccess({ items }, context.requestId, {
    meta: { nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id, context.url.searchParams) : null },
    headers: { "cache-control": "public, max-age=15" },
  });
};

export const createComment: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const contentId = routeUuid(context, "id", "콘텐츠를 찾을 수 없습니다.");
  const body = await parseJson(request, commentCreateSchema, 8 * 1024);
  const id = randomUUID();
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: `/api/v1/contents/${contentId}/comments`,
    payload: body,
    operation: async () => {
      const result = await auth.userClient.from("comments").insert({
        id,
        content_id: contentId,
        author_id: auth.user.id,
        body: body.text,
      }).select("id,content_id,author_id,body,status,like_count,version,created_at,updated_at").single();
      if (result.error) mapSocialWriteError(result.error, "comment");
      return { data: await commentOutput(auth.userClient, result.data as CommentRow), status: 201 };
    },
  });
};

export const updateComment: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const commentId = routeUuid(context, "id", "댓글을 찾을 수 없습니다.");
  const body = await parseJson(request, commentUpdateSchema, 8 * 1024);
  const result = await auth.userClient.rpc("update_owned_comment", {
    p_comment_id: commentId,
    p_body: body.text,
    p_expected_version: body.expectedVersion,
  });
  if (result.error) mapSocialWriteError(result.error, "comment");
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row) throw new ApiError(404, "not_found", "댓글을 찾을 수 없습니다.");
  return apiSuccess(await commentOutput(auth.userClient, row as CommentRow), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const deleteComment: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const commentId = routeUuid(context, "id", "댓글을 찾을 수 없습니다.");
  const result = await auth.userClient.rpc("hide_owned_comment", { p_comment_id: commentId });
  if (result.error) mapSocialWriteError(result.error, "comment");
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row) throw new ApiError(404, "not_found", "댓글을 찾을 수 없습니다.");
  return apiSuccess({ id: commentId, status: "hidden", version: Number(row.version) }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};
