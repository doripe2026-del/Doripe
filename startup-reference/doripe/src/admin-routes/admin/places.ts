import { NextResponse } from "../../admin-server/response.js";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { placePayloadSchema } from "../../admin-server/placeSchema.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

const placeStatuses = new Set(["draft", "ready", "inactive", "all"]);
const optionalDetailColumns = [
  "phone_text",
  "representative_menu_name",
  "representative_menu_price",
  "instagram_url",
] as const;
const placeSelect = "*, place_photos!place_photos_place_id_fkey(*)";

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

function isMissingDetailColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return optionalDetailColumns.some((column) => message.includes(`'${column}'`) || message.includes(`.${column}`) || message.includes(` ${column} `))
    || /Could not find .* column|column .* does not exist|schema cache/i.test(message);
}

function withoutOptionalDetailColumns<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  for (const column of optionalDetailColumns) {
    delete next[column];
  }
  return next;
}

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  const url = new URL(request.url);
  const q = normalizeSearchQuery(url.searchParams.get("q"));
  const status = url.searchParams.get("status")?.trim() ?? "";

  if (status && !placeStatuses.has(status)) {
    return NextResponse.json({ message: "Invalid status filter" }, { status: 400 });
  }

  let placesQuery = supabase
    .from("places")
    .select(placeSelect)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (q) {
    const pattern = `%${escapeIlike(q)}%`;
    placesQuery = placesQuery.or(`name.ilike.${pattern},address.ilike.${pattern},sub_area.ilike.${pattern}`);
  }

  if (status && status !== "all") {
    placesQuery = placesQuery.eq("status", status);
  }

  const [places, regions, neighborhoods, categories] = await Promise.all([
    placesQuery,
    supabase.from("regions").select("*").eq("status", "active").order("display_order"),
    supabase.from("neighborhoods").select("*").eq("status", "active").order("display_order"),
    supabase.from("categories").select("*").eq("status", "active").order("display_order"),
  ]);

  const error = places.error ?? regions.error ?? neighborhoods.error ?? categories.error;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    categories: categories.data ?? [],
    neighborhoods: neighborhoods.data ?? [],
    places: places.data ?? [],
    regions: regions.data ?? [],
  });
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = placePayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("places").upsert(parsed.data);
  if (error) {
    if (!isMissingDetailColumnError(error)) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const legacyPayload = withoutOptionalDetailColumns(parsed.data);
    const retry = await supabase.from("places").upsert(legacyPayload);
    if (retry.error) {
      return NextResponse.json({ message: retry.error.message }, { status: 500 });
    }

    await supabase.from("admin_audit_logs").insert({
      action: "upsert_place",
      entity_type: "place",
      entity_id: parsed.data.id,
      payload: {
        ...legacyPayload,
        migration_warning: "place detail columns are not applied yet",
      },
    });

    const { data: place } = await supabase
      .from("places")
      .select(placeSelect)
      .eq("id", parsed.data.id)
      .single();

    return NextResponse.json({
      migrationRequired: true,
      message: "DB 마이그레이션 전이라 연락처, 대표메뉴, 인스타그램은 아직 저장되지 않았습니다.",
      ok: true,
      place,
    });
  }

  await supabase.from("admin_audit_logs").insert({
    action: "upsert_place",
    entity_type: "place",
    entity_id: parsed.data.id,
    payload: parsed.data,
  });

  const { data: place, error: loadError } = await supabase
    .from("places")
    .select(placeSelect)
    .eq("id", parsed.data.id)
    .single();

  if (loadError) {
    return NextResponse.json({ message: loadError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, place });
}

export async function PATCH(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";

  if (!id) {
    return NextResponse.json({ message: "No place id provided" }, { status: 400 });
  }

  if (status !== "draft" && status !== "ready" && status !== "inactive") {
    return NextResponse.json({ message: "Invalid place status" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: place, error } = await supabase
    .from("places")
    .update({ status })
    .eq("id", id)
    .select(placeSelect)
    .single();
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabase.from("admin_audit_logs").insert({
    action: "update_place_status",
    entity_type: "place",
    entity_id: id,
    payload: { status },
  });

  return NextResponse.json({ ok: true, place });
}

export async function DELETE(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)
    : [];

  if (!ids.length) {
    return NextResponse.json({ message: "No place ids provided" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: photos, error: photoError } = await supabase
    .from("place_photos")
    .select("bucket_id, storage_path")
    .in("place_id", ids);

  if (photoError) {
    return NextResponse.json({ message: photoError.message }, { status: 500 });
  }

  const { error } = await supabase.from("places").delete().in("id", ids);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const storagePathsByBucket = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    if (!photo.bucket_id || !photo.storage_path) continue;
    const paths = storagePathsByBucket.get(photo.bucket_id) ?? [];
    paths.push(photo.storage_path);
    storagePathsByBucket.set(photo.bucket_id, paths);
  }

  const storageErrors: string[] = [];
  for (const [bucket, paths] of storagePathsByBucket.entries()) {
    const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
    if (storageError) storageErrors.push(`${bucket}: ${storageError.message}`);
  }

  await supabase.from("admin_audit_logs").insert({
    action: "delete_places",
    entity_type: "place",
    entity_id: ids[0],
    payload: { ids, storageErrors },
  });

  return NextResponse.json({ deleted: ids.length, ok: true, storageErrors });
}
