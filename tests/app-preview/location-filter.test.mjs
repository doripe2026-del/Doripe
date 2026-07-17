import assert from "node:assert/strict";
import test from "node:test";

import {
  distanceInKilometers,
  placeMatchesLocationFilter
} from "../../public/app-preview/data/location-filter.js";

test("distanceInKilometers returns a stable Seoul-scale distance", () => {
  const distance = distanceInKilometers(
    { latitude: 37.5624, longitude: 126.9257 },
    { latitude: 37.5665, longitude: 126.9780 }
  );

  assert.ok(distance > 4);
  assert.ok(distance < 6);
});

test("location filter defaults to all Seoul and limits places only after a pin is set", () => {
  const place = { latitude: 37.5624, longitude: 126.9257 };

  assert.equal(placeMatchesLocationFilter(place, {}), true);
  assert.equal(placeMatchesLocationFilter(place, { locationMode: "seoul" }), true);
  assert.equal(placeMatchesLocationFilter(place, {
    locationMode: "pin",
    locationCenter: { latitude: 37.5625, longitude: 126.9258 },
    locationRadiusKm: 1
  }), true);
  assert.equal(placeMatchesLocationFilter(place, {
    locationMode: "pin",
    locationCenter: { latitude: 37.5665, longitude: 126.9780 },
    locationRadiusKm: 1
  }), false);
});
