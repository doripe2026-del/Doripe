import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-app-contract-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return { module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`), cleanup: () => rm(output, { recursive: true, force: true }) };
}

test("onboarding accepts the fields collected by the current app", async () => {
  const loaded = await importTypescript("src/backend/domains/me.ts");
  try {
    const parsed = loaded.module.onboardingUpdate.parse({
      birthYear: 2000,
      gender: "female",
      nickname: "도리페친구",
      discoveryHabit: "instagram-saved",
      referralSource: "instagram",
      neighborhoodIds: ["seongsu"],
    });
    assert.equal(parsed.birthYear, 2000);
    assert.equal(parsed.discoveryHabit, "instagram-saved");
    assert.deepEqual(parsed.placeTypeTagIds, []);
    assert.deepEqual(parsed.situationTagIds, []);
    assert.deepEqual(loaded.module.onboardingUpdate.parse({
      referralSource: "instagram",
    }).neighborhoodIds, []);
    assert.deepEqual(loaded.module.onboardingUpdate.parse({
      referralSource: "instagram",
      neighborhoodIds: [],
    }).neighborhoodIds, []);
    assert.equal(loaded.module.onboardingUpdate.safeParse({
      referralSource: "instagram",
      neighborhoodIds: ["seongsu", "seongsu"],
    }).success, false);
    assert.equal(loaded.module.onboardingUpdate.safeParse({
      birthYear: new Date().getUTCFullYear() + 1,
      referralSource: "instagram",
      neighborhoodIds: ["seongsu"],
    }).success, false);
  } finally {
    await loaded.cleanup();
  }
});

test("OpenAPI event input documents the anonymous id required before login", async () => {
  const openapi = await readFile("docs/api/openapi.yaml", "utf8");
  const eventInput = openapi.match(/"EventInput": \{[^\n]+/u)?.[0] ?? "";
  assert.match(eventInput, /"anonymousId"/);
});

test("v1 analytics records external map opens instead of in-app navigation", async () => {
  const loaded = await importTypescript("src/backend/domains/analytics.ts");
  try {
    assert.equal(loaded.module.analyticsEventNames.includes("external_map_open"), true);
    assert.equal(loaded.module.analyticsEventNames.includes("navigation_start"), false);
  } finally {
    await loaded.cleanup();
  }
  const document = JSON.parse(await readFile("docs/api/openapi.yaml", "utf8"));
  const names = document.components.schemas.EventInput.properties.name.enum;
  assert.deepEqual(names, [...loaded.module.analyticsEventNames]);
  assert.equal(names.includes("external_map_open"), true);
  assert.equal(names.includes("navigation_start"), false);
});

test("analytics backend accepts the documented screen dwell duration", async () => {
  const loaded = await importTypescript("src/backend/domains/analytics.ts");
  try {
    assert.equal(loaded.module.analyticsProperties.safeParse({ durationMs: 1_250 }).success, true);
    assert.equal(loaded.module.analyticsProperties.safeParse({ durationMs: -1 }).success, false);
    assert.equal(loaded.module.analyticsProperties.safeParse({ durationMs: 86_400_001 }).success, false);
  } finally {
    await loaded.cleanup();
  }

  const document = JSON.parse(await readFile("docs/api/openapi.yaml", "utf8"));
  assert.deepEqual(document.components.schemas.AnalyticsProperties.properties.durationMs, {
    type: "integer",
    minimum: 0,
    maximum: 86_400_000,
  });
});

test("OpenAPI documents hydrated saves and the place fields shown by the app", async () => {
  const openapi = await readFile("docs/api/openapi.yaml", "utf8");
  const document = JSON.parse(openapi);
  const place = openapi.match(/"Place": \{[^\n]+/u)?.[0] ?? "";
  const save = openapi.match(/"Save": \{[^\n]+/u)?.[0] ?? "";
  for (const field of ["nearestStation", "representativeMenuName", "representativeMenuPrice", "stayTimeMinutes", "shortCopy"]) {
    assert.match(place, new RegExp(`"${field}"`), field);
  }
  assert.match(save, /"target"/);
  assert.match(save, /oneOf/);
  const savedPlace = document.components.schemas.SavedPlaceTarget;
  assert.ok(savedPlace.properties.stayTimeMinutes);
  assert.ok(savedPlace.properties.updatedAt);
  assert.equal(savedPlace.properties.representativeMenu.properties.stayTimeMinutes, undefined);
  const onboarding = document.components.requestBodies.OnboardingPut.content["application/json"].schema;
  assert.equal(onboarding.properties.birthYear.maximum, new Date().getUTCFullYear());
  assert.equal(onboarding.required.includes("neighborhoodIds"), false);
  assert.equal(onboarding.properties.neighborhoodIds.minItems, 0);
  assert.deepEqual(onboarding.properties.neighborhoodIds.default, []);
});

test("course output includes stored segment travel time and total duration", async () => {
  const loaded = await importTypescript("src/backend/domains/courses.ts");
  try {
    const output = loaded.module.courseOutput({
      id: "00000000-0000-4000-8000-000000000001",
      user_id: "00000000-0000-4000-8000-000000000002",
      name: "성수 코스",
      is_public: true,
      start_place_id: "place-1",
      status: "active",
      version: 1,
      created_at: "2026-07-14T00:00:00.000Z",
      updated_at: "2026-07-14T00:00:00.000Z",
    }, [
      { id: "cp-1", placeId: "place-1", position: 0, stayMinutes: 40, travelMinutesFromPrevious: null, note: "" },
      { id: "cp-2", placeId: "place-2", position: 1, stayMinutes: 60, travelMinutesFromPrevious: 20, note: "" },
    ]);
    assert.equal(output.totalStayMinutes, 100);
    assert.equal(output.totalTravelMinutes, 20);
    assert.equal(output.totalDurationMinutes, 120);
    assert.equal(output.places[1].travelMinutesFromPrevious, 20);
  } finally {
    await loaded.cleanup();
  }
});

test("OpenAPI documents course segment and total durations", async () => {
  const openapi = await readFile("docs/api/openapi.yaml", "utf8");
  const coursePlace = openapi.match(/"CoursePlace": \{[^\n]+/u)?.[0] ?? "";
  const course = openapi.match(/"Course": \{[^\n]+/u)?.[0] ?? "";
  assert.match(coursePlace, /"travelMinutesFromPrevious"/);
  assert.match(course, /"totalStayMinutes"/);
  assert.match(course, /"totalTravelMinutes"/);
  assert.match(course, /"totalDurationMinutes"/);
});
