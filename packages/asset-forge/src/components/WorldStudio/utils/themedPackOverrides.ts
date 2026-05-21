/**
 * Themed content-pack override extraction.
 *
 * The agent's PROPOSE_TERRAIN_CONFIG handler (both in the
 * onboarding dialog and the in-studio companion) reads two
 * fields off the active themed content pack's manifest to
 * shape procgen output:
 *
 *   - `terrainHeightmapPresets[0].params` — config overrides
 *     that tune the heightmap (island shape, edge noise, octaves,
 *     etc.). The first preset wins; multiple presets per pack
 *     is rare but the schema supports it.
 *   - `vegetationByBiome` — per-biome species + density rules
 *     so e.g. the tropical pack scatters palms instead of pines.
 *
 * Both consumers walked the same manifest fields with byte-
 * identical extraction logic. This module owns the extraction;
 * callers focus on the merge.
 */

/**
 * Structural subset of `ContentPackManifest` that this module
 * reads. Keeping the shape local avoids importing the full
 * manifest type chain from `@hyperforge/manifest-schema`.
 */
export interface ThemedPackManifestLike {
  readonly terrainHeightmapPresets?: ReadonlyArray<{
    readonly id?: string;
    readonly params?: Record<string, unknown>;
  }>;
  readonly vegetationByBiome?: Record<string, Record<string, unknown>>;
}

/**
 * Overrides a themed content pack contributes to procgen.
 * Both fields are independent — a pack may ship one, both, or
 * neither.
 */
export interface ThemedPackOverrides {
  /** Heightmap preset params from the FIRST `terrainHeightmapPresets` entry. */
  readonly heightmapPresetParams: Record<string, unknown> | null;
  /** Per-biome vegetation overrides, or null if the pack doesn't ship one. */
  readonly vegetationByBiome: Record<string, Record<string, unknown>> | null;
  /**
   * `id` of the chosen heightmap preset (for logging only) — null
   * when no preset was extracted.
   */
  readonly heightmapPresetId: string | null;
}

/**
 * Extract the two procgen-shaping fields from a themed pack's
 * manifest. Returns nulls for missing/invalid fields so the
 * caller can short-circuit the merge.
 */
export function extractThemedPackOverrides(
  manifest: ThemedPackManifestLike | null | undefined,
): ThemedPackOverrides {
  if (!manifest) {
    return {
      heightmapPresetParams: null,
      vegetationByBiome: null,
      heightmapPresetId: null,
    };
  }
  const firstPreset = manifest.terrainHeightmapPresets?.[0];
  const heightmapPresetParams = firstPreset?.params ?? null;
  const heightmapPresetId = firstPreset?.id ?? null;
  const vegByBiomeRaw = manifest.vegetationByBiome;
  const vegetationByBiome =
    vegByBiomeRaw && typeof vegByBiomeRaw === "object" ? vegByBiomeRaw : null;
  return { heightmapPresetParams, vegetationByBiome, heightmapPresetId };
}
