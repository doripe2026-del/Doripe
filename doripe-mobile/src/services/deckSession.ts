import type { ActiveDeckSession, SavedPlace } from "../domain/types";
import { addSavedPlace } from "./savedPlaces";
import { readJson, writeJson } from "./storage";

const DECK_SESSION_STORAGE_KEY = "doripe.deckSessions";
const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

type DeckSessionRecord = Record<string, ActiveDeckSession>;

function uniqueInOrder(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

async function readDeckSessions(): Promise<DeckSessionRecord> {
  return readJson<DeckSessionRecord>(DECK_SESSION_STORAGE_KEY, {});
}

async function updateDeckSession(
  accessCodeId: string,
  updater: (session: ActiveDeckSession) => ActiveDeckSession,
): Promise<void> {
  const sessions = await readDeckSessions();
  const session = sessions[accessCodeId];

  if (!session) {
    return;
  }

  await writeJson(DECK_SESSION_STORAGE_KEY, {
    ...sessions,
    [accessCodeId]: updater(session),
  });
}

export async function getDeckSession(accessCodeId: string): Promise<ActiveDeckSession | null> {
  const sessions = await readDeckSessions();
  return sessions[accessCodeId] ?? null;
}

export async function setDeckSession(session: ActiveDeckSession): Promise<void> {
  const sessions = await readDeckSessions();

  await writeJson(DECK_SESSION_STORAGE_KEY, {
    ...sessions,
    [session.accessCodeId]: session,
  });
}

export async function addSelectedPlace(
  accessCodeId: string,
  placeId: string,
  updatedAt: string,
): Promise<void> {
  await updateDeckSession(accessCodeId, (session) => ({
    ...session,
    seenPlaceIds: uniqueInOrder([...session.seenPlaceIds, placeId]),
    selectedPlaceIds: uniqueInOrder([...session.selectedPlaceIds, placeId]),
    skippedPlaceIds: session.skippedPlaceIds.filter((skippedPlaceId) => skippedPlaceId !== placeId),
    updatedAt,
  }));
}

export async function addSkippedPlace(
  accessCodeId: string,
  placeId: string,
  updatedAt: string,
): Promise<void> {
  await updateDeckSession(accessCodeId, (session) => ({
    ...session,
    seenPlaceIds: uniqueInOrder([...session.seenPlaceIds, placeId]),
    selectedPlaceIds: session.selectedPlaceIds.filter(
      (selectedPlaceId) => selectedPlaceId !== placeId,
    ),
    skippedPlaceIds: uniqueInOrder([...session.skippedPlaceIds, placeId]),
    updatedAt,
  }));
}

export async function setSelectedPlaces(
  accessCodeId: string,
  selectedPlaceIds: string[],
  updatedAt: string,
): Promise<void> {
  await updateDeckSession(accessCodeId, (session) => ({
    ...session,
    selectedPlaceIds: uniqueInOrder(selectedPlaceIds),
    updatedAt,
  }));
}

export async function confirmSelectedPlaces(
  accessCodeId: string,
  selectedPlaceIds: string[],
  createdAt: string,
): Promise<void> {
  const savedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
  const nextSavedPlaces = selectedPlaceIds.reduce(
    (currentSavedPlaces, placeId) =>
      addSavedPlace(currentSavedPlaces, accessCodeId, placeId, createdAt),
    savedPlaces,
  );

  await writeJson(SAVED_PLACES_STORAGE_KEY, nextSavedPlaces);
}
