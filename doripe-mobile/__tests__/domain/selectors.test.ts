import { categories, neighborhoods, places } from "../../src/domain/fixtures";
import {
  getCategoryById,
  getNeighborhoodById,
  getReadyPlaces,
  getRouteSegments,
} from "../../src/domain/selectors";

describe("domain selectors", () => {
  it("resolves neighborhoods by id", () => {
    expect(getNeighborhoodById(neighborhoods, "hbc")?.name).toBe("후암동/해방촌");
  });

  it("resolves categories by id", () => {
    expect(getCategoryById(categories, "cafe")?.name).toBe("카페");
  });

  it("only returns ready places with approved photos", () => {
    const ready = getReadyPlaces(places);
    expect(ready.every((place) => place.status === "ready")).toBe(true);
    expect(ready.every((place) => place.photoQaStatus === "approved")).toBe(true);
  });

  it("derives route segments from saved place ids", () => {
    const segments = getRouteSegments(["hbc-001", "hbc-002", "hbc-003"], places);
    expect(segments).toEqual([
      { fromPlaceId: "hbc-001", toPlaceId: "hbc-002" },
      { fromPlaceId: "hbc-002", toPlaceId: "hbc-003" },
    ]);
  });
});
