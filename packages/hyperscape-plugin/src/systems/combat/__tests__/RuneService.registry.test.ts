/**
 * RuneService ↔ runesRegistry integration test.
 *
 * Mirrors the worldAreas/npcSizes/stores wiring proofs. Five RuneService
 * methods touch authored data (getInfiniteRunesFromStaff, getRuneName,
 * isValidRune, isElementalStaff, getStaffElement) — each prefers the
 * manifest-loaded `runesRegistry` and falls back to the in-tree
 * ELEMENTAL_STAVES/RUNE_NAMES/VALID_RUNES constants.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RunesManifestSchema,
  type RunesManifest,
} from "@hyperforge/manifest-schema";

import { runesRegistry } from "@hyperforge/shared";
import { RuneService } from "../RuneService.js";
import type { Item } from "../../../../types/game/item-types.js";

function buildManifest(): RunesManifest {
  return RunesManifestSchema.parse({
    runes: [
      {
        id: "test_air",
        name: "Test Air Rune",
        element: "air",
        stackable: true,
      },
      {
        id: "test_water",
        name: "Test Water Rune",
        element: "water",
        stackable: true,
      },
      {
        id: "test_mind",
        name: "Test Mind Rune",
        element: null,
        stackable: true,
      },
    ],
    elementalStaves: [
      {
        staffId: "test_staff_air",
        providesInfinite: ["test_air"],
      },
      {
        staffId: "test_staff_combo",
        providesInfinite: ["test_air", "test_water"],
      },
    ],
  });
}

describe("RuneService ↔ runesRegistry wiring", () => {
  let service: RuneService;

  beforeEach(() => {
    runesRegistry._unloadForTests();
    service = new RuneService();
  });

  afterEach(() => {
    runesRegistry._unloadForTests();
  });

  describe("getInfiniteRunesFromStaff", () => {
    it("when registry loaded, returns the registry's staff rune list", () => {
      runesRegistry.load(buildManifest());
      const staff = { id: "test_staff_combo" } as Item;
      expect(service.getInfiniteRunesFromStaff(staff)).toEqual([
        "test_air",
        "test_water",
      ]);
    });

    it("when registry loaded but staff unknown, returns empty array (falls through to providesInfiniteRunes check)", () => {
      runesRegistry.load(buildManifest());
      const staff = { id: "not_a_staff" } as Item;
      expect(service.getInfiniteRunesFromStaff(staff)).toEqual([]);
    });

    it("when registry unloaded, falls back to legacy ELEMENTAL_STAVES (in-tree {} → empty)", () => {
      expect(runesRegistry.isLoaded()).toBe(false);
      const staff = { id: "test_staff_air" } as Item;
      // ELEMENTAL_STAVES is `{}` in the in-tree data module today, so
      // the unloaded path falls all the way through to []. Assertion
      // is that we don't crash and we return an array.
      const result = service.getInfiniteRunesFromStaff(staff);
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns [] for null weapon regardless of registry state", () => {
      runesRegistry.load(buildManifest());
      expect(service.getInfiniteRunesFromStaff(null)).toEqual([]);
    });
  });

  describe("getRuneName", () => {
    it("when registry loaded, returns the registry's rune name", () => {
      runesRegistry.load(buildManifest());
      expect(service.getRuneName("test_air")).toBe("Test Air Rune");
    });

    it("when registry loaded but rune unknown, falls back to the id (NOT to legacy RUNE_NAMES)", () => {
      runesRegistry.load(buildManifest());
      // Critical: a loaded-but-missing registry is an authored choice
      // — must not silently consult RUNE_NAMES even if it had the id.
      expect(service.getRuneName("not_in_registry")).toBe("not_in_registry");
    });

    it("when registry unloaded, falls back to RUNE_NAMES (which today is empty → returns id)", () => {
      expect(runesRegistry.isLoaded()).toBe(false);
      expect(service.getRuneName("test_air")).toBe("test_air");
    });
  });

  describe("isValidRune", () => {
    it("when registry loaded, true for known runes, false for unknown", () => {
      runesRegistry.load(buildManifest());
      expect(service.isValidRune("test_air")).toBe(true);
      expect(service.isValidRune("test_mind")).toBe(true);
      expect(service.isValidRune("not_a_rune")).toBe(false);
    });

    it("when registry unloaded, falls back to VALID_RUNES (today empty → false)", () => {
      expect(runesRegistry.isLoaded()).toBe(false);
      expect(service.isValidRune("test_air")).toBe(false);
    });
  });

  describe("isElementalStaff", () => {
    it("when registry loaded, true for known staves, false for non-staves", () => {
      runesRegistry.load(buildManifest());
      expect(service.isElementalStaff("test_staff_air")).toBe(true);
      expect(service.isElementalStaff("test_staff_combo")).toBe(true);
      expect(service.isElementalStaff("regular_sword")).toBe(false);
    });

    it("when registry unloaded, falls back to ELEMENTAL_STAVES (today empty → false)", () => {
      expect(runesRegistry.isLoaded()).toBe(false);
      expect(service.isElementalStaff("test_staff_air")).toBe(false);
    });
  });

  describe("getStaffElement", () => {
    it("when registry loaded, returns first provided rune as the staff's element", () => {
      runesRegistry.load(buildManifest());
      expect(service.getStaffElement("test_staff_air")).toBe("test_air");
      expect(service.getStaffElement("test_staff_combo")).toBe("test_air"); // first provided
    });

    it("when registry loaded but staff unknown, returns null", () => {
      runesRegistry.load(buildManifest());
      expect(service.getStaffElement("not_a_staff")).toBeNull();
    });
  });

  describe("hot-reload", () => {
    it("subsequent service calls honor a re-loaded registry", () => {
      runesRegistry.load(buildManifest());
      expect(service.getRuneName("test_air")).toBe("Test Air Rune");

      // Author renames a rune.
      runesRegistry.load(
        RunesManifestSchema.parse({
          runes: [
            {
              id: "test_air",
              name: "Renamed Air",
              element: "air",
              stackable: true,
            },
          ],
          elementalStaves: [
            {
              staffId: "test_staff_air",
              providesInfinite: ["test_air"],
            },
          ],
        }),
      );
      expect(service.getRuneName("test_air")).toBe("Renamed Air");
    });
  });
});
