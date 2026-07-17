export const AUTH_SESSION_STORAGE_KEY = "doripe.app_preview.auth.session.v1";
export const AUTH_PKCE_VERIFIER_STORAGE_KEY = "doripe.app_preview.auth.pkce_verifier.v1";

const CONFIG_ENDPOINT = "/api/app-auth-config";
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_TOKEN_LENGTH = 16_384;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_PKCE_AGE_MS = 15 * 60 * 1000;
const AUTH_QUERY_KEYS = new Set([
  "access_token", "refresh_token", "expires_in", "expires_at", "token_type",
  "code", "error", "error_code", "error_description"
]);
const AUTH_HASH_KEYS = new Set([...AUTH_QUERY_KEYS, "type"]);
const SAFE_MESSAGES = Object.freeze({
  unavailable: "현재 계정 기능을 사용할 수 없어요",
  network: "네트워크 연결을 확인하고 다시 시도해 주세요",
  timeout: "요청 시간이 초과됐어요. 다시 시도해 주세요",
  invalidCredentials: "이메일 또는 비밀번호를 확인해 주세요",
  invalidEmail: "올바른 이메일을 입력해 주세요",
  invalidNewPassword: "새 비밀번호를 다시 확인해 주세요",
  invalidSession: "로그인 정보가 만료됐어요. 다시 로그인해 주세요",
  recoveryMissing: "비밀번호 재설정 링크를 다시 확인해 주세요",
  emailCheck: "이메일을 확인해 주세요",
  signupFailed: "가입 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요",
  resetFailed: "재설정 메일 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요",
  logoutWarning: "로그아웃은 완료했지만 서버 연결을 확인하지 못했어요"
});

function failure(code, message) {
  return { ok: false, code, message };
}

export function isLocalAuthFixtureLocation(locationLike = globalThis.location) {
  const hostname = String(locationLike?.hostname || "").toLowerCase();
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
  return new URLSearchParams(String(locationLike?.search || "")).get("static") === "1";
}

export function normalizeAuthEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null;
  if (/[^\S\r\n]|[\u0000-\u001F\u007F]/u.test(email)) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) return null;
  return email;
}

function normalizePassword(value) {
  if (typeof value !== "string") return null;
  const length = Array.from(value).length;
  if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/u.test(value)) return null;
  return value;
}

function normalizeRedirectUrl(value) {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return null;
    if (url.username || url.password || url.hash) return null;
    if (globalThis.location?.origin && url.origin !== globalThis.location.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}

function decodeBase64UrlJson(value) {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const text = typeof atob === "function"
      ? decodeURIComponent(Array.from(atob(padded), (character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""))
      : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeLegacyKeyRole(key) {
  const parts = key.split(".");
  return parts.length === 3 ? decodeBase64UrlJson(parts[1])?.role || null : null;
}

function accessTokenIsExpired(token, nowValue) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3) return false;
  const exp = Number(decodeBase64UrlJson(parts[1])?.exp);
  return Number.isFinite(exp) && exp * 1000 <= nowValue;
}

export function isPublicSupabaseKey(value) {
  if (typeof value !== "string" || value.length > 4096) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]{16,256}$/.test(value)) return true;
  return decodeLegacyKeyRole(value) === "anon";
}

export function normalizeSupabaseUrl(value) {
  if (typeof value !== "string" || value.length > 200) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (!/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function readStoredSession(storage) {
  try {
    const raw = storage?.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw || raw.length > MAX_TOKEN_LENGTH * 2 + 200) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.accessToken !== "string" || parsed.accessToken.length === 0 || parsed.accessToken.length > MAX_TOKEN_LENGTH) return null;
    if (typeof parsed?.refreshToken !== "string" || parsed.refreshToken.length === 0 || parsed.refreshToken.length > MAX_TOKEN_LENGTH) return null;
    if (!Number.isFinite(parsed?.expiresAt)) return null;
    const flow = parsed.flow === "recovery" ? "recovery" : "auth";
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken, expiresAt: parsed.expiresAt, flow };
  } catch {
    return null;
  }
}

function clearSessionStorage(storage) {
  try {
    storage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Blocked storage is treated as an empty session.
  }
}

function clearPkceVerifier(storage) {
  try {
    storage?.removeItem(AUTH_PKCE_VERIFIER_STORAGE_KEY);
  } catch {
    // Blocked storage is treated as an empty verifier record.
  }
}

