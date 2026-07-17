import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleV1Request } from "../../src/backend/handler.js";
import { runRoute } from "../../src/admin-server/vercelAdapter.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"] as const;
const handlers = Object.fromEntries(METHODS.map((method) => [method, handleV1Request]));

export default function handler(req: VercelRequest, res: VercelResponse) {
  return runRoute(req, res, handlers);
}
