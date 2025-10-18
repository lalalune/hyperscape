import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './packages/plugin-hyperscape/tests/e2e',
  fullyParallel: false, // Run tests sequentially for better server stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid port conflicts
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5555',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'cd packages/server && bun run dev',
    url: 'http://localhost:5555',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  outputDir: 'test-results',
});

