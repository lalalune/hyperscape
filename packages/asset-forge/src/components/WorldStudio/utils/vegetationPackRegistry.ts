/**
 * Vegetation pack registry — runtime accumulator for species
 * and density rules surfaced from installed
 * `VegetationPackManifest`s (`PLAN_PACK_TYPES.md` Phase 3).
 *
 * Mirrors `pluginBiomeRegistry`'s shape: a project-loader
 * helper fetches the project's installed vegetation packs,
 * extracts each manifest's `species[]` + `densityRules[]`,
 * and registers them here. Consumers (the studio's vegetation
 * painter, future procgen consumers) read through the
 * `getActive*` helpers.
 *
 * Phase 3 first cut intentionally lands the registry alone —
 * the procgen scatterer still reads from
 * `procgen/src/params/presets.ts` (18 hardcoded species).
 * Replacing that constant with a registry walk is the
 * substantive consumer flip; this module is the data
 * destination once that migration runs.
 *
 * Composability: multiple vegetation packs compose by id-merge.
 * Two packs declaring the same species id collide; last-pack-
 * wins (mirrors `pluginBiomeRegistry`). Authoring tooling
 * surfaces the conflict in the Plugin / Pack Browser.
 */

import type {
  VegetationSpecies,
  VegetationDensityRule,
} from "@hyperforge/manifest-schema";

/**
 * Currently registered species, keyed by id. A second
 * registration with the same id overwrites — last-pack-wins.
 */
const species = new Map<string, VegetationSpecies>();

/**
 * Currently registered density rules, keyed by `id` from the
 * rule (NOT by biome — multiple rules can target the same
 * biome with different categories). Last-pack-wins on rule
 * id collision.
 */
const densityRules = new Map<string, VegetationDensityRule>();

/**
 * Set the active project's vegetation pack content. Replaces
 * the prior set entirely (idempotent across project switches).
 * Pass empty arrays to clear.
 *
 * Atomic: clears + repopulates both maps in one call so
 * consumers never observe a partially-applied state mid-swap.
 */
export function setVegetationPackContent(input: {
  species: ReadonlyArray<VegetationSpecies>;
  densityRules: ReadonlyArray<VegetationDensityRule>;
}): void {
  species.clear();
  densityRules.clear();
  for (const s of input.species) {
    species.set(s.id, s);
  }
  for (const r of input.densityRules) {
    densityRules.set(r.id, r);
  }
}

/**
 * Read the active species map, keyed by species id. Includes
 * every species contributed by every installed vegetation pack.
 * Returns the live map reference — callers MUST treat it as
 * read-only.
 */
export function getActiveVegetationSpecies(): ReadonlyMap<
  string,
  VegetationSpecies
> {
  return species;
}

/**
 * Read the active density rules, keyed by rule id. Returns
 * the live map reference — callers MUST treat it as read-only.
 */
export function getActiveVegetationDensityRules(): ReadonlyMap<
  string,
  VegetationDensityRule
> {
  return densityRules;
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
  for (const r of densityRules.values()) {
    if (r.biomeId === biomeId) out.push(r);
  }
  return out;
}

/** Test-only: clear both maps between unit tests. */
export function _clearVegetationPackContent(): void {
  species.clear();
  densityRules.clear();
}
