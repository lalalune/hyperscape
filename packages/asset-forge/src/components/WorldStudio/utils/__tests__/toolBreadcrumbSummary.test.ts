/**
 * toolBreadcrumbSummary — registry + summarizer tests.
 *
 * Phase 1.2 fourth carve. Pins the tool-call rollup the dialog
 * shows below each agent message ("⚔️ Placed 3 mob spawns").
 *
 * Tests cover:
 *   - Every PROPOSE_* tool present in the registry has a
 *     stable icon + pluralizing label.
 *   - Discovery tools (LIST/GET/SEARCH/CATALOG) are filtered
 *     out by the summarizer.
 *   - Pluralization is correct at count 0 / 1 / many.
 *   - Iteration order of the input Map is preserved (so the
 *     UI shows actions in the order the agent took them).
 */

import { describe, it, expect } from "vitest";

import {
  TOOL_BREADCRUMB_SUMMARY,
  summarizeToolCalls,
} from "../toolBreadcrumbSummary";

describe("TOOL_BREADCRUMB_SUMMARY registry", () => {
  const expectedTools = [
    "PROPOSE_TERRAIN_CONFIG",
    "PROPOSE_PLUGIN_SET",
    "PROPOSE_NPC_PLACEMENT",
    "PROPOSE_MOB_SPAWN",
    "PROPOSE_QUEST",
    "PROPOSE_ZONE",
    "PROPOSE_RESOURCE",
    "PROPOSE_STATION",
    "PROPOSE_TELEPORT",
    "PROPOSE_ASSET_PACK_INSTALL",
    "PROPOSE_ASSET",
    "PROPOSE_UI_PACK",
    "REMOVE_FROM_PROJECT",
  ];

  it.each(expectedTools)("has entry for %s", (toolName) => {
    expect(TOOL_BREADCRUMB_SUMMARY[toolName]).toBeDefined();
    expect(typeof TOOL_BREADCRUMB_SUMMARY[toolName].icon).toBe("string");
    expect(typeof TOOL_BREADCRUMB_SUMMARY[toolName].label).toBe("function");
  });

  it("uses unique icons across tools", () => {
    // Pin the icon uniqueness so a future contributor adding a
    // new entry has to pick a non-colliding emoji.
    const icons = Object.values(TOOL_BREADCRUMB_SUMMARY).map((e) => e.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});

describe("TOOL_BREADCRUMB_SUMMARY label pluralization", () => {
  it("PROPOSE_NPC_PLACEMENT singular vs plural", () => {
    const e = TOOL_BREADCRUMB_SUMMARY.PROPOSE_NPC_PLACEMENT;
    expect(e.label(1)).toBe("Placed 1 NPC");
    expect(e.label(2)).toBe("Placed 2 NPCs");
  });

  it("PROPOSE_QUEST singular vs plural", () => {
    const e = TOOL_BREADCRUMB_SUMMARY.PROPOSE_QUEST;
    expect(e.label(1)).toBe("Wrote 1 quest");
    expect(e.label(3)).toBe("Wrote 3 quests");
  });

  it("REMOVE_FROM_PROJECT uses 'entity' / 'entities' for 1 vs many", () => {
    const e = TOOL_BREADCRUMB_SUMMARY.REMOVE_FROM_PROJECT;
    expect(e.label(1)).toBe("Removed 1 entity");
    expect(e.label(5)).toBe("Removed 5 entities");
  });

  it("PROPOSE_TERRAIN_CONFIG ignores count (single-shot action)", () => {
    const e = TOOL_BREADCRUMB_SUMMARY.PROPOSE_TERRAIN_CONFIG;
    expect(e.label(1)).toBe("Shaped the terrain");
    expect(e.label(99)).toBe("Shaped the terrain");
  });

  it("PROPOSE_PLUGIN_SET ignores count", () => {
    expect(TOOL_BREADCRUMB_SUMMARY.PROPOSE_PLUGIN_SET.label(1)).toBe(
      "Picked plugins",
    );
  });

  it("PROPOSE_UI_PACK ignores count", () => {
    expect(TOOL_BREADCRUMB_SUMMARY.PROPOSE_UI_PACK.label(1)).toBe(
      "Designed the HUD",
    );
  });
});

describe("summarizeToolCalls", () => {
  it("returns empty array for an empty tally", () => {
    expect(summarizeToolCalls(new Map())).toEqual([]);
  });

  it("emits one chip per registered tool with its rendered label", () => {
    const tally = new Map<string, number>([
      ["PROPOSE_MOB_SPAWN", 3],
      ["PROPOSE_QUEST", 1],
    ]);
    expect(summarizeToolCalls(tally)).toEqual([
      { icon: "⚔️", label: "Placed 3 mob spawns" },
      { icon: "📜", label: "Wrote 1 quest" },
    ]);
  });

  it("filters out discovery tools not in the registry", () => {
    const tally = new Map<string, number>([
      ["GET_PROJECT_STATE", 2],
      ["LIST_PLUGINS", 1],
      ["SEARCH_ASSETS", 4],
      ["CATALOG_BIOMES", 1],
      ["PROPOSE_QUEST", 1], // the only one that survives
    ]);
    const result = summarizeToolCalls(tally);
    expect(result).toEqual([{ icon: "📜", label: "Wrote 1 quest" }]);
  });

  it("preserves Map iteration order (LIFO-of-insertion)", () => {
    const tally = new Map<string, number>();
    tally.set("PROPOSE_NPC_PLACEMENT", 2);
    tally.set("PROPOSE_QUEST", 1);
    tally.set("PROPOSE_TERRAIN_CONFIG", 1);

    const result = summarizeToolCalls(tally);
    expect(result.map((r) => r.icon)).toEqual(["👤", "📜", "🗺️"]);
  });

  it("handles a fully-unknown tally as empty output", () => {
    const tally = new Map<string, number>([
      ["MYSTERY_TOOL", 5],
      ["FUTURE_TOOL", 1],
    ]);
    expect(summarizeToolCalls(tally)).toEqual([]);
  });
});
