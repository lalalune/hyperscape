/**
 * OSRS Melee Range Integration Tests
 *
 * End-to-end tests for OSRS-accurate melee combat range mechanics:
 * - Range 1 (standard melee): CARDINAL ONLY (N/S/E/W)
 * - Range 2+ (halberd/spear): Allows diagonal (Chebyshev distance)
 * - Walk-to-attack pathing for out-of-range targets
 * - Infinite follow behavior (no timeout)
 *
 * @see https://oldschool.runescape.wiki/w/Attack_range
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CombatSystem } from "../CombatSystem";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";
import { EventType } from "../../../../types/events";

/**
 * Create a mock player entity with position control
 */
function createTestPlayer(
  id: string,
  options: {
    health?: number;
    position?: { x: number; y: number; z: number };
    weaponRange?: number;
  } = {},
) {
  const health = options.health ?? 100;
  // Use same position object for all references so mutations propagate correctly
  const position = options.position ?? { x: 0, y: 0, z: 0 };
  const weaponRange = options.weaponRange ?? 1; // Default standard melee

  return {
    id,
    type: "player" as const,
    position: position, // Same object reference
    health,
    data: {
      isLoading: false,
      stats: { attack: 50, strength: 50, defence: 50, hitpoints: 100 },
    },
    emote: "idle",
    base: { quaternion: { set: vi.fn(), copy: vi.fn() } },
    node: {
      position: position, // Same object reference
      quaternion: { set: vi.fn(), copy: vi.fn() },
    },
    weaponRange, // For equipment system mock
    getPosition: () => position,
    markNetworkDirty: vi.fn(),
    takeDamage: vi.fn((amount: number) => Math.max(0, health - amount)),
    getHealth: () => health,
    getComponent: (name: string) => {
      if (name === "health") {
        return { data: { current: health, max: 100, isDead: health <= 0 } };
      }
      if (name === "stats") {
        return {
          data: { attack: 50, strength: 50, defense: 50, ranged: 1 },
        };
      }
      return null;
    },
    isDead: () => health <= 0,
  };
}

/**
 * Create a mock mob entity with position and combat range
 */
function createTestMob(
  id: string,
  options: {
    health?: number;
    position?: { x: number; y: number; z: number };
    combatRange?: number;
  } = {},
) {
  const health = { current: options.health ?? 100, max: options.health ?? 100 };
  // Use same position object for all references so mutations propagate correctly
  const position = options.position ?? { x: 1, y: 0, z: 1 };
  const combatRange = options.combatRange ?? 1;

  return {
    id,
    type: "mob" as const,
    position: position, // Same object reference
    health: health.current,
    node: {
      position: position, // Same object reference
      quaternion: { set: vi.fn(), copy: vi.fn() },
    },
    getPosition: () => position,
    getMobData: () => ({
      health: health.current,
      attack: 10,
      attackPower: 10,
      defense: 10,
      stats: { attack: 10, strength: 10, defence: 10, hitpoints: health.max },
      combatRange,
      attackSpeedTicks: COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS,
    }),
    getHealth: () => health.current,
    takeDamage: vi.fn((amount: number) => {
      health.current = Math.max(0, health.current - amount);
      return health.current;
    }),
    getCombatRange: () => combatRange,
    isAttackable: () => health.current > 0,
    isDead: () => health.current <= 0,
    setServerEmote: vi.fn(),
    markNetworkDirty: vi.fn(),
  };
}

/**
 * Create a mock world with melee range testing support
 */
