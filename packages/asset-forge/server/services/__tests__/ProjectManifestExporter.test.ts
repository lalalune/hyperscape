import { describe, it, expect } from "vitest";

import {
  validateFullProjectManifest,
  type Project,
} from "@hyperforge/manifest-schema";

import { exportProjectManifest } from "../ProjectManifestExporter";

/**
 * Pinned timestamp so test assertions don't drift with the wall clock.
 */
const FIXED_NOW = 1_716_500_000_000;
const fixedNow = () => FIXED_NOW;

/**
 * Minimal blank-canvas project. Drives the "empty project boots an
 * empty-shell world" case — the decoupling rule that says Hyperia is
 * NOT the default.
 */
function blankProject(): Project {
  return {
    id: "project-blank",
    name: "Untitled World",
    schemaVersion: 1,
    config: {
      // Procgen config is passthrough — runtime fills defaults for
      // missing fields.
    },
    plugins: [],
    assetPacks: [],
    worldContent: {},
  };
}

/**
 * Hyperia fork — what `forkProjectPack("hyperia")` produces.
 */
function hyperiaProject(): Project {
  return {
    id: "project-hyperia-fork",
    name: "My Hyperia Game",
    schemaVersion: 1,
    templateId: "hyperia",
    config: {
      terrain: { seed: 12345 },
      // Per-theme override that should round-trip via passthrough.
      terrainHeightmapPreset: { kind: "hyperia-canyon" },
    },
    plugins: ["@hyperforge/hyperscape"],
    // Project pack fork drops BOTH content packs and asset packs into
    // the same flat `assetPacks` array; the exporter must bucket them.
    assetPacks: [
      "@hyperforge/content-pack-hyperia-v1",
      "@hyperforge/asset-pack-hyperia-trees-v1",
    ],
    worldContent: {
      npcs: [],
      spawns: [],
      quests: [],
    },
  };
}

/**
 * Multi-pack arctic project — exercises the rename of
 * `worldContent.spawns` → `content.mobs` and the registry-overrides
 * path.
 */
function arcticProject(): Project {
  return {
    id: "project-arctic-fork",
    name: "Arctic Expedition",
    schemaVersion: 1,
    templateId: "arctic-survival",
    config: {
      terrain: { seed: 99 },
    },
    plugins: ["@hyperforge/plugin-arctic-survival"],
    assetPacks: [
      "@hyperforge/content-pack-arctic-v1",
      "@hyperforge/asset-pack-arctic-trees-v1",
      "@hyperforge/asset-pack-arctic-rocks-v1",
    ],
    worldContent: {
      npcs: [],
      spawns: [],
      quests: [],
    },
  };
}

