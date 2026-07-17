import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { optionalUser, requireUser, type UserContext } from "../core/auth.js";
import { decodeCursor, encodeCursor, parseLimit } from "../core/cursor.js";
import { databaseData, databaseList } from "../core/database.js";
import { ApiError, validationError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { consumeDevelopmentRateLimit } from "../core/rateLimit.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import { publicAvatarUrls } from "../core/profile-avatar.js";
import type { RouteContext, RouteHandler } from "../core/router.js";
import { createBackendAdminClient, createBackendAuthClient } from "../core/supabase.js";

const uuid = z.string().uuid();
const safeId = z.string().min(1).max(96).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);
const uniqueSafeIds = z.array(safeId).min(1).max(30)
  .refine((values) => new Set(values).size === values.length, "장소가 중복됐습니다.");
const uniqueMediaIds = z.array(uuid).max(5)
  .refine((values) => new Set(values).size === values.length, "미디어가 중복됐습니다.");

export const contentCreateSchema = z.object({
  type: z.enum(["place", "course"]),
  caption: z.string().max(2000),
  placeIds: uniqueSafeIds,
  courseId: uuid.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.type === "place" && value.courseId != null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["courseId"], message: "장소 콘텐츠에는 코스를 지정할 수 없습니다." });
  }
  if (value.type === "course" && !value.courseId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["courseId"], message: "코스 콘텐츠에는 courseId가 필요합니다." });
  }
});

export const contentUpdateSchema = z.object({
  caption: z.string().max(2000).optional(),
  placeIds: uniqueSafeIds.optional(),
  courseId: uuid.nullable().optional(),
  mediaIds: uniqueMediaIds.optional(),
  expectedVersion: z.number().int().min(1),
}).strict();

export const contentSubmitSchema = z.object({ expectedVersion: z.number().int().min(1) }).strict();

export const feedQuerySchema = z.object({
  scope: z.enum(["discover", "following"]).default("discover"),
  regionId: safeId.optional(),
  categoryId: safeId.optional(),
  tagIds: z.string().max(2000).optional(),
  centerLat: z.coerce.number().min(-90).max(90).optional(),
  centerLng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(50).optional(),
  cursor: z.string().max(2048).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
}).strict().superRefine((value, context) => {
  const locationValues = [value.centerLat, value.centerLng, value.radiusKm];
  const supplied = locationValues.filter((item) => item !== undefined).length;
  if (supplied !== 0 && supplied !== locationValues.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["centerLat"],
      message: "centerLat, centerLng, radiusKm를 모두 함께 입력해 주세요.",
    });
  }
});

type GeoPoint = {
  latitude: number;
  longitude: number;
};

type PlaceCoordinateRow = {
  id: string;
  lat: number | string | null;
  lng: number | string | null;
};

type RadiusFilter = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

export function distanceInKilometers(left: GeoPoint, right: GeoPoint): number {
  const earthRadiusKm = 6371.0088;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function placeIdsWithinRadius(rows: PlaceCoordinateRow[], filter: RadiusFilter): string[] {
  const center = { latitude: filter.centerLat, longitude: filter.centerLng };
  return rows.flatMap((row) => {
    const latitude = row.lat === null ? Number.NaN : Number(row.lat);
    const longitude = row.lng === null ? Number.NaN : Number(row.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return distanceInKilometers(center, { latitude, longitude }) <= filter.radiusKm ? [row.id] : [];
  });
}

type ContentRow = {
  author_id: string;
  caption: string;
  comment_count: number;
  course_id: string | null;
  created_at: string;
  id: string;
  like_count: number;
  published_at: string | null;
  status: "draft" | "submitted" | "reviewing" | "published" | "rejected" | "hidden";
  type: "place" | "course";
  updated_at: string;
  version: number;
};

type ProfileRow = {
  avatar_media_id: string | null;
  avatar_path: string | null;
  bio: string;
  display_name: string;
  follower_count: number;
  user_id: string;
  visibility: string;
};

type MediaRow = {
  id: string;
  kind: "image" | "video";
  owner_user_id: string;
  rights_status: "pending" | "approved" | "rejected";
  status: "pending" | "uploaded" | "approved" | "rejected" | "deleted";
  storage_bucket: string;
  storage_path: string;
};

const contentSelection = [
  "id", "author_id", "type", "caption", "course_id", "status", "version", "like_count", "comment_count",
  "created_at", "updated_at", "published_at",
].join(",");

function requiredUuid(value: string | undefined, message: string): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "not_found", message);
  return parsed.data;
}

function requiredPlaceId(value: string | undefined): string {
  const parsed = safeId.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "not_found", "장소를 찾을 수 없습니다.");
  return parsed.data;
}

