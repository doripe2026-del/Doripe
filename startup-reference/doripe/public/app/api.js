import { CONFIG } from "./config.js";
import { getAnonymousId, getSessionId } from "./state.js";

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);
  return data;
}

export function loadBootstrap() {
  return jsonFetch(`${CONFIG.adminApiBase}/bootstrap`);
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
