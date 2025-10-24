# Testing Quick Reference

## Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run specific test file
npm test -- formatting.test.ts

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run with UI
npm run test:ui
```

## Common Test Patterns

### Basic Test

```typescript
import { describe, it, expect } from 'vitest'

describe('myFunction', () => {
  it('should return expected result', () => {
    expect(myFunction('input')).toBe('output')
  })
})
```

### Async Tests

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

### Mocking

```typescript
import { vi } from 'vitest'

const mockFn = vi.fn()
mockFn.mockReturnValue(42)
expect(mockFn()).toBe(42)
```

### Setup/Teardown

```typescript
describe('MyService', () => {
  let service: MyService

  beforeEach(() => {
    service = new MyService()
  })

  afterEach(() => {
    service.dispose()
  })

  it('should work', () => {
    expect(service).toBeDefined()
  })
})
```

## Assertions

```typescript
// Equality
expect(value).toBe(expected)
expect(value).toEqual(expected)

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeDefined()
expect(value).toBeUndefined()
expect(value).toBeNull()

// Numbers
expect(value).toBeGreaterThan(5)
expect(value).toBeLessThan(10)
expect(value).toBeCloseTo(9.5, 1)

// Strings
expect(string).toContain('substring')
expect(string).toMatch(/pattern/)

// Arrays
expect(array).toHaveLength(3)
expect(array).toContain(item)

// Objects
expect(obj).toHaveProperty('key')
expect(obj).toMatchObject({ key: 'value' })

// Errors
expect(() => fn()).toThrow()
expect(() => fn()).toThrow('error message')

// Async
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow()
```

## Test Organization

```
tests/
├── unit/
│   ├── utils/              # Utility function tests
│   ├── services/           # Service tests
│   └── hooks/              # Hook tests
├── integration/            # Integration tests
├── mocks/                  # Shared mocks
└── setup.mjs              # Test setup
```

## Coverage

Current thresholds:
- Lines: 60%
- Functions: 60%
- Branches: 50%
- Statements: 60%

## Troubleshooting

### Test Timeout

```typescript
it('slow test', async () => {
  // test code
}, { timeout: 10000 })
```

### Clear Mocks

```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

### Flaky Tests

Use tolerance for timing:

```typescript
expect(elapsed).toBeGreaterThanOrEqual(95)
expect(elapsed).toBeLessThanOrEqual(150)
```

## Resources

- [Full Testing Guide](./unit-testing-guide.md)
- [Implementation Report](./testing-implementation-report.md)
- [Vitest Docs](https://vitest.dev/)
