import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPerformanceRow,
  buildPerformanceBoosts,
  parsePerformanceCsv,
  PERFORMANCE_HEADER,
} from "../../scripts/instagram-content/performance.mjs";

const baseRow = {
  postId: "p1",
  postedAt: "2026-07-14",
  type: "route",
  topic: "seongsu",
  reach: 1000,
  views: 1300,
  nonFollowerReachRate: 0.7,
  sends: 80,
  saves: 120,
  likes: 50,
  profileVisits: 20,
  follows: 8,
};

function performanceRow(overrides) {
  return { ...baseRow, ...overrides };
}

function encodedDataLine(row = baseRow) {
  return appendPerformanceRow("", row).trim().split("\n")[1];
}

test("performance rows use the fixed header and JSON-safe quoting", () => {
  const row = performanceRow({ topic: "성수, \"서울\"\n코스" });
  const csv = appendPerformanceRow("", row);

  assert.equal(csv.split("\n")[0], PERFORMANCE_HEADER);
  assert.deepEqual(parsePerformanceCsv(csv), [row]);
});

test("performance feedback uses average send and save ratios", () => {
  const rows = [
    performanceRow({ postId: "route-high", type: "route", reach: 1000, sends: 100, saves: 100 }),
    performanceRow({ postId: "route-mid", type: "route", reach: 1000, sends: 50, saves: 50 }),
    performanceRow({ postId: "collection-mid", type: "collection", reach: 1000, sends: 30, saves: 50 }),
    performanceRow({ postId: "place-low", type: "place_event", reach: 1000, sends: 39, saves: 40 }),
  ];

  assert.deepEqual(buildPerformanceBoosts(rows), {
    route: 5,
    collection: 2,
    place_event: 0,
  });
});

test("zero reach contributes a zero ratio", () => {
  assert.deepEqual(
    buildPerformanceBoosts([performanceRow({ reach: 0, sends: 100, saves: 100 })]),
    { route: 0 },
  );
});

test("parser rejects unexpected headers and malformed JSON rows", () => {
  assert.throws(
    () => parsePerformanceCsv("wrong_header\n"),
    /unexpected.*header/i,
  );
  assert.throws(
    () => parsePerformanceCsv(`${PERFORMANCE_HEADER}\n\"unterminated\n`),
    /malformed.*row/i,
  );
});

test("parser rejects rows with missing or extra columns", () => {
  const fields = JSON.parse(`[${encodedDataLine()}]`);
  const encode = (values) => values.map((value) => JSON.stringify(value)).join(",");

  assert.throws(
    () => parsePerformanceCsv(`${PERFORMANCE_HEADER}\n${encode(fields.slice(0, -1))}\n`),
    /12 columns/i,
  );
  assert.throws(
    () => parsePerformanceCsv(`${PERFORMANCE_HEADER}\n${encode([...fields, "extra"])}\n`),
    /12 columns/i,
  );
});

test("parser and appender reject missing or non-finite numeric metrics", () => {
  const fields = JSON.parse(`[${encodedDataLine()}]`);

  for (const invalidReach of ["", "NaN", "Infinity"]) {
    const invalidFields = [...fields];
    invalidFields[4] = invalidReach;
    const line = invalidFields.map((value) => JSON.stringify(value)).join(",");
    assert.throws(
      () => parsePerformanceCsv(`${PERFORMANCE_HEADER}\n${line}\n`),
      /finite numeric metric/i,
    );
  }

  assert.throws(
    () => appendPerformanceRow("", performanceRow({ reach: Number.NaN })),
    /finite numeric metric/i,
  );
});

test("boost builder rejects non-finite metrics passed without parsing", () => {
  assert.throws(
    () => buildPerformanceBoosts([performanceRow({ sends: Number.POSITIVE_INFINITY })]),
    /finite numeric metric/i,
  );
});
