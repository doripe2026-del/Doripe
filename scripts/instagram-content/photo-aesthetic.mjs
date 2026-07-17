export const PHOTO_ROLES = Object.freeze(["place", "people", "food_or_detail"]);
export const SHOT_TYPES = Object.freeze([
  "exterior",
  "interior",
  "landscape",
  "people_context",
  "food",
  "detail",
]);

const WEIGHTS = Object.freeze({
  naturalLight: 25,
  placeSpecificity: 25,
  composition: 20,
  livedExperience: 15,
  paletteCoherence: 15,
});
const TARGET_RATIOS = Object.freeze({
  place: 0.5,
  people: 0.25,
  food_or_detail: 0.25,
});

export function scorePhotoAesthetic(asset) {
  return Math.round(Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + (asset.aestheticScores[key] / 5) * weight,
    0,
  ));
}

export function summarizePhotoMix(assets) {
  const counts = { place: 0, people: 0, food_or_detail: 0 };
  for (const asset of assets) counts[asset.photoRole] += 1;
  const total = assets.length;
  const ratios = Object.fromEntries(Object.entries(counts).map(
    ([role, count]) => [role, total === 0 ? 0 : count / total],
  ));
  const warnings = Object.entries(TARGET_RATIOS)
    .filter(([role, target]) => Math.abs(ratios[role] - target) >= 0.25)
    .map(([role, target]) => `Photo mix ${role} is ${ratios[role]}, target ${target}`);
  return { counts, ratios, warnings };
}
