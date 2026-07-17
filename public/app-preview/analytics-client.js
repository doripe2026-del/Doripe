export const ANALYTICS_ANONYMOUS_ID_STORAGE_KEY = "doripe.app_preview.analytics.anonymous_id.v1";

const EVENT_NAMES = new Set([
  "session_start", "signup_complete", "login_complete", "onboarding_complete", "screen_view",
  "content_impression", "content_open", "place_open", "course_open", "filter_apply", "related_place_open",
  "place_save", "place_unsave", "course_save", "course_unsave", "saved_item_open",
  "course_start", "course_start_place_set", "course_place_add", "course_place_remove", "course_place_replace", "course_complete",
  "profile_open", "follow", "unfollow", "content_like", "content_unlike", "comment_create",
  "share_sheet_open", "share_link_copy", "external_map_open", "feedback_submit", "report_submit",
  "content_upload_complete", "notification_open"
]);
const TARGET_TYPES = new Set(["place", "content", "course", "profile", "share"]);
const SHARE_CHANNELS = new Set(["copy", "system", "message", "other"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;
const SAFE_SCREEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const SAFE_ENTRY_QUERY_KEYS = new Set(["screen", "mode", "static"]);
const BATCH_LIMIT = 50;
const DEFAULT_QUEUE_LIMIT = 100;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 150;

function defaultRandomUUID() {
  return globalThis.crypto.randomUUID();
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIntegerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function safeString(value, pattern = SAFE_ID_PATTERN) {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

function sanitizeSourceScreen(value) {
  return safeString(value, SAFE_SCREEN_PATTERN) || "unknown";
}

function sanitizeEntryPath(value) {
  try {
    const url = new URL(String(value || "/"), "https://doripe.local");
    const query = new URLSearchParams();
    for (const [key, item] of url.searchParams) {
      if (SAFE_ENTRY_QUERY_KEYS.has(key) && SAFE_ID_PATTERN.test(item)) query.append(key, item);
    }
    const pathname = url.pathname.startsWith("/") ? url.pathname : "/";
    const result = `${pathname}${query.size > 0 ? `?${query}` : ""}`;
    return result.slice(0, 300);
  } catch {
    return "/";
  }
}

function sanitizeCampaignCode(value) {
  if (value == null) return null;
  return typeof value === "string" && value.length <= 40 && SAFE_ID_PATTERN.test(value) ? value : null;
}

function sanitizeProperties(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const output = {};

  if (TARGET_TYPES.has(input.targetType)) output.targetType = input.targetType;
  if (safeString(input.targetId)) output.targetId = input.targetId;
  if (safeString(input.placeId)) output.placeId = input.placeId;
  if (typeof input.contentId === "string" && UUID_PATTERN.test(input.contentId)) output.contentId = input.contentId;
  if (typeof input.courseId === "string" && UUID_PATTERN.test(input.courseId)) output.courseId = input.courseId;
  if (SHARE_CHANNELS.has(input.shareChannel)) output.shareChannel = input.shareChannel;
  if (isIntegerInRange(input.durationMs, 0, 86_400_000)) output.durationMs = input.durationMs;
  if (isIntegerInRange(input.position, 0, 10_000)) output.position = input.position;
  if (Array.isArray(input.filterIds)) {
    const filterIds = input.filterIds.slice(0, 20).filter((item) => safeString(item));
    if (filterIds.length > 0) output.filterIds = filterIds;
  }

  return output;
}

function readOrCreateAnonymousId(storage, randomUUID) {
  try {
    const existing = storage?.getItem(ANALYTICS_ANONYMOUS_ID_STORAGE_KEY);
    if (typeof existing === "string" && existing.length >= 16 && existing.length <= 96 && SAFE_ID_PATTERN.test(existing)) {
      return existing;
    }
  } catch {
    // Storage restrictions should not stop anonymous analytics for the current page.
  }

  const anonymousId = randomUUID();
  try {
    storage?.setItem(ANALYTICS_ANONYMOUS_ID_STORAGE_KEY, anonymousId);
  } catch {
    // The in-memory identifier remains usable for this page.
  }
  return anonymousId;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createAnalyticsClient({
  apiBase = "/api/v1",
  fetchImpl = globalThis.fetch?.bind(globalThis),
  accessTokenProvider = () => null,
  navigatorImpl = globalThis.navigator,
  storage = globalThis.localStorage,
  now = Date.now,
  randomUUID = defaultRandomUUID,
  sleep = defaultSleep,
  queueLimit = DEFAULT_QUEUE_LIMIT,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryBaseMs = DEFAULT_RETRY_BASE_MS
} = {}) {
  const normalizedApiBase = String(apiBase).replace(/\/$/, "");
  const boundedQueueLimit = Math.max(1, Math.min(500, Math.trunc(queueLimit) || DEFAULT_QUEUE_LIMIT));
  const boundedMaxRetries = Math.max(0, Math.min(5, Math.trunc(maxRetries) || 0));
  const boundedRetryBaseMs = Math.max(0, Math.min(10_000, Math.trunc(retryBaseMs) || 0));
  const anonymousId = readOrCreateAnonymousId(storage, randomUUID);
  const sessionId = randomUUID();
  const queue = [];
  const queuedEventIds = new Set();
  const eventAccessTokens = new Map();
  let activeScreen = null;
  let pausedScreen = null;
  let started = false;
  let ended = false;
  let sessionRequest = null;
  let startPromise = null;
  let flushPromise = null;
  let detachLifecycle = null;

  function currentAccessToken() {
    try {
      const token = accessTokenProvider?.();
      return typeof token === "string" && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  }

  function requestHeaders(headers = {}, accessTokenOverride = undefined) {
    const token = accessTokenOverride === undefined ? currentAccessToken() : accessTokenOverride;
    return {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    };
  }

  async function requestWithRetry(url, options) {
    if (typeof fetchImpl !== "function") return null;
    for (let attempt = 0; attempt <= boundedMaxRetries; attempt += 1) {
      try {
        const response = await fetchImpl(url, options);
        if (!isRetryableStatus(response.status) || attempt === boundedMaxRetries) return response;
      } catch {
        if (attempt === boundedMaxRetries) return null;
      }
      await sleep(boundedRetryBaseMs * (2 ** attempt));
    }
    return null;
  }

  function removeBatch(batch) {
    const sentIds = new Set(batch.map((event) => event.eventId));
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (sentIds.has(queue[index].eventId)) queue.splice(index, 1);
    }
    for (const eventId of sentIds) queuedEventIds.delete(eventId);
    for (const eventId of sentIds) eventAccessTokens.delete(eventId);
  }

  function recordEvent(name, {
    sourceScreen = "unknown",
    properties = {},
    eventId = null,
    occurredAt = new Date(now()).toISOString()
  } = {}) {
    if (ended || !EVENT_NAMES.has(name)) return null;
    const normalizedEventId = eventId ?? randomUUID();
    if (typeof normalizedEventId !== "string" || !UUID_PATTERN.test(normalizedEventId)) return null;
    if (queuedEventIds.has(normalizedEventId)) return normalizedEventId;

    const timestamp = new Date(occurredAt);
    if (Number.isNaN(timestamp.getTime())) return null;
    const event = {
      eventId: normalizedEventId,
      schemaVersion: 1,
      name,
      occurredAt: timestamp.toISOString(),
      sessionId,
      anonymousId,
      sourceScreen: sanitizeSourceScreen(sourceScreen),
      properties: sanitizeProperties(properties)
    };

    if (queue.length >= boundedQueueLimit) {
      const dropped = queue.shift();
      if (dropped) {
        queuedEventIds.delete(dropped.eventId);
        eventAccessTokens.delete(dropped.eventId);
      }
    }
    queue.push(event);
    queuedEventIds.add(normalizedEventId);
    eventAccessTokens.set(normalizedEventId, currentAccessToken());
    return normalizedEventId;
  }

  function enterScreen(sourceScreen, properties = {}) {
    if (ended) return null;
    if (activeScreen) leaveScreen();
    activeScreen = {
      sourceScreen: sanitizeSourceScreen(sourceScreen),
      properties: sanitizeProperties(properties),
      enteredAt: now()
    };
    return activeScreen.sourceScreen;
  }

  function leaveScreen() {
    if (!activeScreen || ended) return null;
    const screen = activeScreen;
    activeScreen = null;
    const durationMs = Math.max(0, Math.min(86_400_000, Math.round(now() - screen.enteredAt)));
    return recordEvent("screen_view", {
      sourceScreen: screen.sourceScreen,
      properties: { ...screen.properties, durationMs }
    });
  }

  async function startSession({
    entryPath = globalThis.location ? `${globalThis.location.pathname}${globalThis.location.search}` : "/app-preview",
    campaignCode = null,
    sourceScreen = "app"
  } = {}) {
    if (started) return { ok: true, sessionId, anonymousId };
    if (startPromise) return startPromise;
    if (ended) return { ok: false, sessionId, anonymousId };

    if (!sessionRequest) {
      const startedAt = new Date(now()).toISOString();
      sessionRequest = {
        body: JSON.stringify({
          sessionId,
          anonymousId,
          startedAt,
          entryPath: sanitizeEntryPath(entryPath),
          campaignCode: sanitizeCampaignCode(campaignCode)
        }),
        sourceScreen: sanitizeSourceScreen(sourceScreen),
        startedAt
      };
    }
    startPromise = (async () => {
      const response = await requestWithRetry(`${normalizedApiBase}/sessions`, {
        method: "POST",
        headers: requestHeaders({
          "Content-Type": "application/json",
          "Idempotency-Key": `session_${sessionId}`
        }),
        body: sessionRequest.body
      });
      if (!response?.ok) return { ok: false, sessionId, anonymousId };

      started = true;
      recordEvent("session_start", {
        sourceScreen: sessionRequest.sourceScreen,
        occurredAt: sessionRequest.startedAt,
        properties: {}
      });
      return { ok: true, sessionId, anonymousId };
    })();

    try {
      return await startPromise;
    } finally {
      startPromise = null;
    }
  }

  async function flushQueue({ preferBeacon = false, keepalive = false } = {}) {
    while (queue.length > 0) {
      const batchAccessToken = eventAccessTokens.get(queue[0].eventId) ?? null;
      const batch = [];
      for (const event of queue) {
        if ((eventAccessTokens.get(event.eventId) ?? null) !== batchAccessToken) break;
        batch.push(event);
        if (batch.length >= BATCH_LIMIT) break;
      }
      const body = JSON.stringify({ events: batch });

      if (preferBeacon && !batchAccessToken && typeof navigatorImpl?.sendBeacon === "function" && typeof Blob === "function") {
        try {
          if (navigatorImpl.sendBeacon(`${normalizedApiBase}/events`, new Blob([body], { type: "application/json" }))) {
            removeBatch(batch);
            continue;
          }
        } catch {
          // A blocked beacon falls through to the keepalive request.
        }
      }

      const response = await requestWithRetry(`${normalizedApiBase}/events`, {
        method: "POST",
        headers: requestHeaders({ "Content-Type": "application/json" }, batchAccessToken),
        body,
        keepalive: keepalive || preferBeacon
      });
      if (!response?.ok) return { ok: false, queued: queue.length };
      removeBatch(batch);
    }
    return { ok: true, queued: 0 };
  }

  function flush(options = {}) {
    if (flushPromise) {
      if (options.preferBeacon) {
        return flushQueue(options).catch(() => ({ ok: false, queued: queue.length }));
      }
      return flushPromise;
    }
    flushPromise = flushQueue(options).catch(() => ({ ok: false, queued: queue.length }));
    return flushPromise.finally(() => {
      flushPromise = null;
    });
  }

  async function endSession() {
    if (!ended) {
      leaveScreen();
      ended = true;
      detachLifecycle?.();
    }
    return flush({ preferBeacon: true, keepalive: true });
  }

  function attachLifecycle({
    documentImpl = globalThis.document,
    windowImpl = globalThis.window
  } = {}) {
    detachLifecycle?.();

    const onVisibilityChange = () => {
      if (documentImpl?.visibilityState === "hidden") {
        if (activeScreen) {
          pausedScreen = {
            sourceScreen: activeScreen.sourceScreen,
            properties: activeScreen.properties
          };
          leaveScreen();
        }
        void flush({ preferBeacon: true, keepalive: true });
      } else if (documentImpl?.visibilityState === "visible" && pausedScreen && !ended) {
        const screen = pausedScreen;
        pausedScreen = null;
        enterScreen(screen.sourceScreen, screen.properties);
      }
    };
    const onPageHide = () => { void endSession(); };

    documentImpl?.addEventListener?.("visibilitychange", onVisibilityChange);
    windowImpl?.addEventListener?.("pagehide", onPageHide);
    detachLifecycle = () => {
      documentImpl?.removeEventListener?.("visibilitychange", onVisibilityChange);
      windowImpl?.removeEventListener?.("pagehide", onPageHide);
      detachLifecycle = null;
    };
    return detachLifecycle;
  }

  return Object.freeze({
    anonymousId,
    sessionId,
    startSession,
    endSession,
    recordEvent,
    enterScreen,
    leaveScreen,
    flush,
    attachLifecycle
  });
}
