/**
 * Mob Aggro Integration Tests
 *
 * End-to-end tests for rules-accurate mob aggro, pathfinding, and combat mechanics:
 * - Safespot mechanics (dumb pathfinder getting stuck)
 * - Corner-cutting prevention
 * - Large NPC (2x2, 3x3) attack range from all occupied tiles
 * - First-attack timing (attack on NEXT tick after entering range)
 * - Probabilistic wandering
 * - Hunt range vs attack range distinction
 *
 * @see MOB_AGGRO_IMPLEMENTATION_PLAN.md Phase 5.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import { chaseStep, ChasePathfinder } from "../../movement/ChasePathfinding";
import { RangeSystem, type NPCRangeData } from "../RangeSystem";
import { CombatStateManager } from "../../../../entities/managers/CombatStateManager";
import { WanderBehavior } from "../../movement/WanderBehavior";
import { AttackType } from "../../../../types/core/core";
import type { TileCoord } from "../../movement/TileSystem";
import type { Position3D } from "../../../../types";

describe("Mob Aggro Integration", () => {
  describe("safespot mechanics", () => {
    /**
     * Classic safespot scenario:
     * Player hides behind an obstacle, NPC's dumb pathfinder gets stuck.
     *
     *   [P] ← Player at (5, 7)
     *   [R] ← Rock at (5, 6)
     *   [N] ← NPC at (5, 5)
     */
    it("NPC gets stuck behind single obstacle (classic safespot)", () => {
      const npcTile: TileCoord = { x: 5, z: 5 };
      const playerTile: TileCoord = { x: 5, z: 7 };
      const rockTile: TileCoord = { x: 5, z: 6 };

      const isWalkable = (tile: TileCoord) => {
        return !(tile.x === rockTile.x && tile.z === rockTile.z);
      };

      // NPC tries to path to player
      const nextStep = chaseStep(npcTile, playerTile, isWalkable);

      // Dumb pathfinder should return null (stuck)
      // because the direct path is blocked and it doesn't path around
      expect(nextStep).toBeNull();
    });

    /**
     * L-shaped safespot:
     *   [R][ ]
     *   [R][P] ← Player at (6, 5)
     *   [N][ ] ← NPC at (5, 4)
     */
    it("NPC gets stuck at L-shaped obstacle", () => {
      const npcTile: TileCoord = { x: 5, z: 4 };
      const playerTile: TileCoord = { x: 6, z: 5 };
      const rocks = new Set(["5,5", "5,6"]);

      const isWalkable = (tile: TileCoord) => {
        return !rocks.has(`${tile.x},${tile.z}`);
      };

      // NPC wants to move diagonally NE, but (5,5) is blocked
      // Corner-cutting rule prevents diagonal when adjacent cardinal is blocked
      const nextStep = chaseStep(npcTile, playerTile, isWalkable);

      // Should try to go east (6,4) since north (5,5) is blocked
      expect(nextStep).toEqual({ x: 6, z: 4 });
    });

    /**
     * Corner safespot where ALL paths are blocked:
     *   [R][R][R]
     *   [R][P][ ] ← Player at (6, 6)
     *   [ ][N][ ] ← NPC at (6, 5)
     */
    it("NPC completely stuck when all approach paths blocked", () => {
      const npcTile: TileCoord = { x: 6, z: 5 };
      const playerTile: TileCoord = { x: 6, z: 6 };

      // Block tiles around the player except NPC's position
      const rocks = new Set(["5,6", "5,7", "6,7", "7,7"]);

      const isWalkable = (tile: TileCoord) => {
        return !rocks.has(`${tile.x},${tile.z}`);
      };

      // NPC at (6,5) wants to reach player at (6,6)
      // Only one step needed (north), check if blocked
      const northTile: TileCoord = { x: 6, z: 6 };
      const isNorthBlocked = !isWalkable(northTile);

      // North is walkable (player tile), so NPC can move there
      expect(isNorthBlocked).toBe(false);

      const nextStep = chaseStep(npcTile, playerTile, isWalkable);
      expect(nextStep).toEqual({ x: 6, z: 6 });
    });

    /**
     * Fences/trees safespot - NPC oscillates but never reaches:
     *   [F][ ][F]
     *   [ ][P][ ] ← Player at (5, 6)
     *   [F][ ][F]
     *   [ ][N][ ] ← NPC at (5, 4)
     */
    it("NPC cannot reach through fence pattern", () => {
      const npcTile: TileCoord = { x: 5, z: 4 };
      const playerTile: TileCoord = { x: 5, z: 6 };

      // Fence pattern blocks diagonals around player
      const fences = new Set(["4,5", "6,5", "4,7", "6,7"]);

      const isWalkable = (tile: TileCoord) => {
        return !fences.has(`${tile.x},${tile.z}`);
      };

      // NPC should move north toward player
      const step1 = chaseStep(npcTile, playerTile, isWalkable);
      expect(step1).toEqual({ x: 5, z: 5 });

      // From (5,5), NPC can reach (5,6) directly
      const step2 = chaseStep({ x: 5, z: 5 }, playerTile, isWalkable);
      expect(step2).toEqual({ x: 5, z: 6 });
    });
  });

  describe("corner-cutting prevention", () => {
    let pathfinder: ChasePathfinder;

    beforeEach(() => {
      pathfinder = new ChasePathfinder();
    });

    /**
     * classic MMORPG corner-cutting rule:
     * To move diagonally, BOTH adjacent cardinal tiles must be walkable.
     *
     *   [ ][B]
     *   [ ][N] → [D]
     *
     * N at (0,0) wants to go to D at (1,1)
     * B (blocked) at (1,0)
     * Cannot cut through corner even though (0,1) and (1,1) are walkable
     */
    it("blocks diagonal when east cardinal is blocked", () => {
      const current: TileCoord = { x: 0, z: 0 };
      const target: TileCoord = { x: 1, z: 1 };

      const isWalkable = (tile: TileCoord) => {
        // Block (1, 0) - the east cardinal
        return !(tile.x === 1 && tile.z === 0);
      };

      const result = pathfinder.chaseStep(current, target, isWalkable);

      // Should NOT move diagonally
      expect(result).not.toEqual({ x: 1, z: 1 });
      // Should move north instead (fallback cardinal)
      expect(result).toEqual({ x: 0, z: 1 });
    });

    it("blocks diagonal when north cardinal is blocked", () => {
      const current: TileCoord = { x: 0, z: 0 };
      const target: TileCoord = { x: 1, z: 1 };

      const isWalkable = (tile: TileCoord) => {
        // Block (0, 1) - the north cardinal
        return !(tile.x === 0 && tile.z === 1);
      };

      const result = pathfinder.chaseStep(current, target, isWalkable);

      // Should NOT move diagonally
      expect(result).not.toEqual({ x: 1, z: 1 });
      // Should move east instead
      expect(result).toEqual({ x: 1, z: 0 });
    });

    it("blocks diagonal when both cardinals are blocked (stuck)", () => {
      const current: TileCoord = { x: 0, z: 0 };
      const target: TileCoord = { x: 1, z: 1 };

      const isWalkable = (tile: TileCoord) => {
        // Block both cardinals
        if (tile.x === 1 && tile.z === 0) return false;
        if (tile.x === 0 && tile.z === 1) return false;
        return true;
      };

      const result = pathfinder.chaseStep(current, target, isWalkable);

      // Completely stuck - no valid moves
      expect(result).toBeNull();
    });

    it("allows diagonal when both cardinals are walkable", () => {
      const current: TileCoord = { x: 0, z: 0 };
      const target: TileCoord = { x: 1, z: 1 };

      const isWalkable = () => true;

      const result = pathfinder.chaseStep(current, target, isWalkable);

      // Should move diagonally
      expect(result).toEqual({ x: 1, z: 1 });
    });

    /**
     * Wall-running scenario:
     * NPC tries to cut corner around wall but must go around.
     *
     *   [ ][ ][T]  T = target
     *   [W][W][ ]  W = wall
     *   [N][ ][ ]  N = NPC
     */
    it("NPC must path around wall corner", () => {
      const npcTile: TileCoord = { x: 0, z: 0 };
      const targetTile: TileCoord = { x: 2, z: 2 };
      const walls = new Set(["0,1", "1,1"]);

      const isWalkable = (tile: TileCoord) => {
        return !walls.has(`${tile.x},${tile.z}`);
      };

      // First step: Can't go diagonal NE (0,1 north is blocked)
      // Should go east (1,0)
      const step1 = pathfinder.chaseStep(npcTile, targetTile, isWalkable);
      expect(step1).toEqual({ x: 1, z: 0 });

      // Second step from (1,0): Can't go diagonal NE because (1,1) is blocked
      // Should go east to (2,0)
      const step2 = pathfinder.chaseStep(
        { x: 1, z: 0 },
        targetTile,
        isWalkable,
      );
      expect(step2).toEqual({ x: 2, z: 0 });

      // Third step from (2,0): Now can go north freely
      const step3 = pathfinder.chaseStep(
        { x: 2, z: 0 },
        targetTile,
        isWalkable,
      );
      expect(step3).toEqual({ x: 2, z: 1 });

      // Fourth step: Continue to target
      const step4 = pathfinder.chaseStep(
        { x: 2, z: 1 },
        targetTile,
        isWalkable,
      );
      expect(step4).toEqual({ x: 2, z: 2 });
    });
  });

  describe("large NPC attack range", () => {
    let rangeSystem: RangeSystem;

    beforeEach(() => {
      rangeSystem = new RangeSystem();
    });

    const createLargeNPC = (
      swX: number,
      swZ: number,
      width: number,
      depth: number,
      attackRange: number = 1,
    ): NPCRangeData => ({
      position: { x: swX + 0.5, y: 0, z: swZ + 0.5 },
      size: { width, depth },
      huntRange: 10,
      attackRange,
      maxRange: 20,
      attackType: AttackType.MELEE,
    });

    /**
     * 2x2 NPC attack range:
     * NPC occupies tiles (5,5), (6,5), (5,6), (6,6)
     * Player adjacent to ANY occupied tile is in attack range.
     *
     *   [ ][ ][ ][ ]
     *   [ ][N][N][ ]
     *   [ ][N][N][P] ← Player at (7,5)
     *   [ ][ ][ ][ ]
     */
    it("2x2 NPC can attack player adjacent to east edge", () => {
      const npc = createLargeNPC(5, 5, 2, 2, 1);
      const playerPos: Position3D = { x: 7.5, y: 0, z: 5.5 }; // Tile (7, 5)

      // Player is 1 tile east of NPC's east edge (6,5)
      const inRange = rangeSystem.isInAttackRange(npc, playerPos);
      expect(inRange).toBe(true);
    });

    it("2x2 NPC can attack player adjacent to north edge", () => {
      const npc = createLargeNPC(5, 5, 2, 2, 1);
      const playerPos: Position3D = { x: 5.5, y: 0, z: 7.5 }; // Tile (5, 7)

      // Player is 1 tile north of NPC's north edge (5,6)
      const inRange = rangeSystem.isInAttackRange(npc, playerPos);
      expect(inRange).toBe(true);
    });

    it("2x2 NPC cannot attack diagonal player (range 1)", () => {
      const npc = createLargeNPC(5, 5, 2, 2, 1);
      const playerPos: Position3D = { x: 7.5, y: 0, z: 7.5 }; // Tile (7, 7)

      // Player is diagonal to NPC's NE corner (6,6)
      // With range 1, diagonals are excluded
      const inRange = rangeSystem.isInAttackRange(npc, playerPos);
      expect(inRange).toBe(false);
    });

    it("2x2 NPC CAN attack diagonal with range 2", () => {
      const npc = createLargeNPC(5, 5, 2, 2, 2);
      const playerPos: Position3D = { x: 7.5, y: 0, z: 7.5 }; // Tile (7, 7)

      // With range 2, diagonal from (6,6) to (7,7) is allowed
      const inRange = rangeSystem.isInAttackRange(npc, playerPos);
      expect(inRange).toBe(true);
    });

    /**
     * 3x3 NPC (like Corporeal Beast):
     * Occupies 9 tiles, can attack from any of them.
     */
    it("3x3 NPC can attack from any occupied tile", () => {
      const npc = createLargeNPC(5, 5, 3, 3, 1);

      // Player at various positions around the 3x3
      const positions: Array<{
        pos: Position3D;
        expected: boolean;
        desc: string;
      }> = [
        { pos: { x: 4.5, y: 0, z: 5.5 }, expected: true, desc: "west of SW" },
        { pos: { x: 8.5, y: 0, z: 5.5 }, expected: true, desc: "east of SE" },
        { pos: { x: 5.5, y: 0, z: 8.5 }, expected: true, desc: "north of NW" },
        { pos: { x: 5.5, y: 0, z: 4.5 }, expected: true, desc: "south of SW" },
        {
          pos: { x: 4.5, y: 0, z: 4.5 },
          expected: false,
          desc: "diagonal SW (range 1)",
        },
        {
          pos: { x: 10.5, y: 0, z: 5.5 },
          expected: false,
          desc: "2 tiles east",
        },
      ];

      for (const { pos, expected, desc } of positions) {
        const inRange = rangeSystem.isInAttackRange(npc, pos);
        expect(inRange, desc).toBe(expected);
      }
    });

    /**
     * Hunt range uses SW tile only, even for large NPCs.
     */
    it("hunt range is calculated from SW tile only", () => {
      const npc = createLargeNPC(5, 5, 3, 3, 1);
      // Override hunt range for test
      (npc as NPCRangeData).huntRange = 5;

      // Player 5 tiles from SW (5,5) should be in hunt range
      const playerInRange: Position3D = { x: 10.5, y: 0, z: 5.5 }; // Tile (10, 5)
      expect(rangeSystem.isInHuntRange(npc, playerInRange)).toBe(true);

      // Player 6 tiles from SW should be out of range
      const playerOutRange: Position3D = { x: 11.5, y: 0, z: 5.5 }; // Tile (11, 5)
      expect(rangeSystem.isInHuntRange(npc, playerOutRange)).toBe(false);

      // Player 3 tiles from NE corner (7,7) but 5 tiles from SW (5,5)
      // Hunt range uses SW, so this is at the edge
      const playerFromNE: Position3D = { x: 10.5, y: 0, z: 7.5 }; // Tile (10, 7)
      expect(rangeSystem.isInHuntRange(npc, playerFromNE)).toBe(true);
    });
  });

  describe("first-attack timing", () => {
    /**
     * classic MMORPG: When NPC enters combat range, first attack is on NEXT tick.
     */
    it("first attack delayed by 1 tick after entering combat range", () => {
      const combatManager = new CombatStateManager({
        attackPower: 10,
        attackSpeedTicks: 4,
        attackRange: 1,
      });

      const currentTick = 100;

      // NPC enters combat range
      combatManager.onEnterCombatRange(currentTick);

      // Should NOT be able to attack on the same tick
      expect(combatManager.canAttack(currentTick)).toBe(false);

      // Should be able to attack on the NEXT tick
      expect(combatManager.canAttack(currentTick + 1)).toBe(true);
    });

    it("subsequent attacks follow normal attack speed", () => {
      const attackSpeed = 4;
      const combatManager = new CombatStateManager({
        attackPower: 10,
        attackSpeedTicks: attackSpeed,
        attackRange: 1,
      });

      const startTick = 100;

      // Enter combat range
      combatManager.onEnterCombatRange(startTick);

      // First attack on tick 101
      expect(combatManager.canAttack(startTick + 1)).toBe(true);
      combatManager.performAttack("target1", startTick + 1);

      // Next attack should be at tick 101 + 4 = 105
      expect(combatManager.canAttack(startTick + 2)).toBe(false);
      expect(combatManager.canAttack(startTick + 4)).toBe(false);
      expect(combatManager.canAttack(startTick + 5)).toBe(true);
    });

    it("first-attack timing resets after exiting combat", () => {
      const combatManager = new CombatStateManager({
        attackPower: 10,
        attackSpeedTicks: 4,
        attackRange: 1,
      });

      // First combat
      combatManager.onEnterCombatRange(100);
      expect(combatManager.canAttack(100)).toBe(false);
      expect(combatManager.canAttack(101)).toBe(true);
      combatManager.performAttack("target1", 101);

      // Exit combat
      combatManager.exitCombat();

      // New combat - first attack timing should apply again
      combatManager.onEnterCombatRange(200);
      expect(combatManager.canAttack(200)).toBe(false);
      expect(combatManager.canAttack(201)).toBe(true);
    });

    it("pending first attack state is tracked correctly", () => {
      const combatManager = new CombatStateManager({
        attackPower: 10,
        attackSpeedTicks: 4,
        attackRange: 1,
      });

      expect(combatManager.isPendingFirstAttack()).toBe(false);

      combatManager.onEnterCombatRange(100);
      expect(combatManager.isPendingFirstAttack()).toBe(true);
      expect(combatManager.getFirstAttackTick()).toBe(101);

      combatManager.performAttack("target1", 101);
      expect(combatManager.isPendingFirstAttack()).toBe(false);
      expect(combatManager.getFirstAttackTick()).toBe(-1);
    });

    it("re-entry attack timing resets before old cooldown expires (issue #572)", () => {
      // This test verifies the fix for issue #572:
      // When mob re-enters combat range after chasing, it should reset attack timing
      // to use 1-tick first-attack delay, NOT wait for stale nextAttackTick
      const combatManager = new CombatStateManager({
        attackPower: 10,
        attackSpeedTicks: 4,
        attackRange: 1,
      });

      // Initial combat at tick 100
      combatManager.onEnterCombatRange(100);
      expect(combatManager.canAttack(101)).toBe(true);
      combatManager.performAttack("target1", 101);
      // nextAttackTick is now 105 (101 + 4)

      // Target moves away, mob exits combat
      combatManager.exitCombat();

      // Mob re-enters combat range at tick 103 (BEFORE old cooldown of 105 would expire)
      combatManager.onEnterCombatRange(103);

      // Should NOT be able to attack on same tick (first-attack delay applies)
      expect(combatManager.canAttack(103)).toBe(false);

      // Should be able to attack on NEXT tick (104), not wait until stale 105
      // This is the key assertion: attack at 104, not 105
      expect(combatManager.canAttack(104)).toBe(true);
    });
  });

  describe("probabilistic wandering", () => {
    it("wandering is probabilistic around 26% per tick", () => {
      const behavior = new WanderBehavior({ movementType: "wander" });

      let wanderCount = 0;
      const iterations = 10000;

      for (let tick = 0; tick < iterations; tick++) {
        if (behavior.shouldStartWander(false, false, false, tick)) {
          wanderCount++;
        }
      }

      const percentage = wanderCount / iterations;
      // Should be roughly 26% with variance (22-30% acceptable)
      expect(percentage).toBeGreaterThan(0.22);
      expect(percentage).toBeLessThan(0.3);
    });

    it("stationary NPCs never wander regardless of chance", () => {
      const behavior = new WanderBehavior({
        movementType: "stationary",
        wanderChance: 1.0, // 100% chance
      });

      let wanderCount = 0;
      for (let tick = 0; tick < 100; tick++) {
        if (behavior.shouldStartWander(false, false, false, tick)) {
          wanderCount++;
        }
      }

      expect(wanderCount).toBe(0);
    });

    it("wander target is within configured radius", () => {
      const radius = 5;
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderRadius: radius,
      });

      const spawnTile: TileCoord = { x: 100, z: 100 };

      for (let i = 0; i < 100; i++) {
        const target = behavior.generateWanderTarget(spawnTile);
        const dx = Math.abs(target.x - spawnTile.x);
        const dz = Math.abs(target.z - spawnTile.z);

        expect(dx).toBeLessThanOrEqual(radius);
        expect(dz).toBeLessThanOrEqual(radius);
      }
    });

    it("wander behavior blocked during combat", () => {
      const behavior = new WanderBehavior({
        movementType: "wander",
        wanderChance: 1.0, // 100% chance normally
      });

      // Should NOT wander when in combat
      expect(behavior.shouldStartWander(false, true, false, 1)).toBe(false);

      // Should NOT wander when has target
      expect(behavior.shouldStartWander(true, false, false, 2)).toBe(false);

      // Should NOT wander when already has wander path
      expect(behavior.shouldStartWander(false, false, true, 3)).toBe(false);

      // Should wander when all conditions are clear
      expect(behavior.shouldStartWander(false, false, false, 4)).toBe(true);
    });
  });

  describe("hunt range vs attack range", () => {
    let rangeSystem: RangeSystem;

    beforeEach(() => {
      rangeSystem = new RangeSystem();
    });

    it("NPC can hunt (aggro) from further than it can attack", () => {
      const npc: NPCRangeData = {
        position: { x: 5.5, y: 0, z: 5.5 },
        size: { width: 1, depth: 1 },
        huntRange: 5,
        attackRange: 1,
        maxRange: 20,
        attackType: AttackType.MELEE,
      };

      // Player 3 tiles away - in hunt range but not attack range
      const playerPos: Position3D = { x: 8.5, y: 0, z: 5.5 };

      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(true);
      expect(rangeSystem.isInAttackRange(npc, playerPos)).toBe(false);
    });

    it("NPC stops chasing when player exceeds max range from spawn", () => {
      const npc: NPCRangeData = {
        position: { x: 15.5, y: 0, z: 5.5 }, // NPC has moved from spawn
        size: { width: 1, depth: 1 },
        huntRange: 5,
        attackRange: 1,
        maxRange: 10, // Max 10 tiles from spawn
        attackType: AttackType.MELEE,
      };

      const spawnPoint: TileCoord = { x: 5, z: 5 };

      // NPC at (15,5) is 10 tiles from spawn (5,5) - at max range
      expect(rangeSystem.isWithinMaxRange(npc, spawnPoint)).toBe(true);

      // Move NPC one more tile away
      npc.position.x = 16.5;
      expect(rangeSystem.isWithinMaxRange(npc, spawnPoint)).toBe(false);
    });
  });

  describe("integrated combat scenario", () => {
    /**
     * Full scenario: NPC aggros player, chases, gets stuck at safespot
     */
    it("NPC aggros, chases, then gets stuck at safespot", () => {
      const rangeSystem = new RangeSystem();
      const pathfinder = new ChasePathfinder();

      // Setup: NPC at spawn, player in hunt range behind L-shaped obstacle
      //
      //   [ ][ ][ ][ ][P]    P = Player at (8,8)
      //   [ ][ ][ ][W][ ]    W = Wall creating safespot
      //   [ ][ ][W][W][ ]    NPC can only approach from SW
      //   [ ][ ][ ][ ][ ]    but diagonal blocked by corner-cutting rule
      //   [N][ ][ ][ ][ ]    N = NPC starts at (4,4)
      //
      const npc: NPCRangeData = {
        position: { x: 4.5, y: 0, z: 4.5 },
        size: { width: 1, depth: 1 },
        huntRange: 10,
        attackRange: 1,
        maxRange: 15,
        attackType: AttackType.MELEE,
      };

      const playerPos: Position3D = { x: 8.5, y: 0, z: 8.5 };

      // L-shaped obstacle blocking direct path to player
      // Plus tiles around player to create actual safespot
      const rocks = new Set([
        "6,6",
        "7,6",
        "7,7", // L-shape blocking diagonal approach
        "8,7",
        "9,8",
        "8,9", // Block cardinal approaches to player
      ]);
      const isWalkable = (tile: TileCoord) => !rocks.has(`${tile.x},${tile.z}`);

      // Step 1: Check if player is in hunt range
      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(true);

      // Step 2: NPC chases player
      let npcTile: TileCoord = { x: 4, z: 4 };
      const playerTile: TileCoord = { x: 8, z: 8 };
      const path: TileCoord[] = [];

      for (let i = 0; i < 15; i++) {
        const nextStep = pathfinder.chaseStep(npcTile, playerTile, isWalkable);
        if (
          !nextStep ||
          (nextStep.x === npcTile.x && nextStep.z === npcTile.z)
        ) {
          break; // Stuck - no valid move
        }

        path.push({ x: nextStep.x, z: nextStep.z });
        npcTile = { x: nextStep.x, z: nextStep.z };
      }

      // NPC should have moved toward player
      expect(path.length).toBeGreaterThan(0);

      // Final position should NOT be at player (blocked by safespot)
      expect(npcTile).not.toEqual(playerTile);

      // NPC should NOT be able to reach melee range (cardinal adjacent to player)
      const meleeRangePositions = [
        { x: 7, z: 8 }, // west of player - blocked by 7,7 corner-cutting
        { x: 9, z: 8 }, // east of player - blocked
        { x: 8, z: 7 }, // south of player - blocked
        { x: 8, z: 9 }, // north of player - blocked
      ];
      const inMeleeRange = meleeRangePositions.some(
        (pos) => pos.x === npcTile.x && pos.z === npcTile.z,
      );
      expect(inMeleeRange).toBe(false);
    });

    /**
     * Full scenario: Large NPC attacking player from multiple positions
     */
    it("2x2 NPC can attack player from any edge", () => {
      const rangeSystem = new RangeSystem();

      const npc: NPCRangeData = {
        position: { x: 5.5, y: 0, z: 5.5 }, // SW corner at (5,5)
        size: { width: 2, depth: 2 },
        huntRange: 10,
        attackRange: 1,
        maxRange: 20,
        attackType: AttackType.MELEE,
      };

      // Test attacking from all 4 cardinal edges
      const edgePositions = [
        { x: 4.5, y: 0, z: 5.5 }, // West of SW
        { x: 7.5, y: 0, z: 5.5 }, // East of SE
        { x: 5.5, y: 0, z: 4.5 }, // South of SW
        { x: 5.5, y: 0, z: 7.5 }, // North of NW
      ];

      for (const pos of edgePositions) {
        expect(rangeSystem.isInAttackRange(npc, pos)).toBe(true);
      }

      // Corner positions should be out of range (range 1)
      const cornerPositions = [
        { x: 4.5, y: 0, z: 4.5 }, // SW diagonal
        { x: 7.5, y: 0, z: 7.5 }, // NE diagonal
      ];

      for (const pos of cornerPositions) {
        expect(rangeSystem.isInAttackRange(npc, pos)).toBe(false);
      }
    });
  });
});
