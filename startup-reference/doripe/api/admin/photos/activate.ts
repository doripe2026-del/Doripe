import type { VercelRequest, VercelResponse } from "@vercel/node";
import { POST } from "../../../src/admin-routes/admin/photosActivate.js";
import { runRoute } from "../../../src/admin-server/vercelAdapter.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  return runRoute(req, res, { POST });
}
