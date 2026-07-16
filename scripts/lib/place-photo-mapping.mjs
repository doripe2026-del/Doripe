export const MAPPING_COLUMNS = Object.freeze([
  "photo_id",
  "storage_bucket",
  "storage_path",
  "place_id",
  "source_type",
  "permission_status",
  "photo_type",
  "display_order",
  "rights_holder_name",
  "credit_text",
  "usage_scope",
  "license_note",
]);

const CSV_ROW_NUMBER = Symbol("csvRowNumber");
const REQUIRED_COLUMNS = Object.freeze(MAPPING_COLUMNS.slice(0, 8));
const SOURCE_TYPES = new Set(["team", "owner", "creator", "licensed", "naver"]);
const PERMISSION_STATUSES = new Set(["pending", "approved", "rejected"]);
const PHOTO_TYPES = new Set(["cover", "gallery", "original", "rights"]);
const PUBLIC_PHOTO_TYPES = new Set(["cover", "gallery"]);
const PRIVATE_PHOTO_TYPES = new Set(["original", "rights"]);
const STORAGE_BUCKETS = new Set(["place-photos-public", "place-photo-originals"]);
const PLACE_STATUSES = new Set(["draft", "ready", "inactive"]);
const QA_STATUSES = new Set(["draft", "ready", "needs_fix"]);
const PHOTO_QA_STATUSES = new Set(["pending", "approved", "rejected"]);
const PUBLIC_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PRIVATE_FILE_MIME_TYPES = new Set([...PUBLIC_IMAGE_MIME_TYPES, "application/pdf"]);
const PUBLIC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const PRIVATE_FILE_MAX_BYTES = 50 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;
const MAX_DISPLAY_ORDER = 10_000;

function setRowNumber(value, rowNumber) {
  Object.defineProperty(value, CSV_ROW_NUMBER, { value: rowNumber });
  return value;
}

function finishCsvRow(rows, currentRow, field, rowNumber) {
  currentRow.push(field);
  rows.push(setRowNumber(currentRow, rowNumber));
}

export function parseCsv(text) {
  if (typeof text !== "string") throw new TypeError("CSV input must be a string");

  const rows = [];
  let currentRow = [];
  let field = "";
  let inQuotes = false;
  let justClosedQuote = false;
  let lineNumber = 1;
  let rowStartLine = 1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else {
        field += character;
        if (character === "\n" || (character === "\r" && text[index + 1] !== "\n")) lineNumber += 1;
      }
      continue;
    }

    if (character === '"') {
      if (field || justClosedQuote) throw new Error(`Malformed CSV at row ${rowStartLine}: unexpected quote`);
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      currentRow.push(field);
      field = "";
      justClosedQuote = false;
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishCsvRow(rows, currentRow, field, rowStartLine);
      currentRow = [];
      field = "";
      justClosedQuote = false;
      lineNumber += 1;
      rowStartLine = lineNumber;
      continue;
    }
    if (justClosedQuote) {
      throw new Error(`Malformed CSV at row ${rowStartLine}: unexpected character after closing quote`);
    }
    field += character;
  }

  if (inQuotes) throw new Error(`Malformed CSV at row ${rowStartLine}: unterminated quoted field`);
  if (field || currentRow.length || justClosedQuote) finishCsvRow(rows, currentRow, field, rowStartLine);
  return rows;
}

export function parseMappingCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("Mapping CSV is empty");

  const header = [...rows[0]];
  if (header[0]?.startsWith("\ufeff")) header[0] = header[0].slice(1);
  if (header.length !== MAPPING_COLUMNS.length || header.some((value, index) => value !== MAPPING_COLUMNS[index])) {
    throw new Error(`CSV header must exactly match: ${MAPPING_COLUMNS.join(",")}`);
  }

  return rows.slice(1).flatMap((values) => {
    if (values.every((value) => value === "")) return [];
    if (values.length !== MAPPING_COLUMNS.length) {
      throw new Error(`CSV row ${values[CSV_ROW_NUMBER]} must contain exactly ${MAPPING_COLUMNS.length} columns`);
    }
    const item = Object.fromEntries(MAPPING_COLUMNS.map((column, index) => [column, values[index]]));
    return [setRowNumber(item, values[CSV_ROW_NUMBER])];
  });
}

