/**
 * Rules-Accurate Auto-Retaliate Movement Tests
 *
 * Tests the critical classic MMORPG behavior: when auto-retaliate triggers,
 * the player's movement destination is REPLACED with the attacker's position.
 *
 * Key classic MMORPG behaviors tested:
 * - Auto-retaliate ON: Player moves toward attacker (cancels "run away" movement)
 * - Auto-retaliate OFF: Player keeps their current movement (can run away)
 *
 * "the player's character walks/runs towards the monster attacking and fights back"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CombatSystem } from "../CombatSystem";
import { EventType } from "../../../../types/events";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";

/**
 * Create a mock player entity
 */
function createTestPlayer(
  id: string,
  options: {
    health?: number;
    position?: { x: number; y: number; z: number };
    autoRetaliate?: boolean;
  } = {},
) {
  const health = options.health ?? 100;
  const position = options.position ?? { x: 0, y: 0, z: 0 };
  const autoRetaliate = options.autoRetaliate ?? true;

  return {
    id,
    type: "player" as const,
    position,
    health,
    autoRetaliate,
    data: {
      isLoading: false,
      stats: { attack: 50, strength: 50, defence: 50, hitpoints: 100 },
    },
    emote: "idle",
    base: { quaternion: { set: vi.fn(), copy: vi.fn() } },
    node: {
      position,
      quaternion: { set: vi.fn(), copy: vi.fn() },
    },
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
    alive: true,
  };
}

/**
 * Create a mock mob entity
 */
function createTestMob(
  id: string,
  options: {
    health?: number;
    position?: { x: number; y: number; z: number };
    combatRange?: number; // Combat range in tiles (1 = melee, >1 = ranged)
  } = {},
) {
  const health = {
    current: options.health ?? 100,
    max: options.health ?? 100,
  };
  const position = options.position ?? { x: 1, y: 0, z: 1 };
  const combatRange = options.combatRange ?? 1;

  return {
    id,
    type: "mob" as const,
    position,
    health: health.current,
    node: {
      position,
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
      return health.current <= 0; // Return true if died
    }),
    getCombatRange: () => combatRange,
    isAttackable: () => health.current > 0,
    isDead: () => health.current <= 0,
    setServerEmote: vi.fn(),
    markNetworkDirty: vi.fn(),
  };
}

/**
 * Create a mock world with auto-retaliate support
 */
