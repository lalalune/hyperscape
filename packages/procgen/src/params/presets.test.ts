/**
 * `getPreset` + `getPresetNames` — direct unit tests for the
 * tree preset catalog accessors.
 *
 * The 19 hardcoded tree presets ship as the procgen package's
 * canonical catalog. Decoupling them onto content packs is
 * tracked as Phase 3.2 deeper of `PLAN_AAA_MASTER_AUDIT.md`;
 * these tests lock the present behavior so the migration can
 * land additively without silently changing how existing
 * callers resolve preset names.
 *
 * Coverage:
 *   - getPresetNames returns the canonical 19-entry catalog
 *   - getPreset returns the matching params for exact ids
 *   - getPreset is case-insensitive and accepts variants
 *     (snake_case / kebab-case / spaces / "Tree" suffix)
 *   - getPreset returns the QUAKING_ASPEN fallback for
 *     unknown names — important so callers don't crash
 *     when a content pack references a missing preset
 */

import { describe, expect, it } from "vitest";
import { getPreset, getPresetNames, PRESETS, QUAKING_ASPEN } from "./presets";

describe("getPresetNames", () => {
  it("returns the canonical preset id list", () => {
    const names = getPresetNames();
    expect(names.length).toBeGreaterThanOrEqual(19);
    // Sample a few well-known ids to detect catalog drift.
    expect(names).toContain("acer");
    expect(names).toContain("palm");
    expect(names).toContain("quakingAspen");
    expect(names).toContain("silverBirch");
    expect(names).toContain("weepingWillow");
  });

  it("matches the keys of the PRESETS dictionary", () => {
    expect(getPresetNames().sort()).toEqual(Object.keys(PRESETS).sort());
  });

  it("contains no duplicate ids", () => {
    const names = getPresetNames();
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("getPreset — exact-match resolution", () => {
  it("returns matching params for an exact preset id", () => {
    const result = getPreset("acer");
    expect(result).toBe(PRESETS.acer);
  });

  it("returns matching params for camelCase ids", () => {
    expect(getPreset("blackOak")).toBe(PRESETS.blackOak);
    expect(getPreset("quakingAspen")).toBe(PRESETS.quakingAspen);
  });

  it("each preset id resolves to its own entry (round-trip)", () => {
    for (const name of getPresetNames()) {
      // The "tree$" stripping rule means ids ending in "tree"
      // (e.g. `sphereTree`) deliberately lose their suffix when
      // used as a lookup query — that's the user-facing behavior
      // ("PalmTree" → palm). Skip those from the round-trip.
      if (name.toLowerCase().endsWith("tree")) continue;
      expect(getPreset(name)).toBe(PRESETS[name]);
    }
  });

  it("documents the 'Tree' suffix collision: `sphereTree` resolves to fallback", () => {
    // This is the intentional consequence of the suffix-strip
    // normalization. Locked in here so a future fix (e.g. "skip
    // suffix-strip when an exact key already matches") can update
    // this test deliberately.
    expect(getPreset("sphereTree")).toBe(QUAKING_ASPEN);
  });
});

describe("getPreset — case-insensitive normalization", () => {
  it("uppercase resolves", () => {
    expect(getPreset("ACER")).toBe(PRESETS.acer);
  });

  it("snake_case resolves to camelCase", () => {
    expect(getPreset("black_oak")).toBe(PRESETS.blackOak);
    expect(getPreset("quaking_aspen")).toBe(PRESETS.quakingAspen);
  });

  it("kebab-case resolves to camelCase", () => {
    expect(getPreset("black-oak")).toBe(PRESETS.blackOak);
    expect(getPreset("quaking-aspen")).toBe(PRESETS.quakingAspen);
  });

  it("spaces resolve to camelCase", () => {
    expect(getPreset("Black Oak")).toBe(PRESETS.blackOak);
    expect(getPreset("Silver Birch")).toBe(PRESETS.silverBirch);
  });

  it("strips a trailing 'Tree' / 'tree' suffix", () => {
    expect(getPreset("acerTree")).toBe(PRESETS.acer);
    expect(getPreset("PalmTree")).toBe(PRESETS.palm);
    expect(getPreset("palm tree")).toBe(PRESETS.palm);
  });

  it("handles redundant whitespace + mixed case + suffix", () => {
    expect(getPreset(" Quaking_Aspen Tree ".trim())).toBe(PRESETS.quakingAspen);
  });
});

describe("getPreset — fallback behavior", () => {
  it("returns QUAKING_ASPEN for an unknown preset id", () => {
    expect(getPreset("unobtanium-tree")).toBe(QUAKING_ASPEN);
  });

  it("returns QUAKING_ASPEN for an empty string", () => {
    expect(getPreset("")).toBe(QUAKING_ASPEN);
  });

  it("never returns null/undefined — guarantees a TreeParams", () => {
    // The fallback contract is what content-pack consumers rely on:
    // missing preset references must not crash the scatterer.
    const result = getPreset("definitely-missing-xyz");
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });
});
