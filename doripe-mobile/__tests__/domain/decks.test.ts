import { deckPlaces, decks, places, regions } from "../../src/domain/fixtures";
import {
  getActiveDecksByRegionId,
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

  it("returns deck place links in display order", () => {
    expect(
      getDeckPlaces(deckPlaces, "yongsan-solo-afternoon").map((deckPlace) => deckPlace.placeId),
    ).toEqual(["yongsan-001", "yongsan-002", "yongsan-003", "yongsan-004", "yongsan-005"]);
  });

  it("returns ready approved places for a deck in deck order", () => {
    expect(
      getPlacesForDeck(deckPlaces, places, "yongsan-solo-afternoon").map((place) => place.name),
    ).toEqual(["오월의 커피", "소월길 산책", "신흥시장 와인바", "후암동 전망", "해방촌 바"]);
  });
});
