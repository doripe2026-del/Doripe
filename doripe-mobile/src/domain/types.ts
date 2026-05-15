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
  | "place_seen"
  | "place_saved"
  | "place_skipped"
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
