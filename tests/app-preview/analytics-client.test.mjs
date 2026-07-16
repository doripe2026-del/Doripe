import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_ANONYMOUS_ID_STORAGE_KEY,
  createAnalyticsClient
} from "../../public/app-preview/analytics-client.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function uuidFactory(...values) {
  return () => {
    assert.ok(values.length > 0, "test UUID list was exhausted");
    return values.shift();
  };
}

const IDS = {
  anonymous: "11111111-1111-4111-8111-111111111111",
  session: "22222222-2222-4222-8222-222222222222",
  event1: "33333333-3333-4333-8333-333333333333",
  event2: "44444444-4444-4444-8444-444444444444",
  event3: "55555555-5555-4555-8555-555555555555",
  event4: "66666666-6666-4666-8666-666666666666",
  event5: "77777777-7777-4777-8777-777777777777"
};

test("anonymous session start uses the existing session and event contracts", async () => {
  const requests = [];
  const storage = memoryStorage();
  const client = createAnalyticsClient({
    storage,
    now: () => Date.parse("2026-07-16T01:02:03.000Z"),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url) === "/api/v1/sessions") {
        return jsonResponse({ data: { sessionId: IDS.session, accepted: true }, meta: {} }, 201);
      }
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });

  const started = await client.startSession({
    entryPath: "/app-preview?screen=b1&access_token=never-send#refresh_token=also-never-send",
    sourceScreen: "b1",
    campaignCode: "closed-beta"
  });
  const startedAgain = await client.startSession({ entryPath: "/ignored" });
  const flushed = await client.flush();

  assert.equal(started.ok, true);
  assert.equal(startedAgain.ok, true);
  assert.equal(requests.filter((request) => request.url === "/api/v1/sessions").length, 1);
  assert.equal(storage.getItem(ANALYTICS_ANONYMOUS_ID_STORAGE_KEY), IDS.anonymous);

  const sessionRequest = requests[0];
  assert.equal(sessionRequest.options.method, "POST");
  assert.equal(sessionRequest.options.headers["Content-Type"], "application/json");
  assert.equal(sessionRequest.options.headers["Idempotency-Key"], `session_${IDS.session}`);
  assert.deepEqual(JSON.parse(sessionRequest.options.body), {
    sessionId: IDS.session,
    anonymousId: IDS.anonymous,
    startedAt: "2026-07-16T01:02:03.000Z",
    entryPath: "/app-preview?screen=b1",
    campaignCode: "closed-beta"
  });
  assert.doesNotMatch(sessionRequest.options.body, /never-send|refresh_token|access_token/);

  assert.equal(flushed.ok, true);
  const event = JSON.parse(requests[1].options.body).events[0];
  assert.deepEqual(event, {
    eventId: IDS.event1,
    schemaVersion: 1,
    name: "session_start",
    occurredAt: "2026-07-16T01:02:03.000Z",
    sessionId: IDS.session,
    anonymousId: IDS.anonymous,
    sourceScreen: "b1",
    properties: {}
  });
});

test("authenticated analytics requests attach the current bearer token", async () => {
  const requests = [];
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    accessTokenProvider: () => "current-access-token",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      if (String(url) === "/api/v1/sessions") {
        return jsonResponse({ data: { sessionId: IDS.session, accepted: true }, meta: {} }, 201);
      }
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });

  await client.startSession({ sourceScreen: "b1" });
  await client.flush();

  assert.equal(requests[0].options.headers.authorization, "Bearer current-access-token");
  assert.equal(requests[1].options.headers.authorization, "Bearer current-access-token");
});

test("authenticated lifecycle flush uses keepalive fetch instead of an unauthenticated beacon", async () => {
  const requests = [];
  let beaconCalls = 0;
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    accessTokenProvider: () => "current-access-token",
    navigatorImpl: { sendBeacon: () => { beaconCalls += 1; return true; } },
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });
  client.recordEvent("place_open", { sourceScreen: "place", properties: {} });

  const result = await client.endSession();

  assert.equal(result.ok, true);
  assert.equal(beaconCalls, 0);
  assert.equal(requests[0].options.keepalive, true);
  assert.equal(requests[0].options.headers.authorization, "Bearer current-access-token");
});

