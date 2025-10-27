/**
 * Vitest Test Setup
 * 
 * Global test configuration and polyfills.
 */

import { expect, afterEach, vi, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Minimal window stub for non-JSDOM environments
if (typeof window === 'undefined') {
  (global as any).window = {}
}

/**
 * Helper: Create mocked canvas element with required context and properties
 */
const createMockedCanvas = () => ({
            getContext: vi.fn(() => ({
              fillStyle: '',
              fillRect: vi.fn(),
              clearRect: vi.fn(),
              getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
              putImageData: vi.fn(),
              drawImage: vi.fn()
            })),
            width: 300,
            height: 150
})

/**
 * Helper: Create mocked anchor element with click, href, download, and style
 */
const createMockedAnchor = () => ({
            click: vi.fn(),
            href: '',
            download: '',
            style: {}
})

/**
 * Helper: Setup document.createElement mock to handle canvas and anchor elements
 */
const setupCreateElementMock = () => {
  if (typeof document === 'undefined') return
  
  const originalCreateElement = document.createElement?.bind(document)
  
  document.createElement = vi.fn((tag: string) => {
    if (tag === 'canvas') {
      return createMockedCanvas() as any
    }
    if (tag === 'a') {
      return createMockedAnchor() as any
        }
      // Fallback to original or return basic element
      return originalCreateElement ? originalCreateElement(tag) : {}
      }) as any
}

/**
 * Helper: Setup document.body appendChild/removeChild mocks that preserve originals
 */
const setupDocumentBodyMocks = () => {
  if (typeof document === 'undefined' || !document.body) return
  
      const originalAppendChild = document.body.appendChild
      const originalRemoveChild = document.body.removeChild
      
      document.body.appendChild = vi.fn((node) => {
        if (originalAppendChild) return originalAppendChild.call(document.body, node)
        return node
      }) as any
      
      document.body.removeChild = vi.fn((node) => {
        if (originalRemoveChild) return originalRemoveChild.call(document.body, node)
        return node
      }) as any
    }

/**
 * Setup all DOM mocks once at module level
 */
beforeAll(() => {
  setupCreateElementMock()
  setupDocumentBodyMocks()
})

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock global objects
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock Audio
global.Audio = vi.fn().mockImplementation(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  load: vi.fn()
})) as any

// Mock FileReader
class MockFileReader {
  result: string | null = null
  onload: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  
  readAsDataURL(blob: Blob) {
    // Simulate async file read with immediate resolution for tests
    queueMicrotask(() => {
      this.result = 'data:audio/mpeg;base64,bW9ja2RhdGE=' // base64 for "mockdata"
      if (this.onload) {
        this.onload({ target: { result: this.result } } as any)
      }
    })
  }
  
  readAsText() {}
  readAsArrayBuffer() {}
}

global.FileReader = MockFileReader as any

// Mock fetch
global.fetch = vi.fn()

// Create functional localStorage mock that actually stores data
const createLocalStorageMock = () => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  }
}

// Mock window (jsdom should provide this, but ensure it's available)
if (typeof window === 'undefined') {
  const localStorageMock = createLocalStorageMock()
  
  ;(global as any).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    localStorage: localStorageMock
  }
  
  // Also set it on global for direct access
  ;(global as any).localStorage = localStorageMock
} else {
  // If window exists (jsdom), enhance localStorage
  if (!window.localStorage || typeof window.localStorage.getItem !== 'function') {
    const localStorageMock = createLocalStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true
    })
    ;(global as any).localStorage = localStorageMock
  }
}



// Mock console methods to reduce noise in tests
const originalConsole = { ...console }
global.console = {
  ...console,
  error: vi.fn((...args) => {
    // Still log errors in CI or when DEBUG is set
    if (process.env.CI || process.env.DEBUG) {
      originalConsole.error(...args)
    }
  }),
  warn: vi.fn((...args) => {
    if (process.env.CI || process.env.DEBUG) {
      originalConsole.warn(...args)
    }
  }),
  log: vi.fn((...args) => {
    if (process.env.DEBUG) {
      originalConsole.log(...args)
    }
  })
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
})) as any

// Export setup
export {}

