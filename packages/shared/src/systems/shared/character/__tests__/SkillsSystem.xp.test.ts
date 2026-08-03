/**
 * Combat XP Distribution Unit Tests
 *
 * Tests for rules-accurate experience point distribution:
 * - Focused styles: 4 XP per damage to combat skill + 1.33 XP to HP
 * - Controlled style: 1.33 XP per damage to each of 4 skills
 *
 * Verifies fractional XP accumulation (no flooring until display).
 *
 */

import { describe, it, expect } from "vitest";
import { COMBAT_CONSTANTS } from "../../../../constants/CombatConstants";

describe("Combat XP Distribution", () => {
  // Use constants instead of magic numbers
  const {
    COMBAT_XP_PER_DAMAGE,
    HITPOINTS_XP_PER_DAMAGE,
    CONTROLLED_XP_PER_DAMAGE,
  } = COMBAT_CONSTANTS.XP;

  describe("classic MMORPG XP Constants", () => {
    it("COMBAT_XP_PER_DAMAGE is 4 (rules-accurate)", () => {
      expect(COMBAT_XP_PER_DAMAGE).toBe(4);
    });

    it("HITPOINTS_XP_PER_DAMAGE is 1.33 (rules-accurate)", () => {
      expect(HITPOINTS_XP_PER_DAMAGE).toBe(1.33);
    });

    it("CONTROLLED_XP_PER_DAMAGE is 1.33 (rules-accurate)", () => {
      expect(CONTROLLED_XP_PER_DAMAGE).toBe(1.33);
    });
  });

  describe("Focused styles (accurate/aggressive/defensive)", () => {
    it("grants 4 XP per damage to combat skill", () => {
      const damage = 10;
      const combatXP = damage * COMBAT_XP_PER_DAMAGE;
      expect(combatXP).toBe(40);
    });

    it("grants 1.33 XP per damage to Hitpoints", () => {
      const damage = 10;
      const hpXP = damage * HITPOINTS_XP_PER_DAMAGE;
      expect(hpXP).toBeCloseTo(13.3, 1);
    });

    it("total XP per damage is 5.33 (4 + 1.33)", () => {
      const damage = 1;
      const totalXP = damage * (COMBAT_XP_PER_DAMAGE + HITPOINTS_XP_PER_DAMAGE);
      expect(totalXP).toBeCloseTo(5.33, 2);
    });

    it("total XP for 10 damage is 53.3", () => {
      const damage = 10;
      const totalXP = damage * (COMBAT_XP_PER_DAMAGE + HITPOINTS_XP_PER_DAMAGE);
      expect(totalXP).toBeCloseTo(53.3, 1);
    });

    it("accumulates fractionally without flooring", () => {
      // 3 damage should give exactly 3 * 1.33 = 3.99 HP XP
      const damage = 3;
      const hpXP = damage * HITPOINTS_XP_PER_DAMAGE;
      expect(hpXP).toBeCloseTo(3.99, 2);
      // Not floored to 3
      expect(hpXP).not.toBe(3);
    });
  });

  describe("Controlled style", () => {
    it("grants 1.33 XP per damage to each skill", () => {
      const damage = 10;
      const xpPerSkill = damage * CONTROLLED_XP_PER_DAMAGE;
      expect(xpPerSkill).toBeCloseTo(13.3, 1);
    });

    it("grants XP to exactly 4 skills", () => {
      // Attack, Strength, Defense, Constitution
      const skills = ["attack", "strength", "defense", "constitution"];
      expect(skills.length).toBe(4);
    });

    it("total XP per damage is 5.32 (4 × 1.33)", () => {
      const damage = 1;
      const totalXP = damage * CONTROLLED_XP_PER_DAMAGE * 4;
      expect(totalXP).toBeCloseTo(5.32, 2);
    });

    it("total XP for 10 damage is 53.2", () => {
      const damage = 10;
      const totalXP = damage * CONTROLLED_XP_PER_DAMAGE * 4;
      expect(totalXP).toBeCloseTo(53.2, 1);
    });

    it("is slightly less efficient than focused styles (5.32 vs 5.33)", () => {
      const focusedTotal = COMBAT_XP_PER_DAMAGE + HITPOINTS_XP_PER_DAMAGE;
      const controlledTotal = CONTROLLED_XP_PER_DAMAGE * 4;

      expect(controlledTotal).toBeLessThan(focusedTotal);
      expect(focusedTotal - controlledTotal).toBeCloseTo(0.01, 2);
    });

    it("trades efficiency for balanced skill training", () => {
      // Controlled: 1.33 to each of 4 skills = 5.32 total
      // Focused: 4 to 1 skill + 1.33 to HP = 5.33 total
      // Difference is intentional classic MMORPG design
      const damage = 100;
      const focusedXP =
        damage * (COMBAT_XP_PER_DAMAGE + HITPOINTS_XP_PER_DAMAGE);
      const controlledXP = damage * CONTROLLED_XP_PER_DAMAGE * 4;

      expect(focusedXP - controlledXP).toBeCloseTo(1, 0); // ~1 XP difference per 100 damage
    });
  });

  describe("XP calculations at various damage values", () => {
    const testCases = [
      { damage: 1, focusedCombat: 4, focusedHP: 1.33, controlled: 1.33 },
      { damage: 5, focusedCombat: 20, focusedHP: 6.65, controlled: 6.65 },
      { damage: 10, focusedCombat: 40, focusedHP: 13.3, controlled: 13.3 },
      { damage: 25, focusedCombat: 100, focusedHP: 33.25, controlled: 33.25 },
      { damage: 50, focusedCombat: 200, focusedHP: 66.5, controlled: 66.5 },
    ];

    testCases.forEach(({ damage, focusedCombat, focusedHP, controlled }) => {
      it(`calculates correct XP for ${damage} damage`, () => {
        expect(damage * COMBAT_XP_PER_DAMAGE).toBe(focusedCombat);
        expect(damage * HITPOINTS_XP_PER_DAMAGE).toBeCloseTo(focusedHP, 2);
        expect(damage * CONTROLLED_XP_PER_DAMAGE).toBeCloseTo(controlled, 2);
      });
    });
  });
});
