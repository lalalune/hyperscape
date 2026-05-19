/**
 * Active tree preset registry tests.
 *
 * Phase 3.5 follow-up — pins the contract for the
 * `setActiveTreePresets` / `getActiveTreePresets` API that
 * `createClientWorld`'s prewarm reads from. Host packages
 * (asset-forge studio, agent-server, production server) call
 * `setActiveTreePresets(union of installedPacks.treePresets)`
 * before world boot; the prewarm walks the active list instead
 * of the hardcoded `TREE_PRESETS` array.
 *
 * The registry is a module-level singleton — tests use
 * `afterEach` to restore the default so they don't leak state.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  TREE_PRESETS,
  setActiveTreePresets,
  getActiveTreePresets,
} from "../ProcgenTreeCache";

beforeEach(() => {
  setActiveTreePresets(TREE_PRESETS);
});

afterEach(() => {
  // Restore default so cross-test pollution doesn't break the
  // next file's expectations (e.g. tests that prewarm the
  // engine fallback set).
  setActiveTreePresets(TREE_PRESETS);
});

describe("getActiveTreePresets — default behavior", () => {
  it("returns the engine fallback TREE_PRESETS when no host populated", () => {
    // Fresh state via beforeEach reset.
    expect(getActiveTreePresets()).toEqual(TREE_PRESETS);
  });

  it("returns a frozen-style array (caller can read but writes don't affect store)", () => {
    const a = getActiveTreePresets();
    const b = getActiveTreePresets();
    // Same singleton — no defensive copy. Mutations would
    // affect the store, so callers are expected to treat the
    // result as readonly (TypeScript readonly type enforces).
    expect(a).toBe(b);
  });
});

describe("setActiveTreePresets — host plumbing", () => {
  it("replaces the active list with the supplied array", () => {
    const themed = ["arcticPine", "tropicalPalm", "volcanicAsh"];
    setActiveTreePresets(themed);
    expect(getActiveTreePresets()).toEqual(themed);
  });

  it("allows an empty list (skips prewarm entirely)", () => {
    setActiveTreePresets([]);
    expect(getActiveTreePresets()).toEqual([]);
  });

  it("overwrites on each call (no merge)", () => {
    setActiveTreePresets(["a", "b"]);
    setActiveTreePresets(["c"]);
    expect(getActiveTreePresets()).toEqual(["c"]);
  });

  it("a single preset is supported (1-element array)", () => {
    setActiveTreePresets(["quakingAspen"]);
    expect(getActiveTreePresets()).toEqual(["quakingAspen"]);
  });
});

describe("Engine fallback semantics", () => {
  it("TREE_PRESETS contains the 8 canonical Hyperia preset ids", () => {
    expect(TREE_PRESETS).toHaveLength(8);
    expect(TREE_PRESETS).toContain("quakingAspen");
    expect(TREE_PRESETS).toContain("blackOak");
    expect(TREE_PRESETS).toContain("weepingWillow");
    expect(TREE_PRESETS).toContain("blackTupelo");
    expect(TREE_PRESETS).toContain("acer");
    expect(TREE_PRESETS).toContain("sassafras");
    expect(TREE_PRESETS).toContain("europeanLarch");
    expect(TREE_PRESETS).toContain("hillCherry");
  });

  it("getActiveTreePresets default matches the same TREE_PRESETS array", () => {
    setActiveTreePresets(TREE_PRESETS);
    expect(getActiveTreePresets()).toEqual(TREE_PRESETS);
  });
});

describe("Host union pattern", () => {
  it("supports unioning treePresets across multiple packs", () => {
    const hyperia = ["quakingAspen", "blackOak"];
    const arctic = ["arcticPine"];
    const tropical = ["tropicalPalm"];
    const union = Array.from(new Set([...hyperia, ...arctic, ...tropical]));
    setActiveTreePresets(union);
    expect(getActiveTreePresets()).toEqual([
      "quakingAspen",
      "blackOak",
      "arcticPine",
      "tropicalPalm",
    ]);
  });

  it("dedups duplicates across packs (Set-based union)", () => {
    const hyperia = ["quakingAspen", "blackOak"];
    const homebrew = ["blackOak", "weepingWillow"]; // duplicate
    const union = Array.from(new Set([...hyperia, ...homebrew]));
    setActiveTreePresets(union);
    expect(getActiveTreePresets()).toEqual([
      "quakingAspen",
      "blackOak",
      "weepingWillow",
    ]);
  });
});
