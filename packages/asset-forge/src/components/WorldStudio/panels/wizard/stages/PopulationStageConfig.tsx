/**
 * PopulationStageConfig — Configuration panel for the Population generation stage
 */

import type { AutoGenConfig } from "../../../types";
import { ConfigField } from "../WizardSharedUI";

export function PopulationStageConfig({
  config,
  onConfigChange,
}: {
  config: AutoGenConfig;
  onConfigChange: (c: AutoGenConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-text-primary">
        Entity Population
      </h4>
      <p className="text-[10px] text-text-tertiary">
        Scatter mobs and resources across zones. Mobs placed first, then
        resources with mob-proximity buffer per tier.
      </p>
      <div className="space-y-2">
        <ConfigField
          label="Mob Spacing (m)"
          type="number"
          value={config.mobSpacing}
          onChange={(v) =>
            onConfigChange({
              ...config,
              mobSpacing: Math.max(5, Math.min(30, v)),
            })
          }
          min={5}
          max={30}
        />
        <ConfigField
          label="Resource Spacing (m)"
          type="number"
          value={config.resourceSpacing}
          onChange={(v) =>
            onConfigChange({
              ...config,
              resourceSpacing: Math.max(3, Math.min(20, v)),
            })
          }
          min={3}
          max={20}
        />
      </div>
      {/* Density presets */}
      <div>
        <span className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
          Density Preset
        </span>
        <div className="flex gap-1 mt-1">
          {(
            [
              { label: "Sparse", mob: 25, res: 15 },
              { label: "Normal", mob: 15, res: 8 },
              { label: "Dense", mob: 8, res: 4 },
            ] as const
          ).map((preset) => (
            <button
              key={preset.label}
              className={`px-2 py-1 rounded text-[10px] border ${
                config.mobSpacing === preset.mob &&
                config.resourceSpacing === preset.res
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border-primary text-text-secondary hover:bg-bg-tertiary"
              }`}
              onClick={() =>
                onConfigChange({
                  ...config,
                  mobSpacing: preset.mob,
                  resourceSpacing: preset.res,
                })
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