function createTestWorld(options: { currentTick?: number } = {}) {
  const eventHandlers = new Map<string, Function[]>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  let currentTick = options.currentTick ?? 100;

  // Combined entities map - damage handlers validate attackers via entities.get()
  const entities = new Map<string, unknown>() as Map<string, unknown> & {
    players: Map<string, ReturnType<typeof createTestPlayer>>;
  };

  // Auto-syncing player map
  const playersMap = new Map<string, ReturnType<typeof createTestPlayer>>();
  const players = {
    set: (id: string, player: ReturnType<typeof createTestPlayer>) => {
      playersMap.set(id, player);
      entities.set(id, player); // Auto-sync to entities for validation
      return players;
    },
    get: (id: string) => playersMap.get(id),
    delete: (id: string) => {
      entities.delete(id);
      return playersMap.delete(id);
    },
    has: (id: string) => playersMap.has(id),
  };
  entities.players = players as unknown as Map<
    string,
    ReturnType<typeof createTestPlayer>
  >;

  const mockEventBus = {
    emitEvent: vi.fn((type: string, data: unknown, _source?: string) => {
      emittedEvents.push({ event: type, data });
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

  return {
    isServer: true,
    $eventBus: mockEventBus,
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
    emittedEvents,
    network: { send: vi.fn() },
    getPlayer: (id: string) => players.get(id),
    getSystem: (name: string) => {
      if (name === "entity-manager") {
        // Required by CombatSystem.init()
        return {
          getEntity: (id: string) => entities.get(id) || mobs.get(id),
        };
      }
      if (name === "equipment") {
        return {
          getPlayerEquipment: () => ({ weapon: null }),
        };
      }
      if (name === "player") {
        return {
          damagePlayer: vi.fn(),
          getPlayer: (id: string) => players.get(id),
          // Critical: Return the player's auto-retaliate setting
          getPlayerAutoRetaliate: (playerId: string) => {
            const player = players.get(playerId);
            return player?.autoRetaliate ?? true;
          },
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

describe("classic MMORPG Auto-Retaliate Movement", () => {
  let combatSystem: CombatSystem;
  let world: ReturnType<typeof createTestWorld>;

  beforeEach(async () => {
    world = createTestWorld({ currentTick: 100 });
    combatSystem = new CombatSystem(world as unknown as never);
    // CRITICAL: Call init() to cache playerSystem for auto-retaliate checks
    await combatSystem.init();
  });

  afterEach(() => {
    combatSystem.destroy();
  });

  describe("auto-retaliate ON - movement replacement", () => {
    it("emits COMBAT_FOLLOW_TARGET when mob with extended range attacks and player needs to close distance", () => {
      // Scenario: Mob has range 2, player has range 1
      // Combat starts at distance 2, player needs to move closer to attack back
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        autoRetaliate: true, // ON
      });

      // Mob with extended combat range attacks from 2 tiles away
      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 7.5 }, // Tile (5, 7) - 2 tiles NORTH of player
        health: 100,
        combatRange: 2, // Extended range allows attacking from 2 tiles
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);

      // Clear any previous events
      world.emittedEvents.length = 0;

      // Mob attacks player from range 2 (valid for mob, but player needs to close in)
      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Should emit COMBAT_FOLLOW_TARGET since player (range 1) needs to close distance
      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeDefined();
      expect(followEvent?.data).toMatchObject({
        playerId: "player1", // Player should move
        targetId: "mob1", // Toward the mob
      });
    });

    it("includes correct attacker position in follow event", () => {
      // Mob with extended range attacks - player needs to close distance
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        autoRetaliate: true,
      });

      const mob = createTestMob("mob1", {
        position: { x: 7.5, y: 3, z: 5.5 }, // Tile (7, 5) - 2 tiles EAST of player
        health: 100,
        combatRange: 2, // Extended range allows attacking from 2 tiles
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.emittedEvents.length = 0;

      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeDefined();
      // The targetPosition should be the attacker's actual position
      // The movement system will handle pathfinding to get adjacent to this position
      expect(followEvent?.data).toMatchObject({
        targetPosition: {
          x: 7.5, // Mob's actual X position
          y: 3,
          z: 5.5,
        },
      });
    });

    it("does NOT emit follow event for player-vs-player when already in melee range", () => {
      // When both players are adjacent, no follow event is needed - they can attack immediately
      const defender = createTestPlayer("defender", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        autoRetaliate: true,
      });

      const attacker = createTestPlayer("attacker", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Tile (5, 6) - adjacent
      });

      world.players.set("defender", defender);
      world.players.set("attacker", attacker);
      world.entities.set("defender", defender);
      world.entities.set("attacker", attacker);

      world.emittedEvents.length = 0;

      const combatStarted = combatSystem.startCombat("attacker", "defender", {
        attackerType: "player",
        targetType: "player",
      });

      expect(combatStarted).toBe(true);

      // No follow event needed - both players are already in melee range
      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeUndefined();
    });
  });

  describe("auto-retaliate OFF - no movement change", () => {
    it("does NOT emit COMBAT_FOLLOW_TARGET when auto-retaliate is OFF", () => {
      // Adjacent tiles for valid combat
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        autoRetaliate: false, // OFF - player can run away
      });

      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Tile (5, 6) - adjacent
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.emittedEvents.length = 0;

      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Should NOT emit follow event - player keeps running
      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeUndefined();
    });

    it("player can escape without being forced to fight back", () => {
      // Adjacent tiles for valid combat
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 }, // Tile (5, 5)
        autoRetaliate: false,
      });

      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Tile (5, 6) - adjacent
        health: 100,
      });

      world.players.set("player1", player);
      world.mobs.set("mob1", mob);
      world.emittedEvents.length = 0;

      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Verify NO follow events were emitted for the player
      const followEvents = world.emittedEvents.filter(
        (e) =>
          e.event === EventType.COMBAT_FOLLOW_TARGET &&
          (e.data as { playerId: string }).playerId === "player1",
      );

      expect(followEvents).toHaveLength(0);
    });
  });

  describe("mob attacks player scenarios", () => {
    it("NPC with extended range triggers auto-retaliate movement", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
        autoRetaliate: true,
      });

      // Mob with combat range 2 attacks from 2 tiles away
      const mob = createTestMob("goblin", {
        position: { x: 5.5, y: 0, z: 7.5 }, // 2 tiles away
        health: 50,
        combatRange: 2, // Extended range
      });

      world.players.set("player1", player);
      world.mobs.set("goblin", mob);
      world.emittedEvents.length = 0;

      // Goblin aggros the player from range 2
      combatSystem.startCombat("goblin", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeDefined();
      expect((followEvent?.data as { playerId: string }).playerId).toBe(
        "player1",
      );
    });

    it("handles multiple mobs attacking - only follows first attacker", () => {
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
        autoRetaliate: true,
      });

      // Both mobs have extended range to attack from distance
      const mob1 = createTestMob("goblin1", {
        position: { x: 5.5, y: 0, z: 7.5 }, // 2 tiles away
        health: 50,
        combatRange: 2,
      });

      const mob2 = createTestMob("goblin2", {
        position: { x: 7.5, y: 0, z: 5.5 }, // 2 tiles away
        health: 50,
        combatRange: 2,
      });

      world.players.set("player1", player);
      world.mobs.set("goblin1", mob1);
      world.mobs.set("goblin2", mob2);
      world.emittedEvents.length = 0;

      // First goblin attacks
      combatSystem.startCombat("goblin1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      const followEvents = world.emittedEvents.filter(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      // Should have exactly one follow event for the first attacker
      expect(followEvents).toHaveLength(1);
      expect((followEvents[0].data as { targetId: string }).targetId).toBe(
        "goblin1",
      );
    });
  });

  describe("rules-accurate auto-retaliate interrupts movement", () => {
    it("emits COMBAT_FOLLOW_TARGET when mob with extended range attacks moving player", () => {
      // Player is actively moving (tileMovementActive = true)
      // Mob with range 2 attacks, player needs to close distance
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
        autoRetaliate: true,
      });
      // Set the movement flag to simulate player walking
      (player.data as { tileMovementActive?: boolean }).tileMovementActive =
        true;

      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 7.5 }, // 2 tiles away
        health: 100,
        combatRange: 2, // Extended range
      });

      world.players.set("player1", player);
      world.entities.set("player1", player);
      world.mobs.set("mob1", mob);
      world.emittedEvents.length = 0;

      // Mob attacks player who is actively moving
      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // COMBAT_FOLLOW_TARGET should be emitted since player needs to close distance
      // This replaces the player's current movement destination with the attacker
      // Wiki: "the player's character walks/runs towards the monster attacking and fights back"
      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeDefined();
      expect(followEvent?.data).toMatchObject({
        playerId: "player1",
        targetId: "mob1",
      });
    });

    it("creates combat state when player is moving", () => {
      // Player is actively moving
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
        autoRetaliate: true,
      });
      (player.data as { tileMovementActive?: boolean }).tileMovementActive =
        true;

      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 6.5 }, // Adjacent for valid combat start
        health: 100,
      });

      world.players.set("player1", player);
      world.entities.set("player1", player);
      world.mobs.set("mob1", mob);
      world.emittedEvents.length = 0;

      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Combat should be started and player redirected toward attacker
      const combatStartedEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_STARTED,
      );

      expect(combatStartedEvent).toBeDefined();
    });

    it("emits COMBAT_FOLLOW_TARGET when mob with extended range attacks stationary player", () => {
      // Player starts stationary (tileMovementActive = false or undefined)
      const player = createTestPlayer("player1", {
        position: { x: 5.5, y: 0, z: 5.5 },
        autoRetaliate: true,
      });
      // Explicitly not moving
      (player.data as { tileMovementActive?: boolean }).tileMovementActive =
        false;

      const mob = createTestMob("mob1", {
        position: { x: 5.5, y: 0, z: 7.5 }, // 2 tiles away
        health: 100,
        combatRange: 2, // Extended range
      });

      world.players.set("player1", player);
      world.entities.set("player1", player);
      world.mobs.set("mob1", mob);
      world.emittedEvents.length = 0;

      combatSystem.startCombat("mob1", "player1", {
        attackerType: "mob",
        targetType: "player",
      });

      // Should emit COMBAT_FOLLOW_TARGET since player needs to close distance
      const followEvent = world.emittedEvents.find(
        (e) => e.event === EventType.COMBAT_FOLLOW_TARGET,
      );

      expect(followEvent).toBeDefined();
      expect(followEvent?.data).toMatchObject({
        playerId: "player1",
        targetId: "mob1",
      });
    });
  });
});
