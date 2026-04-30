/**
 * Shared validators that turn the AI's "this is the right type"
 * and "this is the right assetRef" hints into HARD checks against
 * the project's installed plugins and packs.
 *
 * Both checks live here so all four propose-actions (NPC,
 * MobSpawn, Resource, Station) share one implementation. Bad
 * inputs surface as structured errors with the list of valid
 * choices, so the LLM can fix and retry.
 *
 * Tolerance:
 *   - When no project context is registered, we degrade gracefully
 *     (skip the check). This keeps the existing test fixtures and
 *     the agent-server's no-project mode working — the agent
 *     can't use this mode to ship bad refs because the studio
 *     wouldn't know what to do with them anyway.
 *   - Skipping is also the right answer when no plugins are
 *     installed (no catalog to check against) or no packs are
 *     installed (no refs to validate).
 */

import type { IAgentRuntime } from "@elizaos/core";
import {
  PROJECT_CONTEXT_SERVICE_TYPE,
  type IProjectContextService,
} from "../services/ProjectContextService.js";
import { getEntityTypesForPlugins } from "./entityTypeContributions.js";

export type PlacementKind = "npc" | "mobSpawn" | "resource" | "station";

interface ValidationOk {
  ok: true;
}
interface ValidationFail {
  ok: false;
  /** Pre-formatted, agent-readable error text. */
  message: string;
  /** Structured detail for `data.*` surfaces. */
  detail: Record<string, unknown>;
}
export type ValidationResult = ValidationOk | ValidationFail;

/** Fetch project context once. Returns null when unavailable. */
function readProjectContext(
  runtime: IAgentRuntime,
): ReturnType<IProjectContextService["getProjectContext"]> | null {
  const svc = runtime.getService(
    PROJECT_CONTEXT_SERVICE_TYPE,
  ) as unknown as IProjectContextService | null;
  return svc?.getProjectContext() ?? null;
}

/**
 * Reject a placement whose `type` value isn't backed by any
 * installed plugin's entity-type contributions for the matching
 * `kind`. Returns OK when no plugins are installed (nothing to
 * check) or when the project context is unavailable.
 */
export function validatePlacementType(
  runtime: IAgentRuntime,
  kind: PlacementKind,
  type: string,
): ValidationResult {
  const ctx = readProjectContext(runtime);
  if (!ctx) return { ok: true };
  const plugins = ctx.plugins ?? [];
  if (plugins.length === 0) return { ok: true };

  const all = getEntityTypesForPlugins(plugins).filter(
    (e) => e.contribution.kind === kind,
  );
  // Empty catalog (e.g. shooter-demo project placing an NPC) →
  // no check we can apply. Skip.
  if (all.length === 0) return { ok: true };

  const validTypes = all.map((e) => e.contribution.type);
  if (validTypes.includes(type)) return { ok: true };

  return {
    ok: false,
    message: `Unknown ${kind} type "${type}". Installed plugins handle: ${validTypes.join(", ")}. Call LIST_ENTITY_TYPES (kind="${kind}") to see descriptions + required fields.`,
    detail: { kind, providedType: type, validTypes },
  };
}

/**
 * Reject an `assetRef` that doesn't resolve in any of the
 * project's installed asset packs. Returns OK when assetRef is
 * absent (it's optional), when no packs are installed, or when
 * project context is unavailable.
 *
 * A ref of the shape `<packId>/<entryId>` is valid when:
 *   - `packId` matches one of `ctx.assetPacks[].manifestId`, AND
 *   - `entryId` matches an asset's `id` inside that pack's resolved
 *     catalog.
 */
