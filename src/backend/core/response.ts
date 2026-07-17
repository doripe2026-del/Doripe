import { ApiError, toApiError } from "./errors.js";

export type ResponseMeta = Record<string, unknown>;

function baseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  return headers;
}

export function apiSuccess(
  data: unknown,
  requestId: string,
  options: { status?: number; meta?: ResponseMeta; headers?: HeadersInit } = {},
): Response {
  return new Response(JSON.stringify({ data, meta: { requestId, ...(options.meta ?? {}) } }), {
    status: options.status ?? 200,
    headers: baseHeaders(options.headers),
  });
}

export function apiFailure(error: unknown, requestId: string): Response {
  const safe = toApiError(error);
  const body: Record<string, unknown> = {
    code: safe.code,
    message: safe.message,
    requestId,
  };
  if (safe.details) body.details = safe.details;

  const headers = baseHeaders();
  if (safe.status === 401) headers.set("www-authenticate", "Bearer");
  if (safe.status === 429 && safe.details?.retryAfter) {
    headers.set("retry-after", String(safe.details.retryAfter));
  }
  return new Response(JSON.stringify({ error: body }), { status: safe.status, headers });
}

export function methodNotAllowed(allowed: string[]): ApiError {
  return new ApiError(405, "method_not_allowed", "지원하지 않는 요청 방식입니다.", { allowed });
}
