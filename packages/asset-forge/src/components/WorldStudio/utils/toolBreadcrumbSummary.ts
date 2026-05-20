/**
 * Tool-call breadcrumb summarizer.
 *
 * Phase 1.2 fourth carve from DesignWithAIDialog. The dialog
 * shows compact icon-prefixed chips below each agent message
 * describing what the agent actually did during that turn
 * ("⚔️ Placed 3 mob spawns", "📜 Wrote 1 quest"). The summary
 * is pure data + a stateless transform, so it extracts cleanly.
 *
 * Discovery tools (LIST/GET/SEARCH/CATALOG) are filtered out at
 * the registry level — they're noise from the user's
 * perspective. PROPOSE_* and REMOVE_FROM_PROJECT survive.
 *
 * Adding a new tool: drop a new entry into
 * `TOOL_BREADCRUMB_SUMMARY` with its icon + label function.
 * Pluralization is the label function's responsibility (count
 * passed in).
 */

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
 * Registry of tool-name → display config. Tools not present
 * here are treated as discovery noise and dropped from the
 * summary output.
 */
export const TOOL_BREADCRUMB_SUMMARY: Record<string, ToolBreadcrumbEntry> = {
  PROPOSE_TERRAIN_CONFIG: {
    icon: "🗺️",
    label: () => "Shaped the terrain",
  },
  PROPOSE_PLUGIN_SET: {
    icon: "🧩",
    label: () => "Picked plugins",
  },
  PROPOSE_NPC_PLACEMENT: {
    icon: "👤",
    label: (n) => `Placed ${n} NPC${n === 1 ? "" : "s"}`,
  },
  PROPOSE_MOB_SPAWN: {
    icon: "⚔️",
    label: (n) => `Placed ${n} mob spawn${n === 1 ? "" : "s"}`,
  },
  PROPOSE_QUEST: {
    icon: "📜",
    label: (n) => `Wrote ${n} quest${n === 1 ? "" : "s"}`,
  },
  PROPOSE_ZONE: {
    icon: "🌍",
    label: (n) => `Carved ${n} zone${n === 1 ? "" : "s"}`,
  },
  PROPOSE_RESOURCE: {
    icon: "🪵",
    label: (n) => `Placed ${n} resource${n === 1 ? "" : "s"}`,
  },
  PROPOSE_STATION: {
    icon: "🛠️",
    label: (n) => `Placed ${n} station${n === 1 ? "" : "s"}`,
  },
  PROPOSE_TELEPORT: {
    icon: "🌀",
    label: (n) => `Placed ${n} teleport${n === 1 ? "" : "s"}`,
  },
  PROPOSE_ASSET_PACK_INSTALL: {
    icon: "📦",
    label: (n) => `Picked ${n} asset pack${n === 1 ? "" : "s"}`,
  },
  PROPOSE_ASSET: {
    icon: "✨",
    label: (n) => `Queued ${n} asset bake${n === 1 ? "" : "s"}`,
  },
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
 *   GET_PROJECT_STATE × 2 → (omitted — discovery isn't worth a chip)
 *
 * Discovery tools (LIST/GET/SEARCH/CATALOG) are filtered out —
 * they're noise from the user's perspective. PROPOSE_* and
 * REMOVE_FROM_PROJECT survive.
 */
export function summarizeToolCalls(
  tally: Map<string, number>,
): ReadonlyArray<ToolBreadcrumbChip> {
  const out: ToolBreadcrumbChip[] = [];
  for (const [name, count] of tally) {
    const summary = TOOL_BREADCRUMB_SUMMARY[name];
    if (!summary) continue; // skip discovery tools
    out.push({
      icon: summary.icon,
      label: summary.label(count),
    });
  }
  return out;
}
