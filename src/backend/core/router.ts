import { randomUUID } from "node:crypto";
import { applyCors, assertAllowedOrigin } from "./cors.js";
import { ApiError } from "./errors.js";
import { logBackendError } from "./logger.js";
import { apiFailure } from "./response.js";

export type RouteContext = {
  params: Record<string, string>;
  requestId: string;
  url: URL;
};

export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response> | Response;

export type RouteDefinition = {
  auth: "operator" | "public" | "user" | "optional";
  handler: RouteHandler;
  method: string;
  operationId: string;
  path: string;
  scope?: string;
};

function routePath(url: URL): string {
  return url.pathname.replace(/^\/api\/v1\/?/, "").replace(/^\/v1\/?/, "").replace(/^\/+|\/+$/g, "");
}

function matchPath(pattern: string, actual: string): Record<string, string> | null {
  const patternParts = pattern.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const actualParts = actual.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (patternParts.length !== actualParts.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const value = actualParts[index];
    if (expected.startsWith(":")) {
      try {
        params[expected.slice(1)] = decodeURIComponent(value);
      } catch {
        return null;
      }
    } else if (expected !== value) {
      return null;
    }
  }
  return params;
}

function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  return /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
}

export function createApiRouter(routes: RouteDefinition[]) {
  const unique = new Set<string>();
  for (const route of routes) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    if (unique.has(key)) throw new Error(`Duplicate backend route: ${key}`);
    unique.add(key);
  }

  return async function handle(request: Request): Promise<Response> {
    const id = requestId(request);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return applyCors(request, new Response(null, { status: 204 }));
    }

    try {
      assertAllowedOrigin(request);
      const path = routePath(url);
      const matches = routes
        .map((route) => ({ route, params: matchPath(route.path, path) }))
        .filter((item): item is { route: RouteDefinition; params: Record<string, string> } => item.params !== null);
      const selected = matches.find(({ route }) => route.method.toUpperCase() === request.method.toUpperCase());
      if (!selected) {
        const allowed = matches.map(({ route }) => route.method.toUpperCase());
        if (allowed.length) throw new ApiError(405, "method_not_allowed", "지원하지 않는 요청 방식입니다.", { allowed });
        throw new ApiError(404, "route_not_found", "API 경로를 찾을 수 없습니다.");
      }

      const response = await selected.route.handler(request, { params: selected.params, requestId: id, url });
      response.headers.set("x-request-id", id);
      return applyCors(request, response);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500) {
        logBackendError(error, { requestId: id, method: request.method, path: url.pathname });
      }
      const response = apiFailure(error, id);
      response.headers.set("x-request-id", id);
      return applyCors(request, response);
    }
  };
}
