import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,

  reporter: [["list"], ["json", { outputFile: "test-results.json" }], ["html"]],

  timeout: 180000, // 3 minutes for 3D operations

  expect: {
    timeout: 15000,
  },

  use: {
    // Client URL - defaults to 3333 standalone, respects VITE_PORT for jeju mode (5013)
    baseURL: process.env.HYPERSCAPE_URL || `http://localhost:${process.env.VITE_PORT || "3333"}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1920, height: 1080 },
    headless: false,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
