/**
 * CombatRotationManager Unit Tests
 *
 * Tests for entity rotation during combat:
 * - Rotating entities to face targets
 * - Quaternion pool usage (acquire/release)
 * - VRM 1.0+ base rotation compensation
 * - Handling missing entities gracefully
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { CombatRotationManager } from "../CombatRotationManager";
import { quaternionPool } from "../../../../utils/pools/QuaternionPool";

/**
 * Position interface
 */
interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion-like interface
 */
interface MockQuaternion {
  set: Mock;
  copy: Mock;
}

/**
 * Mock player entity interface
 */
interface MockPlayer {
  id: string;
  position: Position3D;
  base: { quaternion: MockQuaternion };
  node: { quaternion: MockQuaternion };
  markNetworkDirty: Mock;
}

/**
 * Mock mob entity interface
 */
interface MockMob {
  id: string;
  position: Position3D;
  node: { quaternion: MockQuaternion };
  markNetworkDirty: Mock;
}

/**
 * Mock world interface
 */
interface MockWorld {
  entities: Map<string, MockMob>;
  getPlayer: (id: string) => MockPlayer | undefined;
}

// Mock World
function createMockWorld(
  options: {
    players?: Map<string, MockPlayer>;
    entities?: Map<string, MockMob>;
  } = {},
): MockWorld {
  const players = options.players || new Map<string, MockPlayer>();
  const entities = options.entities || new Map<string, MockMob>();

  return {
    entities,
    getPlayer: (id: string) => players.get(id),
  };
}

// Mock player entity with position and quaternion
function createMockPlayer(
  id: string,
  position: Position3D,
  overrides: Partial<MockPlayer> = {},
): MockPlayer {
  return {
    id,
    position,
    base: {
      quaternion: {
        set: vi.fn(),
        copy: vi.fn(),
      },
    },
    node: {
      quaternion: {
        set: vi.fn(),
        copy: vi.fn(),
      },
    },
    markNetworkDirty: vi.fn(),
    ...overrides,
  };
}

// Mock mob entity
function createMockMob(
  id: string,
  position: Position3D,
  overrides: Partial<MockMob> = {},
): MockMob {
  return {
    id,
    position,
    node: {
      quaternion: {
        set: vi.fn(),
        copy: vi.fn(),
      },
    },
    markNetworkDirty: vi.fn(),
    ...overrides,
  };
}

