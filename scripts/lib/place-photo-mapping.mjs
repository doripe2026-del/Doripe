export const MAPPING_COLUMNS = Object.freeze([
  "photo_id",
  "storage_bucket",
  "storage_path",
  "place_id",
  "provider_id",
  "source_type",
  "rights_status",
  "publish_status",
  "photo_type",
  "sort_position",
  "rights_holder_name",
  "credit_text",
  "usage_scope",
  "license_note",
]);

const REQUIRED_COLUMNS = Object.freeze(MAPPING_COLUMNS.slice(0, 12));
const UUID_COLUMNS = Object.freeze(["photo_id", "place_id", "provider_id"]);
const SOURCE_TYPES = new Set(["team", "owner", "creator", "licensed", "naver"]);
const RIGHTS_STATUSES = new Set(["pending", "approved", "rejected"]);
const PUBLISH_STATUSES = new Set(["draft", "active", "published", "inactive"]);
const PUBLISHABLE_STATUSES = new Set(["active", "published"]);
const PHOTO_TYPES = new Set(["cover", "gallery", "original", "rights"]);
const PUBLISHABLE_PHOTO_TYPES = new Set(["cover", "gallery"]);
const ACTIVE_MANIFEST_STATUSES = new Set(["active", "approved", "published", "ready"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,61}[a-z0-9])?$/;

function pushField(currentRow, field) {
  currentRow.push(field);
  return "";
}

export function parseCsv(text) {
  if (typeof text !== "string") throw new TypeError("CSV input must be a string");

  const rows = [];
  let currentRow = [];
  let field = "";
  let inQuotes = false;
  let justClosedQuote = false;

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
      }
      continue;
    }

    if (character === '"') {
      if (field || justClosedQuote) throw new Error("Malformed CSV: unexpected quote");
      inQuotes = true;
      continue;
    }
    if (character === ",") {
      field = pushField(currentRow, field);
      justClosedQuote = false;
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      field = pushField(currentRow, field);
      rows.push(currentRow);
      currentRow = [];
      justClosedQuote = false;
      continue;
    }
    if (justClosedQuote) throw new Error("Malformed CSV: unexpected character after closing quote");
    field += character;
  }

  if (inQuotes) throw new Error("Malformed CSV: unterminated quoted field");
  if (field || currentRow.length || justClosedQuote) {
    pushField(currentRow, field);
    rows.push(currentRow);
  }
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

  return rows.slice(1).flatMap((values, index) => {
    if (values.every((value) => value === "")) return [];
    if (values.length !== MAPPING_COLUMNS.length) {
      throw new Error(`CSV row ${index + 2} must contain exactly ${MAPPING_COLUMNS.length} columns`);
    }
    return [Object.fromEntries(MAPPING_COLUMNS.map((column, columnIndex) => [column, values[columnIndex]]))];
  });
}

