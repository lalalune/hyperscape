/**
 * Player Mock Factories
 *
 * Creates strongly-typed player mocks that match production interfaces.
 * All mocks implement real interfaces to ensure test/production parity.
 */

import type { TestPosition } from "../validation";
import { expectValidPosition, expectValidPlayerId } from "../validation";

/**
 * Player data structure matching production PlayerEntity
 */
export interface MockPlayer {
  id: string;
  visibleName: string;
  position: TestPosition;
  health: { current: number; max: number };
  isAlive: boolean;
  inventory: Map<number, { itemId: string; quantity: number }>;
  equipment: Map<string, { itemId: string; slot: string }>;
  stats: {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
    hitpoints: number;
  };
  // Methods that match production interface
  getPosition(): TestPosition;
  getInventoryItems(): Array<{ itemId: string; quantity: number; slot: number }>;
  isInCombat(): boolean;
}

/**
 * Options for creating a mock player
 */
export interface CreateMockPlayerOptions {
  id?: string;
  visibleName?: string;
  position?: Partial<TestPosition>;
  health?: { current?: number; max?: number };
  stats?: Partial<MockPlayer["stats"]>;
  inventory?: Array<{ slot: number; itemId: string; quantity: number }>;
  equipment?: Array<{ slot: string; itemId: string }>;
}

/**
 * Default player configuration
 */
const DEFAULT_PLAYER: Required<
  Omit<CreateMockPlayerOptions, "inventory" | "equipment">
> = {
  id: "player-test-001",
  visibleName: "TestPlayer",
  position: { x: 10, y: 0, z: 10 },
  health: { current: 100, max: 100 },
  stats: {
    attack: 1,
    strength: 1,
    defense: 1,
    ranged: 1,
    hitpoints: 10,
  },
};

/**
 * Create a mock player with strongly-typed defaults
 *
 * @example
 * const player = createMockPlayer(); // Default player at (10, 0, 10)
 * const customPlayer = createMockPlayer({
 *   id: 'player-123',
 *   position: { x: 50, z: 50 },
 *   health: { current: 50, max: 100 }
 * });
 */
export function createMockPlayer(
  options: CreateMockPlayerOptions = {}
): MockPlayer {
  const id = options.id ?? DEFAULT_PLAYER.id;
  expectValidPlayerId(id, "MockPlayer.id");

  const position: TestPosition = {
    x: options.position?.x ?? DEFAULT_PLAYER.position.x,
    y: options.position?.y ?? DEFAULT_PLAYER.position.y,
    z: options.position?.z ?? DEFAULT_PLAYER.position.z,
  };
  expectValidPosition(position, "MockPlayer.position");

  const health = {
    current: options.health?.current ?? DEFAULT_PLAYER.health.current,
    max: options.health?.max ?? DEFAULT_PLAYER.health.max,
  };

  const stats = {
    ...DEFAULT_PLAYER.stats,
    ...options.stats,
  };

  const inventory = new Map<number, { itemId: string; quantity: number }>();
  if (options.inventory) {
    for (const item of options.inventory) {
      inventory.set(item.slot, { itemId: item.itemId, quantity: item.quantity });
    }
  }

  const equipment = new Map<string, { itemId: string; slot: string }>();
  if (options.equipment) {
    for (const item of options.equipment) {
      equipment.set(item.slot, { itemId: item.itemId, slot: item.slot });
    }
  }

  // Track combat state internally
  let inCombat = false;

  const player: MockPlayer = {
    id,
    visibleName: options.visibleName ?? DEFAULT_PLAYER.visibleName,
    position,
    health,
    isAlive: health.current > 0,
    inventory,
    equipment,
    stats,
    getPosition: () => ({ ...position }),
    getInventoryItems: () =>
      Array.from(inventory.entries()).map(([slot, item]) => ({
        ...item,
        slot,
      })),
    isInCombat: () => inCombat,
  };

  // Add method to set combat state (for testing)
  (player as MockPlayer & { setInCombat: (value: boolean) => void }).setInCombat =
    (value: boolean) => {
      inCombat = value;
    };

  return player;
}

/**
 * Create a player at a specific position (convenience factory)
 */
export function createMockPlayerAt(
  x: number,
  z: number,
  options: Omit<CreateMockPlayerOptions, "position"> = {}
): MockPlayer {
  return createMockPlayer({
    ...options,
    position: { x, y: 0, z },
  });
}

/**
 * Create a player with specific health (convenience factory)
 */
export function createMockPlayerWithHealth(
  current: number,
  max: number = 100,
  options: Omit<CreateMockPlayerOptions, "health"> = {}
): MockPlayer {
  return createMockPlayer({
    ...options,
    health: { current, max },
  });
}

/**
 * Create multiple players at different positions
 */
export function createMockPlayers(
  count: number,
  baseOptions: CreateMockPlayerOptions = {}
): MockPlayer[] {
  const players: MockPlayer[] = [];
  for (let i = 0; i < count; i++) {
    players.push(
      createMockPlayer({
        ...baseOptions,
        id: `player-${i + 1}`,
        visibleName: `Player${i + 1}`,
        position: {
          x: 10 + i * 5,
          y: 0,
          z: 10 + i * 5,
        },
      })
    );
  }
  return players;
}
