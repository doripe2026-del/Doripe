import { NextResponse } from "../../admin-server/response.js";
import { z } from "zod";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

const safeId = z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/i);

const categoryPayloadSchema = z.object({
  display_order: z.coerce.number().int().min(0).max(10000).optional(),
  id: safeId,
  name: z.string().min(1).max(80),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = categoryPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("categories")
    .upsert(parsed.data, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabase.from("admin_audit_logs").insert({
    action: "upsert_category",
    entity_type: "category",
    entity_id: parsed.data.id,
    payload: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
