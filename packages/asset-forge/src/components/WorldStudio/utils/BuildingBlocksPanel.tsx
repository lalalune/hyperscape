/**
 * Building Blocks right-rail panel (B1'.6).
 *
 * Phase 1.2 fifteenth carve from DesignWithAIDialog. The
 * right-side "Building Blocks" tab — surfaces installed plugins
 * (from `/api/plugins/installed`, B0'.D) so the user can browse
 * what the agent has to work with and one-click insert a
 * "use this plugin" prompt into the conversation.
 *
 * Three tightly-coupled exports move together:
 *
 *   - `BuildingBlocksPanel` — top-level panel with search +
 *     loading/error states + list of cards
 *   - `PluginCard` — collapsible card per plugin, with
 *     contribution breakdown and "Use in my world" CTA
 *   - `renderContribGroup` — internal label · items row helper
 *
 * Plus `PluginRegistryEntry` type — the shape returned by the
 * installed-plugins HTTP endpoint.
 */

import { AlertTriangle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useState } from "react";

export interface PluginRegistryEntry {
  id: string;
  npmName: string | null;
  name: string;
  version: string;
  description: string;
  contributions: {
    systems: ReadonlyArray<string>;
    entities: ReadonlyArray<string>;
    widgets: ReadonlyArray<string>;
    manifestSchemas: ReadonlyArray<string>;
    paletteCategories: ReadonlyArray<string>;
    toolbarTools: ReadonlyArray<string>;
    commands: ReadonlyArray<string>;
  };
  dependencies: ReadonlyArray<{ id: string; versionRange: string }>;
  tags: ReadonlyArray<string>;
  source: "workspace" | "node_modules";
}

export interface BuildingBlocksPanelProps {
  /** Disable "Use" buttons while a turn is pending or build is running. */
  disabled: boolean;
  /** User clicked "Use" — inject this prompt as a chat turn. */
  onUse: (prompt: string) => void;
}

export function BuildingBlocksPanel({
  disabled,
  onUse,
}: BuildingBlocksPanelProps): React.ReactElement {
  const [entries, setEntries] = useState<ReadonlyArray<PluginRegistryEntry>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/plugins/installed", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ReadonlyArray<PluginRegistryEntry>;
        if (!cancelled) setEntries(json);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load plugins");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lowered = filter.trim().toLowerCase();
  const filtered = lowered
    ? entries.filter(
        (e) =>
          e.id.toLowerCase().includes(lowered) ||
          e.name.toLowerCase().includes(lowered) ||
          e.description.toLowerCase().includes(lowered) ||
          e.tags.some((t) => t.toLowerCase().includes(lowered)),
      )
    : entries;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-4">
        <div className="text-[12px] font-semibold text-text-primary">
          Building Blocks
        </div>
        <div className="text-[11px] text-text-tertiary mt-1 leading-snug">
          Installed plugins the agent can compose into your world.
        </div>
      </div>

      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search plugins…"
          className="w-full px-3 py-2 text-[12px] bg-bg-tertiary rounded-md ring-1 ring-white/[0.06] text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-bg-secondary transition-all"
        />
      </div>

      <div className="flex-1 overflow-y-auto design-ai-scrollbar px-3 pb-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary py-4">
            <Loader2 size={12} className="animate-spin" />
            Loading installed plugins…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-[11px] text-red-400 px-2 py-2 bg-red-500/10 rounded-md ring-1 ring-red-500/20">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-[11px] text-text-tertiary py-6 text-center">
            {entries.length === 0
              ? "No installed plugins discovered."
              : "No plugins match your filter."}
          </div>
        ) : (
          filtered.map((entry) => (
            <PluginCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === entry.id ? null : entry.id))
              }
              disabled={disabled}
              onUse={() =>
                onUse(`Add the ${entry.name} plugin (${entry.id}) to my world.`)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

export interface PluginCardProps {
  entry: PluginRegistryEntry;
  expanded: boolean;
  onToggle: () => void;
  disabled: boolean;
  onUse: () => void;
}

export function PluginCard({
  entry,
  expanded,
  onToggle,
  disabled,
  onUse,
}: PluginCardProps): React.ReactElement {
  const totalContrib =
    entry.contributions.systems.length +
    entry.contributions.entities.length +
    entry.contributions.widgets.length +
    entry.contributions.manifestSchemas.length +
    entry.contributions.paletteCategories.length +
    entry.contributions.toolbarTools.length +
    entry.contributions.commands.length;

  return (
    <div
      className={`bg-bg-tertiary rounded-lg ring-1 ${
        expanded
          ? "ring-primary/40 shadow-md shadow-primary/10"
          : "ring-white/[0.06] hover:ring-primary/30"
      } transition-all`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-bg-secondary/40 rounded-t-lg"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-text-primary truncate">
              {entry.name}
            </span>
            <span className="text-[10px] text-text-tertiary flex-shrink-0 font-mono">
              v{entry.version}
            </span>
            {entry.source === "workspace" && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex-shrink-0 font-semibold">
                dev
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-tertiary truncate mt-0.5 leading-snug">
            {entry.description || entry.id}
          </div>
          <div className="text-[10px] text-text-tertiary mt-1.5 flex items-center gap-1">
            <span className="font-mono px-1.5 py-0.5 rounded bg-bg-primary/60">
              {totalContrib} contribution{totalContrib === 1 ? "" : "s"}
            </span>
            {entry.tags.length > 0 && (
              <span className="truncate">· {entry.tags.join(", ")}</span>
            )}
          </div>
        </div>
        <ArrowRight
          size={11}
          className={`flex-shrink-0 mt-1 text-text-tertiary transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border-primary/15 px-3 py-2.5 space-y-1.5 bg-bg-primary/30 rounded-b-lg">
          {renderContribGroup("Systems", entry.contributions.systems)}
          {renderContribGroup("Entities", entry.contributions.entities)}
          {renderContribGroup("Widgets", entry.contributions.widgets)}
          {renderContribGroup(
            "Manifest schemas",
            entry.contributions.manifestSchemas,
          )}
          {renderContribGroup(
            "Palette categories",
            entry.contributions.paletteCategories,
          )}
          {renderContribGroup(
            "Toolbar tools",
            entry.contributions.toolbarTools,
          )}
          {renderContribGroup("Commands", entry.contributions.commands)}
          {entry.dependencies.length > 0 && (
            <div className="text-[10px] text-text-tertiary leading-snug">
              <span className="font-semibold text-text-secondary">
                Depends on:
              </span>{" "}
              {entry.dependencies.map((d) => d.id).join(", ")}
            </div>
          )}
          <button
            type="button"
            onClick={onUse}
            disabled={disabled}
            className="w-full mt-2 px-3 py-2 text-[11px] font-semibold rounded-md bg-gradient-to-br from-primary to-primary/85 text-white shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
          >
            <Sparkles size={11} />
            Use in my world
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One contribution-category row in the expanded PluginCard view.
 * Returns null when the items list is empty so empty categories
 * don't render dangling labels.
 */
function renderContribGroup(
  label: string,
  items: ReadonlyArray<string>,
): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <div className="text-[10px] leading-snug">
      <span className="font-semibold text-text-secondary">{label}</span>
      <span className="text-text-tertiary"> · {items.join(", ")}</span>
    </div>
  );
}