function storePkceVerifier(storage, record) {
  if (typeof storage?.setItem !== "function" || typeof storage?.getItem !== "function") return false;
  const serialized = JSON.stringify(record);
  if (serialized.length > 1000) return false;
  try {
    storage.setItem(AUTH_PKCE_VERIFIER_STORAGE_KEY, serialized);
    if (storage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY) === serialized) return true;
  } catch {
    // A blocked or full storage area cannot support a cross-tab PKCE flow.
  }
  clearPkceVerifier(storage);
  return false;
}

function clearAuthStorage(sessionStorage, localStorage) {
  clearSessionStorage(sessionStorage);
  clearPkceVerifier(localStorage);
}

function normalizeSessionResponse(body, nowValue, { requireUser = true } = {}) {
  const accessToken = body?.access_token;
  const refreshToken = body?.refresh_token;
  const tokenType = typeof body?.token_type === "string" ? body.token_type.toLowerCase() : "";
  if (typeof accessToken !== "string" || accessToken.length === 0 || accessToken.length > MAX_TOKEN_LENGTH) return null;
  if (typeof refreshToken !== "string" || refreshToken.length === 0 || refreshToken.length > MAX_TOKEN_LENGTH) return null;
  if (tokenType !== "bearer" || accessTokenIsExpired(accessToken, nowValue)) return null;
  if (requireUser && (typeof body?.user?.id !== "string" || body.user.id.length === 0 || body.user.id.length > 256)) return null;

  const expiresIn = Number(body?.expires_in);
  const explicitExpiry = Number(body?.expires_at) * 1000;
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? nowValue + expiresIn * 1000
    : explicitExpiry;
  if (!Number.isFinite(expiresAt) || expiresAt <= nowValue) return null;
  return { accessToken, refreshToken, expiresAt };
}

function storeSession(storage, body, nowValue, { flow = "auth", ...options } = {}) {
  const normalized = normalizeSessionResponse(body, nowValue, options);
  const session = normalized ? { ...normalized, flow: flow === "recovery" ? "recovery" : "auth" } : null;
  if (!session) return false;
  try {
    storage?.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    clearSessionStorage(storage);
    return false;
  }
}

function sanitizeCallbackUrl(rawUrl) {
  const url = new URL(rawUrl);
  const query = new URLSearchParams(url.search);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const queryValues = Object.fromEntries([...AUTH_QUERY_KEYS].map((key) => [key, query.get(key)]));
  const hashValues = Object.fromEntries([...AUTH_HASH_KEYS].map((key) => [key, hash.get(key)]));
  const hasQueryAuth = [...AUTH_QUERY_KEYS].some((key) => query.has(key));
  const hasHashAuth = [...AUTH_HASH_KEYS].some((key) => hash.has(key));
  for (const key of AUTH_QUERY_KEYS) query.delete(key);
  if (hasQueryAuth && query.get("type") === "recovery") query.delete("type");
  url.search = query.toString();
  if (hasHashAuth) url.hash = "";
  return { url, queryValues, hashValues, hasQueryAuth, hasHashAuth };
}

function readPkceVerifier(storage, nowValue, origin) {
  try {
    const raw = storage?.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY);
    if (!raw || raw.length > 1000) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.flow !== "recovery") return null;
    if (parsed.origin !== origin) return null;
    if (typeof parsed.verifier !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(parsed.verifier)) return null;
    if (!Number.isFinite(parsed.createdAt) || nowValue - parsed.createdAt < 0 || nowValue - parsed.createdAt > MAX_PKCE_AGE_MS) return null;
    return parsed.verifier;
  } catch {
    return null;
  }
}

function createPkceVerifier(cryptoImpl) {
  if (!cryptoImpl?.getRandomValues || !cryptoImpl?.subtle?.digest) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const random = new Uint8Array(56);
  cryptoImpl.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
}

