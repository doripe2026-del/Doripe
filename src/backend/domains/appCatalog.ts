import { z } from "zod";
import { optionalUser } from "../core/auth.js";
import { databaseData, databaseList } from "../core/database.js";
import { ApiError, validationError } from "../core/errors.js";
import { apiSuccess } from "../core/response.js";
import type { RouteHandler } from "../core/router.js";
import { createBackendAuthClient } from "../core/supabase.js";
import { distanceInKilometers, feedQuerySchema } from "./contents.js";

const uuid = z.string().uuid();
const SYSTEM_PROFILE_ID = "00000000-0000-4000-8000-000000000001";

type NeighborhoodRow = {
  display_order: number;
  id: string;
  name: string;
  short_name: string | null;
};

type TagGroupRow = {
  id: string;
  key: string;
  label: string;
};

type TagRow = {
  color_token: string | null;
  display_order: number;
  group_id: string;
  id: string;
  key: string;
  label: string;
};

type PlaceRow = {
  address: string | null;
  app_status: string;
  detail_copy: string | null;
  display_order: number;
  id: string;
  map_image_url: string | null;
  metadata: Record<string, unknown> | null;
  name: string;
  naver_place_url: string | null;
  neighborhood_id: string;
  opening_hours_text: string | null;
  phone_text: string | null;
  place_type_tag_id: string;
  representative_menu_price: string | null;
  representative_menu_text: string | null;
  short_copy: string | null;
  updated_at: string;
};

type PhotoRow = {
  alt_text: string | null;
  display_order: number;
  id: string;
  is_cover: boolean;
  place_id: string;
  public_url: string;
};

type PlaceTagRow = { place_id: string; tag_id: string };

const placeSelection = [
  "id", "neighborhood_id", "place_type_tag_id", "name", "short_copy", "detail_copy", "address",
  "naver_place_url", "phone_text", "opening_hours_text", "representative_menu_text",
  "representative_menu_price", "map_image_url", "app_status", "display_order", "metadata", "updated_at",
].join(",");

const systemProfile = Object.freeze({
  id: SYSTEM_PROFILE_ID,
  nickname: "Doripe",
  introduction: "사진에서 발견하는 오늘의 장소",
  profileImageUrl: null,
  isCurator: true,
  officialBadge: true,
  followedByMe: false,
  followerCount: 0,
});

