/**
 * ChasePathfinding Unit Tests
 *
 * Tests the classic MMORPG "dumb pathfinder" algorithm for NPC chasing behavior.
 *
 * Key behaviors tested:
 * - Basic movement toward target
 * - Corner-cutting prevention (classic MMORPG rule)
 * - Cardinal priority when diagonal blocked
 * - Safespot detection (all directions blocked)
 * - Zero-allocation ChasePathfinder class
 *
 * @see MOB_AGGRO_IMPLEMENTATION_PLAN.md Phase 1.4, 4.1
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  chaseStep,
  ChasePathfinder,
  getChasePathfinder,
} from "../ChasePathfinding";
import type { TileCoord } from "../TileSystem";

describe("ChasePathfinding", () => {
  describe("chaseStep (function)", () => {
    describe("basic movement", () => {
      it("returns null when already at target", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 5, z: 5 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toBeNull();
      });

      it("moves north toward target", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 5, z: 10 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 5, z: 6 });
      });

      it("moves south toward target", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 5, z: 0 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 5, z: 4 });
      });

      it("moves east toward target", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 10, z: 5 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 6, z: 5 });
      });

      it("moves west toward target", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 0, z: 5 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 4, z: 5 });
      });
    });

    describe("diagonal movement (classic MMORPG corner-cutting rule)", () => {
      it("allows diagonal when both cardinal tiles are walkable", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 1, z: 1 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 1, z: 1 });
      });

      it("blocks diagonal when east cardinal is blocked (corner-cutting)", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 1, z: 1 };
        // Block tile (1, 0) - the east cardinal
        const isWalkable = (tile: TileCoord) => {
          return !(tile.x === 1 && tile.z === 0);
        };

        const result = chaseStep(current, target, isWalkable);

        // Should NOT move diagonally - instead move north (z axis)
        expect(result).not.toEqual({ x: 1, z: 1 });
        expect(result).toEqual({ x: 0, z: 1 });
      });

      it("blocks diagonal when north cardinal is blocked (corner-cutting)", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 1, z: 1 };
        // Block tile (0, 1) - the north cardinal
        const isWalkable = (tile: TileCoord) => {
          return !(tile.x === 0 && tile.z === 1);
        };

        const result = chaseStep(current, target, isWalkable);

        // Should NOT move diagonally - instead move east (x axis)
        expect(result).not.toEqual({ x: 1, z: 1 });
        expect(result).toEqual({ x: 1, z: 0 });
      });

      it("blocks diagonal when the diagonal tile itself is blocked", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 1, z: 1 };
        // Block only the diagonal tile (1, 1)
        const isWalkable = (tile: TileCoord) => {
          return !(tile.x === 1 && tile.z === 1);
        };

        const result = chaseStep(current, target, isWalkable);

        // Should move along one axis instead
        expect(result).not.toEqual({ x: 1, z: 1 });
        // Could be either (1, 0) or (0, 1) depending on distance priority
      });

      it("allows NE diagonal when valid", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 10, z: 10 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 6, z: 6 });
      });

      it("allows SW diagonal when valid", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 0, z: 0 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 4, z: 4 });
      });

      it("allows NW diagonal when valid", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 0, z: 10 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 4, z: 6 });
      });

      it("allows SE diagonal when valid", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 10, z: 0 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 6, z: 4 });
      });
    });

    describe("cardinal priority", () => {
      it("prioritizes X axis when horizontal distance is greater", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 10, z: 5 }; // X distance = 10, Z distance = 5
        // Block all diagonals
        const isWalkable = (tile: TileCoord) => {
          // Block any diagonal (where both x and z change)
          if (tile.x !== 0 && tile.z !== 0) return false;
          return true;
        };

        const result = chaseStep(current, target, isWalkable);

        // Should prioritize X (east) since absDx > absDz
        expect(result).toEqual({ x: 1, z: 0 });
      });

      it("prioritizes Z axis when vertical distance is greater", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 5, z: 10 }; // X distance = 5, Z distance = 10
        // Block all diagonals
        const isWalkable = (tile: TileCoord) => {
          if (tile.x !== 0 && tile.z !== 0) return false;
          return true;
        };

        const result = chaseStep(current, target, isWalkable);

        // Should prioritize Z (north) since absDz > absDx
        expect(result).toEqual({ x: 0, z: 1 });
      });

      it("defaults to X axis when distances are equal", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 5, z: 5 }; // Equal distances
        // Block all diagonals
        const isWalkable = (tile: TileCoord) => {
          if (tile.x !== 0 && tile.z !== 0) return false;
          return true;
        };

        const result = chaseStep(current, target, isWalkable);

        // Should prefer X when equal (absDx >= absDz)
        expect(result).toEqual({ x: 1, z: 0 });
      });

      it("falls back to secondary axis when primary is blocked", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 10, z: 5 }; // X distance greater
        // Block east (primary) but allow north (secondary)
        const isWalkable = (tile: TileCoord) => {
          if (tile.x === 1 && tile.z === 0) return false; // Block east
          if (tile.x !== 0 && tile.z !== 0) return false; // Block diagonals
          return true;
        };

        const result = chaseStep(current, target, isWalkable);

        // Should fall back to Z (north) axis
        expect(result).toEqual({ x: 0, z: 1 });
      });
    });

    describe("safespot detection (blocked)", () => {
      it("returns null when all directions are blocked (safespotted)", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 10, z: 10 };
        // Block all adjacent tiles
        const isWalkable = (tile: TileCoord) => {
          const dx = Math.abs(tile.x - current.x);
          const dz = Math.abs(tile.z - current.z);
          // Block everything 1 tile away from current
          if (dx <= 1 && dz <= 1 && !(dx === 0 && dz === 0)) {
            return false;
          }
          return true;
        };

        const result = chaseStep(current, target, isWalkable);

        expect(result).toBeNull();
      });

      it("returns null when blocked in L-shape obstacle", () => {
        const current = { x: 0, z: 0 };
        const target = { x: 1, z: 1 }; // NE diagonal
        // Create L-shape block: block (1,0) and (0,1)
        const isWalkable = (tile: TileCoord) => {
          if (tile.x === 1 && tile.z === 0) return false;
          if (tile.x === 0 && tile.z === 1) return false;
          return true;
        };

        const result = chaseStep(current, target, isWalkable);

        // Can't go diagonal (L-shape blocks it)
        // Can't go east (blocked)
        // Can't go north (blocked)
        expect(result).toBeNull();
      });
    });

    describe("edge cases", () => {
      it("handles negative coordinates", () => {
        const current = { x: -5, z: -5 };
        const target = { x: -10, z: -10 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: -6, z: -6 });
      });

      it("handles crossing zero boundary", () => {
        const current = { x: 1, z: 1 };
        const target = { x: -1, z: -1 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 0, z: 0 });
      });

      it("handles one step to target", () => {
        const current = { x: 5, z: 5 };
        const target = { x: 6, z: 5 };
        const isWalkable = () => true;

        const result = chaseStep(current, target, isWalkable);

        expect(result).toEqual({ x: 6, z: 5 });
      });
    });
  });

  describe("ChasePathfinder class (zero-allocation)", () => {
    let pathfinder: ChasePathfinder;

    beforeEach(() => {
      pathfinder = new ChasePathfinder();
    });

    describe("basic functionality matches chaseStep", () => {
      it("returns null when at target", () => {
        const result = pathfinder.chaseStep(
          { x: 5, z: 5 },
          { x: 5, z: 5 },
          () => true,
        );
        expect(result).toBeNull();
      });

      it("moves toward target", () => {
        const result = pathfinder.chaseStep(
          { x: 0, z: 0 },
          { x: 5, z: 5 },
          () => true,
        );
        expect(result).toEqual({ x: 1, z: 1 });
      });

      it("respects corner-cutting rule", () => {
        const result = pathfinder.chaseStep(
          { x: 0, z: 0 },
          { x: 1, z: 1 },
          (tile) => !(tile.x === 1 && tile.z === 0),
        );
        // Can't go diagonal because east is blocked
        expect(result).not.toEqual({ x: 1, z: 1 });
        expect(result).toEqual({ x: 0, z: 1 });
      });

      it("returns null when safespotted", () => {
        const result = pathfinder.chaseStep(
          { x: 5, z: 5 },
          { x: 10, z: 10 },
          (tile) => {
            // Block all adjacent tiles
            const dx = Math.abs(tile.x - 5);
            const dz = Math.abs(tile.z - 5);
            return !(dx <= 1 && dz <= 1);
          },
        );
        expect(result).toBeNull();
      });
    });

    describe("zero-allocation behavior", () => {
      it("reuses internal buffer (same reference for consecutive calls)", () => {
        const result1 = pathfinder.chaseStep(
          { x: 0, z: 0 },
          { x: 5, z: 5 },
          () => true,
        );
        const result2 = pathfinder.chaseStep(
          { x: 1, z: 1 },
          { x: 5, z: 5 },
          () => true,
        );

        // Both results point to same internal buffer
        // (values changed but same object reference)
        expect(result1).toBe(result2);
      });

      it("should copy result if storing", () => {
        const result = pathfinder.chaseStep(
          { x: 0, z: 0 },
          { x: 5, z: 5 },
          () => true,
        );

        // Copy the value before next call
        const savedX = result!.x;
        const savedZ = result!.z;

        // Next call overwrites the buffer
        pathfinder.chaseStep({ x: 10, z: 10 }, { x: 0, z: 0 }, () => true);

        // Original reference now has different values
        expect(result!.x).not.toBe(savedX);
        expect(result!.z).not.toBe(savedZ);
      });
    });
  });

  describe("getChasePathfinder singleton", () => {
    it("returns same instance on multiple calls", () => {
      const instance1 = getChasePathfinder();
      const instance2 = getChasePathfinder();

      expect(instance1).toBe(instance2);
    });

    it("returns valid ChasePathfinder instance", () => {
      const instance = getChasePathfinder();

      expect(instance).toBeInstanceOf(ChasePathfinder);

      // Should work correctly
      const result = instance.chaseStep(
        { x: 0, z: 0 },
        { x: 5, z: 5 },
        () => true,
      );
      expect(result).toEqual({ x: 1, z: 1 });
    });
  });

  describe("classic MMORPG safespot scenarios", () => {
    it("should get stuck behind rock (classic safespot)", () => {
      // Player behind rock, NPC can't path around
      //   [P] ← Player
      //   [R] ← Rock
      //   [N] ← NPC
      const npcPos = { x: 5, z: 5 };
      const rockPos = { x: 5, z: 6 }; // Rock between NPC and player
      const playerPos = { x: 5, z: 7 };

      const isWalkable = (tile: TileCoord) => {
        // Rock is not walkable
        return !(tile.x === rockPos.x && tile.z === rockPos.z);
      };

      const result = chaseStep(npcPos, playerPos, isWalkable);

      // NPC wants to go north but rock is in the way
      // With dumb pathfinder, NPC should be stuck (no path around)
      expect(result).toBeNull();
    });

    it("should get stuck in corner safespot", () => {
      //   [R][R]
      //   [R][P] ← Player in corner
      //   [N]    ← NPC below
      const npcPos = { x: 4, z: 4 };
      const playerPos = { x: 5, z: 5 };

      // Create corner safespot with rocks
      const rocks = new Set(["4,5", "5,6", "4,6"]);
      const isWalkable = (tile: TileCoord) => {
        return !rocks.has(`${tile.x},${tile.z}`);
      };

      const result = chaseStep(npcPos, playerPos, isWalkable);

      // NPC at (4,4), wants to reach (5,5)
      // Diagonal (5,5) requires (5,4) AND (4,5) to be walkable
      // (4,5) is a rock, so diagonal is blocked
      // East (5,4) should be walkable
      expect(result).toEqual({ x: 5, z: 4 });
    });
  });
});
