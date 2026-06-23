import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GET as campaignsGET, POST as campaignsPOST } from "../../src/admin-routes/admin/campaigns.js";
import { POST as categoriesPOST } from "../../src/admin-routes/admin/categories.js";
import { GET as creatorSubmissionsGET, PATCH as creatorSubmissionsPATCH } from "../../src/admin-routes/admin/creatorSubmissions.js";
import { POST as loginPOST } from "../../src/admin-routes/admin/login.js";
import { POST as logoutPOST } from "../../src/admin-routes/admin/logout.js";
import { POST as naverPlaceImportPOST } from "../../src/admin-routes/admin/naverPlaceImport.js";
import { GET as photoSubmissionsGET } from "../../src/admin-routes/admin/photoSubmissions.js";
import { DELETE as photosDELETE, PATCH as photosPATCH, POST as photosPOST } from "../../src/admin-routes/admin/photos.js";
import { POST as photosActivatePOST } from "../../src/admin-routes/admin/photosActivate.js";
import { DELETE as placesDELETE, GET as placesGET, PATCH as placesPATCH, POST as placesPOST } from "../../src/admin-routes/admin/places.js";
import { GET as statsGET } from "../../src/admin-routes/admin/stats.js";
import { GET as tagsGET, POST as tagsPOST } from "../../src/admin-routes/admin/tags.js";
import { runRoute } from "../../src/admin-server/vercelAdapter.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function routePath(req: VercelRequest): string {
  const value = req.query.path ?? req.query["...path"];
  const fromQuery = Array.isArray(value) ? value.join("/") : String(value ?? "");
  if (fromQuery && fromQuery !== "undefined") return fromQuery;

  const pathname = new URL(req.url ?? "/", "https://doripe.kr").pathname;
  return pathname.replace(/^\/api\/admin\/?/, "").replace(/^\/admin\/api\/admin\/?/, "");
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  switch (routePath(req)) {
    case "campaigns":
      return runRoute(req, res, { GET: campaignsGET, POST: campaignsPOST });
    case "categories":
      return runRoute(req, res, { POST: categoriesPOST });
    case "creator-submissions":
      return runRoute(req, res, { GET: creatorSubmissionsGET, PATCH: creatorSubmissionsPATCH });
    case "login":
      return runRoute(req, res, { POST: loginPOST });
    case "logout":
      return runRoute(req, res, { POST: logoutPOST });
    case "naver-place-import":
      return runRoute(req, res, { POST: naverPlaceImportPOST });
    case "photo-submissions":
      return runRoute(req, res, { GET: photoSubmissionsGET });
    case "photos":
      return runRoute(req, res, { DELETE: photosDELETE, PATCH: photosPATCH, POST: photosPOST });
    case "photos/activate":
      return runRoute(req, res, { POST: photosActivatePOST });
    case "places":
      return runRoute(req, res, { DELETE: placesDELETE, GET: placesGET, PATCH: placesPATCH, POST: placesPOST });
    case "stats":
      return runRoute(req, res, { GET: statsGET });
    case "tags":
      return runRoute(req, res, { GET: tagsGET, POST: tagsPOST });
    default:
      res.status(404).json({ message: "Admin API route not found" });
  }
}