function mapContentMutationError(error: { code?: string } | null): never {
  if (error?.code === "40001") throw new ApiError(409, "version_conflict", "콘텐츠가 다른 기기에서 변경됐습니다.");
  if (error?.code === "P0002") throw new ApiError(404, "not_found", "콘텐츠를 찾을 수 없습니다.");
  if (error?.code === "42501") throw new ApiError(403, "forbidden", "이 콘텐츠를 변경할 수 없습니다.");
  if (error?.code === "22023" || error?.code === "23503") {
    throw new ApiError(422, "invalid_content", "콘텐츠의 장소, 코스, 미디어 상태를 확인해 주세요.");
  }
  throw new ApiError(503, "database_unavailable", "콘텐츠를 저장하지 못했습니다.");
}

function publicProfile(row: ProfileRow, followedByMe = false, isCurator = false, profileImageUrl: string | null = null) {
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

async function signedMediaUrls(rows: MediaRow[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const admin = createBackendAdminClient();
  const byBucket = new Map<string, MediaRow[]>();
  for (const row of rows) byBucket.set(row.storage_bucket, [...(byBucket.get(row.storage_bucket) ?? []), row]);

  await Promise.all(Array.from(byBucket, async ([bucket, assets]) => {
    const signed = await admin.storage.from(bucket).createSignedUrls(assets.map((asset) => asset.storage_path), 300);
    if (signed.error || !signed.data) return;
    for (let index = 0; index < assets.length; index += 1) {
      const url = signed.data[index]?.signedUrl;
      if (url) result.set(assets[index].id, url);
    }
  }));
  return result;
}

async function hydrateContents(client: SupabaseClient, rows: ContentRow[], viewerId?: string) {
  if (!rows.length) return [];
  const contentIds = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const admin = createBackendAdminClient();
  const [profilesResult, placesResult, linksResult, likesResult, accountsResult, followsResult] = await Promise.all([
    client.from("public_profiles").select("user_id,display_name,bio,avatar_path,avatar_media_id,visibility,follower_count").in("user_id", authorIds),
    client.from("content_places").select("content_id,place_id,position").in("content_id", contentIds).order("position", { ascending: true }),
    client.from("content_media").select("content_id,media_asset_id,position").in("content_id", contentIds).order("position", { ascending: true }),
    viewerId
      ? client.from("content_likes").select("content_id").eq("user_id", viewerId).in("content_id", contentIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from("user_accounts").select("user_id,email").in("user_id", authorIds),
    viewerId
      ? client.from("profile_follows").select("followed_user_id").eq("follower_user_id", viewerId).in("followed_user_id", authorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const profiles = databaseList<ProfileRow>(profilesResult);
  const places = databaseList<Record<string, unknown>>(placesResult);
  const links = databaseList<Record<string, unknown>>(linksResult);
  const likes = databaseList<Record<string, unknown>>(likesResult);
  const accounts = databaseList<{ email: string | null; user_id: string }>(accountsResult);
  const followedIds = new Set(databaseList<{ followed_user_id: string }>(followsResult).map((item) => item.followed_user_id));
  const emails = accounts.flatMap((account) => account.email ? [account.email.toLowerCase()] : []);
  const curatorRows = emails.length ? databaseList<{ contact_email: string }>(await admin.from("intake_submissions")
    .select("contact_email").eq("kind", "creator").eq("status", "accepted").in("contact_email", emails)) : [];
  const curatorEmails = new Set(curatorRows.map((item) => item.contact_email));
  const emailByUser = new Map(accounts.map((account) => [account.user_id, account.email?.toLowerCase() ?? ""]));
  const assetIds = [...new Set(links.map((link) => String(link.media_asset_id)))];
  const assets = assetIds.length
    ? databaseList<MediaRow>(await admin.from("media_assets")
      .select("id,owner_user_id,kind,storage_bucket,storage_path,status,rights_status").in("id", assetIds))
    : [];
  const visibleAssets = assets.filter((asset) => rows.some((content) =>
    content.author_id === viewerId
      ? asset.owner_user_id === viewerId && ["uploaded", "approved"].includes(asset.status)
      : asset.status === "approved" && asset.rights_status === "approved",
  ));
  const urls = await signedMediaUrls(visibleAssets);
  const avatarUrls = await publicAvatarUrls(profiles);
  const profileById = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const assetById = new Map(visibleAssets.map((asset) => [asset.id, asset]));
  const likedIds = new Set(likes.map((like) => String(like.content_id)));

  return rows.map((row) => {
    const author = profileById.get(row.author_id);
    if (!author) throw new ApiError(503, "profile_unavailable", "작성자 정보를 불러오지 못했습니다.");
    const contentMedia = links
      .filter((link) => link.content_id === row.id)
      .sort((left, right) => Number(left.position) - Number(right.position))
      .flatMap((link) => {
        const asset = assetById.get(String(link.media_asset_id));
        const url = asset ? urls.get(asset.id) : undefined;
        return asset && url ? [{
          id: asset.id,
          kind: asset.kind,
          url,
          thumbnailUrl: null,
          position: Number(link.position),
          rightsStatus: asset.rights_status,
          placeId: null,
        }] : [];
      });
    return {
      id: row.id,
      type: row.type,
      author: publicProfile(
        author,
        followedIds.has(row.author_id),
        curatorEmails.has(emailByUser.get(row.author_id) ?? ""),
        avatarUrls.get(row.author_id) ?? null,
      ),
      caption: row.caption,
      placeIds: places.filter((place) => place.content_id === row.id)
        .sort((left, right) => Number(left.position) - Number(right.position))
        .map((place) => String(place.place_id)),
      courseId: row.course_id,
      media: contentMedia,
      status: row.status,
      version: row.version,
      likedByMe: likedIds.has(row.id),
      likeCount: row.like_count,
      commentCount: row.comment_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
    };
  });
}

async function contentById(client: SupabaseClient, id: string, viewerId?: string) {
  const row = databaseData<ContentRow>(await client.from("contents").select(contentSelection).eq("id", id).maybeSingle());
  return (await hydrateContents(client, [row], viewerId))[0];
}

async function contentListResponse(
  context: RouteContext,
  client: SupabaseClient,
  query: ReturnType<SupabaseClient["from"]> extends never ? never : any,
  orderColumn: "published_at" | "updated_at",
  viewerId?: string,
) {
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  let paged = query.order(orderColumn, { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (cursor) paged = paged.or(`${orderColumn}.lt.${cursor.value},and(${orderColumn}.eq.${cursor.value},id.lt.${cursor.id})`);
  const rows = databaseList<ContentRow>(await paged);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const cursorValue = last ? (orderColumn === "published_at" ? last.published_at : last.updated_at) : null;
  return apiSuccess({ items: await hydrateContents(client, page, viewerId) }, context.requestId, {
    meta: { nextCursor: hasMore && last && cursorValue ? encodeCursor(cursorValue, last.id, context.url.searchParams) : null },
    headers: { "cache-control": viewerId ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" },
  });
}

function hasFeedFilters(input: z.infer<typeof feedQuerySchema>): boolean {
  const hasRadiusFilter = input.centerLat !== undefined && input.centerLng !== undefined && input.radiusKm !== undefined;
  return Boolean(input.regionId || input.categoryId || input.tagIds || hasRadiusFilter);
}

function feedRateLimitActor(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? "";
  return `anonymous:${createHash("sha256").update(`${address}|${userAgent}`).digest("hex")}`;
}

async function filteredContentListResponse(
  context: RouteContext,
  client: SupabaseClient,
  input: z.infer<typeof feedQuerySchema>,
  viewerId?: string,
) {
  const tagIds = input.tagIds
    ? [...new Set(input.tagIds.split(",").filter(Boolean))]
    : [];
  const parsedTags = z.array(uuid).max(20).safeParse(tagIds);
  if (!parsedTags.success) throw validationError(parsedTags.error);
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  const rows = databaseList<ContentRow>(await client.rpc("filter_feed_contents", {
    p_scope: input.scope,
    p_region_id: input.regionId ?? null,
    p_category_id: input.categoryId ?? null,
    p_tag_ids: parsedTags.data.length ? parsedTags.data : null,
    p_center_lat: input.centerLat ?? null,
    p_center_lng: input.centerLng ?? null,
    p_radius_km: input.radiusKm ?? null,
    p_cursor_published_at: cursor?.value ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit + 1,
  }));
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return apiSuccess({ items: await hydrateContents(client, page, viewerId) }, context.requestId, {
    meta: {
      nextCursor: hasMore && last?.published_at
        ? encodeCursor(last.published_at, last.id, context.url.searchParams)
        : null,
    },
    headers: { "cache-control": viewerId ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" },
  });
}

export const listFeed: RouteHandler = async (request, context) => {
  const raw = Object.fromEntries(context.url.searchParams.entries());
  const parsed = feedQuerySchema.safeParse(raw);
  if (!parsed.success) throw validationError(parsed.error);
  const auth = await optionalUser(request);
  if (parsed.data.scope === "following" && !auth) throw new ApiError(401, "unauthenticated", "로그인이 필요합니다.");
  await consumeDevelopmentRateLimit(`feed:${feedRateLimitActor(request, auth?.user.id)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  const client = auth?.userClient ?? createBackendAuthClient();
  if (parsed.data.scope === "following" || hasFeedFilters(parsed.data)) {
    return filteredContentListResponse(context, client, parsed.data, auth?.user.id);
  }
  const query = client.from("contents").select(contentSelection).eq("status", "published");
  return contentListResponse(context, client, query, "published_at", auth?.user.id);
};

export const listPlaceContents: RouteHandler = async (_request, context) => {
  const id = requiredPlaceId(context.params.id);
  const client = createBackendAuthClient();
  databaseData(await client.from("places").select("id").eq("id", id).eq("status", "ready").maybeSingle());
  const linked = databaseList<{ content_id: string }>(await client.from("content_places").select("content_id").eq("place_id", id).limit(5000));
  const ids = linked.map((item) => item.content_id);
  if (!ids.length) return apiSuccess({ items: [] }, context.requestId, { meta: { nextCursor: null } });
  const query = client.from("contents").select(contentSelection).eq("status", "published").in("id", ids);
  return contentListResponse(context, client, query, "published_at");
};

export const getContent: RouteHandler = async (request, context) => {
  const id = requiredUuid(context.params.id, "콘텐츠를 찾을 수 없습니다.");
  const auth = await optionalUser(request);
  const client = auth?.userClient ?? createBackendAuthClient();
  return apiSuccess(await contentById(client, id, auth?.user.id), context.requestId, {
    headers: { "cache-control": auth ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" },
  });
};

export const listProfileContents: RouteHandler = async (_request, context) => {
  const profileId = requiredUuid(context.params.id, "프로필을 찾을 수 없습니다.");
  const client = createBackendAuthClient();
  databaseData(await client.from("public_profiles").select("user_id").eq("user_id", profileId).eq("visibility", "public").maybeSingle());
  return contentListResponse(
    context,
    client,
    client.from("contents").select(contentSelection).eq("author_id", profileId).eq("status", "published"),
    "published_at",
  );
};

export const listMyContents: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const status = context.url.searchParams.get("status");
  const allowed = ["draft", "submitted", "reviewing", "published", "rejected", "hidden"];
  if (status && !allowed.includes(status)) throw new ApiError(400, "invalid_status", "콘텐츠 상태를 확인해 주세요.");
  let query = auth.userClient.from("contents").select(contentSelection).eq("author_id", auth.user.id);
  if (status) query = query.eq("status", status);
  return contentListResponse(context, auth.userClient, query, "updated_at", auth.user.id);
};

export const createContent: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, contentCreateSchema, 32 * 1024);
  const id = randomUUID();
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/contents",
    payload: body,
    operation: async () => {
      const result = await auth.userClient.rpc("upsert_content_draft", {
        p_content_id: id,
        p_type: body.type,
        p_caption: body.caption,
        p_course_id: body.courseId ?? null,
        p_expected_version: 0,
        p_place_ids: body.placeIds,
        p_media_ids: [],
      });
      if (result.error) mapContentMutationError(result.error);
      return { data: await contentById(auth.userClient, id, auth.user.id), status: 201 };
    },
  });
};

async function editableState(auth: UserContext, id: string) {
  const row = databaseData<ContentRow>(await auth.userClient.from("contents").select(contentSelection)
    .eq("id", id).eq("author_id", auth.user.id).maybeSingle());
  const [places, media] = await Promise.all([
    auth.userClient.from("content_places").select("place_id,position").eq("content_id", id).order("position"),
    auth.userClient.from("content_media").select("media_asset_id,position").eq("content_id", id).order("position"),
  ]);
  return {
    row,
    placeIds: databaseList<Record<string, unknown>>(places).map((item) => String(item.place_id)),
    mediaIds: databaseList<Record<string, unknown>>(media).map((item) => String(item.media_asset_id)),
  };
}

export const updateContent: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requiredUuid(context.params.id, "콘텐츠를 찾을 수 없습니다.");
  const body = await parseJson(request, contentUpdateSchema, 32 * 1024);
  const current = await editableState(auth, id);
  const result = await auth.userClient.rpc("upsert_content_draft", {
    p_content_id: id,
    p_type: current.row.type,
    p_caption: body.caption ?? current.row.caption,
    p_course_id: Object.hasOwn(body, "courseId") ? body.courseId : current.row.course_id,
    p_expected_version: body.expectedVersion,
    p_place_ids: body.placeIds ?? current.placeIds,
    p_media_ids: body.mediaIds ?? current.mediaIds,
  });
  if (result.error) mapContentMutationError(result.error);
  return apiSuccess(await contentById(auth.userClient, id, auth.user.id), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const submitContent: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requiredUuid(context.params.id, "콘텐츠를 찾을 수 없습니다.");
  const body = await parseJson(request, contentSubmitSchema, 8 * 1024);
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: `/api/v1/contents/${id}/submit`,
    payload: body,
    operation: async () => {
      const result = await auth.userClient.rpc("submit_content", { p_content_id: id, p_expected_version: body.expectedVersion });
      if (result.error) mapContentMutationError(result.error);
      return { data: await contentById(auth.userClient, id, auth.user.id) };
    },
  });
};