describe("CombatRotationManager", () => {
  let rotationManager: CombatRotationManager;
  let mockWorld: MockWorld;
  let mockPlayers: Map<string, MockPlayer>;
  let mockEntities: Map<string, MockMob>;

  beforeEach(() => {
    mockPlayers = new Map();
    mockEntities = new Map();
    mockWorld = createMockWorld({
      players: mockPlayers,
      entities: mockEntities,
    });
    rotationManager = new CombatRotationManager(mockWorld);

    // Reset pool to known state
    quaternionPool.reset();
  });

  describe("rotateTowardsTarget", () => {
    it("rotates player to face target", () => {
      const player = createMockPlayer("player1", { x: 0, y: 0, z: 0 });
      const mob = createMockMob("mob1", { x: 5, y: 0, z: 0 });
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");

      // Should set rotation on base quaternion
      expect(player.base.quaternion.set).toHaveBeenCalled();
      // Should copy to node quaternion
      expect(player.node.quaternion.copy).toHaveBeenCalled();
      // Should mark network dirty
      expect(player.markNetworkDirty).toHaveBeenCalled();
    });

    it("rotates mob to face player", () => {
      const player = createMockPlayer("player1", { x: 5, y: 0, z: 5 });
      const mob = createMockMob("mob1", { x: 0, y: 0, z: 0 });
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      rotationManager.rotateTowardsTarget("mob1", "player1", "mob", "player");

      // Should set rotation on node quaternion
      expect(mob.node.quaternion.set).toHaveBeenCalled();
      expect(mob.markNetworkDirty).toHaveBeenCalled();
    });

    it("handles missing entity gracefully", () => {
      const player = createMockPlayer("player1", { x: 0, y: 0, z: 0 });
      mockPlayers.set("player1", player);
      // mob1 does not exist

      expect(() => {
        rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");
      }).not.toThrow();

      // Should not have set any rotation
      expect(player.base.quaternion.set).not.toHaveBeenCalled();
    });

    it("handles missing target gracefully", () => {
      const mob = createMockMob("mob1", { x: 0, y: 0, z: 0 });
      mockEntities.set("mob1", mob);
      // player1 does not exist

      expect(() => {
        rotationManager.rotateTowardsTarget("mob1", "player1", "mob", "player");
      }).not.toThrow();

      expect(mob.node.quaternion.set).not.toHaveBeenCalled();
    });

    it("handles entity with missing position gracefully", () => {
      const player = createMockPlayer("player1", { x: 0, y: 0, z: 0 });
      const mob = createMockMob("mob1", null as any); // No position
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      expect(() => {
        rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");
      }).not.toThrow();

      expect(player.base.quaternion.set).not.toHaveBeenCalled();
    });

    it("uses getPosition() fallback when position property missing", () => {
      const player = {
        id: "player1",
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        base: { quaternion: { set: vi.fn(), copy: vi.fn() } },
        node: { quaternion: { set: vi.fn(), copy: vi.fn() } },
        markNetworkDirty: vi.fn(),
      };
      const mob = createMockMob("mob1", { x: 5, y: 0, z: 0 });
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");

      expect(player.base.quaternion.set).toHaveBeenCalled();
    });
  });

  describe("quaternion pool usage", () => {
    it("acquires and releases quaternion from pool", () => {
      const player = createMockPlayer("player1", { x: 0, y: 0, z: 0 });
      const mob = createMockMob("mob1", { x: 5, y: 0, z: 0 });
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      const statsBefore = quaternionPool.getStats();
      const inUseBefore = statsBefore.inUse;

      rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");

      const statsAfter = quaternionPool.getStats();
      // Should have released the quaternion back
      expect(statsAfter.inUse).toBe(inUseBefore);
    });

    it("releases quaternion even if rotation fails", () => {
      const player = createMockPlayer("player1", { x: 0, y: 0, z: 0 });
      // Create a player with quaternion that throws
      player.base.quaternion.set = vi.fn().mockImplementation(() => {
        throw new Error("Quaternion error");
      });
      const mob = createMockMob("mob1", { x: 5, y: 0, z: 0 });
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      const statsBefore = quaternionPool.getStats();

      // Should throw but still release
      expect(() => {
        rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");
      }).toThrow();

      const statsAfter = quaternionPool.getStats();
      expect(statsAfter.inUse).toBe(statsBefore.inUse);
    });
  });

  describe("calculateFacingAngle", () => {
    it("calculates correct angle for target directly east", () => {
      const from = { x: 0, y: 0, z: 0 };
      const to = { x: 5, y: 0, z: 0 };

      const angle = rotationManager.calculateFacingAngle(from, to);

      // East is +X, which is 90 degrees (PI/2) from north
      // Plus PI for VRM 1.0+ compensation
      expect(angle).toBeCloseTo(Math.PI / 2 + Math.PI);
    });

    it("calculates correct angle for target directly north", () => {
      const from = { x: 0, y: 0, z: 0 };
      const to = { x: 0, y: 0, z: 5 };

      const angle = rotationManager.calculateFacingAngle(from, to);

      // North is +Z, which is 0 degrees
      // Plus PI for VRM 1.0+ compensation
      expect(angle).toBeCloseTo(Math.PI);
    });

    it("calculates correct angle for target southwest", () => {
      const from = { x: 0, y: 0, z: 0 };
      const to = { x: -5, y: 0, z: -5 };

      const angle = rotationManager.calculateFacingAngle(from, to);

      // Southwest is -X, -Z which is -135 degrees (-3PI/4)
      // Plus PI for VRM 1.0+ compensation
      expect(angle).toBeCloseTo((-3 * Math.PI) / 4 + Math.PI);
    });

    it("ignores Y coordinate (vertical position)", () => {
      const from = { x: 0, y: 0, z: 0 };
      const toFlat = { x: 5, y: 0, z: 0 };
      const toElevated = { x: 5, y: 100, z: 0 };

      const angleFlat = rotationManager.calculateFacingAngle(from, toFlat);
      const angleElevated = rotationManager.calculateFacingAngle(
        from,
        toElevated,
      );

      // Y should not affect rotation
      expect(angleFlat).toBe(angleElevated);
    });
  });

  describe("VRM 1.0+ compensation", () => {
    it("adds PI to angle for VRM 1.0+ models", () => {
      // VRM 1.0+ models have 180 degree base rotation
      // So we add PI to make them face TOWARDS the target instead of away
      const player = createMockPlayer("player1", { x: 0, y: 0, z: 0 });
      const mob = createMockMob("mob1", { x: 0, y: 0, z: 5 }); // North of player
      mockPlayers.set("player1", player);
      mockEntities.set("mob1", mob);

      rotationManager.rotateTowardsTarget("player1", "mob1", "player", "mob");

      // Verify quaternion.set was called
      expect(player.base.quaternion.set).toHaveBeenCalled();

      // The set call should use the compensated angle
      // For north (z+), base angle is 0, plus PI = PI
      // Y rotation quaternion: sin(PI/2) = 1, cos(PI/2) = 0
      const setCall = player.base.quaternion.set.mock.calls[0];
      expect(setCall[0]).toBeCloseTo(0); // x
      expect(Math.abs(setCall[1])).toBeCloseTo(1); // y (sin of half angle)
      expect(setCall[2]).toBeCloseTo(0); // z
      expect(Math.abs(setCall[3])).toBeLessThan(0.01); // w (cos of half angle, near 0)
    });
  });
});
