import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { NextResponse } from "../../admin-server/response.js";
import { requireAdminRequest } from "../../admin-server/adminAuth.js";
import { createSupabaseAdminClient } from "../../admin-server/supabaseAdmin.js";

export const runtime = "nodejs";

const maxPhotoBytes = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const scrapPhotoSchema = z.object({
  dataUrl: z.string().max(16 * 1024 * 1024),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  name: z.string().trim().max(180).optional().default("photo"),
});
const scrapSubmissionSchema = z.object({
  photos: z.array(scrapPhotoSchema).min(1).max(20),
  url: z.string().trim().url().max(1000),
});
const allowedHosts = new Set([
  "map.naver.com",
  "m.map.naver.com",
  "m.place.naver.com",
  "naver.me",
  "nmap.place.naver.com",
  "pcmap.place.naver.com",
]);

function cleanFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
}

function assertNaverPlaceUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("http/https 네이버 지도 링크만 사용할 수 있습니다.");
  }

  const hostname = url.hostname.toLowerCase();
  const isAllowedHost = allowedHosts.has(hostname)
    || hostname.endsWith(".map.naver.com")
    || hostname.endsWith(".place.naver.com");

  if (!isAllowedHost) {
    throw new Error("네이버 지도/플레이스 링크만 사용할 수 있습니다.");
  }

  return url;
}

function hasValidImageSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return bytes.length > 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}

function decodeDataUrl(dataUrl: string, mimeType: string): Buffer {
  const prefix = `data:${mimeType};base64,`;
  if (!dataUrl.startsWith(prefix)) {
    throw new Error("사진 데이터 형식이 올바르지 않습니다.");
  }

  const encoded = dataUrl.slice(prefix.length);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("사진 데이터가 올바른 base64 형식이 아닙니다.");
  }

  return Buffer.from(encoded, "base64");
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request, { checkOrigin: true });
  if (authError) return authError;

  try {
    const parsed = scrapSubmissionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.message }, { status: 400 });
    }

    const naverUrl = assertNaverPlaceUrl(parsed.data.url);
    const photos = parsed.data.photos;

    const supabase = createSupabaseAdminClient();
    const submissionId = randomUUID();
    const bucket = "photo-submission-originals";
    const uploadedPaths: string[] = [];

    const { data: submission, error: submissionError } = await supabase
      .from("photo_submissions")
      .insert({
        id: submissionId,
        source: "manual",
        source_form_id: "admin-scrap",
        source_submission_id: `admin-scrap-${submissionId}`,
        status: "submitted",
        place_name: "네이버 스크랩 대기",
        submitter_type: "team",
        submitter_name: "Doripe Admin",
        consent_label: "admin-scrap",
        consent_accepted: true,
        consent_accepted_at: new Date().toISOString(),
        consent_text_snapshot: "관리자가 네이버지도 URL과 사진을 스크랩 관리 큐에 등록했습니다.",
        raw_payload: {
          kind: "naver_place_scrap",
          naver_url: naverUrl.toString(),
        },
        source_submitted_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (submissionError) {
      return NextResponse.json({ message: submissionError.message }, { status: 500 });
    }

    try {
      for (const [index, photo] of photos.entries()) {
        if (!allowedImageTypes.has(photo.mimeType)) {
          throw new Error("JPG, PNG, WebP 사진만 올릴 수 있습니다.");
        }

        const bytes = decodeDataUrl(photo.dataUrl, photo.mimeType);
        if (bytes.length <= 0 || bytes.length > maxPhotoBytes) {
          throw new Error("사진은 장당 10MB 이하만 올릴 수 있습니다.");
        }

        if (!hasValidImageSignature(bytes, photo.mimeType)) {
          throw new Error(`${photo.name} 파일 내용이 확장자와 맞지 않습니다.`);
        }

        const storagePath = `admin-scrap/${submissionId}/${String(index + 1).padStart(2, "0")}-${randomUUID()}-${cleanFileName(photo.name)}`;
        const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, {
          cacheControl: "3600",
          contentType: photo.mimeType,
          upsert: false,
        });

        if (upload.error) throw new Error(upload.error.message);
        uploadedPaths.push(storagePath);

        const { error: fileError } = await supabase.from("photo_submission_files").insert({
          bucket_id: bucket,
          checksum_sha256: createHash("sha256").update(bytes).digest("hex"),
          display_order: index,
          file_size: bytes.length,
          mime_type: photo.mimeType,
          original_url: naverUrl.toString(),
          source_file_name: photo.name,
          storage_path: storagePath,
          submission_id: submissionId,
        });

        if (fileError) throw new Error(fileError.message);
      }
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from(bucket).remove(uploadedPaths);
      }
      await supabase.from("photo_submissions").delete().eq("id", submissionId);
      throw error;
    }

    await supabase.from("admin_audit_logs").insert({
      action: "create_scrap_submission",
      entity_type: "photo_submission",
      entity_id: submissionId,
      payload: {
        fileCount: photos.length,
        naverUrl: naverUrl.toString(),
      },
    });

    return NextResponse.json({
      ok: true,
      submission: {
        ...submission,
        file_count: photos.length,
        naver_url: naverUrl.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "스크랩 제출에 실패했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
