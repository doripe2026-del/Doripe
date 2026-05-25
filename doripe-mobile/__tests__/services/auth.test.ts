import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AUTH_SESSION_STORAGE_KEY,
  getStoredAuthSession,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
} from "../../src/services/auth";

jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("auth service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("creates an email account and restores its session in tests", async () => {
    const result = await signUpWithEmail("Founder@Doripe.kr", "doripe123");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.email).toBe("founder@doripe.kr");
    expect(result.session.accessCodeId).toMatch(/^access-email-/);
    await expect(getStoredAuthSession()).resolves.toEqual(result.session);
  });

  it("rejects a wrong email password", async () => {
    await signUpWithEmail("founder@doripe.kr", "doripe123");

    await expect(signInWithEmail("founder@doripe.kr", "wrongpass")).resolves.toEqual({
      ok: false,
      message: "비밀번호가 맞지 않아요.",
    });
  });

  it("stores Kakao provider sessions in tests", async () => {
    const result = await signInWithProvider("kakao");

    expect(result.ok).toBe(true);
    await expect(AsyncStorage.getItem(AUTH_SESSION_STORAGE_KEY)).resolves.toContain("access-social-kakao");
  });
});
