/**
 * CombatSystem Unit Tests
 *
 * Tests for the main combat system orchestrator:
 * - Combat initiation and state management
 * - Attack processing and damage calculation
 * - Combat timeout and auto-attack
 * - Anti-cheat integration
 * - Pool statistics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CombatSystem } from "../CombatSystem";
import type { World } from "../../../../core/World";

interface MockPlayerEntity {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  health: number;
  stats: {
    attack: number;
    strength: number;
    defence: number;
    hitpoints: number;
  };
  data: {
    isLoading: boolean;
    stats: {
      attack: number;
      strength: number;
      defence: number;
      hitpoints: number;
    };
  };
  combat: { combatTarget: string | null };
  emote: string;
  base: {
    quaternion: {
      set: ReturnType<typeof vi.fn>;
      copy: ReturnType<typeof vi.fn>;
    };
  };
  node: {
    position: { x: number; y: number; z: number };
    quaternion: {
      set: ReturnType<typeof vi.fn>;
      copy: ReturnType<typeof vi.fn>;
    };
  };
  getPosition: () => { x: number; y: number; z: number };
  markNetworkDirty: ReturnType<typeof vi.fn>;
  takeDamage: ReturnType<typeof vi.fn>;
  getHealth: () => number;
  getComponent: (name: string) => unknown;
}

interface MockMobEntity {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  health: number;
  stats: {
    attack: number;
    strength: number;
    defence: number;
    hitpoints: number;
  };
  node: {
    position: { x: number; y: number; z: number };
    quaternion: {
      set: ReturnType<typeof vi.fn>;
      copy: ReturnType<typeof vi.fn>;
    };
  };
  getPosition: () => { x: number; y: number; z: number };
  getMobData: () => {
    health: number;
    stats: {
      attack: number;
      strength: number;
      defence: number;
      hitpoints: number;
    };
    combatRange: number;
    attackSpeedTicks: number;
  };
  getHealth: () => number;
  takeDamage: ReturnType<typeof vi.fn>;
  isAttackable: () => boolean;
  setServerEmote: ReturnType<typeof vi.fn>;
  markNetworkDirty: ReturnType<typeof vi.fn>;
  isDead: () => boolean;
}

// Mock player entity
function createMockPlayer(
  id: string,
  health: number = 100,
  position = { x: 0, y: 0, z: 0 },
) {
  let currentHealth = health;
  return {
    id,
    type: "player",
    position,
    health: currentHealth,
    stats: {
      attack: 10,
      strength: 10,
      defence: 10,
      hitpoints: health,
    },
    data: {
      isLoading: false,
      stats: { attack: 10, strength: 10, defence: 10, hitpoints: health },
    },
    combat: {
      combatTarget: null,
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
      currentHealth -= amount;
      return currentHealth;
    }),
    getHealth: () => currentHealth,
    // CombatSystem.isEntityAlive needs getComponent("health")
    getComponent: (name: string) => {
      if (name === "health") {
        return {
          data: {
            current: currentHealth,
            isDead: currentHealth <= 0,
          },
        };
      }
      return null;
    },
  };
}

// Mock mob entity
// NOTE: Default position (1, 0, 0) is CARDINAL adjacent to player at (0, 0, 0)
// classic MMORPG melee range 1 requires cardinal adjacency (no diagonal attacks)
function createMockMob(
  id: string,
  health: number = 50,
  position = { x: 1, y: 0, z: 0 },
) {
  let currentHealth = health;
  return {
    id,
    type: "mob",
    position,
    health: currentHealth,
    stats: {
      attack: 5,
      strength: 5,
      defence: 5,
      hitpoints: health,
    },
    node: {
      position,
      quaternion: { set: vi.fn(), copy: vi.fn() },
    },
    getPosition: () => position,
    getMobData: () => ({
      health: currentHealth,
      stats: { attack: 5, strength: 5, defence: 5, hitpoints: health },
      combatRange: 1,
      attackSpeedTicks: 4,
    }),
    getHealth: () => currentHealth,
    takeDamage: vi.fn((amount: number) => {
      currentHealth -= amount;
      return currentHealth;
    }),
    isAttackable: () => true,
    setServerEmote: vi.fn(),
    markNetworkDirty: vi.fn(),
    // CombatSystem.isEntityAlive needs isDead()
    isDead: () => currentHealth <= 0,
  };
}

// Mock World
function createMockWorld(
  options: {
    players?: Map<string, MockPlayerEntity>;
    mobs?: Map<string, MockMobEntity>;
    currentTick?: number;
    isServer?: boolean;
  } = {},
) {
  const players = options.players || new Map<string, MockPlayerEntity>();
  const mobs = options.mobs || new Map<string, MockMobEntity>();
  const eventHandlers = new Map<string, Array<(data: unknown) => void>>();

  // CombatSystem.getEntity() expects:
  // - world.entities.players.get() for players
  // - world.entities.get() for mobs
  // NOTE: Use the mobs Map directly (not a copy) so test can add mobs after creation
  const entities = mobs as Map<string, MockMobEntity> & {
    players: Map<string, MockPlayerEntity>;
  };
  entities.players = players;

  return {
    isServer: options.isServer ?? true,
    currentTick: options.currentTick ?? 100,
    entities,
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
        return {
          damagePlayer: vi.fn(),
          getPlayer: (id: string) => players.get(id),
          // Critical: Return auto-retaliate setting (default true)
          getPlayerAutoRetaliate: () => true,
        };
      }
      if (name === "mob-npc") {
        return {
          getMob: (id: string) => mobs.get(id),
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
      const handlers = eventHandlers.get(event) || [];
      handlers.forEach((h) => h(data));
    }),
    getEventHandlers: () => eventHandlers,
  };
}

describe("CombatSystem", () => {
  let combatSystem: CombatSystem;
  let mockWorld: ReturnType<typeof createMockWorld>;
  let mockPlayers: Map<string, MockPlayerEntity>;
  let mockMobs: Map<string, MockMobEntity>;

  beforeEach(async () => {
    mockPlayers = new Map();
    mockMobs = new Map();
    mockWorld = createMockWorld({
      players: mockPlayers,
      mobs: mockMobs,
      currentTick: 100,
    });

    combatSystem = new CombatSystem(mockWorld as unknown as World);
    // CRITICAL: Call init() to cache playerSystem for auto-retaliate checks
    await combatSystem.init();
  });

  afterEach(() => {
    combatSystem.destroy();
  });

  describe("constructor", () => {
    it("initializes with empty combat states", () => {
      expect(combatSystem.isInCombat("nonexistent")).toBe(false);
    });

    it("initializes anti-cheat system", () => {
      const stats = combatSystem.antiCheat.getStats();
      expect(stats.trackedPlayers).toBe(0);
    });

    it("initializes pool statistics", () => {
      const poolStats = combatSystem.getPoolStats();
      expect(poolStats.quaternions).toBeDefined();
      expect(poolStats.quaternions.total).toBeGreaterThan(0);
    });
  });

  describe("startCombat", () => {
    it("initiates combat between player and mob", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(true);
      expect(combatSystem.isInCombat("player1")).toBe(true);
    });

    it("returns false for nonexistent attacker", () => {
      const mob = createMockMob("mob1");
      mockMobs.set("mob1", mob);

      const result = combatSystem.startCombat("nonexistent", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("returns false for nonexistent target", () => {
      const player = createMockPlayer("player1");
      mockPlayers.set("player1", player);

      const result = combatSystem.startCombat("player1", "nonexistent", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("returns false when target is out of range", () => {
      const player = createMockPlayer("player1", 100, { x: 0, y: 0, z: 0 });
      const mob = createMockMob("mob1", 50, { x: 100, y: 0, z: 100 }); // Far away
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });

    it("returns false when target is dead", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1", 0); // Dead mob
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      const result = combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(result).toBe(false);
    });
  });

  describe("isInCombat", () => {
    it("returns false for entity not in combat", () => {
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("returns true for entity in combat", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      expect(combatSystem.isInCombat("player1")).toBe(true);
    });
  });

  describe("getCombatData", () => {
    it("returns null for entity not in combat", () => {
      expect(combatSystem.getCombatData("player1")).toBeNull();
    });

    it("returns combat data for entity in combat", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      const data = combatSystem.getCombatData("player1");
      expect(data).not.toBeNull();
      expect(data?.targetId).toBe("mob1");
    });
  });

  describe("forceEndCombat", () => {
    it("ends combat for entity", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });
      expect(combatSystem.isInCombat("player1")).toBe(true);

      combatSystem.forceEndCombat("player1");
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("handles ending combat for entity not in combat", () => {
      expect(() => {
        combatSystem.forceEndCombat("nonexistent", "player");
      }).not.toThrow();
    });
  });

  describe("cleanupPlayerDisconnect", () => {
    it("cleans up combat state on disconnect", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      combatSystem.cleanupPlayerDisconnect("player1");

      expect(combatSystem.isInCombat("player1")).toBe(false);
    });

    it("cleans up anti-cheat tracking on disconnect", () => {
      // Record a violation first
      const _antiCheatStats = combatSystem.antiCheat.getStats();
      // The cleanup should work even with no violations
      expect(() => {
        combatSystem.cleanupPlayerDisconnect("player1");
      }).not.toThrow();
    });
  });

  describe("anti-cheat integration", () => {
    it("antiCheat.getStats returns stats", () => {
      const stats = combatSystem.antiCheat.getStats();

      expect(stats).toHaveProperty("trackedPlayers");
      expect(stats).toHaveProperty("playersAboveWarning");
      expect(stats).toHaveProperty("playersAboveAlert");
      expect(stats).toHaveProperty("totalViolationsLast5Min");
    });

    it("antiCheat.getPlayerReport returns report", () => {
      const report = combatSystem.antiCheat.getPlayerReport("player1");

      expect(report).toHaveProperty("score");
      expect(report).toHaveProperty("recentViolations");
      expect(report).toHaveProperty("attacksThisTick");
    });

    it("antiCheat.getPlayersRequiringReview returns array", () => {
      const players = combatSystem.antiCheat.getPlayersRequiringReview();
      expect(Array.isArray(players)).toBe(true);
    });

    it("decayAntiCheatScores does not throw", () => {
      expect(() => {
        combatSystem.decayAntiCheatScores();
      }).not.toThrow();
    });

    it("antiCheat.getConfig returns configuration", () => {
      const config = combatSystem.antiCheat.getConfig();

      expect(config).toHaveProperty("warningThreshold");
      expect(config).toHaveProperty("alertThreshold");
      expect(config).toHaveProperty("scoreDecayPerMinute");
      expect(config).toHaveProperty("maxAttacksPerTick");
      expect(config.warningThreshold).toBe(25);
      expect(config.alertThreshold).toBe(35);
    });
  });

  describe("pool statistics", () => {
    it("getPoolStats returns quaternion pool stats", () => {
      const stats = combatSystem.getPoolStats();

      expect(stats.quaternions).toBeDefined();
      expect(stats.quaternions).toHaveProperty("total");
      expect(stats.quaternions).toHaveProperty("available");
      expect(stats.quaternions).toHaveProperty("inUse");
    });

    it("pool stats show correct structure", () => {
      const stats = combatSystem.getPoolStats();

      expect(typeof stats.quaternions.total).toBe("number");
      expect(typeof stats.quaternions.available).toBe("number");
      expect(typeof stats.quaternions.inUse).toBe("number");
      expect(stats.quaternions.total).toBeGreaterThanOrEqual(
        stats.quaternions.available,
      );
    });
  });

  describe("processCombatTick", () => {
    it("processes combat tick without errors", () => {
      expect(() => {
        combatSystem.processCombatTick(100);
      }).not.toThrow();
    });

    it("processes auto-attacks for entities in combat", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      // Advance tick past attack cooldown
      mockWorld.currentTick = 110;

      expect(() => {
        combatSystem.processCombatTick(110);
      }).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("cleans up all resources", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      combatSystem.destroy();

      // After destroy, combat state should be cleared
      expect(combatSystem.isInCombat("player1")).toBe(false);
    });
  });

  describe("combat state service integration", () => {
    it("stateService is accessible", () => {
      expect(combatSystem.stateService).toBeDefined();
    });

    it("getAllCombatStates returns array", () => {
      const states = combatSystem.stateService.getAllCombatStates();
      expect(Array.isArray(states)).toBe(true);
    });

    it("tracks combat states correctly", () => {
      const player = createMockPlayer("player1");
      const mob = createMockMob("mob1");
      mockPlayers.set("player1", player);
      mockMobs.set("mob1", mob);

      combatSystem.startCombat("player1", "mob1", {
        attackerType: "player",
        targetType: "mob",
      });

      const states = combatSystem.stateService.getAllCombatStates();
      // tile-based-MMORPG-style: Both attacker and target enter combat (mutual combat)
      expect(states.length).toBeGreaterThanOrEqual(1);
      // Verify player is in combat
      expect(combatSystem.isInCombat("player1")).toBe(true);
    });
  });
});
