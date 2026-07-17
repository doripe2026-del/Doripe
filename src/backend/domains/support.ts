import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "../core/auth.js";
import { decodeCursor, encodeCursor, parseLimit } from "../core/cursor.js";
import { databaseData, databaseList } from "../core/database.js";
import { ApiError } from "../core/errors.js";
import { executeIdempotent } from "../core/idempotency.js";
import { consumeDevelopmentRateLimit } from "../core/rateLimit.js";
import { parseJson } from "../core/request.js";
import { apiSuccess } from "../core/response.js";
import type { RouteContext, RouteHandler } from "../core/router.js";

export const inquiryCreateSchema = z.object({
  category: z.enum(["bug", "feedback", "account", "content", "other"]),
  text: z.string().trim().min(1).max(5000),
}).strict();

export const reportCreateSchema = z.object({
  targetType: z.enum(["user", "place", "content"]),
  targetId: z.string().min(1).max(96),
  reasonCode: z.enum(["spam", "abuse", "rights", "incorrect", "unsafe", "other"]),
  details: z.string().max(2000).optional(),
}).strict();

type SupportRow = {
  created_at: string;
  id: string;
  status: "received" | "reviewing" | "resolved" | "closed";
  updated_at: string;
};

function supportItem(row: SupportRow, kind: "inquiry" | "report", target?: { type: string; id: string }) {
  return {
    id: row.id,
    kind,
    status: row.status,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSupportError(error: { code?: string } | null): never {
  if (error?.code === "23503" || error?.code === "23514") {
    throw new ApiError(422, "invalid_support_request", "문의 또는 신고 내용을 확인해 주세요.");
  }
  throw new ApiError(503, "database_unavailable", "요청을 접수하지 못했습니다.");
}

async function assertReportTarget(client: Awaited<ReturnType<typeof requireUser>>["userClient"], body: z.infer<typeof reportCreateSchema>) {
  if (body.targetType === "user") {
    const id = z.string().uuid().safeParse(body.targetId);
    if (!id.success) throw new ApiError(404, "not_found", "신고 대상을 찾을 수 없습니다.");
    databaseData(await client.from("public_profiles").select("user_id").eq("user_id", id.data).maybeSingle());
    return;
  }
  if (body.targetType === "content") {
    const id = z.string().uuid().safeParse(body.targetId);
    if (!id.success) throw new ApiError(404, "not_found", "신고 대상을 찾을 수 없습니다.");
    databaseData(await client.from("contents").select("id").eq("id", id.data).eq("status", "published").maybeSingle());
    return;
  }
  databaseData(await client.from("places").select("id").eq("id", body.targetId).eq("status", "ready").maybeSingle());
}

export const createInquiry: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, inquiryCreateSchema, 16 * 1024);
  await consumeDevelopmentRateLimit(`inquiry:${auth.user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  const id = randomUUID();
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/inquiries",
    payload: body,
    operation: async () => {
      const result = await auth.userClient.from("inquiries").insert({
        id,
        user_id: auth.user.id,
        category: body.category,
        body: body.text,
      }).select("id,status,version,created_at,updated_at").single();
      if (result.error) mapSupportError(result.error);
      return { data: { id: result.data.id, status: result.data.status, version: result.data.version }, status: 201 };
    },
  });
};

export const createReport: RouteHandler = async (request, context) => {
  const auth = await requireUser(request);
  const body = await parseJson(request, reportCreateSchema, 12 * 1024);
  await assertReportTarget(auth.userClient, body);
  await consumeDevelopmentRateLimit(`report:${auth.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  const id = randomUUID();
  return executeIdempotent({
    request,
    requestId: context.requestId,
    actorType: "user",
    actorId: auth.user.id,
    route: "/api/v1/reports",
    payload: body,
    operation: async () => {
      const result = await auth.userClient.from("reports").insert({
        id,
        reporter_user_id: auth.user.id,
        target_type: body.targetType,
        target_id: body.targetId,
        reason_code: body.reasonCode,
        details: body.details ?? "",
      }).select("id,status,version,created_at,updated_at").single();
      if (result.error) mapSupportError(result.error);
      return { data: { id: result.data.id, status: result.data.status, version: result.data.version }, status: 201 };
    },
  });
};

async function listSupport(request: Request, context: RouteContext, kind: "inquiry" | "report") {
  const auth = await requireUser(request);
  const limit = parseLimit(context.url);
  const cursor = decodeCursor(context.url.searchParams.get("cursor"), context.url.searchParams);
  const table = kind === "inquiry" ? "inquiries" : "reports";
  const ownerColumn = kind === "inquiry" ? "user_id" : "reporter_user_id";
  const selection = kind === "inquiry"
    ? "id,status,created_at,updated_at"
    : "id,status,target_type,target_id,created_at,updated_at";
  let query = auth.userClient.from(table).select(selection).eq(ownerColumn, auth.user.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.value},and(created_at.eq.${cursor.value},id.lt.${cursor.id})`);
  const rows = databaseList<Record<string, unknown>>(await query);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const items = page.map((item) => supportItem(item as unknown as SupportRow, kind, kind === "report" ? {
    type: String(item.target_type),
    id: String(item.target_id),
  } : undefined));
  const last = page.at(-1);
  return apiSuccess({ items }, context.requestId, {
    meta: { nextCursor: hasMore && last ? encodeCursor(String(last.created_at), String(last.id), context.url.searchParams) : null },
    headers: { "cache-control": "private, no-store" },
  });
}

export const listMyInquiries: RouteHandler = (request, context) => listSupport(request, context, "inquiry");
export const listMyReports: RouteHandler = (request, context) => listSupport(request, context, "report");
