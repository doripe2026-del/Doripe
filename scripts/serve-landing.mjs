import { createServer } from "node:http";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
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

class PreviewRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isWithinRoot(path, root) {
  return path === root || path.startsWith(`${root}${sep}`);
}

function candidatePaths(pathname, publicRoot) {
  if (pathname.includes("\0")) return [];

  const relativePath = ROUTE_ALIASES.get(pathname) ?? pathname.replace(/^\/+/, "");
  if (!relativePath || relativePath.split("/").includes("..")) return [];

  const basePath = resolve(publicRoot, relativePath);
  if (!isWithinRoot(basePath, publicRoot)) return [];
  if (extname(basePath)) return [basePath];
  return [basePath, `${basePath}.html`, resolve(basePath, "index.html")];
}

async function findPublicFile(pathname, publicRoot, realPublicRoot) {
  for (const candidate of candidatePaths(pathname, publicRoot)) {
    try {
      const candidateInfo = await lstat(candidate);
      if (!candidateInfo.isFile() && !candidateInfo.isSymbolicLink()) continue;

      const realCandidate = await realpath(candidate);
      if (!isWithinRoot(realCandidate, realPublicRoot)) {
        throw new PreviewRequestError(403, "Forbidden");
      }
      if ((await stat(realCandidate)).isFile()) return realCandidate;
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) throw error;
    }
  }
  return null;
}

export function createLandingPreviewServer({ publicRoot = DEFAULT_PUBLIC_ROOT } = {}) {
  const root = resolve(publicRoot);
  const realRoot = realpath(root);
  return createServer(async (request, response) => {
    try {
      let parsedUrl;
      try {
        parsedUrl = new URL(request.url ?? "/", "http://landing.local");
      } catch {
        throw new PreviewRequestError(400, "Bad request");
      }
      let pathname;
      try {
        pathname = decodeURIComponent(parsedUrl.pathname);
      } catch {
        throw new PreviewRequestError(400, "Bad request");
      }

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

      const filePath = await findPublicFile(pathname, root, await realRoot);
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
      if (error instanceof PreviewRequestError) {
        const { status } = error;
        response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(status === 403 ? "Forbidden" : "Bad request");
        return;
      }
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
