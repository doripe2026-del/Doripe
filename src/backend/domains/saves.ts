import { z } from "zod";
import { requireUser } from "../core/auth.js";
import { decodeCursor, encodeCursor, parseLimit } from "../core/cursor.js";
import { databaseList } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";

const saveContext = z.object({
  sourceScreen: z.string().trim().min(1).max(80).nullable().optional(),
  sourceContentId: z.string().uuid().nullable().optional(),
}).strict();

const placeTarget = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const courseTarget = z.string().uuid();

type SavedRow = {
  id: string;
  targetId: string;
  targetType: "course" | "place";
  savedAt: string;
  sourceContentId: string | null;
  sourceScreen: string;
};

type SavedPlaceDetailRow = {
  address: string;
  category_id: string;
  id: string;
  lat: number;
  lng: number;
  name: string;
  nearest_station: string;
  price_hint: string;
  representative_menu_name?: string;
  representative_menu_price?: string;
  stay_time_minutes: number;
  updated_at: string;
};

type SavedCourseDetailRow = {
  id: string;
  is_public: boolean;
  name: string;
  start_place_id: string;
  updated_at: string;
  user_id: string;
  version: number;
};

type SavedCoursePlaceRow = {
  course_id: string;
  id: string;
  note: string | null;
  place_id: string;
  position: number;
  stay_duration_minutes: number | null;
};

export function selectedSaveTargetTypes(url: URL): Array<"place" | "course"> {
  const value = url.searchParams.get("targetType");
  if (value === null) return ["place", "course"];
  if (value === "place" || value === "course") return [value];
  throw new ApiError(400, "invalid_target_type", "targetType은 place 또는 course여야 합니다.");
}

export function hydrateSavedRows(
  rows: SavedRow[],
  places: SavedPlaceDetailRow[],
  courses: SavedCourseDetailRow[],
  coursePlaces: SavedCoursePlaceRow[],
) {
  const placeById = new Map(places.map((place) => [place.id, {
    id: place.id,
    name: place.name,
    address: place.address,
    nearestStation: place.nearest_station || null,
    categoryId: place.category_id,
    latitude: place.lat,
    longitude: place.lng,
    priceLevel: place.price_hint || null,
    representativeMenuName: place.representative_menu_name || null,
    representativeMenuPrice: place.representative_menu_price || null,
    representativeMenu: place.representative_menu_name || place.representative_menu_price ? {
      name: place.representative_menu_name || null,
      price: place.representative_menu_price || null,
    } : null,
    stayTimeMinutes: place.stay_time_minutes,
    updatedAt: place.updated_at,
  }]));
  const placesByCourse = new Map<string, Array<{
    id: string;
    note: string;
    placeId: string;
    position: number;
    stayMinutes: number | null;
  }>>();
  for (const place of coursePlaces) {
    placesByCourse.set(place.course_id, [...(placesByCourse.get(place.course_id) ?? []), {
      id: place.id,
      placeId: place.place_id,
      position: place.position,
      stayMinutes: place.stay_duration_minutes,
      note: place.note ?? "",
    }]);
  }
  const courseById = new Map(courses.map((course) => {
    const placesForCourse = placesByCourse.get(course.id) ?? [];
    return [course.id, {
      id: course.id,
      ownerId: course.user_id,
      name: course.name,
      visibility: course.is_public ? "public" : "private",
      startPlaceId: course.start_place_id,
      version: course.version,
      placeCount: placesForCourse.length,
      places: placesForCourse,
      updatedAt: course.updated_at,
    }];
  }));
  return rows.map((row) => ({
    ...row,
    target: row.targetType === "place" ? placeById.get(row.targetId) ?? null : courseById.get(row.targetId) ?? null,
  }));
}

function target(context: RouteContext): { table: "saved_courses" | "saved_places"; column: "course_id" | "place_id"; id: string } {
  const type = context.params.targetType;
  const id = context.params.targetId;
  if (type === "place" && placeTarget.safeParse(id).success) return { table: "saved_places", column: "place_id", id };
  if (type === "course" && courseTarget.safeParse(id).success) return { table: "saved_courses", column: "course_id", id };
  throw new ApiError(404, "not_found", "저장 대상을 찾을 수 없습니다.");
}

