import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireBackendEnvironment } from "./env.js";

const sharedOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
} as const;

export function createBackendAdminClient(): SupabaseClient {
  const env = requireBackendEnvironment("supabaseUrl", "serviceRoleKey");
  return createClient(env.supabaseUrl, env.serviceRoleKey, sharedOptions);
}

export function createBackendAuthClient(): SupabaseClient {
  const env = requireBackendEnvironment("supabaseUrl", "supabasePublishableKey");
  return createClient(env.supabaseUrl, env.supabasePublishableKey, sharedOptions);
}

export function createBackendUserClient(jwt: string): SupabaseClient {
  const env = requireBackendEnvironment("supabaseUrl", "supabasePublishableKey");
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    ...sharedOptions,
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
