import type { WorldArea as ManifestWorldArea } from "@hyperforge/manifest-schema";

import { ALL_WORLD_AREAS, STARTER_TOWNS } from "../data/world-areas.js";
import { WorldAreasRegistry } from "./WorldAreasRegistry.js";

export {
  UnknownWorldAreaError,
  type WorldAreaCategoryKey,
  WorldAreasNotLoadedError,
  WorldAreasRegistry,
} from "./WorldAreasRegistry.js";

/**
 * Module-level singleton. Mirrors the `gatheringResources` pattern so
 * `PIEEditorSession.updateManifests({ worldAreas })` can live-dispatch
 * authored edits to a shared, id-indexed view of the area catalog —
 * even before any gameplay system consumes it directly. When a system
 * lands that needs area bounds (town spawning, zone AI, etc.), it
 * imports `worldAreasRegistry` and reads through the same instance
 * that the editor is writing to.
 *
 * Pinned to `globalThis` for the same reason `gatheringResources` is —
 * the server's esbuild bundle inlines parts of `@hyperforge/shared`
 * via relative-path reach-ins from server/src, producing a duplicate
 * registry instance separate from the `@hyperforge/hyperscape` plugin's
 * import. `DataManager` writes areas into one instance and the
 * `MobNPCSpawnerSystem` / `StationSpawnerSystem` read from the empty
 * one, leading to silent zero-spawn (no NPCs, no stations, no mobs).
 */
const WORLD_AREAS_REGISTRY_GLOBAL_KEY = Symbol.for(
  "@hyperforge/shared/worldAreasRegistry",
);
type WorldAreasRegistryGlobal = typeof globalThis & {
  [WORLD_AREAS_REGISTRY_GLOBAL_KEY]?: WorldAreasRegistry;
};
const _worldAreasGlobal = globalThis as WorldAreasRegistryGlobal;
if (!_worldAreasGlobal[WORLD_AREAS_REGISTRY_GLOBAL_KEY]) {
  _worldAreasGlobal[WORLD_AREAS_REGISTRY_GLOBAL_KEY] = new WorldAreasRegistry();
}
export const worldAreasRegistry: WorldAreasRegistry =
  _worldAreasGlobal[WORLD_AREAS_REGISTRY_GLOBAL_KEY]!;

/**
 * Resolve a starter-town area by id with the canonical
 * registry-prefer-fallback semantics used by every consumer:
 *
 *   - If the registry is loaded AND knows the id → return it.
 *   - If the registry is loaded AND does NOT know the id → return
 *     `undefined` (authored choice — the manifest decided this town
 *     doesn't exist; consumers should fall through to whatever
 *     ultimate-fallback they have, e.g. `getDefaultRespawnPosition()`).
 *   - If the registry is not loaded → return whatever the in-tree
 *     `STARTER_TOWNS` constant has (which today may also be
 *     `undefined`).
 *
 * Centralized here so every system that resolves a starter-town
 * shares the same "loaded-empty wins over hardcoded" semantics
 * without duplicating the three-branch conditional. Returns the
 * manifest-schema `WorldArea` shape; consumers reading only
 * `bounds`/`name` won't notice the type difference, consumers that
 * need the in-tree literal `difficultyLevel` should cast at the
 * call site (same pattern as `getEffectiveWorldAreas`).
 */
export function resolveStarterTownArea(
  townId: string,
): ManifestWorldArea | undefined {
  if (worldAreasRegistry.isLoaded()) {
    return worldAreasRegistry.has(townId)
      ? worldAreasRegistry.get(townId)
      : undefined;
  }
  // In-tree WorldArea uses literal-typed difficultyLevel (0|1|2|3) and
  // structurally-narrower nested arrays (NPCLocation, etc.). Schema
  // validation gates authored data; the cast bridges the in-tree
  // overlay back to the schema-derived shape returned in the loaded
  // branch above.
  return STARTER_TOWNS[townId] as unknown as ManifestWorldArea | undefined;
}

/**
 * Resolve the effective world-area catalog with the canonical
 * registry-prefer-fallback semantics shared across every consumer
 * that iterates ALL areas (zone detection, zone visuals, terrain
 * blends, station spawning, mob spawning, resource placement, etc.).
 *
 * Loaded registry wins (returns the manifest's authored areas).
 * Unloaded registry falls back to the in-tree `ALL_WORLD_AREAS`
 * constant. The cast at the boundary mirrors `resolveStarterTownArea`
 * — schema validation is the right gate; consumers reading only
 * `bounds`/`name`/`safeZone` won't notice the type difference, while
 * consumers needing the in-tree literal `difficultyLevel` should
 * cast at the call site.
 *
 * Use this instead of writing the conditional inline in every
 * consumer — the consistency makes future deletion of the legacy
 * constant a one-place change.
 */
export function getEffectiveWorldAreas(): ManifestWorldArea[] {
  if (worldAreasRegistry.isLoaded()) {
    return worldAreasRegistry.all();
  }
  return Object.values(ALL_WORLD_AREAS) as unknown as ManifestWorldArea[];
}
