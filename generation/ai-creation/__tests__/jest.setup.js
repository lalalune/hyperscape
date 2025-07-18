// Global test setup
import 'jest'

// Mock global fetch for API tests
global.fetch = jest.fn()

// Add custom matchers
expect.extend({
  toBeCloseTo: (received, expected, precision = 2) => {
    const pass = Math.abs(received - expected) < Math.pow(10, -precision)
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be close to ${expected}`
          : `Expected ${received} to be close to ${expected}`,
    }
  },
})

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks()
})

console.log('✅ Test environment setup complete')
