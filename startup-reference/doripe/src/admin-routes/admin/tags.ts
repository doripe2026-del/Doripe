import { NextResponse } from "../../admin-server/response.js";
import { z } from "zod";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

const tagKinds = ["mood", "situation", "time"] as const;
const safeId = z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/i);

const tagPayloadSchema = z.object({
  display_order: z.coerce.number().int().min(0).max(10000).optional().default(0),
  id: safeId.optional(),
  kind: z.enum(tagKinds),
  name: z.string().min(1).max(80),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

type ContentTag = z.infer<typeof tagPayloadSchema> & { id: string };

function generatedTagId(kind: ContentTag["kind"]): string {
  return `tag-${kind}-${Date.now().toString(36)}`;
}

function normalizeTagPayload(value: unknown): ContentTag | null {
  const parsed = tagPayloadSchema.safeParse(value);
  if (!parsed.success || !parsed.data.id) return null;

  return {
    ...parsed.data,
    id: parsed.data.id,
  };
}

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("entity_id, payload, created_at")
    .eq("entity_type", "content_tag")
    .eq("action", "upsert_content_tag")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const latestTags = new Map<string, ContentTag>();
  for (const row of data ?? []) {
    const tag = normalizeTagPayload(row.payload);
    if (!tag) continue;
    latestTags.set(tag.id || row.entity_id, tag);
  }

  return NextResponse.json({
    tags: Array.from(latestTags.values()).sort((a, b) => {
      const byKind = tagKinds.indexOf(a.kind) - tagKinds.indexOf(b.kind);
      if (byKind !== 0) return byKind;
      const byOrder = (a.display_order ?? 0) - (b.display_order ?? 0);
      return byOrder || a.name.localeCompare(b.name, "ko");
    }),
  });
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = tagPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const tag: ContentTag = {
    ...parsed.data,
    id: parsed.data.id ?? generatedTagId(parsed.data.kind),
  };

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("admin_audit_logs").insert({
    action: "upsert_content_tag",
    entity_type: "content_tag",
    entity_id: tag.id,
    payload: tag,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tag });
}
