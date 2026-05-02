/**
 * Content registry — single runtime accumulator for content
 * contributions from two sources:
 *
 *   1. Gameplay plugins (`plugin.json` `contributions.biomes`)
 *   2. Installed content packs (`ContentPackManifest` sections)
 *
 * Phase B of `PLAN_AAA_CONTENT_SYSTEM.md`. Replaces the
 * standalone `pluginBiomeRegistry` and the briefly-shipped
 * `vegetationPackRegistry` with one module that holds every
 * content-pack-contributable section. Same merge semantics as
 * the old plugin biome registry — last-source-wins on intra-
 * source id collision; cross-source precedence pinned by the
 * `getActive*` reader.
 *
 * Section catalog (Phase A schema):
 *
 *   - biomes                  — id/name/color/zoning data
 *   - terrainShaders          — recipe + params (renderer-resolved)
 *   - terrainHeightmapPresets — radius / edge noise / octaves
 *   - terrainNoiseFunctions   — fbm/ridged/voronoi variants
 *   - waterShaders            — recipe + params
 *   - waterAnimations         — wave amplitude / scroll speed
 *   - vegetationSpecies       — model ref + scale + slope
 *   - vegetationDensityRules  — per-biome density / clustering
 *
 * Plugin contributions today only feed `biomes` (plugin.json's
 * `contributions.biomes[]`). Future cuts may extend plugins to
 * contribute terrain/water/vegetation too — when that lands the
 * `setPlugin*` setters multiply, mirroring `setPluginBiomes`.
 */

import type { BiomeDefinition } from "@hyperforge/procgen/terrain";
import type {
  BiomeContribution,
  TerrainShaderRecipe,
  TerrainHeightmapPreset,
  TerrainNoiseFunction,
  WaterShaderRecipe,
  WaterAnimationProfile,
  VegetationSpecies,
  VegetationDensityRule,
} from "@hyperforge/manifest-schema";

/**
 * Plugin biome contribution shape — historically defined here
 * with optional fields (raw JSON shape from plugin.json before
 * Zod parsing). Re-exported so existing callers don't churn.
 * Structurally compatible with `BiomeContribution` from
 * manifest-schema after default resolution.
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

// ────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────

/**
 * Plugin-contributed biomes. Higher precedence than content
 * pack biomes — gameplay rules feed off these IDs (mob spawns,
 * combat tuning), so they win on id collision.
 */
const pluginBiomes = new Map<string, BiomeDefinition>();

/** Content-pack-contributed biomes. Lower precedence than plugin. */
const contentPackBiomes = new Map<string, BiomeDefinition>();

// Terrain sections — content-pack-only today.
const contentPackTerrainShaders = new Map<string, TerrainShaderRecipe>();
const contentPackTerrainHeightmapPresets = new Map<
  string,
  TerrainHeightmapPreset
>();
const contentPackTerrainNoiseFunctions = new Map<
  string,
  TerrainNoiseFunction
>();

// Water sections — content-pack-only today.
const contentPackWaterShaders = new Map<string, WaterShaderRecipe>();
const contentPackWaterAnimations = new Map<string, WaterAnimationProfile>();

// Vegetation sections — content-pack-only today.
const contentPackVegetationSpecies = new Map<string, VegetationSpecies>();
const contentPackVegetationDensityRules = new Map<
  string,
  VegetationDensityRule
>();

// ────────────────────────────────────────────────────────────
// Plugin-source setters
// ────────────────────────────────────────────────────────────

/**
 * Set the active project's plugin biomes. Replaces the prior
 * set entirely (idempotent across project switches). Pass an
 * empty array to clear.
 */
export function setPluginBiomes(
  contributions: ReadonlyArray<PluginBiomeContribution>,
): void {
  pluginBiomes.clear();
  for (const c of contributions) {
    pluginBiomes.set(c.id, contributionToDefinition(c));
  }
}

// ────────────────────────────────────────────────────────────
// Content-pack-source setter
// ────────────────────────────────────────────────────────────

/**
 * Atomically set every section the active project's installed
 * content packs contribute. The loader collects sections from
 * each installed pack, unions them per section, and calls this
 * once per project load. Sections omitted from the input keep
 * the previous map UNCHANGED — pass empty arrays explicitly to
 * clear specific sections.
 *
 * Authors typically call this with all sections at once (one
 * call per project switch). Tests / synthetic callers can pass
 * partial inputs to exercise individual sections.
 */
export interface ContentPackContentInput {
  biomes?: ReadonlyArray<BiomeContribution>;
  terrainShaders?: ReadonlyArray<TerrainShaderRecipe>;
  terrainHeightmapPresets?: ReadonlyArray<TerrainHeightmapPreset>;
  terrainNoiseFunctions?: ReadonlyArray<TerrainNoiseFunction>;
  waterShaders?: ReadonlyArray<WaterShaderRecipe>;
  waterAnimations?: ReadonlyArray<WaterAnimationProfile>;
  vegetationSpecies?: ReadonlyArray<VegetationSpecies>;
  vegetationDensityRules?: ReadonlyArray<VegetationDensityRule>;
}

