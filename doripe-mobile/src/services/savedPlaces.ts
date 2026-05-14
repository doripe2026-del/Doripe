import type { SavedPlace } from "../domain/types";

function createId(accessCodeId: string, placeId: string): string {
  return `${accessCodeId}-${placeId}`;
}

export function addSavedPlace(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeId: string,
  createdAt: string,
): SavedPlace[] {
  const alreadySaved = savedPlaces.some(
    (savedPlace) => savedPlace.accessCodeId === accessCodeId && savedPlace.placeId === placeId,
  );

  if (alreadySaved) {
    return savedPlaces;
  }

  const userSavedPlaces = savedPlaces.filter(
    (savedPlace) => savedPlace.accessCodeId === accessCodeId,
  );

  return [
    ...savedPlaces,
    {
      id: createId(accessCodeId, placeId),
      accessCodeId,
      placeId,
      savedOrder: userSavedPlaces.length + 1,
      createdAt,
    },
  ];
}

export function removeSavedPlace(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeId: string,
): SavedPlace[] {
  const filtered = savedPlaces.filter(
    (savedPlace) =>
      !(savedPlace.accessCodeId === accessCodeId && savedPlace.placeId === placeId),
  );

  let order = 1;
  return filtered.map((savedPlace) => {
    if (savedPlace.accessCodeId !== accessCodeId) {
      return savedPlace;
    }

    const reordered = { ...savedPlace, savedOrder: order };
    order += 1;
    return reordered;
  });
}

export function getSavedPlaceIds(savedPlaces: SavedPlace[], accessCodeId: string): string[] {
  return savedPlaces
    .filter((savedPlace) => savedPlace.accessCodeId === accessCodeId)
    .sort((left, right) => left.savedOrder - right.savedOrder)
    .map((savedPlace) => savedPlace.placeId);
}
