import type { Category, Neighborhood, Place, RouteSegment } from "./types";

export function getNeighborhoodById(
  neighborhoods: Neighborhood[],
  id: string,
): Neighborhood | undefined {
  return neighborhoods.find((neighborhood) => neighborhood.id === id);
}

export function getCategoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function getReadyPlaces(places: Place[]): Place[] {
  return places.filter(
    (place) => place.status === "ready" && place.photoQaStatus === "approved",
  );
}

export function getPlaceById(places: Place[], id: string): Place | undefined {
  return places.find((place) => place.id === id);
}

export function getRouteSegments(savedPlaceIds: string[], places: Place[]): RouteSegment[] {
  const existingPlaceIds = savedPlaceIds.filter((placeId) => getPlaceById(places, placeId));
  return existingPlaceIds.slice(0, -1).map((fromPlaceId, index) => ({
    fromPlaceId,
    toPlaceId: existingPlaceIds[index + 1],
  }));
}
