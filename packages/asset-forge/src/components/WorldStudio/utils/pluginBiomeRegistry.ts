/**
 * Plugin biome registry — runtime accumulator for biome
 * contributions surfaced from `plugin.json` `contributions.biomes`.
 *
 * R3.P3 of `PLAN_HYPERIA_DECOUPLING.md`. The project-loader
 * fetches `/api/plugins/installed`, extracts `contributions.biomes`,
 * and registers them here; consumers read via
 * `getActiveBiomeDefinitions()` to merge with engine-default
 * biomes.
 *
 * Phase B of `PLAN_AAA_CONTENT_SYSTEM.md` will replace this
 * module with a unified `contentRegistry` that absorbs biome
 * contributions from both plugins AND content packs (along
 * with terrain shaders, water shaders, vegetation species,
 * etc. as separate sections). Until then the file remains
 * plugin-only — the biome-pack extension that briefly lived
 * here was reverted alongside the rest of the orphaned
 * `PLAN_PACK_TYPES` Phase 3 plumbing.
 */

import type { BiomeDefinition } from "@hyperforge/procgen/terrain";

/**
 * R3.P3 contribution shape — the JSON form produced by
 * `plugin.json` `contributions.biomes[]`. Distinct from
 * `BiomeDefinition` (the procgen runtime type) only in default
 * resolution: this module bridges the two by applying defaults
 * when registering.
 */
export interface PluginBiomeContribution {
  id: string;
  name: string;
  color: number;
  terrainMultiplier?: number;
  difficultyLevel?: number;
  heightRange: readonly [number, number];
  maxSlope?: number;
  resourceDensity?: number;
}

/**
 * Currently registered plugin biomes, keyed by id. A second
 * registration with the same id overwrites — last-plugin-wins.
 * That's fine in practice; conflicting biome ids across
 * plugins are an authoring bug surfaced via the editor's
 * Plugin Browser.
 */
const registered = new Map<string, BiomeDefinition>();

/**
 * Set the active project's plugin biomes. Replaces the prior
 * set entirely (idempotent across project switches). Pass an
 * empty array to clear.
 */
export function setPluginBiomes(
  contributions: ReadonlyArray<PluginBiomeContribution>,
): void {
  registered.clear();
  for (const c of contributions) {
    registered.set(c.id, contributionToDefinition(c));
  }
}

/**
 * Read the merged biome map: engine-default biomes (passed in
 * by the caller — typically `GAME_BIOME_DEFINITIONS` from
 * `GameTerrainAdapter`) overlaid with active plugin
 * contributions. Plugin contributions win on id collision so a
 * plugin can override a default biome's appearance.
 */
export function getActiveBiomeDefinitions(
  engineDefaults: Record<string, BiomeDefinition>,
): Record<string, BiomeDefinition> {
  if (registered.size === 0) return engineDefaults;
  const merged: Record<string, BiomeDefinition> = { ...engineDefaults };
  for (const [id, def] of registered) {
    merged[id] = def;
  }
  return merged;
}

/** Test-only: clear the registry between unit tests. */
export function _clearPluginBiomes(): void {
  registered.clear();
}

function contributionToDefinition(c: PluginBiomeContribution): BiomeDefinition {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    terrainMultiplier: c.terrainMultiplier ?? 1,
    difficultyLevel: c.difficultyLevel ?? 0,
    heightRange: [c.heightRange[0], c.heightRange[1]],
    maxSlope: c.maxSlope ?? 1.5,
    resourceDensity: c.resourceDensity ?? 1,
  };
}
