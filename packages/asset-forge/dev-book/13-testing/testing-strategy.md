# Testing Strategy

Asset Forge follows a "real testing" philosophy: no mocks, no spies, no test framework abstractions. Tests use actual Hyperscape instances, real 3D rendering, and genuine asset generation to ensure features work in production conditions.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Architecture](#test-architecture)
3. [Playwright Integration](#playwright-integration)
4. [Multimodal Verification](#multimodal-verification)
5. [Test Organization](#test-organization)
6. [Writing Tests](#writing-tests)
7. [Running Tests](#running-tests)
8. [Continuous Integration](#continuous-integration)

## Testing Philosophy

### Core Principles

1. **Real, Not Mocked**: Use actual Hyperscape instances, real Three.js scenes, and genuine API calls
2. **Multimodal Verification**: Test both data structures AND visual output
3. **Build Mini-Worlds**: Each test creates its own isolated game environment
4. **Production Conditions**: Tests run in real browsers with actual rendering pipelines
5. **No Abstractions**: Direct inspection of ECS systems, Three.js hierarchies, and game state

### Why No Mocks?

Mocks create a false sense of security. Asset Forge tests verify:
- **Actual 3D rendering** (not stubbed scene graphs)
- **Real physics** (not mocked collision detection)
- **Genuine AI responses** (not hardcoded outputs)
- **True browser behavior** (not simulated DOM)

**Example of what we DON'T do:**
```typescript
// ❌ AVOID: Mocked testing
const mockScene = {
  add: jest.fn(),
  children: []
}

const mockRenderer = {
  render: jest.fn()
}

// This tells us nothing about whether rendering actually works
```

**Example of what we DO:**
```typescript
// ✅ PREFER: Real testing
const scene = new THREE.Scene()
const renderer = new THREE.WebGLRenderer()

// Add actual 3D objects
const weapon = await loadWeapon('bronze-sword')
scene.add(weapon)

// Render for real
renderer.render(scene, camera)

// Verify actual scene hierarchy
expect(scene.children).toContain(weapon)
expect(weapon.position.y).toBeGreaterThan(0)
```

## Test Architecture

### Test Types

Asset Forge uses four complementary testing methodologies:

| Type | Purpose | Tools | Example |
|------|---------|-------|---------|
| **Three.js Testing** | Verify 3D scene structure | Direct inspection | Check weapon in character's hand |
| **Visual Testing** | Verify rendered appearance | Screenshots + proxies | Verify goblin appears green |
| **System Integration** | Verify ECS systems | Data introspection | Check combat damage calculation |
| **LLM Verification** | Verify complex visuals | GPT-4o vision | Analyze animation quality |

### Test Structure

```
packages/asset-forge/
├── tests/
│   ├── unit/              # Individual component tests
│   ├── integration/       # Multi-component tests
│   ├── visual/            # Screenshot-based tests
│   └── e2e/              # End-to-end workflows
├── fixtures/             # Test data and assets
│   ├── models/           # 3D models for testing
│   ├── textures/         # Test textures
│   └── scenes/           # Pre-configured scenes
└── logs/                 # Test execution logs
```

### Test Fixtures

Tests use real game assets in a controlled environment:

```typescript
// Fixture organization
const fixtures = {
  weapons: {
    'bronze-sword': '/fixtures/models/bronze-sword.glb',
    'steel-axe': '/fixtures/models/steel-axe.glb'
  },
  characters: {
    'goblin': '/fixtures/models/goblin.glb',
    'guard': '/fixtures/models/guard.glb'
  },
  scenes: {
    'combat-arena': '/fixtures/scenes/combat-arena.json',
    'bank-interior': '/fixtures/scenes/bank-interior.json'
  }
}
```

## Playwright Integration

Asset Forge uses Playwright for browser automation and real rendering tests.

### Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // 60 seconds per test
  fullyParallel: false, // Sequential for GPU tests
  retries: 2,
  workers: 1, // Single worker for 3D rendering

  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable WebGL for Three.js
        launchOptions: {
          args: ['--enable-webgl', '--use-gl=swiftshader']
        }
      }
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
})
```

### Basic Test Template

```typescript
import { test, expect } from '@playwright/test'

test('weapon attachment to character', async ({ page }) => {
  // Navigate to test environment
  await page.goto('/testing/weapon-rigging')

  // Wait for Three.js scene to initialize
  await page.waitForFunction(() => {
    return window.scene && window.scene.children.length > 0
  })

  // Execute test in browser context
  const result = await page.evaluate(() => {
    // Access real Three.js scene
    const scene = window.scene
    const character = scene.getObjectByName('character')
    const weapon = scene.getObjectByName('weapon')

    // Verify weapon is attached to hand bone
    const hand = character.getObjectByName('Hand_R')
    const weaponInHand = hand.children.some(child =>
      child.name === 'weapon'
    )

    return {
      weaponAttached: weaponInHand,
      weaponPosition: weapon.position.toArray(),
      handPosition: hand.position.toArray()
    }
  })

  // Assert results
  expect(result.weaponAttached).toBe(true)
  expect(result.weaponPosition[1]).toBeGreaterThan(0) // Y > 0
})
```

### Screenshot-Based Testing

```typescript
test('visual: goblin appears green', async ({ page }) => {
  await page.goto('/testing/character-rendering')

  // Wait for scene ready
  await page.waitForSelector('#scene-ready')

  // Take screenshot
  const screenshot = await page.screenshot({
    clip: { x: 0, y: 0, width: 800, height: 600 }
  })

  // Visual regression (optional)
  expect(screenshot).toMatchSnapshot('goblin-render.png')

  // Analyze with image processing
  const analysis = await analyzeScreenshot(screenshot)
  expect(analysis.dominantColor).toBeCloseTo(0x00ff00, 0x10) // Green ±16
})
```

## Multimodal Verification

Asset Forge tests verify both data AND visual appearance.

### Data Verification

Test the underlying data structures:

```typescript
test('combat damage calculation', async ({ page }) => {
  const result = await page.evaluate(() => {
    // Create mini-world
    const world = new World()

    // Create entities
    const player = world.createEntity('player')
    player.addComponent('combat', {
      attack: 50,
      strength: 40,
      defence: 30
    })

    const goblin = world.createEntity('goblin')
    goblin.addComponent('combat', {
      attack: 20,
      strength: 15,
      defence: 10
    })
    goblin.addComponent('health', {
      current: 100,
      max: 100
    })

    // Execute combat system
    const combatSystem = new CombatSystem(world)
    combatSystem.attack(player, goblin)

    // Return data for verification
    return {
      goblinHealth: goblin.getComponent('health').current,
      damageDealt: 100 - goblin.getComponent('health').current
    }
  })

  // Verify data
  expect(result.damageDealt).toBeGreaterThan(0)
  expect(result.goblinHealth).toBeLessThan(100)
})
```

### Visual Verification

Test the rendered output:

```typescript
test('player sprite renders correctly', async ({ page }) => {
  await page.goto('/testing/sprite-rendering')

  // Get canvas context
  const spriteData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Count red pixels (player color proxy)
    let redPixels = 0
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i]
      const g = imageData.data[i + 1]
      const b = imageData.data[i + 2]

      if (r > 200 && g < 50 && b < 50) {
        redPixels++
      }
    }

    return {
      totalPixels: imageData.data.length / 4,
      redPixels,
      redPercentage: (redPixels / (imageData.data.length / 4)) * 100
    }
  })

  // Verify player sprite is visible (>5% red pixels)
  expect(spriteData.redPercentage).toBeGreaterThan(5)
})
```

## Test Organization

### Directory Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── AssetService.test.ts
│   │   ├── SpriteGenerationService.test.ts
│   │   └── MeshFittingService.test.ts
│   ├── utils/
│   │   ├── weaponUtils.test.ts
│   │   └── helpers.test.ts
│   └── components/
│       └── AssetViewer.test.tsx
├── integration/
│   ├── generation-pipeline.test.ts
│   ├── weapon-rigging.test.ts
│   └── armor-fitting.test.ts
├── visual/
│   ├── character-rendering.test.ts
│   ├── sprite-generation.test.ts
│   └── material-variants.test.ts
└── e2e/
    ├── complete-workflow.test.ts
    └── batch-generation.test.ts
```

