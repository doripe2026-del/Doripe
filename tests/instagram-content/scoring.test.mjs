import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCandidate } from "../../scripts/instagram-content/contracts.mjs";
import {
  isDuplicateCandidate,
  scoreCandidate,
  selectDailyCandidates,
} from "../../scripts/instagram-content/scoring.mjs";

const fixtureUrl = new URL("./fixtures/candidates.json", import.meta.url);
const fixtureCandidates = JSON.parse(await readFile(fixtureUrl, "utf8"));
const [base, newEvent, boostedCollection] = fixtureCandidates.map((candidate) => parseCandidate(candidate));

test("scoring fixtures are parsed domestic candidates", () => {
  assert.deepEqual(
    [base, newEvent, boostedCollection].map(({ countryCode }) => countryCode),
    ["KR", "KR", "KR"],
  );
});

test("weighted score prioritizes sends and saves", () => {
  assert.equal(scoreCandidate(base, {}), 92);
});

test("optional performance boosts are applied and capped", () => {
  assert.equal(scoreCandidate(boostedCollection), 60);
  assert.equal(scoreCandidate(boostedCollection, { collection: 10 }), 70);
  assert.equal(scoreCandidate(base, { route: 20 }), 100);
});

test("same place within 30 days is duplicate", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");
  const recentHistory = [{ createdAt: "2026-07-01T00:00:00.000Z", placeIds: ["place-b"] }];
  const oldHistory = [{ createdAt: "2026-06-13T23:59:59.999Z", placeIds: ["place-b"] }];

  assert.equal(isDuplicateCandidate(base, recentHistory, now), true);
  assert.equal(isDuplicateCandidate(base, oldHistory, now), false);
});

test("daily selection returns at most two non-duplicates at or above 70", () => {
  assert.deepEqual(selectDailyCandidates([boostedCollection], [], {}, 2), []);
  assert.deepEqual(
    selectDailyCandidates([base, newEvent, boostedCollection], [], { collection: 10 }, 10)
      .map(({ id }) => id),
    ["seongsu-weekend-route", "new-event"],
  );
});
