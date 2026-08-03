/**
 * RangeSystem Unit Tests
 *
 * Tests rules-accurate range calculations for NPC aggro and combat.
 *
 * Key behaviors tested:
 * - Hunt range (SW tile origin)
 * - Attack range (all occupied tiles)
 * - Max range from spawn
 * - Large NPC tile occupation
 * - Melee range 1 diagonal exclusion
 *
 * @see MOB_AGGRO_IMPLEMENTATION_PLAN.md Phase 2.2
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RangeSystem,
  getRangeSystem,
  getNPCSize,
  NPC_SIZES,
  type NPCRangeData,
} from "../RangeSystem";
import { AttackType } from "../../../../types/core/core";
import type { Position3D } from "../../../../types";
import type { TileCoord } from "../../movement/TileSystem";

describe("RangeSystem", () => {
  let rangeSystem: RangeSystem;

  beforeEach(() => {
    rangeSystem = new RangeSystem();
  });

  describe("getNPCSize", () => {
    it("returns correct size for known NPCs", () => {
      expect(getNPCSize("goblin")).toEqual({ width: 1, depth: 1 });
      expect(getNPCSize("general_graardor")).toEqual({ width: 2, depth: 2 });
      expect(getNPCSize("corporeal_beast")).toEqual({ width: 3, depth: 3 });
      expect(getNPCSize("vorkath")).toEqual({ width: 4, depth: 4 });
      expect(getNPCSize("olm_head")).toEqual({ width: 5, depth: 5 });
    });

    it("returns 1x1 for unknown NPCs", () => {
      expect(getNPCSize("unknown_mob")).toEqual({ width: 1, depth: 1 });
      expect(getNPCSize("random_creature")).toEqual({ width: 1, depth: 1 });
    });

    it("is case-insensitive", () => {
      expect(getNPCSize("GOBLIN")).toEqual({ width: 1, depth: 1 });
      expect(getNPCSize("General_Graardor")).toEqual({ width: 2, depth: 2 });
    });
  });

  describe("NPC_SIZES registry", () => {
    it("contains all standard 1x1 NPCs", () => {
      const oneByOne = [
        "goblin",
        "cow",
        "chicken",
        "rat",
        "spider",
        "skeleton",
        "zombie",
        "imp",
      ];
      for (const npc of oneByOne) {
        expect(NPC_SIZES[npc]).toEqual({ width: 1, depth: 1 });
      }
    });

    it("contains 2x2 boss NPCs", () => {
      const twoByTwo = [
        "general_graardor",
        "kril_tsutsaroth",
        "commander_zilyana",
        "kreearra",
        "giant_mole",
        "kalphite_queen",
      ];
      for (const npc of twoByTwo) {
        expect(NPC_SIZES[npc]).toEqual({ width: 2, depth: 2 });
      }
    });

    it("contains large boss NPCs", () => {
      expect(NPC_SIZES["corporeal_beast"]).toEqual({ width: 3, depth: 3 });
      expect(NPC_SIZES["vorkath"]).toEqual({ width: 4, depth: 4 });
      expect(NPC_SIZES["olm_head"]).toEqual({ width: 5, depth: 5 });
    });
  });

  describe("getSWTile", () => {
    it("returns SW tile from world position", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const swTile = rangeSystem.getSWTile(pos);

      expect(swTile.x).toBe(5);
      expect(swTile.z).toBe(5);
    });

    it("handles tile boundaries correctly", () => {
      // Exact boundary
      expect(rangeSystem.getSWTile({ x: 5.0, y: 0, z: 5.0 })).toEqual({
        x: 5,
        z: 5,
      });
      // Just under boundary
      expect(rangeSystem.getSWTile({ x: 4.999, y: 0, z: 4.999 })).toEqual({
        x: 4,
        z: 4,
      });
    });

    it("handles negative coordinates", () => {
      const pos: Position3D = { x: -2.5, y: 0, z: -3.5 };
      const swTile = rangeSystem.getSWTile(pos);

      expect(swTile.x).toBe(-3);
      expect(swTile.z).toBe(-4);
    });
  });

  describe("getOccupiedTiles", () => {
    it("returns 1 tile for 1x1 NPC", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const size = { width: 1, depth: 1 };

      const count = rangeSystem.getOccupiedTiles(pos, size);
      const tiles = rangeSystem.getOccupiedTilesBuffer();

      expect(count).toBe(1);
      expect(tiles[0]).toEqual({ x: 5, z: 5 });
    });

    it("returns 4 tiles for 2x2 NPC", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 }; // SW corner at (5, 5)
      const size = { width: 2, depth: 2 };

      const count = rangeSystem.getOccupiedTiles(pos, size);
      const tiles = rangeSystem.getOccupiedTilesBuffer();

      expect(count).toBe(4);
      // Should occupy (5,5), (6,5), (5,6), (6,6)
      const expectedTiles = [
        { x: 5, z: 5 },
        { x: 5, z: 6 },
        { x: 6, z: 5 },
        { x: 6, z: 6 },
      ];

      const actualTiles = [];
      for (let i = 0; i < count; i++) {
        actualTiles.push({ x: tiles[i].x, z: tiles[i].z });
      }

      for (const expected of expectedTiles) {
        expect(actualTiles).toContainEqual(expected);
      }
    });

    it("returns 9 tiles for 3x3 NPC", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const size = { width: 3, depth: 3 };

      const count = rangeSystem.getOccupiedTiles(pos, size);

      expect(count).toBe(9);
    });

    it("returns 25 tiles for 5x5 NPC (max supported)", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const size = { width: 5, depth: 5 };

      const count = rangeSystem.getOccupiedTiles(pos, size);

      expect(count).toBe(25);
    });
  });

  describe("isTileOccupied", () => {
    it("returns true for tiles within NPC bounds", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const size = { width: 2, depth: 2 };

      expect(rangeSystem.isTileOccupied({ x: 5, z: 5 }, pos, size)).toBe(true);
      expect(rangeSystem.isTileOccupied({ x: 6, z: 5 }, pos, size)).toBe(true);
      expect(rangeSystem.isTileOccupied({ x: 5, z: 6 }, pos, size)).toBe(true);
      expect(rangeSystem.isTileOccupied({ x: 6, z: 6 }, pos, size)).toBe(true);
    });

    it("returns false for tiles outside NPC bounds", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const size = { width: 2, depth: 2 };

      expect(rangeSystem.isTileOccupied({ x: 4, z: 5 }, pos, size)).toBe(false);
      expect(rangeSystem.isTileOccupied({ x: 7, z: 5 }, pos, size)).toBe(false);
      expect(rangeSystem.isTileOccupied({ x: 5, z: 4 }, pos, size)).toBe(false);
      expect(rangeSystem.isTileOccupied({ x: 5, z: 7 }, pos, size)).toBe(false);
    });
  });

  describe("isInHuntRange", () => {
    const createNPC = (
      x: number,
      z: number,
      huntRange: number,
      size = { width: 1, depth: 1 },
    ): NPCRangeData => ({
      position: { x: x + 0.5, y: 0, z: z + 0.5 },
      size,
      huntRange,
      attackRange: 1,
      maxRange: 20,
      attackType: AttackType.MELEE,
    });

    it("returns true when player is within hunt range", () => {
      const npc = createNPC(5, 5, 5);
      const playerPos: Position3D = { x: 8.5, y: 0, z: 5.5 }; // 3 tiles east

      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(true);
    });

    it("returns false when player is outside hunt range", () => {
      const npc = createNPC(5, 5, 5);
      const playerPos: Position3D = { x: 15.5, y: 0, z: 5.5 }; // 10 tiles east

      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(false);
    });

    it("uses SW tile as origin for large NPCs", () => {
      // 2x2 NPC at SW corner (5,5), occupying (5,5), (6,5), (5,6), (6,6)
      const npc = createNPC(5, 5, 3, { width: 2, depth: 2 });

      // Player at (8,5) - 3 tiles from SW (5,5) but only 2 tiles from NE (6,6)
      const playerPos: Position3D = { x: 8.5, y: 0, z: 5.5 };

      // Hunt range is from SW tile (5,5) to player (8,5) = 3 tiles
      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(true);

      // Player at (9,5) - 4 tiles from SW
      const farPlayerPos: Position3D = { x: 9.5, y: 0, z: 5.5 };
      expect(rangeSystem.isInHuntRange(npc, farPlayerPos)).toBe(false);
    });

    it("uses Chebyshev distance (diagonal = 1)", () => {
      const npc = createNPC(5, 5, 5);
      // Diagonal: 5 tiles NE
      const playerPos: Position3D = { x: 10.5, y: 0, z: 10.5 };

      // Chebyshev distance = max(5, 5) = 5
      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(true);
    });

    it("includes exact boundary distance", () => {
      const npc = createNPC(5, 5, 5);
      // Exactly 5 tiles away
      const playerPos: Position3D = { x: 10.5, y: 0, z: 5.5 };

      expect(rangeSystem.isInHuntRange(npc, playerPos)).toBe(true);
    });
  });

  describe("isInAttackRange", () => {
    const createNPC = (
      x: number,
      z: number,
      attackRange: number,
      attackType: AttackType,
      size = { width: 1, depth: 1 },
    ): NPCRangeData => ({
      position: { x: x + 0.5, y: 0, z: z + 0.5 },
      size,
      huntRange: 10,
      attackRange,
      maxRange: 20,
      attackType,
    });

    describe("melee attacks", () => {
      it("returns true for cardinal adjacent tiles (range 1)", () => {
        const npc = createNPC(5, 5, 1, AttackType.MELEE);

        // North
        expect(rangeSystem.isInAttackRange(npc, { x: 5.5, y: 0, z: 6.5 })).toBe(
          true,
        );
        // South
        expect(rangeSystem.isInAttackRange(npc, { x: 5.5, y: 0, z: 4.5 })).toBe(
          true,
        );
        // East
        expect(rangeSystem.isInAttackRange(npc, { x: 6.5, y: 0, z: 5.5 })).toBe(
          true,
        );
        // West
        expect(rangeSystem.isInAttackRange(npc, { x: 4.5, y: 0, z: 5.5 })).toBe(
          true,
        );
      });

      it("returns false for diagonal adjacent tiles (range 1 - classic MMORPG rule)", () => {
        const npc = createNPC(5, 5, 1, AttackType.MELEE);

        // NE diagonal
        expect(rangeSystem.isInAttackRange(npc, { x: 6.5, y: 0, z: 6.5 })).toBe(
          false,
        );
        // SE diagonal
        expect(rangeSystem.isInAttackRange(npc, { x: 6.5, y: 0, z: 4.5 })).toBe(
          false,
        );
        // SW diagonal
        expect(rangeSystem.isInAttackRange(npc, { x: 4.5, y: 0, z: 4.5 })).toBe(
          false,
        );
        // NW diagonal
        expect(rangeSystem.isInAttackRange(npc, { x: 4.5, y: 0, z: 6.5 })).toBe(
          false,
        );
      });

      it("allows diagonal for range 2 (halberd)", () => {
        const npc = createNPC(5, 5, 2, AttackType.MELEE);

        // Diagonal should work with range 2
        expect(rangeSystem.isInAttackRange(npc, { x: 6.5, y: 0, z: 6.5 })).toBe(
          true,
        );
        // 2 tiles away cardinal
        expect(rangeSystem.isInAttackRange(npc, { x: 7.5, y: 0, z: 5.5 })).toBe(
          true,
        );
      });

      it("returns false for same tile (distance 0)", () => {
        const npc = createNPC(5, 5, 1, AttackType.MELEE);
        expect(rangeSystem.isInAttackRange(npc, { x: 5.5, y: 0, z: 5.5 })).toBe(
          false,
        );
      });
    });

    describe("ranged attacks", () => {
      it("allows diagonal for any range", () => {
        const npc = createNPC(5, 5, 7, AttackType.RANGED);

        // Diagonal 5 tiles away
        expect(
          rangeSystem.isInAttackRange(npc, { x: 10.5, y: 0, z: 10.5 }),
        ).toBe(true);
      });

      it("uses Chebyshev distance", () => {
        const npc = createNPC(5, 5, 10, AttackType.RANGED);

        // 8 east, 4 north - Chebyshev = max(8, 4) = 8
        expect(
          rangeSystem.isInAttackRange(npc, { x: 13.5, y: 0, z: 9.5 }),
        ).toBe(true);
      });

      it("returns false for same tile", () => {
        const npc = createNPC(5, 5, 7, AttackType.RANGED);
        expect(rangeSystem.isInAttackRange(npc, { x: 5.5, y: 0, z: 5.5 })).toBe(
          false,
        );
      });
    });

    describe("large NPC attack range", () => {
      it("checks from ALL occupied tiles (2x2 NPC)", () => {
        // 2x2 NPC at SW (5,5), occupies (5,5), (6,5), (5,6), (6,6)
        const npc = createNPC(5, 5, 1, AttackType.MELEE, {
          width: 2,
          depth: 2,
        });

        // Player at (7,5) - adjacent to NE corner (6,5) but 2 tiles from SW
        const playerPos: Position3D = { x: 7.5, y: 0, z: 5.5 };
        expect(rangeSystem.isInAttackRange(npc, playerPos)).toBe(true);

        // Player at (5,7) - adjacent to NW corner (5,6)
        const player2: Position3D = { x: 5.5, y: 0, z: 7.5 };
        expect(rangeSystem.isInAttackRange(npc, player2)).toBe(true);

        // Player at (4,5) - adjacent to SW corner (5,5)
        const player3: Position3D = { x: 4.5, y: 0, z: 5.5 };
        expect(rangeSystem.isInAttackRange(npc, player3)).toBe(true);
      });

      it("returns false when player is too far from all tiles", () => {
        const npc = createNPC(5, 5, 1, AttackType.MELEE, {
          width: 2,
          depth: 2,
        });

        // Player at (9,5) - 3 tiles from nearest occupied tile (6,5)
        const playerPos: Position3D = { x: 9.5, y: 0, z: 5.5 };
        expect(rangeSystem.isInAttackRange(npc, playerPos)).toBe(false);
      });
    });
  });

  describe("isWithinMaxRange", () => {
    const createNPC = (
      x: number,
      z: number,
      maxRange: number,
    ): NPCRangeData => ({
      position: { x: x + 0.5, y: 0, z: z + 0.5 },
      size: { width: 1, depth: 1 },
      huntRange: 5,
      attackRange: 1,
      maxRange,
      attackType: AttackType.MELEE,
    });

    it("returns true when NPC is at spawn", () => {
      const npc = createNPC(5, 5, 10);
      const spawnPoint: TileCoord = { x: 5, z: 5 };

      expect(rangeSystem.isWithinMaxRange(npc, spawnPoint)).toBe(true);
    });

    it("returns true when NPC is within max range", () => {
      const npc = createNPC(10, 5, 10);
      const spawnPoint: TileCoord = { x: 5, z: 5 };

      expect(rangeSystem.isWithinMaxRange(npc, spawnPoint)).toBe(true);
    });

    it("returns false when NPC exceeds max range", () => {
      const npc = createNPC(20, 5, 10);
      const spawnPoint: TileCoord = { x: 5, z: 5 };

      expect(rangeSystem.isWithinMaxRange(npc, spawnPoint)).toBe(false);
    });

    it("uses Chebyshev distance for diagonal", () => {
      const npc = createNPC(15, 15, 10); // 10 tiles diagonal from (5,5)
      const spawnPoint: TileCoord = { x: 5, z: 5 };

      // Chebyshev = max(10, 10) = 10
      expect(rangeSystem.isWithinMaxRange(npc, spawnPoint)).toBe(true);
    });
  });

  describe("getDistanceToTarget", () => {
    it("returns correct Chebyshev distance", () => {
      const npcPos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const targetPos: Position3D = { x: 10.5, y: 0, z: 8.5 };

      // dx = 5, dz = 3, Chebyshev = max(5, 3) = 5
      const distance = rangeSystem.getDistanceToTarget(npcPos, targetPos);

      expect(distance).toBe(5);
    });

    it("returns 0 for same tile", () => {
      const pos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      expect(rangeSystem.getDistanceToTarget(pos, pos)).toBe(0);
    });

    it("returns 1 for adjacent tiles", () => {
      const npcPos: Position3D = { x: 5.5, y: 0, z: 5.5 };
      const targetPos: Position3D = { x: 6.5, y: 0, z: 6.5 };

      expect(rangeSystem.getDistanceToTarget(npcPos, targetPos)).toBe(1);
    });
  });

  describe("getRangeSystem singleton", () => {
    it("returns same instance on multiple calls", () => {
      const instance1 = getRangeSystem();
      const instance2 = getRangeSystem();

      expect(instance1).toBe(instance2);
    });

    it("returns functional RangeSystem", () => {
      const instance = getRangeSystem();
      expect(instance).toBeInstanceOf(RangeSystem);
    });
  });
});