async function createPkceChallenge(verifier, cryptoImpl) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(digest);
  const base64 = typeof btoa === "function"
    ? btoa(String.fromCharCode(...bytes))
    : Buffer.from(bytes).toString("base64");
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function createAuthClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  sessionStorage = globalThis.sessionStorage,
  localStorage = globalThis.window?.localStorage,
  configEndpoint = CONFIG_ENDPOINT,
  cryptoImpl = globalThis.crypto,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => Date.now()
} = {}) {
  let configPromise = null;
  let refreshPromise = null;
  const boundedTimeoutMs = Number.isFinite(timeoutMs) ? Math.min(Math.max(timeoutMs, 1), 30_000) : DEFAULT_TIMEOUT_MS;

  async function timedFetch(url, options = {}, externalSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, boundedTimeoutMs);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      try {
        return { ok: true, response, body: await response.json(), hasJson: true };
      } catch {
        if (timedOut) return failure("timeout", SAFE_MESSAGES.timeout);
        if (externalSignal?.aborted) return failure("aborted", SAFE_MESSAGES.network);
        return { ok: true, response, body: {}, hasJson: false };
      }
    } catch {
      if (timedOut) return failure("timeout", SAFE_MESSAGES.timeout);
      if (externalSignal?.aborted) return failure("aborted", SAFE_MESSAGES.network);
      return failure("network", SAFE_MESSAGES.network);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  async function loadConfig(signal) {
    if (!configPromise) configPromise = (async () => {
      if (typeof fetchImpl !== "function") return failure("unavailable", SAFE_MESSAGES.unavailable);
      const fetched = await timedFetch(configEndpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store"
      }, signal);
      if (!fetched.ok) return fetched;
      if (!fetched.response.ok) return failure("unavailable", SAFE_MESSAGES.unavailable);
      if (!fetched.hasJson) return failure("unavailable", SAFE_MESSAGES.unavailable);
      const body = fetched.body;
      const supabaseUrl = normalizeSupabaseUrl(body?.supabaseUrl);
      if (!supabaseUrl || !isPublicSupabaseKey(body?.supabaseKey)) return failure("unavailable", SAFE_MESSAGES.unavailable);
      return { ok: true, supabaseUrl, supabaseKey: body.supabaseKey };
    })();
    const config = await configPromise;
    if (!config.ok) configPromise = null;
    return config;
  }

  async function request(path, body, errorMessage, {
    accessToken,
    method = "POST",
    signal,
    includeFailureDetails = false
  } = {}) {
    const config = await loadConfig(signal);
    if (!config.ok) return config;
    const headers = { Accept: "application/json", "Content-Type": "application/json", apikey: config.supabaseKey };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const fetched = await timedFetch(`${config.supabaseUrl}/auth/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      referrerPolicy: "no-referrer"
    }, signal);
    if (!fetched.ok) return fetched;
    if (!fetched.response.ok) {
      const result = failure("auth-failed", errorMessage);
      return includeFailureDetails
        ? { ...result, status: fetched.response.status, errorBody: fetched.body }
        : result;
    }
    return { ok: true, body: fetched.body };
  }

  async function signIn({ email: rawEmail, password: rawPassword, signal } = {}) {
    const email = normalizeAuthEmail(rawEmail);
    const password = normalizePassword(rawPassword);
    if (!email || !password) return failure("invalid-input", SAFE_MESSAGES.invalidCredentials);
    const response = await request("token?grant_type=password", { email, password }, SAFE_MESSAGES.invalidCredentials, { signal });
    if (!response.ok) return response;
    if (!storeSession(sessionStorage, response.body, now())) return failure("auth-failed", SAFE_MESSAGES.invalidCredentials);
    return { ok: true, status: "authenticated", authEvent: "login_complete" };
  }

  async function signUp({ email: rawEmail, password: rawPassword, redirectTo: rawRedirectTo, signal } = {}) {
    const email = normalizeAuthEmail(rawEmail);
    const password = normalizePassword(rawPassword);
    if (!email || !password) return failure("invalid-input", SAFE_MESSAGES.invalidCredentials);
    const redirectTo = rawRedirectTo === undefined ? null : normalizeRedirectUrl(rawRedirectTo);
    if (rawRedirectTo !== undefined && !redirectTo) return failure("invalid-input", SAFE_MESSAGES.signupFailed);
    const redirectQuery = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    const response = await request(`signup${redirectQuery}`, { email, password }, SAFE_MESSAGES.signupFailed, {
      signal,
      includeFailureDetails: true
    });
    if (!response.ok) {
      if (response.code !== "auth-failed") return response;
      if (["user_already_exists", "email_exists"].includes(response.errorBody?.code)) {
        clearSessionStorage(sessionStorage);
        return { ok: true, status: "email-check", message: SAFE_MESSAGES.emailCheck };
      }
      if (response.status === 429) return failure("rate-limited", SAFE_MESSAGES.signupFailed);
      if (response.status >= 500) return failure("server", SAFE_MESSAGES.signupFailed);
      return failure("auth-failed", SAFE_MESSAGES.signupFailed);
    }
    const validSession = normalizeSessionResponse(response.body, now());
    const validPendingUser = typeof response.body?.user?.id === "string"
      && response.body.user.id.length > 0
      && response.body.user.id.length <= 256;
    clearSessionStorage(sessionStorage);
    if (!validSession && !validPendingUser) return failure("malformed-response", SAFE_MESSAGES.signupFailed);
    return { ok: true, status: "email-check", message: SAFE_MESSAGES.emailCheck };
  }

  async function requestPasswordReset({ email: rawEmail, redirectTo: rawRedirectTo, signal } = {}) {
    const email = normalizeAuthEmail(rawEmail);
    if (!email) return failure("invalid-input", SAFE_MESSAGES.invalidEmail);
    const redirectTo = rawRedirectTo === undefined ? null : normalizeRedirectUrl(rawRedirectTo);
    if (rawRedirectTo !== undefined && !redirectTo) return failure("invalid-input", SAFE_MESSAGES.resetFailed);
    clearPkceVerifier(localStorage);
    const verifier = createPkceVerifier(cryptoImpl);
    if (!verifier) return failure("unavailable", SAFE_MESSAGES.unavailable);
    let challenge;
    try { challenge = await createPkceChallenge(verifier, cryptoImpl); } catch { return failure("unavailable", SAFE_MESSAGES.unavailable); }
    try {
      const origin = new URL(redirectTo || globalThis.location?.href).origin;
      const stored = storePkceVerifier(localStorage, {
        verifier,
        flow: "recovery",
        createdAt: now(),
        origin
      });
      if (!stored) return failure("unavailable", SAFE_MESSAGES.unavailable);
    } catch {
      clearPkceVerifier(localStorage);
      return failure("unavailable", SAFE_MESSAGES.unavailable);
    }
    const redirectQuery = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    const response = await request(`recover${redirectQuery}`, {
      email,
      code_challenge: challenge,
      code_challenge_method: "s256"
    }, SAFE_MESSAGES.resetFailed, { signal });
    if (!response.ok) {
      clearPkceVerifier(localStorage);
    }
    return response.ok ? { ok: true, status: "reset-sent" } : response;
  }

  async function refreshSession({ signal } = {}) {
    if (refreshPromise) return refreshPromise;
    const session = readStoredSession(sessionStorage);
    if (!session) {
      clearAuthStorage(sessionStorage, localStorage);
      return failure("invalid-session", SAFE_MESSAGES.invalidSession);
    }

    clearSessionStorage(sessionStorage);
    refreshPromise = (async () => {
      const refreshed = await request("token?grant_type=refresh_token", {
        refresh_token: session.refreshToken
      }, SAFE_MESSAGES.invalidSession, { signal });
      if (!refreshed.ok || !storeSession(sessionStorage, refreshed.body, now(), { flow: session.flow })) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-session", SAFE_MESSAGES.invalidSession);
      }
      return {
        ok: true,
        status: session.flow === "recovery" ? "recovery-ready" : "authenticated"
      };
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function initializeSession({ url: rawUrl = globalThis.location?.href, replaceState, signal } = {}) {
    let callback;
    try {
      callback = sanitizeCallbackUrl(rawUrl);
    } catch {
      clearAuthStorage(sessionStorage, localStorage);
      return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
    }
    try {
      const storedVerifier = localStorage?.getItem?.(AUTH_PKCE_VERIFIER_STORAGE_KEY);
      if (storedVerifier && !readPkceVerifier(localStorage, now(), callback.url.origin)) {
        clearPkceVerifier(localStorage);
      }
    } catch {
      clearPkceVerifier(localStorage);
    }
    if (callback.hasQueryAuth || callback.hasHashAuth) {
      if (typeof replaceState === "function") replaceState(callback.url.href);
    }
    const hasError = callback.queryValues.error || callback.queryValues.error_code || callback.queryValues.error_description
      || callback.hashValues.error || callback.hashValues.error_code || callback.hashValues.error_description;
    if (hasError) {
      clearAuthStorage(sessionStorage, localStorage);
      return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
    }

    if (callback.queryValues.code) {
      const code = callback.queryValues.code;
      const verifier = readPkceVerifier(localStorage, now(), callback.url.origin);
      clearPkceVerifier(localStorage);
      if (!verifier || typeof code !== "string" || code.length === 0 || code.length > 2048) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
      }
      const exchanged = await request("token?grant_type=pkce", {
        auth_code: code,
        code_verifier: verifier
      }, SAFE_MESSAGES.recoveryMissing, { signal });
      if (!exchanged.ok || !storeSession(sessionStorage, exchanged.body, now(), { flow: "recovery" })) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
      }
      return { ok: true, status: "recovery-ready" };
    }

    if (callback.hasQueryAuth) {
      clearAuthStorage(sessionStorage, localStorage);
      return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
    }

    if (callback.hasHashAuth) {
      const callbackType = callback.hashValues.type;
      if (!["recovery", "signup"].includes(callbackType)) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
      }
      const flow = callbackType === "recovery" ? "recovery" : "auth";
      const body = {
        access_token: callback.hashValues.access_token,
        refresh_token: callback.hashValues.refresh_token,
        expires_in: callback.hashValues.expires_in,
        expires_at: callback.hashValues.expires_at,
        token_type: callback.hashValues.token_type
      };
      const candidate = normalizeSessionResponse(body, now(), { requireUser: false });
      if (!candidate) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
      }
      const user = await request("user", undefined, SAFE_MESSAGES.recoveryMissing, {
        accessToken: candidate.accessToken,
        method: "GET",
        signal
      });
      if (!user.ok || typeof user.body?.id !== "string" || user.body.id.length === 0) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
      }
      if (!storeSession(sessionStorage, { ...body, user: user.body }, now(), { flow })) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-recovery", SAFE_MESSAGES.recoveryMissing);
      }
      return flow === "recovery"
        ? { ok: true, status: "recovery-ready" }
        : { ok: true, status: "authenticated", authEvent: "signup_complete" };
    }

    const hadStoredValue = Boolean(sessionStorage?.getItem?.(AUTH_SESSION_STORAGE_KEY));
    const session = readStoredSession(sessionStorage);
    if (!session) {
      if (hadStoredValue) {
        clearAuthStorage(sessionStorage, localStorage);
        return failure("invalid-session", SAFE_MESSAGES.invalidSession);
      }
      return { ok: true, status: "no-session" };
    }
    if (session.expiresAt > now() && !accessTokenIsExpired(session.accessToken, now())) {
      return { ok: true, status: session.flow === "recovery" ? "recovery-ready" : "authenticated" };
    }
    return refreshSession({ signal });
  }

  async function updatePassword({ password: rawPassword, confirmation, signal } = {}) {
    const password = normalizePassword(rawPassword);
    if (!password || password !== confirmation) return failure("invalid-input", SAFE_MESSAGES.invalidNewPassword);
    const session = readStoredSession(sessionStorage);
    if (!session || session.flow !== "recovery" || session.expiresAt <= now() || accessTokenIsExpired(session.accessToken, now())) {
      clearAuthStorage(sessionStorage, localStorage);
      return failure("unavailable", SAFE_MESSAGES.recoveryMissing);
    }
    const response = await request("user", { password }, SAFE_MESSAGES.resetFailed, {
      accessToken: session.accessToken,
      method: "PUT",
      signal
    });
    if (!response.ok) return response;
    clearAuthStorage(sessionStorage, localStorage);
    return { ok: true, status: "password-updated" };
  }

  function beginSignOut() {
    const session = readStoredSession(sessionStorage);
    clearAuthStorage(sessionStorage, localStorage);
    let completed = false;
    return async ({ signal } = {}) => {
      if (completed || !session) return { ok: true, status: "signed-out" };
      completed = true;
      const response = await request("logout?scope=local", undefined, SAFE_MESSAGES.logoutWarning, {
        accessToken: session.accessToken,
        signal
      });
      return response.ok
        ? { ok: true, status: "signed-out" }
        : { ok: true, status: "signed-out", warning: SAFE_MESSAGES.logoutWarning };
    };
  }

  async function signOut({ signal } = {}) {
    return beginSignOut()({ signal });
  }

  function getAccessToken() {
    const session = readStoredSession(sessionStorage);
    if (!session || session.expiresAt <= now() || accessTokenIsExpired(session.accessToken, now())) return null;
    return session.accessToken;
  }

  return Object.freeze({
    signIn,
    signUp,
    requestPasswordReset,
    initializeSession,
    captureRecoverySession: initializeSession,
    updatePassword,
    beginSignOut,
    signOut,
    getAccessToken,
    refreshSession,
    clearSession: () => clearAuthStorage(sessionStorage, localStorage)
  });
}