### Naming Conventions

- **Unit tests**: `ComponentName.test.ts`
- **Integration tests**: `feature-name.test.ts`
- **Visual tests**: `visual-aspect.test.ts`
- **E2E tests**: `workflow-description.test.ts`

### Test Grouping

```typescript
import { test, expect } from '@playwright/test'

test.describe('Weapon Rigging', () => {
  test.beforeEach(async ({ page }) => {
    // Setup for all tests in group
    await page.goto('/testing/weapon-rigging')
    await page.waitForSelector('#scene-ready')
  })

  test('sword attaches to right hand', async ({ page }) => {
    // Test implementation
  })

  test('bow attaches with correct rotation', async ({ page }) => {
    // Test implementation
  })

  test('shield attaches to left hand', async ({ page }) => {
    // Test implementation
  })
})
```

## Writing Tests

### Test Template

Every Asset Forge test follows this structure:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Setup: Navigate and wait for ready
    await page.goto('/testing/feature')
    await page.waitForSelector('#ready')
  })

  test('specific behavior', async ({ page }) => {
    // 2. Build: Create mini-world
    await page.evaluate(() => {
      window.testWorld = createTestWorld()
      // Add entities, components, systems
    })

    // 3. Execute: Run the feature
    const result = await page.evaluate(() => {
      window.testWorld.runSystem('featureSystem')
      return window.testWorld.getState()
    })

    // 4. Verify: Check both data and visuals
    expect(result.dataCheck).toBe(expected)

    const screenshot = await page.screenshot()
    expect(screenshot).toMatchSnapshot()
  })

  test.afterEach(async ({ page }) => {
    // 5. Cleanup: Dispose resources
    await page.evaluate(() => {
      window.testWorld?.dispose()
    })
  })
})
```

### Best Practices

#### 1. Use Real Data

```typescript
// ✅ Good: Load actual asset
const weapon = await loadAsset('bronze-sword-base')

