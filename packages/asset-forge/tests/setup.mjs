/**
 * Vitest Setup File
 * Configures test environment and global mocks
 */

import { vi } from 'vitest'
import { config } from 'dotenv'

// Load test environment variables
config({ path: '.env.test' })
config({ path: '.env' })

// Mock environment variables for testing
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key'
process.env.MESHY_API_KEY = process.env.MESHY_API_KEY || 'test-meshy-key'
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test-elevenlabs-key'
process.env.IMAGE_SERVER_URL = process.env.IMAGE_SERVER_URL || 'http://localhost:8080'
process.env.NODE_ENV = 'test'

// Global test timeout
vi.setConfig({ testTimeout: 10000 })

// Suppress console logs in tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    // Keep error for debugging test failures
    error: console.error
  }
}

// Mock fetch for Node.js environment
global.fetch = vi.fn()

// Mock file system operations for safety
if (process.env.MOCK_FS) {
  vi.mock('fs/promises')
}
