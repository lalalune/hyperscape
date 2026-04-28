import { describe, expect, it } from "vitest";
import { World } from "../World";

describe("World.resolveURL", () => {
  it("rewrites missing packaged tree families to existing CDN assets", () => {
    const world = new World();
    world.assetsUrl = "https://cdn.example.com/game-assets";

    expect(
      world.resolveURL("asset://models/trees/general/general_05.glb"),
    ).toBe("https://cdn.example.com/game-assets/models/trees/oak_01.glb");
    expect(
      world.resolveURL("asset://models/trees/eucalyptus/eucalyptus_04.glb"),
    ).toBe("https://cdn.example.com/game-assets/models/trees/oak_04.glb");
    expect(
      world.resolveURL("asset://models/trees/oak/oak_02.glb"),
    ).toBe("https://cdn.example.com/game-assets/models/trees/oak_02.glb");
    expect(
      world.resolveURL("asset://models/trees/pine/pine_05.glb"),
    ).toBe("https://cdn.example.com/game-assets/models/trees/pine_02.glb");
    expect(
      world.resolveURL("asset://models/trees/magic/magic_02_lod2.glb"),
    ).toBe(
      "https://cdn.example.com/game-assets/models/trees/oak_04_lod2.glb",
    );
  });

  it("rewrites missing packaged tree families to existing local assets", () => {
    const world = new World();
    world.assetsDir = "/tmp/hyperscape-assets";

    expect(
      world.resolveURL(
        "asset://models/trees/mahogany/mahogany_02.glb?cache=1",
        true,
      ),
    ).toBe("/tmp/hyperscape-assets/models/trees/oak_03.glb?cache=1");
    expect(
      world.resolveURL(
        "asset://models/trees/pineDead/pineDead_03.glb#preview",
        true,
      ),
    ).toBe("/tmp/hyperscape-assets/models/trees/dead_03.glb#preview");
    expect(
      world.resolveURL("asset://models/trees/maple/maple_04.glb", true),
    ).toBe("/tmp/hyperscape-assets/models/trees/maple_01.glb");
  });

  it("leaves valid packaged asset paths untouched", () => {
    const world = new World();
    world.assetsUrl = "https://cdn.example.com/game-assets";

    expect(world.resolveURL("asset://models/trees/oak_03.glb")).toBe(
      "https://cdn.example.com/game-assets/models/trees/oak_03.glb",
    );
  });

  it("normalizes avatar LOD URLs before resolving fetch paths", () => {
    const world = new World();
    world.assetsUrl = "https://cdn.example.com/game-assets";

    expect(
      world.resolveURL("asset://avatars/avatar-male-01_lod1.vrm"),
    ).toBe("https://cdn.example.com/game-assets/avatars/avatar-male-01.vrm");
    expect(
      world.resolveURL("avatars/avatar-female-02_lod2.vrm?cache=1"),
    ).toBe(
      "https://cdn.example.com/game-assets/avatars/avatar-female-02.vrm?cache=1",
    );
    expect(world.resolveURL("avatar-male-01_lod2.vrm#preview")).toBe(
      "https://cdn.example.com/game-assets/avatars/avatar-male-01.vrm#preview",
    );
    expect(
      world.resolveURL(
        "https://assets.example.com/avatars/avatar-female-01_lod1.vrm",
      ),
    ).toBe("https://assets.example.com/avatars/avatar-female-01.vrm");
  });
});
