import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ActiveDeckSession, SavedPlace } from "../../src/domain/types";
import {
  addSelectedPlace,
  addSkippedPlace,
  confirmSelectedPlaces,
  getDeckSession,
  setDeckSession,
} from "../../src/services/deckSession";
import { getSavedPlaceIds } from "../../src/services/savedPlaces";
import { readJson } from "../../src/services/storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const firstSession: ActiveDeckSession = {
  accessCodeId: "access-0529",
  regionId: "yongsan_hbc",
  deckId: "hbc-date-night",
  seenPlaceIds: [],
  selectedPlaceIds: [],
  skippedPlaceIds: [],
  updatedAt: "2026-05-18T00:00:00.000Z",
};

const secondSession: ActiveDeckSession = {
  accessCodeId: "access-9999",
  regionId: "seongsu",
  deckId: "seongsu-cafe",
  seenPlaceIds: ["seongsu-001"],
  selectedPlaceIds: ["seongsu-001"],
  skippedPlaceIds: [],
  updatedAt: "2026-05-18T00:01:00.000Z",
};

describe("deck session storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("stores one active session per access code", async () => {
    await setDeckSession(firstSession);
    await setDeckSession(secondSession);
    await setDeckSession({
      ...firstSession,
      selectedPlaceIds: ["hbc-001"],
      updatedAt: "2026-05-18T00:02:00.000Z",
    });

    await expect(getDeckSession("access-0529")).resolves.toMatchObject({
      accessCodeId: "access-0529",
      selectedPlaceIds: ["hbc-001"],
      updatedAt: "2026-05-18T00:02:00.000Z",
    });
    await expect(getDeckSession("access-9999")).resolves.toEqual(secondSession);

    const stored = await readJson<Record<string, ActiveDeckSession>>("doripe.deckSessions", {});
    expect(Object.keys(stored).sort()).toEqual(["access-0529", "access-9999"]);
  });

  it("adds selected and skipped seen IDs without duplicates and moves between lists", async () => {
    await setDeckSession({
      ...firstSession,
      seenPlaceIds: ["hbc-001"],
      selectedPlaceIds: ["hbc-001"],
      skippedPlaceIds: ["hbc-002"],
    });

    await addSelectedPlace("access-0529", "hbc-002", "2026-05-18T00:03:00.000Z");
    await addSelectedPlace("access-0529", "hbc-002", "2026-05-18T00:04:00.000Z");
    await addSkippedPlace("access-0529", "hbc-001", "2026-05-18T00:05:00.000Z");
    await addSkippedPlace("access-0529", "hbc-001", "2026-05-18T00:06:00.000Z");

    await expect(getDeckSession("access-0529")).resolves.toMatchObject({
      seenPlaceIds: ["hbc-001", "hbc-002"],
      selectedPlaceIds: ["hbc-002"],
      skippedPlaceIds: ["hbc-001"],
      updatedAt: "2026-05-18T00:06:00.000Z",
    });
  });

  it("persists confirmed selected places and returns their saved order", async () => {
    const existingSavedPlaces: SavedPlace[] = [
      {
        id: "access-0529-hbc-002",
        accessCodeId: "access-0529",
        placeId: "hbc-002",
        savedOrder: 1,
        createdAt: "2026-05-18T00:00:00.000Z",
      },
    ];
    await AsyncStorage.setItem("doripe.savedPlaces", JSON.stringify(existingSavedPlaces));

    await confirmSelectedPlaces(
      "access-0529",
      ["hbc-002", "hbc-001", "hbc-003", "hbc-001"],
      "2026-05-18T00:07:00.000Z",
    );

    const savedPlaces = await readJson<SavedPlace[]>("doripe.savedPlaces", []);
    expect(getSavedPlaceIds(savedPlaces, "access-0529")).toEqual([
      "hbc-002",
      "hbc-001",
      "hbc-003",
    ]);
    expect(savedPlaces).toHaveLength(3);
  });
});
