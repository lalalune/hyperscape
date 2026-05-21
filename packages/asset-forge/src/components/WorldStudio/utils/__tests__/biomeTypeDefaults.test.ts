/**
 * biomeTypeDefaults — biome-type → defaults lookup tests.
 *
 * Pins the 9 known biome types + the fallback-to-plains
 * behavior. A future biome rename (e.g. tundra → arctic_plain)
 * would silently route every previously-tundra biome to plains
 * defaults via the fallback; this test catches the rename.
 */

import { describe, expect, it } from "vitest";

import { getBiomeTypeDefaults } from "../biomeTypeDefaults";

const KNOWN_TYPES = [
  "plains",
  "forest",
  "valley",
  "mountains",
  "tundra",
  "desert",
  "lakes",
  "swamp",
  "canyon",
] as const;

describe("getBiomeTypeDefaults — known types", () => {
  it.each(KNOWN_TYPES)("returns a populated defaults object for %s", (type) => {
    const d = getBiomeTypeDefaults(type);
    expect(d).toBeDefined();
    expect(d.name).toBeDefined();
    expect(d.name.length).toBeGreaterThan(0);
    expect(typeof d.color).toBe("number");
    expect(typeof d.difficulty).toBe("number");
    expect(Array.isArray(d.resources)).toBe(true);
    expect(Array.isArray(d.mobs)).toBe(true);
  });

  it("each known type returns a DIFFERENT name (no copy-paste collapse)", () => {
    const names = KNOWN_TYPES.map((t) => getBiomeTypeDefaults(t).name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("each known type ships a non-default terrain string", () => {
    for (const t of KNOWN_TYPES) {
      expect(getBiomeTypeDefaults(t).terrain.length).toBeGreaterThan(0);
    }
  });
});

describe("getBiomeTypeDefaults — fallback behavior", () => {
  it("returns the plains defaults for an unknown type", () => {
    const plains = getBiomeTypeDefaults("plains");
    const unknown = getBiomeTypeDefaults("not-a-real-biome");
    expect(unknown).toBe(plains);
  });

  it("falls back for empty / nonsense input strings", () => {
    const plains = getBiomeTypeDefaults("plains");
    expect(getBiomeTypeDefaults("")).toBe(plains);
    expect(getBiomeTypeDefaults("undefined")).toBe(plains);
    expect(getBiomeTypeDefaults("null")).toBe(plains);
  });

  it("fallback is structurally complete — has every field defined", () => {
    const out = getBiomeTypeDefaults("totally-unknown");
    // All BiomeTypeDefaults fields must be present so the studio's
    // properties panel doesn't render undefined.
    expect(out.name).toBeDefined();
    expect(out.description).toBeDefined();
    expect(out.color).toBeDefined();
    expect(out.terrain).toBeDefined();
    expect(out.difficulty).toBeDefined();
    expect(out.resources).toBeDefined();
    expect(out.mobs).toBeDefined();
    expect(out.vegetation).toBeDefined();
  });
});

describe("getBiomeTypeDefaults — content checks", () => {
  it("tundra description mentions cold-climate keywords", () => {
    const desc = getBiomeTypeDefaults("tundra").description.toLowerCase();
    // At least one cold-climate keyword — pins the theme.
    expect(/ice|snow|frozen|cold|arctic|tundra/.test(desc)).toBe(true);
  });

  it("desert description mentions warm-climate keywords", () => {
    const desc = getBiomeTypeDefaults("desert").description.toLowerCase();
    expect(/desert|sand|hot|arid|sun|dune|dry/.test(desc)).toBe(true);
  });

  it("difficulty values are non-negative integers", () => {
    for (const t of KNOWN_TYPES) {
      const d = getBiomeTypeDefaults(t).difficulty;
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });
});
