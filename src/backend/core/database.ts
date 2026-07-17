import { ApiError } from "./errors.js";

type SupabaseResult = { data: unknown; error: { code?: string; message: string } | null };

export function databaseData<T>(result: SupabaseResult, fallbackMessage = "데이터를 불러오지 못했습니다."): T {
  if (result.error) throw new ApiError(503, "database_unavailable", fallbackMessage);
  if (result.data === null) throw new ApiError(404, "not_found", "요청한 정보를 찾을 수 없습니다.");
  return result.data as T;
}

export function databaseList<T>(result: SupabaseResult, fallbackMessage = "목록을 불러오지 못했습니다."): T[] {
  if (result.error) throw new ApiError(503, "database_unavailable", fallbackMessage);
  return (result.data ?? []) as T[];
}
