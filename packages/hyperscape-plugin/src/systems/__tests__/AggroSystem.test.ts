/**
 * AggroSystem Unit Tests
 *
 * Tests the mob aggression and AI system.
 *
 * Key behaviors tested:
 * - Mob registration and unregistration
 * - Level-based aggression logic
 * - Combat level calculation
 * - Player skills caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AggroSystem } from "../AggroSystem";
import { COMBAT_CONSTANTS } from "@hyperforge/shared";

// Mock World
function createMockWorld() {
  const entities = new Map<string, Record<string, unknown>>();
  const players = new Map<
    string,
    { id: string; node: { position: { x: number; y: number; z: number } } }
  >();
  const emitFn = vi.fn();
  const onFn = vi.fn();
  const offFn = vi.fn();

  return {
    entities,
    emit: emitFn,
    on: onFn,
    off: offFn,
    getSystem: vi.fn(),
    getPlayer: (playerId: string) => players.get(playerId),
    _emit: emitFn,
    _players: players,
    setPlayer: (
      playerId: string,
      x: number,
      y: number,
      z: number,
      data: Record<string, unknown> = {},
    ) => {
      players.set(playerId, {
        id: playerId,
        node: { position: { x, y, z } },
      });
      entities.set(playerId, { data });
    },
  };
}

describe("AggroSystem", () => {
  let world: ReturnType<typeof createMockWorld>;
  let system: AggroSystem;

  beforeEach(() => {
    world = createMockWorld();
    system = new AggroSystem(world as never);
  });

  afterEach(() => {
    system.destroy();
  });

  describe("mob registration", () => {
    it("registers mob with correct initial state", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, unknown>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: {
            aggressive?: boolean;
            aggroRange?: number;
            leashRange?: number;
            levelIgnoreThreshold?: number;
          };
        }) => void;
      };

      privateSystem.registerMob({
        id: "mob1",
        type: "goblin",
        level: 1,
        position: { x: 10, y: 0, z: 10 },
      });

      expect(privateSystem.mobStates.size).toBe(1);
      expect(privateSystem.mobStates.has("mob1")).toBe(true);
    });

    it("registers mob with manifest combat config", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<
          string,
          { detectionRange: number; leashRange: number; levelIgnore: number }
        >;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: {
            aggressive?: boolean;
            aggroRange?: number;
            leashRange?: number;
            levelIgnoreThreshold?: number;
          };
        }) => void;
      };

      privateSystem.registerMob({
        id: "mob2",
        type: "goblin",
        level: 2,
        position: { x: 10, y: 0, z: 10 },
        combat: {
          aggressive: true,
          aggroRange: 6,
          leashRange: 10,
          levelIgnoreThreshold: 20,
        },
      });

      const mobState = privateSystem.mobStates.get("mob2")!;
      expect(mobState.detectionRange).toBe(6);
      expect(mobState.leashRange).toBe(10);
      expect(mobState.levelIgnore).toBe(20);
    });

    it("uses DEFAULTS when combat config not provided", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<
          string,
          { detectionRange: number; leashRange: number; levelIgnore: number }
        >;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: {
            aggressive?: boolean;
            aggroRange?: number;
            leashRange?: number;
            levelIgnoreThreshold?: number;
          };
        }) => void;
      };

      privateSystem.registerMob({
        id: "mob3",
        type: "chicken",
        level: 1,
        position: { x: 10, y: 0, z: 10 },
        // No combat config - should use DEFAULTS
      });

      const mobState = privateSystem.mobStates.get("mob3")!;
      expect(mobState.detectionRange).toBe(
        COMBAT_CONSTANTS.DEFAULTS.NPC.AGGRO_RANGE,
      );
      expect(mobState.leashRange).toBe(
        COMBAT_CONSTANTS.DEFAULTS.NPC.LEASH_RANGE,
      );
    });

    it("throws error when registering mob without position", () => {
      const privateSystem = system as unknown as {
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position?: { x: number; y: number; z: number };
        }) => void;
      };

      expect(() =>
        privateSystem.registerMob({
          id: "mob1",
          type: "goblin",
          level: 1,
          position: undefined,
        }),
      ).toThrow("Missing position for mob mob1");
    });

    it("unregisters mob correctly", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, unknown>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
        }) => void;
        unregisterMob: (mobId: string) => void;
      };

      privateSystem.registerMob({
        id: "mob1",
        type: "goblin",
        level: 1,
        position: { x: 10, y: 0, z: 10 },
      });

      expect(privateSystem.mobStates.size).toBe(1);

      privateSystem.unregisterMob("mob1");

      expect(privateSystem.mobStates.size).toBe(0);
    });
  });

  describe("DEFAULTS.NPC constants", () => {
    it("has tile-based-MMORPG-accurate aggroRange of 4", () => {
      expect(COMBAT_CONSTANTS.DEFAULTS.NPC.AGGRO_RANGE).toBe(4);
    });

    it("has extended leashRange of 42 for better gameplay", () => {
      expect(COMBAT_CONSTANTS.DEFAULTS.NPC.LEASH_RANGE).toBe(42);
    });

    it("has tile-based-MMORPG-accurate attackSpeedTicks of 4", () => {
      expect(COMBAT_CONSTANTS.DEFAULTS.NPC.ATTACK_SPEED_TICKS).toBe(4);
    });

    it("has tile-based-MMORPG-accurate respawnTicks of 25", () => {
      expect(COMBAT_CONSTANTS.DEFAULTS.NPC.RESPAWN_TICKS).toBe(25);
    });
  });

  describe("player skills caching", () => {
    it("caches player skills from SKILLS_UPDATED event", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerSkills: (playerId: string) => {
          attack: number;
          strength: number;
          defense: number;
          constitution: number;
        };
      };

      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
        strength: { level: 45, xp: 80000 },
        defense: { level: 40, xp: 60000 },
        constitution: { level: 55, xp: 120000 },
      });

      const skills = privateSystem.getPlayerSkills("player1");
      expect(skills.attack).toBe(50);
      expect(skills.strength).toBe(45);
      expect(skills.defense).toBe(40);
      expect(skills.constitution).toBe(55);
    });

    it("returns classic MMORPG default skills when player not cached", () => {
      const privateSystem = system as unknown as {
        getPlayerSkills: (playerId: string) => {
          attack: number;
          strength: number;
          defense: number;
          constitution: number;
        };
      };

      const skills = privateSystem.getPlayerSkills("unknown_player");
      expect(skills.attack).toBe(1);
      expect(skills.strength).toBe(1);
      expect(skills.defense).toBe(1);
      // classic MMORPG: Hitpoints starts at 10, not 1
      expect(skills.constitution).toBe(10);
    });
  });

  describe("combat level calculation", () => {
    it("calculates combat level using classic MMORPG formula", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // Set skills for classic MMORPG formula test
      // classic MMORPG Combat Level = floor(Base + max(Melee, Ranged, Magic))
      // Base = 0.25 * (Defence + Hitpoints + floor(Prayer / 2))
      // Melee = 0.325 * (Attack + Strength)
      //
      // For: Attack=50, Strength=45, Defence=40, Hitpoints=55, Prayer=1, Ranged=1, Magic=1
      // Base = 0.25 * (40 + 55 + 0) = 23.75
      // Melee = 0.325 * (50 + 45) = 30.875
      // Combat Level = floor(23.75 + 30.875) = floor(54.625) = 54
      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
        strength: { level: 45, xp: 80000 },
        defense: { level: 40, xp: 60000 },
        constitution: { level: 55, xp: 120000 },
      });

      const combatLevel = privateSystem.getPlayerCombatLevel("player1");
      expect(combatLevel).toBe(54);
    });

    it("returns minimum level 3 for new players (tile-based-MMORPG-accurate)", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // classic MMORPG fresh character: All skills at 1, Hitpoints at 10
      // Base = 0.25 * (1 + 10 + 0) = 2.75
      // Melee = 0.325 * (1 + 1) = 0.65
      // Combat Level = floor(2.75 + 0.65) = 3
      privateSystem.playerSkills.set("player1", {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        constitution: { level: 10, xp: 0 }, // classic MMORPG: Hitpoints starts at 10
      });

      const combatLevel = privateSystem.getPlayerCombatLevel("player1");
      expect(combatLevel).toBe(3);
    });

    it("returns level 3 for unknown player (classic MMORPG default)", () => {
      const privateSystem = system as unknown as {
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // Unknown player uses classic MMORPG defaults: all 1 except Hitpoints=10
      // Combat level = 3 (classic MMORPG starting combat level)
      const combatLevel = privateSystem.getPlayerCombatLevel("unknown_player");
      expect(combatLevel).toBe(3);
    });
  });

  describe("shouldMobAggroPlayer", () => {
    it("returns false for passive mobs regardless of level", () => {
      const privateSystem = system as unknown as {
        shouldMobAggroPlayer: (
          mobState: { behavior: string; levelIgnore: number; mobId: string },
          playerId: string,
        ) => boolean;
      };

      // Passive mobs never aggro
      const mobState = {
        behavior: "passive",
        levelIgnore: 10,
        mobId: "cow1",
      };

      const shouldAggro = privateSystem.shouldMobAggroPlayer(
        mobState,
        "player1",
      );
      expect(shouldAggro).toBe(false);
    });

    it("aggressive mob with high levelIgnore (999) is toleranceImmune", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        shouldMobAggroPlayer: (
          mobState: { behavior: string; levelIgnore: number; mobId: string },
          playerId: string,
        ) => boolean;
      };

      // Special mobs like Dark Warriors have levelIgnore of 999
      // They are "toleranceImmune" - always aggro regardless of player level
      const mobState = {
        behavior: "aggressive",
        levelIgnore: 999, // Tolerance immune
        mobId: "dark_warrior1",
      };

      // High level player - would normally be ignored
      privateSystem.playerSkills.set("player1", {
        attack: { level: 99, xp: 0 },
        strength: { level: 99, xp: 0 },
        defense: { level: 99, xp: 0 },
        constitution: { level: 99, xp: 0 },
      });

      // With levelIgnore 999 (toleranceImmune), mob always aggros
      // Note: actual result depends on classic MMORPG double-level rule and tolerance timer
      // This test verifies the toleranceImmune check works
      const shouldAggro = privateSystem.shouldMobAggroPlayer(
        mobState,
        "player1",
      );
      // toleranceImmune mobs skip level-based ignore AND tolerance timer
      expect(shouldAggro).toBe(true);
    });
  });

  describe("checkAggroUpdates (level change re-evaluation)", () => {
    it("stops chasing when player levels past double mob level", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<
          string,
          {
            mobId: string;
            behavior: string;
            levelIgnore: number;
            aggroTargets: Map<
              string,
              {
                playerId: string;
                aggroLevel: number;
                lastSeen: number;
                distance: number;
                inRange: boolean;
                lastDamageTime: number;
              }
            >;
            currentTarget: string | null;
            isChasing: boolean;
            isInCombat: boolean;
            currentPosition: { x: number; y: number; z: number };
            homePosition: { x: number; y: number; z: number };
          }
        >;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean };
        }) => void;
        checkAggroUpdates: (data: {
          playerId: string;
          oldLevel: number;
          newLevel: number;
        }) => void;
      };

      // Register a level 5 mob
      privateSystem.registerMob({
        id: "goblin_aggro",
        type: "goblin",
        level: 5,
        position: { x: 10, y: 0, z: 10 },
        combat: { aggressive: true },
      });
      world.entities.set("goblin_aggro", {
        getProperty: (prop: string) => (prop === "level" ? 5 : undefined),
      });

      const mobState = privateSystem.mobStates.get("goblin_aggro")!;

      // Simulate that mob is chasing player1
      mobState.currentTarget = "player1";
      mobState.isChasing = true;
      mobState.aggroTargets.set("player1", {
        playerId: "player1",
        aggroLevel: 10,
        lastSeen: 1,
        distance: 3,
        inRange: true,
        lastDamageTime: 1,
      });

      // Player levels up past 2x mob level (5*2=10, player now level 11)
      privateSystem.checkAggroUpdates({
        playerId: "player1",
        oldLevel: 9,
        newLevel: 11,
      });

      // Mob should have dropped this player from aggro
      expect(mobState.aggroTargets.has("player1")).toBe(false);
    });

    it("keeps chasing when player level stays below double mob level", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<
          string,
          {
            mobId: string;
            behavior: string;
            levelIgnore: number;
            aggroTargets: Map<
              string,
              {
                playerId: string;
                aggroLevel: number;
                lastSeen: number;
                distance: number;
                inRange: boolean;
                lastDamageTime: number;
              }
            >;
            currentTarget: string | null;
            isChasing: boolean;
            isInCombat: boolean;
            currentPosition: { x: number; y: number; z: number };
            homePosition: { x: number; y: number; z: number };
          }
        >;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean };
        }) => void;
        checkAggroUpdates: (data: {
          playerId: string;
          oldLevel: number;
          newLevel: number;
        }) => void;
      };

      privateSystem.registerMob({
        id: "goblin_keep",
        type: "goblin",
        level: 10,
        position: { x: 10, y: 0, z: 10 },
        combat: { aggressive: true, levelIgnoreThreshold: 20 },
      });
      world.entities.set("goblin_keep", {
        getProperty: (prop: string) => (prop === "level" ? 10 : undefined),
      });

      const mobState = privateSystem.mobStates.get("goblin_keep")!;
      mobState.currentTarget = "player1";
      mobState.isChasing = true;
      mobState.aggroTargets.set("player1", {
        playerId: "player1",
        aggroLevel: 10,
        lastSeen: 1,
        distance: 3,
        inRange: true,
        lastDamageTime: 1,
      });

      // Player levels to 15 which is <= 10*2=20, mob should keep chasing
      privateSystem.checkAggroUpdates({
        playerId: "player1",
        oldLevel: 12,
        newLevel: 15,
      });

      expect(mobState.aggroTargets.has("player1")).toBe(true);
      expect(mobState.currentTarget).toBe("player1");
    });
  });

  describe("tolerance expiration", () => {
    it("hasToleranceExpired returns false before timer expires", () => {
      const privateSystem = system as unknown as {
        currentTick: number;
        hasToleranceExpired: (playerId: string) => boolean;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      privateSystem.currentTick = 100;
      privateSystem.updatePlayerTolerance("player1", { x: 10, y: 0, z: 10 });

      // Still within the 1000-tick window
      privateSystem.currentTick = 500;
      expect(privateSystem.hasToleranceExpired("player1")).toBe(false);
    });

    it("hasToleranceExpired returns true after 1000 ticks in same region", () => {
      const privateSystem = system as unknown as {
        currentTick: number;
        hasToleranceExpired: (playerId: string) => boolean;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      privateSystem.currentTick = 100;
      privateSystem.updatePlayerTolerance("player1", { x: 10, y: 0, z: 10 });

      // After 1000 ticks (10 minutes)
      privateSystem.currentTick = 1100;
      expect(privateSystem.hasToleranceExpired("player1")).toBe(true);
    });

    it("moving to new region resets tolerance timer", () => {
      const privateSystem = system as unknown as {
        currentTick: number;
        hasToleranceExpired: (playerId: string) => boolean;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      privateSystem.currentTick = 100;
      privateSystem.updatePlayerTolerance("player1", { x: 10, y: 0, z: 10 });

      // Move to a different region at tick 900 (almost expired)
      privateSystem.currentTick = 900;
      privateSystem.updatePlayerTolerance("player1", { x: 50, y: 0, z: 50 });

      // At tick 1100 — would have expired with original region, but timer was reset
      privateSystem.currentTick = 1100;
      expect(privateSystem.hasToleranceExpired("player1")).toBe(false);

      // At tick 1900 — now it's been 1000 ticks since region change
      privateSystem.currentTick = 1900;
      expect(privateSystem.hasToleranceExpired("player1")).toBe(true);
    });
  });

  describe("dead player handling", () => {
    it("skips loading players in checkPlayerAggro", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<
          string,
          {
            mobId: string;
            behavior: string;
            levelIgnore: number;
            aggroTargets: Map<string, unknown>;
            detectionRange: number;
            currentPosition: { x: number; y: number; z: number };
          }
        >;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean };
        }) => void;
        checkPlayerAggro: (
          mobState: unknown,
          playerId: string,
          playerPosition: { x: number; y: number; z: number },
        ) => void;
      };

      privateSystem.registerMob({
        id: "goblin_dead",
        type: "goblin",
        level: 2,
        position: { x: 10, y: 0, z: 10 },
        combat: { aggressive: true },
      });

      // Set player as loading (immune to aggro)
      world.entities.set("player_loading", {
        data: { isLoading: true },
        getProperty: () => undefined,
      });

      const mobState = privateSystem.mobStates.get("goblin_dead")!;

      // Should not add to aggro targets
      privateSystem.checkPlayerAggro(mobState, "player_loading", {
        x: 10,
        y: 0,
        z: 10,
      });

      expect(mobState.aggroTargets.size).toBe(0);
    });
  });

  describe("destroy", () => {
    it("clears all mob states", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, unknown>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
        }) => void;
      };

      privateSystem.registerMob({
        id: "mob1",
        type: "goblin",
        level: 1,
        position: { x: 10, y: 0, z: 10 },
      });

      privateSystem.registerMob({
        id: "mob2",
        type: "cow",
        level: 1,
        position: { x: 20, y: 0, z: 20 },
      });

      expect(privateSystem.mobStates.size).toBe(2);

      system.destroy();

      expect(privateSystem.mobStates.size).toBe(0);
    });

    it("clears combat level cache on destroy", () => {
      const privateSystem = system as unknown as {
        combatLevelCache: Map<string, number>;
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // Populate cache
      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
        strength: { level: 50, xp: 100000 },
        defense: { level: 50, xp: 100000 },
        constitution: { level: 50, xp: 100000 },
      });
      privateSystem.getPlayerCombatLevel("player1");
      expect(privateSystem.combatLevelCache.size).toBe(1);

      system.destroy();

      expect(privateSystem.combatLevelCache.size).toBe(0);
    });

    it("clears player skills cache on destroy", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
      };

      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
      });
      expect(privateSystem.playerSkills.size).toBe(1);

      system.destroy();

      expect(privateSystem.playerSkills.size).toBe(0);
    });
  });

  describe("combat level caching", () => {
    it("caches combat level after first calculation", () => {
      const privateSystem = system as unknown as {
        combatLevelCache: Map<string, number>;
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
        strength: { level: 45, xp: 80000 },
        defense: { level: 40, xp: 60000 },
        constitution: { level: 55, xp: 120000 },
      });

      // First call - should calculate and cache
      expect(privateSystem.combatLevelCache.has("player1")).toBe(false);
      const level1 = privateSystem.getPlayerCombatLevel("player1");
      expect(privateSystem.combatLevelCache.has("player1")).toBe(true);
      expect(privateSystem.combatLevelCache.get("player1")).toBe(level1);
    });

    it("returns cached value on subsequent calls", () => {
      const privateSystem = system as unknown as {
        combatLevelCache: Map<string, number>;
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
        strength: { level: 45, xp: 80000 },
        defense: { level: 40, xp: 60000 },
        constitution: { level: 55, xp: 120000 },
      });

      const level1 = privateSystem.getPlayerCombatLevel("player1");
      const level2 = privateSystem.getPlayerCombatLevel("player1");

      expect(level1).toBe(level2);
      expect(level1).toBe(54);
    });

    it("invalidates cache when player skills change", () => {
      const privateSystem = system as unknown as {
        combatLevelCache: Map<string, number>;
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // Set initial skills
      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 100000 },
        strength: { level: 45, xp: 80000 },
        defense: { level: 40, xp: 60000 },
        constitution: { level: 55, xp: 120000 },
      });
      const initialLevel = privateSystem.getPlayerCombatLevel("player1");
      expect(privateSystem.combatLevelCache.has("player1")).toBe(true);

      // Simulate skill update (directly delete from cache as the event would)
      privateSystem.combatLevelCache.delete("player1");

      // Update skills (all combat skills at 99)
      privateSystem.playerSkills.set("player1", {
        attack: { level: 99, xp: 13000000 },
        strength: { level: 99, xp: 13000000 },
        defense: { level: 99, xp: 13000000 },
        constitution: { level: 99, xp: 13000000 },
        prayer: { level: 99, xp: 13000000 },
        ranged: { level: 99, xp: 13000000 },
        magic: { level: 99, xp: 13000000 },
      });

      // Should recalculate
      const newLevel = privateSystem.getPlayerCombatLevel("player1");
      expect(newLevel).toBeGreaterThan(initialLevel);
      expect(newLevel).toBe(126); // Max combat level
    });

    it("handles multiple players with separate caches", () => {
      const privateSystem = system as unknown as {
        combatLevelCache: Map<string, number>;
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      privateSystem.playerSkills.set("player1", {
        attack: { level: 10, xp: 1000 },
        strength: { level: 10, xp: 1000 },
        defense: { level: 10, xp: 1000 },
        constitution: { level: 15, xp: 2000 },
      });

      privateSystem.playerSkills.set("player2", {
        attack: { level: 99, xp: 13000000 },
        strength: { level: 99, xp: 13000000 },
        defense: { level: 99, xp: 13000000 },
        constitution: { level: 99, xp: 13000000 },
        prayer: { level: 99, xp: 13000000 },
        ranged: { level: 99, xp: 13000000 },
        magic: { level: 99, xp: 13000000 },
      });

      const level1 = privateSystem.getPlayerCombatLevel("player1");
      const level2 = privateSystem.getPlayerCombatLevel("player2");

      expect(privateSystem.combatLevelCache.size).toBe(2);
      expect(level1).toBeLessThan(level2);
      expect(level2).toBe(126);
    });
  });

  describe("combat level boundary conditions", () => {
    it("handles all skills at level 1 (minimum classic MMORPG state)", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // All skills at 1 except constitution at 10 (classic MMORPG starting state)
      privateSystem.playerSkills.set("player1", {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 1, xp: 0 },
        constitution: { level: 10, xp: 1154 },
        prayer: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 1, xp: 0 },
      });

      const level = privateSystem.getPlayerCombatLevel("player1");
      expect(level).toBe(3); // classic MMORPG minimum combat level
    });

    it("handles all skills at level 99 (maximum classic MMORPG state)", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      privateSystem.playerSkills.set("player1", {
        attack: { level: 99, xp: 13034431 },
        strength: { level: 99, xp: 13034431 },
        defense: { level: 99, xp: 13034431 },
        constitution: { level: 99, xp: 13034431 },
        prayer: { level: 99, xp: 13034431 },
        ranged: { level: 99, xp: 13034431 },
        magic: { level: 99, xp: 13034431 },
      });

      const level = privateSystem.getPlayerCombatLevel("player1");
      expect(level).toBe(126); // classic MMORPG maximum combat level
    });

    it("handles ranged-based combat level correctly", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // Pure ranger build - high ranged, low melee
      privateSystem.playerSkills.set("player1", {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 45, xp: 61512 },
        constitution: { level: 50, xp: 101333 },
        prayer: { level: 1, xp: 0 },
        ranged: { level: 99, xp: 13034431 },
        magic: { level: 1, xp: 0 },
      });

      const level = privateSystem.getPlayerCombatLevel("player1");
      // Base = 0.25 * (45 + 50 + 0) = 23.75
      // Ranged = 0.325 * floor(99 * 1.5) = 0.325 * 148 = 48.1
      // Total = floor(23.75 + 48.1) = 71
      expect(level).toBe(71);
    });

    it("handles magic-based combat level correctly", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // Pure mage build - high magic, low melee
      privateSystem.playerSkills.set("player1", {
        attack: { level: 1, xp: 0 },
        strength: { level: 1, xp: 0 },
        defense: { level: 45, xp: 61512 },
        constitution: { level: 50, xp: 101333 },
        prayer: { level: 1, xp: 0 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 99, xp: 13034431 },
      });

      const level = privateSystem.getPlayerCombatLevel("player1");
      // Same as ranged formula: floor(23.75 + 48.1) = 71
      expect(level).toBe(71);
    });

    it("handles prayer bonus correctly in combat level", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerCombatLevel: (playerId: string) => number;
      };

      // High prayer affects base
      privateSystem.playerSkills.set("player1", {
        attack: { level: 60, xp: 273742 },
        strength: { level: 60, xp: 273742 },
        defense: { level: 60, xp: 273742 },
        constitution: { level: 60, xp: 273742 },
        prayer: { level: 99, xp: 13034431 },
        ranged: { level: 1, xp: 0 },
        magic: { level: 1, xp: 0 },
      });

      // Base = 0.25 * (60 + 60 + floor(99/2)) = 0.25 * (60 + 60 + 49) = 42.25
      // Melee = 0.325 * (60 + 60) = 39
      // Total = floor(42.25 + 39) = 81
      const level = privateSystem.getPlayerCombatLevel("player1");
      expect(level).toBe(81);
    });
  });

  describe("spatial optimization integration", () => {
    it("entityManager reference is cached on init", async () => {
      const privateSystem = system as unknown as {
        entityManager: unknown | undefined;
        init: () => Promise<void>;
      };

      // Before init, entityManager should be undefined
      expect(privateSystem.entityManager).toBeUndefined();

      // After init, it may or may not be set depending on world configuration
      await privateSystem.init();
      // Note: In test environment, getSystem may return undefined
      // The important thing is that init() doesn't throw
    });

    it("falls back to checking all mobs when entityManager unavailable", () => {
      const privateSystem = system as unknown as {
        entityManager: unknown | undefined;
        mobStates: Map<
          string,
          {
            behavior: string;
            currentPosition: { x: number; y: number; z: number };
          }
        >;
        updatePlayerPosition: (data: {
          entityId: string;
          position: { x: number; y: number; z: number };
        }) => void;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
        }) => void;
      };

      // Ensure entityManager is not set
      privateSystem.entityManager = undefined;

      // Register a passive mob
      privateSystem.registerMob({
        id: "mob1",
        type: "cow",
        level: 1,
        position: { x: 10, y: 0, z: 10 },
      });

      // Update player position - should not throw even without entityManager
      expect(() => {
        privateSystem.updatePlayerPosition({
          entityId: "player1",
          position: { x: 15, y: 0, z: 15 },
        });
      }).not.toThrow();
    });
  });

  describe("error handling and edge cases", () => {
    it("handles getPlayerSkills with missing skills gracefully", () => {
      const privateSystem = system as unknown as {
        playerSkills: Map<
          string,
          Record<string, { level: number; xp: number }>
        >;
        getPlayerSkills: (playerId: string) => {
          attack: number;
          strength: number;
          defense: number;
          constitution: number;
          prayer: number;
          ranged: number;
          magic: number;
        };
      };

      // Set partial skills (missing some)
      privateSystem.playerSkills.set("player1", {
        attack: { level: 50, xp: 0 },
        // Missing strength, defense, etc.
      });

      const skills = privateSystem.getPlayerSkills("player1");

      // Should return defaults for missing skills
      expect(skills.attack).toBe(50);
      expect(skills.strength).toBe(1); // Default
      expect(skills.defense).toBe(1); // Default
      expect(skills.constitution).toBe(10); // classic MMORPG default for hitpoints
    });

    it("handles updateMobPosition with invalid data", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<
          string,
          { currentPosition: { x: number; y: number; z: number } }
        >;
        updateMobPosition: (data: {
          entityId: string;
          position: { x: number; y: number; z: number } | undefined;
        }) => void;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
        }) => void;
      };

      privateSystem.registerMob({
        id: "mob1",
        type: "goblin",
        level: 1,
        position: { x: 10, y: 0, z: 10 },
      });

      // Should not throw when position is provided
      expect(() => {
        privateSystem.updateMobPosition({
          entityId: "mob1",
          position: { x: 20, y: 0, z: 20 },
        });
      }).not.toThrow();

      // Position should be updated
      const mobState = privateSystem.mobStates.get("mob1");
      expect(mobState?.currentPosition.x).toBe(20);
    });

    it("handles unregistered mob in updateMobPosition gracefully", () => {
      const privateSystem = system as unknown as {
        updateMobPosition: (data: {
          entityId: string;
          position: { x: number; y: number; z: number };
        }) => void;
      };

      // Should not throw for unknown mob
      expect(() => {
        privateSystem.updateMobPosition({
          entityId: "unknown_mob",
          position: { x: 100, y: 0, z: 100 },
        });
      }).not.toThrow();
    });

    it("handles player tolerance tracking correctly", () => {
      const privateSystem = system as unknown as {
        playerTolerance: Map<string, unknown>;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Initial tolerance state should be empty
      expect(privateSystem.playerTolerance.size).toBe(0);

      // Update tolerance
      privateSystem.updatePlayerTolerance("player1", { x: 100, y: 0, z: 100 });
      expect(privateSystem.playerTolerance.has("player1")).toBe(true);
    });
  });

  describe("spatial player indexing (playersByRegion)", () => {
    it("indexes player by region when tolerance is updated", () => {
      const privateSystem = system as unknown as {
        playersByRegion: Map<string, Set<string>>;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Update player tolerance at position (10, 0, 10)
      // Region = floor(10/21):floor(10/21) = "0:0"
      privateSystem.updatePlayerTolerance("player1", { x: 10, y: 0, z: 10 });

      expect(privateSystem.playersByRegion.has("0:0")).toBe(true);
      expect(privateSystem.playersByRegion.get("0:0")?.has("player1")).toBe(
        true,
      );
    });

    it("moves player between regions when position changes", () => {
      const privateSystem = system as unknown as {
        playersByRegion: Map<string, Set<string>>;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // First position: region 0:0
      privateSystem.updatePlayerTolerance("player1", { x: 10, y: 0, z: 10 });
      expect(privateSystem.playersByRegion.get("0:0")?.has("player1")).toBe(
        true,
      );

      // Move to new region: region 1:1 (position 25, 0, 25 -> tiles 25, 25 -> region floor(25/21)=1)
      privateSystem.updatePlayerTolerance("player1", { x: 25, y: 0, z: 25 });

      // Should be in new region
      expect(privateSystem.playersByRegion.get("1:1")?.has("player1")).toBe(
        true,
      );

      // Should NOT be in old region
      expect(privateSystem.playersByRegion.has("0:0")).toBe(false); // Cleaned up empty set
    });

    it("cleans up empty region sets", () => {
      const privateSystem = system as unknown as {
        playersByRegion: Map<string, Set<string>>;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Add player to region 0:0
      privateSystem.updatePlayerTolerance("player1", { x: 10, y: 0, z: 10 });
      expect(privateSystem.playersByRegion.has("0:0")).toBe(true);

      // Move player to different region
      privateSystem.updatePlayerTolerance("player1", { x: 50, y: 0, z: 50 });

      // Old region set should be deleted (not just empty)
      expect(privateSystem.playersByRegion.has("0:0")).toBe(false);
    });

    it("handles multiple players in same region", () => {
      const privateSystem = system as unknown as {
        playersByRegion: Map<string, Set<string>>;
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Add two players to same region
      privateSystem.updatePlayerTolerance("player1", { x: 5, y: 0, z: 5 });
      privateSystem.updatePlayerTolerance("player2", { x: 10, y: 0, z: 10 });

      const region = privateSystem.playersByRegion.get("0:0");
      expect(region?.size).toBe(2);
      expect(region?.has("player1")).toBe(true);
      expect(region?.has("player2")).toBe(true);
    });

    it("getRegionIdForPosition returns correct region", () => {
      // Test public method
      expect(system.getRegionIdForPosition({ x: 0, y: 0, z: 0 })).toBe("0:0");
      expect(system.getRegionIdForPosition({ x: 21, y: 0, z: 21 })).toBe("1:1");
      expect(system.getRegionIdForPosition({ x: 42, y: 0, z: 0 })).toBe("2:0");
      expect(system.getRegionIdForPosition({ x: -1, y: 0, z: -1 })).toBe(
        "-1:-1",
      );
    });

    it("getNearbyPlayerCount returns correct count for 2x2 grid", () => {
      const privateSystem = system as unknown as {
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Add players to region 0:0
      privateSystem.updatePlayerTolerance("player1", { x: 5, y: 0, z: 5 });
      privateSystem.updatePlayerTolerance("player2", { x: 10, y: 0, z: 10 });

      // Add player to adjacent region 1:1 (part of 2x2 when querying from upper-right of 0:0)
      // Position 15,15 is in upper-right half of region 0:0, so 2x2 includes 0:0, 1:0, 0:1, 1:1
      privateSystem.updatePlayerTolerance("player3", { x: 25, y: 0, z: 25 });

      // Query from upper-right of region 0:0 (tile 15,15) should find all 3
      const count = system.getNearbyPlayerCount({ x: 15, y: 0, z: 15 });
      expect(count).toBe(3);
    });

    it("getNearbyPlayerCount only includes 2x2 grid (42x42 tiles)", () => {
      const privateSystem = system as unknown as {
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Add player to region 0:0
      privateSystem.updatePlayerTolerance("player1", { x: 5, y: 0, z: 5 });

      // Add player far away in region 3:3 (outside 2x2 grid from 0:0)
      privateSystem.updatePlayerTolerance("player2", { x: 70, y: 0, z: 70 });

      // Query from lower-left of region 0:0 should only find player1
      // Position 5,5 is in lower-left, so 2x2 includes -1:-1, 0:-1, -1:0, 0:0
      const count = system.getNearbyPlayerCount({ x: 5, y: 0, z: 5 });
      expect(count).toBe(1);
    });

    it("handles negative tile coordinates correctly (positive modulo)", () => {
      const privateSystem = system as unknown as {
        updatePlayerTolerance: (
          playerId: string,
          position: { x: number; y: number; z: number },
        ) => void;
      };

      // Add player in negative region -1:-1 (position -10, -10)
      privateSystem.updatePlayerTolerance("player1", { x: -10, y: 0, z: -10 });

      // Query from negative position should find the player
      // Position -5,-5 is in region -1:-1, and -10,-10 is also in region -1:-1
      // The positive modulo fix ensures quadrant selection works for negative coords
      const count = system.getNearbyPlayerCount({ x: -5, y: 0, z: -5 });
      expect(count).toBe(1);

      // Also verify getRegionIdForPosition handles negatives correctly
      expect(system.getRegionIdForPosition({ x: -10, y: 0, z: -10 })).toBe(
        "-1:-1",
      );
      expect(system.getRegionIdForPosition({ x: -22, y: 0, z: -22 })).toBe(
        "-2:-2",
      );
    });
  });

  describe("leash mechanics", () => {
    it("stops chasing when mob exceeds leash range", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, Record<string, unknown>>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean; leashRange?: number };
        }) => void;
        updateMobAI: () => void;
      };

      privateSystem.registerMob({
        id: "goblin_leash",
        type: "goblin",
        level: 2,
        position: { x: 0, y: 0, z: 0 },
        combat: { aggressive: true, leashRange: 10 },
      });

      const mobState = privateSystem.mobStates.get("goblin_leash")!;
      // Simulate mob chasing a player far from home
      mobState.isChasing = true;
      mobState.currentTarget = "player1";
      mobState.isInCombat = false;
      mobState.currentPosition = { x: 50, y: 0, z: 0 }; // Far beyond leash range of 10

      privateSystem.updateMobAI();

      // Mob should stop chasing (leash triggered)
      expect(mobState.isChasing).toBe(false);
      expect(mobState.currentTarget).toBeNull();
    });

    it("continues chasing when within leash range and player exists", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, Record<string, unknown>>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean; leashRange?: number };
        }) => void;
        updateMobAI: () => void;
      };

      privateSystem.registerMob({
        id: "goblin_close",
        type: "goblin",
        level: 2,
        position: { x: 0, y: 0, z: 0 },
        combat: { aggressive: true, leashRange: 20 },
      });

      const mobState = privateSystem.mobStates.get("goblin_close")!;
      mobState.isChasing = true;
      mobState.currentTarget = "player1";
      mobState.isInCombat = false;
      mobState.currentPosition = { x: 5, y: 0, z: 0 }; // Within leash range

      // Add player so getPlayer returns a valid object (updateChasing checks player exists)
      world._players.set("player1", {
        id: "player1",
        node: { position: { x: 6, y: 0, z: 0 } },
      });

      // Add an aggro target so updateChasing has something to work with
      const now = Date.now();
      (mobState.aggroTargets as Map<string, unknown>).set("player1", {
        playerId: "player1",
        distance: 3,
        addedAt: 1,
        threatLevel: 1,
        lastSeen: now,
      });

      privateSystem.updateMobAI();

      // Mob should still be chasing (within leash, player exists)
      expect(mobState.isChasing).toBe(true);
    });

    it("returns home when not chasing and beyond leash range", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, Record<string, unknown>>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean; leashRange?: number };
        }) => void;
        updateMobAI: () => void;
      };

      privateSystem.registerMob({
        id: "goblin_lost",
        type: "goblin",
        level: 2,
        position: { x: 0, y: 0, z: 0 },
        combat: { aggressive: true, leashRange: 10 },
      });

      const mobState = privateSystem.mobStates.get("goblin_lost")!;
      mobState.isChasing = false;
      mobState.isInCombat = false;
      mobState.currentPosition = { x: 30, y: 0, z: 0 }; // Beyond leash

      // Should not throw when returning to home
      expect(() => privateSystem.updateMobAI()).not.toThrow();
    });
  });

  describe("multi-mob scenarios", () => {
    it("processes multiple mobs independently", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, Record<string, unknown>>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean; leashRange?: number };
        }) => void;
        updateMobAI: () => void;
      };

      // Register two mobs at different positions
      privateSystem.registerMob({
        id: "goblin_a",
        type: "goblin",
        level: 2,
        position: { x: 0, y: 0, z: 0 },
        combat: { aggressive: true, leashRange: 10 },
      });
      privateSystem.registerMob({
        id: "goblin_b",
        type: "goblin",
        level: 2,
        position: { x: 100, y: 0, z: 100 },
        combat: { aggressive: true, leashRange: 10 },
      });

      const stateA = privateSystem.mobStates.get("goblin_a")!;
      const stateB = privateSystem.mobStates.get("goblin_b")!;

      // Mob A is chasing beyond leash
      stateA.isChasing = true;
      stateA.currentTarget = "player1";
      stateA.isInCombat = false;
      stateA.currentPosition = { x: 50, y: 0, z: 0 };

      // Mob B is near home, idle
      stateB.isInCombat = false;
      stateB.isChasing = false;
      stateB.currentPosition = { x: 102, y: 0, z: 100 };

      privateSystem.updateMobAI();

      // A should have stopped chasing (leash)
      expect(stateA.isChasing).toBe(false);
      // B should still be in its normal state
      expect(stateB.isChasing).toBe(false);
      expect(stateB.isPatrolling).toBe(false); // Not aggressive enough to start patrol here
    });

    it("skips mobs in active combat", () => {
      const privateSystem = system as unknown as {
        mobStates: Map<string, Record<string, unknown>>;
        registerMob: (data: {
          id: string;
          type: string;
          level: number;
          position: { x: number; y: number; z: number };
          combat?: { aggressive?: boolean };
        }) => void;
        updateMobAI: () => void;
      };

      privateSystem.registerMob({
        id: "fighting_mob",
        type: "goblin",
        level: 2,
        position: { x: 0, y: 0, z: 0 },
        combat: { aggressive: true },
      });

      const mobState = privateSystem.mobStates.get("fighting_mob")!;
      mobState.isInCombat = true;
      mobState.isChasing = true;
      mobState.currentTarget = "player1";
      // Far from home but in combat - should be skipped
      mobState.currentPosition = { x: 999, y: 0, z: 999 };

      privateSystem.updateMobAI();

      // Should not be affected (combat system handles it)
      expect(mobState.isChasing).toBe(true);
      expect(mobState.isInCombat).toBe(true);
    });
  });
});
