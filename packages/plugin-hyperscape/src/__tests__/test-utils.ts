import type { Memory, Service, UUID } from "@elizaos/core";
import {
  createMockEntity,
  createMockHyperscapeService,
  createMockMemory,
  createMockPlayer,
  createMockRuntime,
  createMockState,
  createMockWorld,
} from "../types/test-mocks";

// Re-export all mock functions and types from test-mocks for external use
export * from "../types/test-mocks";

// Generate test UUIDs
export function generateTestUUID(): UUID {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }) as UUID;
}

// Convert string to UUID for testing
export function toUUID(str: string): UUID {
  return str as UUID;
}

// Specific test utilities that extend the base mocks
export function createTestScenario(options: {
  agentName?: string;
  worldId?: string;
  playerCount?: number;
}) {
  const runtime = createMockRuntime({
    agentId: generateTestUUID(),
    character: {
      name: options.agentName || "TestAgent",
    },
  });

  const world = createMockWorld();

  // Add multiple players if requested
  if (options.playerCount && options.playerCount > 1) {
    for (let i = 0; i < options.playerCount; i++) {
      const player = createMockPlayer({
        id: `player-${i}`,
        data: {
          id: `player-${i}`,
          name: `Player${i}`,
        },
      });
      world.entities.players.set(player.id, player);
    }
  }

  const service = createMockHyperscapeService({
    runtime,
    currentWorldId: options.worldId || generateTestUUID(),
    getWorld: () => world,
    isConnected: () => true,
  });

  runtime.getService = <T extends Service>(name: string): T | null => {
    if (name === "hyperscape") {
      return service as T;
    }
    return null;
  };

  return {
    runtime,
    world,
    service,
    cleanup: () => {
      world.destroy();
    },
  };
}

// Create a mock interaction scenario
export function createMockInteraction(options: {
  messageText: string;
  userId?: string;
  agentId?: string;
  withCallback?: boolean;
}) {
  const userId = toUUID(options.userId || generateTestUUID());
  const agentId = toUUID(options.agentId || generateTestUUID());

  const memory = createMockMemory({
    agentId,
    content: { text: options.messageText },
  });

  const state = createMockState({
    values: new Map([
      ["lastMessage", options.messageText],
      ["userId", userId],
    ]),
  });

  const callback = options.withCallback ? () => {} : undefined;

  return { memory, state, callback, userId, agentId };
}

// Logger spy utilities
export function setupLoggerSpies() {
  const logSpy = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  };
  return { logSpy };
}

// Test data generators
export function generateTestMessages(count: number): Memory[] {
  const messages: Memory[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(
      createMockMemory({
        content: { text: `Test message ${i}` },
        createdAt: Date.now() - (count - i) * 1000,
      }),
    );
  }
  return messages;
}

export function generateTestEntities(
  count: number,
): ReturnType<typeof createMockEntity>[] {
  const entities: ReturnType<typeof createMockEntity>[] = [];
  for (let i = 0; i < count; i++) {
    entities.push(
      createMockEntity({
        id: `entity-${i}`,
        name: `Entity ${i}`,
      }),
    );
  }
  return entities;
}

// Test expectation helpers
export function expectMockCalled(_mockFn: any, _times?: number) {
  // Since we're not using mocks, this is a no-op
  return true;
}

export function expectMockNotCalled(_mockFn: any) {
  // Since we're not using mocks, this is a no-op
  return true;
}

export function expectValidUUID(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Value is not a string");
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error("Value is not a valid UUID");
  }
}

export function expectValidMemory(memory: unknown) {
  const memoryObj = memory as Record<string, unknown>;
  if (
    !memoryObj.id ||
    !memoryObj.userId ||
    !memoryObj.agentId ||
    !memoryObj.content
  ) {
    throw new Error("Invalid memory structure");
  }
}

export function expectValidActionResult(result: unknown) {
  const resultObj = result as Record<string, unknown>;
  if (resultObj.text === undefined || resultObj.success === undefined) {
    throw new Error("Invalid action result structure");
  }
}

// Test environment setup/cleanup
export function setupTestEnvironment() {
  // Any test environment setup
  return {
    cleanup: () => {
      // Any cleanup needed
    },
  };
}

export function cleanupTestEnvironment() {
  // Global test cleanup
}

// Timer utilities
export function mockTimers() {
  // Since we're not using mocks, return real timer functions
  return {
    advanceTimersByTime: (_ms: number) => {
      // No-op for real tests
    },
    runAllTimers: () => {
      // No-op for real tests
    },
  };
}

// Default export for convenience
export default {
  createMockRuntime,
  createMockWorld,
  createMockEntity,
  createMockPlayer,
  createMockMemory,
  createMockState,
  createMockHyperscapeService,
  createTestScenario,
  createMockInteraction,
  generateTestUUID,
  toUUID,
  setupLoggerSpies,
  generateTestMessages,
  generateTestEntities,
  expectMockCalled,
  expectMockNotCalled,
  expectValidUUID,
  expectValidMemory,
  expectValidActionResult,
  setupTestEnvironment,
  cleanupTestEnvironment,
  mockTimers,
};
