/**
 * Combat Level Calculator Tests
 *
 * Verifies rules-accurate combat level calculation:
 * - Level 3 minimum (fresh character)
 * - Level 126 maximum (all 99s)
 * - Correct formula application
 * - Combat type detection
 * - Double-level aggro rule
 *
 */

import { describe, it, expect } from "vitest";
import {
  calculateCombatLevel,
  getPrimaryCombatType,
  normalizeCombatSkills,
  shouldMobIgnorePlayer,
  MIN_COMBAT_LEVEL,
  MAX_COMBAT_LEVEL,
  type CombatSkills,
} from "../CombatLevelCalculator";

describe("CombatLevelCalculator", () => {
  describe("calculateCombatLevel", () => {
    it("returns level 3 for fresh character (all 1s, 10 HP)", () => {
      const skills: CombatSkills = {
        attack: 1,
        strength: 1,
        defense: 1,
        hitpoints: 10,
        ranged: 1,
        magic: 1,
        prayer: 1,
      };

      const level = calculateCombatLevel(skills);
      expect(level).toBe(3);
    });

    it("returns level 126 for maxed character (all 99s)", () => {
      const skills: CombatSkills = {
        attack: 99,
        strength: 99,
        defense: 99,
        hitpoints: 99,
        ranged: 99,
        magic: 99,
        prayer: 99,
      };

      const level = calculateCombatLevel(skills);
      expect(level).toBe(126);
    });

    it("calculates melee pure correctly", () => {
      // 99 Attack, 99 Strength, 1 Defence, 99 Hitpoints, 1 Prayer
      // Base = 0.25 * (1 + 99 + 0) = 25
      // Melee = 0.325 * (99 + 99) = 64.35
      // Combat = floor(25 + 64.35) = 89
      const skills: CombatSkills = {
        attack: 99,
        strength: 99,
        defense: 1,
        hitpoints: 99,
        ranged: 1,
        magic: 1,
        prayer: 1,
      };

      const level = calculateCombatLevel(skills);
      expect(level).toBe(89);
    });

    it("calculates ranged pure correctly", () => {
      // 1 Attack, 1 Strength, 1 Defence, 99 Hitpoints, 99 Ranged, 1 Prayer
      // Base = 0.25 * (1 + 99 + 0) = 25
      // Ranged = 0.325 * floor(99 * 1.5) = 0.325 * 148 = 48.1
      // Combat = floor(25 + 48.1) = 73
      const skills: CombatSkills = {
        attack: 1,
        strength: 1,
        defense: 1,
        hitpoints: 99,
        ranged: 99,
        magic: 1,
        prayer: 1,
      };

      const level = calculateCombatLevel(skills);
      expect(level).toBe(73);
    });

    it("calculates magic pure correctly", () => {
      // 1 Attack, 1 Strength, 1 Defence, 99 Hitpoints, 99 Magic, 1 Prayer
      // Same formula as ranged
      // Combat = 73
      const skills: CombatSkills = {
        attack: 1,
        strength: 1,
        defense: 1,
        hitpoints: 99,
        ranged: 1,
        magic: 99,
        prayer: 1,
      };

      const level = calculateCombatLevel(skills);
      expect(level).toBe(73);
    });

    it("prayer contributes correctly (half value)", () => {
      const withoutPrayer: CombatSkills = {
        attack: 40,
        strength: 40,
        defense: 40,
        hitpoints: 40,
        ranged: 1,
        magic: 1,
        prayer: 1, // floor(1/2) = 0
      };

      const withPrayer: CombatSkills = {
        attack: 40,
        strength: 40,
        defense: 40,
        hitpoints: 40,
        ranged: 1,
        magic: 1,
        prayer: 50, // floor(50/2) = 25
      };

      const levelWithout = calculateCombatLevel(withoutPrayer);
      const levelWith = calculateCombatLevel(withPrayer);

      // Prayer 50 adds 0.25 * 25 = 6.25 to base
      // This should increase combat level by ~6
      expect(levelWith - levelWithout).toBeGreaterThanOrEqual(5);
      expect(levelWith - levelWithout).toBeLessThanOrEqual(7);
    });

    it("never exceeds MAX_COMBAT_LEVEL", () => {
      // Even with impossibly high stats
      const impossibleStats: CombatSkills = {
        attack: 999,
        strength: 999,
        defense: 999,
        hitpoints: 999,
        ranged: 999,
        magic: 999,
        prayer: 999,
      };

      const level = calculateCombatLevel(impossibleStats);
      expect(level).toBe(MAX_COMBAT_LEVEL);
    });

    it("never goes below MIN_COMBAT_LEVEL", () => {
      const zeroStats: CombatSkills = {
        attack: 0,
        strength: 0,
        defense: 0,
        hitpoints: 0,
        ranged: 0,
        magic: 0,
        prayer: 0,
      };

      const level = calculateCombatLevel(zeroStats);
      expect(level).toBe(MIN_COMBAT_LEVEL);
    });

    it("highest combat type wins", () => {
      // Melee focused
      const melee: CombatSkills = {
        attack: 99,
        strength: 99,
        defense: 40,
        hitpoints: 50,
        ranged: 40,
        magic: 40,
        prayer: 1,
      };

      // Ranged focused (same defense/hp/prayer)
      const ranged: CombatSkills = {
        attack: 40,
        strength: 40,
        defense: 40,
        hitpoints: 50,
        ranged: 99,
        magic: 40,
        prayer: 1,
      };

      const meleeLevel = calculateCombatLevel(melee);
      const rangedLevel = calculateCombatLevel(ranged);

      // Melee (99+99)*0.325 = 64.35 vs Ranged floor(99*1.5)*0.325 = 48.1
      // Melee should be higher
      expect(meleeLevel).toBeGreaterThan(rangedLevel);
    });
  });

  describe("getPrimaryCombatType", () => {
    it("returns melee for high attack/strength", () => {
      const skills: CombatSkills = {
        attack: 99,
        strength: 99,
        defense: 40,
        hitpoints: 50,
        ranged: 40,
        magic: 40,
        prayer: 1,
      };

      expect(getPrimaryCombatType(skills)).toBe("melee");
    });

    it("returns ranged for high ranged level", () => {
      const skills: CombatSkills = {
        attack: 40,
        strength: 40,
        defense: 40,
        hitpoints: 50,
        ranged: 99,
        magic: 40,
        prayer: 1,
      };

      expect(getPrimaryCombatType(skills)).toBe("ranged");
    });

    it("returns magic for high magic level", () => {
      const skills: CombatSkills = {
        attack: 40,
        strength: 40,
        defense: 40,
        hitpoints: 50,
        ranged: 40,
        magic: 99,
        prayer: 1,
      };

      expect(getPrimaryCombatType(skills)).toBe("magic");
    });

    it("returns melee when tied (melee prioritized)", () => {
      // When melee, ranged, magic all equal, melee wins
      const skills: CombatSkills = {
        attack: 50,
        strength: 50,
        defense: 40,
        hitpoints: 50,
        ranged: 66, // floor(66 * 1.5) = 99, 0.325 * 99 = 32.175
        magic: 66, // Same as ranged
        prayer: 1,
      };
      // Melee = 0.325 * (50 + 50) = 32.5

      // All roughly equal, but melee should be returned (prioritized)
      expect(getPrimaryCombatType(skills)).toBe("melee");
    });
  });

  describe("normalizeCombatSkills", () => {
    it("fills in missing values with defaults", () => {
      const partial = {
        attack: 50,
        strength: 50,
      };

      const normalized = normalizeCombatSkills(partial);

      expect(normalized.attack).toBe(50);
      expect(normalized.strength).toBe(50);
      expect(normalized.defense).toBe(1);
      expect(normalized.hitpoints).toBe(10);
      expect(normalized.ranged).toBe(1);
      expect(normalized.magic).toBe(1);
      expect(normalized.prayer).toBe(1);
    });

    it("handles constitution as alias for hitpoints", () => {
      const withConstitution = {
        attack: 40,
        constitution: 70, // Should map to hitpoints
      };

      const normalized = normalizeCombatSkills(withConstitution);

      expect(normalized.hitpoints).toBe(70);
    });

    it("prefers hitpoints over constitution", () => {
      const bothProvided = {
        hitpoints: 80,
        constitution: 70,
      };

      const normalized = normalizeCombatSkills(bothProvided);

      expect(normalized.hitpoints).toBe(80);
    });

    it("returns complete CombatSkills from empty object", () => {
      const normalized = normalizeCombatSkills({});

      expect(normalized).toEqual({
        attack: 1,
        strength: 1,
        defense: 1,
        hitpoints: 10,
        ranged: 1,
        magic: 1,
        prayer: 1,
      });
    });
  });

  describe("shouldMobIgnorePlayer (double-level aggro rule)", () => {
    it("mob ignores player when player level > mob level * 2", () => {
      // Level 2 goblin ignores level 5+ players (5 > 2*2 = 4)
      expect(shouldMobIgnorePlayer(5, 2)).toBe(true);
      expect(shouldMobIgnorePlayer(6, 2)).toBe(true);
      expect(shouldMobIgnorePlayer(10, 2)).toBe(true);
    });

    it("mob attacks player when player level <= mob level * 2", () => {
      // Level 2 goblin attacks level 4 or lower players
      expect(shouldMobIgnorePlayer(4, 2)).toBe(false);
      expect(shouldMobIgnorePlayer(3, 2)).toBe(false);
      expect(shouldMobIgnorePlayer(2, 2)).toBe(false);
    });

    it("toleranceImmune mobs never ignore", () => {
      // Bosses always attack regardless of player level
      expect(shouldMobIgnorePlayer(126, 10, true)).toBe(false);
      expect(shouldMobIgnorePlayer(126, 1, true)).toBe(false);
    });

    it("higher level mobs have higher ignore threshold", () => {
      // Level 10 guard ignores level 21+ players
      expect(shouldMobIgnorePlayer(21, 10)).toBe(true);
      expect(shouldMobIgnorePlayer(20, 10)).toBe(false);

      // Level 50 demon ignores level 101+ players
      expect(shouldMobIgnorePlayer(101, 50)).toBe(true);
      expect(shouldMobIgnorePlayer(100, 50)).toBe(false);
    });

    it("edge case: level 1 mob ignores level 3+ players", () => {
      // Level 1 mob ignores anyone above level 2
      expect(shouldMobIgnorePlayer(3, 1)).toBe(true);
      expect(shouldMobIgnorePlayer(2, 1)).toBe(false);
      expect(shouldMobIgnorePlayer(1, 1)).toBe(false);
    });
  });

  describe("reference-rules verification examples", () => {
    // These test cases verify the configured combat-level formula

    it("tutorial island character (level 3)", () => {
      // Fresh out of tutorial island: all 1s except HP = 10
      const skills: CombatSkills = {
        attack: 1,
        strength: 1,
        defense: 1,
        hitpoints: 10,
        ranged: 1,
        magic: 1,
        prayer: 1,
      };

      expect(calculateCombatLevel(skills)).toBe(3);
    });

    it("balanced mid-level player", () => {
      // 50 in all combat stats
      const skills: CombatSkills = {
        attack: 50,
        strength: 50,
        defense: 50,
        hitpoints: 50,
        ranged: 50,
        magic: 50,
        prayer: 50,
      };

      // Base = 0.25 * (50 + 50 + 25) = 31.25
      // Melee = 0.325 * 100 = 32.5
      // Ranged = 0.325 * 75 = 24.375
      // Magic = 0.325 * 75 = 24.375
      // Level = floor(31.25 + 32.5) = 63
      expect(calculateCombatLevel(skills)).toBe(63);
    });

    it("obby mauler build (1 attack, high strength)", () => {
      // Classic obby mauler: 1 attack, high strength, 1 def
      const skills: CombatSkills = {
        attack: 1,
        strength: 99,
        defense: 1,
        hitpoints: 99,
        ranged: 1,
        magic: 1,
        prayer: 1,
      };

      // Base = 0.25 * (1 + 99 + 0) = 25
      // Melee = 0.325 * (1 + 99) = 32.5
      // Level = floor(25 + 32.5) = 57
      expect(calculateCombatLevel(skills)).toBe(57);
    });
  });
});
