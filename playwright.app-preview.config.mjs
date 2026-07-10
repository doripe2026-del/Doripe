import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/app-preview",
  testMatch: ["**/*.spec.mjs"],
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  use: { baseURL: "http://127.0.0.1:4173", locale: "ko-KR", timezoneId: "Asia/Seoul" },
  webServer: {
    command: "node scripts/serve-app-preview.mjs",
    url: "http://127.0.0.1:4173/app-preview/",
    reuseExistingServer: true
  }
});
