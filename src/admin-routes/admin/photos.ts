import { randomUUID } from "crypto";
import { NextResponse } from "../../admin-server/response.js";
import { z } from "zod";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { photoPayloadSchema } from "../../admin-server/placeSchema.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

export const runtime = "nodejs";

const publicImageMaxBytes = 10 * 1024 * 1024;
const privateFileMaxBytes = 50 * 1024 * 1024;
const publicImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const privateFileTypes = new Set([...publicImageTypes, "application/pdf"]);
const deleteSchema = z.object({
  id: z.string().uuid(),
});
const updatePhotoSchema = z.object({
  credit_text: z.string().max(200).optional(),
  crop_x: z.coerce.number().min(0).max(100).optional(),
  crop_y: z.coerce.number().min(0).max(100).optional(),
  crop_zoom: z.coerce.number().min(1).max(3).optional(),
  id: z.string().uuid(),
  rights_holder_name: z.string().max(120).optional(),
  source_type: z.enum(["team", "owner", "creator", "licensed", "naver"]).optional(),
});
const placeSelect = "*, place_photos!place_photos_place_id_fkey(*)";

function cleanFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

function hasValidSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }

  if (mimeType === "application/pdf") {
    return bytes.length > 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  return false;
}

async function syncApprovedPlacePhotos(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  placeId: string,
) {
  const { data: appPhotos, error } = await supabase
    .from("place_photos")
    .select("id, public_url")
    .eq("place_id", placeId)
    .in("photo_type", ["cover", "gallery"])
    .eq("permission_status", "approved")
    .neq("public_url", "")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(5);

  if (error) return error;

  const approvedPhotos = appPhotos ?? [];
  const coverPhoto = approvedPhotos[0];
  const imageUrls = approvedPhotos.map((item) => item.public_url).filter(Boolean);
  const { error: placeError } = await supabase
    .from("places")
    .update({
      cover_photo_id: coverPhoto?.id ?? null,
      cover_image_url: coverPhoto?.public_url ?? "",
      image_urls: imageUrls,
      photo_qa_status: approvedPhotos.length ? "approved" : "pending",
    })
    .eq("id", placeId);

  return placeError;
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing image file" }, { status: 400 });
  }

  const parsed = photoPayloadSchema.safeParse({
    place_id: formData.get("place_id"),
    photo_type: formData.get("photo_type"),
    source_type: formData.get("source_type"),
    rights_holder_name: formData.get("rights_holder_name"),
    credit_text: formData.get("credit_text"),
    permission_status: formData.get("permission_status"),
    usage_scope: formData.get("usage_scope"),
    license_note: formData.get("license_note"),
  });

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const bucket = parsed.data.photo_type === "original" || parsed.data.photo_type === "rights"
    ? "place-photo-originals"
    : "place-photos-public";
  const displayOrder = Number(formData.get("display_order") ?? 0);
  const normalizedDisplayOrder = Number.isInteger(displayOrder) ? displayOrder : 0;
  const isDefaultPublishedSlot = bucket === "place-photos-public" && normalizedDisplayOrder >= 0 && normalizedDisplayOrder <= 4;
  const normalizedPhotoType = bucket === "place-photos-public" && isDefaultPublishedSlot
    ? normalizedDisplayOrder === 0 ? "cover" : "gallery"
    : parsed.data.photo_type;
  const normalizedPermissionStatus = isDefaultPublishedSlot ? "approved" : parsed.data.permission_status;
  const maxBytes = bucket === "place-photos-public" ? publicImageMaxBytes : privateFileMaxBytes;
  const allowedTypes = bucket === "place-photos-public" ? publicImageTypes : privateFileTypes;

  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json({ message: "Invalid file size" }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ message: "Invalid file type" }, { status: 400 });
  }

  if (bucket === "place-photos-public" && (normalizedDisplayOrder < 0 || normalizedDisplayOrder > 10000)) {
    return NextResponse.json({ message: "Invalid photo slot" }, { status: 400 });
  }

  const existingSlot =
    bucket === "place-photos-public"
      ? await supabase
          .from("place_photos")
          .select("id, bucket_id, storage_path")
          .eq("place_id", parsed.data.place_id)
          .in("photo_type", ["cover", "gallery"])
          .eq("display_order", normalizedDisplayOrder)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

  if (existingSlot.error) {
    return NextResponse.json({ message: existingSlot.error.message }, { status: 500 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidSignature(bytes, file.type)) {
    return NextResponse.json({ message: "File content does not match its type" }, { status: 400 });
  }

  const storagePath = `${parsed.data.place_id}/${randomUUID()}-${cleanFileName(file.name)}`;

  const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    cacheControl: bucket === "place-photos-public" ? "31536000" : "3600",
    contentType: file.type,
    upsert: false,
  });

  if (upload.error) {
    return NextResponse.json({ message: upload.error.message }, { status: 500 });
  }

  const publicUrl =
    bucket === "place-photos-public"
      ? supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
      : "";

  const { data: photo, error: photoError } = await supabase
    .from("place_photos")
    .insert({
      ...parsed.data,
      bucket_id: bucket,
      display_order: normalizedDisplayOrder,
      permission_status: normalizedPermissionStatus,
      photo_type: normalizedPhotoType,
      storage_path: storagePath,
      public_url: publicUrl,
    })
    .select("*")
    .single();

  if (photoError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return NextResponse.json({ message: photoError.message }, { status: 500 });
  }

  if (existingSlot.data) {
    await supabase.from("place_photos").delete().eq("id", existingSlot.data.id);
    if (existingSlot.data.storage_path) {
      await supabase.storage.from(existingSlot.data.bucket_id).remove([existingSlot.data.storage_path]);
    }
  }

  if (publicUrl) {
    const syncError = await syncApprovedPlacePhotos(supabase, parsed.data.place_id);
    if (syncError) {
      return NextResponse.json({ message: syncError.message }, { status: 500 });
    }
  }

  await supabase.from("admin_audit_logs").insert({
    action: "upload_place_photo",
    entity_type: "place_photo",
    entity_id: photo.id,
    payload: { bucket, storagePath, ...parsed.data },
  });

  return NextResponse.json({ ok: true, photo });
}

