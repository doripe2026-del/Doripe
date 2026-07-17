import { z } from "zod";
import { databaseData, databaseList } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { apiSuccess } from "../core/response.js";
import type { RouteHandler } from "../core/router.js";
import { createBackendAdminClient, createBackendAuthClient } from "../core/supabase.js";

const placeId = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const profileId = z.string().uuid();

type PlaceRow = {
  address: string;
  best_for: string[];
  category_id: string;
  created_at: string;
  hours_text: string;
  id: string;
  lat: number;
  lng: number;
  mood_tags: string[];
  name: string;
  naver_place_url: string;
  neighborhood_id: string;
  nearest_station: string;
  phone_text?: string;
  price_hint: string;
  representative_menu_name?: string;
  representative_menu_price?: string;
  short_copy: string;
  stay_time_minutes: number;
  time_tags: string[];
  updated_at: string;
};

type PhotoRow = {
  credit_text: string;
  display_order: number;
  id: string;
  place_id: string;
  public_url: string;
  permission_status: "approved" | "pending";
};

type CategoryRow = { display_order: number; id: string; name: string };
type TagRow = { id: string; group_key: string; name: string };

const placeSelection = [
  "id", "name", "short_copy", "neighborhood_id", "category_id", "mood_tags", "best_for", "time_tags",
  "lat", "lng", "address", "nearest_station", "hours_text", "price_hint", "stay_time_minutes", "created_at",
  "updated_at", "phone_text", "representative_menu_name", "representative_menu_price", "naver_place_url",
].join(",");

async function photosForPlaces(ids: string[]): Promise<Map<string, PhotoRow[]>> {
  const byPlace = new Map<string, PhotoRow[]>();
  if (!ids.length) return byPlace;
  const client = createBackendAuthClient();
  const photos = databaseList<PhotoRow>(await client
    .from("place_photos")
    .select("id,place_id,public_url,display_order,credit_text,permission_status")
    .in("place_id", ids)
    .eq("permission_status", "approved")
    .in("photo_type", ["cover", "gallery"])
    .order("display_order", { ascending: true }));
  for (const photo of photos) {
    byPlace.set(photo.place_id, [...(byPlace.get(photo.place_id) ?? []), photo]);
  }
  return byPlace;
}

async function taxonomyForPlaces(ids: string[], categoryIds: string[]): Promise<{
  categories: Map<string, CategoryRow>;
  tags: Map<string, TagRow[]>;
}> {
  const categories = new Map<string, CategoryRow>();
  const tags = new Map<string, TagRow[]>();
  if (!ids.length) return { categories, tags };
  const client = createBackendAuthClient();
  const [categoryResult, tagResult] = await Promise.all([
    client.from("categories").select("id,name,display_order").in("id", [...new Set(categoryIds)]).eq("status", "active"),
    client.from("place_tags").select("place_id,content_tags(id,group_key,name)").in("place_id", ids),
  ]);
  for (const category of databaseList<CategoryRow>(categoryResult)) categories.set(category.id, category);
  for (const relation of databaseList<Record<string, unknown>>(tagResult)) {
    const tag = relation.content_tags as TagRow | null;
    if (!tag) continue;
    const id = String(relation.place_id);
    tags.set(id, [...(tags.get(id) ?? []), tag]);
  }
  return { categories, tags };
}

export function publicPlaceOutput(row: PlaceRow, photos: PhotoRow[], category: CategoryRow, tags: TagRow[]) {
  return {
    id: row.id,
    name: row.name,
    shortCopy: row.short_copy,
    neighborhoodId: row.neighborhood_id,
    address: row.address,
    nearestStation: row.nearest_station || null,
    phoneText: row.phone_text || null,
    latitude: row.lat,
    longitude: row.lng,
    category: { id: category.id, name: category.name, displayOrder: category.display_order },
    tags: tags.map((tag) => ({ id: tag.id, kind: tag.group_key, name: tag.name })),
    moodTags: row.mood_tags,
    bestFor: row.best_for,
    timeTags: row.time_tags,
    media: photos.slice(0, 5).map((photo, index) => ({
      id: photo.id,
      kind: "image",
      url: photo.public_url,
      thumbnailUrl: null,
      position: index,
      rightsStatus: photo.permission_status,
      placeId: row.id,
    })),
    status: "published",
    hoursText: row.hours_text || null,
    priceLevel: row.price_hint || null,
    representativeMenuName: row.representative_menu_name || null,
    representativeMenuPrice: row.representative_menu_price || null,
    representativeMenu: row.representative_menu_name || row.representative_menu_price ? {
      name: row.representative_menu_name || null,
      price: row.representative_menu_price || null,
    } : null,
    stayTimeMinutes: row.stay_time_minutes,
    externalMapUrl: row.naver_place_url || null,
    updatedAt: row.updated_at,
  };
}

