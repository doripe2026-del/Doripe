import { randomUUID } from "node:crypto";
import { z } from "zod";
import { optionalUser, requireUser } from "../core/auth.js";
import { decodeCursor, encodeCursor, parseLimit } from "../core/cursor.js";
import { databaseData, databaseList } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";
import { createBackendAdminClient, createBackendAuthClient } from "../core/supabase.js";

const placeId = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const courseId = z.string().uuid();
const courseInput = z.object({
  name: z.string().trim().min(1).max(120),
  visibility: z.enum(["private", "public"]),
  startPlaceId: placeId,
  placeIds: z.array(placeId).min(2).max(30).refine((values) => new Set(values).size === values.length, "장소가 중복됐습니다."),
}).strict().refine((value) => value.placeIds.includes(value.startPlaceId), "시작 장소가 코스에 포함되어야 합니다.");
const courseUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  visibility: z.enum(["private", "public"]).optional(),
  placeIds: z.array(placeId).min(2).max(30).refine((values) => new Set(values).size === values.length, "장소가 중복됐습니다."),
  expectedVersion: z.number().int().min(1),
}).strict();
const courseReplace = z.object({
  expectedVersion: z.number().int().min(1),
  newPlaceId: placeId,
  reason: z.string().trim().min(1).max(500),
}).strict();
const coursePlaceCreate = z.object({
  placeId,
  position: z.number().int().min(0).max(99).optional(),
  expectedVersion: z.number().int().min(1),
}).strict();
const coursePlaceUpdate = z.object({
  stayMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  expectedVersion: z.number().int().min(1),
}).strict().refine((value) => value.stayMinutes !== undefined || value.note !== undefined, "수정할 값을 입력해 주세요.");

type CourseRow = {
  created_at: string;
  id: string;
  is_public: boolean;
  name: string;
  start_place_id: string;
  status: string;
  updated_at: string;
  user_id: string;
  version: number;
};

function requireCourseId(context: RouteContext): string {
  const parsed = courseId.safeParse(context.params.id);
  if (!parsed.success) throw new ApiError(404, "not_found", "코스를 찾을 수 없습니다.");
  return parsed.data;
}

function requireCoursePlaceId(context: RouteContext): string {
  const parsed = courseId.safeParse(context.params.coursePlaceId);
  if (!parsed.success) throw new ApiError(404, "not_found", "코스 장소를 찾을 수 없습니다.");
  return parsed.data;
}

type CoursePlaceOutput = {
  id: unknown;
  note: unknown;
  placeId: unknown;
  position: unknown;
  stayMinutes: unknown;
  travelMinutesFromPrevious: unknown;
};

export function courseOutput(row: CourseRow, places: CoursePlaceOutput[]) {
  const totalStayMinutes = places.reduce((sum, place) => sum + (typeof place.stayMinutes === "number" ? place.stayMinutes : 0), 0);
  const totalTravelMinutes = places.reduce((sum, place) => sum
    + (typeof place.travelMinutesFromPrevious === "number" ? place.travelMinutesFromPrevious : 0), 0);
  return {
    id: row.id,
    ownerId: row.user_id,
    name: row.name,
    visibility: row.is_public ? "public" : "private",
    startPlaceId: row.start_place_id,
    version: row.version,
    places,
    totalStayMinutes,
    totalTravelMinutes,
    totalDurationMinutes: totalStayMinutes + totalTravelMinutes,
    updatedAt: row.updated_at,
  };
}

function mapCourseRpcError(error: { code?: string } | null): never {
  if (error?.code === "40001") throw new ApiError(409, "version_conflict", "코스가 다른 기기에서 변경됐습니다.");
  if (error?.code === "42501") throw new ApiError(403, "forbidden", "이 코스를 변경할 수 없습니다.");
  if (error?.code === "P0002") throw new ApiError(404, "not_found", "코스 또는 장소를 찾을 수 없습니다.");
  if (error?.code === "22023" || error?.code === "23503" || error?.code === "23505") {
    throw new ApiError(422, "invalid_course", "코스의 장소와 순서를 확인해 주세요.");
  }
  throw new ApiError(503, "database_unavailable", "코스를 저장하지 못했습니다.");
}

