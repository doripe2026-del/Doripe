import { NextResponse } from "../../admin-server/response.js";
import { z } from "zod";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

const statuses = ["submitted", "reviewing", "approved", "published", "rejected"] as const;

const updateSchema = z.object({
  admin_note: z.string().max(1000).optional(),
  id: z.string().uuid(),
  selected_photo_ids: z.array(z.string().uuid()).optional(),
  status: z.enum(statuses).optional(),
});

type CreatorSubmissionPhotoRow = {
  bucket_id: string;
  storage_path: string;
};

function normalizeSearchQuery(value: string | null): string {
  return (value ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[,%(){}]/g, " ")
    .replace(/\s+/g, " ");
}

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const q = normalizeSearchQuery(url.searchParams.get("q"));
  const status = url.searchParams.get("status")?.trim() ?? "";

  if (status && status !== "all" && !statuses.includes(status as (typeof statuses)[number])) {
    return NextResponse.json({ message: "Invalid status filter" }, { status: 400 });
  }

  let query = supabase
    .from("creator_place_submissions")
    .select("*, creator_profiles!creator_place_submissions_creator_id_fkey(id, display_name, email, instagram_url), creator_submission_photos(*), creator_card_metrics(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    const pattern = `%${escapeIlike(q)}%`;
    query = query.or(`place_name.ilike.${pattern},place_road_address.ilike.${pattern},place_category.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const submissions = await Promise.all(
    (data ?? []).map(async (submission) => {
      const photos = await Promise.all(
        ((submission.creator_submission_photos ?? []) as CreatorSubmissionPhotoRow[]).map(async (photo) => {
          const signed = await supabase.storage
            .from(photo.bucket_id)
            .createSignedUrl(photo.storage_path, 60 * 60);

          return {
            ...photo,
            signed_url: signed.data?.signedUrl ?? "",
          };
        }),
      );

      return {
        ...submission,
        creator_submission_photos: photos,
      };
    }),
  );

  return NextResponse.json({ submissions });
}

export async function PATCH(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status) payload.status = parsed.data.status;
  if (parsed.data.status === "published") payload.published_at = new Date().toISOString();
  if (parsed.data.admin_note !== undefined) payload.admin_note = parsed.data.admin_note;

  const { error } = await supabase
    .from("creator_place_submissions")
    .update(payload)
    .eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  if (parsed.data.selected_photo_ids) {
    const selectedIds = parsed.data.selected_photo_ids;
    const { error: resetError } = await supabase
      .from("creator_submission_photos")
      .update({ review_status: "pending", selected_for_card: false })
      .eq("submission_id", parsed.data.id);

    if (resetError) {
      return NextResponse.json({ message: resetError.message }, { status: 500 });
    }

    if (selectedIds.length) {
      const { error: selectError } = await supabase
        .from("creator_submission_photos")
        .update({ review_status: "selected", selected_for_card: true })
        .eq("submission_id", parsed.data.id)
        .in("id", selectedIds);

      if (selectError) {
        return NextResponse.json({ message: selectError.message }, { status: 500 });
      }
    }
  }

  await supabase.from("admin_audit_logs").insert({
    action: "update_creator_submission",
    entity_type: "creator_place_submission",
    entity_id: parsed.data.id,
    payload: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
