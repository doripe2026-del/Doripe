import type { SavedPlace } from "../../src/domain/types";
import { addSavedPlace, removeSavedPlace, replaceSavedPlacesForAccessCode } from "../../src/services/savedPlaces";

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

  it("reorders only the target access code when removing interleaved saved places", () => {
    const first = addSavedPlace([], "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");
    const second = addSavedPlace(first, "access-9999", "hbc-003", "2026-05-15T00:01:00.000Z");
    const third = addSavedPlace(second, "access-0529", "hbc-002", "2026-05-15T00:02:00.000Z");
    const fourth = addSavedPlace(third, "access-9999", "hbc-004", "2026-05-15T00:03:00.000Z");
    const next = removeSavedPlace(fourth, "access-0529", "hbc-001");

    expect(next).toHaveLength(3);
    expect(
      next
        .filter((savedPlace) => savedPlace.accessCodeId === "access-9999")
        .map((savedPlace) => savedPlace.savedOrder),
    ).toEqual([1, 2]);
    expect(next.find((savedPlace) => savedPlace.accessCodeId === "access-0529")).toMatchObject({
      placeId: "hbc-002",
      savedOrder: 1,
    });
  });

  it("replaces one user's saved route order without touching other users", () => {
    const first = addSavedPlace([], "access-0529", "hbc-001", "2026-05-15T00:00:00.000Z");
    const second = addSavedPlace(first, "access-9999", "hbc-003", "2026-05-15T00:01:00.000Z");
    const third = addSavedPlace(second, "access-0529", "hbc-002", "2026-05-15T00:02:00.000Z");
    const next = replaceSavedPlacesForAccessCode(
      third,
      "access-0529",
      ["hbc-002", "hbc-001", "hbc-002"],
      "2026-05-15T00:03:00.000Z",
    );

    expect(next.filter((savedPlace) => savedPlace.accessCodeId === "access-9999")).toHaveLength(1);
    expect(
      next
        .filter((savedPlace) => savedPlace.accessCodeId === "access-0529")
        .map((savedPlace) => [savedPlace.placeId, savedPlace.savedOrder]),
    ).toEqual([
      ["hbc-002", 1],
      ["hbc-001", 2],
    ]);
  });
});
