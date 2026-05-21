/**
 * ComparisonOverlay — Before/after comparison banner for procgen preview.
 *
 * Rendered as a fixed overlay on top of the viewport when a procgen preview
 * is active. Shows a header bar with accept/reject actions and a stats panel.
 *
 * Uses explicit white-opacity colors (not theme tokens) for guaranteed
 * readability against the 3D viewport background.
 */

import { Eye, X, Check, Undo2 } from "lucide-react";
import React from "react";

// ============== TYPES ==============

interface ComparisonStats {
  tiles: number;
  biomes: number;
  towns: number;
  roads: number;
}

export interface ComparisonOverlayProps {
  beforeStats: ComparisonStats;
  afterStats: ComparisonStats;
  generationTimeMs?: number;
  onAccept: () => void;
  onReject: () => void;
}

// ============== HELPERS ==============

function formatDelta(
  before: number,
  after: number,
): { text: string; className: string } {
  const diff = after - before;
  if (diff > 0) return { text: `+${diff}`, className: "text-green-400" };
  if (diff < 0) return { text: `${diff}`, className: "text-red-400" };
  return { text: "\u2014", className: "text-white/30" };
}

// ============== COMPONENT ==============

export function ComparisonOverlay({
  beforeStats,
  afterStats,
  generationTimeMs,
  onAccept,
  onReject,
}: ComparisonOverlayProps) {
  const statRows: { label: string; key: keyof ComparisonStats }[] = [
    { label: "Tiles", key: "tiles" },
    { label: "Biomes", key: "biomes" },
    { label: "Towns", key: "towns" },
    { label: "Roads", key: "roads" },
  ];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* ============== HEADER BAR ============== */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-2 pointer-events-auto">
        <div className="flex items-center gap-2 px-4 py-2 bg-black/80 border border-border-primary rounded-lg shadow-xl">
          <Eye size={14} className="text-primary flex-shrink-0" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-[0.12em] whitespace-nowrap">
            Preview Active
          </span>
          {generationTimeMs != null && (
            <span className="text-[10px] text-white/40 font-mono">
              {generationTimeMs}ms
            </span>
          )}
          <div className="w-px h-4 bg-bg-tertiary mx-1" />
          <button
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-500 transition-colors ease-out"
            onClick={onAccept}
          >
            <Check size={12} />
            Accept
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors ease-out"
            onClick={onReject}
          >
            <Undo2 size={12} />
            Revert
          </button>
          <button
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-bg-tertiary transition-colors ease-out"
            onClick={onReject}
            title="Revert to original"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ============== STATS COMPARISON (bottom-left) ============== */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="bg-black/80 border border-border-primary rounded-lg shadow-xl p-3 min-w-[240px]">
          <div className="text-[10px] text-white/50 uppercase tracking-[0.12em] font-semibold mb-2">
            Change Summary
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] text-white/40 uppercase tracking-[0.12em]">
                <th className="text-left pb-1 font-medium">Metric</th>
                <th className="text-right pb-1 font-medium">Before</th>
                <th className="text-right pb-1 font-medium">After</th>
                <th className="text-right pb-1 font-medium">Delta</th>
              </tr>
            </thead>
            <tbody>
              {statRows.map((row) => {
                const delta = formatDelta(
                  beforeStats[row.key],
                  afterStats[row.key],
                );
                return (
                  <tr key={row.key} className="border-t border-border-primary">
                    <td className="py-1 text-white/70">{row.label}</td>
                    <td className="py-1 text-right font-mono text-white/40">
                      {beforeStats[row.key].toLocaleString()}
                    </td>
                    <td className="py-1 text-right font-mono text-white/80">
                      {afterStats[row.key].toLocaleString()}
                    </td>
                    <td
                      className={`py-1 text-right font-mono font-semibold ${delta.className}`}
                    >
                      {delta.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
