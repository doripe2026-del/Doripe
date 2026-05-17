import type { Category, Deck, DeckPlace, Neighborhood, Place, Region, RouteSegment } from "./types";

export function getNeighborhoodById(
  neighborhoods: Neighborhood[],
  id: string,
): Neighborhood | undefined {
  return neighborhoods.find((neighborhood) => neighborhood.id === id);
}

export function getCategoryById(categories: Category[], id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}

export function getRegionById(regions: Region[], id: string): Region | undefined {
  return regions.find((region) => region.id === id);
}

export function getActiveDecksByRegionId(decks: Deck[], regionId: Region["id"]): Deck[] {
  return decks
    .filter((deck) => deck.regionId === regionId && deck.status === "active")
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

export function getDeckById(decks: Deck[], id: string): Deck | undefined {
  return decks.find((deck) => deck.id === id);
}

export function getDeckPlaces(deckPlaces: DeckPlace[], deckId: string): DeckPlace[] {
  return deckPlaces
    .filter((deckPlace) => deckPlace.deckId === deckId)
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

export function getReadyPlaces(places: Place[]): Place[] {
  return places.filter(
    (place) => place.status === "ready" && place.photoQaStatus === "approved",
  );
}

export function getPlaceById(places: Place[], id: string): Place | undefined {
  return places.find((place) => place.id === id);
}

export function getPlacesForDeck(
  deckPlaces: DeckPlace[],
  places: Place[],
  deckId: string,
): Place[] {
  return getDeckPlaces(deckPlaces, deckId)
    .map((deckPlace) => getPlaceById(places, deckPlace.placeId))
    .filter(
      (place): place is Place =>
        place !== undefined && place.status === "ready" && place.photoQaStatus === "approved",
    );
}

export function getRouteSegments(savedPlaceIds: string[], places: Place[]): RouteSegment[] {
  const existingPlaceIds = savedPlaceIds.filter((placeId) => getPlaceById(places, placeId));
  return existingPlaceIds.slice(0, -1).map((fromPlaceId, index) => ({
    fromPlaceId,
    toPlaceId: existingPlaceIds[index + 1],
  }));
}
