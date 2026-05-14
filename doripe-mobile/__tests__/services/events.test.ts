import AsyncStorage from "@react-native-async-storage/async-storage";

import { listEvents, recordEvent } from "../../src/services/events";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("event logging", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("records an event and lists it", async () => {
    await recordEvent({
      accessCodeId: "access-0529",
      eventName: "place_saved",
      placeId: "hbc-001",
    });

    const events = await listEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      accessCodeId: "access-0529",
      eventName: "place_saved",
      placeId: "hbc-001",
    });
  });

  it("persists concurrent event records without dropping writes", async () => {
    await Promise.all([
      recordEvent({
        accessCodeId: "access-0529",
        eventName: "place_seen",
        placeId: "hbc-001",
      }),
      recordEvent({
        accessCodeId: "access-0529",
        eventName: "place_saved",
        placeId: "hbc-002",
      }),
    ]);

    const events = await listEvents();

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.placeId)).toEqual(["hbc-001", "hbc-002"]);
  });

  it("does not store email or raw code fields", async () => {
    await recordEvent({
      accessCodeId: "access-0529",
      eventName: "code_verified",
    });

    const [event] = await listEvents();

    expect(event).not.toHaveProperty("email");
    expect(event).not.toHaveProperty("code");
  });
});
