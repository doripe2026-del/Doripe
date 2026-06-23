import { NextResponse } from "../../admin-server/response.js";
import {
  clearFailedLogin,
  createAdminSessionResponse,
  isLoginRateLimited,
  isSameOriginRequest,
  recordFailedLogin,
  verifyAdminPassword,
} from "../../admin-server/adminAuth.js";

const MAX_LOGIN_BODY_BYTES = 4096;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, message: "Invalid request origin" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGIN_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "Request too large" }, { status: 413 });
  }

  if (isLoginRateLimited(request)) {
    return NextResponse.json({ ok: false, message: "Too many login attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (typeof body?.password !== "string" || body.password.length > 200 || !verifyAdminPassword(body.password)) {
    recordFailedLogin(request);
    return NextResponse.json({ ok: false, message: "Invalid password" }, { status: 401 });
  }

  clearFailedLogin(request);
  return createAdminSessionResponse();
}
