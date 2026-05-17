/**
 * SpellService Unit Tests
 *
 * Tests spell data and validation:
 * - Get spell data
 * - Validate magic level requirements
 * - Get available spells for a level
 * - Spell element and tier classification
 */

import { describe, it, expect } from "vitest";
import { SpellService } from "../SpellService";

describe("SpellService", () => {
  const service = new SpellService();

  describe("getSpell", () => {
    it("returns spell data for valid spell ID", () => {
      const spell = service.getSpell("wind_strike");

      expect(spell).toBeDefined();
      expect(spell?.id).toBe("wind_strike");
      expect(spell?.name).toBe("Wind Strike");
      expect(spell?.level).toBe(1);
      expect(spell?.baseMaxHit).toBe(2);
      expect(spell?.element).toBe("air");
    });

    it("returns undefined for invalid spell ID", () => {
      expect(service.getSpell("invalid_spell")).toBeUndefined();
      expect(service.getSpell("")).toBeUndefined();
    });

    it("returns correct data for fire strike", () => {
      const spell = service.getSpell("fire_strike");

      expect(spell).toBeDefined();
      expect(spell?.level).toBe(13);
      expect(spell?.baseMaxHit).toBe(8);
      expect(spell?.element).toBe("fire");
      expect(spell?.runes).toHaveLength(3);
    });

    it("returns correct data for fire bolt", () => {
      const spell = service.getSpell("fire_bolt");

      expect(spell).toBeDefined();
      expect(spell?.level).toBe(35);
      expect(spell?.baseMaxHit).toBe(12);
      expect(spell?.element).toBe("fire");
    });
  });

  describe("canCastSpell", () => {
    it("rejects when no spell selected", () => {
      const result = service.canCastSpell(null, 40);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NO_SPELL_SELECTED");
    });

    it("rejects undefined spell", () => {
      const result = service.canCastSpell(undefined, 40);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NO_SPELL_SELECTED");
    });

    it("rejects unknown spell", () => {
      const result = service.canCastSpell("unknown_spell", 40);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("SPELL_NOT_FOUND");
    });

    it("rejects when magic level too low", () => {
      // Fire Strike requires level 13
      const result = service.canCastSpell("fire_strike", 10);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("LEVEL_TOO_LOW");
      expect(result.error).toContain("level 13 Magic");
      expect(result.error).toContain("Fire Strike");
    });

    it("rejects Fire Bolt at level 30", () => {
      // Fire Bolt requires level 35
      const result = service.canCastSpell("fire_bolt", 30);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("LEVEL_TOO_LOW");
    });

    it("accepts spell when magic level meets requirement", () => {
      const result = service.canCastSpell("fire_strike", 13);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("accepts spell when magic level exceeds requirement", () => {
      const result = service.canCastSpell("wind_strike", 99);

      expect(result.valid).toBe(true);
    });

    it("accepts all spells at level 99", () => {
      const spells = service.getAllSpells();

      for (const spell of spells) {
        const result = service.canCastSpell(spell.id, 99);
        expect(result.valid).toBe(true);
      }
    });

    it("accepts only Wind Strike at level 1", () => {
      expect(service.canCastSpell("wind_strike", 1).valid).toBe(true);
      expect(service.canCastSpell("water_strike", 1).valid).toBe(false);
    });
  });

  describe("getAvailableSpells", () => {
    it("returns only Wind Strike at level 1", () => {
      const spells = service.getAvailableSpells(1);

      expect(spells).toHaveLength(1);
      expect(spells[0].id).toBe("wind_strike");
    });

    it("returns strike spells up to Fire Strike at level 13", () => {
      const spells = service.getAvailableSpells(13);

      expect(spells).toHaveLength(4);
      expect(spells.map((s) => s.id)).toEqual([
        "wind_strike",
        "water_strike",
        "earth_strike",
        "fire_strike",
      ]);
    });

    it("returns all spells at level 35+", () => {
      const spells = service.getAvailableSpells(35);

      expect(spells).toHaveLength(8);
      expect(spells[spells.length - 1].id).toBe("fire_bolt");
    });

    it("returns empty array at level 0", () => {
      const spells = service.getAvailableSpells(0);

      expect(spells).toHaveLength(0);
    });

    it("returns spells sorted by level", () => {
      const spells = service.getAvailableSpells(99);

      for (let i = 1; i < spells.length; i++) {
        expect(spells[i].level).toBeGreaterThanOrEqual(spells[i - 1].level);
      }
    });
  });

  describe("getAllSpells", () => {
    it("returns all 8 combat spells", () => {
      const spells = service.getAllSpells();

      expect(spells).toHaveLength(8);
    });

    it("returns spells sorted by level", () => {
      const spells = service.getAllSpells();

      for (let i = 1; i < spells.length; i++) {
        expect(spells[i].level).toBeGreaterThanOrEqual(spells[i - 1].level);
      }
    });

    it("includes all elements", () => {
      const spells = service.getAllSpells();
      const elements = new Set(spells.map((s) => s.element));

      expect(elements.has("air")).toBe(true);
      expect(elements.has("water")).toBe(true);
      expect(elements.has("earth")).toBe(true);
      expect(elements.has("fire")).toBe(true);
    });
  });

  describe("isValidSpell", () => {
    it("returns true for valid spells", () => {
      expect(service.isValidSpell("wind_strike")).toBe(true);
      expect(service.isValidSpell("fire_bolt")).toBe(true);
    });

    it("returns false for invalid spells", () => {
      expect(service.isValidSpell("invalid_spell")).toBe(false);
      expect(service.isValidSpell("")).toBe(false);
      expect(service.isValidSpell("fire_blast")).toBe(false); // P2P spell
    });
  });

  describe("getHighestAvailableSpell", () => {
    it("returns Wind Strike at level 1", () => {
      const spell = service.getHighestAvailableSpell(1);

      expect(spell?.id).toBe("wind_strike");
    });

    it("returns Fire Strike at level 16", () => {
      const spell = service.getHighestAvailableSpell(16);

      expect(spell?.id).toBe("fire_strike");
    });

    it("returns Wind Bolt at level 17", () => {
      const spell = service.getHighestAvailableSpell(17);

      expect(spell?.id).toBe("wind_bolt");
    });

    it("returns Fire Bolt at level 35+", () => {
      const spell = service.getHighestAvailableSpell(99);

      expect(spell?.id).toBe("fire_bolt");
    });

    it("returns undefined at level 0", () => {
      expect(service.getHighestAvailableSpell(0)).toBeUndefined();
    });
  });

  describe("getSpellsByElement", () => {
    it("returns 2 air spells", () => {
      const spells = service.getSpellsByElement("air");

      expect(spells).toHaveLength(2);
      expect(spells.map((s) => s.id)).toContain("wind_strike");
      expect(spells.map((s) => s.id)).toContain("wind_bolt");
    });

    it("returns 2 fire spells", () => {
      const spells = service.getSpellsByElement("fire");

      expect(spells).toHaveLength(2);
      expect(spells.map((s) => s.id)).toContain("fire_strike");
      expect(spells.map((s) => s.id)).toContain("fire_bolt");
    });

    it("returns empty array for invalid element", () => {
      const spells = service.getSpellsByElement("invalid");

      expect(spells).toHaveLength(0);
    });
  });

  describe("getSpellTier", () => {
    it("returns 'strike' for strike spells", () => {
      expect(service.getSpellTier("wind_strike")).toBe("strike");
      expect(service.getSpellTier("fire_strike")).toBe("strike");
    });

    it("returns 'bolt' for bolt spells", () => {
      expect(service.getSpellTier("wind_bolt")).toBe("bolt");
      expect(service.getSpellTier("fire_bolt")).toBe("bolt");
    });

    it("returns null for invalid spell", () => {
      expect(service.getSpellTier("invalid_spell")).toBeNull();
    });
  });

  describe("spell rune requirements", () => {
    it("Wind Strike requires air and mind runes", () => {
      const spell = service.getSpell("wind_strike");

      expect(spell?.runes).toHaveLength(2);
      expect(spell?.runes.find((r) => r.runeId === "air_rune")).toBeDefined();
      expect(spell?.runes.find((r) => r.runeId === "mind_rune")).toBeDefined();
    });

    it("Fire Strike requires air, fire, and mind runes", () => {
      const spell = service.getSpell("fire_strike");

      expect(spell?.runes).toHaveLength(3);
      expect(spell?.runes.find((r) => r.runeId === "air_rune")?.quantity).toBe(
        2,
      );
      expect(spell?.runes.find((r) => r.runeId === "fire_rune")?.quantity).toBe(
        3,
      );
      expect(spell?.runes.find((r) => r.runeId === "mind_rune")?.quantity).toBe(
        1,
      );
    });

    it("Fire Bolt requires air, fire, and chaos runes", () => {
      const spell = service.getSpell("fire_bolt");

      expect(spell?.runes).toHaveLength(3);
      expect(spell?.runes.find((r) => r.runeId === "air_rune")?.quantity).toBe(
        3,
      );
      expect(spell?.runes.find((r) => r.runeId === "fire_rune")?.quantity).toBe(
        4,
      );
      expect(
        spell?.runes.find((r) => r.runeId === "chaos_rune")?.quantity,
      ).toBe(1);
    });
  });

  describe("spell max hits", () => {
    it("Strike spells have max hits 2, 4, 6, 8", () => {
      expect(service.getSpell("wind_strike")?.baseMaxHit).toBe(2);
      expect(service.getSpell("water_strike")?.baseMaxHit).toBe(4);
      expect(service.getSpell("earth_strike")?.baseMaxHit).toBe(6);
      expect(service.getSpell("fire_strike")?.baseMaxHit).toBe(8);
    });

    it("Bolt spells have max hits 9, 10, 11, 12", () => {
      expect(service.getSpell("wind_bolt")?.baseMaxHit).toBe(9);
      expect(service.getSpell("water_bolt")?.baseMaxHit).toBe(10);
      expect(service.getSpell("earth_bolt")?.baseMaxHit).toBe(11);
      expect(service.getSpell("fire_bolt")?.baseMaxHit).toBe(12);
    });
  });
});
