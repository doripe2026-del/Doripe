import { ApiError } from "./errors.js";

const REDACTED_KEY_PARTS = [
  "authorization",
  "cookie",
  "email",
  "phone",
  "password",
  "refresh_token",
  "secret",
  "token",
];

function sensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return REDACTED_KEY_PARTS.some((part) => normalized.includes(part.replace("_", "")));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKey(key) ? "[REDACTED]" : redact(item),
    ]),
  );
}

export function logBackendError(error: unknown, context: Record<string, unknown>): void {
  const development = process.env.NODE_ENV === "development";
  const safeError = error instanceof Error
    ? {
        name: error.name,
        code: error instanceof ApiError ? error.code : undefined,
        status: error instanceof ApiError ? error.status : undefined,
        message: development || error instanceof ApiError ? error.message : "Unhandled backend error",
        stack: development ? error.stack : undefined,
      }
    : { name: "UnknownError" };

  console.error(JSON.stringify(redact({ ...context, error: safeError })));
}
