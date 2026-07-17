import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./booth-demo",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "desktop-safari", use: { ...devices["Desktop Safari"] } },
    { name: "android-chrome", use: { ...devices["Pixel 7"] } },
    { name: "iphone-safari", use: { ...devices["iPhone 14"] } },
    { name: "ipad-safari", use: { ...devices["iPad Pro 11"] } }
  ],
  webServer: {
    command: "npm run dev:landing",
    url: "http://127.0.0.1:4173/booth-demo/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
