import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  buildAllowedPhotoHosts,
  mapWithConcurrency,
  readBodyWithLimit,
  validatePhotoUrl,
  webhookAuthenticationConfigured,
} from "./security.ts";

type JsonRecord = Record<string, unknown>;

type FlatField = {
  key: string;
  label: string;
  value: unknown;
};

type DownloadedPhoto = {
  url: string;
  buffer: ArrayBuffer;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  checksumSha256: string;
};

const bucketId = "photo-submission-originals";
const defaultNeighborhoodId = "yeonnam_mangwon";
const defaultCategoryId = "category-uncategorized";
const defaultCategoryName = "미분류";
const maxFileBytes = 10 * 1024 * 1024;
const maxFilesPerSubmission = 30;
const maxWebhookBodyBytes = 1024 * 1024;
const photoDownloadConcurrency = 3;
const photoDownloadTimeoutMs = 10_000;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(data: JsonRecord, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64FromBytes(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (isRecord(value)) return JSON.stringify(value);
  return "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return "";
}

function getData(payload: JsonRecord): JsonRecord {
  return isRecord(payload.data) ? payload.data : {};
}

function addField(fields: FlatField[], value: unknown): void {
  if (!isRecord(value)) return;

  const label = firstText(value.label, value.title, value.question, value.name, value.text);
  const key = firstText(value.key, value.id, value.uuid, value.blockId, value.fieldId);
  const fieldValue = value.value ?? value.answer ?? value.answers ?? value.values ?? value.files;

  if (label || key) {
    fields.push({ key, label, value: fieldValue });
  }
}

function flattenFields(payload: JsonRecord): FlatField[] {
  const fields: FlatField[] = [];
  const data = getData(payload);
  const arrayCandidates = [payload.fields, payload.questions, payload.answers, data.fields, data.questions, data.answers];

  for (const candidate of arrayCandidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) addField(fields, item);
    }
  }

  for (const source of [payload, data]) {
    for (const [key, value] of Object.entries(source)) {
      if (["data", "fields", "questions", "answers"].includes(key)) continue;
      if (typeof value === "function" || value === undefined) continue;
      fields.push({ key, label: key, value });
    }
  }

  return fields;
}

function labelOf(field: FlatField): string {
  return `${field.label} ${field.key}`.toLowerCase();
}

function findField(fields: FlatField[], needles: string[]): FlatField | undefined {
  return fields.find((field) => {
    const label = labelOf(field);
    return needles.every((needle) => label.includes(needle.toLowerCase()));
  });
}

function findConsentField(fields: FlatField[]): FlatField | undefined {
  const candidates = fields.filter((field) => {
    const label = labelOf(field);
    return (label.includes("사진") && label.includes("동의")) || label.includes("consent");
  });

  return (
    candidates.find((field) => labelOf(field).includes("동의합니다") && isConsentAccepted(field.value)) ??
    candidates.find((field) => typeof field.value === "boolean" && isConsentAccepted(field.value)) ??
    candidates.find((field) => isConsentAccepted(field.value)) ??
    candidates[0]
  );
}

function isConsentAccepted(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(isConsentAccepted);

  const text = asText(value).toLowerCase();
  if (!text) return false;

  return ["동의", "agree", "accepted", "true", "yes"].some((token) => text.includes(token));
}

