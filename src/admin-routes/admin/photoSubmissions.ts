import { NextResponse } from "../../admin-server/response.js";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

const statuses = ["submitted", "reviewing", "approved", "published", "rejected"] as const;

type PhotoSubmissionFileRow = {
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
    .from("photo_submissions")
    .select("*, photo_submission_files(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (q) {
    const pattern = `%${escapeIlike(q)}%`;
    query = query.or(`place_name.ilike.${pattern},submitter_name.ilike.${pattern},submitter_contact.ilike.${pattern},submitter_instagram_url.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const submissions = await Promise.all(
    (data ?? []).map(async (submission) => {
      const files = await Promise.all(
        ((submission.photo_submission_files ?? []) as PhotoSubmissionFileRow[]).map(async (file) => {
          const signed = await supabase.storage
            .from(file.bucket_id)
            .createSignedUrl(file.storage_path, 60 * 60);

          return {
            ...file,
            signed_url: signed.data?.signedUrl ?? "",
          };
        }),
      );

      return {
        ...submission,
        photo_submission_files: files,
      };
    }),
  );

  return NextResponse.json({ submissions });
}
