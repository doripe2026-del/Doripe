import { NextResponse } from "../../admin-server/response.js";
import { z } from "zod";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

const activateSchema = z.object({
  photo_ids: z.array(z.string().uuid()).min(1).max(5),
  place_id: z.string().min(1),
});
const placeSelect = "*, place_photos!place_photos_place_id_fkey(*)";

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = activateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { place_id: placeId, photo_ids: photoIds } = parsed.data;

  const { data: selectedPhotos, error: selectedError } = await supabase
    .from("place_photos")
    .select("id, public_url")
    .eq("place_id", placeId)
    .in("id", photoIds)
    .in("photo_type", ["cover", "gallery"])
    .neq("public_url", "");

  if (selectedError) {
    return NextResponse.json({ message: selectedError.message }, { status: 500 });
  }

  if ((selectedPhotos ?? []).length !== photoIds.length) {
    return NextResponse.json({ message: "선택한 사진 중 앱 노출 가능한 사진이 없습니다." }, { status: 400 });
  }

  const selectedById = new Map((selectedPhotos ?? []).map((photo) => [photo.id, photo]));
  const orderedPhotos = photoIds.map((id) => selectedById.get(id)).filter(Boolean);
  const imageUrls = orderedPhotos.map((photo) => photo?.public_url).filter((url): url is string => Boolean(url));
  const coverPhoto = orderedPhotos[0];

  const { error: resetError } = await supabase
    .from("place_photos")
    .update({ permission_status: "pending", photo_type: "gallery" })
    .eq("place_id", placeId)
    .in("photo_type", ["cover", "gallery"]);

  if (resetError) {
    return NextResponse.json({ message: resetError.message }, { status: 500 });
  }

  for (const [index, id] of photoIds.entries()) {
    const { error: photoError } = await supabase
      .from("place_photos")
      .update({
        display_order: index,
        permission_status: "approved",
        photo_type: index === 0 ? "cover" : "gallery",
      })
      .eq("id", id)
      .eq("place_id", placeId);

    if (photoError) {
      return NextResponse.json({ message: photoError.message }, { status: 500 });
    }
  }

  const { error: placeError } = await supabase
    .from("places")
    .update({
      cover_image_url: coverPhoto?.public_url ?? imageUrls[0] ?? "",
      cover_photo_id: coverPhoto?.id ?? null,
      image_urls: imageUrls,
      photo_qa_status: "approved",
      status: "ready",
    })
    .eq("id", placeId);

  if (placeError) {
    return NextResponse.json({ message: placeError.message }, { status: 500 });
  }

  await supabase.from("admin_audit_logs").insert({
    action: "activate_place_photos",
    entity_type: "place",
    entity_id: placeId,
    payload: { photo_ids: photoIds },
  });

  const { data: place, error: loadError } = await supabase
    .from("places")
    .select(placeSelect)
    .eq("id", placeId)
    .single();

  if (loadError) {
    return NextResponse.json({ message: loadError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, activated: photoIds.length, place });
}
