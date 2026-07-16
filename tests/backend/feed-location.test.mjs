import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

async function importTypescript(entry) {
  const output = await mkdtemp(path.join(os.tmpdir(), "doripe-feed-location-test-"));
  const outfile = path.join(output, "module.mjs");
  await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile });
  return {
    module: await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`),
    cleanup: () => rm(output, { recursive: true, force: true }),
  };
}

test("feed location query accepts all three values together and rejects partial input", async () => {
  const loaded = await importTypescript("src/backend/domains/contents.ts");
  try {
    const allSeoul = loaded.module.feedQuerySchema.parse({});
    assert.equal(allSeoul.centerLat, undefined);
    assert.equal(allSeoul.centerLng, undefined);
    assert.equal(allSeoul.radiusKm, undefined);

    const nearby = loaded.module.feedQuerySchema.parse({
      centerLat: "37.5665",
      centerLng: "126.9780",
      radiusKm: "5",
    });
    assert.equal(nearby.centerLat, 37.5665);
    assert.equal(nearby.centerLng, 126.978);
    assert.equal(nearby.radiusKm, 5);

    for (const partial of [
      { centerLat: "37.5665" },
      { centerLat: "37.5665", centerLng: "126.9780" },
      { radiusKm: "5" },
    ]) {
      assert.equal(loaded.module.feedQuerySchema.safeParse(partial).success, false);
    }
    assert.equal(loaded.module.feedQuerySchema.safeParse({ centerLat: "91", centerLng: "126.9780", radiusKm: "5" }).success, false);
    assert.equal(loaded.module.feedQuerySchema.safeParse({ centerLat: "37.5665", centerLng: "126.9780", radiusKm: "0" }).success, false);
    assert.equal(loaded.module.feedQuerySchema.safeParse({ centerLat: "37.5665", centerLng: "126.9780", radiusKm: "51" }).success, false);
  } finally {
    await loaded.cleanup();
  }
});

test("feed radius filter uses geographic distance and ignores places without coordinates", async () => {
  const loaded = await importTypescript("src/backend/domains/contents.ts");
  try {
    const cityHall = { latitude: 37.5665, longitude: 126.9780 };
    const gangnam = { latitude: 37.4979, longitude: 127.0276 };
    const distance = loaded.module.distanceInKilometers(cityHall, gangnam);
    assert.ok(distance > 8 && distance < 10);

    assert.deepEqual(loaded.module.placeIdsWithinRadius([
      { id: "city-hall", lat: 37.5665, lng: 126.9780 },
      { id: "nearby", lat: "37.57", lng: "126.98" },
      { id: "gangnam", lat: 37.4979, lng: 127.0276 },
      { id: "missing", lat: null, lng: null },
    ], { centerLat: 37.5665, centerLng: 126.9780, radiusKm: 5 }), ["city-hall", "nearby"]);
  } finally {
    await loaded.cleanup();
  }
});

test("OpenAPI documents optional all-or-none pin radius parameters", async () => {
  const document = JSON.parse(await readFile("docs/api/openapi.yaml", "utf8"));
  const feed = document.paths["/feed"].get;
  const parameters = new Map(feed.parameters
    .filter((parameter) => parameter.name)
    .map((parameter) => [parameter.name, parameter]));

  for (const name of ["centerLat", "centerLng", "radiusKm"]) {
    assert.equal(parameters.get(name)?.required, false);
  }
  assert.match(feed.description, /all three/i);
  assert.match(feed.description, /all Seoul/i);
  assert.equal(parameters.get("radiusKm").schema.maximum, 50);
});
