import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const AUTH_MODULE_URL = new URL("../../public/app-preview/auth-client.js", import.meta.url);
const CONFIG_MODULE_URL = new URL("../../api/app-auth-config.ts", import.meta.url);
const SUPABASE_URL = "https://demo-project.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_doripe_test_key_1234567890";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
    entries() { return [...values.entries()]; }
  };
}

function authSession(overrides = {}) {
  return {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-1", email: "dori@doripe.kr" },
    ...overrides
  };
}

function jwtWithExpiry(expiresAtSeconds) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: expiresAtSeconds })}.signature`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

async function loadAuthModule() {
  return import(`${AUTH_MODULE_URL.href}?test=${Date.now()}-${Math.random()}`);
}

function configuredFetch(handler) {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url) === "/api/app-auth-config") {
      return jsonResponse({ supabaseUrl: SUPABASE_URL, supabaseKey: PUBLISHABLE_KEY });
    }
    return handler(url, options);
  };
  return { fetchImpl, requests };
}

test("sign-in sends a bounded normalized request and stores only session tokens", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();
  const { fetchImpl, requests } = configuredFetch(() => jsonResponse(authSession()));
  const client = createAuthClient({ fetchImpl, sessionStorage, localStorage });

  const result = await client.signIn({ email: "  DORI@DORIPE.KR  ", password: "Doripe123" });

  assert.deepEqual(result, { ok: true, status: "authenticated" });
  assert.equal(requests[1].url, `${SUPABASE_URL}/auth/v1/token?grant_type=password`);
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[1].options.headers.apikey, PUBLISHABLE_KEY);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    email: "dori@doripe.kr",
    password: "Doripe123"
  });
  const storedSession = JSON.parse(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY));
  assert.deepEqual({ ...storedSession, expiresAt: 0 }, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: 0,
    flow: "auth"
  });
  assert.equal(typeof storedSession.expiresAt, "number");
  assert.deepEqual(localStorage.entries(), []);
  assert.doesNotMatch(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), /Doripe123/);
  assert.equal(client.getAccessToken(), "access-token");
});

test("API access token is exposed only while the stored session is valid", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  const sessionStorage = createMemoryStorage();
  const client = createAuthClient({
    fetchImpl: configuredFetch(() => jsonResponse({})).fetchImpl,
    sessionStorage,
    now: () => now
  });

  assert.equal(client.getAccessToken(), null);
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "valid-access",
    refreshToken: "valid-refresh",
    expiresAt: now + 60_000,
    flow: "auth"
  }));
  assert.equal(client.getAccessToken(), "valid-access");
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "expired-access",
    refreshToken: "expired-refresh",
    expiresAt: now - 1,
    flow: "auth"
  }));
  assert.equal(client.getAccessToken(), null);
});

test("sign-up and password reset use the Supabase Auth endpoints without persisting passwords", async () => {
  const { createAuthClient } = await loadAuthModule();
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();
  const { fetchImpl, requests } = configuredFetch((url) => (
    new URL(String(url)).pathname.endsWith("/signup")
      ? jsonResponse({ user: { id: "pending-user" }, session: null })
      : jsonResponse({})
  ));
  const client = createAuthClient({ fetchImpl, sessionStorage, localStorage });

  const signupRedirectTo = "https://doripe.kr/app-preview/?screen=a14";
  const signup = await client.signUp({
    email: "new@doripe.kr",
    password: "Newpass123",
    redirectTo: signupRedirectTo
  });
  const reset = await client.requestPasswordReset({
    email: "NEW@DORIPE.KR",
    redirectTo: "https://doripe.kr/app-preview/?screen=a7"
  });

  assert.deepEqual(signup, {
    ok: true,
    status: "email-check",
    message: "이메일을 확인해 주세요"
  });
  assert.deepEqual(reset, { ok: true, status: "reset-sent" });
  assert.equal(requests[1].url, `${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(signupRedirectTo)}`);
  assert.equal(requests[2].url, `${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent("https://doripe.kr/app-preview/?screen=a7")}`);
  const resetBody = JSON.parse(requests[2].options.body);
  assert.equal(resetBody.email, "new@doripe.kr");
  assert.equal(resetBody.code_challenge_method, "s256");
  assert.match(resetBody.code_challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(sessionStorage.entries(), []);
  assert.equal(localStorage.entries().length, 1);
  assert.doesNotMatch(JSON.stringify(localStorage.entries()), /Newpass123|access.?token|refresh.?token/i);
});

test("password reset stops before the network when the cross-tab PKCE verifier cannot be persisted", async () => {
  const { createAuthClient } = await loadAuthModule();
  for (const localStorage of [
    null,
    { getItem() { return null; }, setItem() {}, removeItem() {} }
  ]) {
    let calls = 0;
    const client = createAuthClient({
      fetchImpl: async () => { calls += 1; return jsonResponse({}); },
      sessionStorage: createMemoryStorage(),
      localStorage
    });

    const result = await client.requestPasswordReset({
      email: "person@doripe.kr",
      redirectTo: "https://doripe.kr/app-preview/?screen=a7"
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "unavailable");
    assert.equal(calls, 0);
  }
});

test("implicit recovery is sanitized immediately and validates the user before storing tokens", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const sessionStorage = createMemoryStorage();
  const events = [];
  const client = createAuthClient({
    fetchImpl: async (url) => {
      events.push(`fetch:${url}`);
      if (String(url) === "/api/app-auth-config") {
        return jsonResponse({ supabaseUrl: SUPABASE_URL, supabaseKey: PUBLISHABLE_KEY });
      }
      return jsonResponse({ id: "user-1" });
    },
    sessionStorage,
    localStorage: createMemoryStorage()
  });
  let replacedUrl = null;

  const result = await client.initializeSession({
    url: "https://doripe.kr/app-preview/?screen=a7#access_token=recovery-access&refresh_token=recovery-refresh&expires_in=600&token_type=bearer&type=recovery",
    replaceState(url) { replacedUrl = url; events.push("replace"); }
  });

  assert.deepEqual(result, { ok: true, status: "recovery-ready" });
  const storedSession = JSON.parse(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY));
  assert.deepEqual({ ...storedSession, expiresAt: 0 }, {
    accessToken: "recovery-access",
    refreshToken: "recovery-refresh",
    expiresAt: 0,
    flow: "recovery"
  });
  assert.equal(typeof storedSession.expiresAt, "number");
  assert.equal(new URL(replacedUrl).hash, "");
  assert.doesNotMatch(replacedUrl, /recovery-access|recovery-refresh/);
  assert.equal(events[0], "replace");
});

test("email confirmation callback creates an authenticated signup session", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const sessionStorage = createMemoryStorage();
  const { fetchImpl } = configuredFetch(() => jsonResponse({ id: "new-user", email: "new@doripe.kr" }));
  const client = createAuthClient({ fetchImpl, sessionStorage, localStorage: createMemoryStorage() });
  let replacedUrl = null;

  const result = await client.initializeSession({
    url: "https://doripe.kr/app-preview/?screen=a14#access_token=signup-access&refresh_token=signup-refresh&expires_in=600&token_type=bearer&type=signup",
    replaceState(url) { replacedUrl = url; }
  });

  assert.deepEqual(result, { ok: true, status: "authenticated" });
  assert.deepEqual({ ...JSON.parse(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)), expiresAt: 0 }, {
    accessToken: "signup-access",
    refreshToken: "signup-refresh",
    expiresAt: 0,
    flow: "auth"
  });
  assert.equal(new URL(replacedUrl).hash, "");
});

test("startup refreshes expired sessions, rotates tokens, and clears an invalid refresh", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  const sessionStorage = createMemoryStorage();
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: jwtWithExpiry(Math.floor(now / 1000) - 10),
    refreshToken: "old-refresh-token",
    expiresAt: now + 60_000
  }));
  const { fetchImpl, requests } = configuredFetch((url) => {
    assert.match(String(url), /grant_type=refresh_token/);
    return jsonResponse(authSession({ access_token: "rotated-access", refresh_token: "rotated-refresh" }));
  });
  const client = createAuthClient({ fetchImpl, sessionStorage, now: () => now });

  const refreshed = await client.initializeSession({ url: "https://doripe.kr/app-preview/?screen=b1" });

  assert.deepEqual(refreshed, { ok: true, status: "authenticated" });
  assert.deepEqual(JSON.parse(requests[1].options.body), { refresh_token: "old-refresh-token" });
  assert.deepEqual(JSON.parse(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)), {
    accessToken: "rotated-access",
    refreshToken: "rotated-refresh",
    expiresAt: now + 3_600_000,
    flow: "auth"
  });

  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "expired-access",
    refreshToken: "invalid-refresh",
    expiresAt: now - 1
  }));
  const invalidClient = createAuthClient({
    fetchImpl: configuredFetch(() => jsonResponse({ message: "Invalid Refresh Token" }, 400)).fetchImpl,
    sessionStorage,
    now: () => now
  });
  const invalid = await invalidClient.initializeSession({ url: "https://doripe.kr/app-preview/?screen=b1" });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid-session");
  assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

test("forced session refresh is shared by concurrent unauthorized requests", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  const sessionStorage = createMemoryStorage();
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "server-rejected-access",
    refreshToken: "shared-refresh-token",
    expiresAt: now + 60_000,
    flow: "auth"
  }));
  let refreshRequests = 0;
  const { fetchImpl } = configuredFetch(async (url) => {
    assert.match(String(url), /grant_type=refresh_token/);
    refreshRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return jsonResponse(authSession({ access_token: "rotated-access", refresh_token: "rotated-refresh" }));
  });
  const client = createAuthClient({ fetchImpl, sessionStorage, now: () => now });

  const [first, second] = await Promise.all([
    client.refreshSession(),
    client.refreshSession()
  ]);

  assert.deepEqual(first, { ok: true, status: "authenticated" });
  assert.deepEqual(second, first);
  assert.equal(refreshRequests, 1);
  assert.equal(client.getAccessToken(), "rotated-access");
});

test("startup removes an expired session before its refresh request settles", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  const sessionStorage = createMemoryStorage();
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "expired-access",
    refreshToken: "invalid-refresh",
    expiresAt: now - 1
  }));
  let releaseRefresh;
  let markRefreshStarted;
  const refreshStarted = new Promise((resolve) => { markRefreshStarted = resolve; });
  const refreshResponse = new Promise((resolve) => { releaseRefresh = resolve; });
  const { fetchImpl } = configuredFetch(async () => {
    markRefreshStarted();
    return refreshResponse;
  });
  const client = createAuthClient({ fetchImpl, sessionStorage, now: () => now });

  const initializing = client.initializeSession({ url: "https://doripe.kr/app-preview/?screen=b1" });
  await refreshStarted;

  const storedWhileRefreshWasPending = sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  releaseRefresh(jsonResponse({ message: "Invalid Refresh Token" }, 400));
  assert.equal(storedWhileRefreshWasPending, null);
  const result = await initializing;
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid-session");
});

test("signup returns the same neutral email-check result for pending and existing-like responses", async () => {
  const { createAuthClient } = await loadAuthModule();
  const results = [];
  for (const response of [
    jsonResponse(authSession({ access_token: "signup-access", refresh_token: "signup-refresh" })),
    jsonResponse({ code: "user_already_exists", message: "User already registered" }, 400)
  ]) {
    const client = createAuthClient({
      fetchImpl: configuredFetch(() => response.clone()).fetchImpl,
      sessionStorage: createMemoryStorage()
    });
    results.push(await client.signUp({ email: "person@doripe.kr", password: "Doripe123" }));
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], { ok: true, status: "email-check", message: "이메일을 확인해 주세요" });
});

test("session-bearing signup is neutral and discards the returned session", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const storage = createMemoryStorage();
  const client = createAuthClient({
    fetchImpl: configuredFetch(() => jsonResponse(authSession())).fetchImpl,
    sessionStorage: storage
  });
  assert.deepEqual(await client.signUp({ email: "new@doripe.kr", password: "Doripe123" }), {
    ok: true, status: "email-check", message: "이메일을 확인해 주세요"
  });
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

test("signup neutralizes only existing-user equivalents and keeps operational failures honest", async () => {
  const { createAuthClient } = await loadAuthModule();
  for (const response of [
    jsonResponse({ code: "over_email_send_rate_limit", message: "rate limit" }, 429),
    jsonResponse({ code: "unexpected_failure", message: "down" }, 503),
    jsonResponse({ unexpected: true })
  ]) {
    const storage = createMemoryStorage();
    const client = createAuthClient({
      fetchImpl: configuredFetch(() => response.clone()).fetchImpl,
      sessionStorage: storage,
      localStorage: createMemoryStorage()
    });
    const result = await client.signUp({ email: "person@doripe.kr", password: "Doripe123" });
    assert.equal(result.ok, false);
    assert.notEqual(result.code, "email-check");
    assert.match(result.message, /처리하지 못했어요|잠시 후|다시 시도/);
    assert.deepEqual(storage.entries(), []);
  }
});

test("session responses reject missing bearer type, expiry, user, or an expired JWT", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  const invalidBodies = [
    authSession({ token_type: undefined }),
    authSession({ expires_in: 0 }),
    authSession({ user: undefined }),
    authSession({ access_token: jwtWithExpiry(Math.floor(now / 1000) - 1) })
  ];
  for (const body of invalidBodies) {
    const storage = createMemoryStorage();
    const client = createAuthClient({
      fetchImpl: configuredFetch(() => jsonResponse(body)).fetchImpl,
      sessionStorage: storage,
      now: () => now
    });
    const result = await client.signIn({ email: "dori@doripe.kr", password: "Doripe123" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "auth-failed");
    assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  }
});

test("PKCE recovery crosses tabs through one short-lived origin-bound verifier and consumes it before exchange", async () => {
  const { AUTH_PKCE_VERIFIER_STORAGE_KEY, AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const localStorage = createMemoryStorage();
  const firstTabSession = createMemoryStorage();
  const secondTabSession = createMemoryStorage();
  localStorage.setItem(AUTH_PKCE_VERIFIER_STORAGE_KEY, JSON.stringify({
    verifier: "v".repeat(56),
    flow: "recovery",
    createdAt: Date.now(),
    origin: "https://doripe.kr"
  }));
  const events = [];
  const { fetchImpl, requests } = configuredFetch((url) => {
    events.push(`fetch:${url}`);
    return jsonResponse(authSession({ access_token: "pkce-access", refresh_token: "pkce-refresh" }));
  });
  createAuthClient({ fetchImpl, sessionStorage: firstTabSession, localStorage });
  const secondTab = createAuthClient({ fetchImpl, sessionStorage: secondTabSession, localStorage });
  const result = await secondTab.initializeSession({
    url: "https://doripe.kr/app-preview/?screen=a7&code=secret-auth-code",
    replaceState(url) { events.push(`replace:${url}`); }
  });

  assert.deepEqual(result, { ok: true, status: "recovery-ready" });
  assert.match(requests[1].url, /grant_type=pkce/);
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    auth_code: "secret-auth-code",
    code_verifier: "v".repeat(56)
  });
  assert.match(events[0], /^replace:/);
  assert.doesNotMatch(events[0], /secret-auth-code/);
  assert.equal(localStorage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY), null);
  assert.equal(firstTabSession.getItem(AUTH_SESSION_STORAGE_KEY), null);
  assert.match(secondTabSession.getItem(AUTH_SESSION_STORAGE_KEY), /pkce-access/);
  assert.equal(JSON.parse(secondTabSession.getItem(AUTH_SESSION_STORAGE_KEY)).flow, "recovery");
});

test("expired or wrong-origin PKCE verifiers are deleted before any exchange", async () => {
  const { AUTH_PKCE_VERIFIER_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  for (const record of [
    { verifier: "v".repeat(56), flow: "recovery", createdAt: now - 15 * 60 * 1000 - 1, origin: "https://doripe.kr" },
    { verifier: "v".repeat(56), flow: "recovery", createdAt: now, origin: "https://attacker.example" }
  ]) {
    const localStorage = createMemoryStorage();
    localStorage.setItem(AUTH_PKCE_VERIFIER_STORAGE_KEY, JSON.stringify(record));
    let calls = 0;
    const client = createAuthClient({
      fetchImpl: async () => { calls += 1; return jsonResponse({}); },
      sessionStorage: createMemoryStorage(),
      localStorage,
      now: () => now
    });
    const result = await client.initializeSession({ url: "https://doripe.kr/app-preview/?screen=a7&code=secret-code" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid-recovery");
    assert.equal(calls, 0);
    assert.equal(localStorage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY), null);
  }
});

test("startup removes expired PKCE records and malformed callbacks scrub all auth storage", async () => {
  const { AUTH_PKCE_VERIFIER_STORAGE_KEY, AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const now = Date.now();
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  localStorage.setItem(AUTH_PKCE_VERIFIER_STORAGE_KEY, JSON.stringify({
    verifier: "v".repeat(56),
    flow: "recovery",
    createdAt: now - 15 * 60 * 1000 - 1,
    origin: "https://doripe.kr"
  }));
  const client = createAuthClient({
    fetchImpl: async () => { throw new Error("must not fetch"); },
    sessionStorage,
    localStorage,
    now: () => now
  });

  assert.deepEqual(await client.initializeSession({ url: "https://doripe.kr/app-preview/?screen=a5" }), {
    ok: true,
    status: "no-session"
  });
  assert.equal(localStorage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY), null);

  localStorage.setItem(AUTH_PKCE_VERIFIER_STORAGE_KEY, "verifier-must-clear");
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "access-must-clear",
    refreshToken: "refresh-must-clear",
    expiresAt: now + 60_000
  }));
  const malformed = await client.initializeSession({ url: "not a valid callback URL" });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, "invalid-recovery");
  assert.equal(localStorage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY), null);
  assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

test("invalid recovery callbacks are scrubbed and never store credentials", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const storage = createMemoryStorage();
  let replaced = "";
  const client = createAuthClient({ fetchImpl: async () => { throw new Error("must not fetch"); }, sessionStorage: storage });
  const result = await client.initializeSession({
    url: "https://doripe.kr/app-preview/?screen=a7&error=access_denied&error_description=secret#access_token=leak&refresh_token=leak&type=recovery",
    replaceState(url) { replaced = url; }
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid-recovery");
  assert.doesNotMatch(replaced, /error|secret|access_token|refresh_token|leak/);
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

test("production hosts can never enable static fixture auth", async () => {
  const { isLocalAuthFixtureLocation } = await loadAuthModule();
  assert.equal(isLocalAuthFixtureLocation({ hostname: "doripe.kr", search: "?static=1" }), false);
  assert.equal(isLocalAuthFixtureLocation({ hostname: "app.doripe.kr", search: "?static=1" }), false);
  assert.equal(isLocalAuthFixtureLocation({ hostname: "localhost", search: "?static=1" }), true);
  assert.equal(isLocalAuthFixtureLocation({ hostname: "127.0.0.1", search: "?screen=a3&static=1" }), true);
});

test("every auth fetch has a timeout signal and returns a bounded timeout error", async () => {
  const { createAuthClient } = await loadAuthModule();
  let authSignal = null;
  const { fetchImpl } = configuredFetch((_url, options) => {
    authSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    });
  });
  const client = createAuthClient({ fetchImpl, sessionStorage: createMemoryStorage(), timeoutMs: 5 });
  const result = await client.signIn({ email: "dori@doripe.kr", password: "Doripe123" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "timeout");
  assert.equal(authSignal.aborted, true);
});

test("recovery password update uses the session token and clears it without persisting the password", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const sessionStorage = createMemoryStorage();
  const localStorage = createMemoryStorage();
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "recovery-access",
    refreshToken: "recovery-refresh",
    expiresAt: Date.now() + 60_000,
    flow: "recovery"
  }));
  const { fetchImpl, requests } = configuredFetch(() => jsonResponse({ user: { id: "user-1" } }));
  const client = createAuthClient({ fetchImpl, sessionStorage, localStorage });

  const result = await client.updatePassword({ password: "Updated123", confirmation: "Updated123" });

  assert.deepEqual(result, { ok: true, status: "password-updated" });
  assert.equal(requests[1].url, `${SUPABASE_URL}/auth/v1/user`);
  assert.equal(requests[1].options.method, "PUT");
  assert.equal(requests[1].options.headers.Authorization, "Bearer recovery-access");
  assert.deepEqual(JSON.parse(requests[1].options.body), { password: "Updated123" });
  assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  assert.deepEqual(localStorage.entries(), []);
});

test("missing or invalid public configuration returns unavailable without contacting Supabase", async () => {
  const { createAuthClient } = await loadAuthModule();
  for (const configResponse of [
    jsonResponse({ available: false }, 503),
    jsonResponse({ supabaseUrl: "https://attacker.example", supabaseKey: "sb_secret_do_not_expose" })
  ]) {
    let calls = 0;
    const client = createAuthClient({
      fetchImpl: async () => { calls += 1; return configResponse.clone(); },
      sessionStorage: createMemoryStorage(),
      localStorage: createMemoryStorage()
    });

    const result = await client.signIn({ email: "dori@doripe.kr", password: "Doripe123" });

    assert.equal(result.ok, false);
    assert.equal(result.code, "unavailable");
    assert.match(result.message, /계정 기능을 사용할 수 없어요/);
    assert.equal(calls, 1);
  }
});

test("invalid bounded inputs fail before config or auth requests", async () => {
  const { createAuthClient } = await loadAuthModule();
  let calls = 0;
  const client = createAuthClient({
    fetchImpl: async () => { calls += 1; return jsonResponse({}); },
    sessionStorage: createMemoryStorage(),
    localStorage: createMemoryStorage()
  });

  for (const credentials of [
    { email: "not-an-email", password: "Doripe123" },
    { email: `${"a".repeat(245)}@doripe.kr`, password: "Doripe123" },
    { email: "dori@doripe.kr", password: "short" },
    { email: "dori@doripe.kr", password: "x".repeat(129) }
  ]) {
    const result = await client.signIn(credentials);
    assert.equal(result.ok, false);
    assert.equal(result.code, "invalid-input");
  }
  assert.equal(calls, 0);
});

test("auth errors are safe Korean messages and do not reveal account existence", async () => {
  const { createAuthClient } = await loadAuthModule();
  const serverMessages = ["User not found", "Email not confirmed", "User already registered"];

  for (const serverMessage of serverMessages) {
    const { fetchImpl } = configuredFetch(() => jsonResponse({ message: serverMessage }, 400));
    const client = createAuthClient({
      fetchImpl,
      sessionStorage: createMemoryStorage(),
      localStorage: createMemoryStorage()
    });
    const result = await client.signIn({ email: "person@doripe.kr", password: "Doripe123" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "auth-failed");
    assert.equal(result.message, "이메일 또는 비밀번호를 확인해 주세요");
    assert.doesNotMatch(JSON.stringify(result), /not found|confirmed|registered/i);
  }
});

test("network failures keep storage empty and return a retryable message", async () => {
  const { createAuthClient } = await loadAuthModule();
  const storage = createMemoryStorage();
  const client = createAuthClient({
    fetchImpl: async () => { throw new TypeError("network down"); },
    sessionStorage: storage,
    localStorage: createMemoryStorage()
  });

  const result = await client.signIn({ email: "dori@doripe.kr", password: "Doripe123" });

  assert.equal(result.ok, false);
  assert.equal(result.code, "network");
  assert.match(result.message, /네트워크 연결/);
  assert.deepEqual(storage.entries(), []);
});

test("sign-out uses the stored access token and always clears the strict session key", async () => {
  const { AUTH_SESSION_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const sessionStorage = createMemoryStorage();
  sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 60_000
  }));
  sessionStorage.setItem("unrelated", "keep-me");
  const { fetchImpl, requests } = configuredFetch(() => jsonResponse({}));
  const client = createAuthClient({ fetchImpl, sessionStorage, localStorage: createMemoryStorage() });

  const result = await client.signOut();

  assert.deepEqual(result, { ok: true, status: "signed-out" });
  assert.equal(requests[1].url, `${SUPABASE_URL}/auth/v1/logout?scope=local`);
  assert.equal(requests[1].options.headers.Authorization, "Bearer access-token");
  assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  assert.equal(sessionStorage.getItem("unrelated"), "keep-me");
});

test("sign-out succeeds locally even when remote logout fails", async () => {
  const { AUTH_SESSION_STORAGE_KEY, AUTH_PKCE_VERIFIER_STORAGE_KEY, createAuthClient } = await loadAuthModule();
  const storage = createMemoryStorage();
  const localStorage = createMemoryStorage();
  storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresAt: Date.now() + 60_000
  }));
  localStorage.setItem(AUTH_PKCE_VERIFIER_STORAGE_KEY, "secret-verifier");
  const { fetchImpl } = configuredFetch(() => {
    throw new TypeError("network down");
  });
  const client = createAuthClient({
    fetchImpl,
    sessionStorage: storage,
    localStorage
  });
  const completeRemoteSignOut = client.beginSignOut();
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY), null);

  const result = await completeRemoteSignOut();
  assert.equal(result.ok, true);
  assert.equal(result.status, "signed-out");
  assert.match(result.warning, /로그아웃/);
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(AUTH_PKCE_VERIFIER_STORAGE_KEY), null);
});

async function loadConfigHandler() {
  const source = await readFile(CONFIG_MODULE_URL, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);
}

function createResponse() {
  return {
    headers: new Map(),
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("config endpoint returns only a validated URL and public key", async () => {
  const { default: handler } = await loadConfigHandler();
  const previous = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-must-never-appear";
  const response = createResponse();

  try {
    await handler({ method: "GET" }, response);
  } finally {
    process.env = previous;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { supabaseUrl: SUPABASE_URL, supabaseKey: PUBLISHABLE_KEY });
  assert.equal(JSON.stringify(response.body).includes("service-role"), false);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("config endpoint accepts the server-only Supabase URL variable", async () => {
  const { default: handler } = await loadConfigHandler();
  const previous = { ...process.env };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
  const response = createResponse();

  try {
    await handler({ method: "GET" }, response);
  } finally {
    process.env = previous;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { supabaseUrl: SUPABASE_URL, supabaseKey: PUBLISHABLE_KEY });
});

test("config endpoint rejects secret/service keys and malformed URLs", async () => {
  const { default: handler } = await loadConfigHandler();
  const cases = [
    { url: "https://attacker.example", key: PUBLISHABLE_KEY },
    { url: SUPABASE_URL, key: "sb_secret_private" },
    { url: SUPABASE_URL, key: "service-role-must-never-appear" }
  ];

  for (const entry of cases) {
    const previous = { ...process.env };
    process.env.NEXT_PUBLIC_SUPABASE_URL = entry.url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = entry.key;
    const response = createResponse();
    try {
      await handler({ method: "GET" }, response);
    } finally {
      process.env = previous;
    }
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { available: false });
  }
});
