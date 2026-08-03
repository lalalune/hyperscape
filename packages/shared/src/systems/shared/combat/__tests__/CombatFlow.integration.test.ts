/**
 * CombatFlow Integration Tests
 *
 * End-to-end tests for combat system flows:
 * - Full player-vs-mob combat cycle
 * - Mob death and state transitions
 * - Attack cooldowns across multiple ticks
 * - Combat timeout after inactivity
 * - Disconnect mid-combat handling
 * - PvP combat scenarios
 *
 * These tests verify complete combat flows using realistic
 * mock entities that simulate actual game behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CombatSystem } from "../CombatSystem";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";
import type { World } from "../../../../core/World";

// Track health changes for damage verification
interface HealthTracker {
  current: number;
  max: number;
  damageHistory: number[];
}

/**
 * Create a mock player entity with full combat capabilities
 */
function createTestPlayer(
  id: string,
  options: {
    health?: number;
    maxHealth?: number;
    position?: { x: number; y: number; z: number };
    stats?: { attack: number; strength: number; defence: number };
  } = {},
) {
  const healthTracker: HealthTracker = {
    current: options.health ?? 100,
    max: options.maxHealth ?? 100,
    damageHistory: [],
  };

  const position = options.position ?? { x: 0.5, y: 0, z: 0.5 }; // Default cardinal position
  const stats = options.stats ?? { attack: 10, strength: 10, defence: 10 };

  return {
    id,
    type: "player" as const,
    position,
    health: healthTracker.current,
    healthTracker, // Expose for test assertions
    stats: {
      ...stats,
      hitpoints: healthTracker.max,
    },
    data: {
      isLoading: false,
      stats: {
        ...stats,
        hitpoints: healthTracker.max,
      },
    },
    combat: {
      combatTarget: null as string | null,
      inCombat: false,
    },
    emote: "idle",
    base: { quaternion: { set: vi.fn(), copy: vi.fn() } },
    node: {
      position,
      quaternion: { set: vi.fn(), copy: vi.fn() },
    },
    getPosition: () => position,
    markNetworkDirty: vi.fn(),
    takeDamage: vi.fn((amount: number) => {
      healthTracker.damageHistory.push(amount);
      healthTracker.current = Math.max(0, healthTracker.current - amount);
      return healthTracker.current <= 0; // Return true if died
    }),
    getHealth: () => healthTracker.current,
    getComponent: (name: string) => {
      if (name === "health") {
        return {
          data: {
            current: healthTracker.current,
            max: healthTracker.max,
            isDead: healthTracker.current <= 0,
          },
        };
      }
      if (name === "stats") {
        return {
          data: {
            attack: stats.attack,
            strength: stats.strength,
            defense: stats.defence,
            ranged: 1,
          },
        };
      }
      return null;
    },
    // For PvP tests
    isDead: () => healthTracker.current <= 0,
    // Required for enterCombat dead player check (must be dynamic getter)
    get alive() {
      return healthTracker.current > 0;
    },
  };
}

/**
 * Create a mock mob entity with combat AI behavior
 */
function createTestMob(
  id: string,
  options: {
    health?: number;
    maxHealth?: number;
    position?: { x: number; y: number; z: number };
    stats?: { attack: number; strength: number; defence: number };
    combatRange?: number;
    attackSpeedTicks?: number;
  } = {},
) {
  const healthTracker: HealthTracker = {
    current: options.health ?? 50,
    max: options.maxHealth ?? 50,
    damageHistory: [],
  };

  const position = options.position ?? { x: 0.5, y: 0, z: 1.5 }; // Default cardinal north of player
  const stats = options.stats ?? { attack: 5, strength: 5, defence: 5 };
  const combatRange = options.combatRange ?? 1;
  const attackSpeedTicks =
    options.attackSpeedTicks ?? COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS;

  return {
    id,
    type: "mob" as const,
    position,
    health: healthTracker.current,
    healthTracker, // Expose for test assertions
    stats: {
      ...stats,
      hitpoints: healthTracker.max,
    },
    node: {
      position,
      quaternion: { set: vi.fn(), copy: vi.fn() },
    },
    getPosition: () => position,
    getMobData: () => ({
      health: healthTracker.current,
      attack: stats.attack,
      attackPower: stats.strength,
      defense: stats.defence,
      stats: {
        ...stats,
        hitpoints: healthTracker.max,
      },
      combatRange,
      attackSpeedTicks,
    }),
    getHealth: () => healthTracker.current,
    takeDamage: vi.fn((amount: number) => {
      healthTracker.damageHistory.push(amount);
      healthTracker.current = Math.max(0, healthTracker.current - amount);
      return healthTracker.current <= 0; // Return true if died
    }),
    isAttackable: () => healthTracker.current > 0,
    isDead: () => healthTracker.current <= 0,
    setServerEmote: vi.fn(),
    markNetworkDirty: vi.fn(),
  };
}

