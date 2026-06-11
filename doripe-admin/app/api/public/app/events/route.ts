import { NextResponse } from "next/server";
import { recordAppEvent } from "../../../../../src/lib/publicAppData";
import { appEventPayloadSchema } from "../../../../../src/lib/publicAppSchemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = appEventPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  try {
    await recordAppEvent(parsed.data, request.headers);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Event ingest failed" },
      { status: 500 },
    );
  }
}
