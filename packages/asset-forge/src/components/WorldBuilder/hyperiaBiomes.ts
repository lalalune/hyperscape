/**
 * `HYPERIA_LIVE_GAME_BIOMES` — shared Hyperia-specific biome
 * definitions.
 *
 * Phase 3.4 dedup of `PLAN_AAA_MASTER_AUDIT.md`. Previously this
 * 3-biome constant was duplicated byte-for-byte across two
 * files:
 *   - `src/components/WorldBuilder/GameTerrainAdapter.ts` (client)
 *   - `server/services/GameWorldContext.ts` (server)
 *
 * Drift between the two would have silently desynced the
 * server's tile/tree/layout queries from the client's rendered
 * terrain. Single source of truth here; both callsites import.
 *
 * Phase D of `PLAN_AAA_CONTENT_SYSTEM.md` is the longer-term
 * migration — these definitions belong in the Hyperscape plugin
 * or content pack as `contributions.biomes`. Until that ships
 * end-to-end (the plugin currently contributes biomes, but the
 * engine's terrain pipeline doesn't yet read them for live
 * Hyperia-template world generation), this constant remains the
 * canonical fallback that the live-Hyperia codepath consumes.
 *
 * Both consumers are gated on Hyperia-template projects: this
 * data never reaches non-Hyperia (themed or shooter-demo) flows.
 */

import type { BiomeDefinition } from "@hyperforge/procgen/terrain";

export const HYPERIA_LIVE_GAME_BIOMES: Record<string, BiomeDefinition> = {
  tundra: {
    id: "tundra",
    name: "Tundra",
    color: 0xe8e4e0,
    terrainMultiplier: 1,
    difficultyLevel: 1,
    heightRange: [0.3, 0.8],
    maxSlope: 1.5,
    resourceDensity: 0.4,
  },
  forest: {
    id: "forest",
    name: "Forest",
    color: 0x388e3c,
    terrainMultiplier: 1,
    difficultyLevel: 0,
    heightRange: [0, 0.5],
    maxSlope: 0.8,
    resourceDensity: 1.0,
  },
  canyon: {
    id: "canyon",
    name: "Canyon",
    color: 0x8d6e63,
    terrainMultiplier: 1,
    difficultyLevel: 2,
    heightRange: [0.2, 1.0],
    maxSlope: 2.0,
    resourceDensity: 0.6,
  },
};
