import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../../../src/lib/supabaseAdmin";

export const runtime = "nodejs";

type ShareLinkRouteContext = {
  params: Promise<{ shareId: string }>;
};

export async function GET(_request: Request, context: ShareLinkRouteContext) {
  const { shareId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{6,80}$/.test(shareId)) {
    return NextResponse.json({ message: "Share link not found" }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shared_links")
    .select("*")
    .eq("id", shareId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ message: "Share link not found" }, { status: 404 });

  await supabase
    .from("shared_links")
    .update({ open_count: Number(data.open_count ?? 0) + 1 })
    .eq("id", shareId);

  return NextResponse.json(
    { share: data },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
