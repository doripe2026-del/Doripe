import { defineConfig } from "@playwright/test";

const port = Number(process.env.APP_PREVIEW_PORT || 4173);

export default defineConfig({
  testDir: "./tests/app-preview",
  testMatch: ["**/*.spec.mjs"],
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  use: { baseURL: `http://127.0.0.1:${port}`, locale: "ko-KR", timezoneId: "Asia/Seoul" },
  webServer: {
    command: `PORT=${port} node scripts/serve-app-preview.mjs`,
    url: `http://127.0.0.1:${port}/app-preview/`,
    reuseExistingServer: true
  }
});
