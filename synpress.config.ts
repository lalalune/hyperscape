import { defineConfig, devices } from '@playwright/test';

const SEED_PHRASE = process.env.SEED_PHRASE || 'test test test test test test test test test test test junk';
export const PASSWORD = process.env.WALLET_PASSWORD || 'Tester@1234';

export default defineConfig({
  testDir: './tests/synpress',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5001',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

export const walletSetup = {
  PASSWORD,
  SEED_PHRASE
};

