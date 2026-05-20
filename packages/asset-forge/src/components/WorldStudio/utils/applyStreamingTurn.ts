/**
 * SSE streaming turn applicator.
 *
 * Phase 1.2 twelfth carve from DesignWithAIDialog. Consumes one
 * `stream_turn` SSE event and applies its effects to the dialog's
 * live state:
 *
 *   - Surfaces the most-recent tool name as the live status
 *     string ("Calling LIST_PLUGINS…" beats "Thinking…")
 *   - Incrementally fills `effectivePlan` with each PROPOSE_*
 *     tool call's result via the proposeActionRegistry helper
 *   - Handles four bespoke arms the registry intentionally
 *     excludes: PROPOSE_PLUGIN_SET (string-filter),
 *     PROPOSE_ASSET_PACK_INSTALL (Set-merge),
 *     REMOVE_FROM_PROJECT (11-kind dispatch),
 *     PROPOSE_UI_PACK (custom payload)
 *
 * The function takes React dispatch handles directly — callers
 * forward `setPlan` / `setStatus` from the dialog's
 * `useState`. The function shape (state setter + structural
 * detail) makes it testable with plain Jest-style mock fns;
 * no React tree required.
 */

import type React from "react";

import type { OnboardingPlan } from "./onboardingPlan";
import {
  applyProposalToPlan,
  getProposeActionDef,
  prettifyToolName,
} from "./proposeActionRegistry";

/** One streamed turn the SSE handler emits. */
export interface StreamTurnEvent {
  turn: number;
  assistantText: string;
  toolCalls: ReadonlyArray<{
    name: string;
    success: boolean;
    data: unknown;
  }>;
}

/**
 * Apply one streamed turn event: update the live status string
 * (so the user sees "Calling LIST_PLUGINS…" instead of just
 * "Thinking…") and incrementally fill effectivePlan with each
 * `PROPOSE_*` tool call's result. NPCs append, so within-run
 * duplicates are reconciled at done-time against the canonical
 * server aggregate.
 *
 * `priorNpcs` is referenced for reconciliation at the call-site
 * but isn't read inside this helper — kept in the signature
 * for call-site discoverability.
 */
export function applyStreamingTurn(
  detail: StreamTurnEvent,
  setPlan: React.Dispatch<React.SetStateAction<OnboardingPlan>>,
  setStatus: React.Dispatch<React.SetStateAction<string | null>>,
  priorNpcs: ReadonlyArray<unknown>,
): void {
  if (detail.toolCalls.length > 0) {
    const last = detail.toolCalls[detail.toolCalls.length - 1]!;
    setStatus(prettifyToolName(last.name));
  } else if (detail.assistantText) {
    setStatus("Drafting reply…");
  }

  for (const call of detail.toolCalls) {
    if (!call.success || !call.data) continue;
    const data = call.data as Record<string, unknown>;

    // Phase 1.3 second cut: registry-driven dispatch for the
    // 18 standard PROPOSE_* actions. Falls through to the
    // bespoke switch below for the 4 actions the registry
    // intentionally excludes.
    if (getProposeActionDef(call.name)) {
      setPlan((p) => applyProposalToPlan(p, call.name, data));
      continue;
    }

    switch (call.name) {
      case "PROPOSE_PLUGIN_SET":
        if (Array.isArray(data.pluginIds)) {
          const ids = (data.pluginIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
          setPlan((p) => ({ ...p, pluginIds: ids }));
        }
        break;
      case "PROPOSE_ASSET_PACK_INSTALL":
        if (Array.isArray(data.assetPackIds)) {
          // Additive merge — multiple PROPOSE_ASSET_PACK_INSTALL
          // turns over a conversation should accumulate.
          const incoming = (data.assetPackIds as unknown[]).filter(
            (x): x is string => typeof x === "string",
          );
          setPlan((p) => {
            const merged = new Set([...(p.assetPackIds ?? []), ...incoming]);
            return { ...p, assetPackIds: Array.from(merged) };
          });
        }
        break;
      case "REMOVE_FROM_PROJECT":
        if (data.removal !== undefined) {
          // A4 — apply removal to the streaming aggregate so
          // the right pane updates live. Server's done-event
          // will also have the cleaned aggregate; this is
          // optimistic UI only.
          const removal = data.removal as {
            kind: string;
            id?: string;
            mobId?: string;
            resourceId?: string;
            position?: { x: number; y: number; z: number };
          };
          setPlan((p) => {
            switch (removal.kind) {
              case "npc":
                return {
                  ...p,
                  npcs: p.npcs.filter(
                    (n) => (n as { id?: string }).id !== removal.id,
                  ),
                };
              case "quest":
                return {
                  ...p,
                  quests: p.quests.filter(
                    (q) => (q as { id?: string }).id !== removal.id,
                  ),
                };
              case "zone":
                return {
                  ...p,
                  zones: p.zones.filter(
                    (z) => (z as { id?: string }).id !== removal.id,
                  ),
                };
              case "station":
                return {
                  ...p,
                  stations: p.stations.filter(
                    (s) => (s as { id?: string }).id !== removal.id,
                  ),
                };
              case "teleport":
                return {
                  ...p,
                  teleports: p.teleports.filter(
                    (t) => (t as { id?: string }).id !== removal.id,
                  ),
                };
              case "road":
                return {
                  ...p,
                  roads: p.roads.filter(
                    (r) => (r as { id?: string }).id !== removal.id,
                  ),
                };
              case "poi":
                return {
                  ...p,
                  pois: p.pois.filter(
                    (n) => (n as { id?: string }).id !== removal.id,
                  ),
                };
              case "dangerSource":
                return {
                  ...p,
                  dangerSources: p.dangerSources.filter(
                    (d) => (d as { id?: string }).id !== removal.id,
                  ),
                };
              case "asset":
                return {
                  ...p,
                  assets: p.assets.filter(
                    (a) => (a as { name?: string }).name !== removal.id,
                  ),
                };
              case "mobSpawn":
                return {
                  ...p,
                  mobSpawns: p.mobSpawns.filter((s) => {
                    const o = s as {
                      mobId?: string;
                      position?: { x?: number; y?: number; z?: number };
                    };
                    return !(
                      o.mobId === removal.mobId &&
                      o.position?.x === removal.position?.x &&
                      o.position?.y === removal.position?.y &&
                      o.position?.z === removal.position?.z
                    );
                  }),
                };
              case "resource":
                return {
                  ...p,
                  resources: p.resources.filter((r) => {
                    const o = r as {
                      resourceId?: string;
                      position?: { x?: number; y?: number; z?: number };
                    };
                    return !(
                      o.resourceId === removal.resourceId &&
                      o.position?.x === removal.position?.x &&
                      o.position?.y === removal.position?.y &&
                      o.position?.z === removal.position?.z
                    );
                  }),
                };
              default:
                return p;
            }
          });
        }
        break;
      case "PROPOSE_UI_PACK":
        if (data.pack !== undefined) {
          setPlan((p) => ({ ...p, uiPack: data.pack }));
        }
        break;
      default:
        break;
    }
  }
  void priorNpcs;
}
