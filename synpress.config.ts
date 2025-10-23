import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/wallet',
  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results-synpress.json' }],
  ],

  timeout: 180000,

  expect: {
    timeout: 15000,
  },

  use: {
    baseURL: 'http://localhost:3333',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'echo "Hyperscape already running on 3333"',
    port: 3333,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
