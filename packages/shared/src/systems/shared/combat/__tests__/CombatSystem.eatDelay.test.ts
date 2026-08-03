/**
 * CombatSystem Eat Delay Integration Tests
 *
 * Tests for rules-accurate attack delay when eating during combat:
 * - isPlayerOnAttackCooldown() detection
 * - addAttackDelay() application
 * - Correct integration with nextAttackTicks and CombatData
 */

import { describe, it, expect, beforeEach } from "vitest";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";

// Type for mocked nextAttackTicks map
type EntityID = string & { __brand: "EntityID" };

function createEntityID(id: string): EntityID {
  return id as EntityID;
}

/**
 * CombatSystemEatDelayTester - Extracted eat delay logic for isolated testing
 * Mimics CombatSystem's isPlayerOnAttackCooldown and addAttackDelay methods
 */
class CombatSystemEatDelayTester {
  public nextAttackTicks = new Map<EntityID, number>();
  public combatData = new Map<EntityID, { nextAttackTick: number }>();

  /**
   * Check if player is on attack cooldown
   * Used by eating system to determine if eat should add attack delay
   */
  isPlayerOnAttackCooldown(playerId: string, currentTick: number): boolean {
    const typedPlayerId = createEntityID(playerId);
    const nextAllowedTick = this.nextAttackTicks.get(typedPlayerId) ?? 0;
    return currentTick < nextAllowedTick;
  }

  /**
   * Add delay ticks to player's next attack
   * Used by eating system (classic MMORPG: eating during combat adds 3 tick delay)
   */
  addAttackDelay(playerId: string, delayTicks: number): void {
    const typedPlayerId = createEntityID(playerId);
    const currentNext = this.nextAttackTicks.get(typedPlayerId);

    if (currentNext !== undefined) {
      // Add delay to existing cooldown
      this.nextAttackTicks.set(typedPlayerId, currentNext + delayTicks);

      // Also update CombatData if active
      const combatData = this.combatData.get(typedPlayerId);
      if (combatData) {
        combatData.nextAttackTick += delayTicks;
      }
    }
    // If no current cooldown, do nothing (rules-accurate: no delay if weapon ready)
  }

  // Helper: Set attack cooldown for testing
  setNextAttackTick(playerId: string, tick: number): void {
    const typedPlayerId = createEntityID(playerId);
    this.nextAttackTicks.set(typedPlayerId, tick);
  }

  // Helper: Set combat data for testing
  setCombatData(playerId: string, data: { nextAttackTick: number }): void {
    const typedPlayerId = createEntityID(playerId);
    this.combatData.set(typedPlayerId, data);
  }
}