/**
 * Create a mock world with combat system support
 */
function createTestWorld(options: { currentTick?: number } = {}) {
  const eventHandlers = new Map<string, Function[]>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  let currentTick = options.currentTick ?? 100;

  // Combined entities map - CombatSystem uses entities.get() for mobs AND players
  // Damage handlers validate attackers via entities.get(attackerId)
  const entities = new Map<string, unknown>() as Map<string, unknown> & {
    players: Map<string, unknown>;
  };

  // Auto-syncing player map - automatically updates entities when players are added
  const playersInternalMap = new Map<
    string,
    ReturnType<typeof createTestPlayer>
  >();
  const players = {
    set: (id: string, player: ReturnType<typeof createTestPlayer>) => {
      playersInternalMap.set(id, player);
      entities.set(id, player); // Auto-sync to entities for damage handler validation
      return players;
    },
    get: (id: string) => playersInternalMap.get(id),
    delete: (id: string) => {
      entities.delete(id);
      return playersInternalMap.delete(id);
    },
    has: (id: string) => playersInternalMap.has(id),
    clear: () => {
      for (const id of playersInternalMap.keys()) {
        entities.delete(id);
      }
      playersInternalMap.clear();
    },
    get size() {
      return playersInternalMap.size;
    },
    [Symbol.iterator]: () => playersInternalMap[Symbol.iterator](),
    keys: () => playersInternalMap.keys(),
    values: () => playersInternalMap.values(),
    entries: () => playersInternalMap.entries(),
    forEach: (
      fn: (
        value: ReturnType<typeof createTestPlayer>,
        key: string,
        map: Map<string, ReturnType<typeof createTestPlayer>>,
      ) => void,
    ) => playersInternalMap.forEach(fn),
  };
  entities.players = players as unknown as Map<string, unknown>;

  // Auto-syncing mob map - automatically updates entities when mobs are added
  const mobsInternalMap = new Map<string, ReturnType<typeof createTestMob>>();
  const mobs = {
    set: (id: string, mob: ReturnType<typeof createTestMob>) => {
      mobsInternalMap.set(id, mob);
      entities.set(id, mob); // Auto-sync to entities
      return mobs;
    },
    get: (id: string) => mobsInternalMap.get(id),
    delete: (id: string) => {
      entities.delete(id);
      return mobsInternalMap.delete(id);
    },
    has: (id: string) => mobsInternalMap.has(id),
    clear: () => {
      for (const id of mobsInternalMap.keys()) {
        entities.delete(id);
      }
      mobsInternalMap.clear();
    },
    get size() {
      return mobsInternalMap.size;
    },
    [Symbol.iterator]: () => mobsInternalMap[Symbol.iterator](),
  };

  // Keep for backwards compatibility (no-op now since auto-sync)
  const syncMobsToEntities = () => {};

  // Mock PlayerSystem with damagePlayer method
  const mockPlayerSystem = {
    damagePlayer: vi.fn(
      (playerId: string, damage: number, _attackerId: string) => {
        const player = players.get(playerId);
        if (!player) return false;
        if (player.healthTracker.current <= 0) return false;

        player.healthTracker.damageHistory.push(damage);
        player.healthTracker.current = Math.max(
          0,
          player.healthTracker.current - damage,
        );
        player.health = player.healthTracker.current;
        return true;
      },
    ),
    getPlayer: (id: string) => players.get(id),
    // Critical: Return auto-retaliate setting (default true)
    getPlayerAutoRetaliate: () => true,
  };

  return {
    isServer: true,
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
    players, // Direct access for setup
    mobs, // Direct access for setup
    syncMobsToEntities, // Call after adding mobs
    emittedEvents, // For event verification
    network: {
      send: vi.fn(),
    },
    getPlayer: (id: string) => players.get(id),
    getSystem: (name: string) => {
      if (name === "entity-manager") {
        // Required by CombatSystem.init()
        return {
          getEntity: (id: string) => entities.get(id) || players.get(id),
        };
      }
      if (name === "equipment") {
        return {
          getPlayerEquipment: () => ({ weapon: null }),
        };
      }
      if (name === "player") {
        return mockPlayerSystem;
      }
      if (name === "mob-npc") {
        return {
          getMob: (id: string) => mobs.get(id),
        };
      }
      if (name === "ground-item") {
        return {
          spawnGroundItem: vi.fn(),
        };
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
    getEventHandlers: () => eventHandlers,
  };
}

describe("CombatFlow Integration", () => {
  let combatSystem: CombatSystem;
  let world: ReturnType<typeof createTestWorld>;

  beforeEach(async () => {
    world = createTestWorld({ currentTick: 100 });
    combatSystem = new CombatSystem(world as unknown as World);
    // CRITICAL: Call init() to cache playerSystem for auto-retaliate checks
    await combatSystem.init();
  });

  afterEach(() => {
    combatSystem.destroy();
  });

  describe("full player-vs-mob combat cycle", () => {
    it("completes combat from start to mob death", () => {
      // Setup: Player near a low-health mob (cardinal adjacent for classic MMORPG melee)
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
        stats: { attack: 50, strength: 50, defence: 10 },
      });
      const mob = createTestMob("mob1", {
        health: 10, // Low health to ensure death
        maxHealth: 10,
        position: { x: 0.5, y: 0, z: 1.5 }, // Cardinal north, not diagonal
        stats: { attack: 5, strength: 5, defence: 1 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.syncMobsToEntities();

      // Act 1: Start combat
      const combatStarted = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatStarted).toBe(true);
      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Act 2: Simulate combat ticks until mob dies
      let ticksElapsed = 0;
      const maxTicks = 50; // Safety limit

      while (!mob.isDead() && ticksElapsed < maxTicks) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
        ticksElapsed += COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS;
      }

      // Assert: Mob should be dead
      expect(mob.isDead()).toBe(true);
      expect(mob.healthTracker.current).toBe(0);
      expect(mob.takeDamage).toHaveBeenCalled();
    });

    it("tracks damage dealt throughout combat", () => {
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
        stats: { attack: 30, strength: 30, defence: 10 },
      });
      const mob = createTestMob("mob1", {
        health: 100,
        maxHealth: 100,
        position: { x: 0.5, y: 0, z: 1.5 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.syncMobsToEntities();

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Process multiple attack cycles
      for (let i = 0; i < 5; i++) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
      }

      // Verify damage history
      const damageHistory = mob.healthTracker.damageHistory;
      expect(damageHistory.length).toBeGreaterThan(0);

      // Total damage should match health loss
      const totalDamage = damageHistory.reduce((sum, d) => sum + d, 0);
      expect(mob.healthTracker.max - mob.healthTracker.current).toBe(
        totalDamage,
      );
    });
  });

  describe("attack cooldowns across multiple ticks", () => {
    it("respects attack cooldown between attacks", () => {
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const mob = createTestMob("mob1", {
        health: 200,
        position: { x: 0.5, y: 0, z: 1.5 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Process tick immediately - first attack should happen
      combatSystem.processCombatTick(world.currentTick);
      const attacksAfterFirst = mob.takeDamage.mock.calls.length;

      // Process tick 1 tick later - should still be on cooldown
      world.advanceTicks(1);
      combatSystem.processCombatTick(world.currentTick);
      expect(mob.takeDamage.mock.calls.length).toBe(attacksAfterFirst);

      // Process tick at half cooldown - still on cooldown
      world.advanceTicks(1);
      combatSystem.processCombatTick(world.currentTick);
      expect(mob.takeDamage.mock.calls.length).toBe(attacksAfterFirst);

      // Process tick after full cooldown - should attack again
      world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
      combatSystem.processCombatTick(world.currentTick);
      expect(mob.takeDamage.mock.calls.length).toBeGreaterThan(
        attacksAfterFirst,
      );
    });

    it("tracks next attack tick correctly", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 500 });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const startTick = world.currentTick;

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // First attack happens on start
      combatSystem.processCombatTick(startTick);

      // Count attacks over time
      const attackCount = mob.takeDamage.mock.calls.length;
      const expectedAttacks: number[] = [attackCount];

      for (let i = 1; i <= 20; i++) {
        world.setTick(startTick + i);
        combatSystem.processCombatTick(world.currentTick);
        expectedAttacks.push(mob.takeDamage.mock.calls.length);
      }

      // Attacks should only happen every DEFAULT_ATTACK_SPEED_TICKS
      const attackTicks = expectedAttacks.reduce((acc, count, idx) => {
        if (idx > 0 && count > expectedAttacks[idx - 1]) {
          acc.push(idx);
        }
        return acc;
      }, [] as number[]);

      // Verify attack spacing (should be ~4 ticks apart)
      for (let i = 1; i < attackTicks.length; i++) {
        const gap = attackTicks[i] - attackTicks[i - 1];
        expect(gap).toBeGreaterThanOrEqual(
          COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS - 1,
        );
      }
    });
  });

  describe("combat timeout after inactivity", () => {
    it("ends combat after 8 ticks of inactivity", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 1000 }); // High health to not die

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Advance past combat timeout (8 ticks + some buffer)
      const timeoutTicks = COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS + 2;
      world.advanceTicks(timeoutTicks);

      // Process tick to trigger timeout check
      combatSystem.processCombatTick(world.currentTick);

      // Combat should have ended due to timeout
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("resets timeout when combat activity occurs", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 1000 });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Advance almost to timeout
      world.advanceTicks(COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS - 1);
      combatSystem.processCombatTick(world.currentTick);

      // Combat should still be active
      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Another attack happens (refreshes timeout)
      world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
      combatSystem.processCombatTick(world.currentTick);

      // Should still be in combat
      expect(combatSystem.isInCombat("player1")).toBe(true);
    });

    it("maintains combat state until timeout after target dies", () => {
      const player = createTestPlayer("player1", {
        stats: { attack: 99, strength: 99, defence: 10 },
      });
      const mob = createTestMob("mob1", {
        health: 5, // Very low health
        position: { x: 0.5, y: 0, z: 1.5 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Process until mob dies (with safety limit)
      let iterations = 0;
      const maxIterations = 100;
      while (!mob.isDead() && iterations < maxIterations) {
        world.advanceTicks(1);
        combatSystem.processCombatTick(world.currentTick);
        iterations++;
      }

      // Mob should be dead within reasonable time
      expect(mob.isDead()).toBe(true);

      // After timeout, combat should end
      world.advanceTicks(COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS + 2);
      combatSystem.processCombatTick(world.currentTick);

      expect(combatSystem.isInCombat("player1")).toBe(false);
    });
  });

  describe("disconnect mid-combat handling", () => {
    it("cleans up combat state when player disconnects", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1");

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Simulate disconnect
      combatSystem.cleanupPlayerDisconnect("player1");

      // Combat state should be cleared
      expect(combatSystem.isInCombat("player1")).toBe(false);
      expect(combatSystem.getCombatData("player1")).toBeNull();
    });

    it("cleans up anti-cheat tracking on disconnect", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1");

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Process some combat ticks to potentially generate anti-cheat data
      for (let i = 0; i < 10; i++) {
        world.advanceTicks(1);
        combatSystem.processCombatTick(world.currentTick);
      }

      // Disconnect should clean up without errors
      expect(() => {
        combatSystem.cleanupPlayerDisconnect("player1");
      }).not.toThrow();
    });

    it("handles disconnect for player not in combat", () => {
      expect(() => {
        combatSystem.cleanupPlayerDisconnect("nonexistent");
      }).not.toThrow();
    });

    it("mob resets when player disconnects mid-combat", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 100 });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Deal some damage
      for (let i = 0; i < 3; i++) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
      }

      // Player disconnects
      combatSystem.cleanupPlayerDisconnect("player1");

      // Mob should no longer be engaged with this player
      const mobCombatData = combatSystem.getCombatData("mob1");
      // Either no combat data or not targeting disconnected player
      if (mobCombatData) {
        expect(mobCombatData.targetId).not.toBe("player1");
      }
    });
  });

  describe("multiple concurrent combats", () => {
    it("handles multiple players fighting different mobs", () => {
      const player1 = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const player2 = createTestPlayer("player2", {
        position: { x: 10.5, y: 0, z: 10.5 },
      });
      const mob1 = createTestMob("mob1", {
        position: { x: 0.5, y: 0, z: 1.5 },
      });
      const mob2 = createTestMob("mob2", {
        position: { x: 10.5, y: 0, z: 11.5 }, // Cardinal north from player2
      });

      world.players.set("player1", player1);
      world.players.set("player2", player2);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);

      // Start both combats
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      combatSystem.startCombat("player2", "mob2", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.isInCombat("player1")).toBe(true);
      expect(combatSystem.isInCombat("player2")).toBe(true);

      // Process combat ticks
      for (let i = 0; i < 5; i++) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
      }

      // Both mobs should have taken damage
      expect(mob1.takeDamage).toHaveBeenCalled();
      expect(mob2.takeDamage).toHaveBeenCalled();
    });

    it("handles multiple players attacking same mob", () => {
      const player1 = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 }, // Cardinal south of mob
      });
      const player2 = createTestPlayer("player2", {
        position: { x: 1.5, y: 0, z: 1.5 }, // Cardinal east of mob
      });
      const mob = createTestMob("mob1", {
        health: 200,
        position: { x: 0.5, y: 0, z: 1.5 },
      });

      world.players.set("player1", player1);
      world.players.set("player2", player2);
      world.mobs.set("mob1", mob);

      // Both players attack same mob
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      combatSystem.startCombat("player2", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.isInCombat("player1")).toBe(true);
      expect(combatSystem.isInCombat("player2")).toBe(true);

      // Process ticks - both should deal damage
      for (let i = 0; i < 5; i++) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
      }

      // Mob should have received damage from both players
      // (damage count >= number of attacks from both players)
      expect(mob.takeDamage.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("combat state transitions", () => {
    it("transitions from idle to in_combat correctly", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1");

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      // Initial state
      expect(combatSystem.isInCombat("player1")).toBe(false);
      expect(combatSystem.getCombatData("player1")).toBeNull();

      // Start combat
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // In combat
      expect(combatSystem.isInCombat("player1")).toBe(true);
      const combatData = combatSystem.getCombatData("player1");
      expect(combatData).not.toBeNull();
      expect(combatData?.targetId).toBe("mob1");
    });

    it("transitions from in_combat to idle after timeout", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 1000 });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.isInCombat("player1")).toBe(true);

      // Force end combat
      combatSystem.forceEndCombat("player1");

      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("getAllCombatStates returns all active combats", () => {
      const player1 = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const player2 = createTestPlayer("player2", {
        position: { x: 10.5, y: 0, z: 10.5 },
      });
      const mob1 = createTestMob("mob1", {
        position: { x: 0.5, y: 0, z: 1.5 },
      });
      const mob2 = createTestMob("mob2", {
        position: { x: 10.5, y: 0, z: 11.5 }, // Cardinal north from player2
      });

      world.players.set("player1", player1);
      world.players.set("player2", player2);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      combatSystem.startCombat("player2", "mob2", {
        attackerType: "player",
        targetType: "mob",
      });

      const allStates = combatSystem.stateService.getAllCombatStates();
      // At least 2 states (might be more with mutual combat)
      expect(allStates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("edge cases", () => {
    it("prevents combat when target is out of range", () => {
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const mob = createTestMob("mob1", {
        position: { x: 100, y: 0, z: 100 }, // Far away
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("prevents combat when attacker is dead", () => {
      const player = createTestPlayer("player1", {
        health: 0, // Dead player
      });
      const mob = createTestMob("mob1");

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("prevents combat when target is dead", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", {
        health: 0, // Dead mob
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("handles combat with entity that gets removed mid-fight", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 100 });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Remove mob mid-combat
      world.mobs.delete("mob1");

      // Process tick - should handle gracefully
      expect(() => {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
      }).not.toThrow();
    });

    it("handles rapid combat start/stop cycles", () => {
      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1");

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      // Rapid cycles should not cause issues
      for (let i = 0; i < 10; i++) {
        combatSystem.startCombat("player1", "mob1", {
          attackerType: "player",
          targetType: "mob",
        });
        combatSystem.forceEndCombat("player1");
      }

      // Final state should be out of combat
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });
  });

  describe("pool resource management", () => {
    it("maintains pool integrity through combat cycle", () => {
      const initialStats = combatSystem.getPoolStats();
      const initialQuaternions = initialStats.quaternions.inUse;

      const player = createTestPlayer("player1");
      const mob = createTestMob("mob1", { health: 50 });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Process many ticks (uses quaternion pool for rotations)
      for (let i = 0; i < 20; i++) {
        world.advanceTicks(1);
        combatSystem.processCombatTick(world.currentTick);
      }

      combatSystem.forceEndCombat("player1");

      // Pool should return to similar state
      const finalStats = combatSystem.getPoolStats();
      expect(finalStats.quaternions.inUse).toBeLessThanOrEqual(
        initialQuaternions + 5,
      );
    });
  });

  /**
   * rules-accurate auto-retaliate target persistence tests
   *
   * @see AUTO_RETALIATE_FIX_PLAN.md
   *
   * In classic MMORPG, auto-retaliate ONLY triggers when the player has NO current target.
   * When player is already fighting an enemy, getting attacked by another enemy
   * does NOT cause the player to switch targets.
   */
  describe("rules-accurate auto-retaliate target persistence", () => {
    it("does NOT switch targets when attacked by second enemy while fighting", () => {
      // Setup: Player with two mobs at different positions
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const mob1 = createTestMob("mob1", {
        health: 100,
        position: { x: 0.5, y: 0, z: 1.5 }, // Cardinal north of player
      });
      const mob2 = createTestMob("mob2", {
        health: 100,
        position: { x: 1.5, y: 0, z: 0.5 }, // Cardinal east of player
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);

      // Act 1: Player attacks mob1
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Verify player is targeting mob1
      const initialState = combatSystem.getCombatData("player1");
      expect(initialState?.targetId).toBe("mob1");

      // Process a tick to establish combat
      combatSystem.processCombatTick(world.currentTick);

      // Act 2: mob2 attacks player while player is fighting mob1
      // This simulates another enemy walking up and attacking
      combatSystem.startCombat("mob2", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Assert: Player should STILL be targeting mob1, NOT mob2
      // This is the rules-accurate behavior
      const afterState = combatSystem.getCombatData("player1");
      expect(afterState?.targetId).toBe("mob1");
      expect(afterState?.targetId).not.toBe("mob2");
    });

    it("auto-retaliates to attacker when player has no current target", () => {
      // Setup: Player is idle (not in combat)
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const mob1 = createTestMob("mob1", {
        health: 100,
        position: { x: 0.5, y: 0, z: 1.5 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob1);

      // Verify player is NOT in combat initially
      expect(combatSystem.isInCombat("player1")).toBe(false);

      // Act: mob1 attacks idle player
      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Assert: Player should now target mob1 (auto-retaliate triggered)
      const combatData = combatSystem.getCombatData("player1");
      expect(combatData).not.toBeNull();
      expect(combatData?.targetId).toBe("mob1");
      expect(combatData?.inCombat).toBe(true);
    });

    it("maintains target through multiple attacks from different enemies", () => {
      // Setup: Player fighting mob1, mob2 and mob3 both attack
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const mob1 = createTestMob("mob1", {
        health: 100,
        position: { x: 0.5, y: 0, z: 1.5 },
      });
      const mob2 = createTestMob("mob2", {
        health: 100,
        position: { x: 1.5, y: 0, z: 0.5 },
      });
      const mob3 = createTestMob("mob3", {
        health: 100,
        position: { x: -0.5, y: 0, z: 0.5 }, // Cardinal west of player
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);
      world.mobs.set("mob3", mob3);

      // Player starts attacking mob1
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.getCombatData("player1")?.targetId).toBe("mob1");

      // mob2 attacks player
      combatSystem.startCombat("mob2", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Still targeting mob1
      expect(combatSystem.getCombatData("player1")?.targetId).toBe("mob1");

      // mob3 also attacks player
      combatSystem.startCombat("mob3", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // STILL targeting mob1 - rules-accurate
      expect(combatSystem.getCombatData("player1")?.targetId).toBe("mob1");

      // Process some combat ticks
      for (let i = 0; i < 5; i++) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
      }

      // After multiple attacks, still targeting mob1
      expect(combatSystem.getCombatData("player1")?.targetId).toBe("mob1");
    });

    it("switches to last attacker after current target dies", () => {
      // Setup: Player attacking mob1, mob2 attacks player
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
        stats: { attack: 99, strength: 99, defence: 10 }, // High damage to kill quickly
      });
      const mob1 = createTestMob("mob1", {
        health: 5, // Very low health
        position: { x: 0.5, y: 0, z: 1.5 },
      });
      const mob2 = createTestMob("mob2", {
        health: 100,
        position: { x: 1.5, y: 0, z: 0.5 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);

      // Player attacks mob1
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // mob2 attacks player (while player is fighting mob1)
      combatSystem.startCombat("mob2", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Verify still targeting mob1
      expect(combatSystem.getCombatData("player1")?.targetId).toBe("mob1");

      // Process ticks until mob1 dies
      let maxIterations = 20;
      while (!mob1.isDead() && maxIterations > 0) {
        world.advanceTicks(COMBAT_CONSTANTS.DEFAULT_ATTACK_SPEED_TICKS);
        combatSystem.processCombatTick(world.currentTick);
        maxIterations--;
      }

      expect(mob1.isDead()).toBe(true);

      // Force end combat with dead mob1 to clean up state
      combatSystem.forceEndCombat("player1");

      // Now have mob2 attack player again (simulating ongoing aggro)
      combatSystem.startCombat("mob2", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Player should now auto-retaliate to mob2 (their current target is dead/gone)
      const afterState = combatSystem.getCombatData("player1");
      expect(afterState?.targetId).toBe("mob2");
    });

    it("extends combat timer when attacked while already fighting", () => {
      // Setup: Player fighting mob1
      const player = createTestPlayer("player1", {
        position: { x: 0.5, y: 0, z: 0.5 },
      });
      const mob1 = createTestMob("mob1", {
        health: 1000, // High health to not die
        position: { x: 0.5, y: 0, z: 1.5 },
      });
      const mob2 = createTestMob("mob2", {
        health: 100,
        position: { x: 1.5, y: 0, z: 0.5 },
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob1);
      world.mobs.set("mob2", mob2);

      // Player attacks mob1
      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Advance almost to combat timeout
      world.advanceTicks(COMBAT_CONSTANTS.COMBAT_TIMEOUT_TICKS - 1);
      combatSystem.processCombatTick(world.currentTick);

      // mob2 attacks player - should extend combat timer
      combatSystem.startCombat("mob2", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Advance a few more ticks (would have timed out without extension)
      world.advanceTicks(3);
      combatSystem.processCombatTick(world.currentTick);

      // Player should still be in combat (timer was extended)
      expect(combatSystem.isInCombat("player1")).toBe(true);
      // And still targeting mob1
      expect(combatSystem.getCombatData("player1")?.targetId).toBe("mob1");
    });
  });
});