export const bootstrap: RouteHandler = async (_request, context) => {
  const client = createBackendAuthClient();
  const [regionsResult, categoriesResult, tagsResult] = await Promise.all([
    client.from("regions").select("id,name,short_name,display_order").eq("status", "active").order("display_order"),
    client.from("categories").select("id,name,display_order").eq("status", "active").order("display_order"),
    client.from("content_tags").select("id,key,group_key,name,display_order").eq("status", "active").order("display_order"),
  ]);
  return apiSuccess({
    regions: databaseList<Record<string, unknown>>(regionsResult).map((row) => ({ id: row.id, name: row.name, enabled: true })),
    categories: databaseList<Record<string, unknown>>(categoriesResult).map((row) => ({
      id: row.id, name: row.name, displayOrder: row.display_order,
    })),
    tags: databaseList<Record<string, unknown>>(tagsResult).map((row) => ({
      id: row.id, key: row.key, kind: row.group_key, name: row.name,
    })),
    featureFlags: { videoUpload: false, contentShare: false },
    contractVersions: { api: "v1", onboarding: 1, notifications: 1, analytics: 1 },
  }, context.requestId, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=60" } });
};

export const placeDetail: RouteHandler = async (_request, context) => {
  const parsedId = placeId.safeParse(context.params.id);
  if (!parsedId.success) throw new ApiError(404, "not_found", "장소를 찾을 수 없습니다.");
  const client = createBackendAuthClient();
  const row = databaseData<PlaceRow>(await client.from("places").select(placeSelection)
    .eq("id", parsedId.data)
    .eq("status", "ready")
    .eq("qa_status", "ready")
    .eq("photo_qa_status", "approved")
    .maybeSingle());
  const photos = await photosForPlaces([row.id]);
  const taxonomy = await taxonomyForPlaces([row.id], [row.category_id]);
  return apiSuccess(publicPlaceOutput(
    row,
    photos.get(row.id) ?? [],
    taxonomy.categories.get(row.category_id) ?? { id: row.category_id, name: row.category_id, display_order: 0 },
    taxonomy.tags.get(row.id) ?? [],
  ), context.requestId, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" },
  });
};

export const relatedPlaces: RouteHandler = async (_request, context) => {
  const parsedId = placeId.safeParse(context.params.id);
  if (!parsedId.success) throw new ApiError(404, "not_found", "장소를 찾을 수 없습니다.");
  const client = createBackendAuthClient();
  const origin = databaseData<Pick<PlaceRow, "id" | "lat" | "lng">>(await client
    .from("places").select("id,lat,lng").eq("id", parsedId.data).maybeSingle());
  const rows = databaseList<PlaceRow>(await client.from("places").select(placeSelection)
    .eq("status", "ready").eq("qa_status", "ready").eq("photo_qa_status", "approved")
    .neq("id", origin.id)
    .gte("lat", origin.lat - 0.03).lte("lat", origin.lat + 0.03)
    .gte("lng", origin.lng - 0.03).lte("lng", origin.lng + 0.03)
    .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(12));
  const photos = await photosForPlaces(rows.map((row) => row.id));
  const taxonomy = await taxonomyForPlaces(rows.map((row) => row.id), rows.map((row) => row.category_id));
  return apiSuccess({ items: rows.map((row) => publicPlaceOutput(
    row,
    photos.get(row.id) ?? [],
    taxonomy.categories.get(row.category_id) ?? { id: row.category_id, name: row.category_id, display_order: 0 },
    taxonomy.tags.get(row.id) ?? [],
  )) }, context.requestId, {
    headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" },
  });
};

export const publicProfile: RouteHandler = async (_request, context) => {
  const id = profileId.safeParse(context.params.id);
  if (!id.success) throw new ApiError(404, "not_found", "프로필을 찾을 수 없습니다.");
  const client = createBackendAuthClient();
  const row = databaseData<Record<string, unknown>>(await client.from("public_profiles")
    .select("user_id,display_name,bio,avatar_path,avatar_media_id,follower_count,updated_at")
    .eq("user_id", id.data).eq("visibility", "public").maybeSingle());
  const admin = createBackendAdminClient();
  const account = await admin.from("user_accounts").select("email").eq("user_id", id.data).maybeSingle();
  if (account.error) throw new ApiError(503, "profile_unavailable", "프로필 상태를 확인하지 못했습니다.");
  const curator = account.data?.email ? await admin.from("intake_submissions").select("id")
    .eq("kind", "creator").eq("contact_email", account.data.email.toLowerCase()).eq("status", "accepted").limit(1).maybeSingle()
    : { data: null, error: null };
  if (curator.error) throw new ApiError(503, "profile_unavailable", "프로필 상태를 확인하지 못했습니다.");
  let profileImageUrl: string | null = null;
  if (row.avatar_media_id) {
    const media = await admin.from("media_assets").select("storage_bucket,storage_path,status,rights_status")
      .eq("id", String(row.avatar_media_id)).eq("status", "approved").eq("rights_status", "approved").maybeSingle();
    if (media.error) throw new ApiError(503, "profile_unavailable", "프로필 이미지를 확인하지 못했습니다.");
    if (media.data?.storage_bucket === "media-approved") {
      const signed = await admin.storage.from("media-approved").createSignedUrl(media.data.storage_path, 300);
      profileImageUrl = signed.data?.signedUrl ?? null;
    }
  }
  return apiSuccess({
    id: row.user_id,
    nickname: row.display_name,
    introduction: row.bio,
    profileImageUrl,
    isCurator: Boolean(curator.data),
    officialBadge: false,
    followedByMe: false,
    followerCount: Number(row.follower_count ?? 0),
  }, context.requestId, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" } });
};
