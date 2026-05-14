import type { SavedPlace } from "../../src/domain/types";
import { addSavedPlace, removeSavedPlace } from "../../src/services/savedPlaces";

describe("saved place operations", () => {
  it("adds a place once and preserves saved order", () => {
    const existing: SavedPlace[] = [];
    const next = addSavedPlace(existing, "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      accessCodeId: "access-0529",
      placeId: "hbc-001",
      savedOrder: 1,
    });
  });

  it("does not duplicate a saved place for the same access code", () => {
    const first = addSavedPlace([], "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");
    const second = addSavedPlace(first, "access-0529", "hbc-001", "2026-05-15T00:01:00.000Z");

    expect(second).toHaveLength(1);
  });

  it("removes a saved place and reorders remaining places", () => {
    const first = addSavedPlace([], "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");
    const second = addSavedPlace(first, "access-0529", "hbc-002", "2026-05-15T00:01:00.000Z");
    const next = removeSavedPlace(second, "access-0529", "hbc-001");

    expect(next).toHaveLength(1);
    expect(next[0].placeId).toBe("hbc-002");
    expect(next[0].savedOrder).toBe(1);
  });
});
