/**
 * Resolve the set of asset/content pack ids the build pipeline
 * should treat as authoritative for a given onboarding plan,
 * with a tag-based themed-pack safety net.
 *
 * Pipeline:
 *   1. Collect explicit pack refs from `plan.assetPackIds` + any
 *      asset-pack ids declared on entity-bearing slots (npcs,
 *      stations, etc.) via `resolvePlanPackIds`.
 *   2. If the resulting set already includes at least one
 *      `@hyperforge/content-pack-*` id, return as-is — the agent
 *      explicitly picked a theme.
 *   3. Otherwise, score the catalog against the conversation's
 *      user messages (`inferThemedPackFromCatalog`); add the
 *      best-matching themed pack.
 *   4. If no inference succeeded (catalog empty, no user
 *      messages, no tag overlap), fall back to Hyperia. Blank
 *      projects shouldn't render with an empty palette.
 *
 * Returns a fresh `Set<string>` — the caller can mutate it
 * without affecting the input plan.
 *
 * @internal
 */

import {
  HYPERIA_CONTENT_PACK_ID,
  isContentPackId,
} from "./contentPackConstants";
import { inferThemedPackFromCatalog } from "./inferThemedPack";
import { resolvePlanPackIds } from "./collectAssetPackRefs";
import type { OnboardingPlan } from "./onboardingPlan";

interface MessageLike {
  readonly role: string;
  readonly text: string;
}

interface PackCatalogEntry {
  readonly manifestId: string;
  readonly tags: ReadonlyArray<string>;
}

export function resolvePackIdsWithFallback(
  plan: OnboardingPlan,
  messages: ReadonlyArray<MessageLike>,
  installablePacks: ReadonlyArray<PackCatalogEntry>,
): Set<string> {
  const resolved = resolvePlanPackIds(plan);
  const alreadyHasThemedPack = Array.from(resolved).some((id) =>
    isContentPackId(id),
  );
  if (alreadyHasThemedPack) return resolved;
  const inferred = inferThemedPackFromCatalog(
    messages,
    installablePacks.map((p) => ({ manifestId: p.manifestId, tags: p.tags })),
  );
  resolved.add(inferred ?? HYPERIA_CONTENT_PACK_ID);
  return resolved;
}
