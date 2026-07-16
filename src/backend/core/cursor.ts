import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors.js";

type CursorPayload = {
  filters: string;
  id: string;
  value: string;
  version: 1;
};

function filterHash(filters: URLSearchParams): string {
  const stable = Array.from(filters.entries())
    .filter(([key]) => key !== "cursor")
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
  return createHash("sha256").update(JSON.stringify(stable)).digest("base64url").slice(0, 16);
}

export function encodeCursor(value: string, id: string, filters: URLSearchParams): string {
  const payload: CursorPayload = { version: 1, value, id, filters: filterHash(filters) };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string | null, filters: URLSearchParams): CursorPayload | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    if (value.version !== 1 || !value.value || !value.id || !value.filters) throw new Error("invalid");
    const expected = Buffer.from(filterHash(filters));
    const actual = Buffer.from(value.filters);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("filters");
    return value;
  } catch {
    throw new ApiError(400, "invalid_cursor", "목록 커서가 올바르지 않습니다.");
  }
}

export function parseLimit(url: URL): number {
  const raw = url.searchParams.get("limit") ?? "20";
  if (!/^\d+$/.test(raw)) throw new ApiError(400, "invalid_limit", "limit 값을 확인해 주세요.");
  const limit = Number(raw);
  if (limit < 1 || limit > 50) throw new ApiError(400, "invalid_limit", "limit은 1~50이어야 합니다.");
  return limit;
}
