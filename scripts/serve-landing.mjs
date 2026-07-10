import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PUBLIC_ROOT = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const ROUTE_ALIASES = new Map([
  ["/", "home/index.html"],
  ["/business", "home/business.html"],
  ["/company", "home/company.html"],
  ["/notify", "home/notify.html"],
  ["/privacy", "home/privacy.html"],
  ["/terms", "home/terms.html"],
  ["/blog", "blog/index.html"],
]);
const CONTENT_TYPES = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function candidatePaths(requestUrl, publicRoot) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? "/", "http://landing.local").pathname);
  } catch {
    return [];
  }
  if (pathname.includes("\0")) return [];

  const relativePath = ROUTE_ALIASES.get(pathname) ?? pathname.replace(/^\/+/, "");
  if (!relativePath || relativePath.split("/").includes("..")) return [];

  const basePath = resolve(publicRoot, relativePath);
  if (basePath !== publicRoot && !basePath.startsWith(`${publicRoot}${sep}`)) return [];
  if (extname(basePath)) return [basePath];
  return [basePath, `${basePath}.html`, resolve(basePath, "index.html")];
}

async function findPublicFile(requestUrl, publicRoot) {
  for (const candidate of candidatePaths(requestUrl, publicRoot)) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
    }
  }
  return null;
}

export function createLandingPreviewServer({ publicRoot = DEFAULT_PUBLIC_ROOT } = {}) {
  const root = resolve(publicRoot);
  return createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://landing.local").pathname;
    if (pathname === "/api/count" && (request.method === "GET" || request.method === "HEAD")) {
      const body = Buffer.from(JSON.stringify({ count: 10000 }));
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": "application/json; charset=utf-8",
      });
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    if (pathname === "/api/track" && request.method === "POST") {
      response.writeHead(204, { "Cache-Control": "no-store" });
      response.end();
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    try {
      const filePath = await findPublicFile(request.url, root);
      if (!filePath) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const body = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": CONTENT_TYPES.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      console.error(error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Preview server error");
    }
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 4173);
  const server = createLandingPreviewServer();
  server.listen(port, host, () => {
    console.log(`Doripe landing preview: http://${host}:${port}`);
  });
}