// ❌ Bad: Mock asset
const weapon = { name: 'sword', type: 'weapon' }
```

#### 2. Verify Multiple Aspects

```typescript
test('weapon rendering', async ({ page }) => {
  // Data verification
  const sceneData = await page.evaluate(() => ({
    weaponCount: scene.children.filter(c => c.userData.type === 'weapon').length,
    weaponPosition: scene.getObjectByName('weapon').position.toArray()
  }))
  expect(sceneData.weaponCount).toBe(1)

  // Visual verification
  const screenshot = await page.screenshot()
  const analysis = await analyzeImage(screenshot)
  expect(analysis.containsWeapon).toBe(true)
})
```

#### 3. Handle Async Operations

```typescript
test('asset generation', async ({ page }) => {
  // Start generation
  await page.evaluate(() => {
    window.pipelineId = startGeneration(config)
  })

  // Poll for completion
  await page.waitForFunction(() => {
    const status = getPipelineStatus(window.pipelineId)
    return status === 'completed' || status === 'failed'
  }, { timeout: 60000 })

  // Verify result
  const status = await page.evaluate(() =>
    getPipelineStatus(window.pipelineId)
  )
  expect(status).toBe('completed')
})
```

#### 4. Save Logs on Failure

```typescript
test('complex feature', async ({ page }, testInfo) => {
  try {
    // Test implementation
  } catch (error) {
    // Save logs on failure
    const logs = await page.evaluate(() => window.testLogs)
    await testInfo.attach('test-logs.json', {
      body: JSON.stringify(logs, null, 2),
      contentType: 'application/json'
    })
    throw error
  }
})
```

### Test Helpers

Asset Forge provides specialized test helper functions in `tests/e2e/helpers/test-helpers.ts` for common testing scenarios.

#### fillLargeTextarea

For testing large text inputs (>1,000 characters) without performance issues.

**Problem**: Playwright's `.fill()` method types character-by-character, which can cause:
- 60+ second timeouts for 5,000 character inputs
- Excessive re-renders and state updates
- Test flakiness due to debouncing and async operations

**Solution**: Direct DOM manipulation with proper event dispatching.

```typescript
import { fillLargeTextarea } from './helpers/test-helpers'

