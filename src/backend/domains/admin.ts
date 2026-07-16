import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireOperator, type OperatorContext } from "../core/auth.js";
import { decodeCursor, encodeCursor, parseLimit } from "../core/cursor.js";
import { databaseList } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";
import { createBackendAdminClient } from "../core/supabase.js";

const safeId = z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/);
const uuid = z.string().uuid();
const naverMapUrl = z.string().url().max(1000).refine((value) => {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname === "naver.me") return true;
  const labels = parsed.hostname.split(".");
  return parsed.hostname.endsWith(".naver.com") && labels.some((label) => label === "map" || label === "place");
}, "지원하는 네이버 지도 주소가 아닙니다.");
export const adminTransitionInput = z.object({
  status: z.string().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/),
  reason: z.string().trim().min(1).max(1000),
  expectedVersion: z.number().int().min(1),
  note: z.string().trim().max(2000).optional(),
}).strict();
export const adminTaxonomyInput = z.object({
  id: safeId,
  name: z.string().trim().min(1).max(80),
  kind: z.string().trim().max(40).optional(),
  displayOrder: z.number().int().min(0).max(10_000).optional(),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export const adminPlaceInput = z.object({
  id: safeId,
  name: z.string().trim().min(1).max(120),
  categoryId: safeId,
  neighborhoodId: safeId,
  address: z.string().trim().max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export const adminPlaceUpdateInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  shortCopy: z.string().trim().max(300).optional(),
  categoryId: safeId.optional(),
  neighborhoodId: safeId.optional(),
  address: z.string().trim().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  nearestStation: z.string().trim().max(200).optional(),
  hoursText: z.string().trim().max(300).optional(),
  phoneText: z.string().trim().max(100).optional(),
  moodTags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  bestFor: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  timeTags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  priceLevel: z.string().trim().max(80).optional(),
  representativeMenuName: z.string().trim().max(160).optional(),
  representativeMenuPrice: z.string().trim().max(80).optional(),
  stayTimeMinutes: z.number().int().min(0).max(1440).optional(),
  externalMapUrl: naverMapUrl.optional(),
  status: z.string().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/).optional(),
  expectedVersion: z.number().int().min(1),
  reason: z.string().trim().min(1).max(1000),
}).strict().refine((body) => Object.keys(body).some((key) => !["expectedVersion", "reason"].includes(key)), {
  message: "수정할 장소 정보를 입력해 주세요.",
});
export const adminNaverImportInput = z.object({
  url: naverMapUrl,
  neighborhoodId: safeId.optional(),
  categoryId: safeId.optional(),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export const adminPartnershipInput = z.object({
  organizationId: uuid,
  placeId: safeId,
  status: z.enum(["contact", "meeting", "pilot", "partner", "ended", "excluded"]),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export const adminOrganizationInput = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.enum(["lead", "active", "inactive"]).default("lead"),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export const adminCampaignInput = z.object({
  advertiserId: uuid,
  name: z.string().trim().min(1).max(120),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().min(1).max(1000),
}).strict().refine((body) => new Date(body.endsAt) > new Date(body.startsAt), {
  message: "종료 시각은 시작 시각보다 늦어야 합니다.",
  path: ["endsAt"],
});

type ResourceConfig = {
  createdColumn?: string;
  extraFilter?: (context: RouteContext) => { column: string; value: string } | null;
  keyColumn?: string;
  kind: string;
  labelColumn: string;
  noteColumn?: string;
  scope: string;
  select: string;
  summaryColumn?: string;
  table: string;
  updatedColumn?: string;
};

export const adminResourceScopes = {
  categories: "content:write",
  tags: "content:write",
  places: "content:write",
  media: "content:write",
  contents: "content:write",
  reports: "users:moderate",
  inquiries: "users:moderate",
  users: "users:moderate",
  partnerships: "business:write",
  organizations: "business:write",
  campaigns: "business:write",
  audit: "operators:manage",
  stats: "analytics:read",
} as const;

const resources = {
  category: { table: "categories", keyColumn: "id", kind: "category", labelColumn: "name", scope: "content:write", select: "id,name,status,version,created_at,updated_at" },
  tag: { table: "content_tags", keyColumn: "key", kind: "tag", labelColumn: "name", summaryColumn: "group_key", scope: "content:write", select: "key,name,group_key,status,version,created_at,updated_at" },
  place: { table: "places", keyColumn: "id", kind: "place", labelColumn: "name", summaryColumn: "address", scope: "content:write", select: "id,name,short_copy,category_id,neighborhood_id,address,lat,lng,nearest_station,hours_text,phone_text,mood_tags,best_for,time_tags,price_hint,representative_menu_name,representative_menu_price,stay_time_minutes,naver_place_url,status,qa_status,photo_qa_status,version,created_at,updated_at" },
  media: { table: "media_assets", keyColumn: "id", kind: "media", labelColumn: "original_filename", summaryColumn: "mime_type", noteColumn: "operator_note", scope: "content:write", select: "id,original_filename,mime_type,status,operator_note,version,created_at,updated_at" },
  content: { table: "contents", keyColumn: "id", kind: "content", labelColumn: "caption", summaryColumn: "type", noteColumn: "moderation_note", scope: "content:write", select: "id,caption,type,status,moderation_note,version,created_at,updated_at" },
  report: { table: "reports", keyColumn: "id", kind: "report", labelColumn: "reason_code", summaryColumn: "details", noteColumn: "operator_note", scope: "users:moderate", select: "id,reporter_user_id,target_type,target_id,reason_code,details,status,operator_note,version,created_at,updated_at" },
  inquiry: { table: "inquiries", keyColumn: "id", kind: "inquiry", labelColumn: "category", summaryColumn: "body", noteColumn: "operator_note", scope: "users:moderate", select: "id,user_id,category,body,status,operator_note,version,created_at,updated_at" },
  user: { table: "user_accounts", keyColumn: "user_id", kind: "user", labelColumn: "email", summaryColumn: "restriction_reason", noteColumn: "restriction_reason", scope: "users:moderate", select: "user_id,email,status,restriction_reason,version,created_at,updated_at" },
  partnership: { table: "business_partnerships", keyColumn: "id", kind: "partnership", labelColumn: "place_id", summaryColumn: "organization_id", noteColumn: "operator_note", scope: "business:write", select: "id,organization_id,place_id,status,operator_note,version,created_at,updated_at" },
  organization: { table: "business_organizations", keyColumn: "id", kind: "organization", labelColumn: "name", scope: "business:write", select: "id,name,status,version,created_at,updated_at" },
  campaign: { table: "business_campaigns", keyColumn: "id", kind: "campaign", labelColumn: "name", summaryColumn: "advertiser_id", noteColumn: "operator_note", scope: "business:write", select: "id,advertiser_id,name,status,operator_note,version,created_at,updated_at" },
} satisfies Record<string, ResourceConfig>;

const curatorResource: ResourceConfig = {
  table: "intake_submissions",
  keyColumn: "id",
  kind: "curator",
  labelColumn: "label",
  summaryColumn: "contact_email",
  noteColumn: "operator_note",
  scope: "users:moderate",
  select: "id,kind,label,contact_email,status,operator_note,version,created_at,updated_at",
  extraFilter: () => ({ column: "kind", value: "creator" }),
};

function requestUuid(context: RouteContext): string {
  return uuid.safeParse(context.requestId).success ? context.requestId : randomUUID();
}

export function adminRecord(row: Record<string, unknown>, config: ResourceConfig) {
  const key = config.keyColumn ?? "id";
  const created = config.createdColumn ?? "created_at";
  const updated = config.updatedColumn ?? "updated_at";
  return {
    id: String(row[key] ?? ""),
    kind: config.kind,
    status: String(row.status ?? "active"),
    label: String(row[config.labelColumn] ?? "").slice(0, 200),
    summary: String(config.summaryColumn ? row[config.summaryColumn] ?? "" : "").slice(0, 1000),
    details: { ...row },
    version: Number(row.version ?? 1),
    createdAt: row[created],
    updatedAt: row[updated] ?? row[created],
  };
}

function applyExtraFilter(query: any, config: ResourceConfig, context: RouteContext) {
  const filter = config.extraFilter?.(context);
  return filter ? query.eq(filter.column, filter.value) : query;
}

function listHandler(config: ResourceConfig): RouteHandler {
  return async (request, context) => {
    await requireOperator(request, config.scope);
    const limit = parseLimit(context.url);
    const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
    const status = context.url.searchParams.get("status")?.trim();
    if (status && !/^[a-z][a-z0-9_]{0,39}$/.test(status)) throw new ApiError(400, "invalid_status", "상태 값을 확인해 주세요.");
    const queryText = context.url.searchParams.get("q")?.trim().slice(0, 100);
    const key = config.keyColumn ?? "id";
    const updated = config.updatedColumn ?? "updated_at";
    let query: any = createBackendAdminClient().from(config.table).select(config.select)
      .order(updated, { ascending: false }).order(key, { ascending: false }).limit(limit + 1);
    query = applyExtraFilter(query, config, context);
    if (status) query = query.eq("status", status);
    if (queryText) query = query.ilike(config.labelColumn, `%${queryText.replace(/[%_]/g, "")}%`);
    if (cursor) query = query.or(`${updated}.lt.${cursor.value},and(${updated}.eq.${cursor.value},${key}.lt.${cursor.id})`);
    const rows = databaseList<Record<string, unknown>>(await query);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return apiSuccess({ items: page.map((row) => adminRecord(row, config)) }, context.requestId, {
      meta: { nextCursor: hasMore && last ? encodeCursor(String(last[updated]), String(last[key]), context.url.searchParams) : null },
      headers: { "cache-control": "private, no-store" },
    });
  };
}

function getHandler(config: ResourceConfig): RouteHandler {
  return async (request, context) => {
    await requireOperator(request, config.scope);
    const id = context.params.id?.slice(0, 96) ?? "";
    if (!id) throw new ApiError(404, "not_found", "항목을 찾을 수 없습니다.");
    const key = config.keyColumn ?? "id";
    let query: any = createBackendAdminClient().from(config.table).select(config.select).eq(key, id);
    query = applyExtraFilter(query, config, context);
    const result = await query.maybeSingle();
    if (result.error) throw new ApiError(503, "database_unavailable", "항목을 불러오지 못했습니다.");
    if (!result.data) throw new ApiError(404, "not_found", "항목을 찾을 수 없습니다.");
    return apiSuccess(adminRecord(result.data, config), context.requestId, { headers: { "cache-control": "private, no-store" } });
  };
}

function transitionHandler(config: ResourceConfig): RouteHandler {
  return async (request, context) => {
    const operator = await requireOperator(request, config.scope);
    const body = await parseJson(request, adminTransitionInput, 8 * 1024);
    const id = context.params.id?.slice(0, 96) ?? "";
    if (!id) throw new ApiError(404, "not_found", "항목을 찾을 수 없습니다.");
    const isIntake = config.table === "intake_submissions" && config.kind !== "curator";
    const updated = await createBackendAdminClient().rpc("operator_transition_resource", {
      p_operator_id: operator.user.id,
      p_request_id: requestUuid(context),
      p_resource: isIntake ? "intake" : config.kind,
      p_entity_id: id,
      p_status: body.status,
      p_note: body.note ?? null,
      p_expected_version: body.expectedVersion,
      p_reason: body.reason,
      p_intake_kind: isIntake ? config.kind : null,
    });
    if (updated.error) {
      if (updated.error.code === "40001") throw new ApiError(409, "version_conflict", "다른 운영자가 먼저 변경했습니다.");
      if (updated.error.code === "P0002") throw new ApiError(404, "not_found", "항목을 찾을 수 없습니다.");
      if (updated.error.code === "42501") throw new ApiError(403, "operator_scope_required", "이 작업을 수행할 권한이 없습니다.");
      if (updated.error.code === "22023" || updated.error.code === "23514") {
        throw new ApiError(422, "invalid_transition", "상태 변경 값을 확인해 주세요.");
      }
      throw new ApiError(503, "audit_unavailable", "변경과 감사 기록을 함께 저장하지 못했습니다.");
    }
    return apiSuccess(adminRecord(updated.data as Record<string, unknown>, config), context.requestId, {
      headers: { "cache-control": "private, no-store" },
    });
  };
}

async function createWithAudit(options: {
  config: ResourceConfig;
  context: RouteContext;
  operator: OperatorContext;
  reason: string;
  values: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const inserted = await createBackendAdminClient().rpc("operator_create_resource", {
    p_operator_id: options.operator.user.id,
    p_request_id: requestUuid(options.context),
    p_resource: options.config.kind,
    p_values: options.values,
    p_reason: options.reason,
  });
  if (inserted.error || !inserted.data) {
    if (inserted.error?.code === "42501") throw new ApiError(403, "operator_scope_required", "이 작업을 수행할 권한이 없습니다.");
    if (["22023", "23503", "23505", "23514"].includes(inserted.error?.code ?? "")) {
      throw new ApiError(422, "invalid_record", "저장할 값을 확인해 주세요.");
    }
    throw new ApiError(503, "audit_unavailable", "항목과 감사 기록을 함께 저장하지 못했습니다.");
  }
  return inserted.data as Record<string, unknown>;
}

function idempotentAdminCreate<T>(options: {
  body: T;
  config: ResourceConfig;
  context: RouteContext;
  operator: OperatorContext;
  reason: string;
  request: Request;
  route: string;
  values: Record<string, unknown>;
}): Promise<Response> {
  return executeIdempotent({
    actorId: options.operator.user.id,
    actorType: "user",
    operation: async () => ({
      data: adminRecord(await createWithAudit(options), options.config),
      status: 201,
    }),
    payload: options.body,
    request: options.request,
    requestId: options.context.requestId,
    route: options.route,
  });
}

export const listAdminCategories = listHandler(resources.category);
export const updateAdminCategory = transitionHandler(resources.category);
export const listAdminTags = listHandler(resources.tag);
export const updateAdminTag = transitionHandler(resources.tag);
export const listAdminPlaces = listHandler(resources.place);
export const getAdminPlace = getHandler(resources.place);
export const listAdminMedia = listHandler(resources.media);
export const getAdminMedia = getHandler(resources.media);
const transitionAdminMedia = transitionHandler(resources.media);
export const listAdminContents = listHandler(resources.content);
export const getAdminContent = getHandler(resources.content);
export const updateAdminContent = transitionHandler(resources.content);
export const listAdminModerationItems = listAdminContents;
export const getAdminModeration = getAdminContent;
export const updateAdminModeration = updateAdminContent;
export const listAdminReports = listHandler(resources.report);
export const getAdminReport = getHandler(resources.report);
export const updateAdminReport = transitionHandler(resources.report);
export const listAdminInquiries = listHandler(resources.inquiry);
export const getAdminInquiry = getHandler(resources.inquiry);
export const updateAdminInquiry = transitionHandler(resources.inquiry);
export const listAdminUsers = listHandler(resources.user);
export const getAdminUser = getHandler(resources.user);
export const updateAdminUser = transitionHandler(resources.user);
export const listAdminCurators = listHandler(curatorResource);
export const getAdminCurator = getHandler(curatorResource);
export const updateAdminCurator = transitionHandler(curatorResource);
export const listAdminPartnerships = listHandler(resources.partnership);
export const getAdminPartnership = getHandler(resources.partnership);
export const updateAdminPartnership = transitionHandler(resources.partnership);
export const listAdminOrganizations = listHandler(resources.organization);
export const getAdminOrganization = getHandler(resources.organization);
export const updateAdminOrganization = transitionHandler(resources.organization);
export const listAdminCampaigns = listHandler(resources.campaign);
export const getAdminCampaign = getHandler(resources.campaign);
export const updateAdminCampaign = transitionHandler(resources.campaign);

export const updateAdminPlace: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "content:write");
  const body = await parseJson(request, adminPlaceUpdateInput, 32 * 1024);
  const id = safeId.safeParse(context.params.id);
  if (!id.success) throw new ApiError(404, "not_found", "장소를 찾을 수 없습니다.");
  const values: Record<string, unknown> = {};
  const fields: Array<[keyof typeof body, string]> = [
    ["name", "name"], ["shortCopy", "short_copy"], ["categoryId", "category_id"],
    ["neighborhoodId", "neighborhood_id"], ["address", "address"], ["latitude", "lat"],
    ["longitude", "lng"], ["nearestStation", "nearest_station"], ["hoursText", "hours_text"],
    ["phoneText", "phone_text"], ["moodTags", "mood_tags"], ["bestFor", "best_for"],
    ["timeTags", "time_tags"], ["priceLevel", "price_hint"],
    ["representativeMenuName", "representative_menu_name"],
    ["representativeMenuPrice", "representative_menu_price"],
    ["stayTimeMinutes", "stay_time_minutes"], ["externalMapUrl", "naver_place_url"], ["status", "status"],
  ];
  for (const [input, column] of fields) if (body[input] !== undefined) values[column] = body[input];
  const updated = await createBackendAdminClient().rpc("operator_update_place", {
    p_operator_id: operator.user.id,
    p_request_id: requestUuid(context),
    p_place_id: id.data,
    p_values: values,
    p_expected_version: body.expectedVersion,
    p_reason: body.reason,
  });
  if (updated.error) {
    if (updated.error.code === "40001") throw new ApiError(409, "version_conflict", "다른 운영자가 먼저 변경했습니다.");
    if (updated.error.code === "P0002") throw new ApiError(404, "not_found", "장소를 찾을 수 없습니다.");
    if (updated.error.code === "42501") throw new ApiError(403, "operator_scope_required", "이 작업을 수행할 권한이 없습니다.");
    if (["22023", "23502", "23503", "23514"].includes(updated.error.code ?? "")) {
      throw new ApiError(422, "invalid_place", "장소 정보를 확인해 주세요.");
    }
    throw new ApiError(503, "audit_unavailable", "장소와 감사 기록을 함께 저장하지 못했습니다.");
  }
  return apiSuccess(adminRecord(updated.data as Record<string, unknown>, resources.place), context.requestId, {
    headers: { "cache-control": "private, no-store" },
  });
};

export const updateAdminMedia: RouteHandler = async (request, context) => {
  await requireOperator(request, "content:write");
  const body = await parseJson(request, adminTransitionInput, 8 * 1024);
  const id = uuid.safeParse(context.params.id);
  if (!id.success) throw new ApiError(404, "not_found", "미디어를 찾을 수 없습니다.");
  const admin = createBackendAdminClient();
  const existing = await admin.from("media_assets")
    .select("id,status,storage_bucket,storage_path,version").eq("id", id.data).maybeSingle();
  if (existing.error) throw new ApiError(503, "database_unavailable", "미디어를 불러오지 못했습니다.");
  if (!existing.data) throw new ApiError(404, "not_found", "미디어를 찾을 수 없습니다.");
  if (body.status === "approved" && !["uploaded", "approved"].includes(existing.data.status)) {
    throw new ApiError(422, "invalid_transition", "업로드가 완료된 미디어만 승인할 수 있습니다.");
  }

  const shouldPromote = body.status === "approved" && existing.data.storage_bucket === "media-quarantine";
  if (shouldPromote) {
    await admin.storage.from("media-approved").remove([existing.data.storage_path]);
    const copied = await admin.storage.from("media-quarantine").copy(
      existing.data.storage_path,
      existing.data.storage_path,
      { destinationBucket: "media-approved" },
    );
    if (copied.error) throw new ApiError(503, "storage_unavailable", "승인 미디어를 안전한 저장소로 옮기지 못했습니다.");
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const replay = new Request(request.url, { method: request.method, headers, body: JSON.stringify(body) });
  try {
    const response = await transitionAdminMedia(replay, context);
    if (!response.ok && shouldPromote) {
      await admin.storage.from("media-approved").remove([existing.data.storage_path]);
    } else if (response.ok && shouldPromote) {
      await admin.storage.from("media-quarantine").remove([existing.data.storage_path]);
    }
    return response;
  } catch (error) {
    if (shouldPromote) await admin.storage.from("media-approved").remove([existing.data.storage_path]);
    throw error;
  }
};

export const createAdminCategory: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "content:write");
  const body = await parseJson(request, adminTaxonomyInput, 8 * 1024);
  return idempotentAdminCreate({ body, config: resources.category, context, operator, reason: body.reason, request,
    route: "/api/v1/admin/categories", values: { id: body.id, name: body.name, display_order: body.displayOrder ?? 0 } });
};

export const createAdminTag: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "content:write");
  const body = await parseJson(request, adminTaxonomyInput, 8 * 1024);
  return idempotentAdminCreate({ body, config: resources.tag, context, operator, reason: body.reason, request,
    route: "/api/v1/admin/tags", values: { key: body.id, name: body.name, group_key: body.kind || "general", display_order: body.displayOrder ?? 0 } });
};

export const createAdminPlace: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "content:write");
  const body = await parseJson(request, adminPlaceInput, 12 * 1024);
  return idempotentAdminCreate({ body, config: resources.place, context, operator, reason: body.reason, request,
    route: "/api/v1/admin/places", values: {
      id: body.id, name: body.name, category_id: body.categoryId, neighborhood_id: body.neighborhoodId,
      address: body.address, lat: body.latitude, lng: body.longitude,
    } });
};

