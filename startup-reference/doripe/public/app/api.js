import { CONFIG } from "./config.js";
import { getAnonymousId, getSessionId } from "./state.js";

const BOOTSTRAP_CACHE_KEY = `${CONFIG.storageKey}_bootstrap_v1`;
const BOOTSTRAP_CACHE_TTL_MS = 5 * 60 * 1000;

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);
  return data;
}

function readBootstrapCache() {
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached?.data || !cached?.savedAt) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeBootstrapCache(data) {
  try {
    window.localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify({
      data,
      savedAt: Date.now()
    }));
  } catch {}
}

async function fetchBootstrap(options = {}) {
  const data = await jsonFetch(`${CONFIG.adminApiBase}/bootstrap`, options);
  writeBootstrapCache(data);
  return { ...data, __fromCache: false };
}

export function loadBootstrap() {
  const cached = readBootstrapCache();
  if (cached?.data) {
    const isFresh = Date.now() - Number(cached.savedAt) < BOOTSTRAP_CACHE_TTL_MS;
    return Promise.resolve({ ...cached.data, __fromCache: true, __cacheFresh: isFresh });
  }

  return fetchBootstrap();
}

export function refreshBootstrapCache() {
  return fetchBootstrap({ cache: "no-cache" });
}

export function track(eventName, payload = {}) {
  return jsonFetch(`${CONFIG.adminApiBase}/events`, {
    method: "POST",
    body: JSON.stringify({
      anonymousUserId: getAnonymousId(),
      sessionId: getSessionId(),
      eventName,
      screen: payload.screen || "",
      placeId: payload.placeId || null,
      routeId: payload.routeId || null,
      shareId: payload.shareId || null,
      neighborhoodId: payload.neighborhoodId || null,
      categoryId: payload.categoryId || null,
      durationMs: payload.durationMs || null,
      metadata: payload.metadata || {},
      clientCreatedAt: new Date().toISOString()
    })
  }).catch(() => ({ ok: false }));
}

export function createShareLink(payload) {
  return jsonFetch(`${CONFIG.adminApiBase}/share-links`, {
    method: "POST",
    body: JSON.stringify({ anonymousUserId: getAnonymousId(), ...payload })
  });
}

export function loadShareLink(shareId) {
  return jsonFetch(`${CONFIG.adminApiBase}/share-links/${encodeURIComponent(shareId)}`);
}
