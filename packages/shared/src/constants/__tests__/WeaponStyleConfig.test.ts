/**
 * WeaponStyleConfig Unit Tests
 *
 * Tests for rules-accurate weapon-to-combat-style mapping:
 * - getAvailableStyles: Returns valid styles per weapon type
 * - isStyleValidForWeapon: Validates style availability
 * - getDefaultStyleForWeapon: Returns correct default style
 *
 */

import { describe, it, expect } from "vitest";
import {
  getAvailableStyles,
  isStyleValidForWeapon,
  getDefaultStyleForWeapon,
  WEAPON_STYLE_CONFIG,
} from "../WeaponStyleConfig";
import { WeaponType } from "../../types/game/item-types";

describe("WeaponStyleConfig", () => {
  describe("getAvailableStyles", () => {
    it("returns all 4 styles for swords", () => {
      const styles = getAvailableStyles(WeaponType.SWORD);
      expect(styles).toEqual([
        "accurate",
        "aggressive",
        "defensive",
        "controlled",
      ]);
    });

    it("returns all 4 styles for scimitars", () => {
      const styles = getAvailableStyles(WeaponType.SCIMITAR);
      expect(styles).toEqual([
        "accurate",
        "aggressive",
        "defensive",
        "controlled",
      ]);
    });

    it("returns 3 styles for axes (no controlled)", () => {
      const styles = getAvailableStyles(WeaponType.AXE);
      expect(styles).toEqual(["accurate", "aggressive", "defensive"]);
      expect(styles).not.toContain("controlled");
    });

    it("returns 3 styles for daggers (no controlled)", () => {
      const styles = getAvailableStyles(WeaponType.DAGGER);
      expect(styles).toEqual(["accurate", "aggressive", "defensive"]);
      expect(styles).not.toContain("controlled");
    });

    it("returns 3 styles for unarmed (no controlled)", () => {
      const styles = getAvailableStyles(WeaponType.NONE);
      expect(styles).toEqual(["accurate", "aggressive", "defensive"]);
      expect(styles).not.toContain("controlled");
    });

    it("returns rules-accurate styles for ranged weapons", () => {
      // Bows and crossbows have accurate, rapid, and longrange in classic MMORPG
      expect(getAvailableStyles(WeaponType.BOW)).toEqual([
        "accurate",
        "rapid",
        "longrange",
      ]);
      expect(getAvailableStyles(WeaponType.CROSSBOW)).toEqual([
        "accurate",
        "rapid",
        "longrange",
      ]);
    });

    it("returns rules-accurate styles for magic weapons", () => {
      // Staves and wands have melee bash styles PLUS autocast in classic MMORPG
      expect(getAvailableStyles(WeaponType.STAFF)).toEqual([
        "accurate",
        "aggressive",
        "defensive",
        "autocast",
      ]);
      expect(getAvailableStyles(WeaponType.WAND)).toEqual([
        "accurate",
        "aggressive",
        "defensive",
        "autocast",
      ]);
    });

    it("returns defensive for shields", () => {
      expect(getAvailableStyles(WeaponType.SHIELD)).toEqual(["defensive"]);
    });

    it("defaults to accurate for unknown weapon type", () => {
      const styles = getAvailableStyles("unknown" as WeaponType);
      expect(styles).toEqual(["accurate"]);
    });
  });

  describe("isStyleValidForWeapon", () => {
    it("allows controlled for swords", () => {
      expect(isStyleValidForWeapon(WeaponType.SWORD, "controlled")).toBe(true);
    });

    it("allows controlled for maces", () => {
      expect(isStyleValidForWeapon(WeaponType.MACE, "controlled")).toBe(true);
    });

    it("allows controlled for spears", () => {
      expect(isStyleValidForWeapon(WeaponType.SPEAR, "controlled")).toBe(true);
    });

    it("allows controlled for halberds", () => {
      expect(isStyleValidForWeapon(WeaponType.HALBERD, "controlled")).toBe(
        true,
      );
    });

    it("rejects controlled for daggers", () => {
      expect(isStyleValidForWeapon(WeaponType.DAGGER, "controlled")).toBe(
        false,
      );
    });

    it("rejects controlled for axes", () => {
      expect(isStyleValidForWeapon(WeaponType.AXE, "controlled")).toBe(false);
    });

    it("rejects controlled for unarmed", () => {
      expect(isStyleValidForWeapon(WeaponType.NONE, "controlled")).toBe(false);
    });

    it("rejects aggressive for bows (MVP melee only)", () => {
      expect(isStyleValidForWeapon(WeaponType.BOW, "aggressive")).toBe(false);
    });

    it("allows accurate for all melee weapons", () => {
      const meleeTypes = [
        WeaponType.SWORD,
        WeaponType.AXE,
        WeaponType.MACE,
        WeaponType.DAGGER,
        WeaponType.SPEAR,
        WeaponType.SCIMITAR,
        WeaponType.HALBERD,
        WeaponType.NONE,
      ];
      meleeTypes.forEach((type) => {
        expect(isStyleValidForWeapon(type, "accurate")).toBe(true);
      });
    });
  });

  describe("getDefaultStyleForWeapon", () => {
    it("returns accurate as default for swords", () => {
      expect(getDefaultStyleForWeapon(WeaponType.SWORD)).toBe("accurate");
    });

    it("returns accurate as default for axes", () => {
      expect(getDefaultStyleForWeapon(WeaponType.AXE)).toBe("accurate");
    });

    it("returns accurate as default for daggers", () => {
      expect(getDefaultStyleForWeapon(WeaponType.DAGGER)).toBe("accurate");
    });

    it("returns accurate as default for unarmed", () => {
      expect(getDefaultStyleForWeapon(WeaponType.NONE)).toBe("accurate");
    });

    it("returns accurate as default for bows", () => {
      expect(getDefaultStyleForWeapon(WeaponType.BOW)).toBe("accurate");
    });

    it("returns defensive for shields", () => {
      expect(getDefaultStyleForWeapon(WeaponType.SHIELD)).toBe("defensive");
    });

    it("returns accurate for unknown weapon type", () => {
      expect(getDefaultStyleForWeapon("unknown" as WeaponType)).toBe(
        "accurate",
      );
    });
  });

  describe("WEAPON_STYLE_CONFIG", () => {
    it("has configuration for all WeaponType values", () => {
      Object.values(WeaponType).forEach((type) => {
        expect(WEAPON_STYLE_CONFIG[type]).toBeDefined();
        expect(Array.isArray(WEAPON_STYLE_CONFIG[type])).toBe(true);
        expect(WEAPON_STYLE_CONFIG[type].length).toBeGreaterThan(0);
      });
    });

    it("all style arrays contain only valid CombatStyleExtended values", () => {
      // CombatStyleExtended includes melee, ranged, and magic styles
      const validStyles = [
        "accurate",
        "aggressive",
        "defensive",
        "controlled",
        "longrange",
        "rapid",
        "autocast",
      ];
      Object.values(WEAPON_STYLE_CONFIG).forEach((styles) => {
        styles.forEach((style) => {
          expect(validStyles).toContain(style);
        });
      });
    });
  });
});
