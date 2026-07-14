import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRepositoryContract,
  createEmptyDataSnapshot,
  normalizeDataSnapshot
} from "../../public/app-preview/data/contracts.js";
import { createAppDataStore } from "../../public/app-preview/data/store.js";
import { createDataCatalog, mediaForPlace, placeById } from "../../public/app-preview/data/selectors.js";

test("normalized snapshots own cloned collections", () => {
  const places = [{ id: "place-1", mediaIds: ["media-1"], tagIds: [] }];
  const snapshot = normalizeDataSnapshot({ places, media: [{ id: "media-1" }] });
  assert.notEqual(snapshot.places, places);
  assert.deepEqual(snapshot.places, places);
  assert.deepEqual(createEmptyDataSnapshot().contents, []);
});

test("selectors resolve relationships by ID", () => {
  const data = normalizeDataSnapshot({
    places: [{ id: "place-1", mediaIds: ["media-1"], tagIds: [] }],
    media: [{ id: "media-1", placeId: "place-1" }]
  });
  assert.equal(placeById(data, "place-1").id, "place-1");
  assert.deepEqual(mediaForPlace(data, data.places[0]).map((item) => item.id), ["media-1"]);
  assert.equal(createDataCatalog(data).isKnownPlaceId("missing"), false);
});

test("repository contract rejects missing methods", () => {
  assert.throws(() => assertRepositoryContract({ getBootstrap() {} }), /getFeed/);
});

test("data store exposes loading, ready, and retryable error states", async () => {
  const good = createAppDataStore({
    repository: { getBootstrap: async () => ({ places: [{ id: "place-1" }] }) }
  });
  assert.equal(good.getState().status, "idle");
  await good.load();
  assert.equal(good.getState().status, "ready");
  assert.equal(good.getSnapshot().places[0].id, "place-1");

  const bad = createAppDataStore({
    repository: { getBootstrap: async () => { throw new Error("offline"); } }
  });
  await assert.rejects(bad.load(), /offline/);
  assert.equal(bad.getState().status, "error");
  assert.equal(bad.getState().error.code, "DATA_BOOTSTRAP_FAILED");
});
