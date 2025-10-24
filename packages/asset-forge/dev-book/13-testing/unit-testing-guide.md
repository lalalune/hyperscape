# Unit Testing Guide

## Overview

This guide covers unit testing practices for Asset Forge, including test structure, patterns, and best practices.

## Test Framework

Asset Forge uses **Vitest** as its test framework with the following configuration:

- **Test Runner**: Vitest 4.x
- **Environment**: happy-dom (browser-like DOM for React components)
- **Assertion Library**: Vitest's built-in assertions (Jest-compatible)
- **Mocking**: Vitest's `vi` mock utilities
- **Coverage**: V8 code coverage provider

## Project Structure

```
packages/asset-forge/
├── tests/
│   ├── unit/                    # Unit tests
│   │   ├── utils/              # Utility function tests
│   │   ├── services/           # Service class tests
│   │   └── hooks/              # React hooks tests
│   ├── integration/            # Integration tests
│   ├── mocks/                  # Shared mocks and fixtures
│   └── setup.mjs              # Global test setup
├── src/
│   ├── services/__tests__/    # Service-specific tests
│   └── ...
└── vitest.config.mjs          # Vitest configuration
```

## Writing Unit Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { myFunction } from '@/utils/my-module'

describe('myFunction', () => {
  it('should do something specific', () => {
    const result = myFunction('input')
    expect(result).toBe('expected output')
  })

  it('should handle edge cases', () => {
    expect(myFunction('')).toBe('')
    expect(myFunction(null as unknown as string)).toBeDefined()
  })
})
```

### Grouping Related Tests

Use nested `describe` blocks for logical grouping:

```typescript
describe('formatting utilities', () => {
  describe('formatDate', () => {
    it('should format Date objects', () => {
      // test implementation
    })

    it('should format date strings', () => {
      // test implementation
    })
  })

  describe('formatTime', () => {
    it('should format time from Date', () => {
      // test implementation
    })
  })
})
```

### Setup and Teardown

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('MyService', () => {
  let service: MyService

  beforeEach(() => {
    // Runs before each test
    service = new MyService()
  })

  afterEach(() => {
    // Runs after each test
    service.dispose()
  })

  it('should initialize correctly', () => {
    expect(service).toBeDefined()
  })
})
```

## Testing Utilities

### Pure Functions

Utility functions are the easiest to test as they have no side effects:

```typescript
import { formatFileSize } from '@/utils/formatting'

describe('formatFileSize', () => {
  it('should format bytes', () => {
    expect(formatFileSize(500)).toBe('500.0 Bytes')
  })

  it('should format kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('should handle zero', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })
})
```

### Array Operations

Test array transformations thoroughly:

```typescript
import { groupBy, deduplicate } from '@/utils/array-helpers'

describe('groupBy', () => {
  it('should group items by key', () => {
    const items = [
      { type: 'weapon', name: 'Sword' },
      { type: 'armor', name: 'Helmet' },
      { type: 'weapon', name: 'Axe' }
    ]
    const result = groupBy(items, 'type')
    expect(result.weapon).toHaveLength(2)
    expect(result.armor).toHaveLength(1)
  })

  it('should handle empty arrays', () => {
    expect(groupBy([], 'type')).toEqual({})
  })
})
```

### Validation Functions

Test both valid and invalid inputs:

```typescript
import { isValidEmail, isValidUrl } from '@/utils/validation-helpers'

describe('isValidEmail', () => {
  it('should validate correct email formats', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('test.user@example.co.uk')).toBe(true)
  })

  it('should reject invalid email formats', () => {
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail(null as unknown as string)).toBe(false)
  })
})
```

## Testing Services

### Service Initialization

```typescript
import { AssetCacheService } from '@/services/AssetCacheService'

describe('AssetCacheService', () => {
  let cache: AssetCacheService

  beforeEach(() => {
    cache = new AssetCacheService({ maxSize: 100, ttl: 5000 })
  })

  it('should initialize with configuration', () => {
    expect(cache.getStats().maxSize).toBe(100)
  })

  it('should start empty', () => {
    expect(cache.getStats().size).toBe(0)
  })
})
```

### Service Methods

```typescript
describe('AssetCacheService', () => {
  it('should cache assets', () => {
    cache.set('asset-1', { id: '1', name: 'Sword' })
    expect(cache.get('asset-1')).toEqual({ id: '1', name: 'Sword' })
  })

  it('should return cache hit/miss', () => {
    cache.set('asset-1', { id: '1', name: 'Sword' })

    expect(cache.has('asset-1')).toBe(true)
    expect(cache.has('asset-2')).toBe(false)
  })

  it('should evict on max size', () => {
    for (let i = 0; i < 150; i++) {
      cache.set(`asset-${i}`, { id: `${i}` })
    }

    expect(cache.getStats().size).toBeLessThanOrEqual(100)
  })
})
```

## Testing Async Code

### Promises

```typescript
import { retry, sleep } from '@/utils/helpers'

describe('retry', () => {
  it('should succeed on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    const result = await retry(fn, 3, 10)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const result = await retry(fn, 3, 10)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))

    await expect(retry(fn, 2, 10)).rejects.toThrow('always fails')
  })
})
```

### Timeouts and Delays

```typescript
describe('ExponentialBackoff', () => {
  it('should increase delay exponentially', () => {
    const backoff = new ExponentialBackoff(1000, 10000, 2.0)

    const delay1 = backoff.getNextDelay()
    expect(delay1).toBeGreaterThanOrEqual(900)
    expect(delay1).toBeLessThanOrEqual(1100)

    const delay2 = backoff.getNextDelay()
    expect(delay2).toBeGreaterThanOrEqual(1800)
  })
})
```

## Mocking

### Function Mocks

