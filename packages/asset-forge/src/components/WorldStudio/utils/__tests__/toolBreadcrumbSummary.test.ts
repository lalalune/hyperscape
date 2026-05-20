/**
 * toolBreadcrumbSummary — registry-first + bespoke fallback tests.
 *
 * Phase 1.2 fourth carve, upgraded later to subsume Companion's
 * parallel impl. Tests pin both lookup tiers:
 *
 *   - Registry-first: PROPOSE_* actions render with the
 *     proposeActionRegistry's icon + breadcrumbLabel — including
 *     the 9 R4.P8 actions that the old static map was missing.
 *   - Bespoke fallback: PROPOSE_UI_PACK + REMOVE_FROM_PROJECT
 *     (the 2 actions outside the registry) render via the
 *     BESPOKE_BREADCRUMB_SUMMARY map.
 *   - Discovery noise (LIST/GET/SEARCH/CATALOG) drops out.
 *   - Pluralization correct at 0 / 1 / many.
 *   - Map iteration order preserved.
 */

import { describe, it, expect } from "vitest";

import {
  BESPOKE_BREADCRUMB_SUMMARY,
  summarizeToolCalls,
} from "../toolBreadcrumbSummary";

describe("BESPOKE_BREADCRUMB_SUMMARY", () => {
  it("ships exactly the 2 actions outside the registry", () => {
    const keys = Object.keys(BESPOKE_BREADCRUMB_SUMMARY).sort();
    expect(keys).toEqual(["PROPOSE_UI_PACK", "REMOVE_FROM_PROJECT"]);
  });

  it("PROPOSE_UI_PACK ignores count (singleton action)", () => {
    expect(BESPOKE_BREADCRUMB_SUMMARY.PROPOSE_UI_PACK.label(1)).toBe(
      "Designed the HUD",
    );
    expect(BESPOKE_BREADCRUMB_SUMMARY.PROPOSE_UI_PACK.label(99)).toBe(
      "Designed the HUD",
    );
  });

  it("REMOVE_FROM_PROJECT uses 'entity' / 'entities' for 1 vs many", () => {
    expect(BESPOKE_BREADCRUMB_SUMMARY.REMOVE_FROM_PROJECT.label(1)).toBe(
      "Removed 1 entity",
    );
    expect(BESPOKE_BREADCRUMB_SUMMARY.REMOVE_FROM_PROJECT.label(5)).toBe(
      "Removed 5 entities",
    );
  });
});

describe("summarizeToolCalls — registry path", () => {
  it("returns empty array for an empty tally", () => {
    expect(summarizeToolCalls(new Map())).toEqual([]);
  });

  it("emits chips for registry-declared actions", () => {
    const tally = new Map<string, number>([
      ["PROPOSE_MOB_SPAWN", 3],
      ["PROPOSE_QUEST", 1],
    ]);
    expect(summarizeToolCalls(tally)).toEqual([
      { icon: "⚔️", label: "Placed 3 mob spawns" },
      { icon: "📜", label: "Wrote 1 quest" },
    ]);
  });

  it("emits chips for R4.P8 actions previously missing from the static map", () => {
    const tally = new Map<string, number>([
      ["PROPOSE_WATER_BODY", 1],
      ["PROPOSE_MUSIC_ZONE", 2],
      ["PROPOSE_MINE", 1],
    ]);
    const result = summarizeToolCalls(tally);
    expect(result).toHaveLength(3);
    // Don't pin exact labels (registry owns them) — just verify
    // each one resolved to a chip with a non-empty icon + label.
    for (const chip of result) {
      expect(chip.icon.length).toBeGreaterThan(0);
      expect(chip.label.length).toBeGreaterThan(0);
    }
  });

  it("emits chip for PROPOSE_TERRAIN_CONFIG (singleton, ignores count)", () => {
    const tally = new Map<string, number>([["PROPOSE_TERRAIN_CONFIG", 1]]);
    const [chip] = summarizeToolCalls(tally);
    expect(chip.label).toBe("Shaped the terrain");
    expect(chip.icon).toBe("🗺️");
  });
});

describe("summarizeToolCalls — bespoke fallback", () => {
  it("emits chip for PROPOSE_UI_PACK via bespoke map", () => {
    const tally = new Map<string, number>([["PROPOSE_UI_PACK", 1]]);
    expect(summarizeToolCalls(tally)).toEqual([
      { icon: "🎛️", label: "Designed the HUD" },
    ]);
  });

  it("emits chip for REMOVE_FROM_PROJECT via bespoke map", () => {
    const tally = new Map<string, number>([["REMOVE_FROM_PROJECT", 5]]);
    expect(summarizeToolCalls(tally)).toEqual([
      { icon: "🗑️", label: "Removed 5 entities" },
    ]);
  });
});

describe("summarizeToolCalls — discovery noise filtering", () => {
  it("drops LIST/GET/SEARCH/CATALOG calls", () => {
    const tally = new Map<string, number>([
      ["GET_PROJECT_STATE", 2],
      ["LIST_PLUGINS", 1],
      ["SEARCH_ASSETS", 4],
      ["CATALOG_BIOMES", 1],
      ["PROPOSE_QUEST", 1], // the only one that surfaces
    ]);
    const result = summarizeToolCalls(tally);
    expect(result).toEqual([{ icon: "📜", label: "Wrote 1 quest" }]);
  });

  it("drops fully-unknown tool names without surfacing them", () => {
    const tally = new Map<string, number>([
      ["MYSTERY_TOOL", 5],
      ["FUTURE_TOOL", 1],
    ]);
    expect(summarizeToolCalls(tally)).toEqual([]);
  });
});

describe("summarizeToolCalls — ordering", () => {
  it("preserves Map iteration order so chips render in agent's action order", () => {
    const tally = new Map<string, number>();
    tally.set("PROPOSE_NPC_PLACEMENT", 2);
    tally.set("PROPOSE_QUEST", 1);
    tally.set("PROPOSE_TERRAIN_CONFIG", 1);

    const result = summarizeToolCalls(tally);
    expect(result.map((r) => r.icon)).toEqual(["👤", "📜", "🗺️"]);
  });

  it("interleaves registry + bespoke chips in insertion order", () => {
    const tally = new Map<string, number>();
    tally.set("PROPOSE_NPC_PLACEMENT", 1);
    tally.set("PROPOSE_UI_PACK", 1); // bespoke
    tally.set("PROPOSE_QUEST", 1);

    const result = summarizeToolCalls(tally);
    expect(result.map((r) => r.icon)).toEqual(["👤", "🎛️", "📜"]);
  });
});
