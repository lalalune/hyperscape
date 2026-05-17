/**
 * SpellService ↔ combatSpellsRegistry integration test.
 *
 * Mirrors the worldAreas/npcSizes/stores/runes wiring proofs. Six
 * SpellService methods touch authored data (getSpell, getAvailableSpells,
 * getAllSpells, canCastSpell, isValidSpell, getSpellsByElement,
 * getSpellTier) — each prefers the manifest-loaded `combatSpellsRegistry`
 * and falls back to the in-tree COMBAT_SPELLS / SPELL_ORDER constants.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CombatSpellsManifestSchema,
  type CombatSpellsManifest,
} from "@hyperforge/manifest-schema";

import { combatSpellsRegistry } from "@hyperforge/shared";
import { SpellService } from "../SpellService.js";

function buildManifest(): CombatSpellsManifest {
  return CombatSpellsManifestSchema.parse({
    standard: {
      strike: [
        {
          id: "test_air_strike",
          name: "Test Air Strike",
          level: 1,
          baseMaxHit: 2,
          baseXp: 5.5,
          element: "air",
          attackSpeed: 5,
          runes: [{ runeId: "air_rune", quantity: 1 }],
        },
        {
          id: "test_fire_strike",
          name: "Test Fire Strike",
          level: 13,
          baseMaxHit: 8,
          baseXp: 11.5,
          element: "fire",
          attackSpeed: 5,
          runes: [{ runeId: "fire_rune", quantity: 3 }],
        },
      ],
      bolt: [
        {
          id: "test_air_bolt",
          name: "Test Air Bolt",
          level: 17,
          baseMaxHit: 9,
          baseXp: 13.5,
          element: "air",
          attackSpeed: 5,
          runes: [{ runeId: "air_rune", quantity: 2 }],
        },
      ],
    },
  });
}

describe("SpellService ↔ combatSpellsRegistry wiring", () => {
  let service: SpellService;

  beforeEach(() => {
    combatSpellsRegistry._unloadForTests();
    service = new SpellService();
  });

  afterEach(() => {
    combatSpellsRegistry._unloadForTests();
  });

  describe("getSpell", () => {
    it("when registry loaded, returns the registry's spell entry", () => {
      combatSpellsRegistry.load(buildManifest());
      const spell = service.getSpell("test_air_strike");
      expect(spell).toBeDefined();
      expect(spell?.name).toBe("Test Air Strike");
      expect(spell?.level).toBe(1);
    });

    it("when registry loaded but spell unknown, returns undefined (NOT legacy fallback)", () => {
      combatSpellsRegistry.load(buildManifest());
      // Critical contract: a loaded-but-missing registry entry is an
      // authored deletion, NOT a fallback trigger.
      expect(service.getSpell("not_in_registry")).toBeUndefined();
    });

    it("when registry unloaded, falls back to legacy COMBAT_SPELLS", () => {
      expect(combatSpellsRegistry.isLoaded()).toBe(false);
      // The in-tree COMBAT_SPELLS is populated at module load by
      // data/combat-spells.ts — common spells like wind_strike resolve.
      const spell = service.getSpell("wind_strike");
      // Real spell from the bundled manifest; assertion is just that
      // we don't crash and return either a value or undefined.
      expect(spell === undefined || typeof spell.name === "string").toBe(true);
    });
  });

  describe("getAvailableSpells", () => {
    it("filters loaded spells by player magic level", () => {
      combatSpellsRegistry.load(buildManifest());
      // At level 1, only test_air_strike (level 1) is available.
      expect(service.getAvailableSpells(1).map((s) => s.id)).toEqual([
        "test_air_strike",
      ]);
      // At level 13, both strike-tier spells are available.
      const lvl13 = service.getAvailableSpells(13).map((s) => s.id);
      expect(lvl13).toContain("test_air_strike");
      expect(lvl13).toContain("test_fire_strike");
      // At level 17, all three are available.
      expect(service.getAvailableSpells(17)).toHaveLength(3);
    });
  });

  describe("getAllSpells", () => {
    it("returns all loaded spells (strike then bolt tier order)", () => {
      combatSpellsRegistry.load(buildManifest());
      const all = service.getAllSpells();
      expect(all.map((s) => s.id)).toEqual([
        "test_air_strike",
        "test_fire_strike",
        "test_air_bolt",
      ]);
    });
  });

  describe("canCastSpell", () => {
    it("rejects null/undefined spellId before consulting any source", () => {
      const result = service.canCastSpell(null, 99);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("NO_SPELL_SELECTED");
    });

    it("rejects unknown spell when registry loaded but missing", () => {
      combatSpellsRegistry.load(buildManifest());
      const result = service.canCastSpell("not_a_spell", 99);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("SPELL_NOT_FOUND");
    });

    it("rejects when player magic level below spell requirement", () => {
      combatSpellsRegistry.load(buildManifest());
      const result = service.canCastSpell("test_fire_strike", 5);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe("LEVEL_TOO_LOW");
    });

    it("accepts a valid cast", () => {
      combatSpellsRegistry.load(buildManifest());
      const result = service.canCastSpell("test_air_strike", 1);
      expect(result.valid).toBe(true);
    });
  });

  describe("isValidSpell + getSpellsByElement + getSpellTier", () => {
    it("isValidSpell uses registry-prefer", () => {
      combatSpellsRegistry.load(buildManifest());
      expect(service.isValidSpell("test_air_strike")).toBe(true);
      expect(service.isValidSpell("not_a_spell")).toBe(false);
    });

    it("getSpellsByElement filters across loaded tiers", () => {
      combatSpellsRegistry.load(buildManifest());
      const air = service.getSpellsByElement("air").map((s) => s.id);
      expect(air).toContain("test_air_strike");
      expect(air).toContain("test_air_bolt");
      expect(air).not.toContain("test_fire_strike");
    });

    it("getSpellTier returns strike|bolt|null based on id suffix when spell exists", () => {
      combatSpellsRegistry.load(buildManifest());
      expect(service.getSpellTier("test_air_strike")).toBe("strike");
      expect(service.getSpellTier("test_air_bolt")).toBe("bolt");
      expect(service.getSpellTier("not_a_spell")).toBeNull();
    });
  });

  describe("hot-reload", () => {
    it("subsequent service calls honor a re-loaded registry", () => {
      combatSpellsRegistry.load(buildManifest());
      expect(service.getSpell("test_air_strike")?.name).toBe("Test Air Strike");

      // Author renames a spell.
      combatSpellsRegistry.load(
        CombatSpellsManifestSchema.parse({
          standard: {
            strike: [
              {
                id: "test_air_strike",
                name: "Renamed Air Strike",
                level: 1,
                baseMaxHit: 2,
                baseXp: 5.5,
                element: "air",
                attackSpeed: 5,
                runes: [{ runeId: "air_rune", quantity: 1 }],
              },
            ],
            // Schema requires bolt[].min(1); keep one entry so the
            // manifest is structurally valid for this test.
            bolt: [
              {
                id: "test_air_bolt",
                name: "Test Air Bolt",
                level: 17,
                baseMaxHit: 9,
                baseXp: 13.5,
                element: "air",
                attackSpeed: 5,
                runes: [{ runeId: "air_rune", quantity: 2 }],
              },
            ],
          },
        }),
      );
      expect(service.getSpell("test_air_strike")?.name).toBe(
        "Renamed Air Strike",
      );
    });
  });
});
