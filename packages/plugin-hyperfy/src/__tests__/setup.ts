import '@testing-library/jest-dom'
import { expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  })
) as any

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
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
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
  takeRecords: vi.fn(),
})) as any

// Mock performance.now for consistent timing in tests
let mockTime = 0
global.performance.now = vi.fn(() => {
  mockTime += 16 // Simulate 60fps
  return mockTime
})

// Reset mock time before each test
beforeEach(() => {
  mockTime = 0
})

// Custom test utilities
export const waitForCondition = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> => {
  const startTime = Date.now()

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout')
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}

export const createMockGameState = () => ({
  id: 'test-game',
  phase: 'lobby',
  players: new Map(),
  tasks: new Map(),
  bodies: new Map(),
  votes: new Map(),
  minPlayers: 5,
  maxPlayers: 8,
})

export const createMockPlayer = (id: string, role?: string) => ({
  id,
  name: `Player ${id}`,
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  alive: true,
  role: role || null,
  color: 'red',
  isMoving: false,
  speed: 5,
})

export const createMockTask = (id: string) => ({
  id,
  name: `Task ${id}`,
  position: { x: 10, y: 0, z: 10 },
  duration: 5000,
  completedBy: new Set(),
  inProgress: new Map(),
})

// Test data generators
export const generatePlayers = (count: number) => {
  const players = []
  for (let i = 0; i < count; i++) {
    players.push(createMockPlayer(`p${i}`))
  }
  return players
}

export const generateTasks = (count: number) => {
  const tasks = []
  for (let i = 0; i < count; i++) {
    tasks.push(createMockTask(`t${i}`))
  }
  return tasks
}

// Mock environment variables
process.env.WS_URL = 'wss://test.hyperfy.xyz/ws'
process.env.HYPERFY_USERNAME = 'test-agent'
process.env.AVATAR_URL = './public/test-avatar.vrm'

// Global mocks for browser APIs that might be used
if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        digest: vi.fn(() => Promise.resolve(new ArrayBuffer(32))),
      } as any,
    },
    writable: true
  })
}

// Mock File constructor for Node environment
global.File = class File extends Blob {
  name: string
  lastModified: number

  constructor(chunks: any[], filename: string, options?: any) {
    super(chunks, options)
    this.name = filename
    this.lastModified = Date.now()
  }
} as any