test('large text input performance', async ({ page }) => {
  const largeText = 'a'.repeat(5000)

  // ❌ SLOW: Character-by-character typing (60+ seconds)
  // await page.locator('textarea').fill(largeText)

  // ✅ FAST: Direct value setting (<2 seconds)
  await fillLargeTextarea(page, '[data-testid="voice-input-text"]', largeText)

  // Verify text was set
  const value = await page.locator('[data-testid="voice-input-text"]').inputValue()
  expect(value).toBe(largeText)
})
```

**Implementation**:
```typescript
export async function fillLargeTextarea(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  // Set value directly via JavaScript
  await page.evaluate(
    ({ sel, txt }) => {
      const element = document.querySelector(sel) as HTMLTextAreaElement
      if (element) {
        element.value = txt
        // Dispatch events to trigger React state updates
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
    },
    { sel: selector, txt: text }
  )

  // Wait for debounced updates to settle
  await page.waitForTimeout(500)
}
```

**When to Use**:
- Text inputs > 1,000 characters
- Testing character limits (e.g., 5,000 char maximum)
- Performance-critical input scenarios
- Testing debounced state updates

**Performance**:
- Sets 5,000 characters instantly vs. 60+ seconds
- Properly triggers React events (`input`, `change`)
- Waits for debounce periods (e.g., 100ms) to settle
- 30x faster than character-by-character typing

#### data-testid Selectors

All interactive elements include `data-testid` attributes for stable test selectors.

**Why data-testid?**
- ✅ Stable across UI changes
- ✅ Language-independent
- ✅ CSS class independent
- ✅ Clear intent in tests

```typescript
// ❌ Fragile: Text-based selector
await page.locator('text=Browse Voices').click()

// ❌ Fragile: CSS class selector
await page.locator('.voice-browser-button').click()

// ✅ Stable: data-testid selector
await page.locator('[data-testid="voice-browser-toggle"]').click()
```

**Available Test IDs**:
```typescript
// Voice Standalone Page
'voice-standalone-page'      // Main page container
'page-title'                 // Page heading
'voice-input-text'           // Text input textarea
'character-counter'          // Character count display
'cost-estimate'              // Cost estimation badge
'voice-browser-toggle'       // Voice browser open button

// Navigation (dynamic IDs)
`nav-section-${sectionId}`   // Navigation section headers
`nav-item-${itemId}`         // Navigation menu items
```

**Best Practice**:
```typescript
test('voice generation workflow', async ({ page }) => {
  // Use data-testid for all interactions
  const textarea = page.locator('[data-testid="voice-input-text"]')
  const counter = page.locator('[data-testid="character-counter"]')
  const estimate = page.locator('[data-testid="cost-estimate"]')

  await fillLargeTextarea(page, '[data-testid="voice-input-text"]', 'Test text')

  await expect(counter).toBeVisible()
  await expect(estimate).toBeVisible()
})
```

#### TestHelpers Class

The `TestHelpers` class provides common utilities for navigation, screenshots, and state management.

```typescript
import { TestHelpers } from './helpers/test-helpers'

test.describe('Feature Tests', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await helpers.navigateTo('/feature-page')
  })

  test('take screenshot', async () => {
    await helpers.takeScreenshot('feature-initial-state')
    // Screenshot saved to test-results/screenshots/
  })

  test('wait for network idle', async () => {
    await helpers.waitForNetworkIdle()
    // Ensures all async operations complete
  })
})
```

## Running Tests

### Development

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/services/AssetService.test.ts

# Run tests matching pattern
npm test -- --grep "weapon rigging"

# Run with UI (interactive)
npx playwright test --ui

# Run with debug
npx playwright test --debug
```

### Watch Mode

```bash
# Re-run tests on file changes
npm test -- --watch
```

### Headed Mode

```bash
# Run tests in visible browser (for debugging)
npx playwright test --headed
```

## Continuous Integration

### GitHub Actions

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run tests
        run: npm test
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: test-results/

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-logs
          path: logs/
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run tests before commit
npm test

# Only commit if tests pass
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

## Test Coverage Reporting

### Coverage Configuration

Asset Forge uses Vitest for unit test coverage and Istanbul for integration test coverage.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
        'server/**/*.mjs'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/types/**',
        'src/**/*.d.ts',
        'server/**/*.test.mjs'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
})
```

### Running Coverage Reports

```bash
# Generate coverage for unit tests
npm run test:unit -- --coverage

# View HTML coverage report
open coverage/index.html

# Check coverage thresholds
npm run test:coverage

# Generate coverage for integration tests
npm run test:integration -- --coverage