function isSafeStoragePath(path) {
  if (!path || path !== path.trim() || path.length > 1024) return false;
  if (path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f\u007f?#]/.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || /%(?:2e|2f|5c)/i.test(path)) return false;
  return path.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

function isSafeId(value) {
  return value.length <= 80 && SAFE_ID_PATTERN.test(value);
}

function normalizedRow(input) {
  const result = Object.fromEntries(MAPPING_COLUMNS.map((column) => {
    const value = String(input?.[column] ?? "");
    return [column, column === "storage_bucket" || column === "storage_path" ? value : value.trim()];
  }));
  if (input?.[CSV_ROW_NUMBER]) setRowNumber(result, input[CSV_ROW_NUMBER]);
  return result;
}

function addError(errors, code, row, field, message) {
  errors.push({ code, row, field, message });
}

function lexicalCompare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareErrors(left, right) {
  return (left.row ?? 0) - (right.row ?? 0)
    || lexicalCompare(left.code, right.code)
    || lexicalCompare(left.field, right.field)
    || lexicalCompare(left.message, right.message);
}

function comparePlan(left, right) {
  return lexicalCompare(left.place_id, right.place_id)
    || left.display_order - right.display_order
    || lexicalCompare(left.storage_bucket, right.storage_bucket)
    || lexicalCompare(left.storage_path, right.storage_path)
    || lexicalCompare(left.photo_id, right.photo_id);
}

function addDuplicateErrors(items, errors, valueFor, code, field, label) {
  const seen = new Map();
  for (const item of items) {
    const value = valueFor(item.data);
    if (value === undefined || value === "") continue;
    const firstRow = seen.get(value);
    if (firstRow !== undefined) {
      addError(errors, code, item.rowNumber, field, `${label} duplicates row ${firstRow}`);
    } else {
      seen.set(value, item.rowNumber);
    }
  }
}

function storageManifestIndex(items, errors) {
  if (items === undefined) {
    addError(errors, "missing_storage_manifest", null, "storage_manifest", "storage manifest is required");
    return null;
  }
  if (!Array.isArray(items)) {
    addError(errors, "invalid_storage_manifest", null, "storage_manifest", "storage manifest must contain an array");
    return new Map();
  }

  const index = new Map();
  for (const item of items) {
    const bucket = String(item?.bucket ?? "");
    const path = String(item?.path ?? "");
    const byteSize = item?.byte_size;
    const mimeType = String(item?.mime_type ?? "");
    if (!STORAGE_BUCKETS.has(bucket) || !isSafeStoragePath(path)) {
      addError(errors, "invalid_storage_manifest_entry", null, "storage_manifest", "storage entry requires a canonical bucket and safe path");
      continue;
    }

    if (!Number.isInteger(byteSize) || byteSize <= 0) {
      addError(errors, "invalid_storage_byte_size", null, "storage_manifest", `${bucket}/${path} requires a positive integer byte_size`);
    } else {
      const maxBytes = bucket === "place-photos-public" ? PUBLIC_IMAGE_MAX_BYTES : PRIVATE_FILE_MAX_BYTES;
      if (byteSize > maxBytes) {
        addError(errors, "storage_object_too_large", null, "storage_manifest", `${bucket}/${path} exceeds the ${maxBytes} byte limit`);
      }
    }

    const allowedMimeTypes = bucket === "place-photos-public" ? PUBLIC_IMAGE_MIME_TYPES : PRIVATE_FILE_MIME_TYPES;
    if (!allowedMimeTypes.has(mimeType)) {
      addError(errors, "invalid_storage_mime_type", null, "storage_manifest", `${bucket}/${path} has an unsupported mime_type`);
    }
    if (!SHA256_PATTERN.test(String(item?.checksum_sha256 ?? ""))) {
      addError(errors, "invalid_storage_checksum", null, "storage_manifest", `${bucket}/${path} requires a SHA-256 checksum`);
    }
    if (item?.signature_validated !== true) {
      addError(errors, "storage_signature_not_validated", null, "storage_manifest", `${bucket}/${path} requires signature_validated=true`);
    }

    const key = `${bucket}\u0000${path}`;
    if (index.has(key)) {
      addError(errors, "duplicate_storage_manifest_entry", null, "storage_manifest", `storage manifest contains duplicate ${bucket}/${path}`);
      continue;
    }
    index.set(key, item);
  }
  return index;
}

function placeManifestIndex(items, errors) {
  if (items === undefined) {
    addError(errors, "missing_place_manifest", null, "place_manifest", "place manifest is required");
    return null;
  }
  if (!Array.isArray(items)) {
    addError(errors, "invalid_place_manifest", null, "place_manifest", "place manifest must contain an array");
    return new Map();
  }

  const index = new Map();
  for (const item of items) {
    const id = String(item?.id ?? "").trim();
    const status = String(item?.status ?? "");
    const qaStatus = String(item?.qa_status ?? "");
    const photoQaStatus = String(item?.photo_qa_status ?? "");
    const valid = isSafeId(id)
      && PLACE_STATUSES.has(status)
      && QA_STATUSES.has(qaStatus)
      && PHOTO_QA_STATUSES.has(photoQaStatus);
    if (!valid) {
      addError(errors, "invalid_place_manifest_entry", null, "place_manifest", "place entry requires a safe id and canonical status fields");
    }
    if (!isSafeId(id)) continue;
    if (index.has(id)) {
      addError(errors, "duplicate_place_manifest_entry", null, "place_manifest", `place manifest contains duplicate ${id}`);
      continue;
    }
    index.set(id, item);
  }
  return index;
}

function planItem(data, storageObject) {
  return {
    action: "map_place_photo",
    photo_id: data.photo_id.toLowerCase(),
    storage_bucket: data.storage_bucket,
    storage_path: data.storage_path,
    place_id: data.place_id,
    source_type: data.source_type,
    permission_status: data.permission_status,
    photo_type: data.photo_type,
    display_order: Number(data.display_order),
    rights_holder_name: data.rights_holder_name,
    credit_text: data.credit_text,
    usage_scope: data.usage_scope,
    license_note: data.license_note,
    object_validation: {
      byte_size: storageObject.byte_size,
      mime_type: storageObject.mime_type,
      checksum_sha256: storageObject.checksum_sha256.toLowerCase(),
      signature_validated: storageObject.signature_validated,
    },
  };
}

function comparePublicRows(left, right) {
  return Number(left.data.display_order) - Number(right.data.display_order)
    || lexicalCompare(left.data.photo_id.toLowerCase(), right.data.photo_id.toLowerCase());
}

function placeSynchronizationItem(placeId, rows) {
  const publicRows = rows.filter(({ data }) => PUBLIC_PHOTO_TYPES.has(data.photo_type)).sort(comparePublicRows);
  if (!publicRows.length) return null;
  const coverPhoto = publicRows[0].data;
  return {
    action: "sync_place_photos",
    place_id: placeId,
    cover_photo_id: coverPhoto.photo_id.toLowerCase(),
    cover_image_url: { public_url_from_photo_id: coverPhoto.photo_id.toLowerCase() },
    image_urls: publicRows.map(({ data }) => ({ public_url_from_photo_id: data.photo_id.toLowerCase() })),
    photo_qa_status: "approved",
  };
}

export function validatePlacePhotoMapping(inputRows, manifests = {}) {
  if (!Array.isArray(inputRows)) throw new TypeError("Mapping rows must be an array");

  const errors = [];
  const rows = inputRows.map((input, index) => {
    const data = normalizedRow(input);
    return { data, rowNumber: data[CSV_ROW_NUMBER] ?? index + 2 };
  });
  if (!rows.length) addError(errors, "empty_mapping", null, "mapping", "mapping must contain at least one data row");

  const storageIndex = storageManifestIndex(manifests.storageObjects, errors);
  const placeIndex = placeManifestIndex(manifests.places, errors);

  for (const { data, rowNumber } of rows) {
    for (const field of REQUIRED_COLUMNS) {
      if (!data[field]) addError(errors, "required_field", rowNumber, field, `${field} is required`);
    }
    if (data.photo_id && !UUID_PATTERN.test(data.photo_id)) {
      addError(errors, "invalid_uuid", rowNumber, "photo_id", "photo_id must be a UUID");
    }
    if (data.place_id && !isSafeId(data.place_id)) {
      addError(errors, "invalid_place_id", rowNumber, "place_id", "place_id must be a safe text ID of at most 80 characters");
    }
    if (data.storage_bucket && !STORAGE_BUCKETS.has(data.storage_bucket)) {
      addError(errors, "invalid_storage_bucket", rowNumber, "storage_bucket", "storage_bucket is not canonical");
    }
    if (data.storage_path && !isSafeStoragePath(data.storage_path)) {
      addError(errors, "unsafe_storage_path", rowNumber, "storage_path", "storage_path must be a relative traversal-free object path");
    }
    if (data.source_type && !SOURCE_TYPES.has(data.source_type)) {
      addError(errors, "invalid_source_type", rowNumber, "source_type", "source_type is not supported");
    }
    if (data.permission_status && !PERMISSION_STATUSES.has(data.permission_status)) {
      addError(errors, "invalid_permission_status", rowNumber, "permission_status", "permission_status is not supported");
    }
    if (data.photo_type && !PHOTO_TYPES.has(data.photo_type)) {
      addError(errors, "invalid_photo_type", rowNumber, "photo_type", "photo_type is not supported");
    }
    const validDisplayOrder = /^\d+$/.test(data.display_order) && Number(data.display_order) <= MAX_DISPLAY_ORDER;
    if (data.display_order && !validDisplayOrder) {
      addError(errors, "invalid_display_order", rowNumber, "display_order", `display_order must be an integer from 0 to ${MAX_DISPLAY_ORDER}`);
    }

    for (const [field, maximum] of [["rights_holder_name", 120], ["credit_text", 200], ["usage_scope", 300], ["license_note", 1000]]) {
      if (data[field].length > maximum) {
        addError(errors, "field_too_long", rowNumber, field, `${field} must be at most ${maximum} characters`);
      }
    }

    const expectedBucket = PUBLIC_PHOTO_TYPES.has(data.photo_type)
      ? "place-photos-public"
      : PRIVATE_PHOTO_TYPES.has(data.photo_type) ? "place-photo-originals" : null;
    if (expectedBucket && STORAGE_BUCKETS.has(data.storage_bucket) && data.storage_bucket !== expectedBucket) {
      addError(errors, "bucket_photo_type_mismatch", rowNumber, "storage_bucket", `${data.photo_type} photos require ${expectedBucket}`);
    }

    const isPublic = PUBLIC_PHOTO_TYPES.has(data.photo_type);
    if (data.photo_type === "cover" && validDisplayOrder && Number(data.display_order) !== 0) {
      addError(errors, "invalid_cover_slot", rowNumber, "display_order", "cover photos require display_order 0");
    }
    if (data.photo_type === "gallery" && validDisplayOrder && (Number(data.display_order) < 1 || Number(data.display_order) > 4)) {
      addError(errors, "invalid_gallery_slot", rowNumber, "display_order", "gallery photos require display_order from 1 to 4");
    }
    if (isPublic && data.permission_status !== "approved") {
      addError(errors, "public_photo_not_approved", rowNumber, "permission_status", "public photos require approved permission");
    }
    if (isPublic && !data.usage_scope) {
      addError(errors, "public_photo_missing_usage_scope", rowNumber, "usage_scope", "public photos require usage_scope");
    }
    if (data.source_type === "licensed" && !data.license_note) {
      addError(errors, "licensed_photo_missing_license_note", rowNumber, "license_note", "licensed photos require license_note");
    }

    if (storageIndex && data.storage_bucket && data.storage_path) {
      const key = `${data.storage_bucket}\u0000${data.storage_path}`;
      if (!storageIndex.has(key)) {
        addError(errors, "storage_object_not_found", rowNumber, "storage_path", "object is not present at the exact bucket and path in the storage manifest");
      }
    }
    if (placeIndex && data.place_id && isSafeId(data.place_id)) {
      const place = placeIndex.get(data.place_id);
      if (!place) {
        addError(errors, "place_not_found", rowNumber, "place_id", "place_id is not present in the place manifest");
      } else if (isPublic && (
        place.status !== "ready"
        || place.qa_status !== "ready"
      )) {
        addError(errors, "place_not_public_ready", rowNumber, "place_id", "public photos require place status=ready and qa_status=ready");
      }
    }
  }

  addDuplicateErrors(rows, errors, ({ photo_id: id }) => id.toLowerCase(), "duplicate_photo_id", "photo_id", "photo_id");
  addDuplicateErrors(
    rows,
    errors,
    ({ storage_bucket: bucket, storage_path: path }) => bucket && path ? `${bucket}\u0000${path}` : "",
    "duplicate_storage_object",
    "storage_path",
    "storage object",
  );

  const rowsByPlace = new Map();
  for (const item of rows) {
    if (!item.data.place_id) continue;
    const group = rowsByPlace.get(item.data.place_id) ?? [];
    group.push(item);
    rowsByPlace.set(item.data.place_id, group);
  }
  for (const [placeId, group] of rowsByPlace) {
    const publicRows = group.filter(({ data }) => PUBLIC_PHOTO_TYPES.has(data.photo_type));
    if (publicRows.length > 5) {
      addError(errors, "too_many_public_photos", null, "place_id", `${placeId} has ${publicRows.length} public photos; maximum is 5`);
    }
    const covers = publicRows.filter(({ data }) => data.photo_type === "cover");
    if (covers.length > 1) {
      addError(errors, "multiple_covers", null, "photo_type", `${placeId} has ${covers.length} cover photos; maximum is 1`);
    }
    addDuplicateErrors(
      publicRows,
      errors,
      ({ display_order: order }) => /^\d+$/.test(order) && Number(order) <= MAX_DISPLAY_ORDER ? Number(order) : undefined,
      "duplicate_display_order",
      "display_order",
      `display_order for ${placeId}`,
    );
  }

  errors.sort(compareErrors);
  const publicRows = rows.filter(({ data }) => PUBLIC_PHOTO_TYPES.has(data.photo_type));
  const placeSynchronizations = [...rowsByPlace]
    .map(([placeId, group]) => placeSynchronizationItem(placeId, group))
    .filter(Boolean)
    .sort((left, right) => lexicalCompare(left.place_id, right.place_id));
  const summary = {
    total_rows: rows.length,
    public_rows: publicRows.length,
    private_rows: rows.length - publicRows.length,
    places: new Set(rows.map(({ data }) => data.place_id).filter(Boolean)).size,
    storage_objects: new Set(rows.map(({ data }) => (
      data.storage_bucket && data.storage_path ? `${data.storage_bucket}\u0000${data.storage_path}` : ""
    )).filter(Boolean)).size,
    place_synchronizations: placeSynchronizations.length,
    errors: errors.length,
  };
  const plan = errors.length ? [] : [
    ...rows.map(({ data }) => {
      const object = storageIndex.get(`${data.storage_bucket}\u0000${data.storage_path}`);
      return planItem(data, object);
    }).sort(comparePlan),
    ...placeSynchronizations,
  ];
  return { valid: errors.length === 0, summary, errors, plan };
}

export function parseManifestJson(text, kind) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${kind} manifest must be valid JSON`);
  }
  const keys = { storage: "objects", place: "places" };
  const key = keys[kind];
  if (!key) throw new Error(`Unknown manifest kind: ${kind}`);
  const items = Array.isArray(parsed) ? parsed : parsed?.[key];
  if (!Array.isArray(items)) throw new Error(`${kind} manifest must be an array or contain a ${key} array`);
  return items;
}
