/**
 * PopulationPreview — Preview panel showing generated mob/resource population results
 */

import { Skull, TreePine, Mountain } from "lucide-react";

import {
  DEFAULT_TIERS,
  type PopulationStageResult,
  type RoadZoneStageResult,
} from "../../../hooks/useZoneAutoGen";
import { MiniStatCard } from "../WizardSharedUI";

export function PopulationPreview({
  data,
  zones,
}: {
  data: PopulationStageResult;
  zones?: RoadZoneStageResult["zones"];
}) {
  const { mobSpawns, resources, stats } = data;

  // Count entities by type
  const mobCounts = new Map<string, number>();
  for (const m of mobSpawns) {
    mobCounts.set(m.name, (mobCounts.get(m.name) ?? 0) + 1);
  }
  const resCounts = new Map<string, number>();
  for (const r of resources) {
    resCounts.set(r.name, (resCounts.get(r.name) ?? 0) + 1);
  }

  // Tier distribution
  const tierDistribution = new Map<
    string,
    { mobs: number; resources: number }
  >();
  if (zones) {
    for (const zone of zones) {
      const tierName = DEFAULT_TIERS[zone.tierIndex]?.name ?? "Unknown";
      const entry = tierDistribution.get(tierName) ?? {
        mobs: 0,
        resources: 0,
      };
      entry.mobs += mobSpawns.filter(
        (m) => m.sourceRegionId === zone.id,
      ).length;
      entry.resources += resources.filter(
        (r) => r.sourceRegionId === zone.id,
      ).length;
      tierDistribution.set(tierName, entry);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStatCard label="Mobs" value={stats.totalMobs} icon={Skull} />
        <MiniStatCard
          label="Resources"
          value={stats.totalResources}
          icon={TreePine}
        />
        <MiniStatCard label="Mines" value={stats.totalMines} icon={Mountain} />
      </div>

      {/* Tier distribution */}
      {tierDistribution.size > 0 && (
        <div>
          <h4 className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
            Entities by Tier
          </h4>
          <div className="space-y-0.5">
            {[...tierDistribution.entries()]
              .filter(([, v]) => v.mobs > 0 || v.resources > 0)
              .map(([tierName, counts]) => (
                <div
                  key={tierName}
                  className="flex items-center justify-between px-2 py-1 rounded bg-bg-tertiary text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{
                        backgroundColor:
                          DEFAULT_TIERS.find((t) => t.name === tierName)
                            ?.color ?? "#7A7A82",
                      }}
                    />
                    <span className="text-text-primary font-medium">
                      {tierName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-text-secondary tabular-nums">
                    <span>{counts.mobs} mobs</span>
                    <span>{counts.resources} res</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Mine list */}
      {data.mines && data.mines.length > 0 && (
        <div>
          <h4 className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
            Mines ({data.mines.length})
          </h4>
          <div className="max-h-[100px] overflow-y-auto space-y-px border border-border-primary rounded">
            {data.mines.map((mine) => (
              <div
                key={mine.id}
                className="flex items-center justify-between px-2 py-1 text-xs hover:bg-bg-tertiary"
              >
                <span className="text-text-primary">{mine.name}</span>
                <span className="text-text-tertiary tabular-nums">
                  {mine.oreRocks.reduce((s, o) => s + o.count, 0)} rocks
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mob types */}
      <div>
        <h4 className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
          Mob Types ({mobCounts.size})
        </h4>
        <div className="max-h-[120px] overflow-y-auto space-y-px border border-border-primary rounded">
          {[...mobCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between px-2 py-1 text-xs hover:bg-bg-tertiary"
              >
                <span className="text-text-primary">{name}</span>
                <span className="text-text-tertiary tabular-nums">
                  ×{count}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Resource types */}
      <div>
        <h4 className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">
          Resource Types ({resCounts.size})
        </h4>
        <div className="max-h-[120px] overflow-y-auto space-y-px border border-border-primary rounded">
          {[...resCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between px-2 py-1 text-xs hover:bg-bg-tertiary"
              >
                <span className="text-text-primary">{name}</span>
                <span className="text-text-tertiary tabular-nums">
                  ×{count}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
