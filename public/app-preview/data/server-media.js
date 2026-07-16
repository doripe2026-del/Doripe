const SERVER_MEDIA_BASE_URL = "https://dcyjrsxnpujslbxtitqj.supabase.co/storage/v1/object/public/place-photos-public/prototype-unsplash-2026-07-15";

export const SERVER_MEDIA_COUNT = 60;
const LOCAL_MEDIA_COUNT = 6;

function normalizeIndex(index, count) {
  const value = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  return ((value % count) + count) % count;
}

export function isStaticPreview(locationLike = globalThis.location) {
  if (!locationLike) return true;
  return new URLSearchParams(locationLike.search || "").get("static") === "1";
}

export function serverMediaUrl(index) {
  const number = normalizeIndex(index, SERVER_MEDIA_COUNT) + 1;
  return `${SERVER_MEDIA_BASE_URL}/media-${String(number).padStart(3, "0")}.jpg`;
}

export function localMediaUrl(index) {
  const number = normalizeIndex(index, LOCAL_MEDIA_COUNT) + 1;
  return `/app-preview/assets/discover/feed-${number}.jpg`;
}

export function resolvePreviewMediaSource(index, locationLike = globalThis.location) {
  return isStaticPreview(locationLike) ? localMediaUrl(index) : serverMediaUrl(index);
}

export function preloadServerMedia({
  limit = 12,
  locationLike = globalThis.location,
  documentLike = globalThis.document
} = {}) {
  if (isStaticPreview(locationLike) || !documentLike?.head) return;

  const preloadCount = Math.min(Math.max(0, limit), SERVER_MEDIA_COUNT);
  for (let index = 0; index < preloadCount; index += 1) {
    const href = serverMediaUrl(index);
    if (documentLike.head.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const link = documentLike.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    link.fetchPriority = index < 4 ? "high" : "auto";
    documentLike.head.append(link);
  }
}
