# Test Troubleshooting Guide

## Overview

This comprehensive guide helps debug and resolve common testing issues in Asset Forge. It covers error diagnosis, resolution strategies, and prevention techniques.

## Table of Contents

1. [Diagnostic Approach](#diagnostic-approach)
2. [Common Test Failures](#common-test-failures)
3. [Playwright-Specific Issues](#playwright-specific-issues)
4. [Three.js Testing Issues](#threejs-testing-issues)
5. [Database and Storage Issues](#database-and-storage-issues)
6. [Mock and Stub Issues](#mock-and-stub-issues)
7. [CI/CD-Specific Issues](#cicd-specific-issues)
8. [Performance Issues](#performance-issues)
9. [Prevention Strategies](#prevention-strategies)

## Diagnostic Approach

### Step 1: Identify the Failure Type

```typescript
// Categorize the failure
const failureTypes = {
  timeout: 'Test exceeded time limit',
  assertion: 'Assertion failed',
  error: 'Uncaught exception',
  flaky: 'Intermittent failure',
  environment: 'CI-only or local-only failure'
}
```

### Step 2: Gather Information

```bash
# Run test with verbose output
npm test -- --reporter=verbose

# Run single failing test
npm test -- tests/e2e/voice-standalone.spec.ts

# Run with debug mode
DEBUG=pw:api npm test

# Run in headed mode to see browser
npm test -- --headed

# Run with trace
npm test -- --trace on
```

### Step 3: Analyze Artifacts

```bash
# View Playwright report
npx playwright show-report

# View trace file
npx playwright show-trace test-results/trace.zip

# Check screenshots
open test-results/**/*.png

# Check videos
open test-results/**/*.webm

# Check logs
cat logs/test-*.log
```

## Common Test Failures

### 1. Timeout Errors

#### Problem

```
Error: Test timeout of 30000ms exceeded
```

#### Causes

- Slow network requests
- Infinite loops
- Waiting for conditions that never occur
- Resource-intensive operations

#### Solutions

```typescript
// Increase timeout for specific test
it('should complete slow operation', async () => {
  // Test implementation
}, 60000) // 60 second timeout

// Use appropriate wait strategies
// ❌ BAD: Fixed delay
await page.waitForTimeout(10000)

// ✅ GOOD: Wait for specific condition
await page.waitForSelector('#model-loaded', { timeout: 30000 })

// ✅ GOOD: Poll with timeout
await waitForCondition(
  async () => {
    const status = await getStatus(id)
    return status === 'completed'
  },
  30000, // 30s timeout
  1000   // 1s interval
)
```

#### Prevention

```typescript
// Set reasonable timeouts globally
// playwright.config.ts
export default defineConfig({
  timeout: 60000, // 1 minute default
  expect: {
    timeout: 5000 // 5 seconds for assertions
  }
})

// Add timeout guards
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

// Usage
const result = await withTimeout(
  generateAsset(config),
  30000,
  'Asset generation timed out after 30 seconds'
)
```

### 2. Assertion Failures

#### Problem

```
AssertionError: expected 'pending' to equal 'completed'
```

#### Causes

- Race conditions
- Incorrect test assumptions
- State pollution from previous tests
- Timing issues

#### Solutions

```typescript
// Wait for state changes
// ❌ BAD: Check immediately
expect(asset.status).toBe('completed')

// ✅ GOOD: Wait for status change
await expect(async () => {
  const asset = await getAsset(id)
  return asset.status
}).resolves.toBe('completed')

// Use polling for async operations
let status = 'pending'
let attempts = 0

while (status === 'pending' && attempts < 30) {
  await new Promise(resolve => setTimeout(resolve, 1000))
  const asset = await getAsset(id)
  status = asset.status
  attempts++
}

expect(status).toBe('completed')
```

#### Prevention

```typescript
// Use Playwright's auto-waiting
await expect(page.locator('[data-testid="status"]')).toHaveText('Completed')

// Create assertion helpers
async function expectEventually<T>(
  getFn: () => Promise<T>,
  expected: T,
  options = { timeout: 10000, interval: 500 }
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < options.timeout) {
    const actual = await getFn()
    if (actual === expected) return

    await new Promise(resolve => setTimeout(resolve, options.interval))
  }

  const actual = await getFn()
  expect(actual).toBe(expected)
}

// Usage
await expectEventually(
  async () => (await getAsset(id)).status,
  'completed'
)
```

### 3. Flaky Tests

#### Problem

Tests pass sometimes and fail other times without code changes.

#### Causes

- Race conditions
- Non-deterministic behavior (random, time-dependent)
- External service dependencies
- Shared state between tests
- Animation timing

#### Solutions

```typescript
// Fix race conditions
// ❌ BAD: Assumes order
const results = await Promise.all([
  operation1(),
  operation2()
])
// Results order is not guaranteed!

// ✅ GOOD: Handle any order
const [result1, result2] = await Promise.all([
  operation1(),
  operation2()
])
const sortedResults = [result1, result2].sort((a, b) => a.id.localeCompare(b.id))

// Fix time-dependent code
// ❌ BAD: Uses real time
const timestamp = Date.now()

// ✅ GOOD: Mock time
import { vi } from 'vitest'
vi.useFakeTimers()
vi.setSystemTime(new Date('2024-01-01'))

// Fix random behavior
// ❌ BAD: Uses Math.random()
const value = Math.random()

// ✅ GOOD: Seed random for tests
function seedRandom(seed: number) {
  let value = seed
  Math.random = () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

beforeEach(() => seedRandom(12345))
```

#### Detection

```bash
# Run test multiple times to detect flakiness
for i in {1..10}; do
  echo "Run $i"
  npm test -- tests/flaky.spec.ts || echo "FAILED"
done

# Use Playwright's repeat-each
npx playwright test --repeat-each=10
```

### 4. State Pollution

#### Problem

Tests fail when run together but pass in isolation.

#### Causes

- Shared global state
- Database not reset between tests
- File system artifacts
- Event listeners not cleaned up

#### Solutions

```typescript
// Reset state between tests
describe('Feature tests', () => {
  beforeEach(async () => {
    // Reset database
    await db.migrate.rollback()
    await db.migrate.latest()

    // Clear caches
    cache.clear()

    // Reset mocks
    vi.clearAllMocks()

    // Remove event listeners
    orchestrator.removeAllListeners()
  })

  afterEach(async () => {
    // Cleanup files
    await fs.rm('./temp', { recursive: true, force: true })

    // Disconnect services
    await service.disconnect()
  })
})

// Use test isolation
test.describe.configure({ mode: 'parallel' }) // Each test in new context
```

## Playwright-Specific Issues

### 1. Element Not Found

#### Problem

```
Error: locator.click: Target closed
Error: locator.textContent: Element is not attached
```

#### Solutions

```typescript
// Wait for element to be ready
await page.waitForSelector('[data-testid="button"]', { state: 'visible' })

// Use auto-waiting locators
const button = page.locator('[data-testid="button"]')
await button.waitFor({ state: 'visible' })
await button.click()

// Handle dynamic content
await page.waitForFunction(() => {
  const element = document.querySelector('[data-testid="content"]')
  return element && element.textContent?.length > 0
})

// Retry on transient failures
async function clickWithRetry(locator: Locator, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await locator.click()
      return
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}
```

### 2. Navigation Timing

#### Problem

```
Error: page.goto: Navigation timeout exceeded
```

#### Solutions

```typescript
// Increase navigation timeout
await page.goto('/voice-generator', {
  timeout: 60000,
  waitUntil: 'networkidle' // or 'load', 'domcontentloaded'
})

// Wait for specific ready state
await page.goto('/asset-viewer')
await page.waitForFunction(() => {
  return window.sceneReady === true
})

// Handle slow loading resources
await page.route('**/*.{png,jpg,jpeg,gif}', route => {
  route.fulfill({ status: 200, body: '' })
})
```

### 3. Screenshot Differences

#### Problem

Visual regression tests fail due to minor differences.

#### Solutions

```typescript
// Increase threshold for acceptable differences
expect(screenshot).toMatchSnapshot('baseline.png', {
  threshold: 0.05, // 5% difference allowed
  maxDiffPixels: 500
})

// Hide dynamic content
await page.evaluate(() => {
  // Hide timestamps
  document.querySelectorAll('[data-timestamp]').forEach(el => {
    (el as HTMLElement).style.display = 'none'
  })

  // Hide animations
  document.querySelectorAll('*').forEach(el => {
    (el as HTMLElement).style.animation = 'none'
    (el as HTMLElement).style.transition = 'none'
  })
})

// Mask dynamic regions
await page.screenshot({
  mask: [
    page.locator('[data-testid="timestamp"]'),
    page.locator('[data-testid="user-avatar"]')
  ]
})
```

## Three.js Testing Issues

### 1. Scene Not Loaded

#### Problem

```
Error: Cannot read property 'children' of undefined
```

#### Solutions

```typescript
// Wait for Three.js scene to initialize
await page.waitForFunction(() => {
  return window.scene &&
         window.scene.children.length > 0 &&
         window.renderer &&
         window.camera
})

// Verify scene structure
const sceneData = await page.evaluate(() => {
  if (!window.scene) {
    throw new Error('Scene not initialized')
  }

  return {
    childCount: window.scene.children.length,
    hasRenderer: !!window.renderer,
    hasCamera: !!window.camera
  }
})

expect(sceneData.childCount).toBeGreaterThan(0)
```

### 2. WebGL Context Issues

#### Problem

```
Error: Could not create WebGL context
```

#### Solutions

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    launchOptions: {
      args: [
        '--enable-webgl',
        '--use-gl=swiftshader', // Software renderer
        '--ignore-gpu-blocklist'
      ]
    }
  }
})

// Check WebGL support in test
await page.evaluate(() => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

  if (!gl) {
    throw new Error('WebGL not supported')
  }
})
```

### 3. Model Loading Failures

#### Problem

Models fail to load in tests.

#### Solutions

```typescript
// Mock model loading
await page.route('**/*.glb', async route => {
  // Serve test model
  const testModel = await fs.readFile('./fixtures/test-model.glb')
  await route.fulfill({
    status: 200,
    contentType: 'model/gltf-binary',
    body: testModel
  })
})

// Wait for model loaded event
await page.evaluate(() => {
  return new Promise(resolve => {
    window.addEventListener('model-loaded', resolve)
    // Timeout fallback
    setTimeout(resolve, 10000)
  })
})

// Verify model in scene
const modelData = await page.evaluate(() => {
  const model = window.scene.getObjectByName('model')
  return {
    exists: !!model,
    vertices: model?.geometry?.attributes?.position?.count || 0
  }
})

expect(modelData.exists).toBe(true)
expect(modelData.vertices).toBeGreaterThan(0)
```

## Database and Storage Issues

### 1. Database Locked

#### Problem

```
Error: SQLITE_BUSY: database is locked
```

#### Solutions

```typescript
// Use WAL mode for SQLite
await db.raw("PRAGMA journal_mode = WAL")

// Increase busy timeout
await db.raw("PRAGMA busy_timeout = 5000")

// Use separate database for each test
let testDb: Database

beforeEach(async () => {
  const dbPath = `./test-dbs/test-${Date.now()}.db`
  testDb = await createDatabase(dbPath)
})

afterEach(async () => {
  await testDb.destroy()
})
```

### 2. Blob Storage Errors

#### Problem

```
Error: Blob upload failed: network error
```

#### Solutions

```typescript
// Mock blob storage in tests
vi.mock('@vercel/blob', () => ({
  put: vi.fn().mockResolvedValue({
    url: 'https://test-blob.vercel-storage.com/test.glb',
    size: 1024
  }),
  del: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ blobs: [] })
}))

// Use test blob token
process.env.BLOB_READ_WRITE_TOKEN = 'test-token'

// Retry on transient failures
async function uploadWithRetry(data: Buffer, path: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await put(path, data, { access: 'public' })
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

## Mock and Stub Issues

### 1. Mock Not Working

#### Problem

Mocks don't intercept calls as expected.

#### Solutions

```typescript
// Ensure mock is set up before import
vi.mock('./service', () => ({
  ServiceClass: vi.fn().mockImplementation(() => ({
    method: vi.fn().mockResolvedValue('mocked')
  }))
}))

// Import after mock
import { ServiceClass } from './service'

// Verify mock is called
it('should use mocked service', async () => {
  const service = new ServiceClass()
  await service.method()

  expect(service.method).toHaveBeenCalled()
})

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
```

### 2. Mock State Pollution

#### Problem

Mock state leaks between tests.

#### Solutions

```typescript
// Reset mock implementation
beforeEach(() => {
  mockOpenAI.chat.completions.create.mockReset()
  mockOpenAI.chat.completions.create.mockResolvedValue({
    // Fresh mock response
  })
})

// Use fresh mock instances
beforeEach(() => {
  vi.resetModules() // Clear module cache
})

// Isolate mock state
describe('Feature A', () => {
  const mockService = createMockService()

  afterEach(() => {
    mockService.reset()
  })
})
```

## CI/CD-Specific Issues

### 1. Works Locally, Fails in CI

#### Problem

Tests pass locally but fail in CI environment.

#### Solutions

```typescript
// Detect CI environment
const isCI = process.env.CI === 'true'

// Adjust timeouts for CI
const timeout = isCI ? 60000 : 30000

// Use CI-specific configuration
// playwright.config.ts
export default defineConfig({
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 60000 : 30000
})

// Log more information in CI
if (process.env.CI) {
  console.log('Running in CI mode')
  console.log('Environment:', process.env)
}
```

### 2. CI Cache Issues

#### Problem

Stale cached data causes failures.

#### Solutions

```bash
# Clear cache in workflow
- name: Clear cache
  run: |
    rm -rf node_modules/.cache
    rm -rf .next/cache
    rm -rf dist

# Use cache key with hash
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 3. Resource Constraints

#### Problem

CI runner runs out of memory or disk space.

#### Solutions

```yaml
# Increase memory limit
- name: Run tests
  run: NODE_OPTIONS="--max-old-space-size=4096" npm test

# Clean up between steps
- name: Cleanup
  run: |
    docker system prune -af
    rm -rf test-results

# Use smaller test matrix
strategy:
  matrix:
    node-version: [18] # Only test one version instead of [16, 18, 20]
```

## Performance Issues

### 1. Slow Test Execution

#### Problem

Tests take too long to run.

#### Solutions

```typescript
// Run tests in parallel
// vitest.config.ts
export default defineConfig({
  test: {
    maxConcurrency: 4,
    pool: 'threads'
  }
})

// Use test sharding
// playwright.config.ts
export default defineConfig({
  workers: 4,
  // Shard tests across machines
  shard: { total: 4, current: 1 }
})

// Profile slow tests
npm test -- --reporter=verbose

// Optimize setup/teardown
describe('Feature tests', () => {
  // Share expensive setup across tests
  beforeAll(async () => {
    await expensiveSetup()
  })

  // Fast per-test setup
  beforeEach(() => {
    quickReset()
  })
})
```

### 2. Memory Leaks

#### Problem

Memory usage grows during test execution.

#### Solutions

```typescript
// Clean up after each test
afterEach(() => {
  // Dispose Three.js objects
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose()
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose())
      } else {
        object.material.dispose()
      }
    }
  })

  // Clear caches
  cache.clear()

  // Remove event listeners
  emitter.removeAllListeners()
})

