import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/content-pack-tropical-v1", () => {
  it("parses through ContentPackManifestSchema with expected identity", () => {
    expect(manifest.id).toBe("@hyperforge/content-pack-tropical-v1");
    expect(manifest.name).toBe("Tropical");
    expect(manifest.packVersion).toBe("1.0.0");
    expect(manifest.tags).toContain("content-pack");
    expect(manifest.tags).toContain("tropical");
  });

  it("ships 5 tropical biomes (beach / jungle / mangrove / palm-grove / lagoon)", () => {
    expect(manifest.biomes.map((b) => b.id)).toEqual([
      "tropical_beach",
      "jungle",
      "mangrove",
      "palm_grove",
      "lagoon",
    ]);
  });
});
