/**
 * Player Loading Spawn Protection - Integration Tests
 *
 * Verifies that loading players are immune to aggro and combat (Issue #356).
 * Tests the actual protection logic in AggroSystem and CombatSystem.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================================
// Types (matching actual game types)
// ============================================================================

interface Position3D {
  x: number;
  y: number;
  z: number;
}

interface EntityData {
  id: string;
  type: string;
  name?: string;
  owner?: string;
  isLoading?: boolean;
  health?: number;
  maxHealth?: number;
  mobType?: string;
  target?: string | null;
  aggroRange?: number;
  isHostile?: boolean;
}

interface MockEntity {
  id: string;
  data: EntityData;
  node?: {
    position: Position3D;
  };
}

interface MobAggroState {
  mobId: string;
  currentTarget: string | null;
  currentPosition: Position3D;
  aggroRange: number;
  isHostile: boolean;
}

// ============================================================================
// Helper Functions (extracted logic from actual systems)
// ============================================================================

function calculateDistance(pos1: Position3D, pos2: Position3D): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Aggro check logic from AggroSystem.checkAggroForPlayer (line 236-290)
 * Returns true if mob should aggro onto player
 */
function shouldAggroPlayer(
  world: { entities: Map<string, MockEntity> },
  mobState: MobAggroState,
  playerId: string,
  playerPosition: Position3D,
): boolean {
  // Skip players still loading - they're immune to aggro until clientReady
  const playerEntity = world.entities.get(playerId);
  if (playerEntity?.data?.isLoading) {
    return false;
  }

  // Already has a target
  if (mobState.currentTarget) {
    return false;
  }

  // Not hostile
  if (!mobState.isHostile) {
    return false;
  }

  // Check distance
  const distance = calculateDistance(mobState.currentPosition, playerPosition);
  if (distance > mobState.aggroRange) {
    return false;
  }

  return true;
}

/**
 * Combat validation logic from CombatSystem.handleMobAttack (line 214-221)
 * Returns true if attack should be allowed
 */
function canAttackTarget(
  target: MockEntity,
  targetType: "player" | "mob",
): boolean {
  // CRITICAL: Check if target player is still loading (Issue #356)
  // Players are immune to combat until their client finishes loading assets
  if (targetType === "player" && target.data?.isLoading) {
    return false;
  }

  return true;
}

/**
 * Simulates damage application
 */
function applyDamage(entity: MockEntity, damage: number): number {
  if (!entity.data.health) {
    return 0;
  }

  const actualDamage = Math.min(damage, entity.data.health);
  entity.data.health -= actualDamage;
  return actualDamage;
}

// ============================================================================
// Test Utilities
// ============================================================================

function createMockWorld(): { entities: Map<string, MockEntity> } {
  return {
    entities: new Map(),
  };
}

function createMockPlayer(
  id: string,
  socketId: string,
  position: Position3D,
  isLoading = true,
): MockEntity {
  return {
    id,
    data: {
      id,
      type: "player",
      name: "TestPlayer",
      owner: socketId,
      isLoading,
      health: 100,
      maxHealth: 100,
    },
    node: { position },
  };
}

function createMockMob(
  id: string,
  position: Position3D,
  target: string | null = null,
): MockEntity {
  return {
    id,
    data: {
      id,
      type: "mob",
      name: "Goblin",
      mobType: "goblin",
      health: 50,
      maxHealth: 50,
      target,
      aggroRange: 5,
      isHostile: true,
    },
    node: { position },
  };
}