export function validateAssetRef(
  runtime: IAgentRuntime,
  assetRef: string | undefined,
): ValidationResult {
  if (!assetRef) return { ok: true };

  const ctx = readProjectContext(runtime);
  if (!ctx) return { ok: true };
  const packs = ctx.assetPacks ?? [];
  if (packs.length === 0) return { ok: true };

  const lastSlash = assetRef.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash >= assetRef.length - 1) {
    return {
      ok: false,
      message: `assetRef "${assetRef}" is malformed — expected \`<packId>/<entryId>\`.`,
      detail: { assetRef },
    };
  }
  const packId = assetRef.slice(0, lastSlash);
  const entryId = assetRef.slice(lastSlash + 1);

  const pack = packs.find((p) => p.manifestId === packId);
  if (!pack) {
    return {
      ok: false,
      message: `assetRef "${assetRef}" references pack "${packId}" which isn't installed on this project. Installed packs: ${packs
        .map((p) => p.manifestId)
        .join(
          ", ",
        )}. Use PROPOSE_ASSET_PACK_INSTALL to add it, or pick a ref from a pack that's already installed.`,
      detail: {
        assetRef,
        packId,
        installedPacks: packs.map((p) => p.manifestId),
      },
    };
  }
  const found = pack.assets.find((a) => a.id === entryId);
  if (!found) {
    return {
      ok: false,
      message: `assetRef "${assetRef}" — pack "${packId}" is installed but doesn't contain an entry with id "${entryId}". Call GET_PROJECT_STATE (select=availableAssets) to see valid refs.`,
      detail: { assetRef, packId, entryId },
    };
  }
  return { ok: true };
}

/**
 * Pick a sensible default `assetRef` for a placement that omitted
 * one. Algorithm:
 *
 *   1. Look up the entity-type contribution for `kind` + `type` in
 *      installed plugins → its `acceptedAssetTypes` array.
 *   2. Scan installed asset packs for any entry whose `type` is in
 *      that list.
 *   3. Return the first match as `<packId>/<entryId>`. Empty list
 *      / no match → null.
 *
 * Best-effort. When no match is found the placement keeps its
 * undefined `assetRef` and the renderer falls back to a
 * placeholder. Caller decides whether to communicate the auto-pick
 * back to the agent.
 *
 * Why we don't try to be cleverer (e.g. match by subtype): the
 * agent is supposed to set `assetRef` explicitly when it cares
 * about which specific asset. This helper exists for the case
 * where the agent emits a quick "place a shopkeeper" without
 * fussing over which character model to use.
 */
export function autoFillAssetRef(
  runtime: IAgentRuntime,
  kind: PlacementKind,
  /**
   * The placement's `type` field. For mob spawns (which don't have
   * `type`), pass an empty string; mobId is the join key instead.
   */
  type: string,
  /**
   * Optional id to prefer — when present, an exact-match entry id
   * across installed packs takes priority over the type-based scan.
   * Used by mob spawn auto-fill to pair `mobId="goblin"` with a
   * pack entry whose id is `goblin`.
   */
  preferredId?: string,
): string | null {
  const ctx = readProjectContext(runtime);
  if (!ctx) return null;
  const plugins = ctx.plugins ?? [];
  const packs = ctx.assetPacks ?? [];
  if (packs.length === 0) return null;

  // 1. Exact-id pass — beats anything else when the agent's
  // `mobId` / `resourceId` happens to match a pack entry id.
  if (preferredId) {
    for (const pack of packs) {
      const hit = pack.assets.find((a) => a.id === preferredId);
      if (hit) return `${pack.manifestId}/${hit.id}`;
    }
  }

  // 2. Type-based pass — uses the entity-type contribution's
  // `acceptedAssetTypes` to scope which pack entries are candidates.
  if (plugins.length === 0 || !type) return null;
  const contributions = getEntityTypesForPlugins(plugins).filter(
    (e) => e.contribution.kind === kind && e.contribution.type === type,
  );
  if (contributions.length === 0) return null;
  const accepted = new Set<string>();
  for (const c of contributions) {
    for (const t of c.contribution.acceptedAssetTypes) accepted.add(t);
  }
  if (accepted.size === 0) return null;

  for (const pack of packs) {
    for (const asset of pack.assets) {
      if (accepted.has(asset.type)) {
        return `${pack.manifestId}/${asset.id}`;
      }
    }
  }
  return null;
}
