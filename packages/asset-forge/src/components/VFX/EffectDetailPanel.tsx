import { ChevronDown } from "lucide-react";
import React, { useState } from "react";

import type {
  ColorEntry,
  GlowEffect,
  GlowLayer,
  ParamEntry,
  TeleportEffect,
  CombatHudEffect,
} from "../../data/vfx-catalog";

// ---------------------------------------------------------------------------
// ColorSwatch
// ---------------------------------------------------------------------------

export const ColorSwatch: React.FC<{ entry: ColorEntry }> = ({ entry }) => (
  <div className="flex items-center gap-2">
    <div
      className="w-5 h-5 rounded border border-border-primary shrink-0"
      style={{ backgroundColor: entry.hex }}
    />
    <span className="text-xs text-text-secondary">{entry.label}</span>
    <span className="text-xs text-text-tertiary font-mono ml-auto">
      {entry.hex}
    </span>
  </div>
);

export const ColorSwatchRow: React.FC<{ colors: ColorEntry[] }> = ({
  colors,
}) => (
  <div className="flex flex-col gap-1.5">
    {colors.map((c) => (
      <ColorSwatch key={c.label} entry={c} />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// ParameterTable
// ---------------------------------------------------------------------------

export const ParameterTable: React.FC<{ params: ParamEntry[] }> = ({
  params,
}) => (
  <table className="w-full text-xs">
    <tbody>
      {params.map((p) => (
        <tr
          key={p.label}
          className="border-b border-border-primary/50 last:border-0"
        >
          <td className="py-1.5 pr-3 text-text-secondary whitespace-nowrap">
            {p.label}
          </td>
          <td className="py-1.5 text-text-primary font-mono text-right">
            {String(p.value)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

// ---------------------------------------------------------------------------
// LayerBreakdown (for glow effects)
// ---------------------------------------------------------------------------

const LayerCard: React.FC<{ layer: GlowLayer }> = ({ layer }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border-primary/50 rounded">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-bg-tertiary transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-text-primary">
          {layer.pool}{" "}
          <span className="text-text-tertiary font-normal">×{layer.count}</span>
        </span>
        <ChevronDown
          size={12}
          className={`text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-2 text-xs text-text-secondary space-y-1">
          <div>
            Lifetime: <span className="font-mono">{layer.lifetime}</span>
          </div>
          <div>
            Scale: <span className="font-mono">{layer.scale}</span>
          </div>
          <div>
            Sharpness: <span className="font-mono">{layer.sharpness}</span>
          </div>
          <div className="text-text-tertiary italic">{layer.notes}</div>
        </div>
      )}
    </div>
  );
};

export const LayerBreakdown: React.FC<{ effect: GlowEffect }> = ({
  effect,
}) => (
  <div className="flex flex-col gap-1">
    {effect.layers.map((layer) => (
      <LayerCard key={layer.pool} layer={layer} />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// PhaseTimeline (for teleport)
// ---------------------------------------------------------------------------

const PHASE_BG: Record<string, string> = {
  Gather: "bg-cyan-600",
  Erupt: "bg-white",
  Sustain: "bg-cyan-300",
  Fade: "bg-blue-800",
};

export const PhaseTimeline: React.FC<{ effect: TeleportEffect }> = ({
  effect,
}) => (
  <div className="space-y-2">
    <div className="flex h-6 rounded overflow-hidden border border-border-primary/50">
      {effect.phases.map((phase) => {
        const width = (phase.end - phase.start) * 100;
        return (
          <div
            key={phase.name}
            className={`${PHASE_BG[phase.name] ?? "bg-gray-500"} flex items-center justify-center`}
            style={{ width: `${width}%` }}
            title={`${phase.name}: ${(phase.start * effect.duration).toFixed(2)}s – ${(phase.end * effect.duration).toFixed(2)}s`}
          >
            <span className="text-[10px] font-bold text-black/70 truncate px-1">
              {phase.name}
            </span>
          </div>
        );
      })}
    </div>
    <div className="flex justify-between text-[10px] text-text-tertiary font-mono px-0.5">
      <span>0s</span>
      <span>{effect.duration}s</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// TeleportComponents list
// ---------------------------------------------------------------------------

export const TeleportComponents: React.FC<{ effect: TeleportEffect }> = ({
  effect,
}) => (
  <div className="flex flex-col gap-1">
    {effect.components.map((comp) => (
      <div
        key={comp.name}
        className="flex items-start gap-2 text-xs py-1 border-b border-border-primary/30 last:border-0"
      >
        <div
          className="w-3 h-3 rounded-sm shrink-0 mt-0.5 border border-border-primary"
          style={{ backgroundColor: comp.color }}
        />
        <div>
          <div className="font-medium text-text-primary">{comp.name}</div>
          <div className="text-text-tertiary">{comp.description}</div>
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// VariantsPanel (for combat HUD effects with variants)
// ---------------------------------------------------------------------------

export const VariantsPanel: React.FC<{ effect: CombatHudEffect }> = ({
  effect,
}) => {
  if (!effect.variants?.length) return null;

  return (
    <div className="flex flex-col gap-2">
      {effect.variants.map((variant) => (
        <div
          key={variant.label}
          className="border border-border-primary/50 rounded p-2"
        >
          <div className="text-xs font-medium text-text-primary mb-1.5">
            {variant.label}
          </div>
          <ColorSwatchRow colors={variant.colors} />
        </div>
      ))}
    </div>
  );
};
