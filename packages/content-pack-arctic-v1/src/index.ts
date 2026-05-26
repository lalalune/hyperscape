/**
 * `@hyperforge/content-pack-arctic-v1` — public entry.
 *
 * Phase 3.3 of PLAN_AAA_UE5_PARITY established this package as
 * the canonical home for the Arctic content pack — frozen,
 * snowy, mountainous biomes plus glacier-shore terrain shaping
 * and evergreen + pine-dead vegetation rules.
 *
 * Today the manifest declares package identity + empty content
 * arrays. A follow-up cut migrates the existing inline
 * `BuiltinPack` literal in `asset-forge/server/builtins/
 * content-packs.ts` into this manifest's biomes /
 * terrainHeightmapPresets / vegetationDensityRules arrays, and
 * the asset-forge catalog imports the manifest from here
 * instead of inlining it.
 */

export { manifest } from "./manifest.js";
