import { databaseList } from "./database.js";
import { createBackendAdminClient } from "./supabase.js";

type AvatarProfile = {
  avatar_media_id: string | null;
  user_id: string;
};

type AvatarMedia = {
  id: string;
  owner_user_id: string;
  rights_status: string;
  status: string;
  storage_bucket: string;
  storage_path: string;
};

export async function publicAvatarUrls(profiles: AvatarProfile[]): Promise<Map<string, string>> {
  const mediaIds = [...new Set(profiles.flatMap((profile) => profile.avatar_media_id ? [profile.avatar_media_id] : []))];
  if (!mediaIds.length) return new Map();

  const admin = createBackendAdminClient();
  const media = databaseList<AvatarMedia>(await admin.from("media_assets")
    .select("id,owner_user_id,storage_bucket,storage_path,status,rights_status")
    .in("id", mediaIds).eq("status", "approved").eq("rights_status", "approved"));
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));
  const urlByMediaId = new Map<string, string>();
  const byBucket = new Map<string, AvatarMedia[]>();
  for (const asset of media) {
    byBucket.set(asset.storage_bucket, [...(byBucket.get(asset.storage_bucket) ?? []), asset]);
  }

  await Promise.all(Array.from(byBucket, async ([bucket, assets]) => {
    const signed = await admin.storage.from(bucket).createSignedUrls(assets.map((asset) => asset.storage_path), 300);
    if (signed.error || !signed.data) return;
    assets.forEach((asset, index) => {
      const url = signed.data[index]?.signedUrl;
      if (url) urlByMediaId.set(asset.id, url);
    });
  }));

  return new Map(profiles.flatMap((profile) => {
    const asset = profile.avatar_media_id ? mediaById.get(profile.avatar_media_id) : undefined;
    const url = asset?.owner_user_id === profile.user_id ? urlByMediaId.get(asset.id) : undefined;
    return url ? [[profile.user_id, url]] : [];
  }));
}
