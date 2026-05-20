/**
 * buildWorldContentPatch — OnboardingPlan → worldContent patch shape.
 *
 * Pulled from DesignWithAIDialog.tsx's `buildWorld` callback —
 * the 50-line "if non-empty, copy the slot to the patch" block
 * that translates the agent's accumulated plan into the patch
 * payload accepted by the server's `patchWorldContent` endpoint.
 *
 * The server merges the patch into the project's worldContent
 * (omitting a key leaves the existing value untouched). Empty
 * slots are omitted rather than written as `[]` so a partial
 * dialog session doesn't erase content previously authored in
 * the editor.
 *
 * Pure data transform — no React, no fetch, no side effects.
 * Easy to test in isolation.
 */

import type { OnboardingPlan } from "./onboardingPlan";

/**
 * Build the worldContent patch payload from an accumulated
 * plan. Returns `{}` when the plan has no patchable content;
 * caller can short-circuit the patch fetch by checking
 * `Object.keys(patch).length === 0`.
 *
 * Slots covered:
 *   - lists: npcs, mobSpawns (→ `spawns`), quests, zones,
 *     resources, stations, teleports, roads, pois,
 *     dangerSources, waterBodies, musicZones, ambientZones,
 *     sfxTriggers, mines
 *   - singletons: wildernessBoundary, uiPack
 *
 * Slots intentionally NOT in the patch:
 *   - terrainConfig (applied via procgen before patch)
 *   - pluginIds + assetPackIds (persisted via dedicated endpoints)
 *   - assets (baked post-creation, not part of worldContent)
 *
 * Note the `mobSpawns` → `spawns` key rename — the engine's
 * worldContent schema uses `spawns` for backward compatibility
 * with pre-mob-spawn-rename projects.
 */
export function buildWorldContentPatch(
  plan: OnboardingPlan,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (plan.npcs.length > 0) patch.npcs = plan.npcs;
  if (plan.mobSpawns.length > 0) patch.spawns = plan.mobSpawns;
  if (plan.quests.length > 0) patch.quests = plan.quests;
  if (plan.zones.length > 0) patch.zones = plan.zones;
  if (plan.resources.length > 0) patch.resources = plan.resources;
  if (plan.stations.length > 0) patch.stations = plan.stations;
  if (plan.teleports.length > 0) patch.teleports = plan.teleports;
  if (plan.roads.length > 0) patch.roads = plan.roads;
  if (plan.pois.length > 0) patch.pois = plan.pois;
  if (plan.dangerSources.length > 0) patch.dangerSources = plan.dangerSources;
  if (plan.waterBodies.length > 0) patch.waterBodies = plan.waterBodies;
  if (plan.musicZones.length > 0) patch.musicZones = plan.musicZones;
  if (plan.ambientZones.length > 0) patch.ambientZones = plan.ambientZones;
  if (plan.sfxTriggers.length > 0) patch.sfxTriggers = plan.sfxTriggers;
  if (plan.mines.length > 0) patch.mines = plan.mines;
  if (plan.wildernessBoundary !== null) {
    patch.wildernessBoundary = plan.wildernessBoundary;
  }
  if (plan.uiPack) patch.uiPack = plan.uiPack;
  return patch;
}
