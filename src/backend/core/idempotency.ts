import { createHash } from "node:crypto";
import { ApiError } from "./errors.js";
import { backendEnvironment } from "./env.js";
import { requireIdempotencyKey } from "./request.js";
import { apiSuccess } from "./response.js";
import { createBackendAdminClient } from "./supabase.js";

type IdempotentResult = { data: unknown; status?: number };

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function retentionHours(): number {
  const raw = process.env.DORIPE_IDEMPOTENCY_RETENTION_HOURS?.trim();
  if (!raw && backendEnvironment().isProduction) {
    throw new ApiError(503, "idempotency_not_ready", "중복 요청 보호 설정이 완료되지 않았습니다.");
  }
  const hours = Number(raw || 24);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30) {
    throw new ApiError(503, "idempotency_not_ready", "중복 요청 보호 설정이 올바르지 않습니다.");
  }
  return hours;
}

export async function executeIdempotent(options: {
  actorId: string;
  actorType: "anonymous" | "user";
  operation: () => Promise<IdempotentResult>;
  payload: unknown;
  request: Request;
  requestId: string;
  route: string;
}): Promise<Response> {
  const key = requireIdempotencyKey(options.request);
  const client = createBackendAdminClient();
  const requestHash = hash(JSON.stringify(stableValue(options.payload)));
  const actorHash = hash(`${options.actorType}:${options.actorId}`);
  const normalizedRoute = options.route.replace(/\/[0-9a-f-]{16,}/gi, "/:id");
  const expiresAt = new Date(Date.now() + retentionHours() * 60 * 60 * 1000).toISOString();
  const insert = await client.from("idempotency_records").insert({
    actor_type: options.actorType,
    actor_id_hash: actorHash,
    http_method: options.request.method,
    normalized_route: normalizedRoute,
    idempotency_key: key,
    request_hash: requestHash,
    status: "processing",
    expires_at: expiresAt,
  }).select("id").single();

  let recordId = insert.data?.id as string | undefined;
  if (insert.error) {
    const existing = await client.from("idempotency_records")
      .select("id,request_hash,status,response_status,response_body,locked_at,expires_at")
      .eq("actor_type", options.actorType)
      .eq("actor_id_hash", actorHash)
      .eq("http_method", options.request.method)
      .eq("normalized_route", normalizedRoute)
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing.error || !existing.data) {
      throw new ApiError(503, "idempotency_unavailable", "중복 요청 보호를 확인하지 못했습니다.");
    }
    if (existing.data.request_hash !== requestHash) {
      throw new ApiError(409, "idempotency_conflict", "같은 요청 키가 다른 내용에 사용됐습니다.");
    }
    if (existing.data.status === "completed") {
      return apiSuccess(existing.data.response_body, options.requestId, { status: existing.data.response_status ?? 200 });
    }
    const lockExpired = Date.parse(existing.data.locked_at) <= Date.now() - 2 * 60 * 1000;
    const recordExpired = existing.data.expires_at && Date.parse(existing.data.expires_at) <= Date.now();
    if (existing.data.status === "failed" || lockExpired || recordExpired) {
      const reclaimed = await client.from("idempotency_records").update({
        status: "processing",
        response_status: null,
        response_body: null,
        completed_at: null,
        locked_at: new Date().toISOString(),
        expires_at: expiresAt,
      }).eq("id", existing.data.id).eq("locked_at", existing.data.locked_at).select("id").maybeSingle();
      if (!reclaimed.error && reclaimed.data) {
        recordId = reclaimed.data.id;
      } else {
        throw new ApiError(409, "request_in_progress", "같은 요청을 처리하고 있습니다.");
      }
    } else {
      throw new ApiError(409, "request_in_progress", "같은 요청을 처리하고 있습니다.");
    }
  }

  try {
    const result = await options.operation();
    const completed = await client.from("idempotency_records").update({
      status: "completed",
      response_status: result.status ?? 200,
      response_body: result.data,
      completed_at: new Date().toISOString(),
    }).eq("id", recordId);
    if (completed.error) throw new ApiError(503, "idempotency_unavailable", "요청 결과를 안전하게 저장하지 못했습니다.");
    return apiSuccess(result.data, options.requestId, { status: result.status ?? 200 });
  } catch (error) {
    if (recordId) {
      await client.from("idempotency_records").update({ status: "failed" }).eq("id", recordId);
    }
    throw error;
  }
}
