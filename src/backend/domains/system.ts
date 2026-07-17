import { backendEnvironment, publicAuthConfiguration } from "../core/env.js";
import { durableRateLimitReady } from "../core/rateLimit.js";
import { apiSuccess } from "../core/response.js";
import type { RouteHandler } from "../core/router.js";
import { createBackendAdminClient } from "../core/supabase.js";

export const authConfig: RouteHandler = (_request, context) => apiSuccess(publicAuthConfiguration(), context.requestId, {
  headers: { "cache-control": "public, max-age=300, stale-while-revalidate=60" },
});

export const health: RouteHandler = (_request, context) => apiSuccess({ status: "ok" }, context.requestId, {
  headers: { "cache-control": "no-store" },
});

export const readiness: RouteHandler = async (_request, context) => {
  const env = backendEnvironment();
  let databaseReady = false;
  let storageReady = false;
  let limiterReady = false;
  if (env.supabaseUrl && env.serviceRoleKey) {
    const client = createBackendAdminClient();
    const [database, storage, limiter] = await Promise.all([
      client.from("user_accounts").select("user_id").limit(1),
      client.storage.listBuckets(),
      client.from("rate_limit_buckets").select("route_key").limit(1),
    ]);
    databaseReady = !database.error;
    const bucketIds = new Set(storage.data?.map((bucket) => bucket.id) ?? []);
    storageReady = !storage.error && bucketIds.has("media-quarantine") && bucketIds.has("media-approved");
    limiterReady = !limiter.error && durableRateLimitReady();
  }
  const callbackReady = !env.isProduction || env.allowedCallbackUrls.length > 0 || Boolean(env.appUrl);
  const corsReady = !env.isProduction || env.allowedOrigins.length > 0;
  const authReady = Boolean(env.supabaseUrl && env.supabasePublishableKey && callbackReady && corsReady);
  const retentionReady = !env.isProduction || Boolean(process.env.DORIPE_IDEMPOTENCY_RETENTION_HOURS);
  const ready = databaseReady && authReady && storageReady && limiterReady && retentionReady;
  const checks = {
    database: databaseReady ? "ready" : "unavailable",
    auth: authReady ? "ready" : "unavailable",
    storage: storageReady ? "ready" : "unavailable",
    rateLimiter: limiterReady && retentionReady ? "ready" : "unavailable",
  };
  return apiSuccess({ status: ready ? "ok" : "degraded", ready, checks }, context.requestId, {
    status: ready ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
};