function isSafeStoragePath(path) {
  if (!path || path !== path.trim() || path.length > 1024) return false;
  if (path.startsWith("/") || path.includes("\\") || /[\u0000-\u001f\u007f?#]/.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || /%(?:2e|2f|5c)/i.test(path)) return false;
  const segments = path.split("/");
  return segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function normalizedRow(input) {
  return Object.fromEntries(MAPPING_COLUMNS.map((column) => {
    const value = String(input?.[column] ?? "");
    return [column, column === "storage_bucket" || column === "storage_path" ? value : value.trim()];
  }));
}

function addError(errors, code, row, field, message) {
  errors.push({ code, row, field, message });
}

function addDuplicateErrors(rows, errors, field, code, label, normalize = (value) => value) {
  const seen = new Map();
  for (const item of rows) {
    const value = normalize(item.data[field]);
    if (!value) continue;
    const firstRow = seen.get(value);
    if (firstRow) {
      addError(errors, code, item.rowNumber, field, `${label} duplicates row ${firstRow}`);
    } else {
      seen.set(value, item.rowNumber);
    }
  }
}

function manifestIndex(items, idField, errors, kind) {
  if (items === undefined) return null;
  if (!Array.isArray(items)) {
    addError(errors, "invalid_manifest", null, kind, `${kind} manifest must contain an array`);
    return new Map();
  }
  const index = new Map();
  for (const item of items) {
    const id = String(item?.[idField] ?? "").trim().toLowerCase();
    if (!id) {
      addError(errors, "invalid_manifest_entry", null, kind, `${kind} manifest entry is missing ${idField}`);
      continue;
    }
    if (!UUID_PATTERN.test(id)) {
      addError(errors, "invalid_manifest_uuid", null, kind, `${kind} manifest ${idField} must be a canonical UUID`);
    }
    if (index.has(id)) {
      addError(errors, "duplicate_manifest_entry", null, kind, `${kind} manifest contains duplicate ${id}`);
      continue;
    }
    index.set(id, item);
  }
  return index;
}

function storageManifestIndex(items, errors) {
  if (items === undefined) return null;
  if (!Array.isArray(items)) {
    addError(errors, "invalid_manifest", null, "storage", "storage manifest must contain an array");
    return new Map();
  }
  const index = new Map();
  for (const item of items) {
    const bucket = String(item?.bucket ?? "");
    const path = String(item?.path ?? "");
    if (!BUCKET_PATTERN.test(bucket) || !isSafeStoragePath(path)) {
      addError(errors, "invalid_manifest_entry", null, "storage", "storage manifest entry requires a safe bucket and path");
      continue;
    }
    const key = `${bucket}\u0000${path}`;
    if (index.has(key)) {
      addError(errors, "duplicate_manifest_entry", null, "storage", `storage manifest contains duplicate ${bucket}/${path}`);
      continue;
    }
    index.set(key, item);
  }
  return index;
}

function compareErrors(left, right) {
  return (left.row ?? 0) - (right.row ?? 0)
    || left.code.localeCompare(right.code)
    || left.field.localeCompare(right.field)
    || left.message.localeCompare(right.message);
}

function comparePlan(left, right) {
  return left.place_id.localeCompare(right.place_id)
    || left.sort_position - right.sort_position
    || left.storage_path.localeCompare(right.storage_path)
    || left.photo_id.localeCompare(right.photo_id);
}

function planItem(data) {
  return {
    action: "map_place_photo",
    photo_id: data.photo_id.toLowerCase(),
    place_id: data.place_id.toLowerCase(),
    provider_id: data.provider_id.toLowerCase(),
    storage_bucket: data.storage_bucket,
    storage_path: data.storage_path,
    source_type: data.source_type,
    rights_status: data.rights_status,
    publish_status: data.publish_status,
    photo_type: data.photo_type,
    sort_position: Number(data.sort_position),
    rights_holder_name: data.rights_holder_name,
    credit_text: data.credit_text,
    usage_scope: data.usage_scope,
    license_note: data.license_note,
  };
}

export function validatePlacePhotoMapping(inputRows, manifests = {}) {
  if (!Array.isArray(inputRows)) throw new TypeError("Mapping rows must be an array");

  const errors = [];
  const rows = inputRows.map((input, index) => ({ data: normalizedRow(input), rowNumber: index + 2 }));
  if (!rows.length) addError(errors, "empty_mapping", null, "mapping", "mapping must contain at least one data row");
  const storageIndex = storageManifestIndex(manifests.storageObjects, errors);
  const placeIndex = manifestIndex(manifests.places, "id", errors, "place");
  const providerIndex = manifestIndex(manifests.providers, "id", errors, "provider");

  for (const { data, rowNumber } of rows) {
    for (const field of REQUIRED_COLUMNS) {
      if (!data[field]) addError(errors, "required_field", rowNumber, field, `${field} is required`);
    }
    for (const field of UUID_COLUMNS) {
      if (data[field] && !UUID_PATTERN.test(data[field])) {
        addError(errors, "invalid_uuid", rowNumber, field, `${field} must be a canonical UUID`);
      }
    }
    if (data.storage_bucket && !BUCKET_PATTERN.test(data.storage_bucket)) {
      addError(errors, "unsafe_storage_bucket", rowNumber, "storage_bucket", "storage_bucket is not a safe bucket name");
    }
    if (data.storage_path && !isSafeStoragePath(data.storage_path)) {
      addError(errors, "unsafe_storage_path", rowNumber, "storage_path", "storage_path must be a relative traversal-free object path");
    }
    if (data.source_type && !SOURCE_TYPES.has(data.source_type)) {
      addError(errors, "invalid_source_type", rowNumber, "source_type", "source_type is not supported");
    }
    if (data.rights_status && !RIGHTS_STATUSES.has(data.rights_status)) {
      addError(errors, "invalid_rights_status", rowNumber, "rights_status", "rights_status is not supported");
    }
    if (data.publish_status && !PUBLISH_STATUSES.has(data.publish_status)) {
      addError(errors, "invalid_publish_status", rowNumber, "publish_status", "publish_status is not supported");
    }
    if (data.photo_type && !PHOTO_TYPES.has(data.photo_type)) {
      addError(errors, "invalid_photo_type", rowNumber, "photo_type", "photo_type is not supported");
    }
    if (data.sort_position && (!/^\d+$/.test(data.sort_position) || Number(data.sort_position) > 2_147_483_647)) {
      addError(errors, "invalid_sort_position", rowNumber, "sort_position", "sort_position must be a non-negative integer");
    }

    const publishable = PUBLISHABLE_STATUSES.has(data.publish_status);
    if (publishable && data.rights_status !== "approved") {
      addError(errors, "publish_rights_not_approved", rowNumber, "rights_status", "active or published photos require approved rights");
    }
    if (publishable && !PUBLISHABLE_PHOTO_TYPES.has(data.photo_type)) {
      addError(errors, "publish_photo_type_not_allowed", rowNumber, "photo_type", "only cover or gallery photos may be published");
    }
    if (publishable && !data.usage_scope) {
      addError(errors, "required_publish_metadata", rowNumber, "usage_scope", "publishable photos require usage_scope");
    }
    if (publishable && data.source_type === "licensed" && !data.license_note) {
      addError(errors, "required_license_note", rowNumber, "license_note", "published licensed photos require license_note");
    }

    if (storageIndex && data.storage_bucket && data.storage_path) {
      const key = `${data.storage_bucket}\u0000${data.storage_path}`;
      if (!storageIndex.has(key)) {
        addError(errors, "storage_object_not_found", rowNumber, "storage_path", "object is not present in the storage manifest");
      }
    }
    if (placeIndex && data.place_id) {
      const place = placeIndex.get(data.place_id.toLowerCase());
      if (!place) {
        addError(errors, "place_not_found", rowNumber, "place_id", "place_id is not present in the place manifest");
      } else if (publishable && !ACTIVE_MANIFEST_STATUSES.has(String(place.status ?? "").toLowerCase())) {
        addError(errors, "place_not_publishable", rowNumber, "place_id", "place manifest status is not publishable");
      }
    }
    if (providerIndex && data.provider_id) {
      const provider = providerIndex.get(data.provider_id.toLowerCase());
      if (!provider) {
        addError(errors, "provider_not_found", rowNumber, "provider_id", "provider_id is not present in the provider manifest");
      } else {
        if (publishable && !ACTIVE_MANIFEST_STATUSES.has(String(provider.status ?? "").toLowerCase())) {
          addError(errors, "provider_not_publishable", rowNumber, "provider_id", "provider manifest status is not publishable");
        }
        const manifestSourceType = String(provider.source_type ?? provider.sourceType ?? "").toLowerCase();
        if (manifestSourceType && data.source_type && manifestSourceType !== data.source_type) {
          addError(errors, "provider_source_type_mismatch", rowNumber, "source_type", "source_type does not match the provider manifest");
        }
      }
    }
  }

  addDuplicateErrors(rows, errors, "photo_id", "duplicate_photo_id", "photo_id", (value) => value.toLowerCase());
  addDuplicateErrors(rows, errors, "storage_path", "duplicate_storage_path", "storage_path");

  const rowsByPlace = new Map();
  for (const item of rows) {
    if (!item.data.place_id) continue;
    const key = item.data.place_id.toLowerCase();
    const group = rowsByPlace.get(key) ?? [];
    group.push(item);
    rowsByPlace.set(key, group);
  }
  for (const [placeId, group] of rowsByPlace) {
    const publishableGroup = group.filter(({ data }) => PUBLISHABLE_STATUSES.has(data.publish_status));
    if (publishableGroup.length > 5) {
      addError(errors, "too_many_publishable_photos", null, "place_id", `${placeId} has ${publishableGroup.length} active or published photos; maximum is 5`);
    }
    const covers = group.filter(({ data }) => data.photo_type === "cover");
    if (covers.length > 1) {
      addError(errors, "multiple_covers", null, "photo_type", `${placeId} has ${covers.length} cover photos; maximum is 1`);
    }
    addDuplicateErrors(group, errors, "sort_position", "duplicate_sort_position", `sort_position for ${placeId}`);
  }

  errors.sort(compareErrors);
  const publishableRows = rows.filter(({ data }) => PUBLISHABLE_STATUSES.has(data.publish_status));
  const summary = {
    total_rows: rows.length,
    publishable_rows: publishableRows.length,
    non_publishable_rows: rows.length - publishableRows.length,
    places: new Set(rows.map(({ data }) => data.place_id.toLowerCase()).filter(Boolean)).size,
    providers: new Set(rows.map(({ data }) => data.provider_id.toLowerCase()).filter(Boolean)).size,
    storage_objects: new Set(rows.map(({ data }) => data.storage_path).filter(Boolean)).size,
    errors: errors.length,
  };
  const plan = errors.length ? [] : rows.map(({ data }) => planItem(data)).sort(comparePlan);
  return { valid: errors.length === 0, summary, errors, plan };
}

export function parseManifestJson(text, kind) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${kind} manifest must be valid JSON`);
  }
  const keys = { storage: "objects", place: "places", provider: "providers" };
  const key = keys[kind];
  if (!key) throw new Error(`Unknown manifest kind: ${kind}`);
  const items = Array.isArray(parsed) ? parsed : parsed?.[key];
  if (!Array.isArray(items)) throw new Error(`${kind} manifest must be an array or contain a ${key} array`);
  return items;
}