```typescript
import { vi } from 'vitest'

describe('with mocks', () => {
  it('should track function calls', () => {
    const mockFn = vi.fn()
    mockFn('arg1', 'arg2')

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('should mock return values', () => {
    const mockFn = vi.fn().mockReturnValue(42)
    expect(mockFn()).toBe(42)
  })

  it('should mock implementations', () => {
    const mockFn = vi.fn((x: number) => x * 2)
    expect(mockFn(5)).toBe(10)
  })
})
```

### Mock Objects

```typescript
const createMockFile = (name: string, type: string): File => {
  return {
    name,
    type,
    size: 1024,
    lastModified: Date.now()
  } as File
}

describe('file validation', () => {
  it('should validate file types', () => {
    const file = createMockFile('image.png', 'image/png')
    expect(isValidFileType(file, ['image/png'])).toBe(true)
  })
})
```

### Spying on Methods

```typescript
describe('service integration', () => {
  it('should call dependency methods', () => {
    const service = new MyService()
    const spy = vi.spyOn(service.cache, 'get')

    service.getAsset('asset-1')

    expect(spy).toHaveBeenCalledWith('asset-1')
  })
})
```

## Best Practices

### 1. Test Names Should Be Descriptive

```typescript
// ✅ Good
it('should return empty array for null input', () => {})

// ❌ Bad
it('test 1', () => {})
```

### 2. One Assertion Per Test (When Practical)

```typescript
// ✅ Good
it('should format kilobytes', () => {
  expect(formatFileSize(1024)).toBe('1.0 KB')
})

it('should format megabytes', () => {
  expect(formatFileSize(1048576)).toBe('1.0 MB')
})

// ⚠️ Acceptable for related assertions
it('should handle edge cases', () => {
  expect(formatFileSize(0)).toBe('0 Bytes')
  expect(formatFileSize(-1)).toBe('0 Bytes')
})
```

### 3. Test Edge Cases

Always test:
- Empty inputs (`[]`, `''`, `null`, `undefined`)
- Boundary conditions (0, -1, max values)
- Invalid inputs
- Error conditions

### 4. Avoid Test Interdependence

```typescript
// ✅ Good - Tests are independent
describe('cache', () => {
  beforeEach(() => {
    cache = new Cache()
  })

  it('should add items', () => {
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('should remove items', () => {
    cache.set('key', 'value')
    cache.delete('key')
    expect(cache.has('key')).toBe(false)
  })
})

// ❌ Bad - Tests depend on execution order
it('should add items', () => {
  cache.set('key', 'value')
})

it('should retrieve items', () => {
  expect(cache.get('key')).toBe('value') // Depends on previous test
})
```

### 5. Use Descriptive Variable Names

```typescript
// ✅ Good
it('should group assets by type', () => {
  const weaponAssets = [{ type: 'weapon', name: 'Sword' }]
  const armorAssets = [{ type: 'armor', name: 'Helmet' }]
  const allAssets = [...weaponAssets, ...armorAssets]

  const grouped = groupBy(allAssets, 'type')
  expect(grouped.weapon).toEqual(weaponAssets)
})

// ❌ Bad
it('should group', () => {
  const a = [{ type: 'weapon', name: 'Sword' }]
  const b = [{ type: 'armor', name: 'Helmet' }]
  const c = [...a, ...b]

  const d = groupBy(c, 'type')
  expect(d.weapon).toEqual(a)
})
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Specific Files

```bash
npm test -- formatting.test.ts
```

### With Coverage

```bash
npm run test:coverage
```

### UI Mode

```bash
npm run test:ui
```

## Coverage Goals

Current coverage targets (defined in `vitest.config.mjs`):

- **Lines**: 60%
- **Functions**: 60%
- **Branches**: 50%
- **Statements**: 60%

Higher coverage goals:
- **Utility functions**: 80%+
- **Services**: 60%+
- **Hooks**: 40%+

## Common Patterns

### Testing Error Handling

```typescript
it('should throw on invalid input', () => {
  expect(() => {
    dangerousFunction(null)
  }).toThrow('Invalid input')
})

it('should handle errors gracefully', async () => {
  const result = await safeExecuteAsync(() => {
    throw new Error('Test error')
  })
  expect(result).toBeUndefined()
})
```

### Testing Type Guards

```typescript
it('should narrow types correctly', () => {
  const value: string | null = 'test'

  if (isDefined(value)) {
    // TypeScript knows value is string here
    expect(value.toUpperCase()).toBe('TEST')
  }
})
```

### Testing With Fixtures

```typescript
const fixtures = {
  validUser: { id: 1, name: 'John', email: 'john@example.com' },
  invalidUser: { id: -1, name: '', email: 'invalid' }
}

it('should validate users', () => {
  expect(validateUser(fixtures.validUser)).toBe(true)
  expect(validateUser(fixtures.invalidUser)).toBe(false)
})
```

## Troubleshooting

### Tests Timeout

Increase timeout for slow tests:

```typescript
it('should handle large datasets', async () => {
  // ... test code
}, { timeout: 10000 }) // 10 seconds
```

### Mock Not Working

Ensure mocks are reset between tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

### Flaky Tests

Avoid timing-dependent tests:

```typescript
// ❌ Bad - Timing dependent
it('should delay', async () => {
  const start = Date.now()
  await sleep(100)
  const elapsed = Date.now() - start
  expect(elapsed).toBe(100) // Flaky!
})

// ✅ Good - With tolerance
it('should delay', async () => {
  const start = Date.now()
  await sleep(100)
  const elapsed = Date.now() - start
  expect(elapsed).toBeGreaterThanOrEqual(95)
  expect(elapsed).toBeLessThanOrEqual(150)
})
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest API Reference](https://jestjs.io/docs/api) (Vitest is Jest-compatible)
