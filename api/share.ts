import type { VercelRequest, VercelResponse } from "@vercel/node";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function adminBaseUrl(request: VercelRequest): string {
  const configured = process.env.DORIPE_ADMIN_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = request.headers.host || "doripe.kr";
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}/admin/api/public/app`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const type = request.query.type === "route" ? "route" : "place";
  const shareId = Array.isArray(request.query.shareId) ? request.query.shareId[0] : request.query.shareId;

  if (!shareId || !/^[a-zA-Z0-9_-]{6,80}$/.test(shareId)) {
    response.status(404).send("Not found");
    return;
  }

  const lookup = await fetch(`${adminBaseUrl(request)}/share-links/${encodeURIComponent(shareId)}`);
  if (!lookup.ok) {
    response.status(404).send("Not found");
    return;
  }

  const body = await lookup.json();
  const share = body.share || {};
  const title = escapeHtml(share.title || "Doripe에서 이 장소를 확인해보세요");
  const description = escapeHtml(share.payload?.description || "저장하고 싶은 동네 장소를 Doripe에서 확인해보세요.");
  const image = escapeHtml(share.cover_image_url || "https://doripe.kr/og-image.png");
  const url = `https://doripe.kr/${type === "route" ? "r" : "p"}/${encodeURIComponent(shareId)}`;
  const appUrl = `/app?shareType=${type}&shareId=${encodeURIComponent(shareId)}`;

  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "public, max-age=60");
  response.status(200).send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta property="og:site_name" content="Doripe">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${url}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f1;color:#08111f;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif}
    .box{text-align:center;padding:32px}
    .mark{width:56px;height:56px;margin:0 auto 18px;border-radius:18px;background:#14c762;position:relative}
    .mark:after{content:"";position:absolute;inset:16px;border-radius:999px;background:#fff}
  </style>
</head>
<body>
  <main class="box">
    <div class="mark"></div>
    <strong>Doripe로 이동 중</strong>
  </main>
  <script>location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`);
}
