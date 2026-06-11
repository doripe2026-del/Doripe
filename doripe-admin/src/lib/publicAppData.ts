import { randomBytes } from "crypto";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import {
  ACTIVE_WEB_NEIGHBORHOOD_ID,
  ACTIVE_WEB_NEIGHBORHOOD_NAME,
  ACTIVE_WEB_REGION_ID,
  APP_CARD_ACTION_LIMIT,
  DISABLED_WEB_NEIGHBORHOODS,
  type AppEventPayload,
  type ShareLinkPayload,
} from "./publicAppSchemas";

type PublicPlacePhoto = {
  id: string;
  public_url: string;
  display_order: number;
  photo_type: string;
  permission_status: string;
};

type PublicPlaceRow = {
  id: string;
  name: string;
  status: string;
  neighborhood_id: string;
  sub_area: string;
  category_id: string;
  short_copy: string;
  mood_tags: string[];
  best_for: string[];
  address: string;
  naver_place_url: string;
  cover_photo_id: string | null;
  cover_image_url: string;
  image_urls: string[];
  place_photos?: PublicPlacePhoto[];
};

type PublicCategory = {
  id: string;
  name: string;
  display_order: number;
  status: string;
};

type PublicNeighborhood = {
  id: string;
  name: string;
  display_order: number;
  status: string;
};

type PublicRegion = {
  id: string;
  name: string;
  short_name: string;
  display_order: number;
  status: string;
};

export type PublicAppPlace = {
  id: string;
  name: string;
  neighborhoodId: string;
  neighborhoodName: string;
  categoryId: string;
  categoryName: string;
  subArea: string;
  shortCopy: string;
  moodTags: string[];
  bestFor: string[];
  address: string;
  naverPlaceUrl: string;
  coverPhotoId: string | null;
  coverImageUrl: string;
  images: string[];
};

function publicPlaceImages(place: PublicPlaceRow): string[] {
  const photoUrls = (place.place_photos ?? [])
    .filter((photo) => photo.permission_status === "approved")
    .filter((photo) => photo.photo_type === "cover" || photo.photo_type === "gallery")
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((photo) => photo.public_url)
    .filter(Boolean);
  const merged = [place.cover_image_url, ...photoUrls, ...(place.image_urls ?? [])].filter(Boolean);
  return Array.from(new Set(merged)).slice(0, 5);
}

function isYeonnamPlace(place: PublicPlaceRow, neighborhoodName: string): boolean {
  const haystack = [neighborhoodName, place.sub_area, place.address].join(" ");
  return haystack.includes("연남") || /yeonnam/i.test(haystack);
}

function newShareId(): string {
  return randomBytes(7).toString("base64url");
}

function buildPublicPlace(
  place: PublicPlaceRow,
  categoryById: Map<string, PublicCategory>,
  neighborhoodById: Map<string, PublicNeighborhood>,
): PublicAppPlace {
  const neighborhood = neighborhoodById.get(place.neighborhood_id);
  const category = categoryById.get(place.category_id);

  return {
    id: place.id,
    name: place.name,
    neighborhoodId: place.neighborhood_id,
    neighborhoodName: neighborhood?.name ?? ACTIVE_WEB_NEIGHBORHOOD_NAME,
    categoryId: place.category_id,
    categoryName: category?.name ?? "미분류",
    subArea: place.sub_area,
    shortCopy: place.short_copy,
    moodTags: place.mood_tags ?? [],
    bestFor: place.best_for ?? [],
    address: place.address,
    naverPlaceUrl: place.naver_place_url,
    coverPhotoId: place.cover_photo_id,
    coverImageUrl: place.cover_image_url,
    images: publicPlaceImages(place),
  };
}

