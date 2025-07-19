import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src/suites',
  /* Run tests in files in parallel */
  fullyParallel: false, // Sequential for resource management
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1, // Single worker for resource management
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['line'],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshots */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Global timeout for tests */
    actionTimeout: 30000,
    navigationTimeout: 45000
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enhanced browser args for WebGL and testing
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--ignore-gpu-blacklist',
            '--use-gl=swiftshader', // Software WebGL renderer
            '--enable-webgl',
            '--enable-accelerated-2d-canvas',
            '--disable-dev-shm-usage' // For CI environments
          ],
          timeout: 60000
        },
        viewport: { width: 1920, height: 1080 }
      },
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'echo "Test servers managed by EnhancedTestRunner"',
    port: 3000,
    reuseExistingServer: true,
    timeout: 120000
  },

  /* Global test timeout */
  timeout: 120000,

  /* Test output directory */
  outputDir: 'test-results/test-output',

  /* Expect configuration */
  expect: {
    /* Maximum time expect() should wait for the condition to be met. */
    timeout: 10000,
    /* Maximum allowed pixel difference for screenshot comparisons */
    threshold: 0.2,
    /* Ignore antialiasing in screenshot comparisons */
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'rgb',
      animations: 'disabled'
    }
  }
})