async function courseDetailData(client: ReturnType<typeof createBackendAuthClient>, id: string): Promise<ReturnType<typeof courseOutput>> {
  const course = databaseData<CourseRow>(await client.from("courses")
    .select("id,user_id,name,is_public,start_place_id,status,version,created_at,updated_at")
    .eq("id", id).eq("status", "active").maybeSingle());
  const coursePlaces = databaseList<Record<string, unknown>>(await client.from("course_places")
    .select("id,place_id,position,stay_duration_minutes,note,travel_duration_from_previous_minutes")
    .eq("course_id", id).order("position", { ascending: true }));
  return courseOutput(course, coursePlaces.map((item) => ({
    id: item.id,
    placeId: item.place_id,
    position: item.position,
    stayMinutes: item.stay_duration_minutes,
    travelMinutesFromPrevious: item.travel_duration_from_previous_minutes,
    note: item.note ?? "",
  })));
}

export const listCourses: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  let query = auth.userClient.from("courses")
    .select("id,user_id,name,is_public,start_place_id,status,version,created_at,updated_at")
    .eq("user_id", auth.user.id).eq("status", "active")
    .order("updated_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (cursor) query = query.or(`updated_at.lt.${cursor.value},and(updated_at.eq.${cursor.value},id.lt.${cursor.id})`);
  const rows = databaseList<CourseRow>(await query);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const placeRows = page.length ? databaseList<Record<string, unknown>>(await auth.userClient.from("course_places")
    .select("id,course_id,place_id,position,stay_duration_minutes,travel_duration_from_previous_minutes,note")
    .in("course_id", page.map((row) => row.id)).order("position", { ascending: true })) : [];
  const placesByCourse = new Map<string, CoursePlaceOutput[]>();
  for (const item of placeRows) {
    const course = String(item.course_id);
    placesByCourse.set(course, [...(placesByCourse.get(course) ?? []), {
      id: item.id,
      placeId: item.place_id,
      position: item.position,
      stayMinutes: item.stay_duration_minutes,
      travelMinutesFromPrevious: item.travel_duration_from_previous_minutes,
      note: item.note ?? "",
    }]);
  }
  return apiSuccess({ items: page.map((row) => courseOutput(row, placesByCourse.get(row.id) ?? [])) }, context.requestId, {
    meta: { nextCursor: hasMore && last ? encodeCursor(last.updated_at, last.id, context.url.searchParams) : null },
    headers: { "cache-control": "private, no-store" },
  });
};

export const getCourse: RouteHandler = async (request, context) => {
  const id = requireCourseId(context);
  const auth = await optionalUser(request);
  const client = auth?.userClient ?? createBackendAuthClient();
  return apiSuccess(await courseDetailData(client, id), context.requestId, {
    headers: { "cache-control": auth ? "private, no-store" : "public, max-age=60, stale-while-revalidate=120" },
  });
};

export const createCourse: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, courseInput, 16 * 1024);
  const id = randomUUID();
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/courses",
    payload: body,
    operation: async () => {
      const result = await auth.userClient.rpc("upsert_course_with_places", {
        p_course_id: id,
        p_name: body.name,
        p_is_public: body.visibility === "public",
        p_start_place_id: body.startPlaceId,
        p_expected_version: 0,
        p_place_ids: body.placeIds,
      });
      if (result.error) mapCourseRpcError(result.error);
      return { data: await courseDetailData(auth.userClient, id), status: 201 };
    },
  });
};

