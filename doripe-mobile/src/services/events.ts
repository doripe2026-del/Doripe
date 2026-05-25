import type { EventLog, EventName } from "../domain/types";
import { readJson, writeJson } from "./storage";
import { getCurrentUserId, supabase } from "./supabase";

export const EVENTS_STORAGE_KEY = "doripe.events";

type EventInput = {
  accessCodeId: string;
  eventName: EventName;
  placeId?: string;
  segmentFromPlaceId?: string;
  segmentToPlaceId?: string;
};

let eventWriteQueue = Promise.resolve();

function createEventId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function recordEvent(input: EventInput): Promise<EventLog> {
  const userId = await getCurrentUserId();

  if (supabase && userId) {
    const { data, error } = await supabase
      .from("event_logs")
      .insert({
        user_id: userId,
        event_name: input.eventName,
        place_id: input.placeId,
        segment_from_place_id: input.segmentFromPlaceId,
        segment_to_place_id: input.segmentToPlaceId,
      })
      .select("id, created_at")
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        accessCodeId: input.accessCodeId,
        eventName: input.eventName,
        placeId: input.placeId,
        segmentFromPlaceId: input.segmentFromPlaceId,
        segmentToPlaceId: input.segmentToPlaceId,
        createdAt: String(data.created_at),
      };
    }

    if (__DEV__) console.warn("Failed to record remote event", error);
  }

  const writeOperation = eventWriteQueue.then(async () => {
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
  });

  eventWriteQueue = writeOperation.then(
    () => undefined,
    () => undefined,
  );

  return writeOperation;
}

export async function listEvents(): Promise<EventLog[]> {
  return readJson<EventLog[]>(EVENTS_STORAGE_KEY, []);
}