export async function loadPublicAppBootstrap() {
  const supabase = createSupabaseAdminClient();
  const [placesResult, neighborhoodsResult, categoriesResult, regionsResult] = await Promise.all([
    supabase
      .from("places")
      .select(
        "id,name,status,neighborhood_id,sub_area,category_id,short_copy,mood_tags,best_for,address,naver_place_url,cover_photo_id,cover_image_url,image_urls,place_photos!place_photos_place_id_fkey(id,public_url,display_order,photo_type,permission_status)",
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("neighborhoods").select("id,name,display_order,status").eq("status", "active").order("display_order"),
    supabase.from("categories").select("id,name,display_order,status").eq("status", "active").order("display_order"),
    supabase.from("regions").select("id,name,short_name,display_order,status").eq("status", "active").order("display_order"),
  ]);

  const error = placesResult.error ?? neighborhoodsResult.error ?? categoriesResult.error ?? regionsResult.error;
  if (error) throw new Error(error.message);

  const neighborhoods = (neighborhoodsResult.data ?? []) as PublicNeighborhood[];
  const categories = (categoriesResult.data ?? []) as PublicCategory[];
  const regions = (regionsResult.data ?? []) as PublicRegion[];
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const neighborhoodById = new Map(neighborhoods.map((neighborhood) => [neighborhood.id, neighborhood]));
  const yeonnamPlaces = ((placesResult.data ?? []) as PublicPlaceRow[])
    .filter((place) => {
      const neighborhoodName = neighborhoodById.get(place.neighborhood_id)?.name ?? "";
      return isYeonnamPlace(place, neighborhoodName) && publicPlaceImages(place).length > 0;
    })
    .map((place) => buildPublicPlace(place, categoryById, neighborhoodById));

  return {
    config: {
      cardActionLimit: APP_CARD_ACTION_LIMIT,
      activeNeighborhoodId: ACTIVE_WEB_NEIGHBORHOOD_ID,
      activeNeighborhoodLabel: ACTIVE_WEB_NEIGHBORHOOD_NAME,
    },
    neighborhoods: [
      ...DISABLED_WEB_NEIGHBORHOODS.map((item) => ({ ...item, enabled: false })),
      { id: ACTIVE_WEB_NEIGHBORHOOD_ID, label: ACTIVE_WEB_NEIGHBORHOOD_NAME, enabled: true },
    ],
    categories,
    regions,
    places: yeonnamPlaces,
  };
}

async function ensureAnonymousUser(payload: AppEventPayload | ShareLinkPayload, headers: Headers) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const userAgent = headers.get("user-agent") ?? "";
  const referrer = headers.get("referer") ?? "";

  await supabase.from("app_anonymous_users").upsert(
    {
      id: payload.anonymousUserId,
      last_seen_at: now,
      first_referrer: referrer,
      first_user_agent: userAgent,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  await supabase
    .from("app_anonymous_users")
    .update({ last_seen_at: now })
    .eq("id", payload.anonymousUserId);

  return { now, referrer, userAgent };
}

async function syncSavedPlaceState(payload: AppEventPayload) {
  if (!payload.placeId) return;
  const state =
    payload.eventName === "place_save"
      ? "saved"
      : payload.eventName === "place_skip"
        ? "skipped"
        : payload.eventName === "place_unsave"
          ? "unsaved"
          : null;

  if (!state) return;

  const supabase = createSupabaseAdminClient();
  const existing = await supabase
    .from("app_saved_places")
    .select("saved_count, skipped_count, first_saved_at")
    .eq("anonymous_user_id", payload.anonymousUserId)
    .eq("place_id", payload.placeId)
    .maybeSingle();

  const savedCount = Number(existing.data?.saved_count ?? 0) + (state === "saved" ? 1 : 0);
  const skippedCount = Number(existing.data?.skipped_count ?? 0) + (state === "skipped" ? 1 : 0);
  const firstSavedAt = existing.data?.first_saved_at ?? (state === "saved" ? new Date().toISOString() : null);

  await supabase.from("app_saved_places").upsert(
    {
      anonymous_user_id: payload.anonymousUserId,
      place_id: payload.placeId,
      state,
      saved_count: savedCount,
      skipped_count: skippedCount,
      first_saved_at: firstSavedAt,
      last_action_at: new Date().toISOString(),
    },
    { onConflict: "anonymous_user_id,place_id" },
  );
}

export async function recordAppEvent(payload: AppEventPayload, headers: Headers) {
  const supabase = createSupabaseAdminClient();
  const { now, referrer, userAgent } = await ensureAnonymousUser(payload, headers);

  if (payload.sessionId) {
    await supabase.from("app_sessions").upsert(
      {
        id: payload.sessionId,
        anonymous_user_id: payload.anonymousUserId,
        last_seen_at: now,
        entry_path: "/app",
        referrer,
        user_agent: userAgent,
      },
      { onConflict: "id" },
    );
  }

  const { error } = await supabase.from("app_events").insert({
    anonymous_user_id: payload.anonymousUserId,
    session_id: payload.sessionId ?? null,
    event_name: payload.eventName,
    screen: payload.screen,
    place_id: payload.placeId ?? null,
    route_id: payload.routeId ?? null,
    share_id: payload.shareId ?? null,
    neighborhood_id: payload.neighborhoodId ?? null,
    category_id: payload.categoryId ?? null,
    duration_ms: payload.durationMs ?? null,
    metadata: payload.metadata,
    client_created_at: payload.clientCreatedAt ?? null,
  });

  if (error) throw new Error(error.message);
  await syncSavedPlaceState(payload);
}

function yeonnamRegionId(regions: PublicRegion[]) {
  return (
    regions.find((region) => region.id === ACTIVE_WEB_REGION_ID)?.id ??
    regions.find((region) => /연남|yeonnam/i.test(`${region.name} ${region.short_name} ${region.id}`))?.id ??
    ACTIVE_WEB_REGION_ID
  );
}

export async function createPublicShareLink(payload: ShareLinkPayload, headers: Headers) {
  await ensureAnonymousUser(payload, headers);

  const bootstrap = await loadPublicAppBootstrap();
  const placeById = new Map(bootstrap.places.map((place) => [place.id, place]));
  const firstPlace =
    payload.type === "place"
      ? placeById.get(payload.placeId ?? "")
      : placeById.get(payload.placeIds[0] ?? "");

  if (!firstPlace) throw new Error("공유할 수 있는 장소를 찾을 수 없습니다.");

  if (payload.type === "route") {
    const allRoutePlacesArePublic = payload.placeIds.every((placeId) => placeById.has(placeId));
    if (!allRoutePlacesArePublic) throw new Error("공유할 수 없는 장소가 포함되어 있습니다.");
  }

  const id = newShareId();
  const title = payload.title || (payload.type === "place" ? firstPlace.name : `${ACTIVE_WEB_NEIGHBORHOOD_NAME} 루트`);
  const description = payload.description || firstPlace.shortCopy || "Doripe에서 이 장소를 확인해보세요.";
  const coverImageUrl = firstPlace.images[0] || firstPlace.coverImageUrl || "";
  const regionId = yeonnamRegionId(bootstrap.regions);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("shared_links").insert({
    id,
    anonymous_user_id: payload.anonymousUserId,
    content_type: payload.type,
    region_id: regionId,
    title,
    cover_image_url: coverImageUrl,
    place_id: payload.type === "place" ? payload.placeId : null,
    place_ids: payload.type === "route" ? payload.placeIds : [],
    payload: {
      description,
      webMvp: true,
      activeNeighborhood: ACTIVE_WEB_NEIGHBORHOOD_NAME,
    },
  });

  if (error) throw new Error(error.message);

  return {
    id,
    type: payload.type,
    url: payload.type === "place" ? `https://doripe.kr/p/${id}` : `https://doripe.kr/r/${id}`,
    title,
    description,
    imageUrl: coverImageUrl,
  };
}
