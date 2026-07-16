import type { ZodError } from "zod";

export type ApiErrorDetails = Record<string, unknown>;

export class ApiError extends Error {
  readonly code: string;
  readonly details?: ApiErrorDetails;
  readonly status: number;

  constructor(status: number, code: string, message: string, details?: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(error: ZodError): ApiError {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "body", issue.message]),
  );
  return new ApiError(400, "validation_error", "요청값을 확인해 주세요.", { fields });
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(500, "internal_error", "요청을 처리하지 못했습니다.");
}
