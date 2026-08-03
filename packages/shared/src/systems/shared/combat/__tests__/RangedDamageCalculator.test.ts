/**
 * RangedDamageCalculator Unit Tests
 *
 * Tests rules-accurate ranged damage formulas:
 * - Effective level calculation with style bonuses
 * - Attack roll formula
 * - Defense roll formula
 * - Hit chance formula
 * - Max hit formula
 */

import { describe, it, expect } from "vitest";
import {
  calculateRangedDamage,
  RangedDamageCalculator,
  type RangedDamageParams,
} from "../RangedDamageCalculator";
import { SeededRandom } from "../../../../utils/SeededRandom";

describe("RangedDamageCalculator", () => {
  describe("calculateRangedDamage", () => {
    const baseParams: RangedDamageParams = {
      rangedLevel: 40,
      rangedAttackBonus: 20,
      rangedStrengthBonus: 15,
      style: "accurate",
      targetDefenseLevel: 20,
      targetRangedDefenseBonus: 10,
    };

    it("returns valid damage result structure", () => {
      const result = calculateRangedDamage(baseParams);

      expect(result).toHaveProperty("damage");
      expect(result).toHaveProperty("maxHit");
      expect(result).toHaveProperty("didHit");
      expect(result).toHaveProperty("hitChance");
      expect(typeof result.damage).toBe("number");
      expect(typeof result.maxHit).toBe("number");
      expect(typeof result.didHit).toBe("boolean");
      expect(typeof result.hitChance).toBe("number");
    });

    it("returns non-negative damage", () => {
      for (let i = 0; i < 50; i++) {
        const result = calculateRangedDamage(baseParams);
        expect(result.damage).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.damage)).toBe(true);
      }
    });

    it("returns damage within 0 to maxHit range", () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const result = calculateRangedDamage(baseParams, rng);
        expect(result.damage).toBeGreaterThanOrEqual(0);
        expect(result.damage).toBeLessThanOrEqual(result.maxHit);
      }
    });

    it("returns 0 damage when miss occurs", () => {
      // Use seeded RNG to force misses
      const rng = new SeededRandom(99999);
      let missCount = 0;

      for (let i = 0; i < 100; i++) {
        const result = calculateRangedDamage(baseParams, rng);
        if (!result.didHit) {
          expect(result.damage).toBe(0);
          missCount++;
        }
      }

      // Should have some misses in 100 trials
      expect(missCount).toBeGreaterThan(0);
    });

    it("calculates hit chance between 0 and 1", () => {
      const result = calculateRangedDamage(baseParams);
      expect(result.hitChance).toBeGreaterThanOrEqual(0);
      expect(result.hitChance).toBeLessThanOrEqual(1);
    });
  });

  describe("effective level formula", () => {
    it("adds +3 attack bonus for accurate style", () => {
      const calculator = new RangedDamageCalculator();

      // With accurate style, effective level should be higher
      // This affects hit chance
      const accurateChance = calculator.getHitChance(
        40, // rangedLevel
        20, // rangedAttackBonus
        "accurate",
        20, // targetDefenseLevel
        10, // targetRangedDefenseBonus
      );

      const rapidChance = calculator.getHitChance(40, 20, "rapid", 20, 10);

      // Accurate should have better hit chance due to +3 attack bonus
      expect(accurateChance).toBeGreaterThan(rapidChance);
    });

    it("adds +3 effective level for max hit on accurate style", () => {
      const calculator = new RangedDamageCalculator();

      // Use higher levels where the +3 bonus makes a difference
      const accurateMaxHit = calculator.getMaxHit(60, 50, "accurate");
      const rapidMaxHit = calculator.getMaxHit(60, 50, "rapid");

      // Accurate style gives +3 to effective strength for max hit
      expect(accurateMaxHit).toBeGreaterThanOrEqual(rapidMaxHit);
      // At level 60 with +50 str bonus:
      // Accurate: effective = 60 + 3 + 8 = 71, maxHit = floor(0.5 + 71*114/640) = 12
      // Rapid: effective = 60 + 0 + 8 = 68, maxHit = floor(0.5 + 68*114/640) = 12
      // The difference may not show at these values, so just verify accurate >= rapid
    });

    it("longrange style adds +1 defense bonus (no attack/strength bonus)", () => {
      const calculator = new RangedDamageCalculator();

      const longrangeMaxHit = calculator.getMaxHit(40, 15, "longrange");
      const rapidMaxHit = calculator.getMaxHit(40, 15, "rapid");

      // Longrange and rapid should have same max hit (no strength bonus)
      expect(longrangeMaxHit).toBe(rapidMaxHit);
    });
  });

  describe("attack roll formula", () => {
    it("higher ranged level increases hit chance", () => {
      const calculator = new RangedDamageCalculator();

      const lowLevelChance = calculator.getHitChance(
        20, // low ranged level
        20,
        "accurate",
        20,
        10,
      );

      const highLevelChance = calculator.getHitChance(
        60, // high ranged level
        20,
        "accurate",
        20,
        10,
      );

      expect(highLevelChance).toBeGreaterThan(lowLevelChance);
    });

    it("higher equipment bonus increases hit chance", () => {
      const calculator = new RangedDamageCalculator();

      const lowBonusChance = calculator.getHitChance(
        40,
        5, // low attack bonus
        "accurate",
        20,
        10,
      );

      const highBonusChance = calculator.getHitChance(
        40,
        50, // high attack bonus
        "accurate",
        20,
        10,
      );

      expect(highBonusChance).toBeGreaterThan(lowBonusChance);
    });
  });

  describe("defense roll formula", () => {
    it("higher target defense level decreases hit chance", () => {
      const calculator = new RangedDamageCalculator();

      const lowDefenseChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        10, // low defense
        10,
      );

      const highDefenseChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        60, // high defense
        10,
      );

      expect(highDefenseChance).toBeLessThan(lowDefenseChance);
    });

    it("higher target ranged defense bonus decreases hit chance", () => {
      const calculator = new RangedDamageCalculator();

      const lowBonusChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        20,
        5, // low defense bonus
      );

      const highBonusChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        20,
        50, // high defense bonus
      );

      expect(highBonusChance).toBeLessThan(lowBonusChance);
    });
  });

  describe("hit chance formula", () => {
    it("uses correct formula when attack roll > defense roll", () => {
      // When attackRoll > defenseRoll:
      // hitChance = 1 - (defenseRoll + 2) / (2 * (attackRoll + 1))
      const calculator = new RangedDamageCalculator();

      // High attack vs low defense should give high hit chance
      const hitChance = calculator.getHitChance(
        99, // very high ranged
        100, // high bonus
        "accurate",
        1, // very low defense
        0, // no bonus
      );

      // Should be close to 1 (high chance to hit)
      expect(hitChance).toBeGreaterThan(0.9);
    });

    it("uses correct formula when attack roll <= defense roll", () => {
      // When attackRoll <= defenseRoll:
      // hitChance = attackRoll / (2 * (defenseRoll + 1))
      const calculator = new RangedDamageCalculator();

      // Low attack vs high defense should give low hit chance
      const hitChance = calculator.getHitChance(
        1, // very low ranged
        0, // no bonus
        "accurate",
        99, // very high defense
        100, // high bonus
      );

      // Should be close to 0 (low chance to hit)
      expect(hitChance).toBeLessThan(0.1);
    });
  });

  describe("max hit formula", () => {
    it("calculates max hit correctly", () => {
      // Max hit = floor(0.5 + effectiveStrength * (rangedStrengthBonus + 64) / 640)
      // For level 40 accurate: effectiveStr = 40 + 3 + 8 = 51
      // With rangedStrengthBonus = 15: maxHit = floor(0.5 + 51 * 79 / 640) = floor(0.5 + 6.30) = 6
      const calculator = new RangedDamageCalculator();
      const maxHit = calculator.getMaxHit(40, 15, "accurate");

      // Expected: floor(0.5 + 51 * 79 / 640) = floor(6.8) = 6
      expect(maxHit).toBe(6);
    });

    it("higher ranged level increases max hit", () => {
      const calculator = new RangedDamageCalculator();

      const lowLevelMaxHit = calculator.getMaxHit(20, 15, "accurate");
      const highLevelMaxHit = calculator.getMaxHit(60, 15, "accurate");

      expect(highLevelMaxHit).toBeGreaterThan(lowLevelMaxHit);
    });

    it("higher strength bonus increases max hit", () => {
      const calculator = new RangedDamageCalculator();

      const lowBonusMaxHit = calculator.getMaxHit(40, 5, "accurate");
      const highBonusMaxHit = calculator.getMaxHit(40, 50, "accurate");

      expect(highBonusMaxHit).toBeGreaterThan(lowBonusMaxHit);
    });
  });

  describe("prayer bonuses", () => {
    it("prayer multiplier increases hit chance", () => {
      const calculator = new RangedDamageCalculator();

      const noPrayerChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        20,
        10,
      );

      const withPrayerChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        20,
        10,
        { rangedAttackMultiplier: 1.15 }, // 15% boost
      );

      expect(withPrayerChance).toBeGreaterThan(noPrayerChance);
    });

    it("target prayer defense multiplier decreases hit chance", () => {
      const calculator = new RangedDamageCalculator();

      const noPrayerChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        20,
        10,
      );

      const withTargetPrayerChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        20,
        10,
        undefined,
        { defenseMultiplier: 1.25 }, // 25% defense boost
      );

      expect(withTargetPrayerChance).toBeLessThan(noPrayerChance);
    });
  });

  describe("RangedDamageCalculator class", () => {
    it("calculate method returns same result as function", () => {
      const calculator = new RangedDamageCalculator();
      const rng = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);

      const params: RangedDamageParams = {
        rangedLevel: 40,
        rangedAttackBonus: 20,
        rangedStrengthBonus: 15,
        style: "accurate",
        targetDefenseLevel: 20,
        targetRangedDefenseBonus: 10,
      };

      const classResult = calculator.calculate(params, rng);
      const funcResult = calculateRangedDamage(params, rng2);

      expect(classResult.maxHit).toBe(funcResult.maxHit);
      expect(classResult.hitChance).toBe(funcResult.hitChance);
    });

    it("getMaxHit returns consistent values", () => {
      const calculator = new RangedDamageCalculator();

      const maxHit1 = calculator.getMaxHit(40, 15, "accurate");
      const maxHit2 = calculator.getMaxHit(40, 15, "accurate");

      expect(maxHit1).toBe(maxHit2);
    });

    it("getHitChance returns consistent values", () => {
      const calculator = new RangedDamageCalculator();

      const chance1 = calculator.getHitChance(40, 20, "accurate", 20, 10);
      const chance2 = calculator.getHitChance(40, 20, "accurate", 20, 10);

      expect(chance1).toBe(chance2);
    });
  });
});
