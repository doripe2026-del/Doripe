import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const publicDirectory = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const previewIndex = resolve(publicDirectory, "app-preview/index.html");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function send(response, statusCode, message) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(message);
}

function resolvePublicFile(requestUrl) {
  const rawPathname = requestUrl.split(/[?#]/, 1)[0];
  let pathname;

  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }

  if (pathname.split("/").includes("..")) return null;
  if (pathname === "/app-preview" || pathname === "/app-preview/") return previewIndex;

  const filePath = resolve(publicDirectory, `.${pathname}`);
  const pathFromPublic = relative(publicDirectory, filePath);
  return pathFromPublic.startsWith("..") || pathFromPublic.includes("../") ? null : filePath;
}

const server = createServer(async (request, response) => {
  const filePath = resolvePublicFile(request.url || "/");
  if (!filePath) return send(response, 400, "Bad request");

  try {
    const file = await readFile(filePath);
    const contentType = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return send(response, 404, "Not found");
    return send(response, 500, "Internal server error");
  }
});

server.listen(Number(process.env.PORT) || 4173, "127.0.0.1");
