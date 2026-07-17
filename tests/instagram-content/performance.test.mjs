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
  placeType: "cafe+walk",
  editorialAngle: "route_story",
  reach: 1000,
  views: 1300,
  nonFollowerReachRate: 0.7,
  sends: 80,
  saves: 120,
  likes: 50,
  profileVisits: 20,
  follows: 8,
  sendsPerReach: 0.08,
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

test("performance feedback learns from sends per reach by editorial angle", () => {
  const rows = [
    performanceRow({ postId: "route-high", editorialAngle: "route_story", reach: 1000, sends: 120, sendsPerReach: 0.12 }),
    performanceRow({ postId: "route-mid", editorialAngle: "route_story", reach: 1000, sends: 80, sendsPerReach: 0.08 }),
    performanceRow({ postId: "pairing-mid", editorialAngle: "fresh_pairing", reach: 1000, sends: 50, sendsPerReach: 0.05 }),
    performanceRow({ postId: "window-low", editorialAngle: "timely_window", reach: 1000, sends: 49, sendsPerReach: 0.049 }),
  ];

  assert.deepEqual(buildPerformanceBoosts(rows), {
    route_story: 5,
    fresh_pairing: 2,
    timely_window: 0,
  });
});

test("zero reach contributes a zero ratio", () => {
  assert.deepEqual(
    buildPerformanceBoosts([performanceRow({ reach: 0, sends: 0, sendsPerReach: 0 })]),
    { route_story: 0 },
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
    /15 columns/i,
  );
  assert.throws(
    () => parsePerformanceCsv(`${PERFORMANCE_HEADER}\n${encode([...fields, "extra"])}\n`),
    /15 columns/i,
  );
});

test("parser and appender reject missing or non-finite numeric metrics", () => {
  const fields = JSON.parse(`[${encodedDataLine()}]`);

  for (const invalidReach of ["", "NaN", "Infinity"]) {
    const invalidFields = [...fields];
    invalidFields[6] = invalidReach;
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

test("appender derives and persists sends per reach", () => {
  const { sendsPerReach: _ignored, ...row } = performanceRow({ reach: 400, sends: 20 });
  const parsed = parsePerformanceCsv(appendPerformanceRow("", row));
  assert.equal(parsed[0].sendsPerReach, 0.05);
});

test("parser rejects a sends-per-reach value that contradicts sends and reach", () => {
  const csv = appendPerformanceRow("", performanceRow({ reach: 1000, sends: 80, sendsPerReach: 0.08 }));
  const fields = JSON.parse(`[${csv.trim().split("\n")[1]}]`);
  fields[14] = "0.5";
  const line = fields.map((value) => JSON.stringify(value)).join(",");
  assert.throws(() => parsePerformanceCsv(`${PERFORMANCE_HEADER}\n${line}\n`), /sends.*reach|ratio/i);
});

test("boost builder rejects non-finite metrics passed without parsing", () => {
  assert.throws(
    () => buildPerformanceBoosts([performanceRow({ sends: Number.POSITIVE_INFINITY })]),
    /finite numeric metric/i,
  );
});
