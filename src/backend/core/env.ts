import { ApiError } from "./errors.js";

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

export type BackendEnvironment = {
  allowedCallbackUrls: string[];
  allowedOrigins: string[];
  appUrl: string;
  isProduction: boolean;
  serviceRoleKey: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
};

export function backendEnvironment(): BackendEnvironment {
  return {
    allowedCallbackUrls: (process.env.AUTH_ALLOWED_CALLBACK_URLS ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean),
    allowedOrigins: (process.env.DORIPE_API_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean),
    appUrl: firstEnv("DORIPE_APP_URL", "PUBLIC_SITE_URL", "VERCEL_PROJECT_PRODUCTION_URL"),
    isProduction: process.env.NODE_ENV === "production",
    serviceRoleKey: firstEnv("SUPABASE_SERVICE_ROLE_KEY"),
    supabasePublishableKey: firstEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    ),
    supabaseUrl: firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
  };
}

export function requireBackendEnvironment(
  ...keys: Array<keyof Pick<BackendEnvironment, "serviceRoleKey" | "supabasePublishableKey" | "supabaseUrl">>
): BackendEnvironment {
  const env = backendEnvironment();
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new ApiError(503, "service_not_configured", "서비스 설정이 완료되지 않았습니다.");
  }
  return env;
}

export function publicAuthConfiguration(): Record<string, unknown> {
  const env = requireBackendEnvironment("supabaseUrl", "supabasePublishableKey");
  const configuredAppUrl = env.appUrl
    ? (/^https?:\/\//.test(env.appUrl) ? env.appUrl : `https://${env.appUrl}`)
    : "";
  return {
    supabaseUrl: env.supabaseUrl,
    publishableKey: env.supabasePublishableKey,
    enabledMethods: ["email_password", "email_verification", "password_recovery"],
    allowedCallbackUrls: env.allowedCallbackUrls.length
      ? env.allowedCallbackUrls
      : configuredAppUrl
        ? [new URL("/app/auth/callback", configuredAppUrl).toString(), new URL("/app/auth/recovery", configuredAppUrl).toString()]
        : [],
  };
}
