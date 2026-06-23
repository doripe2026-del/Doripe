import { NextResponse } from "../../admin-server/response.js";
import { clearAdminSessionResponse, isSameOriginRequest } from "../../admin-server/adminAuth.js";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: "Invalid request origin" }, { status: 403 });
  }

  return clearAdminSessionResponse();
}