test("a failed session start reuses the same idempotent body on the next call", async () => {
  let now = Date.parse("2026-07-16T01:00:00.000Z");
  const bodies = [];
  const client = createAnalyticsClient({
    maxRetries: 0,
    storage: memoryStorage(),
    now: () => now,
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    fetchImpl: async (_url, options) => {
      bodies.push(options.body);
      if (bodies.length === 1) throw new TypeError("response lost");
      return jsonResponse({ data: { sessionId: IDS.session, accepted: true }, meta: {} }, 201);
    }
  });

  const failed = await client.startSession({ entryPath: "/app-preview?screen=b1", sourceScreen: "b1" });
  now += 5_000;
  const recovered = await client.startSession({ entryPath: "/different", sourceScreen: "other" });

  assert.equal(failed.ok, false);
  assert.equal(recovered.ok, true);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1], bodies[0]);
});

test("event properties use a strict allowlist and never include private form or token data", async () => {
  let eventBatch = null;
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    fetchImpl: async (_url, options) => {
      eventBatch = JSON.parse(options.body);
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });

  const eventId = client.recordEvent("comment_create", {
    sourceScreen: "comments",
    properties: {
      targetType: "content",
      targetId: "content_123",
      position: 3,
      email: "person@example.com",
      password: "never-send-this",
      accessToken: "secret-token",
      authorization: "Bearer secret",
      form: { password: "nested-secret", phone: "010-0000-0000" }
    }
  });
  const invalidEventId = client.recordEvent("password_submit", {
    sourceScreen: "signup",
    properties: { password: "still-secret" }
  });
  await client.flush();

  assert.equal(eventId, IDS.event1);
  assert.equal(invalidEventId, null);
  assert.equal(eventBatch.events.length, 1);
  assert.deepEqual(eventBatch.events[0].properties, {
    targetType: "content",
    targetId: "content_123",
    position: 3
  });
  assert.doesNotMatch(JSON.stringify(eventBatch), /person@example|never-send|secret-token|Bearer|nested-secret|010-/);
});

test("screen tracking records visible dwell time in a screen_view event", async () => {
  let now = Date.parse("2026-07-16T00:00:00.000Z");
  let eventBatch = null;
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    now: () => now,
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    fetchImpl: async (_url, options) => {
      eventBatch = JSON.parse(options.body);
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });

  client.enterScreen("discover", { position: 2, email: "drop@example.com" });
  now += 1_250;
  const eventId = client.leaveScreen();
  await client.flush();

  assert.equal(eventId, IDS.event1);
  assert.equal(eventBatch.events[0].name, "screen_view");
  assert.equal(eventBatch.events[0].sourceScreen, "discover");
  assert.deepEqual(eventBatch.events[0].properties, { position: 2, durationMs: 1_250 });
});

test("ending a session flushes once with sendBeacon", async () => {
  const beaconCalls = [];
  let fetchCalls = 0;
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    navigatorImpl: {
      sendBeacon(url, body) {
        beaconCalls.push({ url, body });
        return true;
      }
    },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("fetch should not run when beacon is accepted");
    }
  });
  client.recordEvent("place_open", { sourceScreen: "place", properties: { placeId: "place_1" } });

  const ended = await client.endSession();
  const endedAgain = await client.endSession();

  assert.equal(ended.ok, true);
  assert.equal(endedAgain.ok, true);
  assert.equal(beaconCalls.length, 1);
  assert.equal(beaconCalls[0].url, "/api/v1/events");
  assert.equal(beaconCalls[0].body.type, "application/json");
  const payload = JSON.parse(await beaconCalls[0].body.text());
  assert.equal(payload.events[0].eventId, IDS.event1);
  assert.equal(fetchCalls, 0);
});

test("a rejected beacon falls back to a keepalive request", async () => {
  const requests = [];
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    navigatorImpl: { sendBeacon: () => false },
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });
  client.recordEvent("course_open", { sourceScreen: "course", properties: {} });

  const result = await client.endSession();

  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/v1/events");
  assert.equal(requests[0].options.keepalive, true);
});