export const listSaves: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  const targetTypes = selectedSaveTargetTypes(context.url);
  let placesQuery = auth.userClient.from("saved_places")
    .select("id,place_id,saved_at,source_surface,source_content_id")
    .eq("user_id", auth.user.id).is("removed_at", null)
    .order("saved_at", { ascending: false }).order("place_id", { ascending: false }).limit(limit + 1);
  let coursesQuery = auth.userClient.from("saved_courses")
    .select("id,course_id,saved_at,source_surface,source_content_id")
    .eq("user_id", auth.user.id).is("removed_at", null)
    .order("saved_at", { ascending: false }).order("course_id", { ascending: false }).limit(limit + 1);
  if (cursor) {
    placesQuery = placesQuery.or(`saved_at.lt.${cursor.value},and(saved_at.eq.${cursor.value},place_id.lt.${cursor.id})`);
    coursesQuery = coursesQuery.or(`saved_at.lt.${cursor.value},and(saved_at.eq.${cursor.value},course_id.lt.${cursor.id})`);
  }
  const [places, courses] = await Promise.all([
    targetTypes.includes("place") ? placesQuery : Promise.resolve({ data: [], error: null }),
    targetTypes.includes("course") ? coursesQuery : Promise.resolve({ data: [], error: null }),
  ]);
  const combined: SavedRow[] = [
    ...databaseList<Record<string, unknown>>(places).map((row) => ({
      id: String(row.id), targetId: String(row.place_id), targetType: "place" as const,
      savedAt: String(row.saved_at), sourceScreen: String(row.source_surface ?? ""),
      sourceContentId: typeof row.source_content_id === "string" ? row.source_content_id : null,
    })),
    ...databaseList<Record<string, unknown>>(courses).map((row) => ({
      id: String(row.id), targetId: String(row.course_id), targetType: "course" as const,
      savedAt: String(row.saved_at), sourceScreen: String(row.source_surface ?? ""),
      sourceContentId: typeof row.source_content_id === "string" ? row.source_content_id : null,
    })),
  ].sort((left, right) => right.savedAt.localeCompare(left.savedAt) || right.targetId.localeCompare(left.targetId));
  const hasMore = combined.length > limit;
  const page = combined.slice(0, limit);
  const last = page.at(-1);
  const placeIds = page.filter((row) => row.targetType === "place").map((row) => row.targetId);
  const courseIds = page.filter((row) => row.targetType === "course").map((row) => row.targetId);
  const [placeDetails, courseDetails, coursePlaceDetails] = await Promise.all([
    placeIds.length ? auth.userClient.from("places")
      .select("id,name,address,nearest_station,category_id,lat,lng,price_hint,representative_menu_name,representative_menu_price,stay_time_minutes,updated_at")
      .in("id", placeIds) : Promise.resolve({ data: [], error: null }),
    courseIds.length ? auth.userClient.from("courses")
      .select("id,user_id,name,is_public,start_place_id,version,updated_at")
      .in("id", courseIds).eq("status", "active") : Promise.resolve({ data: [], error: null }),
    courseIds.length ? auth.userClient.from("course_places")
      .select("id,course_id,place_id,position,stay_duration_minutes,note")
      .in("course_id", courseIds).order("position", { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  const hydrated = hydrateSavedRows(
    page,
    databaseList<SavedPlaceDetailRow>(placeDetails),
    databaseList<SavedCourseDetailRow>(courseDetails),
    databaseList<SavedCoursePlaceRow>(coursePlaceDetails),
  );
  return apiSuccess({ items: hydrated }, context.requestId, {
    meta: { nextCursor: hasMore && last ? encodeCursor(last.savedAt, last.targetId, context.url.searchParams) : null },
    headers: { "cache-control": "private, no-store" },
  });
};

export const putSave: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const selected = target(context);
  const body = await parseJson(request, saveContext, 8 * 1024);
  const now = new Date().toISOString();
  const result = await auth.userClient.from(selected.table).upsert({
    user_id: auth.user.id,
    [selected.column]: selected.id,
    source_surface: body.sourceScreen ?? "unknown",
    source_content_id: body.sourceContentId ?? null,
    saved_at: now,
    removed_at: null,
  }, { onConflict: `user_id,${selected.column}` }).select(`id,${selected.column},saved_at,source_surface,source_content_id`).single();
  if (result.error) {
    if (result.error.code === "23503") throw new ApiError(404, "not_found", "저장 대상을 찾을 수 없습니다.");
    throw new ApiError(503, "database_unavailable", "저장하지 못했습니다.");
  }
  return apiSuccess({
    id: result.data.id,
    targetType: context.params.targetType,
    targetId: selected.id,
    savedAt: result.data.saved_at,
    sourceScreen: result.data.source_surface,
    sourceContentId: result.data.source_content_id,
  }, context.requestId, { headers: { "cache-control": "private, no-store" } });
};

export const deleteSave: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const selected = target(context);
  const result = await auth.userClient.from(selected.table).update({ removed_at: new Date().toISOString() })
    .eq("user_id", auth.user.id).eq(selected.column, selected.id);
  if (result.error) throw new ApiError(503, "database_unavailable", "저장을 해제하지 못했습니다.");
  return apiSuccess({ targetType: context.params.targetType, targetId: selected.id, saved: false }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};
