import { deckPlaces, decks, places, regions } from "../../src/domain/fixtures";
import {
  getActiveDecksByRegionId,
  getDeckById,
  getDeckPlaces,
  getPlacesForDeck,
  getRegionById,
} from "../../src/domain/selectors";

describe("deck domain fixtures", () => {
  it("defines the MVP regions with map pins", () => {
    expect(regions).toEqual([
      {
        id: "seongsu",
        name: "성수",
        shortName: "성수",
        displayOrder: 1,
        status: "active",
        mapPin: { x: 249, y: 296 },
      },
      {
        id: "yongsan_hbc",
        name: "용산·후암·해방촌",
        shortName: "용산·후암",
        displayOrder: 2,
        status: "active",
        mapPin: { x: 182, y: 421 },
      },
      {
        id: "yeonnam_mangwon",
        name: "연남·망원",
        shortName: "연남·망원",
        displayOrder: 3,
        status: "active",
        mapPin: { x: 82, y: 335 },
      },
    ]);
    expect(getRegionById(regions, "yongsan_hbc")?.shortName).toBe("용산·후암");
  });

  it("returns active decks by region in display order", () => {
    expect(getActiveDecksByRegionId(decks, "yongsan_hbc").map((deck) => deck.id)).toEqual([
      "yongsan-solo-afternoon",
      "yongsan-photo-lane",
      "yongsan-night",
    ]);
  });

  it("returns a deck by id", () => {
    expect(getDeckById(decks, "yongsan-solo-afternoon")?.title).toBe("창가에 앉는 카페");
  });

  it("returns deck place links in display order", () => {
    expect(
      getDeckPlaces(deckPlaces, "yongsan-solo-afternoon").map((deckPlace) => deckPlace.placeId),
    ).toEqual(["yongsan-001", "yongsan-002", "yongsan-003", "yongsan-004", "yongsan-005"]);
  });

  it("returns ready approved places for a deck in deck order", () => {
    expect(
      getPlacesForDeck(deckPlaces, places, "yongsan-solo-afternoon").map((place) => place.name),
    ).toEqual(["오르에르", "피크닉", "테디뵈르하우스", "음레코드", "해방식당"]);
  });

  it("links every active deck to at least one ready approved place", () => {
    const activeDecks = decks.filter((deck) => deck.status === "active");

    expect(activeDecks.length).toBeGreaterThan(0);
    for (const deck of activeDecks) {
      const linkedPlaces = getPlacesForDeck(deckPlaces, places, deck.id);

      expect(linkedPlaces.length).toBeGreaterThan(0);
      expect(
        linkedPlaces.every(
          (place) => place.status === "ready" && place.photoQaStatus === "approved",
        ),
      ).toBe(true);
    }
  });

  it("filters out non-ready and non-approved places for a deck", () => {
    const validPlace = places[0]!;
    const draftPlace: typeof validPlace = {
      ...validPlace,
      id: "draft-place",
      status: "draft",
    };
    const pendingPhotoPlace: typeof validPlace = {
      ...validPlace,
      id: "pending-photo",
      photoQaStatus: "pending",
    };
    const localPlaces = [validPlace, draftPlace, pendingPhotoPlace];
    const localDeckPlaces: typeof deckPlaces = [
      { deckId: "filter-test", placeId: validPlace.id, displayOrder: 1 },
      { deckId: "filter-test", placeId: draftPlace.id, displayOrder: 2 },
      { deckId: "filter-test", placeId: pendingPhotoPlace.id, displayOrder: 3 },
    ];

    expect(
      getPlacesForDeck(localDeckPlaces, localPlaces, "filter-test").map((place) => place.id),
    ).toEqual([validPlace.id]);
  });
});
