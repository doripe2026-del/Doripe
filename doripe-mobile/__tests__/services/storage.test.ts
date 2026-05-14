import AsyncStorage from "@react-native-async-storage/async-storage";

import { readJson, writeJson } from "../../src/services/storage";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("json storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("reads a value written as json", async () => {
    const value = { accessCodeId: "access-0529", placeIds: ["hbc-001"] };

    await writeJson("doripe.test", value);

    await expect(readJson("doripe.test", { accessCodeId: "", placeIds: [] })).resolves.toEqual(
      value,
    );
  });

  it("returns fallback for invalid json", async () => {
    const fallback = { ready: false };

    await AsyncStorage.setItem("doripe.invalid", "{invalid");

    await expect(readJson("doripe.invalid", fallback)).resolves.toBe(fallback);
  });
});
