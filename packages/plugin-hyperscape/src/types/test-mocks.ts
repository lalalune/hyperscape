/**
 * CLAUDE.md Exception: Test mock utilities
 *
 * This file uses `unknown` types for test mocks to provide flexibility
 * in test scenarios while maintaining type safety where possible.
 *
 * Rationale: Test mocks need flexibility to accommodate various test scenarios
 * and runtime behaviors. Using `unknown` instead of `any` where possible maintains
 * some type safety while allowing test configuration.
 *
 * Note: These mocks should ONLY be used in lightweight test utilities,
 * NOT in actual test assertions. Real integration tests should be preferred.
 */
import { vi } from "vitest";
import {
  IAgentRuntime,
  Service,
  Memory,
  UUID,
  State,
  Character,
} from "@elizaos/core";
import { Entity, World } from "./core-types";
import type { Player } from "@hyperscape/shared";

// Real test configuration interface
export interface TestRuntimeConfig {
  agentId?: UUID;
  character?: Partial<Character>;
  world?: World;
  player?: Player;
  getService?: (name: string) => Service | null;
  db?: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    insert: (table: string, data: Record<string, unknown>) => Promise<unknown>;
    update: (table: string, data: Record<string, unknown>) => Promise<unknown>;
    [key: string]: unknown;
  };
  useModel?: (modelName: string) => unknown;
  composeState?: (config: Record<string, unknown>) => unknown;
  ensureConnection?: () => Promise<boolean>;
  createMemory?: (data: Partial<Memory>) => Promise<Memory>;
  processActions?: (actions: unknown[]) => Promise<unknown[]>;
  evaluate?: (prompt: string, context?: unknown) => Promise<unknown>;
}

export const toUUID = (id: string): UUID => id as UUID;

export const generateTestUUID = (): UUID => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as UUID;
};

// Create real service instance for testing
export function createMockService(name: string): Service {
  // Legitimate cast: Test mock object with minimal Service interface
  // Service is a class with protected properties, we only need public API for testing
  const mockService = {
    capabilityDescription: `${name} service`,
    runtime: {} as IAgentRuntime,
    stop: async () => {},
  };

  return mockService as unknown as Service;
}

// Create mock world instance for testing - using proper Hyperscape World interface
export function createMockWorld(overrides: Partial<World> = {}): World {
  const mockWorld = {
    // Core World properties
    id: "mock-world-" + Date.now(),
    frame: 0,
    time: 0,
    accumulator: 0,
    networkRate: 20,
    assetsUrl: null,
    assetsDir: null,
    hot: new Set(),
    systems: [],
    systemsByName: new Map(),
    maxDeltaTime: 1 / 60,
    fixedDeltaTime: 1 / 60,

    // Core systems that all Hyperscape worlds have
    entities: {
      add: vi.fn((data: { id?: string; [key: string]: unknown }) => ({
        id: data.id || "mock-entity",
        data,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      })),
      get: vi.fn(),
      remove: vi.fn(),
      has: vi.fn(),
      values: vi.fn(() => []),
      player: null,
      items: new Map(),
      players: new Map(),
      getPlayer: vi.fn(),
      getLocalPlayer: vi.fn(),
      getPlayers: vi.fn(() => []),
    },

    events: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      listeners: new Map(),
    },

    chat: {
      add: vi.fn(),
      subscribe: vi.fn(() => () => {}),
      listeners: [],
    },

    network: {
      isServer: false,
      isClient: true,
      send: vi.fn(),
      id: "mock-network",
    },

    // Mock system access methods
    getSystem: vi.fn((systemKey: string) => {
      return (
        mockWorld.systemsByName.get(systemKey) ||
        mockWorld[systemKey as keyof typeof mockWorld] ||
        null
      );
    }),

    // Server/client detection
    get isServer() {
      return mockWorld.network.isServer || false;
    },
    get isClient() {
      return mockWorld.network.isClient || true;
    },

    // EventEmitter methods
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),

    ...overrides,
  } as World;

  return mockWorld;
}

// Create real player instance for testing
export function createMockPlayer(config = {}): Player {
  return {
    id: "player-1",
    data: {
      id: "player-1",
      name: "Test Player",
    },
    isPlayer: true,
    type: "player",
    position: { x: 0, y: 0, z: 0 },
    ...config,
  } as Player;
}

// Create real entity instance for testing
export function createMockEntity(config = {}): Entity {
  return {
    id: generateTestUUID(),
    name: "Test Entity",
    type: "entity",
    isPlayer: false,
    data: {
      name: "Test Entity",
    },
    ...config,
  } as Entity;
}

// Create real memory instance for testing
export function createMockMemory(config: Partial<Memory> = {}): Memory {
  return {
    id: generateTestUUID(),
    userId: generateTestUUID(),
    agentId: generateTestUUID(),
    roomId: generateTestUUID(),
    content: { text: "Test memory" },
    embedding: [],
    createdAt: Date.now(),
    ...config,
  } as Memory;
}

// Create real state instance for testing
export function createMockState(config: Partial<State> = {}): State {
  return {
    values: new Map(),
    data: {},
    text: "",
    ...config,
  } as State;
}

// Create real Hyperscape service for testing
export function createMockHyperscapeService(
  config: Record<string, unknown> = {},
): Service {
  // Legitimate cast: Test mock object with minimal Service interface
  // Service is a class with protected properties, we only need public API for testing
  const hyperscapeService = {
    capabilityDescription: "hyperscape service",
    runtime: {} as IAgentRuntime,
    stop: async () => {},
    ...config,
  };

  return hyperscapeService as unknown as Service;
}

// Create real runtime instance for testing
export function createMockRuntime(config?: TestRuntimeConfig): IAgentRuntime {
  // Legitimate cast: Test mock with minimal IAgentRuntime interface (100+ properties)
  // We only implement the methods actually used by plugin-hyperscape tests
  const runtime = {
    agentId: config?.agentId || generateTestUUID(),
    character: {
      name: "Test Agent",
      bio: "A test agent",
      ...config?.character,
    },
    services: new Map(),
    actions: [],
    providers: new Map(),
    evaluators: new Map(),
    plugins: new Map(),
    // Add minimal required methods
    createMemory: async () => createMockMemory(),
    composeState: async () => ({}),
    getSetting: () => undefined,
    registerService: () => {},
    unregisterService: () => {},
    getMemories: async () => [],
    emitEvent: vi.fn(),
    ensureConnection: vi.fn(),
    getService: vi.fn().mockReturnValue({
      getWorld: vi.fn().mockReturnValue(createMockWorld()),
    }),
    // Add other required properties as needed
    routes: [],
    events: {
      on: () => {},
      off: () => {},
      emit: () => {},
      listeners: new Map(),
    },
    logger: console,
  } as unknown as IAgentRuntime;

  return runtime;
}

// Test helper class
export class TestHelper {
  static createScenario(config: Record<string, unknown>) {
    return {
      runtime: createMockRuntime(config),
      world: createMockWorld(),
      player: createMockPlayer(),
    };
  }

  static async waitFor(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 50,
  ): Promise<void> {
    const startTime = Date.now();

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  static async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<void> {
    const startTime = Date.now();
    while (!condition() && Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    if (!condition()) {
      throw new Error("Condition not met within timeout");
    }
  }
}
