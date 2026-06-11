import { NextResponse } from "next/server";
import { createPublicShareLink, recordAppEvent } from "../../../../../src/lib/publicAppData";
import { shareLinkPayloadSchema } from "../../../../../src/lib/publicAppSchemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = shareLinkPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  try {
    const share = await createPublicShareLink(parsed.data, request.headers);
    await recordAppEvent(
      {
        anonymousUserId: parsed.data.anonymousUserId,
        eventName: "share_link_created",
        metadata: { type: parsed.data.type, shareId: share.id },
        screen: parsed.data.type === "place" ? "discover" : "route",
        shareId: share.id,
        placeId: parsed.data.type === "place" ? parsed.data.placeId : null,
      },
      request.headers,
    );

    return NextResponse.json(
      { ok: true, share },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Share link creation failed" },
      { status: 500 },
    );
  }
}
