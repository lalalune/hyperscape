/**
 * Bank Handler Integration Test Helpers
 *
 * Shared mock factories and utilities for testing bank handlers.
 * These mocks simulate the real dependencies at key boundaries.
 */

import { vi } from "vitest";
import { SessionType } from "@hyperscape/shared";

// ============================================================================
// Types
// ============================================================================

export interface MockSocket {
  id: string;
  emit: ReturnType<typeof vi.fn>;
  player?: MockPlayer;
  data: {
    playerId?: string;
    visibleName?: string;
    session?: {
      type: SessionType;
      entityId: string;
    };
  };
}

export interface MockPlayer {
  id: string;
  visibleName: string;
  position: { x: number; y: number; z: number };
}

export interface MockEntity {
  id: string;
  position: { x: number; z: number };
  base?: { position: { x: number; z: number } };
}

export interface MockWorld {
  entities: Map<string, MockEntity>;
  getSystem: ReturnType<typeof vi.fn>;
}

export interface MockDrizzle {
  transaction: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

export interface MockDatabase {
  drizzle: MockDrizzle;
}

export interface MockContext {
  socket: MockSocket;
  playerId: string;
  world: MockWorld;
  db: MockDatabase;
}

export interface MockValidationSuccess {
  success: true;
  context: MockContext;
}

export interface MockValidationFailure {
  success: false;
}

export type MockValidationResult =
  | MockValidationSuccess
  | MockValidationFailure;

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Create a mock socket for testing handlers
 */
export function createMockSocket(
  overrides: Partial<MockSocket> = {},
): MockSocket {
  return {
    id: "socket-test-123",
    emit: vi.fn(),
    data: {
      playerId: "player-test-123",
      visibleName: "TestPlayer",
      session: {
        type: SessionType.BANK,
        entityId: "bank-entity-1",
      },
    },
    ...overrides,
  };
}

/**
 * Create a mock player
 */
export function createMockPlayer(
  overrides: Partial<MockPlayer> = {},
): MockPlayer {
  return {
    id: "player-test-123",
    visibleName: "TestPlayer",
    position: { x: 10, y: 0, z: 10 },
    ...overrides,
  };
}

/**
 * Create a mock world with entities and systems
 */
export function createMockWorld(
  entities: Array<MockEntity> = [],
  systems: Record<string, unknown> = {},
): MockWorld {
  const entityMap = new Map<string, MockEntity>();
  for (const entity of entities) {
    entityMap.set(entity.id, entity);
  }

  // Default bank entity
  if (!entityMap.has("bank-entity-1")) {
    entityMap.set("bank-entity-1", {
      id: "bank-entity-1",
      position: { x: 10, z: 10 },
    });
  }

  return {
    entities: entityMap,
    getSystem: vi.fn((name: string) => systems[name] ?? null),
  };
}

/**
 * Create a mock drizzle instance
 */
export function createMockDrizzle(): MockDrizzle {
  return {
    transaction: vi.fn(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  };
}

/**
 * Create a mock database
 */
export function createMockDatabase(): MockDatabase {
  return {
    drizzle: createMockDrizzle(),
  };
}

/**
 * Create a mock handler context
 */
export function createMockContext(
  overrides: Partial<MockContext> = {},
): MockContext {
  const socket = overrides.socket ?? createMockSocket();
  return {
    socket,
    playerId: overrides.playerId ?? "player-test-123",
    world: overrides.world ?? createMockWorld(),
    db: overrides.db ?? createMockDatabase(),
  };
}

/**
 * Create a successful validation result
 */
export function createMockValidationSuccess(
  contextOverrides: Partial<MockContext> = {},
): MockValidationSuccess {
  return {
    success: true,
    context: createMockContext(contextOverrides),
  };
}

/**
 * Create a failed validation result
 */
export function createMockValidationFailure(): MockValidationFailure {
  return {
    success: false,
  };
}

// ============================================================================
// Mock Equipment System
// ============================================================================

export interface MockEquipmentSystem {
  getEquipmentSlotForItem: ReturnType<typeof vi.fn>;
  canPlayerEquipItem: ReturnType<typeof vi.fn>;
  equipItemDirect: ReturnType<typeof vi.fn>;
  unequipItemDirect: ReturnType<typeof vi.fn>;
  getAllEquippedItems: ReturnType<typeof vi.fn>;
  getPlayerEquipment: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock equipment system
 */
export function createMockEquipmentSystem(
  overrides: Partial<MockEquipmentSystem> = {},
): MockEquipmentSystem {
  return {
    getEquipmentSlotForItem: vi.fn().mockReturnValue("weapon"),
    canPlayerEquipItem: vi.fn().mockReturnValue(true),
    equipItemDirect: vi.fn().mockResolvedValue({
      success: true,
      equippedSlot: "weapon",
      displacedItems: [],
    }),
    unequipItemDirect: vi.fn().mockResolvedValue({
      success: true,
      itemId: "bronze_sword",
      quantity: 1,
    }),
    getAllEquippedItems: vi.fn().mockReturnValue([]),
    getPlayerEquipment: vi.fn().mockReturnValue({}),
    ...overrides,
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an error toast was sent
 */
export function expectErrorToast(socket: MockSocket, message?: string): void {
  const emitCalls = socket.emit.mock.calls;
  const toastCall = emitCalls.find(
    (call: unknown[]) => call[0] === "showToast" && call[1]?.type === "error",
  );

  if (!toastCall) {
    throw new Error(
      `Expected error toast to be sent, but none found. Calls: ${JSON.stringify(emitCalls)}`,
    );
  }

  if (message && toastCall[1]?.message !== message) {
    throw new Error(
      `Expected error toast with message "${message}", got "${toastCall[1]?.message}"`,
    );
  }
}

/**
 * Assert that a success toast was sent
 */
export function expectSuccessToast(socket: MockSocket, message?: string): void {
  const emitCalls = socket.emit.mock.calls;
  const toastCall = emitCalls.find(
    (call: unknown[]) => call[0] === "showToast" && call[1]?.type === "success",
  );

  if (!toastCall) {
    throw new Error(
      `Expected success toast to be sent, but none found. Calls: ${JSON.stringify(emitCalls)}`,
    );
  }

  if (message && toastCall[1]?.message !== message) {
    throw new Error(
      `Expected success toast with message "${message}", got "${toastCall[1]?.message}"`,
    );
  }
}

/**
 * Assert that bank state was sent
 */
export function expectBankStateUpdate(socket: MockSocket): void {
  const emitCalls = socket.emit.mock.calls;
  const bankCall = emitCalls.find(
    (call: unknown[]) =>
      call[0] === "bankState" || call[0] === "bankStateWithTabs",
  );

  if (!bankCall) {
    throw new Error(
      `Expected bank state update, but none found. Calls: ${JSON.stringify(emitCalls)}`,
    );
  }
}

/**
 * Assert that no socket events were emitted
 */
export function expectNoEmit(socket: MockSocket): void {
  if (socket.emit.mock.calls.length > 0) {
    throw new Error(
      `Expected no socket emissions, but got: ${JSON.stringify(socket.emit.mock.calls)}`,
    );
  }
}
