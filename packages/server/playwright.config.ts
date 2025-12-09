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
  // Auto-start server before tests and shut down after
  webServer: {
    command: "bun run start",
    port: 5555,
    timeout: 120 * 1000, // 2 minutes to start
    reuseExistingServer: !process.env.CI, // In CI, always start fresh server
    env: {
      NODE_ENV: "test",
      // In CI, disable Docker and explicitly pass DATABASE_URL
      // Also set CDN to server's own port (5555) since no external CDN is running
      // Locally, allow Docker to be used (default behavior)
      ...(process.env.CI && {
        USE_LOCAL_POSTGRES: "false",
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://hyperscape:hyperscape_test@localhost:5432/hyperscape_test",
        PUBLIC_CDN_URL: "http://localhost:5555",
      }),
    },
  },
});