export async function DELETE(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: photo, error: photoError } = await supabase
    .from("place_photos")
    .select("id, place_id, bucket_id, storage_path, public_url, photo_type")
    .eq("id", parsed.data.id)
    .single();

  if (photoError) {
    return NextResponse.json({ message: photoError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("place_photos").delete().eq("id", parsed.data.id);
  if (deleteError) {
    return NextResponse.json({ message: deleteError.message }, { status: 500 });
  }

  if (photo.storage_path) {
    const { error: storageError } = await supabase.storage.from(photo.bucket_id).remove([photo.storage_path]);
    if (storageError) {
      return NextResponse.json({ message: storageError.message }, { status: 500 });
    }
  }

  if (photo.public_url && (photo.photo_type === "cover" || photo.photo_type === "gallery")) {
    const syncError = await syncApprovedPlacePhotos(supabase, photo.place_id);
    if (syncError) {
      return NextResponse.json({ message: syncError.message }, { status: 500 });
    }
  }

  await supabase.from("admin_audit_logs").insert({
    action: "delete_place_photo",
    entity_type: "place_photo",
    entity_id: parsed.data.id,
    payload: photo,
  });

  const { data: place, error: loadError } = await supabase
    .from("places")
    .select(placeSelect)
    .eq("id", photo.place_id)
    .single();

  if (loadError) {
    return NextResponse.json({ message: loadError.message }, { status: 500 });
  }

  return NextResponse.json({ deletedId: parsed.data.id, ok: true, place });
}

export async function PATCH(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  const parsed = updatePhotoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.message }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.credit_text !== undefined) updatePayload.credit_text = parsed.data.credit_text;
  if (parsed.data.rights_holder_name !== undefined) updatePayload.rights_holder_name = parsed.data.rights_holder_name;
  if (parsed.data.source_type !== undefined) updatePayload.source_type = parsed.data.source_type;
  if (parsed.data.crop_x !== undefined) updatePayload.crop_x = parsed.data.crop_x;
  if (parsed.data.crop_y !== undefined) updatePayload.crop_y = parsed.data.crop_y;
  if (parsed.data.crop_zoom !== undefined) updatePayload.crop_zoom = parsed.data.crop_zoom;

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json({ message: "수정할 사진 정보가 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: photo, error } = await supabase
    .from("place_photos")
    .update(updatePayload)
    .eq("id", parsed.data.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  await supabase.from("admin_audit_logs").insert({
    action: "update_place_photo",
    entity_type: "place_photo",
    entity_id: parsed.data.id,
    payload: updatePayload,
  });

  return NextResponse.json({ ok: true, photo });
}
