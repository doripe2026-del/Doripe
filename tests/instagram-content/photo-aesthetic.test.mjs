import assert from "node:assert/strict";
import test from "node:test";
import {
  scorePhotoAesthetic,
  summarizePhotoMix,
} from "../../scripts/instagram-content/photo-aesthetic.mjs";

const photo = (overrides = {}) => ({
  id: "photo-a",
  photoRole: "place",
  shotType: "interior",
  aestheticScores: {
    naturalLight: 4,
    placeSpecificity: 5,
    composition: 4,
    livedExperience: 3,
    paletteCoherence: 4,
  },
  ...overrides,
});

test("photo aesthetic score uses the approved 25/25/20/15/15 weights", () => {
  assert.equal(scorePhotoAesthetic(photo()), 82);
  assert.equal(scorePhotoAesthetic(photo({
    aestheticScores: {
      naturalLight: 5,
      placeSpecificity: 5,
      composition: 5,
      livedExperience: 5,
      paletteCoherence: 5,
    },
  })), 100);
});

test("photo mix reports the approved 50/25/25 target", () => {
  const result = summarizePhotoMix([
    photo({ id: "p1", photoRole: "place" }),
    photo({ id: "p2", photoRole: "place" }),
    photo({ id: "person", photoRole: "people" }),
    photo({ id: "detail", photoRole: "food_or_detail" }),
  ]);
  assert.deepEqual(result.counts, { place: 2, people: 1, food_or_detail: 1 });
  assert.deepEqual(result.ratios, { place: 0.5, people: 0.25, food_or_detail: 0.25 });
  assert.deepEqual(result.warnings, []);
});
