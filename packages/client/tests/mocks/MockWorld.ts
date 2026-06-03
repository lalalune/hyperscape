/**
 * MockWorld - Test utility for creating mock World instances
 *
 * Used for unit testing components that depend on the World object
 * without requiring a full Hyperia instance.
 */

import { vi } from "vitest";
import type { ClientWorld } from "../../src/types";

/**
 * MockWorld interface matching the shape of ClientWorld for testing
 */
export interface MockWorld {
  getPlayer: ReturnType<typeof vi.fn>;
  getSystem: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  network: {
    send: ReturnType<typeof vi.fn>;
    dropItem: ReturnType<typeof vi.fn>;
    togglePrayer: ReturnType<typeof vi.fn>;
    deactivateAllPrayers: ReturnType<typeof vi.fn>;
    sendFriendRequest: ReturnType<typeof vi.fn>;
    acceptFriendRequest: ReturnType<typeof vi.fn>;
    declineFriendRequest: ReturnType<typeof vi.fn>;
    removeFriend: ReturnType<typeof vi.fn>;
    addToIgnoreList: ReturnType<typeof vi.fn>;
    removeFromIgnoreList: ReturnType<typeof vi.fn>;
    lastInventoryByPlayerId: Record<string, unknown>;
    lastSkillsByPlayerId: Record<string, unknown>;
    lastEquipmentByPlayerId: Record<string, unknown>;
    lastPrayerStateByPlayerId: Record<string, unknown>;
    lastAttackStyleByPlayerId: Record<string, unknown>;
  };
  chat: {
    add: ReturnType<typeof vi.fn>;
  };
  entities: {
    player: {
      id: string;
    } | null;
  };
}

/**
 * Create a mock World object for testing
 *
 * @param overrides - Optional partial overrides for specific mock implementations
 * @returns MockWorld object that can be cast to ClientWorld for component testing
 */
export function createMockWorld(overrides: Partial<MockWorld> = {}): MockWorld {
  const defaultMock: MockWorld = {
    getPlayer: vi.fn(() => ({ id: "test-player-id" })),
    getSystem: vi.fn(() => ({
      // Mock actions system
      performAction: vi.fn(),
      getAvailableActions: vi.fn(() => []),
    })),
    emit: vi.fn(),
    on: vi.fn(() => () => {}), // Returns unsubscribe function
    off: vi.fn(),
    network: {
      send: vi.fn(),
      dropItem: vi.fn(),
      togglePrayer: vi.fn(),
      deactivateAllPrayers: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      declineFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
      addToIgnoreList: vi.fn(),
      removeFromIgnoreList: vi.fn(),
      lastInventoryByPlayerId: {},
      lastSkillsByPlayerId: {},
      lastEquipmentByPlayerId: {},
      lastPrayerStateByPlayerId: {},
      lastAttackStyleByPlayerId: {},
    },
    chat: {
      add: vi.fn(),
    },
    entities: {
      player: {
        id: "test-player-id",
      },
    },
  };

  // Deep merge network overrides
  const network = {
    ...defaultMock.network,
    ...(overrides.network || {}),
  };

  // Deep merge chat overrides
  const chat = {
    ...defaultMock.chat,
    ...(overrides.chat || {}),
  };

  // Deep merge entities overrides
  const entities = {
    ...defaultMock.entities,
    ...(overrides.entities || {}),
  };

  return {
    ...defaultMock,
    ...overrides,
    network,
    chat,
    entities,
  };
}

/**
 * Cast MockWorld to ClientWorld for use in component props
 *
 * @param mockWorld - The mock world instance
 * @returns The mock world cast as ClientWorld
 */
export function asClientWorld(mockWorld: MockWorld): ClientWorld {
  return mockWorld as unknown as ClientWorld;
}

/**
 * Create event handler tracker for testing event subscriptions
 *
 * @returns Object with methods to track and trigger events
 */
export function createEventTracker() {
  const handlers: Map<string, Set<(payload: unknown) => void>> = new Map();

  return {
    /**
     * Mock implementation for world.on()
     */
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
      return () => handlers.get(event)?.delete(handler);
    }),

    /**
     * Mock implementation for world.off()
     */
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.get(event)?.delete(handler);
    }),

    /**
     * Trigger an event with payload
     */
    trigger: (event: string, payload: unknown) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        eventHandlers.forEach((handler) => handler(payload));
      }
    },

    /**
     * Check if an event has handlers registered
     */
    hasHandlers: (event: string): boolean => {
      return (handlers.get(event)?.size ?? 0) > 0;
    },

    /**
     * Get handler count for an event
     */
    getHandlerCount: (event: string): number => {
      return handlers.get(event)?.size ?? 0;
    },

    /**
     * Clear all handlers
     */
    clear: () => {
      handlers.clear();
    },
  };
}
