import { NextResponse } from "next/server";
import { loadPublicAppBootstrap } from "../../../../../src/lib/publicAppData";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadPublicAppBootstrap();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Bootstrap failed" },
      { status: 500 },
    );
  }
}
