import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = resolve(__dirname, "../src/domain/fixtures.ts");
const fixturesText = readFileSync(fixturesPath, "utf8");
const strict = process.argv.includes("--strict");

const requiredNeighborhoodIds = ["hbc", "mullae", "seochon"];
const requiredCategoryIds = ["cafe", "food", "bar", "shop", "culture", "walk"];
const errors = [];

function requireId(kind, id) {
  const pattern = new RegExp(`\\bid\\s*:\\s*["']${id}["']`);
  if (!pattern.test(fixturesText)) {
    errors.push(`Missing required ${kind} id: ${id}`);
  }
}

for (const id of requiredNeighborhoodIds) {
  requireId("neighborhood", id);
}

for (const id of requiredCategoryIds) {
  requireId("category", id);
}

const placesMatch = fixturesText.match(/export\s+const\s+places[\s\S]*?=\s*\[([\s\S]*)\]\s*;/);

if (!placesMatch) {
  errors.push("Could not find exported places array in src/domain/fixtures.ts");
}

const placeBlocks = placesMatch?.[1].match(/\{\s*[\s\S]*?\n\s{2}\}/g) ?? [];
const readyPlaces = placeBlocks
  .filter((place) => /\bstatus\s*:\s*["']ready["']/.test(place))
  .map((place) => ({
    id: place.match(/\bid\s*:\s*["']([^"']+)["']/)?.[1] ?? "unknown-id",
    neighborhoodId: place.match(/\bneighborhoodId\s*:\s*["']([^"']+)["']/)?.[1] ?? "unknown-neighborhood",
    photoQaStatus: place.match(/\bphotoQaStatus\s*:\s*["']([^"']+)["']/)?.[1] ?? "missing",
  }));

const readyCount = readyPlaces.length;
const approvedReadyPlaces = readyPlaces.filter((place) => place.photoQaStatus === "approved");
const approvedReadyCount = approvedReadyPlaces.length;
const unapprovedReadyPlaces = readyPlaces.filter((place) => place.photoQaStatus !== "approved");

if (readyCount > approvedReadyCount) {
  const placeList = unapprovedReadyPlaces
    .map((place) => `${place.id} (${place.photoQaStatus})`)
    .join(", ");
  errors.push(`Every ready place must have photoQaStatus "approved". Unapproved ready places: ${placeList}`);
}

if (strict) {
  if (readyCount < 45) {
    errors.push(`Strict public-test mode requires at least 45 ready places; found ${readyCount}.`);
  }

  for (const neighborhoodId of requiredNeighborhoodIds) {
    const neighborhoodReadyCount = readyPlaces.filter(
      (place) => place.neighborhoodId === neighborhoodId,
    ).length;

    if (neighborhoodReadyCount < 15) {
      errors.push(
        `Strict public-test mode requires at least 15 ready places for ${neighborhoodId}; found ${neighborhoodReadyCount}.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Content validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (strict) {
  console.log(`Content validation passed for strict public-test data with ${readyCount} ready places.`);
} else {
  console.log(
    `Content validation passed for seed data with ${readyCount} ready places. Strict public-test minimum not enforced.`,
  );
}