export const updateCourse: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requireCourseId(context);
  const body = await parseJson(request, courseUpdate, 16 * 1024);
  const current = databaseData<CourseRow>(await auth.userClient.from("courses")
    .select("id,user_id,name,is_public,start_place_id,status,version,created_at,updated_at")
    .eq("id", id).eq("user_id", auth.user.id).eq("status", "active").maybeSingle());
  if (!body.placeIds.includes(current.start_place_id)) {
    throw new ApiError(422, "invalid_course", "시작 장소는 코스에 남아 있어야 합니다.");
  }
  const result = await auth.userClient.rpc("upsert_course_with_places", {
    p_course_id: id,
    p_name: body.name ?? current.name,
    p_is_public: body.visibility ? body.visibility === "public" : current.is_public,
    p_start_place_id: current.start_place_id,
    p_expected_version: body.expectedVersion,
    p_place_ids: body.placeIds,
  });
  if (result.error) mapCourseRpcError(result.error);
  return apiSuccess(await courseDetailData(auth.userClient, id), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const deleteCourse: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requireCourseId(context);
  const current = databaseData<CourseRow>(await createBackendAdminClient().from("courses")
    .select("id,user_id,name,is_public,start_place_id,status,version,created_at,updated_at")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle());
  if (current.status === "archived") {
    return apiSuccess({ id, status: "archived", version: current.version, duplicate: true }, context.requestId, {
      headers: { "cache-control": "private, no-store" },
    });
  }
  const result = await auth.userClient.rpc("archive_course", { p_course_id: id, p_expected_version: current.version });
  if (result.error) mapCourseRpcError(result.error);
  const archived = Array.isArray(result.data) ? result.data[0] : result.data;
  return apiSuccess({ id, status: "archived", version: Number(archived?.version ?? current.version + 1), duplicate: false }, context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const replaceCoursePlace: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requireCourseId(context);
  const coursePlace = requireCoursePlaceId(context);
  const body = await parseJson(request, courseReplace, 8 * 1024);
  const result = await auth.userClient.rpc("replace_course_place", {
    p_course_id: id,
    p_course_place_id: coursePlace,
    p_new_place_id: body.newPlaceId,
    p_reason: body.reason,
    p_expected_version: body.expectedVersion,
  });
  if (result.error) mapCourseRpcError(result.error);
  return apiSuccess(await courseDetailData(auth.userClient, id), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const addCoursePlace: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requireCourseId(context);
  const body = await parseJson(request, coursePlaceCreate, 8 * 1024);
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: `/api/v1/courses/${id}/places`,
    payload: body,
    operation: async () => {
      const result = await auth.userClient.rpc("add_course_place", {
        p_course_id: id,
        p_place_id: body.placeId,
        p_position: body.position ?? null,
        p_expected_version: body.expectedVersion,
      });
      if (result.error) mapCourseRpcError(result.error);
      return { data: await courseDetailData(auth.userClient, id), status: 201 };
    },
  });
};

export const updateCoursePlace: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requireCourseId(context);
  const coursePlace = requireCoursePlaceId(context);
  const body = await parseJson(request, coursePlaceUpdate, 8 * 1024);
  const currentPlace = databaseData<Record<string, unknown>>(await auth.userClient.from("course_places")
    .select("stay_duration_minutes,note").eq("id", coursePlace).eq("course_id", id).maybeSingle());
  const result = await auth.userClient.rpc("update_course_place_metadata", {
    p_course_id: id,
    p_course_place_id: coursePlace,
    p_stay_minutes: body.stayMinutes === undefined ? currentPlace.stay_duration_minutes : body.stayMinutes,
    p_note: body.note === undefined ? currentPlace.note : body.note,
    p_expected_version: body.expectedVersion,
  });
  if (result.error) mapCourseRpcError(result.error);
  return apiSuccess(await courseDetailData(auth.userClient, id), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const deleteCoursePlace: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const id = requireCourseId(context);
  const coursePlace = requireCoursePlaceId(context);
  const result = await auth.userClient.rpc("delete_course_place", {
    p_course_id: id,
    p_course_place_id: coursePlace,
  });
  if (result.error) mapCourseRpcError(result.error);
  return apiSuccess(await courseDetailData(auth.userClient, id), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};