describe("CombatSystem - Eat Delay Integration", () => {
  let combatSystem: CombatSystemEatDelayTester;

  beforeEach(() => {
    combatSystem = new CombatSystemEatDelayTester();
  });

  describe("isPlayerOnAttackCooldown", () => {
    it("returns false when no cooldown set", () => {
      // Player has never attacked, no entry in nextAttackTicks
      const result = combatSystem.isPlayerOnAttackCooldown("player-1", 100);
      expect(result).toBe(false);
    });

    it("returns true when on cooldown", () => {
      // Player attacked and next attack is at tick 110
      combatSystem.setNextAttackTick("player-1", 110);

      // Current tick is 105 - still on cooldown
      expect(combatSystem.isPlayerOnAttackCooldown("player-1", 105)).toBe(true);
      expect(combatSystem.isPlayerOnAttackCooldown("player-1", 109)).toBe(true);
    });

    it("returns false when cooldown expired", () => {
      combatSystem.setNextAttackTick("player-1", 110);

      // Current tick is 110 or later - cooldown expired
      expect(combatSystem.isPlayerOnAttackCooldown("player-1", 110)).toBe(
        false,
      );
      expect(combatSystem.isPlayerOnAttackCooldown("player-1", 111)).toBe(
        false,
      );
    });

    it("returns false exactly at boundary tick (can attack)", () => {
      combatSystem.setNextAttackTick("player-1", 110);

      // At tick 110: currentTick < nextAllowedTick = 110 < 110 = false
      // Player CAN attack at tick 110
      expect(combatSystem.isPlayerOnAttackCooldown("player-1", 110)).toBe(
        false,
      );
    });
  });

  describe("addAttackDelay", () => {
    it("adds delay to existing cooldown", () => {
      // Player's next attack is at tick 110
      combatSystem.setNextAttackTick("player-1", 110);

      // Add 3-tick eat delay
      combatSystem.addAttackDelay(
        "player-1",
        COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
      );

      // Next attack should now be at tick 113
      const typedId = createEntityID("player-1");
      expect(combatSystem.nextAttackTicks.get(typedId)).toBe(113);
    });

    it("does nothing when no existing cooldown (rules-accurate)", () => {
      // Player has no cooldown entry - weapon is ready
      combatSystem.addAttackDelay(
        "player-1",
        COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
      );

      // No cooldown should be created
      const typedId = createEntityID("player-1");
      expect(combatSystem.nextAttackTicks.has(typedId)).toBe(false);
    });

    it("updates CombatData.nextAttackTick if active", () => {
      combatSystem.setNextAttackTick("player-1", 110);
      combatSystem.setCombatData("player-1", { nextAttackTick: 110 });

      combatSystem.addAttackDelay(
        "player-1",
        COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
      );

      // Both should be updated
      const typedId = createEntityID("player-1");
      expect(combatSystem.nextAttackTicks.get(typedId)).toBe(113);
      expect(combatSystem.combatData.get(typedId)?.nextAttackTick).toBe(113);
    });

    it("works without CombatData (player attacking but no active combat)", () => {
      combatSystem.setNextAttackTick("player-1", 110);
      // No combatData set

      // Should not throw
      expect(() =>
        combatSystem.addAttackDelay(
          "player-1",
          COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
        ),
      ).not.toThrow();

      const typedId = createEntityID("player-1");
      expect(combatSystem.nextAttackTicks.get(typedId)).toBe(113);
    });
  });

  describe("classic MMORPG attack delay constants", () => {
    it("uses exactly 3 ticks for eat attack delay", () => {
      expect(COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS).toBe(3);
    });
  });

  describe("integration scenario: eating mid-combat", () => {
    it("delays next attack when eating while on cooldown", () => {
      const _currentTick = 100;

      // Player attacked at tick 96, weapon speed is 4 ticks
      // Next attack at tick 100
      combatSystem.setNextAttackTick("player-1", 100);
      combatSystem.setCombatData("player-1", { nextAttackTick: 100 });

      // Player eats at tick 98 while on cooldown
      const isOnCooldown = combatSystem.isPlayerOnAttackCooldown(
        "player-1",
        98,
      );
      expect(isOnCooldown).toBe(true);

      // Apply eat delay
      combatSystem.addAttackDelay(
        "player-1",
        COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
      );

      // Next attack now at tick 103 instead of 100
      const typedId = createEntityID("player-1");
      expect(combatSystem.nextAttackTicks.get(typedId)).toBe(103);
    });

    it("does NOT delay attack when eating with weapon ready", () => {
      // Player's weapon is ready (no cooldown or cooldown expired)
      combatSystem.setNextAttackTick("player-1", 95);

      const currentTick = 100;
      const isOnCooldown = combatSystem.isPlayerOnAttackCooldown(
        "player-1",
        currentTick,
      );
      expect(isOnCooldown).toBe(false);

      // Player eats at tick 100 - should NOT add delay
      // (In real code, applyEatAttackDelay only calls addAttackDelay if on cooldown)
      if (isOnCooldown) {
        combatSystem.addAttackDelay(
          "player-1",
          COMBAT_CONSTANTS.EAT_ATTACK_DELAY_TICKS,
        );
      }

      // Next attack still at 95 (unchanged)
      const typedId = createEntityID("player-1");
      expect(combatSystem.nextAttackTicks.get(typedId)).toBe(95);
    });
  });
});
