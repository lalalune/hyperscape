import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/content-pack-volcanic-v1", () => {
  it("parses through ContentPackManifestSchema with expected identity", () => {
    expect(manifest.id).toBe("@hyperforge/content-pack-volcanic-v1");
    expect(manifest.name).toBe("Volcanic");
    expect(manifest.packVersion).toBe("1.0.0");
    expect(manifest.tags).toContain("content-pack");
    expect(manifest.tags).toContain("volcanic");
  });

  it("ships 5 volcanic biomes (lava-field / ash-plain / basalt-peak / sulfur-pool / obsidian-flow)", () => {
    expect(manifest.biomes.map((b) => b.id)).toEqual([
      "lava_field",
      "ash_plain",
      "basalt_peak",
      "sulfur_pool",
      "obsidian_flow",
    ]);
  });
});
