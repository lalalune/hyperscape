import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    trace: "on-first-retry",
  },
});
