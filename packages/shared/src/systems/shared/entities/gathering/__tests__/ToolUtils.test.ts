/**
 * ToolUtils Tests
 *
 * Verifies tool validation and categorization:
 * - Noted items rejection (cannot use bank notes as tools)
 * - Category matching for pickaxes and hatchets
 * - Exact matching for fishing tools
 *
 */

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import type { GatheringToolData } from "../../../../../data/DataManager";
import {
  itemMatchesToolCategory,
  getToolCategory,
  isExactMatchFishingTool,
  getToolDisplayName,
  _resetFallbackWarnings,
} from "../ToolUtils";

describe("ToolUtils", () => {
  describe("itemMatchesToolCategory", () => {
    describe("noted items rejection", () => {
      it("rejects noted pickaxes", () => {
        expect(itemMatchesToolCategory("bronze_pickaxe_noted", "pickaxe")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("iron_pickaxe_noted", "pickaxe")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("rune_pickaxe_noted", "pickaxe")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("dragon_pickaxe_noted", "pickaxe")).toBe(
          false,
        );
      });

      it("rejects noted hatchets/axes", () => {
        expect(itemMatchesToolCategory("bronze_axe_noted", "hatchet")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("iron_hatchet_noted", "hatchet")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("rune_hatchet_noted", "hatchet")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("dragon_axe_noted", "hatchet")).toBe(
          false,
        );
      });

      it("rejects noted fishing tools", () => {
        expect(
          itemMatchesToolCategory(
            "small_fishing_net_noted",
            "small_fishing_net",
          ),
        ).toBe(false);
        expect(
          itemMatchesToolCategory("fishing_rod_noted", "fishing_rod"),
        ).toBe(false);
        expect(itemMatchesToolCategory("harpoon_noted", "harpoon")).toBe(false);
      });

      it("accepts normal (unnoted) tools", () => {
        expect(itemMatchesToolCategory("bronze_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("rune_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("dragon_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("bronze_hatchet", "hatchet")).toBe(true);
        expect(itemMatchesToolCategory("rune_hatchet", "hatchet")).toBe(true);
      });
    });

    describe("pickaxe category matching", () => {
      it("matches items containing 'pickaxe'", () => {
        expect(itemMatchesToolCategory("bronze_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("iron_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("steel_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("mithril_pickaxe", "pickaxe")).toBe(
          true,
        );
        expect(itemMatchesToolCategory("adamant_pickaxe", "pickaxe")).toBe(
          true,
        );
        expect(itemMatchesToolCategory("rune_pickaxe", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("dragon_pickaxe", "pickaxe")).toBe(true);
      });

      it("matches items containing 'pick'", () => {
        expect(itemMatchesToolCategory("bronze_pick", "pickaxe")).toBe(true);
        expect(itemMatchesToolCategory("iron_pick", "pickaxe")).toBe(true);
      });

      it("rejects non-pickaxe items", () => {
        expect(itemMatchesToolCategory("bronze_shortsword", "pickaxe")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("bronze_axe", "pickaxe")).toBe(false);
        expect(itemMatchesToolCategory("logs", "pickaxe")).toBe(false);
      });
    });

    describe("hatchet/axe category matching", () => {
      it("matches items containing 'hatchet'", () => {
        expect(itemMatchesToolCategory("bronze_hatchet", "hatchet")).toBe(true);
        expect(itemMatchesToolCategory("iron_hatchet", "hatchet")).toBe(true);
        expect(itemMatchesToolCategory("rune_hatchet", "hatchet")).toBe(true);
      });

      it("rejects bare 'axe' items without 'hatchet' in fallback", () => {
        // Fallback only matches "hatchet" substring, not bare "axe",
        // to avoid false positives with combat weapons (battleaxe, greataxe, etc.).
        // Real tools like bronze_axe/dragon_axe go through the manifest path.
        expect(itemMatchesToolCategory("bronze_axe", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("iron_axe", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("battleaxe", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("greataxe", "hatchet")).toBe(false);
      });

      it("rejects non-hatchet items", () => {
        expect(itemMatchesToolCategory("bronze_shortsword", "hatchet")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("logs", "hatchet")).toBe(false);
      });

      it("does not match pickaxe for hatchet category", () => {
        // Pickaxes are mining tools — they must NOT match the hatchet (woodcutting) category.
        // The manifest declares each tool's skill explicitly, preventing cross-skill usage.
        expect(itemMatchesToolCategory("bronze_pickaxe", "hatchet")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("iron_pickaxe", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("rune_pickaxe", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("dragon_pickaxe", "hatchet")).toBe(
          false,
        );
      });

      it("does not match hatchet for pickaxe category", () => {
        // Hatchets are woodcutting tools — they must NOT match the pickaxe (mining) category.
        expect(itemMatchesToolCategory("bronze_hatchet", "pickaxe")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("iron_hatchet", "pickaxe")).toBe(false);
        expect(itemMatchesToolCategory("rune_hatchet", "pickaxe")).toBe(false);
        expect(itemMatchesToolCategory("dragon_hatchet", "pickaxe")).toBe(
          false,
        );
      });
    });

    describe("manifest-based validation", () => {
      // Populate globalThis.EXTERNAL_TOOLS so the manifest path is exercised
      const mockTools = new Map<string, GatheringToolData>();

      function addMockTool(
        itemId: string,
        skill: "woodcutting" | "mining" | "fishing",
      ) {
        mockTools.set(itemId, {
          itemId,
          skill,
          tier: "test",
          levelRequired: 1,
          priority: 1,
        });
      }

      afterEach(() => {
        mockTools.clear();
        delete (globalThis as Record<string, unknown>).EXTERNAL_TOOLS;
      });

      it("accepts woodcutting tool for hatchet category via manifest", () => {
        addMockTool("bronze_hatchet", "woodcutting");
        (globalThis as Record<string, unknown>).EXTERNAL_TOOLS = mockTools;

        expect(itemMatchesToolCategory("bronze_hatchet", "hatchet")).toBe(true);
      });

      it("rejects mining tool for hatchet category via manifest", () => {
        addMockTool("bronze_pickaxe", "mining");
        (globalThis as Record<string, unknown>).EXTERNAL_TOOLS = mockTools;

        expect(itemMatchesToolCategory("bronze_pickaxe", "hatchet")).toBe(
          false,
        );
      });

      it("rejects woodcutting tool for pickaxe category via manifest", () => {
        addMockTool("iron_hatchet", "woodcutting");
        (globalThis as Record<string, unknown>).EXTERNAL_TOOLS = mockTools;

        expect(itemMatchesToolCategory("iron_hatchet", "pickaxe")).toBe(false);
      });

      it("accepts mining tool for pickaxe category via manifest", () => {
        addMockTool("rune_pickaxe", "mining");
        (globalThis as Record<string, unknown>).EXTERNAL_TOOLS = mockTools;

        expect(itemMatchesToolCategory("rune_pickaxe", "pickaxe")).toBe(true);
      });

      it("rejects manifest tool for unknown category via direct skill comparison", () => {
        // Tool is in manifest with skill "mining", but category "hammer" isn't in CATEGORY_TO_SKILL.
        // Falls back to direct comparison: toolData.skill ("mining") === category ("hammer") → false.
        addMockTool("bronze_pickaxe", "mining");
        (globalThis as Record<string, unknown>).EXTERNAL_TOOLS = mockTools;

        expect(itemMatchesToolCategory("bronze_pickaxe", "hammer")).toBe(false);
      });
    });

    describe("fallback path (no manifest)", () => {
      beforeEach(() => {
        // Ensure no manifest is loaded so fallback substring matching is exercised
        delete (globalThis as Record<string, unknown>).EXTERNAL_TOOLS;
        // Reset warn-once cache so each test can verify warnings independently
        _resetFallbackWarnings();
        vi.spyOn(console, "warn").mockImplementation(() => {});
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("matches hatchet via fallback and logs warning", () => {
        expect(itemMatchesToolCategory("bronze_hatchet", "hatchet")).toBe(true);
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("not found in tools manifest"),
        );
      });

      it("rejects pickaxe for hatchet via fallback", () => {
        expect(itemMatchesToolCategory("iron_pickaxe", "hatchet")).toBe(false);
      });

      it("rejects hatchet for pickaxe via fallback", () => {
        expect(itemMatchesToolCategory("iron_hatchet", "pickaxe")).toBe(false);
      });

      it("warns for any category, not just hatchet/pickaxe", () => {
        itemMatchesToolCategory("bronze_hammer", "hammer");
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("not found in tools manifest"),
        );
      });

      it("rejects unknown categories not in manifest", () => {
        // Unknown categories default to false — forces manifest completeness
        expect(itemMatchesToolCategory("bronze_hammer", "hammer")).toBe(false);
        expect(itemMatchesToolCategory("iron_chisel", "hammer")).toBe(false);
      });
    });

    describe("fishing tools exact matching", () => {
      it("requires exact match for fishing net", () => {
        expect(
          itemMatchesToolCategory("small_fishing_net", "small_fishing_net"),
        ).toBe(true);
        expect(
          itemMatchesToolCategory("big_fishing_net", "small_fishing_net"),
        ).toBe(false);
        expect(
          itemMatchesToolCategory("fishing_net", "small_fishing_net"),
        ).toBe(false);
      });

      it("requires exact match for fishing rod", () => {
        expect(itemMatchesToolCategory("fishing_rod", "fishing_rod")).toBe(
          true,
        );
        expect(itemMatchesToolCategory("fly_fishing_rod", "fishing_rod")).toBe(
          false,
        );
      });

      it("requires exact match for fly fishing rod", () => {
        expect(
          itemMatchesToolCategory("fly_fishing_rod", "fly_fishing_rod"),
        ).toBe(true);
        expect(itemMatchesToolCategory("fishing_rod", "fly_fishing_rod")).toBe(
          false,
        );
      });

      it("requires exact match for harpoon", () => {
        expect(itemMatchesToolCategory("harpoon", "harpoon")).toBe(true);
        expect(itemMatchesToolCategory("dragon_harpoon", "harpoon")).toBe(
          false,
        );
      });

      it("requires exact match for lobster pot", () => {
        expect(itemMatchesToolCategory("lobster_pot", "lobster_pot")).toBe(
          true,
        );
        expect(itemMatchesToolCategory("pot", "lobster_pot")).toBe(false);
      });

      it("fishing tools do not match hatchet or pickaxe categories", () => {
        // Three-way invariant: fishing tools are never valid for woodcutting/mining
        expect(itemMatchesToolCategory("fishing_rod", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("fishing_rod", "pickaxe")).toBe(false);
        expect(itemMatchesToolCategory("harpoon", "hatchet")).toBe(false);
        expect(itemMatchesToolCategory("harpoon", "pickaxe")).toBe(false);
        expect(itemMatchesToolCategory("small_fishing_net", "hatchet")).toBe(
          false,
        );
        expect(itemMatchesToolCategory("small_fishing_net", "pickaxe")).toBe(
          false,
        );
      });
    });
  });

  describe("getToolCategory", () => {
    it("extracts pickaxe category", () => {
      expect(getToolCategory("bronze_pickaxe")).toBe("pickaxe");
      expect(getToolCategory("dragon_pickaxe")).toBe("pickaxe");
      expect(getToolCategory("iron_pick")).toBe("pickaxe");
    });

    it("extracts hatchet category", () => {
      expect(getToolCategory("bronze_hatchet")).toBe("hatchet");
      expect(getToolCategory("dragon_axe")).toBe("hatchet");
      expect(getToolCategory("iron_axe")).toBe("hatchet");
    });

    it("returns exact ID for fishing tools", () => {
      expect(getToolCategory("small_fishing_net")).toBe("small_fishing_net");
      expect(getToolCategory("fishing_rod")).toBe("fishing_rod");
      expect(getToolCategory("fly_fishing_rod")).toBe("fly_fishing_rod");
      expect(getToolCategory("harpoon")).toBe("harpoon");
      expect(getToolCategory("lobster_pot")).toBe("lobster_pot");
      expect(getToolCategory("big_fishing_net")).toBe("big_fishing_net");
    });

    it("falls back to last segment for unknown tools", () => {
      expect(getToolCategory("bronze_hammer")).toBe("hammer");
      expect(getToolCategory("iron_chisel")).toBe("chisel");
    });
  });

  describe("isExactMatchFishingTool", () => {
    it("returns true for fishing tools", () => {
      expect(isExactMatchFishingTool("small_fishing_net")).toBe(true);
      expect(isExactMatchFishingTool("fishing_rod")).toBe(true);
      expect(isExactMatchFishingTool("fly_fishing_rod")).toBe(true);
      expect(isExactMatchFishingTool("harpoon")).toBe(true);
      expect(isExactMatchFishingTool("lobster_pot")).toBe(true);
      expect(isExactMatchFishingTool("big_fishing_net")).toBe(true);
    });

    it("returns false for non-fishing tools", () => {
      expect(isExactMatchFishingTool("pickaxe")).toBe(false);
      expect(isExactMatchFishingTool("hatchet")).toBe(false);
      expect(isExactMatchFishingTool("hammer")).toBe(false);
    });
  });

  describe("getToolDisplayName", () => {
    it("returns display names for known tools", () => {
      expect(getToolDisplayName("pickaxe")).toBe("pickaxe");
      expect(getToolDisplayName("hatchet")).toBe("hatchet");
      expect(getToolDisplayName("small_fishing_net")).toBe("small fishing net");
      expect(getToolDisplayName("fly_fishing_rod")).toBe("fly fishing rod");
    });

    it("converts underscores to spaces for unknown tools", () => {
      expect(getToolDisplayName("bronze_hammer")).toBe("bronze hammer");
      expect(getToolDisplayName("some_unknown_tool")).toBe("some unknown tool");
    });
  });
});
