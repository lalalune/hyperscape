/**
 * Proof that `useXPOrbState.getXPForLevel` reads through the shared
 * `xpCurveRegistry` when loaded, and falls back cleanly to the
 * hardcoded canonical-tile-based MMORPG table when the registry is empty.
 *
 * This is the first client-side consumer that treats xp-curves.json as
 * live, hot-reloadable data. When a PIE editor save fires
 * `xpCurveRegistry.load(...)`, the next render of the XP orbs picks
 * up the new thresholds without a restart.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { xpCurveRegistry } from "@hyperforge/shared";
import { getXPForLevel } from "../../src/game/hud/xp-orb/useXPOrbState";

beforeEach(() => {
  xpCurveRegistry.load([]);
});

afterEach(() => {
  xpCurveRegistry.load([]);
});

describe("xp-orb HUD → xpCurveRegistry consumer wiring", () => {
  it("falls back to canonical-tile-based MMORPG hardcoded table when registry is empty", () => {
    expect(xpCurveRegistry.isLoaded()).toBe(false);
    // These are the canonical-tile-based MMORPG values that the legacy client
    // table also produces, since the legacy table already used
    // sum-of-floors math.
    expect(getXPForLevel(1)).toBe(0);
    expect(getXPForLevel(2)).toBe(83);
    expect(getXPForLevel(99)).toBe(13_034_431);
  });

  it("reads through registry when loaded with osrs-classic curve", () => {
    xpCurveRegistry.load([
      {
        id: "osrs-classic",
        name: "tile-based MMORPG Classic",
        description: "",
        kind: "formula",
        formula: "rs-classic",
        maxLevel: 99,
        params: {},
      },
    ]);
    expect(getXPForLevel(99)).toBe(13_034_431);
  });

  it("PIE hot-reload of osrs-classic with linear curve shifts the HUD threshold live", () => {
    // Boot baseline.
    xpCurveRegistry.load([
      {
        id: "osrs-classic",
        name: "tile-based MMORPG Classic",
        description: "",
        kind: "formula",
        formula: "rs-classic",
        maxLevel: 99,
        params: {},
      },
    ]);
    const before = getXPForLevel(50);
    expect(before).toBe(101_333);

    // Editor saves a new curve under the same id.
    xpCurveRegistry.load([
      {
        id: "osrs-classic",
        name: "Linear (editor override)",
        description: "",
        kind: "formula",
        formula: "linear",
        maxLevel: 99,
        params: { base: 100, growth: 50 },
      },
    ]);

    const after = getXPForLevel(50);
    expect(after).not.toBe(before);
    // Linear curve at L50 with base=100, growth=50: well under the
    // rs-classic baseline (101_333) but still substantial (cumulative
    // growth across 49 levels).
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it("falls back to hardcoded table when a different curve id is loaded (not osrs-classic)", () => {
    xpCurveRegistry.load([
      {
        id: "custom-progression",
        name: "Custom",
        description: "",
        kind: "lookup",
        xp: [100, 200, 300],
      },
    ]);
    // HUD reads the DEFAULT_XP_CURVE_ID which is "osrs-classic".
    // Since only "custom-progression" is loaded, falls back to hardcoded.
    expect(getXPForLevel(99)).toBe(13_034_431);
  });

  it("clamps requests above the loaded curve's maxLevel", () => {
    xpCurveRegistry.load([
      {
        id: "osrs-classic",
        name: "tile-based MMORPG Classic",
        description: "",
        kind: "formula",
        formula: "rs-classic",
        maxLevel: 99,
        params: {},
      },
    ]);
    // L120 should clamp to L99.
    expect(getXPForLevel(120)).toBe(13_034_431);
  });
});

describe("xp-orb HUD → xpCurveRegistry.onReloaded() subscription", () => {
  it("fires HUD-side reload listener on every registry load (boot + PIE)", () => {
    const calls: ReadonlyArray<string>[] = [];
    const unsubscribe = xpCurveRegistry.onReloaded((ids) => calls.push(ids));

    // First load — simulates DataManager boot path.
    xpCurveRegistry.load([
      {
        id: "osrs-classic",
        name: "tile-based MMORPG Classic",
        description: "",
        kind: "formula",
        formula: "rs-classic",
        maxLevel: 99,
        params: {},
      },
    ]);
    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual(["osrs-classic"]);

    // Second load — simulates PIEEditorSession.updateManifests({ xpCurves }).
    xpCurveRegistry.load([
      {
        id: "osrs-classic",
        name: "Editor override",
        description: "",
        kind: "formula",
        formula: "linear",
        maxLevel: 99,
        params: { base: 100, growth: 50 },
      },
    ]);
    expect(calls.length).toBe(2);

    unsubscribe();
    xpCurveRegistry.load([]);
    // No more notifications after unsubscribe — the HUD's useEffect
    // cleanup is what calls this on unmount.
    expect(calls.length).toBe(2);
  });
});
