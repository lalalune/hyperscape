/**
 * Biome registry — runtime accumulator for biome contributions
 * from two sources: gameplay plugins (`plugin.json`
 * `contributions.biomes`) and standalone biome packs
 * (`PLAN_PACK_TYPES.md` Phase 3 — `BiomePackManifestSchema`).
 *
 * Originally R3.P3 of `PLAN_HYPERIA_DECOUPLING.md` (plugin-only).
 * Phase 3 of `PLAN_PACK_TYPES.md` adds the parallel biome-pack
 * source — a project can install a biome pack to get the
 * visual + zoning theme without installing the gameplay plugin
 * that originally owned those biomes.
 *
 * Merge precedence (low → high):
 *   1. engine defaults — passed in by the caller; baseline
 *      Hyperia tundra/forest/canyon for blank projects so the
 *      biome painter is never empty.
 *   2. biome pack contributions — visual themes installed
 *      independently of plugins.
 *   3. plugin contributions — gameplay-driving biomes; win on
 *      id collision because their IDs feed mob-spawn rules,
 *      combat tuning, etc.
 *
 * The file name + the legacy `setPluginBiomes` API are kept for
 * one cut to avoid churning the four importers. A follow-up
 * rename to `biomeRegistry.ts` is queued in `PLAN_PACK_TYPES.md`
 * Phase 3.
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
 * Currently registered biome-pack biomes, keyed by id. A
 * second registration with the same id overwrites —
 * last-pack-wins, mirroring the plugin map's semantics. Lower
 * precedence than `registered` (plugin biomes); the merge in
 * `getActiveBiomeDefinitions` lays plugins over packs.
 */
const biomePackBiomes = new Map<string, BiomeDefinition>();

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
 * Set the active project's biome-pack biomes. Replaces the
 * prior set entirely (idempotent across project switches).
 * Pass an empty array to clear. Same contribution shape as
 * plugin biomes — a `BiomePackEntry` is structurally a
 * `PluginBiomeContribution`.
 */
export function setBiomePackBiomes(
  contributions: ReadonlyArray<PluginBiomeContribution>,
): void {
  biomePackBiomes.clear();
  for (const c of contributions) {
    biomePackBiomes.set(c.id, contributionToDefinition(c));
  }
}

/**
 * Read the merged biome map: engine defaults < biome pack
 * contributions < plugin contributions (highest precedence).
 *
 *   - Engine defaults provide the baseline (typically
 *     `GAME_BIOME_DEFINITIONS` passed in by the caller — Hyperia
 *     tundra/forest/canyon while we're still mid-decoupling).
 *   - Biome pack contributions overlay defaults; a project that
 *     installed `@hyperforge/biome-pack-tropical-v1` sees
 *     `beach`, `jungle`, `mangrove` regardless of which gameplay
 *     plugin is active.
 *   - Plugin contributions overlay both; gameplay-driving biomes
 *     win on id collision because their IDs feed mob-spawn rules
 *     and combat tuning. A plugin's `desert` overrides a biome
 *     pack's `desert` so the gameplay rules stay coherent.
 */
export function getActiveBiomeDefinitions(
  engineDefaults: Record<string, BiomeDefinition>,
): Record<string, BiomeDefinition> {
  if (registered.size === 0 && biomePackBiomes.size === 0) {
    return engineDefaults;
  }
  const merged: Record<string, BiomeDefinition> = { ...engineDefaults };
  for (const [id, def] of biomePackBiomes) {
    merged[id] = def;
  }
  for (const [id, def] of registered) {
    merged[id] = def;
  }
  return merged;
}

/** Test-only: clear the plugin-biome map between unit tests. */
export function _clearPluginBiomes(): void {
  registered.clear();
}

/** Test-only: clear the biome-pack-biome map between unit tests. */
export function _clearBiomePackBiomes(): void {
  biomePackBiomes.clear();
}

/** Test-only: clear both maps between unit tests. */
export function _clearAllBiomes(): void {
  registered.clear();
  biomePackBiomes.clear();
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