function collectUrls(value: unknown, urls: string[] = []): string[] {
  if (typeof value === "string") {
    const matches = value.match(/https?:\/\/[^\s"'<>),]+/g) ?? [];
    urls.push(...matches);
    return urls;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls);
    return urls;
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) collectUrls(item, urls);
  }

  return urls;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function extractPhotoUrls(fields: FlatField[], payload: JsonRecord, allowedHosts: ReadonlySet<string>): string[] {
  const photoFields = fields.filter((field) => {
    const label = labelOf(field);
    return label.includes("사진 업로드") || label.includes("file") || label.includes("upload");
  });

  const fromPhotoFields = photoFields.flatMap((field) => collectUrls(field.value));
  const fallback = collectUrls(payload);
  return dedupe([...fromPhotoFields, ...fallback].filter((url) => validatePhotoUrl(url, allowedHosts) !== null));
}

function detectMime(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return "";
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function cleanFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "photo";
}

function fileNameFromUrl(url: string, fallbackIndex: number, mimeType: string): string {
  try {
    const parsed = new URL(url);
    const lastPath = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
    return cleanFileName(lastPath || `photo-${fallbackIndex}.${extensionForMime(mimeType)}`);
  } catch {
    return `photo-${fallbackIndex}.${extensionForMime(mimeType)}`;
  }
}

function pathSegment(value: string): string {
  return cleanFileName(value).slice(0, 80) || crypto.randomUUID();
}

function placeIdFromSubmission(sourceSubmissionId: string): string {
  return `tally-${pathSegment(sourceSubmissionId)}`.slice(0, 80).replace(/-+$/g, "");
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function downloadPhoto(url: string, index: number): Promise<DownloadedPhoto> {
  const allowedHosts = buildAllowedPhotoHosts(Deno.env.get("TALLY_PHOTO_ALLOWED_HOSTS") ?? "");
  const validatedUrl = validatePhotoUrl(url, allowedHosts);
  if (!validatedUrl) throw new Error(`Photo ${index} URL is not allowed`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), photoDownloadTimeoutMs);
  let response: Response;
  try {
    response = await fetch(validatedUrl, {
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    throw new Error(`Could not download photo ${index}`);
  }

  if (!response.ok) {
    clearTimeout(timeout);
    throw new Error(`Could not download photo ${index}: ${response.status}`);
  }

  const headerMimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxFileBytes) {
    clearTimeout(timeout);
    throw new Error(`Photo ${index} is larger than ${maxFileBytes} bytes`);
  }

  if (!response.body) {
    clearTimeout(timeout);
    throw new Error(`Photo ${index} has no content`);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxFileBytes) {
        await reader.cancel();
        throw new Error(`Photo ${index} is larger than ${maxFileBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const buffer = bytes.buffer;
  if (bytes.byteLength <= 0 || bytes.byteLength > maxFileBytes) {
    throw new Error(`Photo ${index} has an invalid file size`);
  }

  const detectedMimeType = detectMime(bytes);
  const mimeType = detectedMimeType;
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error(`Photo ${index} is not a supported image type`);
  }

  if (headerMimeType && allowedMimeTypes.has(headerMimeType) && headerMimeType !== detectedMimeType) {
    throw new Error(`Photo ${index} content does not match its content-type`);
  }

  return {
    url,
    buffer,
    bytes,
    mimeType,
    fileName: fileNameFromUrl(url, index, mimeType),
    checksumSha256: await sha256Hex(buffer),
  };
}

function sanitizedRawPayload(payload: JsonRecord, fields: FlatField[]): JsonRecord {
  const data = getData(payload);
  return {
    event_id: firstText(payload.eventId, payload.id),
    event_type: firstText(payload.eventType, payload.type),
    form_id: firstText(data.formId, data.form_id, payload.formId, payload.form_id),
    response_id: firstText(data.responseId, payload.responseId),
    submission_id: firstText(data.submissionId, payload.submissionId),
    submitted_at: firstText(data.submittedAt, data.createdAt, payload.submittedAt, payload.createdAt),
    fields: fields.slice(0, 100).map((field) => ({ key: field.key.slice(0, 120), label: field.label.slice(0, 240) })),
  };
}

function parseDate(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function ensureDefaultCategory(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from("categories").upsert(
    {
      display_order: 0,
      id: defaultCategoryId,
      name: defaultCategoryName,
      status: "active",
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
}

async function upsertCollectedPlace(
  supabase: SupabaseClient,
  placeId: string,
  placeName: string,
): Promise<void> {
  const { error } = await supabase.from("places").upsert(
    {
      address: "",
      best_for: [],
      category_id: defaultCategoryId,
      cover_image_url: "",
      cover_photo_id: null,
      editorial_note: "",
      hours_text: "",
      id: placeId,
      image_credit: "team",
      image_urls: [],
      last_checked_at: null,
      lat: 0,
      lng: 0,
      mood_tags: [],
      name: placeName,
      naver_place_url: "",
      nearest_station: "",
      neighborhood_id: defaultNeighborhoodId,
      photo_qa_status: "pending",
      price_hint: "",
      qa_status: "draft",
      route_role: "middle",
      short_copy: "",
      status: "draft",
      stay_time_minutes: 45,
      sub_area: "",
      time_tags: [],
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  const headerSecret = Deno.env.get("DORIPE_WEBHOOK_HEADER_SECRET") ?? "";
  const signingSecret = Deno.env.get("TALLY_WEBHOOK_SIGNING_SECRET") ?? Deno.env.get("TALLY_WEBHOOK_SECRET") ?? "";
  if (!webhookAuthenticationConfigured(headerSecret, signingSecret)) {
    return json({ ok: false, message: "Webhook authentication is not configured" }, 503);
  }

  if (headerSecret) {
    const incomingSecret =
      request.headers.get("x-doripe-webhook-secret") ?? request.headers.get("x-tally-secret") ?? "";

    if (!constantTimeEqual(incomingSecret, headerSecret)) {
      return json({ ok: false, message: "Unauthorized" }, 401);
    }
  }

  let rawBody: string;
  try {
    rawBody = await readBodyWithLimit(request, maxWebhookBodyBytes);
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return json({ ok: false, message: "Payload too large" }, 413);
    }
    return json({ ok: false, message: "Invalid request body" }, 400);
  }

  let payload: JsonRecord;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, message: "Invalid JSON payload" }, 400);
  }

  if (signingSecret) {
    const receivedSignature = request.headers.get("tally-signature") ?? request.headers.get("Tally-Signature") ?? "";
    const expectedRawSignature = await hmacSha256Base64(signingSecret, rawBody);
    const expectedJsonSignature = await hmacSha256Base64(signingSecret, JSON.stringify(payload));

    if (
      !receivedSignature ||
      (!constantTimeEqual(receivedSignature, expectedRawSignature) && !constantTimeEqual(receivedSignature, expectedJsonSignature))
    ) {
      return json({ ok: false, message: "Invalid Tally signature" }, 401);
    }
  }

  const fields = flattenFields(payload);
  const data = getData(payload);
  const placeField = findField(fields, ["장소명"]) ?? findField(fields, ["place"]);
  const consentField = findConsentField(fields);

  const placeName = asText(placeField?.value).trim();
  if (!placeName) return json({ ok: false, message: "Missing place name" }, 400);

  const consentAccepted = isConsentAccepted(consentField?.value);
  if (!consentAccepted) return json({ ok: false, message: "Missing photo usage consent" }, 400);

  const allowedPhotoHosts = buildAllowedPhotoHosts(Deno.env.get("TALLY_PHOTO_ALLOWED_HOSTS") ?? "");
  const photoUrls = extractPhotoUrls(fields, payload, allowedPhotoHosts);
  if (photoUrls.length === 0) return json({ ok: false, message: "Missing photo URLs" }, 400);
  if (photoUrls.length > maxFilesPerSubmission) {
    return json({ ok: false, message: `Too many photos. Max is ${maxFilesPerSubmission}.` }, 400);
  }

  const sourceSubmissionId =
    firstText(
      data.submissionId,
      data.responseId,
      data.id,
      payload.submissionId,
      payload.responseId,
      payload.eventId,
      payload.id,
    ) || crypto.randomUUID();

  const sourceRespondentId = firstText(data.respondentId, data.respondent_id, payload.respondentId, payload.respondent_id);
  const sourceFormId = firstText(data.formId, data.form_id, payload.formId, payload.form_id, Deno.env.get("TALLY_FORM_ID"));
  const sourceSubmittedAt = parseDate(
    firstText(data.submittedAt, data.createdAt, payload.submittedAt, payload.createdAt, payload["Submitted at"]),
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, message: "Missing Supabase environment variables" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const existing = await supabase
    .from("photo_submissions")
    .select("id")
    .eq("source", "tally")
    .eq("source_submission_id", sourceSubmissionId)
    .maybeSingle();

  if (existing.error) return json({ ok: false, message: existing.error.message }, 500);
  if (existing.data) {
    return json({ ok: true, duplicate: true, submission_id: existing.data.id });
  }

  let photos: DownloadedPhoto[];
  try {
    photos = await mapWithConcurrency(photoUrls, photoDownloadConcurrency, (url, index) => downloadPhoto(url, index + 1));
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "Could not download photos" }, 400);
  }

  const consentTextSnapshot = Deno.env.get("TALLY_PHOTO_CONSENT_TEXT")?.trim() ?? "";
  if (!consentTextSnapshot) {
    return json({ ok: false, message: "Missing TALLY_PHOTO_CONSENT_TEXT" }, 500);
  }

  const insertedSubmission = await supabase
    .from("photo_submissions")
    .insert({
      source: "tally",
      source_form_id: sourceFormId,
      source_submission_id: sourceSubmissionId,
      source_respondent_id: sourceRespondentId,
      place_name: placeName,
      consent_label: asText(consentField?.label || consentField?.key),
      consent_accepted: consentAccepted,
      consent_accepted_at: sourceSubmittedAt ?? new Date().toISOString(),
      consent_text_snapshot: consentTextSnapshot,
      raw_payload: sanitizedRawPayload(payload, fields),
      source_submitted_at: sourceSubmittedAt,
    })
    .select("id")
    .single();

  if (insertedSubmission.error) return json({ ok: false, message: insertedSubmission.error.message }, 500);

  const submissionId = insertedSubmission.data.id;
  const placeId = placeIdFromSubmission(sourceSubmissionId);
  const uploadedPaths: string[] = [];

  try {
    await ensureDefaultCategory(supabase);
    await upsertCollectedPlace(supabase, placeId, placeName);

    for (const [index, photo] of photos.entries()) {
      const storagePath = `tally/${pathSegment(sourceSubmissionId)}/${String(index + 1).padStart(2, "0")}-${crypto.randomUUID()}.${extensionForMime(photo.mimeType)}`;
      const upload = await supabase.storage.from(bucketId).upload(storagePath, new Blob([photo.buffer], { type: photo.mimeType }), {
        contentType: photo.mimeType,
        upsert: false,
      });

      if (upload.error) throw new Error(upload.error.message);
      uploadedPaths.push(storagePath);

      const insertedFile = await supabase
        .from("photo_submission_files")
        .insert({
          bucket_id: bucketId,
          checksum_sha256: photo.checksumSha256,
          display_order: index,
          file_size: photo.bytes.byteLength,
          mime_type: photo.mimeType,
          original_url: photo.url,
          source_file_name: photo.fileName,
          storage_path: storagePath,
          submission_id: submissionId,
        });

      if (insertedFile.error) throw new Error(insertedFile.error.message);
    }

    const linkedSubmission = await supabase
      .from("photo_submissions")
      .update({ linked_place_id: placeId })
      .eq("id", submissionId);

    if (linkedSubmission.error) throw new Error(linkedSubmission.error.message);
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(bucketId).remove(uploadedPaths);
    }
    await supabase.from("photo_submissions").delete().eq("id", submissionId);
    await supabase.from("places").delete().eq("id", placeId);

    return json({ ok: false, message: error instanceof Error ? error.message : "Could not store photos" }, 500);
  }

  return json({
    ok: true,
    place_id: placeId,
    submission_id: submissionId,
    file_count: photos.length,
  });
});
