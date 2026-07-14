const WEIGHTS = Object.freeze({
  sendPotential: 25,
  saveValue: 15,
  brandFit: 15,
  timeliness: 10,
  photoQuality: 10,
  originalityPotential: 10,
  factCompleteness: 10,
  reusePermission: 5,
});

export function scoreCandidate(candidate, boosts = {}) {
  const base = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (candidate.scores[key] / 5) * weight,
    0,
  );
  return Math.max(0, Math.min(100, Math.round(base + (boosts[candidate.editorialAngle] ?? 0))));
}

export function isDuplicateCandidate(candidate, history, now = new Date()) {
  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  return history.some((item) =>
    Date.parse(item.createdAt) >= cutoff
      && item.placeIds.some((id) => candidate.placeIds.includes(id)),
  );
}

export function selectDailyCandidates(candidates, history, boosts = {}, limit = 2) {
  const normalizedLimit = Number.isFinite(limit) && limit > 0
    ? Math.min(2, Math.floor(limit))
    : 0;

  return candidates
    .filter((candidate) => !isDuplicateCandidate(candidate, history))
    .map((candidate) => ({
      ...candidate,
      totalScore: scoreCandidate(candidate, boosts),
    }))
    .filter(({ totalScore }) => totalScore >= 70)
    .sort((a, b) => b.totalScore - a.totalScore || a.id.localeCompare(b.id))
    .slice(0, normalizedLimit);
}
