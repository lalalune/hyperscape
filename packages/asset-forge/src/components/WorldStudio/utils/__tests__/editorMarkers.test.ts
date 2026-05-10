/**
 * `editorMarkers` — pure helper tests (color lookup + category map).
 *
 * The geometry caching + 3D model loading need THREE.js + asset
 * pipeline integration. This file pins down the two pure mappers
 * the studio's UI relies on:
 *
 *   - getMarkerColor(type, registry?)   — type → color hex
 *   - categoryToMarkerType(category)    — category id → marker type
 *
 * Both are tiny but referenced from many UI surfaces; the
 * MARKER_COLORS table is the canonical source of truth for
 * editor-overlay coloring.
 */

import { describe, expect, it } from "vitest";
import {
  categoryToMarkerType,
  getMarkerColor,
  MARKER_COLORS,
} from "../editorMarkers";

describe("MARKER_COLORS table", () => {
  it("includes the canonical 9 marker types", () => {
    const keys = Object.keys(MARKER_COLORS).sort();
    expect(keys).toEqual([
      "dangerSource",
      "ghost",
      "mobSpawn",
      "npc",
      "poi",
      "resource",
      "spawnPoint",
      "station",
      "teleport",
      "waterBody",
    ]);
  });

  it("colors are 24-bit RGB hex values (0..0xffffff)", () => {
    for (const [, color] of Object.entries(MARKER_COLORS)) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });

  it("danger source uses a red-ish color (high R channel)", () => {
    const r = (MARKER_COLORS.dangerSource >> 16) & 0xff;
    expect(r).toBeGreaterThan(150);
  });
});

describe("getMarkerColor — known types", () => {
  it.each(Object.entries(MARKER_COLORS))(
    "returns the canonical hex for %s",
    (type, expected) => {
      expect(getMarkerColor(type)).toBe(expected);
    },
  );
});

describe("getMarkerColor — unknown types", () => {
  it("returns gray fallback (0x888888) when no registry", () => {
    expect(getMarkerColor("totally-made-up")).toBe(0x888888);
  });

  it("returns gray fallback when registry doesn't know the type", () => {
    const registry = {
      get: () => null,
      getBySelectionType: () => null,
    } as never;
    expect(getMarkerColor("unknown", registry)).toBe(0x888888);
  });

  it("uses registry color when available (parseInt of hex string)", () => {
    const registry = {
      get: (id: string) => (id === "custom" ? { color: "#ff00ff" } : null),
      getBySelectionType: () => null,
    } as never;
    expect(getMarkerColor("custom", registry)).toBe(0xff00ff);
  });

  it("falls back to gray when registry color string is malformed", () => {
    const registry = {
      get: () => ({ color: "not-a-hex-string" }),
      getBySelectionType: () => null,
    } as never;
    expect(getMarkerColor("custom", registry)).toBe(0x888888);
  });

  it("tries getBySelectionType when get() returns null", () => {
    const registry = {
      get: () => null,
      getBySelectionType: (id: string) =>
        id === "selection-type" ? { color: "#00ff00" } : null,
    } as never;
    expect(getMarkerColor("selection-type", registry)).toBe(0x00ff00);
  });
});

describe("categoryToMarkerType — explicit mappings", () => {
  it.each([
    ["npcs", "npc"],
    ["mob-spawns", "mobSpawn"],
    ["spawn-points", "spawnPoint"],
    ["water-bodies", "waterBody"],
    ["danger-sources", "dangerSource"],
    ["pois", "poi"],
  ] as const)("maps %s → %s", (input, expected) => {
    expect(categoryToMarkerType(input)).toBe(expected);
  });

  it("maps any 'resources-*' subcategory to 'resource'", () => {
    expect(categoryToMarkerType("resources-trees")).toBe("resource");
    expect(categoryToMarkerType("resources-rocks")).toBe("resource");
    expect(categoryToMarkerType("resources-fishing")).toBe("resource");
  });
});

describe("categoryToMarkerType — fallback (unknown categories)", () => {
  it("strips dashes for unrecognized categories", () => {
    expect(categoryToMarkerType("custom-category")).toBe("customcategory");
    expect(categoryToMarkerType("a-b-c")).toBe("abc");
  });

  it("returns input unchanged when no dashes are present", () => {
    expect(categoryToMarkerType("noseparator")).toBe("noseparator");
  });

  it("empty string maps to empty string", () => {
    expect(categoryToMarkerType("")).toBe("");
  });
});
