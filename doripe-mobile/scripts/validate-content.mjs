import { categories, neighborhoods, places } from "../src/domain/fixtures.ts";

const strict = process.argv.includes("--strict");

const requiredNeighborhoodIds = ["hbc", "mullae", "seochon"];
const requiredCategoryIds = ["cafe", "food", "bar", "shop", "culture", "walk"];
const errors = [];

function requireId(kind, ids, id) {
  if (!ids.has(id)) {
    errors.push(`Missing required ${kind} id: ${id}`);
  }
}

const neighborhoodIds = new Set(neighborhoods.map((neighborhood) => neighborhood.id));
const categoryIds = new Set(categories.map((category) => category.id));

for (const id of requiredNeighborhoodIds) {
  requireId("neighborhood", neighborhoodIds, id);
}

for (const id of requiredCategoryIds) {
  requireId("category", categoryIds, id);
}

const readyPlaces = places.filter((place) => place.status === "ready");

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
