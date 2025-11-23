import { beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
// @testing-library/jest-dom/matchers not available - using vitest matchers instead
// import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";
import {
  createMockRuntime,
  createMockWorld,
  createMockPlayer,
  createMockMemory,
  TestHelper,
} from "../types/test-mocks";
import { Entity, Player, World } from "@hyperscape/shared";
import { IAgentRuntime, Memory } from "@elizaos/core";

type MockWebSocket = Partial<WebSocket>;
type MockFetch = typeof fetch;
type MockIntersectionObserver = Partial<
  typeof IntersectionObserver extends new (...args: any[]) => infer T
    ? T
    : never
>;

// Extend Vitest's expect with jest-dom matchers
// expect.extend(matchers); // Commented out - matchers not available

// Global test setup
beforeAll(async () => {
  // Set up global test environment
  global.File = class MockFile extends Blob {
    name: string;
    lastModified: number;

    constructor(
      chunks: (Blob | BufferSource | string)[],
      filename: string,
      options?: { type?: string; lastModified?: number },
    ) {
      super(chunks, options);
      this.name = filename;
      this.lastModified = options?.lastModified || Date.now();
    }
  } as typeof File;

  Object.defineProperty(global, "crypto", {
    writable: true,
    value: {
      randomUUID: () =>
        `test-uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      subtle: {
        digest: async (
          _algorithm: string,
          data: ArrayBuffer | ArrayBufferView,
        ) => {
          // Mock implementation for testing
          return new ArrayBuffer(32); // Mock hash
        },
      },
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
    } as typeof Crypto,
  });
});

afterAll(async () => {
  // Cleanup if needed
});

beforeEach(async () => {
  // Reset any per-test state
});

afterEach(async () => {
  // Cleanup after each test
});

// Mock WebSocket
global.WebSocket = vi.fn(
  () =>
    ({
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as MockWebSocket,
);

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    headers: new Headers(),
  }),
) as MockFetch;

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(
  () =>
    ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
      takeRecords: vi.fn(),
    }) as MockIntersectionObserver,
);

// Mock performance.now for consistent timing in tests
let mockTime = 0;
global.performance.now = vi.fn(() => {
  mockTime += 16; // Simulate 60fps
  return mockTime;
});

// Reset mock time before each test
beforeEach(() => {
  mockTime = 0;
});

// Test utility functions
export const waitForCondition = async (
  condition: () => boolean,
  timeout = 5000,
  interval = 50,
): Promise<void> => {
  return TestHelper.waitFor(condition, timeout, interval);
};

export const createMockGameState = () => ({
  players: new Map(),
  entities: new Map(),
  worldState: {
    time: Date.now(),
    weather: "clear",
    activeEvents: [],
  },
});

export const createMockPlayerState = (id: string, role?: string) => ({
  id,
  name: `Player-${id}`,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  health: 100,
  isAlive: true,
  role: role || "player",
});

export const createMockTask = (id: string) => ({
  id,
  type: "test-task",
  status: "pending",
  data: {},
  createdAt: Date.now(),
});

export const generatePlayers = (count: number): Player[] => {
  return Array.from({ length: count }, (_, i) =>
    createMockPlayer({
      id: `player-${i}`,
      data: {
        id: `player-${i}`,
        name: `TestPlayer${i}`,
      },
    }),
  );
};

export const generateTasks = (count: number) => {
  return Array.from({ length: count }, (_, i) => createMockTask(`task-${i}`));
};

// Mock implementations for external dependencies
export const mockFetch = (
  response: string | Record<string, unknown>,
  ok = true,
  status = 200,
) => {
  // Determine text representation at creation time to avoid polymorphic checks
  const textResponse = (response as string).charAt
    ? (response as string)
    : JSON.stringify(response);

  const mockFn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => response,
    text: async () => textResponse,
    blob: async () => new Blob([]),
    arrayBuffer: async () => new ArrayBuffer(0),
  });

  Object.assign(mockFn, { preconnect: () => {} });

  // Type the mock function properly to match fetch interface
  global.fetch = mockFn as MockFetch;
};

export const mockConsole = () => {
  const originalConsole = { ...console };

  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();

  return {
    restore: () => {
      Object.assign(console, originalConsole);
    },
    logs: console.log,
    warns: console.warn,
    errors: console.error,
    infos: console.info,
    debugs: console.debug,
  };
};

export class TestScenario {
  private runtime: IAgentRuntime;
  private world: World;
  private entities: Map<string, Entity> = new Map();

  constructor() {
    this.runtime = createMockRuntime();
    this.world = createMockWorld();
  }

  getRuntimet(): IAgentRuntime {
    return this.runtime;
  }

  getWorld(): World {
    return this.world;
  }

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    // Convert Entity to EntityData format expected by world.entities
    const entityData = {
      id: entity.id,
      position: [entity.position.x, entity.position.y, entity.position.z] as [
        number,
        number,
        number,
      ],
      type: entity.type || "mock",
      data: entity.data || {},
    };
    this.world.entities.add(entityData);
  }

  removeEntity(entityId: string): void {
    this.entities.delete(entityId);
    this.world.entities.remove(entityId);
  }

  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  async simulateMessage(text: string, userId?: string): Promise<Memory> {
    const message = createMockMemory({
      content: { text },
    });

    // If we need to set a specific userId, we can do it after creation
    if (userId) {
      Object.assign(message, { userId });
    }

    // Simulate message processing
    // Note: createMemory might need additional parameters depending on the runtime implementation
    // For now, we'll just return the message as the runtime mock may not have createMemory
    return message;
  }

  async waitForCondition(
    condition: () => boolean,
    timeout = 5000,
  ): Promise<void> {
    return waitForCondition(condition, timeout);
  }

  cleanup(): void {
    this.entities.clear();
    this.world.destroy();
  }
}