// Monitor memory usage
it('should not leak memory', async () => {
  const initialMemory = process.memoryUsage().heapUsed

  for (let i = 0; i < 100; i++) {
    await operation()
  }

  if (global.gc) global.gc()

  const finalMemory = process.memoryUsage().heapUsed
  const growth = finalMemory - initialMemory

  expect(growth).toBeLessThan(10 * 1024 * 1024) // < 10MB
})
```

## Prevention Strategies

### 1. Write Reliable Tests

```typescript
// Use data-testid for stability
// ❌ FRAGILE: Text content can change
await page.click('text=Submit')

// ✅ STABLE: data-testid won't change
await page.click('[data-testid="submit-button"]')

// Make tests self-contained
it('should work independently', async () => {
  // Don't rely on other tests running first
  const testData = await setupTestData()

  // Run test
  const result = await runTest(testData)

  // Cleanup
  await cleanupTestData(testData)

  expect(result).toBeDefined()
})
```

### 2. Add Proper Waits

```typescript
// ❌ BAD: Fixed delays
await page.waitForTimeout(5000)

// ✅ GOOD: Wait for conditions
await page.waitForSelector('[data-testid="loaded"]')
await page.waitForLoadState('networkidle')
await page.waitForFunction(() => window.dataReady)
```

### 3. Handle Async Properly

```typescript
// ❌ BAD: Missing await
it('should save data', async () => {
  saveData(data) // Forgot await!
  const saved = await loadData()
  expect(saved).toEqual(data)
})

