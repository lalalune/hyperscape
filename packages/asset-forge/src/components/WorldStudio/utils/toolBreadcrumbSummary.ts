/**
 * Tool-call breadcrumb summarizer.
 *
 * Phase 1.2 fourth carve from DesignWithAIDialog (upgraded later
 * to subsume Companion's parallel impl). The dialog + companion
 * each show compact icon-prefixed chips below agent messages
 * describing what the agent actually did during that turn
 * ("⚔️ Placed 3 mob spawns", "📜 Wrote 1 quest"). The summary
 * is pure data + a stateless transform.
 *
 * Two-tier lookup:
 *
 *   1. **proposeActionRegistry first** — all 19 PROPOSE_*
 *      actions ship icon + breadcrumbLabel in the registry, so
 *      adding a new PROPOSE_* automatically gets it a chip
 *      (drift-proof). Previously the dialog had a parallel
 *      static map that lagged the registry — it was missing
 *      chips for the 9 R4.P8 actions (water bodies, music
 *      zones, ambient zones, sfx triggers, mines, roads, POIs,
 *      danger sources, wilderness boundary).
 *
 *   2. **BESPOKE_BREADCRUMB_SUMMARY fallback** — small map for
 *      the 2 actions outside the registry (PROPOSE_UI_PACK and
 *      REMOVE_FROM_PROJECT). These have payload shapes that
 *      don't fit the registry's dataKey/arity model.
 *
 * Discovery tools (LIST/GET/SEARCH/CATALOG) are filtered out —
 * they're noise from the user's perspective.
 */

import { getProposeActionDef } from "./proposeActionRegistry";

export interface ToolBreadcrumbEntry {
  readonly icon: string;
  /** Renders the human label for this tool given the call count. */
  readonly label: (count: number) => string;
}

export interface ToolBreadcrumbChip {
  readonly icon: string;
  readonly label: string;
}

/**
 * Bespoke breadcrumb config for the two actions outside the
 * proposeActionRegistry. PROPOSE_UI_PACK has a different payload
 * shape (no dataKey + planField mapping), REMOVE_FROM_PROJECT
 * dispatches across 11 entity kinds and can't be captured by
 * the registry's dataKey/arity model.
 */
export const BESPOKE_BREADCRUMB_SUMMARY: Record<string, ToolBreadcrumbEntry> = {
  PROPOSE_UI_PACK: {
    icon: "🎛️",
    label: () => "Designed the HUD",
  },
  REMOVE_FROM_PROJECT: {
    icon: "🗑️",
    label: (n) => `Removed ${n} ${n === 1 ? "entity" : "entities"}`,
  },
};

/**
 * Roll a tool-call tally into a list of compact human chips.
 *
 *   PROPOSE_MOB_SPAWN × 3 → "⚔️ Placed 3 mob spawns"
 *   PROPOSE_QUEST × 1     → "📜 Wrote 1 quest"
 *   PROPOSE_UI_PACK × 1   → "🎛️ Designed the HUD"
 *   GET_PROJECT_STATE × 2 → (omitted — discovery isn't worth a chip)
 *
 * Registry-first dispatch (Phase 1.3 follow-up): every
 * registered PROPOSE_* gets its chip automatically; bespoke
 * fallback for the 2 actions outside the registry.
 */
export function summarizeToolCalls(
  tally: Map<string, number>,
): ReadonlyArray<ToolBreadcrumbChip> {
  const out: ToolBreadcrumbChip[] = [];
  for (const [name, count] of tally) {
    // Registry path covers all 19 standard PROPOSE_* actions.
    const def = getProposeActionDef(name);
    if (def) {
      out.push({ icon: def.icon, label: def.breadcrumbLabel(count) });
      continue;
    }
    // Bespoke fallback for the 2 actions outside the registry.
    const bespoke = BESPOKE_BREADCRUMB_SUMMARY[name];
    if (bespoke) {
      out.push({ icon: bespoke.icon, label: bespoke.label(count) });
    }
    // Other tools (LIST_*, GET_*, SEARCH_*, CATALOG_*) drop —
    // discovery noise isn't worth a chip.
  }
  return out;
}
