import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-domain-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return { module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`), cleanup: () => rm(output, { recursive: true, force: true }) };
}

test("public form schemas reject extra fields and enforce contract limits", async () => {
  const loaded = await importTypescript("src/backend/domains/forms.ts");
  try {
    const base = {
      email: "USER@example.com",
      regionId: "seoul",
      consentVersion: "privacy-v1",
      source: "landing",
      deduplicationKey: "beta-request-0001",
    };
    const parsed = loaded.module.publicFormSchemas.beta.parse(base);
    assert.equal(parsed.email, "user@example.com");
    assert.equal(loaded.module.publicFormSchemas.beta.safeParse({ ...base, unexpected: true }).success, false);
    assert.equal(loaded.module.publicFormSchemas.creator.safeParse({ ...base, displayName: "A" }).success, false);
    assert.equal(loaded.module.publicFormSchemas["notify-event"].safeParse({ ...base, eventCode: "Bad Code" }).success, false);
  } finally {
    await loaded.cleanup();
  }
});

test("admin handlers export the documented scopes and all requested surfaces", async () => {
  const loaded = await importTypescript("src/backend/domains/admin.ts");
  try {
    assert.deepEqual(loaded.module.adminResourceScopes, {
      categories: "content:write", tags: "content:write", places: "content:write", media: "content:write",
      contents: "content:write", reports: "users:moderate", inquiries: "users:moderate", users: "users:moderate",
      partnerships: "business:write", organizations: "business:write", campaigns: "business:write",
      audit: "operators:manage", stats: "analytics:read",
    });
    for (const name of [
      "listAdminCategories", "createAdminCategory", "updateAdminCategory", "listAdminTags", "createAdminTag",
      "listAdminPlaces", "createAdminPlace", "getAdminPlace", "updateAdminPlace", "listAdminMedia", "getAdminMedia",
      "listAdminUsers", "getAdminUser", "updateAdminUser", "listAdminContents", "getAdminContent", "updateAdminContent",
      "listAdminReports", "getAdminReport", "updateAdminReport", "listAdminInquiries", "getAdminInquiry", "updateAdminInquiry",
      "listAdminForms", "getAdminForm", "updateAdminForm", "listAdminPartnerships", "createAdminPartnership",
      "updateAdminPartnership", "listAdminOrganizations", "createAdminOrganization", "getAdminOrganization",
      "updateAdminOrganization", "listAdminCampaigns", "createAdminCampaign", "updateAdminCampaign", "listAdminAudit",
      "getAdminDashboard", "getAdminAnalytics", "getAdminStats",
    ]) assert.equal(typeof loaded.module[name], "function", name);
  } finally {
    await loaded.cleanup();
  }
});

test("admin records retain selected detail fields for edit and intake screens", async () => {
  const loaded = await importTypescript("src/backend/domains/admin.ts");
  try {
    const record = loaded.module.adminRecord({
      id: "place-1",
      name: "도리페 카페",
      address: "서울 성동구",
      lat: 37.5,
      lng: 127.0,
      payload: { url: "https://example.com" },
      status: "ready",
      version: 3,
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T01:00:00.000Z",
    }, {
      table: "places", keyColumn: "id", kind: "place", labelColumn: "name", summaryColumn: "address",
      scope: "content:write", select: "id,name,address,lat,lng,payload,status,version,created_at,updated_at",
    });
    assert.equal(record.details.address, "서울 성동구");
    assert.equal(record.details.lat, 37.5);
    assert.deepEqual(record.details.payload, { url: "https://example.com" });
  } finally {
    await loaded.cleanup();
  }
  const openapi = await readFile("docs/api/openapi.yaml", "utf8");
  const adminRecordSchema = openapi.match(/"AdminRecord": \{[^\n]+/u)?.[0] ?? "";
  assert.match(adminRecordSchema, /"details"/);
});

test("admin place update accepts detailed fields and uses an atomic audited RPC", async () => {
  const loaded = await importTypescript("src/backend/domains/admin.ts");
  try {
    const parsed = loaded.module.adminPlaceUpdateInput.parse({
      name: "도리페 카페",
      hoursText: "10:00-22:00",
      representativeMenuName: "필터 커피",
      representativeMenuPrice: "7,000원",
      expectedVersion: 2,
      reason: "운영 정보 최신화",
    });
    assert.equal(parsed.hoursText, "10:00-22:00");
    assert.equal(loaded.module.adminPlaceUpdateInput.safeParse({
      externalMapUrl: "https://map.naver.com/p/example",
      expectedVersion: 2,
      reason: "지도 주소 최신화",
    }).success, true);
    for (const externalMapUrl of ["javascript:alert(1)", "data:text/html,bad", "file:///tmp/bad", "https://evil.example/place/1"]) {
      assert.equal(loaded.module.adminPlaceUpdateInput.safeParse({
        externalMapUrl,
        expectedVersion: 2,
        reason: "지도 주소 최신화",
      }).success, false, externalMapUrl);
    }
    for (const field of ["shortCopy", "nearestStation", "hoursText", "phoneText", "priceLevel",
      "representativeMenuName", "representativeMenuPrice", "stayTimeMinutes", "externalMapUrl"]) {
      assert.equal(loaded.module.adminPlaceUpdateInput.safeParse({
        [field]: null,
        expectedVersion: 2,
        reason: "운영 정보 최신화",
      }).success, false, `${field} must match NOT NULL database columns`);
    }
  } finally {
    await loaded.cleanup();
  }
  const [admin, migration] = await Promise.all([
    readFile("src/backend/domains/admin.ts", "utf8"),
    readFile("supabase/migrations/20260714101200_operator_place_detail_update.sql", "utf8"),
  ]);
  assert.match(admin, /rpc\("operator_update_place"/);
  assert.match(migration, /create or replace function public\.operator_update_place/i);
  assert.match(migration, /insert into public\.operator_audit_logs/i);
  assert.match(migration, /p_expected_version/i);
  const openapi = await readFile("docs/api/openapi.yaml", "utf8");
  assert.match(openapi, /"AdminPlaceUpdate"/);
  const requestBody = openapi.match(/"AdminPlaceUpdate": \{[^\n]+/u)?.[0] ?? "";
  assert.match(requestBody, /"hoursText"/);
  assert.match(requestBody, /"representativeMenuName"/);
  const document = JSON.parse(openapi);
  const placeUpdate = document.components.requestBodies.AdminPlaceUpdate.content["application/json"].schema;
  for (const field of ["shortCopy", "nearestStation", "hoursText", "phoneText", "priceLevel",
    "representativeMenuName", "representativeMenuPrice", "stayTimeMinutes", "externalMapUrl"]) {
    assert.equal(Array.isArray(placeUpdate.properties[field].type), false, field);
  }
  assert.match(placeUpdate.properties.externalMapUrl.pattern, /naver/);
});

test("all intake kinds use one documented scope map without curator bypass", async () => {
  const loaded = await importTypescript("src/backend/domains/admin.ts");
  try {
    assert.deepEqual(loaded.module.adminIntakeScopes, {
      beta: "analytics:read",
      creator: "users:moderate",
      business: "business:write",
      recommendation: "content:write",
      inquiry: "users:moderate",
      partner: "business:write",
      campaign: "business:write",
      "notify-taste": "analytics:read",
      "notify-event": "analytics:read",
    });
  } finally {
    await loaded.cleanup();
  }
  const [openapiText, migration] = await Promise.all([
    readFile("docs/api/openapi.yaml", "utf8"),
    readFile("supabase/migrations/20260714101000_operator_intake_scope_alignment.sql", "utf8"),
  ]);
  const document = JSON.parse(openapiText);
  const kinds = document.components.parameters.AdminKind.schema.enum;
  assert.deepEqual(kinds, ["beta", "creator", "business", "recommendation", "inquiry", "partner", "campaign", "notify-taste", "notify-event"]);
  for (const path of ["/admin/intake/{kind}", "/admin/intake/{kind}/{id}"]) {
    for (const operation of Object.values(document.paths[path])) {
      assert.equal(operation["x-operator-scope"]["by-path-param"].kind.creator, "users:moderate");
    }
  }
  assert.match(migration, /p_intake_kind = 'creator' then 'users:moderate'/i);
});

test("public form handlers call the durable database rate limiter", async () => {
  const forms = await readFile("src/backend/domains/forms.ts", "utf8");
  assert.match(forms, /rpc\("consume_rate_limit"/);
  assert.doesNotMatch(forms, /consumeDevelopmentRateLimit/);
});

test("94000 reuses the canonical media/content/support tables", async () => {
  const migration = await readFile("supabase/migrations/20260714094000_forms_support_business_admin.sql", "utf8");
  assert.doesNotMatch(migration, /create table public\.media_assets/i);
  assert.doesNotMatch(migration, /create table public\.contents/i);
  assert.doesNotMatch(migration, /create table public\.inquiries/i);
  assert.doesNotMatch(migration, /create table public\.reports/i);
  for (const table of ["intake_submissions", "business_organizations", "business_partnerships", "business_campaigns"]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
});