# Combined coverage report
npm run test:all -- --coverage
```

### Coverage Metrics

Asset Forge tracks four key coverage metrics:

1. **Line Coverage**: Percentage of executed code lines
2. **Function Coverage**: Percentage of called functions
3. **Branch Coverage**: Percentage of executed conditional branches
4. **Statement Coverage**: Percentage of executed statements

```bash
# Example coverage output
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   85.42 |    78.92 |   82.15 |   85.42 |
 services          |   92.45 |    85.71 |   90.00 |   92.45 |
  AssetService.mjs |   95.00 |    90.00 |   92.30 |   95.00 |
  VoiceService.mjs |   88.50 |    80.00 |   87.50 |   88.50 |
 utils             |   76.32 |    70.00 |   75.00 |   76.32 |
  validators.mjs   |   100.0 |    100.0 |   100.0 |   100.0 |
-------------------|---------|----------|---------|---------|
```

### Coverage Targets

| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| **Core Services** | 90% | 90% | 85% | 90% |
| **API Routes** | 85% | 85% | 80% | 85% |
| **Utilities** | 85% | 85% | 80% | 85% |
| **UI Components** | 75% | 75% | 70% | 75% |
| **Overall** | 80% | 80% | 75% | 80% |

### CI/CD Coverage Integration

```yaml
# .github/workflows/ci.yml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    flags: unittests
    name: asset-forge-coverage
    fail_ci_if_error: true

- name: Comment coverage on PR
  uses: romeovs/lcov-reporter-action@v0.3.1
  with:
    lcov-file: ./coverage/lcov.info
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Uncovered Code Analysis

```bash
# Find uncovered lines
npm run test:coverage -- --reporter=verbose

# Generate detailed coverage report
npm run test:coverage -- --coverage.all

# Check specific file coverage
npm run test:coverage -- src/services/AssetService.mjs
```

### Best Practices

1. **Aim for High Coverage**: Target 80%+ overall coverage
2. **Critical Paths First**: Ensure 90%+ coverage for core services
3. **Don't Chase 100%**: Some code (error handlers, edge cases) may not need coverage
4. **Review Uncovered Code**: Identify if missing tests or dead code
5. **Track Trends**: Monitor coverage changes over time

```typescript
// Add coverage comments to skip non-critical code
/* istanbul ignore next */
function debugOnly() {
  // Development-only code
}

/* istanbul ignore if */
if (process.env.NODE_ENV === 'development') {
  // Dev-only path
}
```

## Debugging Failed Tests

### 1. Review Screenshots

```bash
# Screenshots saved automatically on failure
ls test-results/feature-test/test-failed-1.png
```

### 2. Check Video Recording

```bash
# Videos captured for failed tests
open test-results/feature-test/video.webm
```

### 3. Inspect Trace

```bash
# Open Playwright trace viewer
npx playwright show-trace test-results/feature-test/trace.zip
```

### 4. Analyze Logs

```bash
# Check test logs
cat logs/test-YYYY-MM-DD.log
```

### 5. Comprehensive Troubleshooting

For detailed troubleshooting guidance, see [Test Troubleshooting Guide](./test-troubleshooting.md).

## Additional Testing Guides

Asset Forge provides comprehensive testing documentation:

- **[Integration Testing Guide](./integration-testing-guide.md)** - Testing multiple components together
- **[Mocking Strategies](./mocking-strategies.md)** - When and how to mock external services
- **[Test Patterns](./test-patterns.md)** - Common testing patterns and best practices
- **[CI/CD Testing](./ci-cd-testing.md)** - Automated testing in GitHub Actions
- **[Visual Testing](./visual-testing.md)** - 3D rendering and screenshot verification
- **[Debugging Tools](./debugging-tools.md)** - DevTools and debugging techniques
- **[Test Troubleshooting](./test-troubleshooting.md)** - Comprehensive troubleshooting guide

## Conclusion

Asset Forge's testing strategy prioritizes real-world verification over test coverage metrics. Every test runs actual code in real browsers with genuine 3D rendering, ensuring features work correctly in production. This approach catches integration issues early and provides confidence that Asset Forge functions as designed.

**Key Takeaways:**
- No mocks - test with real instances
- Multimodal verification - data AND visuals
- Playwright for browser automation
- Save logs and screenshots for debugging
- All tests must pass before merging
