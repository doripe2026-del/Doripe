import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRepositoryContract,
  createEmptyDataSnapshot,
  normalizeDataSnapshot
} from "../../public/app-preview/data/contracts.js";
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
