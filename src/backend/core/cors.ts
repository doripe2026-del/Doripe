import { ApiError } from "./errors.js";
import { backendEnvironment } from "./env.js";

export function assertAllowedOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const env = backendEnvironment();
  if (!env.allowedOrigins.includes(origin.replace(/\/$/, ""))) {
    throw new ApiError(403, "origin_not_allowed", "허용되지 않은 요청 출처입니다.");
  }
}

export function applyCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  const env = backendEnvironment();
  if (origin && env.allowedOrigins.includes(origin.replace(/\/$/, ""))) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-allow-headers", "authorization, content-type, idempotency-key, x-request-id");
    response.headers.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("vary", "Origin");
  }
  return response;
}
