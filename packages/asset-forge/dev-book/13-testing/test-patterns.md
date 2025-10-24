# Test Patterns

## Overview

This guide documents common testing patterns used throughout Asset Forge. These patterns ensure consistent, maintainable, and effective tests across the codebase.

## Table of Contents

1. [Test Structure Patterns](#test-structure-patterns)
2. [Setup and Teardown Patterns](#setup-and-teardown-patterns)
3. [Assertion Patterns](#assertion-patterns)
4. [Async Testing Patterns](#async-testing-patterns)
5. [Error Testing Patterns](#error-testing-patterns)
6. [Data-Driven Testing](#data-driven-testing)
7. [Visual Testing Patterns](#visual-testing-patterns)
8. [Performance Testing Patterns](#performance-testing-patterns)
9. [Integration Patterns](#integration-patterns)

## Test Structure Patterns

### AAA Pattern (Arrange-Act-Assert)

The fundamental pattern for all tests:

```typescript
describe('AssetService', () => {
  it('should create asset with valid data', async () => {
    // ARRANGE: Set up test data and dependencies
    const assetData = {
      name: 'Test Sword',
      type: 'weapon',
      subtype: 'sword'
    }
    const service = new AssetService()

    // ACT: Execute the behavior being tested
    const result = await service.createAsset(assetData)

    // ASSERT: Verify the outcome
    expect(result).toMatchObject({
      id: expect.any(String),
      name: 'Test Sword',
      type: 'weapon',
      status: 'pending'
    })
  })
})
```

### Given-When-Then Pattern (BDD Style)

Alternative structure emphasizing behavior:

```typescript
describe('Voice Generation', () => {
  it('should generate audio when text is provided', async () => {
    // GIVEN: A voice service with valid configuration
    const voiceService = new VoiceGenerationService()
    const text = 'Welcome to our village, traveler.'
    const voiceId = 'merchant-voice-01'

    // WHEN: We generate voice from text
    const result = await voiceService.generateVoice({
      text,
      voiceId,
      stability: 0.5
    })

    // THEN: Audio should be generated successfully
    expect(result.success).toBe(true)
    expect(result.audioUrl).toMatch(/^https?:\/\/.+\.mp3$/)
    expect(result.duration).toBeGreaterThan(0)
  })
})
```

### Builder Pattern for Test Data

Create complex test objects incrementally:

```typescript
class QuestBuilder {
  private quest: Partial<Quest> = {}

  withTitle(title: string): this {
    this.quest.title = title
    return this
  }

  withObjectives(count: number): this {
    this.quest.objectives = Array.from({ length: count }, (_, i) => ({
      id: `obj-${i}`,
      description: `Objective ${i}`,
      completed: false
    }))
    return this
  }

  withRewards(gold: number, exp: number): this {
    this.quest.rewards = { gold, experience: exp }
    return this
  }

  build(): Quest {
    return {
      id: `quest-${Date.now()}`,
      title: this.quest.title || 'Default Quest',
      description: 'Quest description',
      objectives: this.quest.objectives || [],
      rewards: this.quest.rewards || { gold: 0, experience: 0 },
      status: 'active'
    }
  }
}

// Usage
describe('Quest System', () => {
  it('should track quest progress', () => {
    const quest = new QuestBuilder()
      .withTitle('The Lost Artifact')
      .withObjectives(3)
      .withRewards(500, 1000)
      .build()

    const tracker = new QuestTracker()
    tracker.addQuest(quest)

    expect(tracker.getActiveQuests()).toHaveLength(1)
  })
})
```

## Setup and Teardown Patterns

### Per-Test Setup

```typescript
describe('AssetService', () => {
  let service: AssetService
  let db: Database

  beforeEach(async () => {
    // Fresh instance for each test
    db = await createTestDatabase()
    service = new AssetService(db)
  })

  afterEach(async () => {
    // Clean up after each test
    await db.destroy()
  })

  it('test 1', async () => {
    // Test uses fresh service
  })

  it('test 2', async () => {
    // Test uses different fresh service
  })
})
```

### Shared Setup with Reset

```typescript
describe('VoiceManifest', () => {
  let manifestService: ManifestService

  // Create once for all tests
  beforeAll(() => {
    manifestService = new ManifestService()
  })

  // Reset state between tests
  beforeEach(() => {
    manifestService.clear()
  })

  it('test 1', () => {
    // Uses same instance, fresh state
  })

  it('test 2', () => {
    // Uses same instance, fresh state
  })
})
```

### Fixture Pattern

```typescript
// tests/fixtures/voice-manifests.ts
export const voiceManifestFixtures = {
  merchantManifest: {
    id: 'manifest-merchant-001',
    name: 'Village Merchants',
    npcs: [
      { id: 'npc-1', name: 'Blacksmith', lines: 10 },
      { id: 'npc-2', name: 'Innkeeper', lines: 15 }
    ]
  },

  guardManifest: {
    id: 'manifest-guard-001',
    name: 'City Guards',
    npcs: [
      { id: 'npc-3', name: 'Gate Guard', lines: 8 },
      { id: 'npc-4', name: 'Watch Captain', lines: 20 }
    ]
  }
}

// Usage in tests
import { voiceManifestFixtures } from './fixtures/voice-manifests'

describe('Manifest Processing', () => {
  it('should calculate total lines', () => {
    const { merchantManifest } = voiceManifestFixtures
    const total = calculateTotalLines(merchantManifest)
    expect(total).toBe(25) // 10 + 15
  })
})
```

## Assertion Patterns

### Object Matching

```typescript
// Exact match
expect(asset).toEqual({
  id: 'asset-123',
  name: 'Sword',
  type: 'weapon'
})

// Partial match
expect(asset).toMatchObject({
  name: 'Sword',
  type: 'weapon'
  // Other properties can exist
})

// Shape matching with dynamic values
expect(asset).toMatchObject({
  id: expect.any(String),
  name: expect.any(String),
  createdAt: expect.any(Date),
  metadata: expect.objectContaining({
    version: '1.0'
  })
})
```

### Array Assertions

```typescript
// Contains specific items
expect(assets).toContain(
  expect.objectContaining({ name: 'Sword' })
)

// All items match condition
expect(assets).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ type: 'weapon' }),
    expect.objectContaining({ type: 'armor' })
  ])
)

// Length and content
expect(assets).toHaveLength(5)
expect(assets.every(a => a.status === 'completed')).toBe(true)
```

### String Assertions

```typescript
// Pattern matching
expect(url).toMatch(/^https:\/\//)
expect(error.message).toMatch(/invalid|forbidden/i)

// Contains substring
expect(description).toContain('quest')

// Specific format
expect(id).toMatch(/^asset-[a-f0-9]{8}$/)
```

### Custom Matchers

```typescript
// tests/matchers/custom-matchers.ts
import { expect } from 'vitest'

expect.extend({
  toBeValidAssetId(received: string) {
    const pass = /^asset-[a-f0-9]{8}$/.test(received)
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid asset ID`
          : `expected ${received} to be a valid asset ID format (asset-xxxxxxxx)`
    }
  },

  toHaveCompletedStatus(received: any) {
    const pass = received.status === 'completed'
    return {
      pass,
      message: () =>
        pass
          ? `expected status not to be completed`
          : `expected status to be completed, received ${received.status}`
    }
  }
})

// Usage
it('should generate valid asset ID', () => {
  const asset = createAsset()
  expect(asset.id).toBeValidAssetId()
  expect(asset).toHaveCompletedStatus()
})
```

## Async Testing Patterns

### Promise-Based Tests

```typescript
describe('Async Operations', () => {
  it('should resolve successfully', async () => {
    // Using async/await
    const result = await generateAsset(config)
    expect(result.status).toBe('completed')
  })

  it('should reject on error', async () => {
    // Testing promise rejection
    await expect(generateAsset(invalidConfig))
      .rejects.toThrow('Invalid configuration')
  })
})
```

### Polling Pattern

```typescript
async function waitForCondition(
  checkFn: () => boolean | Promise<boolean>,
  timeout: number = 10000,
  interval: number = 100
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await checkFn()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

// Usage
it('should complete generation within timeout', async () => {
  const pipelineId = await startGeneration(config)

  await waitForCondition(
    async () => {
      const status = await getStatus(pipelineId)
      return status === 'completed'
    },
    30000 // 30 second timeout
  )

  const asset = await getAsset(pipelineId)
  expect(asset).toBeDefined()
})
```

### Concurrent Operations

```typescript
describe('Concurrent Processing', () => {
  it('should handle multiple simultaneous requests', async () => {
    const requests = Array.from({ length: 5 }, (_, i) =>
      generateAsset({ name: `Asset ${i}` })
    )

    const results = await Promise.all(requests)

    expect(results).toHaveLength(5)
    expect(results.every(r => r.status === 'completed')).toBe(true)
  })

  it('should process requests sequentially', async () => {
    const results: any[] = []

    for (let i = 0; i < 3; i++) {
      const result = await generateAsset({ name: `Asset ${i}` })
      results.push(result)
    }

    // Verify order was preserved
    expect(results[0].name).toBe('Asset 0')
    expect(results[1].name).toBe('Asset 1')
    expect(results[2].name).toBe('Asset 2')
  })
})
```

## Error Testing Patterns

### Exception Testing

```typescript
describe('Error Handling', () => {
  it('should throw on invalid input', () => {
    expect(() => validateAssetId('../../../etc/passwd'))
      .toThrow('Invalid asset ID')
  })

  it('should throw specific error type', () => {
    expect(() => parseManifest(invalidJson))
      .toThrow(ManifestParseError)
  })

  it('should throw with message pattern', () => {
    expect(() => loadAsset('nonexistent'))
      .toThrow(/not found|does not exist/i)
  })
})
```

### Async Error Testing

```typescript
describe('Async Errors', () => {
  it('should reject promise', async () => {
    await expect(generateAsset(invalidConfig))
      .rejects.toThrow('Invalid configuration')
  })

  it('should handle rejection with specific error', async () => {
    await expect(uploadToBlob(null))
      .rejects.toThrow(TypeError)
  })

  it('should catch and handle errors', async () => {
    try {
      await riskyOperation()
      fail('Expected error to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CustomError)
      expect(error.code).toBe('OPERATION_FAILED')
    }
  })
})
```

### Error Recovery Pattern

```typescript
describe('Error Recovery', () => {
  it('should retry on transient failure', async () => {
    let attempts = 0

    mockMeshy.createTask
      .mockImplementationOnce(() => {
        attempts++
        throw new Error('Temporary failure')
      })
      .mockImplementationOnce(() => {
        attempts++
        throw new Error('Temporary failure')
      })
      .mockResolvedValueOnce({ task_id: 'task-123' })

    const result = await generateAssetWithRetry(config, { maxRetries: 3 })

    expect(attempts).toBe(3)
    expect(result.task_id).toBe('task-123')
  })

  it('should fail after max retries', async () => {
    mockMeshy.createTask.mockRejectedValue(
      new Error('Permanent failure')
    )

    await expect(generateAssetWithRetry(config, { maxRetries: 2 }))
      .rejects.toThrow('Permanent failure')

    expect(mockMeshy.createTask).toHaveBeenCalledTimes(3) // Initial + 2 retries
  })
})
```

## Data-Driven Testing

### Parameterized Tests

```typescript
describe('Asset Type Validation', () => {
  const validTypes = [
    ['weapon', 'sword'],
    ['weapon', 'axe'],
    ['armor', 'helmet'],
    ['armor', 'chestplate']
  ]

  validTypes.forEach(([type, subtype]) => {
    it(`should accept ${type}/${subtype}`, () => {
      const result = validateAssetType(type, subtype)
      expect(result.valid).toBe(true)
    })
  })

  const invalidTypes = [
    ['invalid', 'type'],
    ['weapon', 'invalid-subtype'],
    ['', ''],
    [null, null]
  ]

  invalidTypes.forEach(([type, subtype]) => {
    it(`should reject ${type}/${subtype}`, () => {
      const result = validateAssetType(type, subtype)
      expect(result.valid).toBe(false)
    })
  })
})
```

### Test Matrix

```typescript
describe('Voice Generation Matrix', () => {
  const testCases = [
    { text: 'Short', expectedDuration: [1, 3] },
    { text: 'Medium length text here', expectedDuration: [2, 5] },
    { text: 'This is a much longer text that should take more time to generate', expectedDuration: [5, 10] }
  ]

  testCases.forEach(({ text, expectedDuration }) => {
    it(`should generate voice for text length ${text.length}`, async () => {
      const result = await generateVoice({ text, voiceId: 'test-voice' })

      expect(result.duration).toBeGreaterThanOrEqual(expectedDuration[0])
      expect(result.duration).toBeLessThanOrEqual(expectedDuration[1])
    })
  })
})
```

### Edge Case Testing

```typescript
describe('Edge Cases', () => {
  const edgeCases = [
    { description: 'empty string', input: '', expectError: true },
    { description: 'single character', input: 'a', expectError: false },
    { description: 'max length', input: 'a'.repeat(5000), expectError: false },
    { description: 'over max', input: 'a'.repeat(5001), expectError: true },
    { description: 'special chars', input: '!@#$%^&*()', expectError: false },
    { description: 'unicode', input: '你好世界', expectError: false },
    { description: 'emoji', input: '😀😃😄', expectError: false }
  ]

  edgeCases.forEach(({ description, input, expectError }) => {
    it(`should handle ${description}`, async () => {
      if (expectError) {
        await expect(processText(input)).rejects.toThrow()
      } else {
        const result = await processText(input)
        expect(result).toBeDefined()
      }
    })
  })
})
```

## Visual Testing Patterns

### Screenshot Comparison

```typescript
describe('Visual Rendering', () => {
  it('should render asset correctly', async ({ page }) => {
    await page.goto('/asset-viewer/test-sword')
    await page.waitForSelector('#model-loaded')

    // Take screenshot
    const screenshot = await page.screenshot({
      clip: { x: 0, y: 0, width: 800, height: 600 }
    })

    // Compare with baseline
    expect(screenshot).toMatchSnapshot('test-sword-render.png', {
      threshold: 0.02, // 2% difference allowed
      maxDiffPixels: 100
    })
  })
})
```

### Multi-Viewport Pattern

```typescript
describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 }
  ]

  viewports.forEach(({ name, width, height }) => {
    it(`should render correctly on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto('/voice-generator')

      const screenshot = await page.screenshot()
      expect(screenshot).toMatchSnapshot(`voice-generator-${name}.png`)
    })
  })
})
```

### Color Detection Pattern

```typescript
async function detectDominantColor(
  page: Page,
  selector: string
): Promise<{ r: number; g: number; b: number }> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // Capture element as image
    const rect = element.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    // Get pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Calculate average color
    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count++
    }

    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count)
    }
  }, selector)
}

// Usage
it('should display warning color for errors', async ({ page }) => {
  await page.goto('/test-page')
  await triggerError()

  const color = await detectDominantColor(page, '.error-message')

  expect(color.r).toBeGreaterThan(200) // Red component
  expect(color.g).toBeLessThan(100)    // Low green
  expect(color.b).toBeLessThan(100)    // Low blue
})
```

## Performance Testing Patterns

### Execution Time Testing

```typescript
describe('Performance', () => {
  it('should generate asset within time limit', async () => {
    const startTime = performance.now()

    await generateAsset(config)

    const duration = performance.now() - startTime
    expect(duration).toBeLessThan(5000) // Must complete in < 5 seconds
  })

  it('should process batch efficiently', async () => {
    const assets = createTestAssets(100)

    const startTime = performance.now()
    await processBatch(assets)
    const duration = performance.now() - startTime

    // Should process 100 items in under 10 seconds
    expect(duration).toBeLessThan(10000)

    // Average time per item should be < 100ms
    const avgTime = duration / assets.length
    expect(avgTime).toBeLessThan(100)
  })
})
```

### Memory Testing Pattern

```typescript
describe('Memory Management', () => {
  it('should not leak memory during generation', async () => {
    const initialMemory = process.memoryUsage().heapUsed

    // Perform operations
    for (let i = 0; i < 100; i++) {
      const asset = await generateAsset(config)
      await processAsset(asset)
      await cleanupAsset(asset)
    }

    // Force garbage collection (requires --expose-gc flag)
    if (global.gc) {
      global.gc()
    }

    const finalMemory = process.memoryUsage().heapUsed
    const memoryGrowth = finalMemory - initialMemory

    // Memory should not grow more than 10MB
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024)
  })
})
```

## Integration Patterns

### Service Integration Pattern

```typescript
describe('Asset Generation Pipeline Integration', () => {
  let assetService: AssetService
  let generationService: GenerationService
  let storageService: StorageService

  beforeEach(() => {
    // Real services with mocked external dependencies
    assetService = new AssetService()
    generationService = new GenerationService()
    storageService = new StorageService()
  })

  it('should complete full pipeline', async () => {
    // Step 1: Create asset record
    const asset = await assetService.createAsset({
      name: 'Test Sword',
      type: 'weapon'
    })

    // Step 2: Generate 3D model
    const generationResult = await generationService.generate(asset.id)
    expect(generationResult.status).toBe('completed')

    // Step 3: Store in blob
    const storageResult = await storageService.upload(
      generationResult.modelData,
      `assets/${asset.id}.glb`
    )

    // Step 4: Update asset with URL
    await assetService.updateAsset(asset.id, {
      modelUrl: storageResult.url
    })

    // Verify complete integration
    const finalAsset = await assetService.getAsset(asset.id)
    expect(finalAsset.modelUrl).toMatch(/^https:\/\//)
    expect(finalAsset.status).toBe('completed')
  })
})
```

### Event-Driven Pattern

```typescript
describe('Event-Driven Integration', () => {
  it('should handle event chain', async () => {
    const events: string[] = []

    orchestrator.on('generation-started', () => events.push('started'))
    orchestrator.on('generation-progress', () => events.push('progress'))
    orchestrator.on('generation-completed', () => events.push('completed'))

    await orchestrator.generateAsset(config)

    expect(events).toEqual(['started', 'progress', 'completed'])
  })
})
```

## Conclusion

These test patterns provide a foundation for writing consistent, maintainable tests in Asset Forge. By following these patterns:

- Tests are predictable and easy to understand
- Common scenarios are handled consistently
- Edge cases are systematically covered
- Integration points are clearly tested
- Visual and performance aspects are verified

**Key Takeaways:**
- Use AAA or Given-When-Then for clear test structure
- Leverage builders for complex test data
- Test both success and failure paths
- Use parameterized tests for edge cases
- Verify visual output with screenshots
- Monitor performance and memory usage
- Test real service integration with mocked external APIs
