import { defineConfig, devices } from 'playwright/test'

/**
 * Playwright Configuration for Asset Forge Voice System
 *
 * Real browser testing following Hyperscape standards:
 * - No mocks or spies
 * - Real interactions with running application
 * - Visual verification with screenshots
 * - Multi-viewport testing
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Test parallelization
  fullyParallel: false, // Sequential for voice tests to avoid quota issues

  // Fail build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:3000',

    // Collect trace on failure
    trace: 'retain-on-failure',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
  },

  // Configure projects for different browsers and viewports
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },

    // Tablet viewport
    {
      name: 'Tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 }
      },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  // Output folder
  outputDir: 'test-results/artifacts',
})
