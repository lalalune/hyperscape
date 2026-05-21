/**
 * RoadZoneStageConfig — Configuration panel for the Roads & Zones generation stage
 */

import { RefreshCw } from "lucide-react";

import type { AutoGenConfig } from "../../../types";
import { ConfigField } from "../WizardSharedUI";

export function RoadZoneStageConfig({
  config,
  onConfigChange,
  rzSeed,
  onRzSeedChange,
}: {
  config: AutoGenConfig;
  onConfigChange: (c: AutoGenConfig) => void;
  rzSeed: number;
  onRzSeedChange: (n: number) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-text-primary">Roads & Zones</h4>
      <p className="text-[10px] text-text-tertiary">
        Generate difficulty zones via flood-fill + road network between towns.
        Zones are graded by distance from towns + biome modifiers.
      </p>
      <div className="space-y-2">
        <ConfigField
          label="Seed"
          type="number"
          value={rzSeed}
          onChange={onRzSeedChange}
          suffix={
            <button
              className="p-0.5 rounded hover:bg-bg-secondary text-text-tertiary"
              onClick={() => onRzSeedChange(Math.floor(Math.random() * 999999))}
            >
              <RefreshCw size={10} />
            </button>
          }
        />
        <ConfigField
          label="Grid Resolution (m)"
          type="number"
          value={config.gridResolution}
          onChange={(v) =>
            onConfigChange({
              ...config,
              gridResolution: Math.max(5, Math.min(50, v)),
            })
          }
          min={5}
          max={50}
        />
        <ConfigField
          label="Min Zone Area (m²)"
          type="number"
          value={config.minZoneArea}
          onChange={(v) =>
            onConfigChange({
              ...config,
              minZoneArea: Math.max(100, Math.min(50000, v)),
            })
          }
          min={100}
          max={50000}
        />
        <ConfigField
          label="Max Zone Span (m)"
          type="number"
          value={config.maxZoneSpan}
          onChange={(v) =>
            onConfigChange({
              ...config,
              maxZoneSpan: Math.max(50, Math.min(1000, v)),
            })
          }
          min={50}
          max={1000}
        />
      </div>
      {/* Tier summary */}
      <div className="space-y-1">
        <span className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
          Tiers
        </span>
        {config.tiers.map((tier) => (
          <div key={tier.name} className="flex items-center gap-2 text-[10px]">
            <div
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: tier.color }}
            />
            <span className="text-text-secondary">{tier.name}</span>
            <span className="text-text-tertiary ml-auto">
              {tier.scalarRange[0].toFixed(2)}-{tier.scalarRange[1].toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
