import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleV1Request } from "../src/backend/handler.js";
import { runRoute } from "../src/admin-server/vercelAdapter.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"] as const;
const handlers = Object.fromEntries(METHODS.map((method) => [method, handleV1Request]));

function restoreV1Path(req: VercelRequest) {
  const rawPath = Array.isArray(req.query.__path) ? req.query.__path.join("/") : req.query.__path;
  if (!rawPath) return;

  const url = new URL(req.url ?? "/api/v1", "http://localhost");
  url.searchParams.delete("__path");
  const query = url.searchParams.toString();
  req.url = `/api/v1/${rawPath}${query ? `?${query}` : ""}`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  restoreV1Path(req);
  return runRoute(req, res, handlers);
}
