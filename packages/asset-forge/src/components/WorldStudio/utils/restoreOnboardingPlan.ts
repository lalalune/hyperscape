/**
 * Restore an `OnboardingPlan` from a partially-persisted draft.
 *
 * The DesignWithAIDialog persists `(messages + plan)` to
 * localStorage (B1'.7 — draft persistence). When the user
 * refreshes or accidentally closes the dialog, we rehydrate the
 * plan so their onboarding work isn't lost.
 *
 * The persisted shape may be missing fields (e.g. a draft saved
 * before a new slot was added to `OnboardingPlan`) or may have
 * been hand-edited via devtools — never trust raw JSON. Three
 * normalization patterns cover every field on the type:
 *
 *   - **Required arrays** (`npcs`, `mobSpawns`, etc.): if the
 *     saved value isn't an array, fall back to `[]`. Otherwise
 *     shallow-clone so future mutations don't tamper with the
 *     persisted draft object.
 *
 *   - **Nullable arrays** (`pluginIds`, `assetPackIds`): same as
 *     above but `null` instead of `[]` when missing — matches
 *     the type signature where a "not yet set" state is
 *     distinguishable from an "empty pick".
 *
 *   - **Nullable scalars** (`terrainConfig`, `wildernessBoundary`,
 *     `uiPack`): `?? null` is enough.
 *
 * @internal
 */

import {
  createEmptyOnboardingPlan,
  type OnboardingPlan,
} from "./onboardingPlan";

function cloneArr<T>(maybe: unknown): T[] {
  return Array.isArray(maybe) ? [...(maybe as T[])] : [];
}

function cloneNullableArr<T>(maybe: unknown): T[] | null {
  return Array.isArray(maybe) ? [...(maybe as T[])] : null;
}

export function restoreOnboardingPlan(
  saved: Partial<OnboardingPlan> | null | undefined,
): OnboardingPlan {
  if (!saved) return createEmptyOnboardingPlan();
  return {
    terrainConfig: saved.terrainConfig ?? null,
    pluginIds: cloneNullableArr<string>(saved.pluginIds),
    assetPackIds: cloneNullableArr<string>(saved.assetPackIds),
    npcs: cloneArr<unknown>(saved.npcs),
    mobSpawns: cloneArr<unknown>(saved.mobSpawns),
    quests: cloneArr<unknown>(saved.quests),
    assets: cloneArr<unknown>(saved.assets),
    zones: cloneArr<unknown>(saved.zones),
    resources: cloneArr<unknown>(saved.resources),
    stations: cloneArr<unknown>(saved.stations),
    teleports: cloneArr<unknown>(saved.teleports),
    roads: cloneArr<unknown>(saved.roads),
    pois: cloneArr<unknown>(saved.pois),
    dangerSources: cloneArr<unknown>(saved.dangerSources),
    waterBodies: cloneArr<unknown>(saved.waterBodies),
    musicZones: cloneArr<unknown>(saved.musicZones),
    ambientZones: cloneArr<unknown>(saved.ambientZones),
    sfxTriggers: cloneArr<unknown>(saved.sfxTriggers),
    mines: cloneArr<unknown>(saved.mines),
    wildernessBoundary: saved.wildernessBoundary ?? null,
    uiPack: saved.uiPack ?? null,
  };
}
