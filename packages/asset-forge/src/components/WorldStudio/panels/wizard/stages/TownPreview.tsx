/**
 * TownPreview — Preview panel showing generated town results
 */

import { Home, MapPin } from "lucide-react";

import type { TownStageResult } from "../../../hooks/useZoneAutoGen";
import { MiniStatCard } from "../WizardSharedUI";

export function TownPreview({ data }: { data: TownStageResult }) {
  const { generatedTowns, landBounds } = data;
  const landW = Math.round(landBounds.maxX - landBounds.minX);
  const landH = Math.round(landBounds.maxZ - landBounds.minZ);

  return (
    <div className="space-y-4">
      <div className="px-2 py-1.5 rounded bg-bg-tertiary text-xs text-text-secondary">
        Land area: {landW}m × {landH}m
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStatCard label="Towns" value={generatedTowns.length} icon={Home} />
        <MiniStatCard
          label="Buildings"
          value={generatedTowns.reduce((sum, t) => sum + t.buildings.length, 0)}
          icon={MapPin}
        />
        <MiniStatCard
          label="Landmarks"
          value={generatedTowns.reduce(
            (sum, t) => sum + (t.landmarks?.length ?? 0),
            0,
          )}
          icon={MapPin}
        />
      </div>

      <div>
        <h4 className="text-[10px] text-text-tertiary uppercase tracking-[0.12em] mb-1">
          Towns ({generatedTowns.length})
        </h4>
        <div className="space-y-1">
          {generatedTowns.map((town) => (
            <div
              key={town.id}
              className="flex items-center justify-between px-2 py-1.5 rounded bg-bg-tertiary text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Home size={12} className="text-amber-400 flex-shrink-0" />
                <span className="text-text-primary font-medium truncate">
                  {town.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-text-tertiary flex-shrink-0 ml-2 tabular-nums">
                <span className="capitalize">{town.size}</span>
                <span>{town.biome}</span>
                <span>{town.buildings.length} bldg</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
