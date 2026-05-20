/**
 * collectAssetPackRefs — walk a plan's entity slots and pull out
 * the asset-pack ids referenced by their `assetRef` fields.
 *
 * The agent's PROPOSE_* actions place entities with assetRef
 * strings like `@hyperforge/asset-pack-hyperia-npcs-v1/shopkeeper`.
 * The pack id is everything before the last `/`. To know which
 * packs the project needs installed for the build, we union
 * three sources:
 *
 *   1. `plan.assetPackIds` — agent's explicit
 *      PROPOSE_ASSET_PACK_INSTALL picks.
 *   2. `assetRef` prefixes from every entity-bearing slot
 *      (npcs, mobSpawns, resources, stations, teleports, pois,
 *      dangerSources, waterBodies, mines).
 *   3. Caller-provided extras (e.g. content-pack-declared
 *      `assetPackDeps`, tag-inference fallback packs).
 *
 * Pulled from DesignWithAIDialog.tsx's `buildWorld` callback,
 * where the same walker was inlined twice (once before procgen
 * to read the active themed-pack's heightmap preset, once after
 * project creation for the `setProjectAssetPacks` call).
 */

import type { OnboardingPlan } from "./onboardingPlan";

/**
 * Extract the pack-id prefix from one entity's `assetRef`.
 * Returns `null` when the entry has no string `assetRef` or
 * the ref isn't pack-prefixed (no `/`).
 */
export function extractAssetPackId(entry: unknown): string | null {
  const ref = (entry as { assetRef?: unknown })?.assetRef;
  if (typeof ref !== "string") return null;
  const slash = ref.lastIndexOf("/");
  if (slash <= 0) return null;
  return ref.slice(0, slash);
}

/**
 * Walk every entity-bearing plan slot and collect every pack
 * id referenced by an `assetRef` prefix.
 */
export function collectEntityPackRefs(plan: OnboardingPlan): string[] {
  const out: string[] = [];
  const slots: ReadonlyArray<ReadonlyArray<unknown>> = [
    plan.npcs,
    plan.mobSpawns,
    plan.resources,
    plan.stations,
    plan.teleports,
    plan.pois,
    plan.dangerSources,
    plan.waterBodies,
    plan.mines,
  ];
  for (const slot of slots) {
    for (const entry of slot) {
      const id = extractAssetPackId(entry);
      if (id !== null) out.push(id);
    }
  }
  return out;
}

/**
 * Build the merged Set of pack ids the project needs:
 * explicit installs + entity refs + caller-provided extras.
 * Returns a `Set` so callers can union further without re-dedup.
 */
export function resolvePlanPackIds(
  plan: OnboardingPlan,
  extras: Iterable<string> = [],
): Set<string> {
  const out = new Set<string>(plan.assetPackIds ?? []);
  for (const id of collectEntityPackRefs(plan)) out.add(id);
  for (const id of extras) out.add(id);
  return out;
}
