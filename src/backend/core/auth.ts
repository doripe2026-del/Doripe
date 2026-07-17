import type { User } from "@supabase/supabase-js";
import { ApiError } from "./errors.js";
import { createBackendAdminClient, createBackendAuthClient, createBackendUserClient } from "./supabase.js";

export type UserContext = {
  jwt: string;
  status: string;
  user: User;
  userClient: ReturnType<typeof createBackendUserClient>;
};

export type OperatorContext = UserContext & {
  scopes: string[];
};

const operatorScopes = new Set([
  "content:write",
  "users:moderate",
  "business:write",
  "analytics:read",
  "operators:manage",
]);

export function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new ApiError(401, "unauthenticated", "로그인이 필요합니다.");
  return match[1];
}

export async function requireUser(request: Request): Promise<UserContext> {
  const jwt = bearerToken(request);
  const auth = createBackendAuthClient();
  const { data, error } = await auth.auth.getUser(jwt);
  if (error || !data.user) throw new ApiError(401, "invalid_session", "로그인 세션을 다시 확인해 주세요.");

  const admin = createBackendAdminClient();
  const account = await admin
    .from("user_accounts")
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (account.error) throw new ApiError(503, "account_state_unavailable", "계정 상태를 확인하지 못했습니다.");
  if (!account.data) throw new ApiError(403, "account_not_ready", "계정 정보 준비가 필요합니다.");
  if (account.data.status !== "active") {
    throw new ApiError(403, "account_restricted", "현재 계정으로 이 작업을 할 수 없습니다.");
  }

  return { jwt, status: account.data.status, user: data.user, userClient: createBackendUserClient(jwt) };
}

export async function optionalUser(request: Request): Promise<UserContext | null> {
  if (!request.headers.get("authorization")) return null;
  return requireUser(request);
}

export async function requireOperator(request: Request, requiredScope?: string): Promise<OperatorContext> {
  const context = await requireUser(request);
  const admin = createBackendAdminClient();
  const operator = await admin
    .from("operator_accounts")
    .select("is_active, scopes")
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (operator.error) throw new ApiError(503, "operator_state_unavailable", "운영자 권한을 확인하지 못했습니다.");
  const scopes = Array.isArray(operator.data?.scopes)
    ? operator.data.scopes.filter((scope): scope is string => typeof scope === "string" && operatorScopes.has(scope))
    : [];
  if (!operator.data?.is_active || (requiredScope && !scopes.includes(requiredScope))) {
    throw new ApiError(403, "operator_scope_required", "이 작업을 수행할 권한이 없습니다.");
  }

  return { ...context, scopes };
}