function numberFromMetadata(metadata: Record<string, unknown> | null, ...keys: string[]): number {
  for (const key of keys) {
    const value = Number(metadata?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function textFromMetadata(metadata: Record<string, unknown> | null, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function currentCatalogPlaceOutput(
  row: PlaceRow,
  photos: PhotoRow[],
  placeType: TagRow,
  tags: TagRow[],
) {
  const latitude = numberFromMetadata(row.metadata, "latitude", "lat");
  const longitude = numberFromMetadata(row.metadata, "longitude", "lng");
  const nearestStation = textFromMetadata(row.metadata, "nearestStation", "nearest_station");
  return {
    id: row.id,
    name: row.name,
    shortCopy: row.short_copy || row.detail_copy || "",
    neighborhoodId: row.neighborhood_id,
    address: row.address || "",
    nearestStation,
    phoneText: row.phone_text,
    latitude,
    longitude,
    category: { id: placeType.id, name: placeType.label, displayOrder: placeType.display_order },
    tags: tags.map((tag) => ({ id: tag.id, kind: tag.key, name: tag.label })),
    moodTags: tags.filter((tag) => tag.key.startsWith("mood")).map((tag) => tag.label),
    bestFor: tags.filter((tag) => tag.key.startsWith("situation")).map((tag) => tag.label),
    timeTags: tags.filter((tag) => tag.key.startsWith("time")).map((tag) => tag.label),
    media: photos.slice(0, 5).map((photo, index) => ({
      id: photo.id,
      kind: "image",
      url: photo.public_url,
      thumbnailUrl: null,
      position: index,
      rightsStatus: "approved",
      placeId: row.id,
      altText: photo.alt_text || row.name,
    })),
    status: "published",
    hoursText: row.opening_hours_text,
    priceLevel: null,
    representativeMenuName: row.representative_menu_text,
    representativeMenuPrice: row.representative_menu_price,
    representativeMenu: row.representative_menu_text || row.representative_menu_price ? {
      name: row.representative_menu_text,
      price: row.representative_menu_price,
    } : null,
    stayTimeMinutes: numberFromMetadata(row.metadata, "stayTimeMinutes", "stay_time_minutes") || null,
    externalMapUrl: row.naver_place_url,
    mapImageUrl: row.map_image_url,
    updatedAt: row.updated_at,
  };
}

function contentFromPlace(place: ReturnType<typeof currentCatalogPlaceOutput>) {
  return {
    id: place.id,
    type: "place",
    author: systemProfile,
    caption: place.shortCopy,
    placeIds: [place.id],
    courseId: null,
    media: place.media,
    status: "published",
    version: 1,
    likedByMe: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: place.updatedAt,
    updatedAt: place.updatedAt,
    publishedAt: place.updatedAt,
  };
}

async function taxonomy(client: ReturnType<typeof createBackendAuthClient>) {
  const [groupsResult, tagsResult] = await Promise.all([
    client.from("tag_groups").select("id,key,label").eq("status", "active").order("display_order"),
    client.from("tags").select("id,group_id,key,label,color_token,display_order").eq("status", "active").order("display_order"),
  ]);
  const groups = databaseList<TagGroupRow>(groupsResult);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const tags = databaseList<TagRow>(tagsResult).map((tag) => ({
    ...tag,
    key: groupById.get(tag.group_id)?.key || tag.key,
  }));
  return { groups, tags };
}

async function placePhotos(client: ReturnType<typeof createBackendAuthClient>, placeIds: string[]) {
  if (!placeIds.length) return new Map<string, PhotoRow[]>();
  const rows = databaseList<PhotoRow>(await client.from("place_photos")
    .select("id,place_id,public_url,alt_text,is_cover,display_order")
    .in("place_id", placeIds).eq("status", "active")
    .order("is_cover", { ascending: false }).order("display_order"));
  const result = new Map<string, PhotoRow[]>();
  for (const row of rows) result.set(row.place_id, [...(result.get(row.place_id) || []), row]);
  return result;
}

async function tagsByPlace(client: ReturnType<typeof createBackendAuthClient>, placeIds: string[], allTags: TagRow[]) {
  if (!placeIds.length) return new Map<string, TagRow[]>();
  const rows = databaseList<PlaceTagRow>(await client.from("place_tags").select("place_id,tag_id").in("place_id", placeIds));
  const tagById = new Map(allTags.map((tag) => [tag.id, tag]));
  const result = new Map<string, TagRow[]>();
  for (const row of rows) {
    const tag = tagById.get(row.tag_id);
    if (tag) result.set(row.place_id, [...(result.get(row.place_id) || []), tag]);
  }
  return result;
}

async function hydratePlaces(client: ReturnType<typeof createBackendAuthClient>, rows: PlaceRow[]) {
  const { tags } = await taxonomy(client);
  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const [photos, relations] = await Promise.all([
    placePhotos(client, rows.map((row) => row.id)),
    tagsByPlace(client, rows.map((row) => row.id), tags),
  ]);
  return rows.map((row) => currentCatalogPlaceOutput(
    row,
    photos.get(row.id) || [],
    tagById.get(row.place_type_tag_id) || {
      id: row.place_type_tag_id,
      group_id: "",
      key: "place_type",
      label: "미분류",
      color_token: null,
      display_order: 0,
    },
    relations.get(row.id) || [],
  ));
}

export const appCatalogBootstrap: RouteHandler = async (_request, context) => {
  const client = createBackendAuthClient();
  const [neighborhoodResult, taxonomyResult] = await Promise.all([
    client.from("neighborhoods").select("id,name,short_name,display_order")
      .eq("is_visible", true).in("status", ["active", "coming_soon"]).order("display_order"),
    taxonomy(client),
  ]);
  const neighborhoods = databaseList<NeighborhoodRow>(neighborhoodResult);
  const { groups, tags } = taxonomyResult;
  const placeTypeGroupIds = new Set(groups.filter((group) => ["place_type", "type", "category"].includes(group.key)).map((group) => group.id));
  const categories = tags.filter((tag) => placeTypeGroupIds.has(tag.group_id));
  return apiSuccess({
    regions: neighborhoods.map((row) => ({ id: row.id, name: row.short_name || row.name, enabled: true })),
    categories: categories.map((tag) => ({ id: tag.id, name: tag.label, displayOrder: tag.display_order })),
    tags: tags.map((tag) => ({ id: tag.id, kind: tag.key, name: tag.label })),
    featureFlags: { videoUpload: false, contentShare: true },
    contractVersions: { api: "v1", onboarding: 1, notifications: 1, analytics: 1 },
  }, context.requestId, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=60" } });
};

export const appCatalogFeed: RouteHandler = async (request, context) => {
  const parsed = feedQuerySchema.safeParse(Object.fromEntries(context.url.searchParams.entries()));
  if (!parsed.success) throw validationError(parsed.error);
  const auth = await optionalUser(request);
  if (parsed.data.scope === "following") {
    if (!auth) throw new ApiError(401, "unauthenticated", "로그인이 필요합니다.");
    return apiSuccess({ items: [] }, context.requestId, { meta: { nextCursor: null } });
  }
  const client = auth?.userClient || createBackendAuthClient();
  let query = client.from("places").select(placeSelection).eq("app_status", "published")
    .order("display_order").order("updated_at", { ascending: false }).limit(Math.min(Number(parsed.data.limit || 30), 100));
  if (parsed.data.regionId) query = query.eq("neighborhood_id", parsed.data.regionId);
  if (parsed.data.categoryId) query = query.eq("place_type_tag_id", parsed.data.categoryId);
  let rows = databaseList<PlaceRow>(await query);
  if (parsed.data.tagIds && rows.length) {
    const requested = parsed.data.tagIds.split(",").filter(Boolean);
    const relationRows = databaseList<PlaceTagRow>(await client.from("place_tags")
      .select("place_id,tag_id").in("place_id", rows.map((row) => row.id)).in("tag_id", requested));
    const matched = new Set(relationRows.map((row) => row.place_id));
    rows = rows.filter((row) => matched.has(row.id));
  }
  if (parsed.data.centerLat !== undefined && parsed.data.centerLng !== undefined && parsed.data.radiusKm !== undefined) {
    rows = rows.filter((row) => distanceInKilometers(
      { latitude: parsed.data.centerLat!, longitude: parsed.data.centerLng! },
      {
        latitude: numberFromMetadata(row.metadata, "latitude", "lat"),
        longitude: numberFromMetadata(row.metadata, "longitude", "lng"),
      },
    ) <= parsed.data.radiusKm!);
  }
  const places = await hydratePlaces(client, rows);
  return apiSuccess({ items: places.map(contentFromPlace) }, context.requestId, {
    meta: { nextCursor: null },
    headers: { "cache-control": auth ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" },
  });
};

async function placeById(client: ReturnType<typeof createBackendAuthClient>, id: string) {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) throw new ApiError(404, "not_found", "장소를 찾을 수 없습니다.");
  const row = databaseData<PlaceRow>(await client.from("places").select(placeSelection)
    .eq("id", parsed.data).eq("app_status", "published").maybeSingle());
  return (await hydratePlaces(client, [row]))[0];
}

export const appCatalogPlaceDetail: RouteHandler = async (_request, context) => {
  const client = createBackendAuthClient();
  return apiSuccess(await placeById(client, context.params.id || ""), context.requestId, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" },
  });
};

export const appCatalogContentDetail: RouteHandler = async (request, context) => {
  const auth = await optionalUser(request);
  const client = auth?.userClient || createBackendAuthClient();
  const place = await placeById(client, context.params.id || "");
  return apiSuccess(contentFromPlace(place), context.requestId, {
    headers: { "cache-control": auth ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" },
  });
};

export const appCatalogProfile: RouteHandler = async (_request, context) => {
  if (context.params.id !== SYSTEM_PROFILE_ID) throw new ApiError(404, "not_found", "프로필을 찾을 수 없습니다.");
  return apiSuccess(systemProfile, context.requestId, {
    headers: { "cache-control": "public, max-age=300, stale-while-revalidate=60" },
  });
};

export const appCatalogRelatedPlaces: RouteHandler = async (_request, context) => {
  const client = createBackendAuthClient();
  const origin = await placeById(client, context.params.id || "");
  const rows = databaseList<PlaceRow>(await client.from("places").select(placeSelection)
    .eq("app_status", "published").eq("neighborhood_id", origin.neighborhoodId)
    .neq("id", origin.id).order("display_order").limit(12));
  return apiSuccess({ items: await hydratePlaces(client, rows) }, context.requestId, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" },
  });
};
