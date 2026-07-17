import { createHash } from "node:crypto";
import { ApiError } from "./errors.js";
import { backendEnvironment } from "./env.js";
import { createBackendAdminClient } from "./supabase.js";

type Bucket = { count: number; resetAt: number };
const developmentBuckets = new Map<string, Bucket>();

export function durableRateLimitReady(): boolean {
  const env = backendEnvironment();
  return !env.isProduction || Boolean(env.supabaseUrl && env.serviceRoleKey);
}

export function assertPublicWritesReady(): void {
  if (!durableRateLimitReady()) {
    throw new ApiError(503, "public_writes_not_ready", "공개 제출 보호 설정이 완료되지 않았습니다.");
  }
}

export async function consumeDevelopmentRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): Promise<void> {
  const env = backendEnvironment();
  if (env.isProduction) {
    assertPublicWritesReady();
    const routeKey = key.split(":", 1)[0] || "public-write";
    const bucketHash = createHash("sha256").update(key).digest("hex");
    const result = await createBackendAdminClient().rpc("consume_rate_limit", {
      p_bucket_key_hash: bucketHash,
      p_route_key: routeKey,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
      p_cost: 1,
    });
    if (result.error || !Array.isArray(result.data) || !result.data[0]) {
      throw new ApiError(503, "rate_limit_unavailable", "요청 보호 장치를 확인하고 있습니다. 잠시 뒤 다시 시도해 주세요.");
    }
    const bucket = result.data[0] as { is_allowed: boolean; reset_at: string };
    if (!bucket.is_allowed) {
      const retryAfter = Math.max(1, Math.ceil((Date.parse(bucket.reset_at) - Date.now()) / 1000));
      throw new ApiError(429, "rate_limited", "잠시 뒤 다시 시도해 주세요.", { retryAfter });
    }
    return;
  }

  const now = Date.now();
  const current = developmentBuckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  developmentBuckets.set(key, bucket);
  if (bucket.count > limit) {
    throw new ApiError(429, "rate_limited", "잠시 뒤 다시 시도해 주세요.", {
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
  }
}
