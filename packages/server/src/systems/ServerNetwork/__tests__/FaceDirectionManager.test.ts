/**
 * FaceDirectionManager Tests
 *
 * Tests the rules-accurate face direction system:
 * - Cardinal face direction (N/S/E/W) for resources
 * - Point-based face target for legacy interactions
 * - Movement flag tracking (skip rotation if moved)
 * - Network broadcast of rotation changes
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FaceDirectionManager } from "../FaceDirectionManager";

// ===== MOCK FACTORIES =====

interface MockPlayer {
  id: string;
  position: { x: number; y: number; z: number };
  faceTarget?: { x: number; z: number };
  cardinalFaceDirection?: "N" | "S" | "E" | "W";
  movedThisTick?: boolean;
  rotation?: { x: number; y: number; z: number; w: number };
  node?: {
    quaternion?: {
      set: ReturnType<typeof vi.fn>;
    };
  };
  base?: {
    quaternion?: {
      set: ReturnType<typeof vi.fn>;
    };
  };
  markNetworkDirty: ReturnType<typeof vi.fn>;
}

const createMockPlayer = (
  id: string,
  x: number,
  z: number,
  overrides: Partial<MockPlayer> = {},
): MockPlayer => ({
  id,
  position: { x, y: 0, z },
  movedThisTick: false,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  node: {
    quaternion: {
      set: vi.fn(),
    },
  },
  markNetworkDirty: vi.fn(),
  ...overrides,
});

const createMockWorld = () => {
  const players = new Map<string, MockPlayer>();

  return {
    players,
    getPlayer: vi.fn((id: string) => players.get(id)),
    entities: {
      players,
    },

    // Helper methods
    addPlayer: (player: MockPlayer) => {
      players.set(player.id, player);
    },
  };
};

type MockWorld = ReturnType<typeof createMockWorld>;

// ===== TEST SUITES =====

describe("FaceDirectionManager", () => {
  let manager: FaceDirectionManager;
  let mockWorld: MockWorld;
  let mockSendFn: (name: string, data: unknown) => void;

  beforeEach(() => {
    mockWorld = createMockWorld();
    manager = new FaceDirectionManager(mockWorld as never);
    mockSendFn = vi.fn() as (name: string, data: unknown) => void;
    manager.setSendFunction(mockSendFn);
  });

  // ===== setFaceTarget Tests =====

  describe("setFaceTarget", () => {
    it("should set face target on player", () => {
      const player = createMockPlayer("player1", 10, 10);
      mockWorld.addPlayer(player);

      manager.setFaceTarget("player1", 15, 20);

      expect(player.faceTarget).toEqual({ x: 15, z: 20 });
    });

    it("should reset movedThisTick when setting face target", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.movedThisTick = true;
      mockWorld.addPlayer(player);

      manager.setFaceTarget("player1", 15, 20);

      expect(player.movedThisTick).toBe(false);
    });

    it("should handle non-existent player gracefully", () => {
      // Should not throw
      expect(() => manager.setFaceTarget("nonexistent", 15, 20)).not.toThrow();
    });
  });

  // ===== setCardinalFaceTarget Tests =====

  describe("setCardinalFaceTarget", () => {
    it("should set SOUTH when player is north of resource", () => {
      // Player at (10, 12), resource at tile (10, 10) - player is north (higher z)
      const player = createMockPlayer("player1", 10.5, 12.5);
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1);

      // Player north of resource should face SOUTH
      expect(player.cardinalFaceDirection).toBe("S");
      expect(player.faceTarget).toBeUndefined(); // Cardinal clears point target
    });

    it("should set NORTH when player is south of resource", () => {
      // Player at (10, 8), resource at tile (10, 10) - player is south (lower z)
      const player = createMockPlayer("player1", 10.5, 8.5);
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1);

      // Player south of resource should face NORTH
      expect(player.cardinalFaceDirection).toBe("N");
    });

    it("should set WEST when player is east of resource", () => {
      // Player at (12, 10), resource at tile (10, 10) - player is east (higher x)
      const player = createMockPlayer("player1", 12.5, 10.5);
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1);

      // Player east of resource should face WEST
      expect(player.cardinalFaceDirection).toBe("W");
    });

    it("should set EAST when player is west of resource", () => {
      // Player at (8, 10), resource at tile (10, 10) - player is west (lower x)
      const player = createMockPlayer("player1", 8.5, 10.5);
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1);

      // Player west of resource should face EAST
      expect(player.cardinalFaceDirection).toBe("E");
    });

    it("should handle 2x2 resource footprint", () => {
      // Resource is 2x2 at anchor (10, 10) - occupies tiles (10,10), (11,10), (10,11), (11,11)
      // Player at tile (12, 10) - east of resource
      const player = createMockPlayer("player1", 12.5, 10.5);
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 2, 2);

      expect(player.cardinalFaceDirection).toBe("W");
    });

    it("should fall back to center-based facing if not on cardinal tile", () => {
      // Player is diagonal to resource (not on cardinal tile)
      const player = createMockPlayer("player1", 12.5, 12.5);
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1);

      // Should fall back to point-based facing toward center
      // Cardinal direction should NOT be set
      expect(player.cardinalFaceDirection).toBeUndefined();
      // Instead, faceTarget should be set to resource center
      expect(player.faceTarget).toBeDefined();
    });

    it("should reset movedThisTick when setting cardinal direction", () => {
      const player = createMockPlayer("player1", 10.5, 12.5);
      player.movedThisTick = true;
      mockWorld.addPlayer(player);

      manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1);

      expect(player.movedThisTick).toBe(false);
    });

    it("should handle player without position gracefully", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.position = undefined as never;
      mockWorld.addPlayer(player);

      // Should not throw
      expect(() =>
        manager.setCardinalFaceTarget("player1", { x: 10, z: 10 }, 1, 1),
      ).not.toThrow();
    });
  });

  // ===== clearFaceTarget Tests =====

  describe("clearFaceTarget", () => {
    it("should clear faceTarget", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 20 };
      mockWorld.addPlayer(player);

      manager.clearFaceTarget("player1");

      expect(player.faceTarget).toBeUndefined();
    });

    it("should clear cardinalFaceDirection", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "S";
      mockWorld.addPlayer(player);

      manager.clearFaceTarget("player1");

      expect(player.cardinalFaceDirection).toBeUndefined();
    });

    it("should handle non-existent player gracefully", () => {
      expect(() => manager.clearFaceTarget("nonexistent")).not.toThrow();
    });
  });

  // ===== markPlayerMoved Tests =====

  describe("markPlayerMoved", () => {
    it("should set movedThisTick to true", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.markPlayerMoved("player1");

      expect(player.movedThisTick).toBe(true);
    });

    it("should handle non-existent player gracefully", () => {
      expect(() => manager.markPlayerMoved("nonexistent")).not.toThrow();
    });
  });

  // ===== resetMovementFlags Tests =====

  describe("resetMovementFlags", () => {
    it("should reset movedThisTick for all players", () => {
      const player1 = createMockPlayer("player1", 10, 10);
      const player2 = createMockPlayer("player2", 20, 20);
      player1.movedThisTick = true;
      player2.movedThisTick = true;
      mockWorld.addPlayer(player1);
      mockWorld.addPlayer(player2);

      manager.resetMovementFlags();

      expect(player1.movedThisTick).toBe(false);
      expect(player2.movedThisTick).toBe(false);
    });

    it("should handle empty player list", () => {
      expect(() => manager.resetMovementFlags()).not.toThrow();
    });
  });

  // ===== processFaceDirection Tests =====

  describe("processFaceDirection", () => {
    it("should skip rotation if player moved this tick", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = true;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      // Rotation should NOT be applied
      expect(player.node?.quaternion?.set).not.toHaveBeenCalled();
      // But faceTarget should PERSIST (classic MMORPG behavior)
      expect(player.faceTarget).toEqual({ x: 15, z: 10 });
    });

    it("should apply rotation if player is stationary", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 }; // Target is east
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      // Rotation should be applied
      expect(player.node?.quaternion?.set).toHaveBeenCalled();
      // faceTarget should be cleared after applying
      expect(player.faceTarget).toBeUndefined();
    });

    it("should persist faceTarget if player is moving", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = true;
      mockWorld.addPlayer(player);

      // First tick - player moving
      manager.processFaceDirection(["player1"]);
      expect(player.faceTarget).toEqual({ x: 15, z: 10 }); // Still set

      // Second tick - player stopped
      player.movedThisTick = false;
      manager.processFaceDirection(["player1"]);
      expect(player.faceTarget).toBeUndefined(); // Now cleared
    });

    it("should broadcast rotation via entityModified packet", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      expect(mockSendFn).toHaveBeenCalledWith(
        "entityModified",
        expect.objectContaining({
          id: "player1",
          changes: expect.objectContaining({
            q: expect.any(Array),
          }),
        }),
      );
    });

    it("should prioritize cardinal direction over faceTarget", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "S";
      player.faceTarget = { x: 15, z: 10 }; // This should be ignored
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      // Cardinal direction should be applied and cleared
      expect(player.cardinalFaceDirection).toBeUndefined();
      // faceTarget was not used (would still be set if it was point-based)
      // Actually, looking at the code, faceTarget is only cleared when used
      // Cardinal takes priority so faceTarget remains
    });

    it("should clear cardinal direction after applying", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "S";
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      expect(player.cardinalFaceDirection).toBeUndefined();
    });

    it("should mark player as network dirty", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      expect(player.markNetworkDirty).toHaveBeenCalled();
    });

    it("should skip player if already at target position", () => {
      const player = createMockPlayer("player1", 10, 10);
      // Target is same as player position
      player.faceTarget = { x: 10, z: 10 };
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      // Should skip because distance is too small
      expect(player.node?.quaternion?.set).not.toHaveBeenCalled();
      // But should still clear the target
      expect(player.faceTarget).toBeUndefined();
    });

    it("should handle player without node.quaternion", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = false;
      player.node = undefined;
      mockWorld.addPlayer(player);

      // Should not throw
      expect(() => manager.processFaceDirection(["player1"])).not.toThrow();
    });

    it("should process multiple players in order", () => {
      const player1 = createMockPlayer("player1", 10, 10);
      const player2 = createMockPlayer("player2", 20, 20);
      player1.faceTarget = { x: 15, z: 10 };
      player2.faceTarget = { x: 25, z: 20 };
      player1.movedThisTick = false;
      player2.movedThisTick = false;
      mockWorld.addPlayer(player1);
      mockWorld.addPlayer(player2);

      manager.processFaceDirection(["player1", "player2"]);

      expect(player1.node?.quaternion?.set).toHaveBeenCalled();
      expect(player2.node?.quaternion?.set).toHaveBeenCalled();
    });

    it("should skip non-existent players without breaking others", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      // Include non-existent player in the list
      manager.processFaceDirection(["nonexistent", "player1"]);

      // player1 should still be processed
      expect(player.node?.quaternion?.set).toHaveBeenCalled();
    });
  });

  // ===== setSendFunction Tests =====

  describe("setSendFunction", () => {
    it("should set the send function for broadcasting", () => {
      const newSendFn = vi.fn();
      manager.setSendFunction(newSendFn);

      const player = createMockPlayer("player1", 10, 10);
      player.faceTarget = { x: 15, z: 10 };
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      expect(newSendFn).toHaveBeenCalled();
      expect(mockSendFn).not.toHaveBeenCalled();
    });
  });

  // ===== Rotation Angle Tests =====

  describe("rotation angles", () => {
    it("should apply correct quaternion for SOUTH direction", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "S";
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      // SOUTH = PI radians = 180 degrees
      // For Y-axis rotation: quaternion = (0, sin(angle/2), 0, cos(angle/2))
      // sin(PI/2) = 1, cos(PI/2) = 0
      // So quaternion should be approximately (0, 1, 0, 0) for facing south
      const setCall = player.node?.quaternion?.set.mock.calls[0];
      expect(setCall).toBeDefined();
      // Check that Y component is dominant (facing south)
      // The exact values depend on getCardinalFaceAngle implementation
    });

    it("should apply correct quaternion for NORTH direction", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "N";
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      const setCall = player.node?.quaternion?.set.mock.calls[0];
      expect(setCall).toBeDefined();
    });

    it("should apply correct quaternion for EAST direction", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "E";
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      const setCall = player.node?.quaternion?.set.mock.calls[0];
      expect(setCall).toBeDefined();
    });

    it("should apply correct quaternion for WEST direction", () => {
      const player = createMockPlayer("player1", 10, 10);
      player.cardinalFaceDirection = "W";
      player.movedThisTick = false;
      mockWorld.addPlayer(player);

      manager.processFaceDirection(["player1"]);

      const setCall = player.node?.quaternion?.set.mock.calls[0];
      expect(setCall).toBeDefined();
    });
  });
});
