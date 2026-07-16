import { ApiError, validationError } from "./errors.js";
import type { ZodType } from "zod";

export const DEFAULT_JSON_LIMIT = 64 * 1024;

async function readLimitedBytes(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, "payload_too_large", "요청 본문이 너무 큽니다.");
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, "payload_too_large", "요청 본문이 너무 큽니다.");
    }
    chunks.push(value);
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function parseJson<T>(request: Request, schema: ZodType<T>, maxBytes = DEFAULT_JSON_LIMIT): Promise<T> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "JSON 요청만 지원합니다.");
  }

  const bytes = await readLimitedBytes(request, maxBytes);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, "invalid_json", "올바른 JSON 요청이 아닙니다.");
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function requireIdempotencyKey(request: Request): string {
  const key = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new ApiError(400, "invalid_idempotency_key", "유효한 Idempotency-Key가 필요합니다.");
  }
  return key;
}