// ✅ GOOD: Proper await
it('should save data', async () => {
  await saveData(data)
  const saved = await loadData()
  expect(saved).toEqual(data)
})
```

### 4. Use Test Utilities

```typescript
// Create reusable test helpers
// tests/helpers/test-utils.ts
export async function waitForAssetGeneration(
  id: string,
  timeout = 30000
): Promise<Asset> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const asset = await getAsset(id)
    if (asset.status === 'completed') return asset
    if (asset.status === 'failed') throw new Error('Generation failed')

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Timeout waiting for asset generation')
}

// Use in tests
it('should generate asset', async () => {
  const id = await startGeneration(config)
  const asset = await waitForAssetGeneration(id)
  expect(asset).toBeDefined()
})
```

## Conclusion

Effective troubleshooting requires:
- Systematic diagnosis approach
- Understanding common failure patterns
- Proper logging and artifact collection
- Prevention through best practices

**Quick Reference:**
- **Timeout?** → Increase timeout, use proper waits
- **Flaky?** → Fix race conditions, seed randomness
- **State pollution?** → Reset between tests
- **Element not found?** → Wait for element, use data-testid
- **CI failure?** → Check logs, review artifacts, adjust for environment

**When Stuck:**
1. Run test in isolation
2. Enable debug logging
3. Collect artifacts (screenshots, traces, videos)
4. Check recent code changes
5. Compare local vs. CI environment
6. Ask team for help with details
