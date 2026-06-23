import { Readable } from "stream";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type RouteContext = Record<string, unknown>;
type RouteHandler = (request: Request, context?: any) => Response | Promise<Response>;

function requestUrl(req: VercelRequest): string {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost");
  const proto = String(req.headers["x-forwarded-proto"] ?? "https");
  return `${proto}://${host}${req.url ?? "/"}`;
}

function requestBody(req: VercelRequest): BodyInit | undefined {
  if (req.method === "GET" || req.method === "HEAD") return undefined;

  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return new Uint8Array(req.body);
    if (typeof req.body === "string") return req.body;
    return JSON.stringify(req.body);
  }

  return Readable.toWeb(req) as ReadableStream<Uint8Array>;
}

function webRequest(req: VercelRequest): Request {
  const init: RequestInit & { duplex?: "half" } = {
    headers: req.headers as HeadersInit,
    method: req.method,
  };
  const body = requestBody(req);
  if (body) {
    init.body = body;
    init.duplex = "half";
  }
  return new Request(requestUrl(req), init);
}

export async function runRoute(
  req: VercelRequest,
  res: VercelResponse,
  handlers: Partial<Record<string, RouteHandler>>,
  context?: RouteContext,
) {
  const method = (req.method ?? "GET").toUpperCase();
  const handler = handlers[method];
  if (!handler) {
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  try {
    const response = await handler(webRequest(req), context);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.status(response.status);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      res.send(await response.text());
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Internal server error" });
  }
}
