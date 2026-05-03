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
export interface AutoFillResult {
  /** Resolved `<packId>/<entryId>` ref, or null when no match. */
  readonly ref: string | null;
  /** Why the auto-fill couldn't find a match; absent when ref is set. */
  readonly missReason?:
    | "no-context"
    | "no-packs-installed"
    | "no-matching-plugin-type"
    | "no-accepted-asset-types"
    | "no-matching-pack-asset";
}

/**
 * Bug #1 fix — return a structured outcome instead of `string | null`.
 * When the auto-fill couldn't pick a ref, the caller now knows WHY,
 * which lets each propose-* action surface a clear hint to the
 * agent ("install a pack with type X" / "use a different `type`
 * value") instead of accepting the placement silently and
 * rendering a placeholder.
 *
 * Old `autoFillAssetRef` returns `string | null` and is preserved
 * as a thin wrapper for callers that don't yet consume the
 * miss reason; new callers should use `autoFillAssetRefDetailed`.
 */
export function autoFillAssetRefDetailed(
  runtime: IAgentRuntime,
  kind: PlacementKind,
  type: string,
  preferredId?: string,
): AutoFillResult {
  const ctx = readProjectContext(runtime);
  if (!ctx) return { ref: null, missReason: "no-context" };
  const plugins = ctx.plugins ?? [];
  const packs = ctx.assetPacks ?? [];
  if (packs.length === 0)
    return { ref: null, missReason: "no-packs-installed" };

  // 1. Exact-id pass.
  if (preferredId) {
    for (const pack of packs) {
      const hit = pack.assets.find((a) => a.id === preferredId);
      if (hit) return { ref: `${pack.manifestId}/${hit.id}` };
    }
  }

  // 2. Type-based pass.
  if (plugins.length === 0 || !type) {
    return { ref: null, missReason: "no-matching-plugin-type" };
  }
  const contributions = getEntityTypesForPlugins(plugins).filter(
    (e) => e.contribution.kind === kind && e.contribution.type === type,
  );
  if (contributions.length === 0) {
    return { ref: null, missReason: "no-matching-plugin-type" };
  }
  const accepted = new Set<string>();
  for (const c of contributions) {
    for (const t of c.contribution.acceptedAssetTypes) accepted.add(t);
  }
  if (accepted.size === 0) {
    return { ref: null, missReason: "no-accepted-asset-types" };
  }

  for (const pack of packs) {
    for (const asset of pack.assets) {
      if (accepted.has(asset.type)) {
        return { ref: `${pack.manifestId}/${asset.id}` };
      }
    }
  }
  return { ref: null, missReason: "no-matching-pack-asset" };
}

/**
 * Strict-mode classifier — returns true when an auto-fill
 * miss should HARD-REJECT the placement instead of letting it
 * through with a placeholder. The user requirement is "no fake
 * stuff": every NPC / mob / resource / station must resolve to
 * a real model from a real installed pack. The miss reasons
 * that mean "packs were available but no match" are strict
 * failures; the ones that mean "graceful degradation"
 * (no-context, no-packs-installed) are accepted with a warning.
 *
 * Strict failures:
 *   - no-matching-plugin-type    — entity type isn't contributed
 *                                  by any installed plugin
 *   - no-accepted-asset-types    — type contributed but declares
 *                                  no acceptedAssetTypes
 *   - no-matching-pack-asset     — packs installed but none
 *                                  contribute the expected asset type
 *
 * Graceful (allow with warning):
 *   - no-context                 — no project context yet
 *                                  (onboarding / synthetic call)
 *   - no-packs-installed         — empty project; there's
 *                                  literally nothing to match against
 */
export function isStrictAutoFillFailure(
  missReason: AutoFillResult["missReason"],
): boolean {
  return (
    missReason === "no-matching-plugin-type" ||
    missReason === "no-accepted-asset-types" ||
    missReason === "no-matching-pack-asset"
  );
}

/**
 * Render an auto-fill miss as a one-line agent-facing hint
 * pointing at the next concrete action the agent should take.
 */
export function describeAutoFillMiss(
  result: AutoFillResult,
  kind: PlacementKind,
  type: string,
): string | null {
  if (result.ref) return null;
  switch (result.missReason) {
    case "no-context":
    case "no-packs-installed":
      return `No installed asset packs match a ${type} ${kind}. Call LIST_ASSET_PACKS, then PROPOSE_ASSET_PACK_INSTALL to add a pack with assets of an accepted type before placing more ${type}-typed entities.`;
    case "no-matching-plugin-type":
      return `Entity type "${type}" (${kind}) isn't contributed by any installed plugin. Call LIST_ENTITY_TYPES to see what types installed plugins handle, then either pick from that list or PROPOSE_PLUGIN_SET to install a plugin that contributes "${type}".`;
    case "no-accepted-asset-types":
      return `Entity type "${type}" (${kind}) declares no acceptedAssetTypes — no asset can be auto-picked. Set assetRef explicitly via GET_PROJECT_STATE select=availableAssets, or pick a different type.`;
    case "no-matching-pack-asset":
      return `No asset in installed packs has a type the "${type}" ${kind} accepts. Call PROPOSE_ASSET_PACK_INSTALL to add a pack with a matching asset type, or set assetRef explicitly.`;
    default:
      return null;
  }
}

/**
 * @deprecated R-future — prefer `autoFillAssetRefDetailed`.
 * This thin wrapper preserves the legacy `string | null` shape
 * for callers that haven't migrated yet.
 */
export function autoFillAssetRef(
  runtime: IAgentRuntime,
  kind: PlacementKind,
  type: string,
  preferredId?: string,
): string | null {
  return autoFillAssetRefDetailed(runtime, kind, type, preferredId).ref;
}
