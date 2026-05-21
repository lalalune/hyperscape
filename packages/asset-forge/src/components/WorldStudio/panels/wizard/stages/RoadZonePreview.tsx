/**
 * RoadZonePreview — Preview panel showing generated road network and zone results
 */

import { MapPin, Route } from "lucide-react";

import {
  DEFAULT_TIERS,
  type RoadZoneStageResult,
} from "../../../hooks/useZoneAutoGen";
import { MiniStatCard } from "../WizardSharedUI";

export function RoadZonePreview({ data }: { data: RoadZoneStageResult }) {
  const { zones, roads, stats } = data;

  return (
    <div className="space-y-4">
      <div className="px-2 py-1.5 rounded bg-bg-tertiary text-xs text-text-secondary">
        {Math.round(stats.totalArea).toLocaleString()}m² zoned
        <span className="text-text-tertiary ml-1">
          ({stats.zoneMerged} zones merged)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStatCard
          label="Zones"
          value={stats.zonesGenerated}
          icon={MapPin}
        />
        <MiniStatCard label="Roads" value={roads.length} icon={Route} />
        <MiniStatCard
          label="Road Length"
          value={`${Math.round(
            roads.reduce(
              (sum, r) =>
                sum +
                r.path.reduce((len, p, i) => {
                  if (i === 0) return 0;
                  const prev = r.path[i - 1];
                  return (
                    len + Math.sqrt((p.x - prev.x) ** 2 + (p.z - prev.z) ** 2)
                  );
                }, 0),
              0,
            ),
          )}m`}
          icon={Route}
        />
      </div>

      {/* Tier breakdown */}
      <div>
        <h4 className="text-[10px] text-text-tertiary uppercase tracking-[0.12em] mb-1">
          Tier Breakdown
        </h4>
        <div className="space-y-0.5">
          {stats.tierBreakdown
            .filter((tb) => tb.zoneCount > 0)
            .map((tb) => (
              <div
                key={tb.tierName}
                className="flex items-center justify-between px-2 py-1 rounded bg-bg-tertiary text-xs"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-sm"
                    style={{
                      backgroundColor:
                        DEFAULT_TIERS.find((t) => t.name === tb.tierName)
                          ?.color ?? "#7A7A82",
                    }}
                  />
                  <span className="text-text-primary font-medium">
                    {tb.tierName}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-text-secondary tabular-nums">
                  <span>{tb.zoneCount} zones</span>
                  <span>{Math.round(tb.area).toLocaleString()}m²</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Zone list */}
      <div>
        <h4 className="text-[10px] text-text-tertiary uppercase tracking-[0.12em] mb-1">
          Zones ({zones.length})
        </h4>
        <div className="max-h-[180px] overflow-y-auto space-y-px border border-border-primary rounded">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center justify-between px-2 py-1 text-xs hover:bg-bg-tertiary"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor:
                      DEFAULT_TIERS[zone.tierIndex]?.color ?? "#7A7A82",
                  }}
                />
                <span className="text-text-primary truncate">{zone.name}</span>
              </div>
              <div className="flex items-center gap-2 text-text-tertiary flex-shrink-0 ml-2 tabular-nums">
                <span>{zone.biome}</span>
                <span>{Math.round(zone.area).toLocaleString()}m²</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
