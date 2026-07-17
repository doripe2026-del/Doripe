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
const alphaTie = parseCandidate({
  ...base,
  id: "alpha-tie-route",
  placeIds: ["place-tie-a"],
});
const zuluTie = parseCandidate({
  ...base,
  id: "zulu-tie-route",
  placeIds: ["place-tie-z"],
});

test("scoring fixtures are parsed domestic candidates", () => {
  assert.deepEqual(
    [base, newEvent, boostedCollection].map(({ countryCode }) => countryCode),
    ["KR", "KR", "KR"],
  );
});

test("weighted score prioritizes sends and saves", () => {
  assert.equal(scoreCandidate(base, {}), 93);
});

test("optional editorial-angle performance boosts are applied and capped", () => {
  assert.equal(scoreCandidate(boostedCollection), 60);
  assert.equal(scoreCandidate(boostedCollection, { fresh_pairing: 10 }), 70);
  assert.equal(scoreCandidate(base, { route_story: 20 }), 100);
  assert.equal(scoreCandidate(boostedCollection, { fresh_pairing: -100 }), 0);
});

test("same place within 30 days is duplicate", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");
  const recentHistory = [{ createdAt: "2026-07-01T00:00:00.000Z", placeIds: ["place-b"] }];
  const oldHistory = [{ createdAt: "2026-06-13T23:59:59.999Z", placeIds: ["place-b"] }];

  assert.equal(isDuplicateCandidate(base, recentHistory, now), true);
  assert.equal(isDuplicateCandidate(base, oldHistory, now), false);
});

test("place overlap at the exact 30-day boundary is duplicate", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");
  const boundaryHistory = [{ createdAt: "2026-06-14T00:00:00.000Z", placeIds: ["place-b"] }];

  assert.equal(isDuplicateCandidate(base, boundaryHistory, now), true);
});

test("history entries with malformed dates are ignored", () => {
  const now = new Date("2026-07-14T00:00:00.000Z");
  const malformedHistory = [{ createdAt: "not-a-date", placeIds: ["place-b"] }];

  assert.equal(isDuplicateCandidate(base, malformedHistory, now), false);
});

test("daily selection returns at most two non-duplicates at or above 70", () => {
  assert.deepEqual(selectDailyCandidates([boostedCollection], [], {}, 2), []);
  assert.deepEqual(
    selectDailyCandidates([base, newEvent, boostedCollection], [], { fresh_pairing: 10 }, 10)
      .map(({ id }) => id),
    ["seongsu-weekend-route", "new-event"],
  );
});

test("non-positive daily limits return no candidates", () => {
  const candidates = [base, newEvent, alphaTie, zuluTie];

  assert.deepEqual(selectDailyCandidates(candidates, [], {}, -1), []);
  assert.deepEqual(selectDailyCandidates(candidates, [], {}, 0), []);
});

test("positive daily limits are floored and capped at two", () => {
  const candidates = [base, newEvent, alphaTie, zuluTie];

  assert.equal(selectDailyCandidates(candidates, [], {}, 1.9).length, 1);
  assert.equal(selectDailyCandidates(candidates, [], {}, 99).length, 2);
  assert.equal(selectDailyCandidates(candidates, [], {}).length, 2);
});

test("non-finite daily limits return no candidates", () => {
  const candidates = [base, newEvent, alphaTie, zuluTie];

  assert.deepEqual(selectDailyCandidates(candidates, [], {}, Number.NaN), []);
  assert.deepEqual(selectDailyCandidates(candidates, [], {}, Number.POSITIVE_INFINITY), []);
});

test("equal scores use candidate id as a deterministic tie-breaker", () => {
  const selected = selectDailyCandidates([zuluTie, alphaTie], [], {}, 2);

  assert.deepEqual(selected.map(({ id }) => id), ["alpha-tie-route", "zulu-tie-route"]);
});
