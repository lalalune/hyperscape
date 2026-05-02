/**
 * React hooks bridging the `contentRegistry` to UI components.
 *
 * Phase F-prelude of `PLAN_AAA_CONTENT_SYSTEM.md`. Components
 * that render biome / terrain shader / water shader / vegetation
 * lists subscribe via these hooks instead of hardcoding names.
 * The hook layer uses `useSyncExternalStore` over the registry's
 * epoch counter so components re-render when content packs are
 * registered (e.g. on project switch).
 *
 * Usage:
 *
 *   const biomes = useActiveBiomes();
 *   const ids = Object.keys(biomes);
 *   if (ids.length === 0) {
 *     return <EmptyState>Install a content pack to add biomes.</EmptyState>;
 *   }
 *   return <BiomeTabs biomes={biomes} />;
 */

import { useMemo, useSyncExternalStore } from "react";
import type { BiomeDefinition } from "@hyperforge/procgen/terrain";
import {
  getActiveBiomeDefinitions,
  getActiveTerrainShaders,
  getActiveWaterShaders,
  getActiveVegetationSpecies,
  getContentRegistryEpoch,
  subscribeContentRegistry,
} from "../utils/contentRegistry";

/**
 * Empty engine fallback — used by every UI hook below as the
 * default base for `getActiveBiomeDefinitions`. Engine ships
 * zero biomes per `PLAN_AAA_CONTENT_SYSTEM.md` Phase C1; the
 * registry overlays plugin / content pack contributions.
 *
 * Hyperia-specific surfaces that need the
 * `HYPERIA_LIVE_GAME_BIOMES` baseline pass a non-empty
 * `engineDefaults` to `useActiveBiomes` directly.
 */
const EMPTY_ENGINE_BIOMES: Record<string, BiomeDefinition> = {};

/**
 * Active biome map — every biome contributed by installed
 * plugins + content packs, overlaid on the caller's
 * `engineDefaults`. Re-runs only when the registry epoch
 * advances.
 */
export function useActiveBiomes(
  engineDefaults: Record<string, BiomeDefinition> = EMPTY_ENGINE_BIOMES,
): Record<string, BiomeDefinition> {
  const epoch = useSyncExternalStore(
    subscribeContentRegistry,
    getContentRegistryEpoch,
    getContentRegistryEpoch,
  );
  return useMemo(
    () => getActiveBiomeDefinitions(engineDefaults),
    // Snapshot is keyed on the epoch + the engineDefaults
    // identity. Stable across non-content-pack re-renders.
    [epoch, engineDefaults],
  );
}

/**
 * Convenience: ordered list of biome ids, sorted by id for
 * deterministic UI rendering. Most components want this rather
 * than the raw map.
 */
export function useActiveBiomeIds(
  engineDefaults: Record<string, BiomeDefinition> = EMPTY_ENGINE_BIOMES,
): string[] {
  const biomes = useActiveBiomes(engineDefaults);
  return useMemo(() => Object.keys(biomes).sort(), [biomes]);
}

/** Active terrain shader recipes. */
export function useActiveTerrainShaders() {
  const epoch = useSyncExternalStore(
    subscribeContentRegistry,
    getContentRegistryEpoch,
    getContentRegistryEpoch,
  );
  return useMemo(() => getActiveTerrainShaders(), [epoch]);
}

/** Active water shader recipes. */
export function useActiveWaterShaders() {
  const epoch = useSyncExternalStore(
    subscribeContentRegistry,
    getContentRegistryEpoch,
    getContentRegistryEpoch,
  );
  return useMemo(() => getActiveWaterShaders(), [epoch]);
}

/** Active vegetation species. */
export function useActiveVegetationSpecies() {
  const epoch = useSyncExternalStore(
    subscribeContentRegistry,
    getContentRegistryEpoch,
    getContentRegistryEpoch,
  );
  return useMemo(() => getActiveVegetationSpecies(), [epoch]);
}
