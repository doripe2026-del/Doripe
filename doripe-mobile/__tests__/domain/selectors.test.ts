import { categories, neighborhoods, places } from "../../src/domain/fixtures";
import {
  getCategoryById,
  getNeighborhoodById,
  getReadyPlaces,
  getRouteSegments,
} from "../../src/domain/selectors";

describe("domain selectors", () => {
  it("resolves neighborhoods by id", () => {
    expect(getNeighborhoodById(neighborhoods, "yongsan_hbc")?.name).toBe("용산·후암·해방촌");
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
    const segments = getRouteSegments(["yongsan-001", "yongsan-002", "yongsan-003"], places);
    expect(segments).toEqual([
      { fromPlaceId: "yongsan-001", toPlaceId: "yongsan-002" },
      { fromPlaceId: "yongsan-002", toPlaceId: "yongsan-003" },
    ]);
  });
});
