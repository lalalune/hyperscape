import { describe, expect, it } from "vitest";
import { manifest } from "../index.js";

describe("@hyperforge/content-pack-wetland-v1", () => {
  it("parses through ContentPackManifestSchema with expected identity", () => {
    expect(manifest.id).toBe("@hyperforge/content-pack-wetland-v1");
    expect(manifest.name).toBe("Wetland");
    expect(manifest.packVersion).toBe("1.0.0");
    expect(manifest.tags).toContain("content-pack");
    expect(manifest.tags).toContain("wetland");
  });

  it("ships 5 wetland biomes (marsh / swamp / bog / fen / river-delta)", () => {
    expect(manifest.biomes.map((b) => b.id)).toEqual([
      "marsh",
      "swamp",
      "bog",
      "fen",
      "river_delta",
    ]);
  });
});
