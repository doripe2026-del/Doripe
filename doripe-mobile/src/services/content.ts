import type { Category, Deck, DeckPlace, Neighborhood, Place, Region } from "../domain/types";
import {
  categories as fallbackCategories,
  deckPlaces as fallbackDeckPlaces,
  decks as fallbackDecks,
  neighborhoods as fallbackNeighborhoods,
  places as fallbackPlaces,
  regions as fallbackRegions,
} from "../domain/fixtures";
import { supabase } from "./supabase";

export type ContentBundle = {
  categories: Category[];
  deckPlaces: DeckPlace[];
  decks: Deck[];
  neighborhoods: Neighborhood[];
  places: Place[];
  regions: Region[];
  source: "local" | "remote";
};

export const fallbackContentBundle: ContentBundle = {
  categories: fallbackCategories,
  deckPlaces: fallbackDeckPlaces,
  decks: fallbackDecks,
  neighborhoods: fallbackNeighborhoods,
  places: fallbackPlaces,
  regions: fallbackRegions,
  source: "local",
};

type RemoteRegion = {
  id: string;
  name: string;
  short_name: string;
  display_order: number;
  status: "active" | "inactive";
  map_pin_x: number | null;
  map_pin_y: number | null;
};

type RemoteBaseEntity = {
  id: string;
  name: string;
  display_order: number;
  status: "active" | "inactive";
};

type RemoteDeck = {
  id: string;
  region_id: string;
  status: "active" | "inactive";
  title: string;
  short_copy: string;
  tags: string[];
  tone: Deck["tone"];
  display_order: number;
};

type RemoteDeckPlace = {
  deck_id: string;
  place_id: string;
  display_order: number;
  featured: boolean | null;
};

type RemotePlace = {
  id: string;
  status: Place["status"];
  neighborhood_id: string;
  sub_area: string;
  category_id: string;
  name: string;
  short_copy: string;
  mood_tags: string[];
  best_for: string[];
  time_tags: string[];
  route_role: Place["routeRole"];
  lat: number;
  lng: number;
  address: string;
  nearest_station: string;
  naver_place_url: string;
  cover_image_url: string;
  image_urls: string[];
  image_credit: Place["imageCredit"];
  photo_qa_status: Place["photoQaStatus"];
  hours_text: string;
  price_hint: string;
  stay_time_minutes: number;
  editorial_note: string;
  qa_status: Place["qaStatus"];
  last_checked_at: string | null;
};

function mapRegion(row: RemoteRegion): Region {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    displayOrder: row.display_order,
    status: row.status,
    mapPin: { x: Number(row.map_pin_x ?? 0), y: Number(row.map_pin_y ?? 0) },
  };
}

function mapBaseEntity(row: RemoteBaseEntity): Category | Neighborhood {
  return {
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
    status: row.status,
  };
}

function mapDeck(row: RemoteDeck): Deck {
  return {
    id: row.id,
    regionId: row.region_id,
    status: row.status,
    title: row.title,
    shortCopy: row.short_copy,
    tags: row.tags ?? [],
    tone: row.tone,
    displayOrder: row.display_order,
  };
}

function mapDeckPlace(row: RemoteDeckPlace): DeckPlace {
  return {
    deckId: row.deck_id,
    placeId: row.place_id,
    displayOrder: row.display_order,
    featured: Boolean(row.featured),
  };
}

function mapPlace(row: RemotePlace): Place {
  return {
    id: row.id,
    status: row.status,
    neighborhoodId: row.neighborhood_id,
    subArea: row.sub_area,
    categoryId: row.category_id,
    name: row.name,
    shortCopy: row.short_copy,
    moodTags: row.mood_tags ?? [],
    bestFor: row.best_for ?? [],
    timeTags: row.time_tags ?? [],
    routeRole: row.route_role,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    nearestStation: row.nearest_station,
    naverPlaceUrl: row.naver_place_url,
    coverImageUrl: row.cover_image_url,
    imageUrls: row.image_urls ?? [],
    imageCredit: row.image_credit,
    photoQaStatus: row.photo_qa_status,
    hoursText: row.hours_text,
    priceHint: row.price_hint,
    stayTimeMinutes: row.stay_time_minutes,
    editorialNote: row.editorial_note,
    qaStatus: row.qa_status,
    lastCheckedAt: row.last_checked_at ?? "",
  };
}

async function loadRemoteContentBundle(): Promise<ContentBundle> {
  if (!supabase) {
    return fallbackContentBundle;
  }

  const [regions, neighborhoods, categories, decks, deckPlaces, places] = await Promise.all([
    supabase.from("regions").select("*").order("display_order"),
    supabase.from("neighborhoods").select("*").order("display_order"),
    supabase.from("categories").select("*").order("display_order"),
    supabase.from("decks").select("*").order("display_order"),
    supabase.from("deck_places").select("*").order("display_order"),
    supabase.from("places").select("*").order("name"),
  ]);

  const firstError =
    regions.error ??
    neighborhoods.error ??
    categories.error ??
    decks.error ??
    deckPlaces.error ??
    places.error;

  if (firstError) {
    throw firstError;
  }

  return {
    regions: ((regions.data ?? []) as RemoteRegion[]).map(mapRegion),
    neighborhoods: ((neighborhoods.data ?? []) as RemoteBaseEntity[]).map(mapBaseEntity),
    categories: ((categories.data ?? []) as RemoteBaseEntity[]).map(mapBaseEntity),
    decks: ((decks.data ?? []) as RemoteDeck[]).map(mapDeck),
    deckPlaces: ((deckPlaces.data ?? []) as RemoteDeckPlace[]).map(mapDeckPlace),
    places: ((places.data ?? []) as RemotePlace[]).map(mapPlace),
    source: "remote",
  };
}

export async function getContentBundle(): Promise<ContentBundle> {
  try {
    return await loadRemoteContentBundle();
  } catch (error) {
    if (__DEV__) console.warn("Falling back to bundled Doripe content", error);
    return fallbackContentBundle;
  }
}