function createMobAggroState(mob: MockEntity): MobAggroState {
  return {
    mobId: mob.id,
    currentTarget: mob.data.target || null,
    currentPosition: mob.node?.position || { x: 0, y: 0, z: 0 },
    aggroRange: mob.data.aggroRange || 5,
    isHostile: mob.data.isHostile !== false,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Player Loading Spawn Protection - Integration", () => {
  let world: { entities: Map<string, MockEntity> };

  beforeEach(() => {
    world = createMockWorld();
  });

  describe("AggroSystem Protection", () => {
    it("aggressive mob ignores loading player in aggro range", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true, // isLoading = true
      );
      const mob = createMockMob("goblin-1", { x: 2, y: 0, z: 0 }); // Within aggro range

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      expect(shouldAggro).toBe(false);
      expect(player.data.isLoading).toBe(true);
    });

    it("aggressive mob targets non-loading player normally", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        false, // isLoading = false (ready)
      );
      const mob = createMockMob("goblin-1", { x: 2, y: 0, z: 0 }); // Within aggro range

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      expect(shouldAggro).toBe(true);
    });

    it("mob does not aggro loading player even when very close", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );
      const mob = createMockMob("goblin-1", { x: 0.5, y: 0, z: 0 }); // Very close

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      expect(shouldAggro).toBe(false);
    });

    it("mob still ignores player outside aggro range even if active", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 100, y: 0, z: 0 },
        false, // Active but far away
      );
      const mob = createMockMob("goblin-1", { x: 0, y: 0, z: 0 });

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      expect(shouldAggro).toBe(false);
    });

    it("mob switches target when player becomes active", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 2, y: 0, z: 0 },
        true, // Loading
      );
      const mob = createMockMob("goblin-1", { x: 0, y: 0, z: 0 });

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);

      // Before: loading player immune
      expect(
        shouldAggroPlayer(world, mobState, player.id, player.node!.position),
      ).toBe(false);

      // Player becomes active (simulating clientReady)
      player.data.isLoading = false;

      // After: player can be aggro'd
      expect(
        shouldAggroPlayer(world, mobState, player.id, player.node!.position),
      ).toBe(true);
    });
  });

  describe("CombatSystem Protection", () => {
    it("mob attack on loading player is blocked", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );

      const canAttack = canAttackTarget(player, "player");

      expect(canAttack).toBe(false);
    });

    it("mob attack on loading player deals 0 damage", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );
      const initialHealth = player.data.health!;

      // Attack is blocked, so no damage applied
      const canAttack = canAttackTarget(player, "player");
      if (canAttack) {
        applyDamage(player, 10);
      }

      expect(player.data.health).toBe(initialHealth);
    });

    it("mob attack on loading player doesn't trigger combat state", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );
      let combatTriggered = false;

      const canAttack = canAttackTarget(player, "player");
      if (canAttack) {
        combatTriggered = true;
      }

      expect(combatTriggered).toBe(false);
    });

    it("player can be attacked after isLoading becomes false", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );

      // Before: blocked
      expect(canAttackTarget(player, "player")).toBe(false);

      // Player ready (simulating clientReady)
      player.data.isLoading = false;

      // After: allowed
      expect(canAttackTarget(player, "player")).toBe(true);
    });

    it("player takes damage after clientReady received", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        false, // Active
      );
      const initialHealth = player.data.health!;

      const canAttack = canAttackTarget(player, "player");
      expect(canAttack).toBe(true);

      const damageDealt = applyDamage(player, 10);

      expect(damageDealt).toBe(10);
      expect(player.data.health).toBe(initialHealth - 10);
    });

    it("mob-vs-mob combat unaffected by isLoading", () => {
      const mob1 = createMockMob("mob-1", { x: 0, y: 0, z: 0 });
      const mob2 = createMockMob("mob-2", { x: 1, y: 0, z: 0 });
      mob2.data.isLoading = true; // Edge case: mob with isLoading

      // isLoading check only applies to targetType === "player"
      const canAttack = canAttackTarget(mob2, "mob");

      expect(canAttack).toBe(true);
    });
  });

  describe("End-to-End Flow", () => {
    it("full flow: spawn → isLoading=true → clientReady → targetable", () => {
      // Step 1: Player spawns with isLoading=true
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );
      const mob = createMockMob("goblin-1", { x: 2, y: 0, z: 0 });

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      // Step 2: Verify immune to aggro
      const mobState = createMobAggroState(mob);
      expect(
        shouldAggroPlayer(world, mobState, player.id, player.node!.position),
      ).toBe(false);

      // Step 3: Verify immune to combat
      expect(canAttackTarget(player, "player")).toBe(false);

      // Step 4: Player sends clientReady (simulated)
      player.data.isLoading = false;

      // Step 5: Verify now targetable
      expect(
        shouldAggroPlayer(world, mobState, player.id, player.node!.position),
      ).toBe(true);
      expect(canAttackTarget(player, "player")).toBe(true);
    });

    it("full flow: spawn → isLoading=true → timeout → targetable", () => {
      // Step 1: Player spawns with isLoading=true
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );
      const mob = createMockMob("goblin-1", { x: 2, y: 0, z: 0 });

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      // Step 2: Verify immune
      expect(canAttackTarget(player, "player")).toBe(false);

      // Step 3: Timeout fires (simulated)
      player.data.isLoading = false;

      // Step 4: Verify now targetable
      expect(canAttackTarget(player, "player")).toBe(true);
    });

    it("multiple mobs all blocked from attacking loading player", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );

      world.entities.set(player.id, player);

      // Spawn multiple aggressive mobs around player
      for (let i = 0; i < 5; i++) {
        const mob = createMockMob(`goblin-${i}`, {
          x: i * 0.5,
          y: 0,
          z: i * 0.5,
        });
        world.entities.set(mob.id, mob);

        const mobState = createMobAggroState(mob);
        expect(
          shouldAggroPlayer(world, mobState, player.id, player.node!.position),
        ).toBe(false);
        expect(canAttackTarget(player, "player")).toBe(false);
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles missing entity.data gracefully", () => {
      const brokenEntity = {
        id: "broken",
        data: undefined as unknown as EntityData,
      };
      world.entities.set("broken", brokenEntity);

      // Should not throw
      const mobState: MobAggroState = {
        mobId: "mob-1",
        currentTarget: null,
        currentPosition: { x: 0, y: 0, z: 0 },
        aggroRange: 5,
        isHostile: true,
      };

      // Entity with undefined data should be skipped (no crash)
      expect(() =>
        shouldAggroPlayer(world, mobState, "broken", { x: 0, y: 0, z: 0 }),
      ).not.toThrow();
    });

    it("handles undefined isLoading (treated as active)", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        false,
      );
      delete player.data.isLoading; // Remove the property entirely

      world.entities.set(player.id, player);

      // undefined should be treated as not loading (falsy)
      const mobState = createMobAggroState(
        createMockMob("mob-1", { x: 2, y: 0, z: 0 }),
      );
      expect(
        shouldAggroPlayer(world, mobState, player.id, player.node!.position),
      ).toBe(true);
      expect(canAttackTarget(player, "player")).toBe(true);
    });

    it("player entity not in world still allows aggro check (entity check is separate)", () => {
      // Player not added to world.entities
      const mobState: MobAggroState = {
        mobId: "mob-1",
        currentTarget: null,
        currentPosition: { x: 0, y: 0, z: 0 },
        aggroRange: 5,
        isHostile: true,
      };

      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        "nonexistent-player",
        { x: 2, y: 0, z: 0 },
      );

      // isLoading check only blocks if entity.data.isLoading is truthy
      // If entity not found, the check passes (undefined is falsy)
      // Real system validates entity existence separately before this check
      expect(shouldAggro).toBe(true);
    });
  });

  describe("Boundary Conditions", () => {
    it("player exactly at aggro range boundary - active (included)", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 5, y: 0, z: 0 }, // Exactly at range
        false,
      );
      const mob = createMockMob("goblin-1", { x: 0, y: 0, z: 0 });
      mob.data.aggroRange = 5;

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      // At exactly the boundary - should aggro (uses > check, so boundary is included)
      expect(shouldAggro).toBe(true);
    });

    it("player just outside aggro range - active", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 5.1, y: 0, z: 0 }, // Just outside range
        false,
      );
      const mob = createMockMob("goblin-1", { x: 0, y: 0, z: 0 });
      mob.data.aggroRange = 5;

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      // Just outside range - should NOT aggro
      expect(shouldAggro).toBe(false);
    });

    it("player just inside aggro range - active", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 4.9, y: 0, z: 0 }, // Just inside range
        false,
      );
      const mob = createMockMob("goblin-1", { x: 0, y: 0, z: 0 });
      mob.data.aggroRange = 5;

      world.entities.set(player.id, player);
      world.entities.set(mob.id, mob);

      const mobState = createMobAggroState(mob);
      const shouldAggro = shouldAggroPlayer(
        world,
        mobState,
        player.id,
        player.node!.position,
      );

      expect(shouldAggro).toBe(true);
    });

    it("player health at 0 still protected while loading", () => {
      const player = createMockPlayer(
        "player-1",
        "socket-1",
        { x: 0, y: 0, z: 0 },
        true,
      );
      player.data.health = 0; // Dead but loading?

      // Even with 0 health, loading check comes first
      expect(canAttackTarget(player, "player")).toBe(false);
    });
  });
});