function createTestWorld(options: { currentTick?: number } = {}) {
  const players = new Map<string, ReturnType<typeof createTestPlayer>>();
  const eventHandlers = new Map<string, Function[]>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  let currentTick = options.currentTick ?? 100;

  const entities = new Map<string, unknown>() as Map<string, unknown> & {
    players: Map<string, ReturnType<typeof createTestPlayer>>;
  };
  entities.players = players;

  // Mock EventBus for SystemBase.emitTypedEvent()
  const mockEventBus = {
    emitEvent: vi.fn((type: string, data: unknown, _source?: string) => {
      emittedEvents.push({ event: type, data });
      // Also trigger handlers registered via world.on()
      const handlers = eventHandlers.get(type) || [];
      handlers.forEach((h) => h(data));
    }),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    subscribeOnce: vi.fn(() => ({ unsubscribe: vi.fn() })),
  };

  const mobsMap = new Map<string, ReturnType<typeof createTestMob>>();
  const mobs = {
    set: (id: string, mob: ReturnType<typeof createTestMob>) => {
      mobsMap.set(id, mob);
      entities.set(id, mob);
      return mobs;
    },
    get: (id: string) => mobsMap.get(id),
    delete: (id: string) => {
      entities.delete(id);
      return mobsMap.delete(id);
    },
    has: (id: string) => mobsMap.has(id),
  };

  // Store weapon ranges for players
  const playerWeaponRanges = new Map<string, number>();

  return {
    isServer: true,
    $eventBus: mockEventBus, // Required by SystemBase for emitTypedEvent()
    get currentTick() {
      return currentTick;
    },
    setTick(tick: number) {
      currentTick = tick;
    },
    advanceTicks(count: number) {
      currentTick += count;
    },
    entities,
    players,
    mobs,
    playerWeaponRanges,
    emittedEvents,
    network: { send: vi.fn() },
    getPlayer: (id: string) => players.get(id),
    getSystem: (name: string) => {
      if (name === "equipment") {
        return {
          getPlayerEquipment: (playerId: string) => {
            const range = playerWeaponRanges.get(playerId) ?? 1;
            if (range === 1) {
              return { weapon: null }; // No weapon = unarmed = range 1
            }
            return {
              weapon: {
                item: {
                  id: range === 2 ? "dragon_halberd" : "bronze_sword",
                  attackRange: range,
                },
              },
            };
          },
        };
      }
      if (name === "player") {
        return {
          damagePlayer: vi.fn(),
          getPlayer: (id: string) => players.get(id),
        };
      }
      if (name === "mob-npc") {
        return { getMob: (id: string) => mobs.get(id) };
      }
      if (name === "ground-item") {
        return { spawnGroundItem: vi.fn() };
      }
      return undefined;
    },
    on: (event: string, handler: Function) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event)!.push(handler);
    },
    off: vi.fn(),
    emit: vi.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((h) => h(data));
    }),
  };
}

