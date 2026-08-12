import {
  CollisionFlag,
  CollisionMatrix,
  getDuelArenaConfig,
} from "@hyperforge/shared";
import { describe, expect, it, vi } from "vitest";

import { ArenaPoolManager } from "../ArenaPoolManager";

describe("ArenaPoolManager authoritative collision", () => {
  it("keeps a specifically owned arena out of general allocation", () => {
    const pool = new ArenaPoolManager();

    expect(pool.reserveSpecificArena(1, "streaming-owner")).toBe(true);
    expect(pool.reserveSpecificArena(1, "second-owner")).toBe(false);
    expect(pool.getDuelIdForArena(1)).toBe("streaming-owner");
    expect(pool.reserveArena("ordinary-duel")).toBe(2);
    expect(pool.getAvailableCount()).toBe(pool.totalArenas - 2);

    expect(pool.releaseSpecificArena(1, "wrong-owner")).toBe(false);
    expect(pool.getDuelIdForArena(1)).toBe("streaming-owner");
    expect(pool.releaseSpecificArena(1, "streaming-owner")).toBe(true);
    expect(pool.reserveArena("next-duel")).toBe(1);
  });

  it("closes every arena perimeter against cardinal and diagonal traversal", () => {
    const collision = new CollisionMatrix();
    const pool = new ArenaPoolManager();
    const config = getDuelArenaConfig();

    pool.registerArenaWallCollision(collision);

    expect(pool.totalArenas).toBe(config.arenaCount);
    for (const arenaId of pool.getAllArenaIds()) {
      const bounds = pool.getArenaBounds(arenaId)!;
      const minX = Math.round(bounds.min.x);
      const maxX = Math.round(bounds.max.x);
      const minZ = Math.round(bounds.min.z);
      const maxZ = Math.round(bounds.max.z);

      for (let x = minX - 1; x <= maxX + 1; x++) {
        expect(collision.hasFlags(x, minZ - 1, CollisionFlag.BLOCKED)).toBe(
          true,
        );
        expect(collision.hasFlags(x, maxZ + 1, CollisionFlag.BLOCKED)).toBe(
          true,
        );
      }
      for (let z = minZ; z <= maxZ; z++) {
        expect(collision.hasFlags(minX - 1, z, CollisionFlag.BLOCKED)).toBe(
          true,
        );
        expect(collision.hasFlags(maxX + 1, z, CollisionFlag.BLOCKED)).toBe(
          true,
        );
      }

      const centerX = Math.floor((minX + maxX) / 2);
      const centerZ = Math.floor((minZ + maxZ) / 2);
      expect(collision.isBlocked(minX, centerZ, minX - 1, centerZ)).toBe(true);
      expect(collision.isBlocked(maxX, centerZ, maxX + 1, centerZ)).toBe(true);
      expect(collision.isBlocked(centerX, minZ, centerX, minZ - 1)).toBe(true);
      expect(collision.isBlocked(centerX, maxZ, centerX, maxZ + 1)).toBe(true);
      expect(collision.isBlocked(minX, minZ, minX - 1, minZ - 1)).toBe(true);
      expect(collision.isBlocked(maxX, maxZ, maxX + 1, maxZ + 1)).toBe(true);
    }
  });

  it("fails closed when the collision matrix does not retain wall flags", () => {
    const collision = new CollisionMatrix();
    vi.spyOn(collision, "addFlags").mockImplementation(() => {});

    expect(() =>
      new ArenaPoolManager().registerArenaWallCollision(collision),
    ).toThrow(/Authoritative arena collision audit failed/);
  });
});
