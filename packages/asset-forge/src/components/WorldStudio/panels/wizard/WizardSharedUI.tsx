/**
 * WizardSharedUI — Shared UI primitives used across wizard stages
 *
 * Contains: MiniStatCard, ConfigField, StagePlaceholder
 */

import { MapPin, Route } from "lucide-react";
import React from "react";

import { WIZARD_STEPS } from "../../utils/generationStateMachine";

// Step icons for the 3 stages (re-exported for shared use)
import { Home, Route as RouteIcon, Users } from "lucide-react";
export const STEP_ICONS = [Home, RouteIcon, Users];

// ============== MINI STAT CARD ==============

export function MiniStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: typeof MapPin;
}) {
  return (
    <div className="bg-bg-tertiary rounded p-2 text-center">
      <Icon size={12} className="mx-auto text-text-tertiary mb-0.5" />
      <div className="text-xs font-semibold text-text-primary">{value}</div>
      <div className="text-[9px] text-text-tertiary">{label}</div>
    </div>
  );
}

// ============== CONFIG FIELD ==============

export function ConfigField({
  label,
  type,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  type: "number";
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
        {label}
      </label>
      <div className="flex items-center gap-1 mt-0.5">
        <input
          type={type}
          className="flex-1 bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-xs text-text-primary w-full"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        />
        {suffix}
      </div>
    </div>
  );
}

// ============== STAGE PLACEHOLDER ==============

export function StagePlaceholder({
  stepIndex,
  hasPriorStages,
}: {
  stepIndex: number;
  hasPriorStages: boolean;
}) {
  const descriptions: Record<number, string> = {
    0: "Configure town count and spacing, then generate to place towns on the terrain.",
    1: "Generate difficulty zones and road network based on town placement.",
    2: "Populate mobs and resources across the generated zones.",
  };

  const Icon = STEP_ICONS[stepIndex] ?? Route;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
        <Icon size={20} className="text-text-tertiary" />
      </div>
      <span className="text-xs text-text-secondary">
        {descriptions[stepIndex] ?? "Click Generate to continue."}
      </span>
      {!hasPriorStages && stepIndex > 0 && (
        <span className="text-[10px] text-amber-400 mt-2">
          Complete previous stages first.
        </span>
      )}
    </div>
  );
}