describe("exportProjectManifest", () => {
  it("blank project → empty-shell manifest (Hyperia is NOT the default)", () => {
    const manifest = exportProjectManifest(blankProject(), undefined, {
      now: fixedNow,
    });

    expect(manifest.meta.projectId).toBe("project-blank");
    expect(manifest.meta.schemaVersion).toBe(1);
    expect(manifest.meta.exportedAt).toBe(FIXED_NOW);
    expect(manifest.meta.templateId).toBeUndefined();

    // Empty boot — runtime will ignore manifests and run terrain-only.
    expect(manifest.boot.plugins).toEqual([]);
    expect(manifest.boot.contentPacks).toEqual([]);
    expect(manifest.boot.assetPacks).toEqual([]);

    // No terrain seed when config doesn't declare one.
    expect(manifest.worldConfig.terrainSeed).toBeUndefined();

    // No content fields.
    expect(Object.keys(manifest.content)).toEqual([]);

    // No registry overrides without a manifestSnapshot.
    expect(Object.keys(manifest.registries)).toEqual([]);
  });

  it("Hyperia fork → plugins + content packs + asset packs bucketed correctly", () => {
    const manifest = exportProjectManifest(hyperiaProject(), undefined, {
      now: fixedNow,
    });

    expect(manifest.meta.templateId).toBe("hyperia");
    expect(manifest.boot.plugins).toEqual(["@hyperforge/hyperscape"]);
    // Content-pack id discriminated by `@hyperforge/content-pack-` prefix.
    expect(manifest.boot.contentPacks).toEqual([
      "@hyperforge/content-pack-hyperia-v1",
    ]);
    // Asset-pack id falls into the assetPacks bucket.
    expect(manifest.boot.assetPacks).toEqual([
      "@hyperforge/asset-pack-hyperia-trees-v1",
    ]);

    // Terrain seed hoisted to typed top-level field.
    expect(manifest.worldConfig.terrainSeed).toBe(12345);

    // Per-theme override survives passthrough.
    expect(
      (
        manifest.worldConfig as {
          terrainHeightmapPreset?: { kind: string };
        }
      ).terrainHeightmapPreset?.kind,
    ).toBe("hyperia-canyon");
  });

  it("arctic multi-pack project → multiple asset packs preserved", () => {
    const manifest = exportProjectManifest(arcticProject(), undefined, {
      now: fixedNow,
    });

    expect(manifest.boot.plugins).toEqual([
      "@hyperforge/plugin-arctic-survival",
    ]);
    expect(manifest.boot.contentPacks).toEqual([
      "@hyperforge/content-pack-arctic-v1",
    ]);
    expect(manifest.boot.assetPacks).toEqual([
      "@hyperforge/asset-pack-arctic-trees-v1",
      "@hyperforge/asset-pack-arctic-rocks-v1",
    ]);
  });

  it("renames worldContent.spawns to content.mobs (runtime contract)", () => {
    const project = hyperiaProject();
    project.worldContent = {
      spawns: [
        {
          id: "goblin-camp",
          mobTypeId: "goblin",
          position: [0, 0, 0],
          maxCount: 3,
          spawnRadius: 5,
        } as unknown as Project["worldContent"]["spawns"] extends
          | (infer U)[]
          | undefined
          ? U
          : never,
      ] as Project["worldContent"]["spawns"],
    };
    const manifest = exportProjectManifest(project, undefined, {
      now: fixedNow,
    });

    // `mobs` slot populated, `spawns` slot does not exist in the
    // runtime contract.
    const content = manifest.content as {
      mobs?: unknown[];
      spawns?: unknown[];
    };
    expect(content.mobs).toBeDefined();
    expect(content.mobs).toHaveLength(1);
    expect(content.spawns).toBeUndefined();
  });

  it("passes manifestSnapshot through to registries (38-manifest override)", () => {
    const snapshot = {
      items: { version: 1, items: [{ id: "iron-sword" }] },
      dialogue: { version: 1, trees: [] },
      // Plugin-contributed registry not modeled in the schema —
      // passthrough preserves it verbatim.
      achievements: { version: 1, achievements: [] },
    };
    const manifest = exportProjectManifest(blankProject(), snapshot, {
      now: fixedNow,
    });
    const registries = manifest.registries as Record<string, unknown>;
    expect(registries.items).toEqual(snapshot.items);
    expect(registries.dialogue).toEqual(snapshot.dialogue);
    expect(registries.achievements).toEqual(snapshot.achievements);
  });

  it("output round-trips through validateFullProjectManifest (acceptance contract)", () => {
    const manifest = exportProjectManifest(hyperiaProject(), undefined, {
      now: fixedNow,
    });
    const result = validateFullProjectManifest(manifest);
    expect(result.ok).toBe(true);
  });

  it("uses Date.now by default when no `now` option is supplied", () => {
    const before = Date.now();
    const manifest = exportProjectManifest(blankProject());
    const after = Date.now();
    expect(manifest.meta.exportedAt).toBeGreaterThanOrEqual(before);
    expect(manifest.meta.exportedAt).toBeLessThanOrEqual(after);
  });

  it("blank project output validates as a FullProjectManifest", () => {
    const manifest = exportProjectManifest(blankProject(), undefined, {
      now: fixedNow,
    });
    const result = validateFullProjectManifest(manifest);
    expect(result.ok).toBe(true);
  });

  it("non-Hyperia third-party plugin ids pass through unchanged", () => {
    const project: Project = {
      ...blankProject(),
      plugins: ["@some-org/awesome-plugin", "@other-org/another-plugin"],
      assetPacks: ["@third-party/content-pack-fantasy-v1"],
    };
    const manifest = exportProjectManifest(project, undefined, {
      now: fixedNow,
    });
    expect(manifest.boot.plugins).toEqual([
      "@some-org/awesome-plugin",
      "@other-org/another-plugin",
    ]);
    // Third-party content-pack-* prefix still buckets correctly because
    // the rule is the substring "@hyperforge/content-pack-"; third-party
    // ids fall into assetPacks. This is intentional: only first-party
    // content packs are treated as content; everything else is opaque
    // to the runtime's content-gate logic.
    expect(manifest.boot.assetPacks).toEqual([
      "@third-party/content-pack-fantasy-v1",
    ]);
    expect(manifest.boot.contentPacks).toEqual([]);
  });
});
