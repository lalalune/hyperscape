/**
 * Manifest parse + identity tests for
 * `@hyperforge/content-pack-hyperia-v1`.
 *
 * Locks the package's manifest gate: any future change to
 * `pack.json` runs through `ContentPackManifestSchema` at module
 * load and re-passes the assertions below.
 */

import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/content-pack-hyperia-v1", () => {
  it("ships a pack.json that parses through ContentPackManifestSchema", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.id).toBe("@hyperforge/content-pack-hyperia-v1");
    expect(manifest.name).toBe("Hyperia");
    expect(manifest.author.name).toBe("Hyperforge");
    expect(manifest.license).toBe("GPL-3.0");
    expect(manifest.packVersion).toBe("1.0.0");
  });

  it("declares the content-pack tag + hyperia/fantasy theme tags", () => {
    expect(manifest.tags).toContain("content-pack");
    expect(manifest.tags).toContain("hyperia");
    expect(manifest.tags).toContain("fantasy");
  });

  it("ships the 3 canonical Hyperia biomes (tundra, forest, canyon)", () => {
    const ids = manifest.biomes.map((b) => b.id);
    expect(ids).toEqual(["tundra", "forest", "canyon"]);
  });

  it("biome shapes match BiomeContributionSchema fully", () => {
    for (const b of manifest.biomes) {
      expect(typeof b.id).toBe("string");
      expect(typeof b.name).toBe("string");
      expect(typeof b.color).toBe("number");
      expect(b.color).toBeGreaterThan(0);
      expect(b.color).toBeLessThanOrEqual(0xffffff);
      expect(Array.isArray(b.heightRange)).toBe(true);
      expect(b.heightRange.length).toBe(2);
      expect(typeof b.maxSlope).toBe("number");
    }
  });
});
