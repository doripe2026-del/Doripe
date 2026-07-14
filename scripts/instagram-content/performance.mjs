export const PERFORMANCE_HEADER = "post_id,posted_at,type,topic,place_type,editorial_angle,reach,views,non_follower_reach_rate,sends,saves,likes,profile_visits,follows,sends_per_reach";

const KEYS = Object.freeze([
  "postId",
  "postedAt",
  "type",
  "topic",
  "placeType",
  "editorialAngle",
  "reach",
  "views",
  "nonFollowerReachRate",
  "sends",
  "saves",
  "likes",
  "profileVisits",
  "follows",
  "sendsPerReach",
]);
const TEXT_KEYS = Object.freeze(KEYS.slice(0, 6));
const NUMERIC_KEYS = Object.freeze(KEYS.slice(6));

function expectedSendsPerReach(row) {
  return row.reach > 0 ? row.sends / row.reach : 0;
}

function requireConsistentSendRatio(row) {
  const expected = expectedSendsPerReach(row);
  if (Math.abs(row.sendsPerReach - expected) > 1e-9) {
    throw new Error("Performance row sends per reach ratio contradicts sends and reach");
  }
}

function requireFiniteMetrics(row) {
  for (const key of NUMERIC_KEYS) {
    if (typeof row?.[key] !== "number" || !Number.isFinite(row[key])) {
      throw new Error(`Performance row requires a finite numeric metric: ${key}`);
    }
  }
}

function requireTextFields(row) {
  for (const key of TEXT_KEYS) {
    if (typeof row?.[key] !== "string" || !row[key].trim()) {
      throw new Error(`Performance row requires a text field: ${key}`);
    }
  }
}

function parseDataLine(line, lineNumber) {
  let values;
  try {
    values = JSON.parse(`[${line}]`);
  } catch {
    throw new Error(`Malformed performance.csv row ${lineNumber}`);
  }

  if (values.length !== KEYS.length) {
    throw new Error(`Performance row ${lineNumber} must contain exactly 15 columns`);
  }
  if (values.some((value) => typeof value !== "string")) {
    throw new Error(`Malformed performance.csv row ${lineNumber}: columns must be JSON strings`);
  }

  const row = Object.fromEntries(TEXT_KEYS.map((key, index) => [key, values[index]]));
  for (const [offset, key] of NUMERIC_KEYS.entries()) {
    const value = values[TEXT_KEYS.length + offset];
    if (!value.trim()) {
      throw new Error(`Performance row ${lineNumber} requires a finite numeric metric: ${key}`);
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Performance row ${lineNumber} requires a finite numeric metric: ${key}`);
    }
    row[key] = numericValue;
  }

  requireTextFields(row);
  requireConsistentSendRatio(row);
  return row;
}

export function parsePerformanceCsv(text) {
  if (typeof text !== "string") throw new Error("performance.csv text must be a string");
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  if (lines[0] !== PERFORMANCE_HEADER) {
    throw new Error("Unexpected performance.csv header");
  }

  return lines
    .slice(1)
    .map((line, index) => ({ line, lineNumber: index + 2 }))
    .filter(({ line }) => line.trim())
    .map(({ line, lineNumber }) => parseDataLine(line, lineNumber));
}

export function appendPerformanceRow(text, row) {
  const normalizedRow = {
    ...row,
    sendsPerReach: row.reach > 0 ? row.sends / row.reach : 0,
  };
  requireTextFields(normalizedRow);
  requireFiniteMetrics(normalizedRow);

  const existing = typeof text === "string" ? text.trim() : "";
  if (existing) parsePerformanceCsv(existing);

  const values = KEYS.map((key) => JSON.stringify(String(normalizedRow[key])));
  return `${existing || PERFORMANCE_HEADER}\n${values.join(",")}\n`;
}

export function buildPerformanceBoosts(rows) {
  if (!Array.isArray(rows)) throw new Error("Performance rows must be an array");

  const grouped = new Map();
  for (const row of rows) {
    requireTextFields(row);
    requireFiniteMetrics(row);
    requireConsistentSendRatio(row);
    const ratios = grouped.get(row.editorialAngle) ?? [];
    ratios.push(row.sendsPerReach);
    grouped.set(row.editorialAngle, ratios);
  }

  const boosts = [];
  for (const [editorialAngle, ratios] of grouped) {
    const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    boosts.push([editorialAngle, average >= 0.1 ? 5 : average >= 0.05 ? 2 : 0]);
  }
  return Object.fromEntries(boosts);
}
