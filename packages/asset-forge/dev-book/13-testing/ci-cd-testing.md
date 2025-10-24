# CI/CD Testing

## Overview

Asset Forge uses GitHub Actions for continuous integration and deployment. This guide covers test automation, pipeline configuration, and best practices for CI/CD testing.

## Table of Contents

1. [CI/CD Philosophy](#cicd-philosophy)
2. [Pipeline Architecture](#pipeline-architecture)
3. [GitHub Actions Configuration](#github-actions-configuration)
4. [Test Execution in CI](#test-execution-in-ci)
5. [Environment Configuration](#environment-configuration)
6. [Artifact Management](#artifact-management)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting CI Failures](#troubleshooting-ci-failures)

## CI/CD Philosophy

### Core Principles

1. **Fail Fast**: Run fastest tests first to provide quick feedback
2. **Parallel Execution**: Run independent tests concurrently
3. **Comprehensive Coverage**: Run all test types (unit, integration, E2E)
4. **Environment Parity**: CI environment mirrors production
5. **Automated Deployment**: Deploy automatically on test success

### Test Execution Order

```
1. Lint & TypeScript Check (1-2 minutes)
2. Unit Tests (2-3 minutes)
3. Integration Tests (5-10 minutes)
4. E2E Tests (10-15 minutes)
5. Build & Deploy (5-10 minutes)
```

## Pipeline Architecture

### Workflow Structure

```
┌─────────────────┐
│  Code Push      │
└────────┬────────┘
         │
    ┌────▼─────┐
    │  Lint    │ (Fast feedback)
    └────┬─────┘
         │
    ┌────▼─────┐
    │TypeCheck │ (Type safety)
    └────┬─────┘
         │
    ┌────▼─────┐
    │Unit Tests│ (Quick validation)
    └────┬─────┘
         │
    ┌────▼──────────┐
    │Integration    │ (Service tests)
    │  Tests        │
    └────┬──────────┘
         │
    ┌────▼──────────┐
    │   E2E Tests   │ (Full workflows)
    │  (Playwright) │
    └────┬──────────┘
         │
    ┌────▼─────┐
    │  Build   │ (Production bundle)
    └────┬─────┘
         │
    ┌────▼─────┐
    │  Deploy  │ (Vercel/Production)
    └──────────┘
```

## GitHub Actions Configuration

### Main CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Job 1: Linting and Type Checking (Fast feedback)
  lint:
    name: Lint & TypeCheck
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run typecheck

  # Job 2: Unit Tests (Quick validation)
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: lint

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json
          flags: unit
          name: unit-coverage

  # Job 3: Integration Tests (Service validation)
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: unit-tests

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          BLOB_READ_WRITE_TOKEN: ${{ secrets.TEST_BLOB_TOKEN }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-results
          path: test-results/
          retention-days: 7

  # Job 4: E2E Tests (Full workflows)
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: unit-tests

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build application
        run: npm run build

      - name: Run E2E tests
        run: npm run test
        env:
          CI: true

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: test-results/
          retention-days: 14

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-screenshots
          path: test-results/**/*.png
          retention-days: 7

      - name: Upload videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-videos
          path: test-results/**/*.webm
          retention-days: 7

  # Job 5: Build (Production bundle)
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [integration-tests, e2e-tests]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Check build size
        run: |
          BUILD_SIZE=$(du -sh dist | cut -f1)
          echo "Build size: $BUILD_SIZE"

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: dist/
          retention-days: 7
```

### Separate E2E Workflow for Different Browsers

```yaml
# .github/workflows/e2e-browsers.yml
name: E2E Browser Tests

on:
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  e2e-matrix:
    name: E2E Tests - ${{ matrix.browser }}
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox, webkit]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run E2E tests
        run: npx playwright test --project="${{ matrix.browser }}"

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-${{ matrix.browser }}
          path: test-results/
```

### Performance Testing Workflow

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  performance:
    name: Performance Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run performance benchmarks
        run: npm run test:performance

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-results
          path: test-results/performance/

      - name: Comment on PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs')
            const results = JSON.parse(fs.readFileSync('test-results/performance/results.json', 'utf8'))

            const comment = `
            ## Performance Test Results

            | Metric | Current | Baseline | Change |
            |--------|---------|----------|--------|
            | Asset Generation | ${results.assetGen}ms | 5000ms | ${results.assetGenChange} |
            | Voice Generation | ${results.voiceGen}ms | 3000ms | ${results.voiceGenChange} |
            | Manifest Processing | ${results.manifestProc}ms | 1000ms | ${results.manifestProcChange} |
            `

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            })
```

## Test Execution in CI

### Unit Test Configuration

```json
// package.json
{
  "scripts": {
    "test:unit": "vitest run --coverage",
    "test:unit:ci": "vitest run --coverage --reporter=junit --reporter=default",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test"
  }
}
```

### Vitest Configuration for CI

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use all CPU cores in CI
    maxConcurrency: process.env.CI ? 4 : 1,

    // Longer timeout in CI
    testTimeout: process.env.CI ? 30000 : 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/types/**',
        'src/**/*.d.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    },

    // CI-specific reporters
    reporters: process.env.CI
      ? ['default', 'junit', 'json']
      : ['default'],

    outputFile: {
      junit: './test-results/junit.xml',
      json: './test-results/results.json'
    }
  }
})
```

### Playwright Configuration for CI

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  // Run tests in parallel in CI
  workers: process.env.CI ? 2 : 1,

  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,

  // Shorter timeout in CI
  timeout: 60000,

  use: {
    // Collect traces only on failure in CI
    trace: 'retain-on-failure',

    // Take screenshots on failure
    screenshot: 'only-on-failure',

    // Record video on failure
    video: 'retain-on-failure',

    baseURL: process.env.CI
      ? 'http://localhost:3000'
      : 'http://localhost:3000'
  },

  // Start dev server automatically
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },

  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['github'] // GitHub Actions annotations
  ]
})
```

## Environment Configuration

### Secrets Management

Required secrets in GitHub Actions:

```yaml
# Repository Settings → Secrets and variables → Actions

# Testing
TEST_BLOB_TOKEN: <Vercel Blob read/write token for tests>
TEST_DATABASE_URL: <Test database connection string>

# External Services (Test/Staging)
OPENAI_API_KEY: <OpenAI test account key>
MESHY_API_KEY: <Meshy staging key>
ELEVENLABS_API_KEY: <ElevenLabs test key>

# Authentication
PRIVY_APP_ID: <Privy test app ID>
PRIVY_APP_SECRET: <Privy test secret>

# Deployment
VERCEL_TOKEN: <Vercel deployment token>
VERCEL_ORG_ID: <Vercel organization ID>
VERCEL_PROJECT_ID: <Vercel project ID>
```

### Environment Variables

```yaml
# In workflow file
env:
  NODE_ENV: test
  CI: true
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  BLOB_READ_WRITE_TOKEN: ${{ secrets.TEST_BLOB_TOKEN }}
```

### Test Environment File

```bash
# .env.test (checked into repo)
NODE_ENV=test
LOG_LEVEL=error
API_RATE_LIMIT=1000
ENABLE_ANALYTICS=false
```

## Artifact Management

### Test Results

```yaml
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: test-results-${{ github.run_id }}
    path: |
      test-results/
      coverage/
      playwright-report/
    retention-days: 14
```

### Failure Artifacts

```yaml
- name: Upload failure artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: failure-artifacts-${{ github.run_id }}
    path: |
      test-results/**/*.png
      test-results/**/*.webm
      test-results/trace*.zip
      logs/
    retention-days: 7
```

### Coverage Reports

```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    flags: integration
    name: integration-coverage
    fail_ci_if_error: true
```

## Performance Optimization

### Caching Dependencies

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm' # Automatically caches node_modules

- name: Cache Playwright browsers
  uses: actions/cache@v4
  id: playwright-cache
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: npx playwright install --with-deps
```

### Parallel Test Execution

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]

steps:
  - name: Run E2E tests (shard ${{ matrix.shard }})
    run: npx playwright test --shard=${{ matrix.shard }}/4
```

### Build Caching

```yaml
- name: Cache build output
  uses: actions/cache@v4
  with:
    path: |
      .next/cache
      dist/
    key: ${{ runner.os }}-build-${{ hashFiles('**/package-lock.json') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
```

## Troubleshooting CI Failures

### Common Issues

#### 1. Flaky Tests

```yaml
# Retry flaky tests automatically
- name: Run tests with retry
  run: npm run test -- --retries=2

# Or use Playwright's built-in retry
# playwright.config.ts
export default defineConfig({
  retries: process.env.CI ? 2 : 0
})
```

#### 2. Timeout Issues

```yaml
# Increase job timeout
jobs:
  e2e-tests:
    timeout-minutes: 30 # Increase from default 360

# Increase test timeout
- name: Run tests with longer timeout
  run: npm run test
  timeout-minutes: 20
```

#### 3. Memory Issues

```yaml
# Increase Node.js memory
- name: Run tests with more memory
  run: NODE_OPTIONS="--max-old-space-size=4096" npm run test
```

#### 4. Browser Crashes

```yaml
# Use xvfb for headless browser testing
- name: Run E2E tests
  run: xvfb-run --auto-servernum -- npm run test:e2e
```

### Debugging Strategies

#### Enable Debug Logs

```yaml
- name: Run tests with debug logs
  run: DEBUG=pw:api npm run test
  env:
    DEBUG: 'pw:api,pw:browser'
```

#### SSH into CI Runner

```yaml
# Use tmate for emergency debugging
- name: Setup tmate session
  if: failure()
  uses: mxschmitt/action-tmate@v3
  timeout-minutes: 15
```

#### Save Debug Artifacts

```yaml
- name: Save debug info
  if: failure()
  run: |
    npx playwright show-report --host 0.0.0.0
    npm run save-debug-info

- name: Upload debug artifacts
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: debug-info
    path: |
      debug/
      *.log
      test-results/
```

## Best Practices

### 1. Fast Feedback

```yaml
# Run fast tests first
jobs:
  lint: # 2 minutes
  unit: # 5 minutes
    needs: lint
  integration: # 10 minutes
    needs: unit
  e2e: # 15 minutes
    needs: unit
```

### 2. Fail Fast

```yaml
strategy:
  fail-fast: true # Stop other jobs if one fails
  matrix:
    browser: [chromium, firefox, webkit]
```

### 3. Conditional Execution

```yaml
# Skip E2E for documentation changes
- name: Run E2E tests
  if: "!contains(github.event.head_commit.message, '[skip-e2e]')"
  run: npm run test:e2e
```

### 4. Status Badges

```markdown
<!-- README.md -->
![CI Status](https://github.com/username/asset-forge/workflows/CI/badge.svg)
![Coverage](https://codecov.io/gh/username/asset-forge/branch/main/graph/badge.svg)
```

### 5. Notifications

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'CI tests failed! Check the workflow run.'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Conclusion

A well-configured CI/CD pipeline ensures code quality and reliability. By following these practices:

- Tests run automatically on every push
- Fast feedback helps developers iterate quickly
- Comprehensive test coverage catches issues early
- Artifacts and reports provide debugging information
- Automated deployment reduces manual errors

**Key Takeaways:**
- Structure pipeline for fast feedback
- Run tests in parallel when possible
- Cache dependencies for faster builds
- Collect artifacts for debugging failures
- Monitor performance over time
- Use retries for flaky tests
- Automate deployment after successful tests
