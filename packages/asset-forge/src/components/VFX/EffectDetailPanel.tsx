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
    <div className="rounded-md border border-border-primary overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-bg-tertiary transition-colors duration-300 ease-out"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-text-primary">
          {layer.pool}{" "}
          <span className="text-text-tertiary font-normal font-mono tabular-nums">
            ×{layer.count}
          </span>
        </span>
        <ChevronDown
          size={11}
          strokeWidth={1.5}
          className={`text-text-tertiary transition-transform duration-300 ease-out ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-3.5 pb-3 pt-1 text-xs text-text-secondary space-y-1.5 border-t border-border-primary/50">
          <div className="flex justify-between gap-3">
            <span className="text-text-tertiary uppercase tracking-[0.1em] text-[10px]">
              Lifetime
            </span>
            <span className="font-mono tabular-nums">{layer.lifetime}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-text-tertiary uppercase tracking-[0.1em] text-[10px]">
              Scale
            </span>
            <span className="font-mono tabular-nums">{layer.scale}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-text-tertiary uppercase tracking-[0.1em] text-[10px]">
              Sharpness
            </span>
            <span className="font-mono tabular-nums">{layer.sharpness}</span>
          </div>
          {layer.notes && (
            <p className="text-text-tertiary leading-relaxed pt-1.5">
              {layer.notes}
            </p>
          )}
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

/**
 * Phase backgrounds visualise the teleport timeline as a single-hue
 * Aether-Blue gradient: build → peak → sustain → fade. The Erupt
 * phase uses Forge Gold to mark the "earned moment".
 */
const PHASE_BG: Record<string, { bg: string; fg: string }> = {
  Gather: { bg: "bg-accent-aether/70", fg: "text-text-primary" },
  Erupt: { bg: "bg-primary", fg: "text-bg-primary" },
  Sustain: { bg: "bg-accent-aether/40", fg: "text-text-primary" },
  Fade: { bg: "bg-accent-aether/20", fg: "text-text-secondary" },
};

export const PhaseTimeline: React.FC<{ effect: TeleportEffect }> = ({
  effect,
}) => (
  <div className="space-y-2">
    <div className="flex h-7 rounded-md overflow-hidden border border-border-primary">
      {effect.phases.map((phase) => {
        const width = (phase.end - phase.start) * 100;
        const style = PHASE_BG[phase.name] ?? {
          bg: "bg-bg-secondary",
          fg: "text-text-secondary",
        };
        return (
          <div
            key={phase.name}
            className={`${style.bg} flex items-center justify-center`}
            style={{ width: `${width}%` }}
            title={`${phase.name}: ${(phase.start * effect.duration).toFixed(2)}s – ${(phase.end * effect.duration).toFixed(2)}s`}
          >
            <span
              className={`text-[10px] font-medium ${style.fg} truncate px-1 uppercase tracking-[0.1em]`}
            >
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
    <div className="flex flex-col gap-2.5">
      {effect.variants.map((variant) => (
        <div
          key={variant.label}
          className="rounded-md border border-border-primary p-3"
        >
          <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-2">
            {variant.label}
          </div>
          <ColorSwatchRow colors={variant.colors} />
        </div>
      ))}
    </div>
  );
};