export const createAdminPartnership: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "business:write");
  const body = await parseJson(request, adminPartnershipInput, 8 * 1024);
  return idempotentAdminCreate({ body, config: resources.partnership, context, operator, reason: body.reason, request,
    route: "/api/v1/admin/partnerships", values: { organization_id: body.organizationId, place_id: body.placeId, status: body.status } });
};

export const createAdminOrganization: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "business:write");
  const body = await parseJson(request, adminOrganizationInput, 8 * 1024);
  return idempotentAdminCreate({
    body,
    config: resources.organization,
    context,
    operator,
    reason: body.reason,
    request,
    route: "/api/v1/admin/organizations",
    values: { id: randomUUID(), name: body.name, status: body.status },
  });
};

export const createAdminCampaign: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "business:write");
  const body = await parseJson(request, adminCampaignInput, 8 * 1024);
  return idempotentAdminCreate({ body, config: resources.campaign, context, operator, reason: body.reason, request,
    route: "/api/v1/admin/campaigns", values: { advertiser_id: body.advertiserId, name: body.name, starts_at: body.startsAt, ends_at: body.endsAt } });
};

export const adminIntakeScopes = {
  beta: "analytics:read",
  creator: "users:moderate",
  business: "business:write",
  recommendation: "content:write",
  inquiry: "users:moderate",
  partner: "business:write",
  campaign: "business:write",
  "notify-taste": "analytics:read",
  "notify-event": "analytics:read",
} as const;

