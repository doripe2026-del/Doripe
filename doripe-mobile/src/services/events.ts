import type { EventLog, EventName } from "../domain/types";
import { readJson, writeJson } from "./storage";

export const EVENTS_STORAGE_KEY = "doripe.events";

type EventInput = {
  accessCodeId: string;
  eventName: EventName;
  placeId?: string;
  segmentFromPlaceId?: string;
  segmentToPlaceId?: string;
};

function createEventId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function recordEvent(input: EventInput): Promise<EventLog> {
  const existing = await readJson<EventLog[]>(EVENTS_STORAGE_KEY, []);
  const event: EventLog = {
    id: createEventId(),
    accessCodeId: input.accessCodeId,
    eventName: input.eventName,
    placeId: input.placeId,
    segmentFromPlaceId: input.segmentFromPlaceId,
    segmentToPlaceId: input.segmentToPlaceId,
    createdAt: new Date().toISOString(),
  };

  await writeJson(EVENTS_STORAGE_KEY, [...existing, event]);
  return event;
}

export async function listEvents(): Promise<EventLog[]> {
  return readJson<EventLog[]>(EVENTS_STORAGE_KEY, []);
}