test("a termination flush uses beacon even while a regular request is still pending", async () => {
  let resolveFetch;
  const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
  const beaconCalls = [];
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    navigatorImpl: {
      sendBeacon(url, body) {
        beaconCalls.push({ url, body });
        return true;
      }
    },
    fetchImpl: async () => pendingFetch
  });
  client.recordEvent("place_open", { sourceScreen: "place", properties: {} });

  const regularFlush = client.flush();
  const terminationFlush = client.endSession();

  assert.equal(beaconCalls.length, 1);
  assert.equal((await terminationFlush).ok, true);
  resolveFetch(jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202));
  assert.equal((await regularFlush).ok, true);
});

test("a hidden tab closes visible dwell time and flushes through the lifecycle hook", async () => {
  const listeners = new Map();
  const documentImpl = {
    visibilityState: "visible",
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); }
  };
  const windowImpl = {
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); }
  };
  const beaconCalls = [];
  let now = Date.parse("2026-07-16T00:00:00.000Z");
  const client = createAnalyticsClient({
    storage: memoryStorage(),
    now: () => now,
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    navigatorImpl: {
      sendBeacon(url, body) {
        beaconCalls.push({ url, body });
        return true;
      }
    },
    fetchImpl: async () => { throw new Error("beacon should handle the hidden-tab flush"); }
  });
  const detach = client.attachLifecycle({ documentImpl, windowImpl });
  client.enterScreen("discover", {});
  now += 750;

  documentImpl.visibilityState = "hidden";
  listeners.get("visibilitychange")();

  assert.equal(beaconCalls.length, 1);
  const payload = JSON.parse(await beaconCalls[0].body.text());
  assert.equal(payload.events[0].properties.durationMs, 750);

  detach();
  assert.equal(listeners.size, 0);
});

test("event IDs deduplicate locally and the queue drops oldest entries at its limit", async () => {
  let eventBatch = null;
  const client = createAnalyticsClient({
    queueLimit: 3,
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event2, IDS.event3, IDS.event4),
    fetchImpl: async (_url, options) => {
      eventBatch = JSON.parse(options.body);
      return jsonResponse({ data: { accepted: 3, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });

  client.recordEvent("content_open", { eventId: IDS.event1, sourceScreen: "discover", properties: {} });
  client.recordEvent("content_open", { eventId: IDS.event1, sourceScreen: "discover", properties: {} });
  client.recordEvent("place_open", { sourceScreen: "place", properties: {} });
  client.recordEvent("course_open", { sourceScreen: "course", properties: {} });
  client.recordEvent("profile_open", { sourceScreen: "profile", properties: {} });
  await client.flush();

  assert.deepEqual(eventBatch.events.map((event) => event.name), [
    "place_open",
    "course_open",
    "profile_open"
  ]);
});

test("transient failures retry with bounded backoff and never escape into the UI", async () => {
  let attempts = 0;
  const waits = [];
  const client = createAnalyticsClient({
    maxRetries: 2,
    retryBaseMs: 100,
    sleep: async (ms) => { waits.push(ms); },
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event1),
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) return jsonResponse({ error: { code: "unavailable" } }, 503);
      return jsonResponse({ data: { accepted: 1, duplicates: 0, rejected: 0 }, meta: {} }, 202);
    }
  });
  client.recordEvent("place_save", { sourceScreen: "place", properties: { placeId: "place_1" } });

  const recovered = await client.flush();

  assert.equal(recovered.ok, true);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [100, 200]);

  const offline = createAnalyticsClient({
    maxRetries: 1,
    sleep: async () => {},
    storage: memoryStorage(),
    randomUUID: uuidFactory(IDS.anonymous, IDS.session, IDS.event2),
    fetchImpl: async () => { throw new TypeError("offline"); }
  });
  offline.recordEvent("place_save", { sourceScreen: "place", properties: {} });

  await assert.doesNotReject(async () => {
    const failed = await offline.flush();
    assert.deepEqual(failed, { ok: false, queued: 1 });
  });
});