function intakeConfig(context: RouteContext): ResourceConfig {
  const kind = context.params.kind as keyof typeof adminIntakeScopes;
  const scope = adminIntakeScopes[kind];
  if (!scope) throw new ApiError(404, "not_found", "신청 유형을 찾을 수 없습니다.");
  return {
    table: "intake_submissions", keyColumn: "id", kind, labelColumn: "label", summaryColumn: "contact_email",
    noteColumn: "operator_note", scope, select: "id,kind,label,contact_email,payload,status,operator_note,version,created_at,updated_at",
    extraFilter: () => ({ column: "kind", value: kind }),
  };
}

export const listAdminIntake: RouteHandler = async (request, context) => listHandler(intakeConfig(context))(request, context);
export const getAdminIntake: RouteHandler = async (request, context) => getHandler(intakeConfig(context))(request, context);
export const updateAdminIntake: RouteHandler = async (request, context) => transitionHandler(intakeConfig(context))(request, context);
export const listAdminForms = listAdminIntake;
export const getAdminForm = getAdminIntake;
export const updateAdminForm = updateAdminIntake;

export const listAdminAudit: RouteHandler = async (request, context) => {
  await requireOperator(request, "operators:manage");
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  let query = createBackendAdminClient().from("operator_audit_logs")
    .select("id,operator_user_id,action,entity_type,entity_id,reason,request_id,created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.value},and(created_at.eq.${cursor.value},id.lt.${cursor.id})`);
  const rows = databaseList<Record<string, unknown>>(await query);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return apiSuccess({ items: page.map((row) => ({
    id: row.id, operatorId: row.operator_user_id, action: row.action, entityType: row.entity_type,
    entityId: row.entity_id, reason: row.reason, requestId: row.request_id, createdAt: row.created_at,
  })) }, context.requestId, {
    meta: { nextCursor: hasMore && last ? encodeCursor(String(last.created_at), String(last.id), context.url.searchParams) : null },
    headers: { "cache-control": "private, no-store" },
  });
};

export const getAdminAnalytics: RouteHandler = async (request, context) => {
  await requireOperator(request, "analytics:read");
  const client = createBackendAdminClient();
  const [users, saves, savedCourses, shares, courses] = await Promise.all([
    client.from("user_accounts").select("user_id", { count: "exact", head: true }).eq("status", "active"),
    client.from("saved_places").select("id", { count: "exact", head: true }),
    client.from("saved_courses").select("id", { count: "exact", head: true }),
    client.from("shared_links").select("id", { count: "exact", head: true }),
    client.from("courses").select("id", { count: "exact", head: true }),
  ]);
  if ([users, saves, savedCourses, shares, courses].some((result) => result.error)) {
    throw new ApiError(503, "analytics_unavailable", "운영 지표를 불러오지 못했습니다.");
  }
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  return apiSuccess({
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    metrics: {
      activeUsers: users.count ?? 0,
      saves: (saves.count ?? 0) + (savedCourses.count ?? 0),
      shares: shares.count ?? 0,
      courseCreates: courses.count ?? 0,
    },
  }, context.requestId, { headers: { "cache-control": "private, no-store" } });
};

export const getAdminDashboard = getAdminAnalytics;
export const getAdminStats = getAdminAnalytics;

export const importAdminNaverPlace: RouteHandler = async (request, context) => {
  const operator = await requireOperator(request, "content:write");
  const body = await parseJson(request, adminNaverImportInput, 8 * 1024);
  const normalizedUrl = new URL(body.url);
  normalizedUrl.hash = "";
  const deduplicationKey = createHash("sha256").update(normalizedUrl.toString()).digest("hex");
  const config: ResourceConfig = {
    table: "intake_submissions",
    keyColumn: "id",
    kind: "naver_import",
    labelColumn: "label",
    summaryColumn: "contact_email",
    noteColumn: "operator_note",
    scope: "content:write",
    select: "id,kind,label,contact_email,status,operator_note,version,created_at,updated_at",
  };
  return idempotentAdminCreate({
    body,
    config,
    context,
    operator,
    reason: body.reason,
    request,
    route: "/api/v1/admin/imports/naver-place",
    values: {
      kind: "recommendation",
      label: normalizedUrl.hostname,
      deduplication_key: deduplicationKey,
      consent_version: "operator-import-v1",
      source: "admin_naver_import",
      payload: {
        url: normalizedUrl.toString(),
        neighborhoodId: body.neighborhoodId ?? null,
        categoryId: body.categoryId ?? null,
      },
    },
  });
};