export function setContentPackContent(input: ContentPackContentInput): void {
  if (input.biomes !== undefined) {
    contentPackBiomes.clear();
    for (const b of input.biomes) {
      contentPackBiomes.set(b.id, contributionToDefinition(b));
    }
  }
  if (input.terrainShaders !== undefined) {
    contentPackTerrainShaders.clear();
    for (const r of input.terrainShaders)
      contentPackTerrainShaders.set(r.id, r);
  }
  if (input.terrainHeightmapPresets !== undefined) {
    contentPackTerrainHeightmapPresets.clear();
    for (const p of input.terrainHeightmapPresets)
      contentPackTerrainHeightmapPresets.set(p.id, p);
  }
  if (input.terrainNoiseFunctions !== undefined) {
    contentPackTerrainNoiseFunctions.clear();
    for (const f of input.terrainNoiseFunctions)
      contentPackTerrainNoiseFunctions.set(f.id, f);
  }
  if (input.waterShaders !== undefined) {
    contentPackWaterShaders.clear();
    for (const r of input.waterShaders) contentPackWaterShaders.set(r.id, r);
  }
  if (input.waterAnimations !== undefined) {
    contentPackWaterAnimations.clear();
    for (const a of input.waterAnimations)
      contentPackWaterAnimations.set(a.id, a);
  }
  if (input.vegetationSpecies !== undefined) {
    contentPackVegetationSpecies.clear();
    for (const s of input.vegetationSpecies)
      contentPackVegetationSpecies.set(s.id, s);
  }
  if (input.vegetationDensityRules !== undefined) {
    contentPackVegetationDensityRules.clear();
    for (const r of input.vegetationDensityRules)
      contentPackVegetationDensityRules.set(r.id, r);
  }
}

// ────────────────────────────────────────────────────────────
// Readers
// ────────────────────────────────────────────────────────────

/**
 * Read the merged biome map: engine defaults < content pack
 * contributions < plugin contributions (highest precedence).
 *
 * Engine defaults provide the baseline (typically
 * `GAME_BIOME_DEFINITIONS` passed in by the caller — Hyperia's
 * tundra/forest/canyon while we're still mid-decoupling).
 * Content pack contributions overlay defaults; a project that
 * installs a tropical content pack sees beach/jungle/mangrove
 * regardless of which gameplay plugin is active. Plugin
 * contributions overlay both — gameplay-driving biomes win on
 * id collision so mob-spawn rules and combat tuning stay
 * coherent.
 */
export function getActiveBiomeDefinitions(
  engineDefaults: Record<string, BiomeDefinition>,
): Record<string, BiomeDefinition> {
  if (pluginBiomes.size === 0 && contentPackBiomes.size === 0) {
    return engineDefaults;
  }
  const merged: Record<string, BiomeDefinition> = { ...engineDefaults };
  for (const [id, def] of contentPackBiomes) merged[id] = def;
  for (const [id, def] of pluginBiomes) merged[id] = def;
  return merged;
}

export function getActiveTerrainShaders(): ReadonlyMap<
  string,
  TerrainShaderRecipe
> {
  return contentPackTerrainShaders;
}

export function getActiveTerrainHeightmapPresets(): ReadonlyMap<
  string,
  TerrainHeightmapPreset
> {
  return contentPackTerrainHeightmapPresets;
}

export function getActiveTerrainNoiseFunctions(): ReadonlyMap<
  string,
  TerrainNoiseFunction
> {
  return contentPackTerrainNoiseFunctions;
}

export function getActiveWaterShaders(): ReadonlyMap<
  string,
  WaterShaderRecipe
> {
  return contentPackWaterShaders;
}

export function getActiveWaterAnimations(): ReadonlyMap<
  string,
  WaterAnimationProfile
> {
  return contentPackWaterAnimations;
}

export function getActiveVegetationSpecies(): ReadonlyMap<
  string,
  VegetationSpecies
> {
  return contentPackVegetationSpecies;
}

export function getActiveVegetationDensityRules(): ReadonlyMap<
  string,
  VegetationDensityRule
> {
  return contentPackVegetationDensityRules;
}

/**
 * Convenience: filter density rules to those targeting a
 * specific biome id. Returns a freshly-allocated array; safe
 * to mutate.
 */
export function getDensityRulesForBiome(
  biomeId: string,
): VegetationDensityRule[] {
  const out: VegetationDensityRule[] = [];
  for (const r of contentPackVegetationDensityRules.values()) {
    if (r.biomeId === biomeId) out.push(r);
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────

/** Test-only: clear plugin biomes between tests. */
export function _clearPluginBiomes(): void {
  pluginBiomes.clear();
}

/** Test-only: clear every content-pack section between tests. */
export function _clearContentPackContent(): void {
  contentPackBiomes.clear();
  contentPackTerrainShaders.clear();
  contentPackTerrainHeightmapPresets.clear();
  contentPackTerrainNoiseFunctions.clear();
  contentPackWaterShaders.clear();
  contentPackWaterAnimations.clear();
  contentPackVegetationSpecies.clear();
  contentPackVegetationDensityRules.clear();
}

/** Test-only: clear every map between tests. */
export function _clearAll(): void {
  _clearPluginBiomes();
  _clearContentPackContent();
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

function contributionToDefinition(
  c: PluginBiomeContribution | BiomeContribution,
): BiomeDefinition {
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