describe("OSRS Melee Range Integration", () => {
  let combatSystem: CombatSystem;
  let world: ReturnType<typeof createTestWorld>;

  beforeEach(() => {
    world = createTestWorld({ currentTick: 100 });
    combatSystem = new CombatSystem(world as unknown as never);
  });

  afterEach(() => {
    combatSystem.destroy();
  });

  describe("player attacks with standard melee (range 1)", () => {
    it("player CAN attack mob cardinally NORTH (0,0) -> (0,1)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Tile (5, 6) - NORTH
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1); // Standard melee

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
      expect(combatSystem.isInCombat("player1")).toBe(true);
    });

    it("player CAN attack mob cardinally SOUTH (5,5) -> (5,4)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 4.5 }, // Tile (5, 4) - SOUTH
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });

    it("player CAN attack mob cardinally EAST (5,5) -> (6,5)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 6.5, y: 0, z: 5.5 }, // Tile (6, 5) - EAST
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });

    it("player CAN attack mob cardinally WEST (5,5) -> (4,5)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 4.5, y: 0, z: 5.5 }, // Tile (4, 5) - WEST
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });

    it("player CANNOT attack mob diagonally NE (5,5) -> (6,6) with range 1", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Tile (6, 6) - DIAGONAL NE
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("player CANNOT attack mob diagonally NW (5,5) -> (4,6) with range 1", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 4.5, y: 0, z: 6.5 }, // Tile (4, 6) - DIAGONAL NW
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("player CANNOT attack mob diagonally SE (5,5) -> (6,4) with range 1", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 6.5, y: 0, z: 4.5 }, // Tile (6, 4) - DIAGONAL SE
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("player CANNOT attack mob diagonally SW (5,5) -> (4,4) with range 1", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 4.5, y: 0, z: 4.5 }, // Tile (4, 4) - DIAGONAL SW
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });
  });

  describe("player attacks with halberd (range 2)", () => {
    it("player CAN attack mob diagonally NE with halberd range 2", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Tile (6, 6) - DIAGONAL
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 2); // Halberd

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
      expect(combatSystem.isInCombat("player1")).toBe(true);
    });

    it("player CAN attack mob 2 tiles away cardinally with halberd", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 7.5 }, // Tile (5, 7) - 2 tiles north
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 2);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });

    it("player CANNOT attack mob 3 tiles away with halberd (range 2)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 8.5 }, // Tile (5, 8) - 3 tiles north
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 2);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("player CAN attack mob diagonally 2 tiles away (7,7) from (5,5)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 7.5, y: 0, z: 7.5 }, // Tile (7, 7) - 2 tiles diagonal
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 2);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });
  });

  describe("mob attacks with melee range", () => {
    it("mob with range 1 CAN attack player cardinally", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Tile (5, 6)
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        combatRange: 1,
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const result = combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      expect(result).toBe(true);
    });

    it("mob with range 1 CANNOT attack player diagonally", () => {
      const player = createTestPlayer("player1", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Tile (6, 6) - diagonal
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        combatRange: 1,
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const result = combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      expect(result).toBe(false);
    });

    it("mob with range 2 CAN attack player diagonally", () => {
      const player = createTestPlayer("player1", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Tile (6, 6) - diagonal
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        combatRange: 2, // Extended range mob
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const result = combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      expect(result).toBe(true);
    });
  });

  describe("auto-attack range checks during combat", () => {
    it("auto-attack succeeds when cardinally adjacent (range 1)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Cardinal north
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Process combat tick - should deal damage
      world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
      combatSystem.processCombatTick(world.currentTick);

      expect(mob.takeDamage).toHaveBeenCalled();
    });

    it("auto-attack fails when target moves to diagonal (range 1)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Start cardinal
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // First attack works
      combatSystem.processCombatTick(world.currentTick);
      const callsAfterFirst = mob.takeDamage.mock.calls.length;

      // Move mob to diagonal position
      mob.position.x = 6.5;
      mob.position.z = 6.5;
      mob.node.position.x = 6.5;
      mob.node.position.z = 6.5;

      // Next attack should miss (out of cardinal range)
      world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
      combatSystem.processCombatTick(world.currentTick);

      // Damage calls should not increase (attack missed due to range)
      expect(mob.takeDamage.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  describe("combat follow events when out of range", () => {
    it("emits COMBAT_FOLLOW_TARGET when player out of melee range", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Start in range
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const started = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Debug: Verify combat actually started
      expect(started).toBe(true);
      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Move mob out of range BEFORE first attack tick
      mob.position.x = 10.5;
      mob.position.z = 10.5;

      // Debug: Verify position was mutated correctly
      expect(mob.getPosition().x).toBe(10.5);
      expect(mob.getPosition().z).toBe(10.5);

      // Clear previous events
      world.emittedEvents.length = 0;

      // Process attack tick - should emit follow event since out of range
      world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
      combatSystem.processCombatTick(world.currentTick);

      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );
      expect(followEvent).toBeDefined();
      expect(followEvent?.data).toMatchObject({
        playerId: "player1",
        targetId: "mob1",
        meleeRange: 1,
      });
    });

    it("follow event includes correct meleeRange for halberd", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Start in range for halberd
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 2); // Halberd

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Move mob out of halberd range
      mob.position.x = 20.5;
      mob.position.z = 20.5;
      mob.node.position.x = 20.5;
      mob.node.position.z = 20.5;

      world.emittedEvents.length = 0;
      // Process at attack speed interval to trigger range check
      world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
      combatSystem.processCombatTick(world.currentTick);

      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );
      expect(followEvent).toBeDefined();
      expect(followEvent?.data).toMatchObject({
        meleeRange: 2, // Halberd range
      });
    });
  });

  describe("tile boundary edge cases", () => {
    it("handles sub-tile positions correctly (same tile = no attack)", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.1, y: 0, z: 5.1 }, // Tile (5, 5)
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.9, y: 0, z: 5.9 }, // Also tile (5, 5)
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      // Same tile = cannot attack (need to be adjacent, not overlapping)
      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("handles tile boundary at 0.0 correctly", () => {
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 }, // Tile (0, 0)
      });
      const mob = createTestMob("mob1", {
        position: { x: 1.5, y: 0, z: 0.5 }, // Tile (1, 0) - east
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });

    it("handles negative tile coordinates", () => {
      const player = createTestPlayer("player1", {
        position: { x: -5.5, y: 0, z: -5.5 }, // Tile (-6, -6)
      });
      const mob = createTestMob("mob1", {
        position: { x: -5.5, y: 0, z: -4.5 }, // Tile (-6, -5) - north
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
    });
  });

  describe("weapon switching mid-combat", () => {
    it("uses updated weapon range after weapon switch", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Diagonal
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1); // Start with sword

      // Cannot attack diagonally with range 1
      const result1 = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      expect(result1).toBe(false);

      // Switch to halberd
      world.playerWeaponRanges.set("player1", 2);

      // Now can attack diagonally
      const result2 = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      expect(result2).toBe(true);
    });
  });

  describe("multi-target combat with different ranges", () => {
    it("player can attack different mobs at different ranges", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob1 = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Cardinal (range 1 ok)
        health: 100,
      });
      const mob2 = createTestMob("mob2", {
        position: { x: 6.5, y: 0, z: 6.5 }, // Diagonal (range 1 not ok)
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);
      world.playerWeaponRanges.set("player1", 1);

      // Can attack cardinal mob
      const result1 = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      expect(result1).toBe(true);

      // End combat to attack different target
      combatSystem.forceEndCombat("player1");

      // Cannot attack diagonal mob with range 1
      const result2 = combatSystem.startCombat("player1", "mob2", {
        attackerType: "player",
        targetType: "mob",
      });
      expect(result2).toBe(false);

      // Switch to halberd and try again
      world.playerWeaponRanges.set("player1", 2);
      const result3 = combatSystem.startCombat("player1", "mob2", {
        attackerType: "player",
        targetType: "mob",
      });
      expect(result3).toBe(true);
    });
  });

  describe("combat timeout behavior (OSRS-style)", () => {
    it("combat timeout is extended when follow events are emitted", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // In range initially
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.playerWeaponRanges.set("player1", 1);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Move mob out of range (simulating it running)
      mob.position.x = 10.5;
      mob.position.z = 10.5;
      mob.node.position.x = 10.5;
      mob.node.position.z = 10.5;

      // Process a few ticks while out of range - combat should persist
      // because checkRangeAndFollow extends the timeout
      for (let i = 0; i < 5; i++) {
        world.advanceTicks(1);
        combatSystem.processCombatTick(world.currentTick);
      }

      // Combat should still be active (timeout extended by follow)
      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Verify follow events were emitted
      const followEvents = world.emittedEvents.filter(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );
      expect(followEvents.length).toBeGreaterThan(0);
    });

    it("combat ends after activity timeout (8 ticks) when in range but no attacks", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 },
        health: 10000, // Very high health
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Advance past timeout without any combat activity
      world.advanceTicks(COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS + 2);
      combatSystem.processCombatTick(world.currentTick);

      // Should have timed out
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });
  });
});
