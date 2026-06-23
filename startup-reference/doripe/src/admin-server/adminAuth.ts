import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "./response.js";

const COOKIE_NAME = "doripe_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 6;

type LoginAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
};

const failedLoginAttempts = new Map<string, LoginAttempt>();

function adminPassword(): string {
  return process.env.DORIPE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
}

function cookieSecret(): string {
  return process.env.DORIPE_ADMIN_COOKIE_SECRET || process.env.ADMIN_PASSWORD || adminPassword();
}

function sign(value: string): string {
  return createHmac("sha256", cookieSecret()).update(value).digest("hex");
}

function compareDigest(value: string): Buffer {
  return createHmac("sha256", cookieSecret()).update(value).digest();
}

function safeEqual(left: string, right: string): boolean {
  if (!left || !right) return false;
  return timingSafeEqual(compareDigest(left), compareDigest(right));
}

function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

function allowedRequestOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const ownOrigin = requestOrigin(request);
  if (ownOrigin) origins.add(ownOrigin);

  for (const origin of (process.env.DORIPE_ADMIN_ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = origin.trim().replace(/\/$/, "");
    if (trimmed) origins.add(trimmed);
  }

  return origins;
}

function loginAttemptKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 120);
}

function currentAttempt(request: Request): LoginAttempt | null {
  const key = loginAttemptKey(request);
  const attempt = failedLoginAttempts.get(key);
  if (!attempt) return null;

  const now = Date.now();
  if (attempt.lockedUntil && attempt.lockedUntil > now) return attempt;
  if (now - attempt.firstAttemptAt <= LOGIN_WINDOW_MS) return attempt;

  failedLoginAttempts.delete(key);
  return null;
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const value = parseCookies(request.headers.get("cookie"))[COOKIE_NAME];
  if (!value) return false;

  const [issuedAt, signature] = value.split(".");
  if (!issuedAt || !signature || sign(issuedAt) !== signature) return false;

  const timestamp = Number(issuedAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp < SESSION_TTL_MS;
}

export function isSameOriginRequest(request: Request): boolean {
  const allowedOrigins = allowedRequestOrigins(request);
  if (!allowedOrigins.size) return false;

  const origin = request.headers.get("origin");
  if (origin) return allowedOrigins.has(origin.replace(/\/$/, ""));

  const referer = request.headers.get("referer");
  if (!referer) return true;

  try {
    return allowedOrigins.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

export async function requireAdminRequest(request: Request, { checkOrigin = false } = {}): Promise<Response | null> {
  if (checkOrigin && !isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Invalid request origin" }, { status: 403 });
  }

  if (await isAdminRequest(request)) return null;

  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export function verifyAdminPassword(password: string): boolean {
  return safeEqual(password, adminPassword());
}

export function isLoginRateLimited(request: Request): boolean {
  const attempt = currentAttempt(request);
  return Boolean(attempt?.lockedUntil && attempt.lockedUntil > Date.now());
}

export function recordFailedLogin(request: Request): void {
  const key = loginAttemptKey(request);
  const now = Date.now();
  const attempt = currentAttempt(request) ?? { count: 0, firstAttemptAt: now };
  const count = attempt.count + 1;

  failedLoginAttempts.set(key, {
    count,
    firstAttemptAt: attempt.firstAttemptAt,
    lockedUntil: count >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_WINDOW_MS : attempt.lockedUntil,
  });
}

export function clearFailedLogin(request: Request): void {
  failedLoginAttempts.delete(loginAttemptKey(request));
}

export function createAdminSessionResponse() {
  const issuedAt = String(Date.now());
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${issuedAt}.${sign(issuedAt)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
  return response;
}

export function clearAdminSessionResponse() {
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  response.headers.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`);
  return response;
}
