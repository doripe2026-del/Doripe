export type EntityStatus = "active" | "inactive";

export type Neighborhood = {
  id: string;
  name: string;
  displayOrder: number;
  status: EntityStatus;
};

export type Category = {
  id: string;
  name: string;
  displayOrder: number;
  status: EntityStatus;
};

export type Region = {
  id: "seongsu" | "yongsan_hbc" | "yeonnam_mangwon";
  name: string;
  shortName: string;
  displayOrder: number;
  status: EntityStatus;
  mapPin: { x: number; y: number };
};

export type Deck = {
  id: string;
  regionId: Region["id"];
  status: EntityStatus;
  title: string;
  shortCopy: string;
  tags: string[];
  tone: "sunset" | "lane" | "night" | "lookout";
  displayOrder: number;
};

export type DeckPlace = { deckId: string; placeId: string; displayOrder: number; featured?: boolean };

export type ActiveDeckSession = {
  accessCodeId: string;
  regionId: Region["id"];
  deckId: string;
  seenPlaceIds: string[];
  selectedPlaceIds: string[];
  skippedPlaceIds: string[];
  updatedAt: string;
};

export type Place = {
  id: string;
  status: "draft" | "ready" | "inactive";
  neighborhoodId: string;
  subArea: string;
  categoryId: string;
  name: string;
  shortCopy: string;
  moodTags: string[];
  bestFor: string[];
  timeTags: string[];
  routeRole: "start" | "middle" | "finish" | "pause";
  lat: number;
  lng: number;
  address: string;
  nearestStation: string;
  naverPlaceUrl: string;
  coverImageUrl: string;
  imageUrls: string[];
  imageCredit: "team" | "unsplash";
  photoQaStatus: "pending" | "approved" | "rejected";
  hoursText: string;
  priceHint: string;
  stayTimeMinutes: number;
  editorialNote: string;
  qaStatus: "draft" | "ready" | "needs_fix";
  lastCheckedAt: string;
};

export type AccessCode = {
  id: string;
  email: string;
  code: string;
  status: "active" | "inactive";
  cohort: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedPlace = {
  id: string;
  accessCodeId: string;
  placeId: string;
  savedOrder: number;
  createdAt: string;
};

export type EventName =
  | "code_verified"
  | "region_selected"
  | "deck_selected"
  | "deck_finished"
  | "place_seen"
  | "place_saved"
  | "place_skipped"
  | "place_gallery_opened"
  | "place_selection_confirmed"
  | "saved_list_opened"
  | "route_opened"
  | "route_segment_clicked";

export type EventLog = {
  id: string;
  accessCodeId: string;
  eventName: EventName;
  placeId?: string;
  segmentFromPlaceId?: string;
  segmentToPlaceId?: string;
  createdAt: string;
};

export type RouteSegment = {
  fromPlaceId: string;
  toPlaceId: string;
};
