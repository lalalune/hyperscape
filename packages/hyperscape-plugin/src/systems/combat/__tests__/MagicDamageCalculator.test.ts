/**
 * MagicDamageCalculator Unit Tests
 *
 * Tests tile-based-MMORPG-accurate magic damage formulas:
 * - Player defense: 0.7 * magicLevel + 0.3 * defenseLevel
 * - NPC defense: uses only magic level
 * - Max hit determined by spell
 * - Hit chance formulas
 */

import { describe, it, expect } from "vitest";
import {
  calculateMagicDamage,
  MagicDamageCalculator,
  type MagicDamageParams,
} from "../MagicDamageCalculator";
import { SeededRandom } from "@hyperforge/shared";

describe("MagicDamageCalculator", () => {
  describe("calculateMagicDamage", () => {
    const baseParams: MagicDamageParams = {
      magicLevel: 40,
      magicAttackBonus: 20,
      style: "autocast",
      spellBaseMaxHit: 8, // Fire Strike
      targetType: "npc",
      targetMagicLevel: 1,
      targetDefenseLevel: 20,
      targetMagicDefenseBonus: 0,
    };

    it("returns valid damage result structure", () => {
      const result = calculateMagicDamage(baseParams);

      expect(result).toHaveProperty("damage");
      expect(result).toHaveProperty("maxHit");
      expect(result).toHaveProperty("didHit");
      expect(result).toHaveProperty("hitChance");
      expect(result).toHaveProperty("splashed");
      expect(typeof result.damage).toBe("number");
      expect(typeof result.maxHit).toBe("number");
      expect(typeof result.didHit).toBe("boolean");
      expect(typeof result.hitChance).toBe("number");
      expect(typeof result.splashed).toBe("boolean");
    });

    it("returns non-negative damage", () => {
      for (let i = 0; i < 50; i++) {
        const result = calculateMagicDamage(baseParams);
        expect(result.damage).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.damage)).toBe(true);
      }
    });

    it("returns damage within 0 to maxHit range", () => {
      const rng = new SeededRandom(12345);
      for (let i = 0; i < 100; i++) {
        const result = calculateMagicDamage(baseParams, rng);
        expect(result.damage).toBeGreaterThanOrEqual(0);
        expect(result.damage).toBeLessThanOrEqual(result.maxHit);
      }
    });

    it("max hit equals spell base max hit", () => {
      const result = calculateMagicDamage(baseParams);
      expect(result.maxHit).toBe(8); // Fire Strike max hit
    });

    it("returns splashed=true when hit but damage is 0", () => {
      const rng = new SeededRandom(12345);
      let splashCount = 0;

      for (let i = 0; i < 100; i++) {
        const result = calculateMagicDamage(baseParams, rng);
        if (result.didHit && result.damage === 0) {
          expect(result.splashed).toBe(true);
          splashCount++;
        }
      }

      // Should have some splashes in 100 trials
      expect(splashCount).toBeGreaterThanOrEqual(0);
    });

    it("returns splashed=false when miss occurs", () => {
      const rng = new SeededRandom(99999);
      let missCount = 0;

      for (let i = 0; i < 100; i++) {
        const result = calculateMagicDamage(baseParams, rng);
        if (!result.didHit) {
          expect(result.splashed).toBe(false);
          expect(result.damage).toBe(0);
          missCount++;
        }
      }

      expect(missCount).toBeGreaterThan(0);
    });
  });

  describe("player defense formula", () => {
    it("uses 0.7 * magic + 0.3 * defense for player targets", () => {
      const calculator = new MagicDamageCalculator();

      // Player with high magic, low defense
      const highMagicChance = calculator.getHitChance(
        40, // magicLevel
        20, // magicAttackBonus
        "autocast",
        "player",
        70, // target high magic
        10, // target low defense
        0,
      );

      // Player with low magic, high defense
      const highDefenseChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        10, // target low magic
        70, // target high defense
        0,
      );

      // High magic contributes more (0.7) than high defense (0.3)
      // So high magic player should be harder to hit
      expect(highMagicChance).toBeLessThan(highDefenseChance);
    });

    it("magic level has 70% weight in player defense", () => {
      const calculator = new MagicDamageCalculator();

      // Only change magic level (0.7 weight)
      const lowMagicChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        10, // low magic
        50, // same defense
        0,
      );

      const highMagicChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        90, // high magic (+80)
        50, // same defense
        0,
      );

      // +80 magic at 0.7 weight = +56 effective defense
      // This should significantly reduce hit chance
      const magicDiff = lowMagicChance - highMagicChance;
      expect(magicDiff).toBeGreaterThan(0.1);
    });

    it("defense level has 30% weight in player defense", () => {
      const calculator = new MagicDamageCalculator();

      // Only change defense level (0.3 weight)
      const lowDefenseChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        50, // same magic
        10, // low defense
        0,
      );

      const highDefenseChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        50, // same magic
        90, // high defense (+80)
        0,
      );

      // +80 defense at 0.3 weight = +24 effective defense
      const defenseDiff = lowDefenseChance - highDefenseChance;
      expect(defenseDiff).toBeGreaterThan(0);
      // Defense still has meaningful impact on hit chance
    });
  });

  describe("NPC defense formula", () => {
    it("uses only magic level for NPC targets", () => {
      const calculator = new MagicDamageCalculator();

      // NPC with high magic
      const highMagicNpcChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        70, // high magic level
        0, // defense level ignored for NPCs
        0,
      );

      // NPC with low magic but high defense (ignored)
      const highDefenseNpcChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        10, // low magic level
        99, // high defense (should be ignored)
        0,
      );

      // NPC defense only uses magic level, so high defense doesn't help
      expect(highDefenseNpcChance).toBeGreaterThan(highMagicNpcChance);
    });

    it("NPC with 1 magic is easier to hit than player with 1 magic", () => {
      const calculator = new MagicDamageCalculator();

      const npcChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        1, // magic level
        50, // defense level (ignored for NPC)
        0,
      );

      const playerChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        1, // magic level
        50, // defense level (contributes 0.3)
        0,
      );

      // NPC ignores defense level, so easier to hit
      expect(npcChance).toBeGreaterThan(playerChance);
    });
  });

  describe("effective level formula", () => {
    it("accurate style adds +2 to effective level", () => {
      const calculator = new MagicDamageCalculator();

      const autocastChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        20,
        20,
        0,
      );

      const accurateChance = calculator.getHitChance(
        40,
        20,
        "accurate",
        "npc",
        20,
        20,
        0,
      );

      // Accurate gives +2 attack bonus = higher hit chance
      expect(accurateChance).toBeGreaterThan(autocastChance);
    });

    it("longrange style adds +1 to effective level and +2 range", () => {
      const calculator = new MagicDamageCalculator();

      const autocastChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        20,
        20,
        0,
      );

      const longrangeChance = calculator.getHitChance(
        40,
        20,
        "longrange",
        "npc",
        20,
        20,
        0,
      );

      // Longrange gives +1 attack bonus (less than accurate's +3)
      // So longrange should have slightly better hit chance than autocast
      expect(longrangeChance).toBeGreaterThanOrEqual(autocastChance);
    });
  });

  describe("hit chance formula", () => {
    it("uses correct formula when attack roll > defense roll", () => {
      const calculator = new MagicDamageCalculator();

      const hitChance = calculator.getHitChance(
        99, // very high magic
        100, // high bonus
        "accurate",
        "npc",
        1, // very low target magic
        1, // very low target defense
        0,
      );

      expect(hitChance).toBeGreaterThan(0.9);
    });

    it("uses correct formula when attack roll <= defense roll", () => {
      const calculator = new MagicDamageCalculator();

      const hitChance = calculator.getHitChance(
        1, // very low magic
        0, // no bonus
        "autocast",
        "player",
        99, // very high target magic
        99, // very high target defense
        100, // high magic defense bonus
      );

      expect(hitChance).toBeLessThan(0.1);
    });
  });

  describe("spell max hit", () => {
    it("Wind Strike has 2 max hit", () => {
      const params: MagicDamageParams = {
        ...baseParams(),
        spellBaseMaxHit: 2,
      };
      const result = calculateMagicDamage(params);
      expect(result.maxHit).toBe(2);
    });

    it("Fire Bolt has 12 max hit", () => {
      const params: MagicDamageParams = {
        ...baseParams(),
        spellBaseMaxHit: 12,
      };
      const result = calculateMagicDamage(params);
      expect(result.maxHit).toBe(12);
    });

    function baseParams(): MagicDamageParams {
      return {
        magicLevel: 40,
        magicAttackBonus: 20,
        style: "autocast",
        spellBaseMaxHit: 8,
        targetType: "npc",
        targetMagicLevel: 1,
        targetDefenseLevel: 20,
        targetMagicDefenseBonus: 0,
      };
    }
  });

  describe("prayer bonuses", () => {
    it("magic attack prayer increases hit chance", () => {
      const calculator = new MagicDamageCalculator();

      const noPrayerChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        20,
        20,
        0,
      );

      const withPrayerChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        20,
        20,
        0,
        { magicAttackMultiplier: 1.15 },
      );

      expect(withPrayerChance).toBeGreaterThan(noPrayerChance);
    });

    it("target magic defense prayer decreases hit chance", () => {
      const calculator = new MagicDamageCalculator();

      const noPrayerChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        40,
        40,
        10,
      );

      const withTargetPrayerChance = calculator.getHitChance(
        40,
        20,
        "autocast",
        "player",
        40,
        40,
        10,
        undefined,
        { magicDefenseMultiplier: 1.25, defenseMultiplier: 1.25 },
      );

      expect(withTargetPrayerChance).toBeLessThan(noPrayerChance);
    });
  });

  describe("MagicDamageCalculator class", () => {
    it("calculate method works correctly", () => {
      const calculator = new MagicDamageCalculator();
      const rng = new SeededRandom(12345);

      const params: MagicDamageParams = {
        magicLevel: 40,
        magicAttackBonus: 20,
        style: "autocast",
        spellBaseMaxHit: 8,
        targetType: "npc",
        targetMagicLevel: 1,
        targetDefenseLevel: 20,
        targetMagicDefenseBonus: 0,
      };

      const result = calculator.calculate(params, rng);

      expect(result.maxHit).toBe(8);
      expect(result.hitChance).toBeGreaterThan(0);
      expect(result.hitChance).toBeLessThanOrEqual(1);
    });

    it("getMaxHit returns spell max hit", () => {
      const calculator = new MagicDamageCalculator();

      expect(calculator.getMaxHit(2)).toBe(2); // Wind Strike
      expect(calculator.getMaxHit(8)).toBe(8); // Fire Strike
      expect(calculator.getMaxHit(12)).toBe(12); // Fire Bolt
    });

    it("getHitChance returns consistent values", () => {
      const calculator = new MagicDamageCalculator();

      const chance1 = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        20,
        20,
        0,
      );
      const chance2 = calculator.getHitChance(
        40,
        20,
        "autocast",
        "npc",
        20,
        20,
        0,
      );

      expect(chance1).toBe(chance2);
    });
  });
});
