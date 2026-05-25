import type { SavedPlace } from "../domain/types";
import { getCurrentUserId, supabase } from "./supabase";
import { readJson, writeJson } from "./storage";

const SAVED_PLACES_STORAGE_KEY = "doripe.savedPlaces";

function createId(accessCodeId: string, placeId: string): string {
  return `${accessCodeId}-${placeId}`;
}

export function addSavedPlace(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeId: string,
  createdAt: string,
): SavedPlace[] {
  const alreadySaved = savedPlaces.some(
    (savedPlace) => savedPlace.accessCodeId === accessCodeId && savedPlace.placeId === placeId,
  );

  if (alreadySaved) {
    return savedPlaces;
  }

  const userSavedPlaces = savedPlaces.filter(
    (savedPlace) => savedPlace.accessCodeId === accessCodeId,
  );

  return [
    ...savedPlaces,
    {
      id: createId(accessCodeId, placeId),
      accessCodeId,
      placeId,
      savedOrder: userSavedPlaces.length + 1,
      createdAt,
    },
  ];
}

export function removeSavedPlace(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeId: string,
): SavedPlace[] {
  const filtered = savedPlaces.filter(
    (savedPlace) =>
      !(savedPlace.accessCodeId === accessCodeId && savedPlace.placeId === placeId),
  );

  let order = 1;
  return filtered.map((savedPlace) => {
    if (savedPlace.accessCodeId !== accessCodeId) {
      return savedPlace;
    }

    const reordered = { ...savedPlace, savedOrder: order };
    order += 1;
    return reordered;
  });
}

export function getSavedPlaceIds(savedPlaces: SavedPlace[], accessCodeId: string): string[] {
  return savedPlaces
    .filter((savedPlace) => savedPlace.accessCodeId === accessCodeId)
    .sort((left, right) => left.savedOrder - right.savedOrder)
    .map((savedPlace) => savedPlace.placeId);
}

export function replaceSavedPlacesForAccessCode(
  savedPlaces: SavedPlace[],
  accessCodeId: string,
  placeIds: string[],
  createdAt: string,
): SavedPlace[] {
  const otherSavedPlaces = savedPlaces.filter((savedPlace) => savedPlace.accessCodeId !== accessCodeId);
  const uniquePlaceIds = placeIds.filter((placeId, index) => placeIds.indexOf(placeId) === index);

  return [
    ...otherSavedPlaces,
    ...uniquePlaceIds.map((placeId, index) => ({
      id: createId(accessCodeId, placeId),
      accessCodeId,
      placeId,
      savedOrder: index + 1,
      createdAt,
    })),
  ];
}

export async function loadSavedPlaceIds(accessCodeId: string): Promise<string[]> {
  const userId = await getCurrentUserId();

  if (supabase && userId) {
    const { data, error } = await supabase
      .from("saved_places")
      .select("place_id")
      .eq("user_id", userId)
      .order("saved_order");

    if (!error) {
      return (data ?? []).map((row) => String(row.place_id));
    }

    if (__DEV__) console.warn("Failed to load remote saved places", error);
  }

  const stored = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
  return getSavedPlaceIds(stored, accessCodeId);
}

export async function savePlaceForCurrentUser(
  accessCodeId: string,
  placeId: string,
  createdAt: string,
): Promise<void> {
  const userId = await getCurrentUserId();

  if (supabase && userId) {
    const { count } = await supabase
      .from("saved_places")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { error } = await supabase.from("saved_places").upsert(
      {
        user_id: userId,
        place_id: placeId,
        saved_order: (count ?? 0) + 1,
        created_at: createdAt,
      },
      { onConflict: "user_id,place_id" },
    );

    if (!error) return;
    if (__DEV__) console.warn("Failed to save remote place", error);
  }

  const savedPlaces = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
  await writeJson(SAVED_PLACES_STORAGE_KEY, addSavedPlace(savedPlaces, accessCodeId, placeId, createdAt));
}

export async function removeSavedPlaceForCurrentUser(
  accessCodeId: string,
  placeId: string,
): Promise<void> {
  const userId = await getCurrentUserId();

  if (supabase && userId) {
    const { error } = await supabase.from("saved_places").delete().eq("user_id", userId).eq("place_id", placeId);
    if (!error) return;
    if (__DEV__) console.warn("Failed to remove remote saved place", error);
  }

  const stored = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
  await writeJson(SAVED_PLACES_STORAGE_KEY, removeSavedPlace(stored, accessCodeId, placeId));
}

export async function replaceSavedPlacesForCurrentUser(
  accessCodeId: string,
  placeIds: string[],
  createdAt: string,
): Promise<void> {
  const uniquePlaceIds = placeIds.filter((placeId, index) => placeIds.indexOf(placeId) === index);
  const userId = await getCurrentUserId();

  if (supabase && userId) {
    const rows = uniquePlaceIds.map((placeId, index) => ({
      user_id: userId,
      place_id: placeId,
      saved_order: index + 1,
      created_at: createdAt,
    }));
    const deleteResult = await supabase.from("saved_places").delete().eq("user_id", userId);
    const insertResult = rows.length
      ? await supabase.from("saved_places").insert(rows)
      : { error: null };

    if (!deleteResult.error && !insertResult.error) return;
    if (__DEV__) console.warn("Failed to replace remote saved places", deleteResult.error ?? insertResult.error);
  }

  const stored = await readJson<SavedPlace[]>(SAVED_PLACES_STORAGE_KEY, []);
  await writeJson(SAVED_PLACES_STORAGE_KEY, replaceSavedPlacesForAccessCode(stored, accessCodeId, uniquePlaceIds, createdAt));
}
