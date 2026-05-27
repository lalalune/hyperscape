import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/content-pack-desert-v1", () => {
  it("parses through ContentPackManifestSchema with expected identity", () => {
    expect(manifest.id).toBe("@hyperforge/content-pack-desert-v1");
    expect(manifest.name).toBe("Desert");
    expect(manifest.packVersion).toBe("1.0.0");
    expect(manifest.tags).toContain("content-pack");
    expect(manifest.tags).toContain("desert");
  });

  it("ships 5 desert biomes (sand-dune / mesa / salt-flat / oasis / badlands)", () => {
    expect(manifest.biomes.map((b) => b.id)).toEqual([
      "sand_dune",
      "mesa",
      "salt_flat",
      "oasis",
      "badlands",
    ]);
  });
});
