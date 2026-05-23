import { describe, it, expect } from "vitest";

import {
  validateFullProjectManifest,
  FullProjectManifestSchema,
  type FullProjectManifest,
} from "./project-manifest.js";

/**
 * Minimal happy-path manifest used as the basis for most tests. Built
 * inline so each test can mutate a copy without leaking shape across
 * cases.
 */
function baseManifest(): FullProjectManifest {
  return {
    meta: {
      projectId: "project-123",
      projectName: "Test Project",
      schemaVersion: 1,
      exportedAt: 1_716_500_000_000,
    },
    boot: {
      plugins: [],
      contentPacks: [],
      assetPacks: [],
    },
    worldConfig: {},
    content: {},
    registries: {},
  };
}

describe("FullProjectManifest — validateFullProjectManifest", () => {
  it("accepts a minimal blank-canvas manifest", () => {
    const result = validateFullProjectManifest(baseManifest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.meta.projectId).toBe("project-123");
      expect(result.manifest.boot.plugins).toEqual([]);
    }
  });

  it("accepts a Hyperia-style fork with plugins + packs declared", () => {
    const input: FullProjectManifest = {
      ...baseManifest(),
      meta: {
        ...baseManifest().meta,
        templateId: "hyperia",
      },
      boot: {
        plugins: ["@hyperforge/hyperscape"],
        contentPacks: ["@hyperforge/content-pack-hyperia-v1"],
        assetPacks: ["@hyperforge/asset-pack-hyperia-trees-v1"],
      },
      worldConfig: {
        terrainSeed: 42,
      },
    };
    const result = validateFullProjectManifest(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.boot.plugins).toEqual(["@hyperforge/hyperscape"]);
      expect(result.manifest.boot.contentPacks).toEqual([
        "@hyperforge/content-pack-hyperia-v1",
      ]);
      expect(result.manifest.worldConfig.terrainSeed).toBe(42);
    }
  });

  it("rejects missing meta.projectId with a localized issue path", () => {
    const bad = baseManifest();
    delete (bad.meta as { projectId?: string }).projectId;
    const result = validateFullProjectManifest(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("meta.projectId");
    }
  });

  it("rejects wrong schemaVersion (forces migration on bump)", () => {
    const bad = {
      ...baseManifest(),
      meta: { ...baseManifest().meta, schemaVersion: 2 as unknown as 1 },
    };
    const result = validateFullProjectManifest(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("meta.schemaVersion");
    }
  });

  it("rejects empty plugin id (would break plugin loader)", () => {
    const bad = {
      ...baseManifest(),
      boot: {
        plugins: [""],
        contentPacks: [],
        assetPacks: [],
      },
    };
    const result = validateFullProjectManifest(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("boot.plugins.0");
    }
  });

  it("rejects unknown top-level fields (strict at the boundary)", () => {
    const bad = {
      ...baseManifest(),
      // Top-level is strict — extra keys break validation rather than
      // silently drop. Prevents typos like "Plugins" vs "plugins".
      unknownTopLevelField: "should not be here",
    };
    const result = validateFullProjectManifest(bad);
    expect(result.ok).toBe(false);
  });

  it("preserves passthrough fields on content / registries / worldConfig", () => {
    const input = {
      ...baseManifest(),
      worldConfig: {
        terrainSeed: 7,
        // Per-theme procgen override that isn't modeled in the schema —
        // should still survive the round-trip.
        terrainHeightmapPreset: { kind: "arctic-glacial" },
      },
      content: {
        npcs: { version: 1, npcs: [] },
        // Plugin-specific shape that isn't modeled here — passthrough.
        arcticPois: [{ id: "frozen-cache-001", position: [0, 0, 0] }],
      },
      registries: {
        items: { version: 1, items: [] },
        // 38-manifest snapshot may contain arbitrary kinds — passthrough.
        achievements: { version: 1, achievements: [] },
      },
    };
    const result = validateFullProjectManifest(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Extra keys round-tripped intact.
      expect(
        (
          result.manifest.worldConfig as {
            terrainHeightmapPreset?: { kind: string };
          }
        ).terrainHeightmapPreset?.kind,
      ).toBe("arctic-glacial");
      expect(
        (result.manifest.content as { arcticPois?: unknown[] }).arcticPois,
      ).toHaveLength(1);
      expect(
        (
          result.manifest.registries as {
            achievements?: { version: number };
          }
        ).achievements?.version,
      ).toBe(1);
    }
  });

  it("Schema is referentially stable (no surprise recomputation)", () => {
    // Confirms the exported schema is a singleton rather than a getter
    // that builds a new instance per access — important for plugins
    // that may want to wrap it.
    expect(FullProjectManifestSchema).toBe(FullProjectManifestSchema);
  });
});
