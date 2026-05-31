import { defineConfig, devices } from "@playwright/test";

const CLIENT_PORT = 6333;
const SERVER_PORT = 6555;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: true,
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `env -u NO_COLOR PLAYWRIGHT_TEST=true PORT=${SERVER_PORT} AUTO_START_AGENTS=false SPAWN_MODEL_AGENTS=false DISABLE_AI=true DISABLE_BOTS=true DUEL_BETTING_ENABLED=false bun --preload ./src/shared/polyfills.ts ./dist/index.js`,
      cwd: "../server",
      port: SERVER_PORT,
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: `env -u NO_COLOR PLAYWRIGHT_TEST=true E2E_DISABLE_SHARED_WATCH=true PUBLIC_API_URL=http://localhost:${SERVER_PORT} PUBLIC_WS_URL=ws://localhost:${SERVER_PORT}/ws node node_modules/vite/bin/vite.js --host --port ${CLIENT_PORT} --strictPort --logLevel error`,
      url: `http://localhost:${CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 300000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
