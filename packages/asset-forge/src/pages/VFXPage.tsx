import {
  ChevronDown,
  Flame,
  Sparkles,
  Sword,
  Target,
  Trophy,
  Waves,
} from "lucide-react";
import React, { useState } from "react";

import {
  ColorSwatchRow,
  LayerBreakdown,
  ParameterTable,
  PhaseTimeline,
  TeleportComponents,
  VariantsPanel,
} from "../components/VFX/EffectDetailPanel";
import { VFXPreview } from "../components/VFX/VFXPreview";
import type {
  CombatHudEffect,
  EffectCategory,
  GlowEffect,
  TeleportEffect,
  VFXEffect,
} from "../data/vfx-catalog";
import { VFX_CATEGORIES } from "../data/vfx-catalog";

// ---------------------------------------------------------------------------
// Category icons
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<EffectCategory, React.FC<{ size?: number }>> = {
  spells: Sparkles,
  arrows: Target,
  glow: Flame,
  fishing: Waves,
  teleport: Sparkles,
  combatHud: Sword,
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  selected: VFXEffect | null;
  onSelect: (effect: VFXEffect) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selected, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <aside className="w-[280px] shrink-0 border-r border-border-primary bg-bg-secondary overflow-y-auto">
      <div className="px-4 py-3 border-b border-border-primary">
        <h2 className="text-sm font-semibold text-text-primary">VFX Catalog</h2>
        <p className="text-xs text-text-tertiary mt-0.5">
          {VFX_CATEGORIES.reduce((n, c) => n + c.effects.length, 0)} effects
        </p>
      </div>

      {VFX_CATEGORIES.map((cat) => {
        const Icon = CATEGORY_ICONS[cat.id];
        const isCollapsed = collapsed[cat.id] ?? false;

        return (
          <div key={cat.id}>
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-text-secondary hover:bg-bg-tertiary transition-colors border-b border-border-primary/40"
              onClick={() => toggle(cat.id)}
            >
              <Icon size={14} />
              <span className="flex-1 text-left">{cat.label}</span>
              <span className="text-text-tertiary font-normal">
                {cat.effects.length}
              </span>
              <ChevronDown
                size={12}
                className={`text-text-tertiary transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
              />
            </button>

            {!isCollapsed &&
              cat.effects.map((fx) => (
                <button
                  key={fx.id}
                  className={`w-full text-left px-6 py-1.5 text-xs transition-colors ${
                    selected?.id === fx.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                  }`}
                  onClick={() => onSelect(fx)}
                >
                  {fx.name}
                </button>
              ))}
          </div>
        );
      })}
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function isTeleport(e: VFXEffect): e is TeleportEffect {
  return e.category === "teleport";
}
function isGlow(e: VFXEffect): e is GlowEffect {
  return e.category === "glow";
}
function isCombatHud(e: VFXEffect): e is CombatHudEffect {
  return e.category === "combatHud";
}

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, children, icon }) => (
  <div>
    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
      {icon}
      {title}
    </h3>
    {children}
  </div>
);

const DetailPanel: React.FC<{ effect: VFXEffect }> = ({ effect }) => {
  const categoryLabel =
    VFX_CATEGORIES.find((c) => c.id === effect.category)?.label ?? "";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs text-primary font-medium mb-0.5">
          {categoryLabel}
        </p>
        <h1 className="text-xl font-bold text-text-primary">{effect.name}</h1>
      </div>

      {/* Live preview */}
      <div className="mb-5">
        <VFXPreview effect={effect} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Colors */}
        {"colors" in effect && effect.colors.length > 0 && (
          <Section title="Colors">
            <ColorSwatchRow colors={effect.colors} />
          </Section>
        )}

        {/* Parameters */}
        {"params" in effect && effect.params.length > 0 && (
          <Section title="Parameters">
            <ParameterTable params={effect.params} />
          </Section>
        )}

        {/* Glow layers */}
        {isGlow(effect) && (
          <Section title="Layers">
            <LayerBreakdown effect={effect} />
          </Section>
        )}

        {/* Glow palette */}
        {isGlow(effect) && (
          <Section title="Palette">
            <ColorSwatchRow colors={effect.palette} />
          </Section>
        )}

        {/* Teleport phase timeline */}
        {isTeleport(effect) && (
          <Section title="Phase Timeline" icon={<Trophy size={12} />}>
            <PhaseTimeline effect={effect} />
          </Section>
        )}

        {/* Teleport components */}
        {isTeleport(effect) && (
          <div className="lg:col-span-2">
            <Section title="Components">
              <TeleportComponents effect={effect} />
            </Section>
          </div>
        )}

        {/* Combat HUD variants */}
        {isCombatHud(effect) && effect.variants && (
          <Section title="Variants">
            <VariantsPanel effect={effect} />
          </Section>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState: React.FC = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <Sparkles size={40} className="mx-auto text-text-tertiary mb-3" />
      <p className="text-sm text-text-secondary">
        Select an effect to view details
      </p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const VFXPage: React.FC = () => {
  const [selected, setSelected] = useState<VFXEffect | null>(null);

  return (
    <div className="flex h-[calc(100vh-60px)]">
      <Sidebar selected={selected} onSelect={setSelected} />
      {selected ? <DetailPanel effect={selected} /> : <EmptyState />}
    </div>
  );
};

export default VFXPage;
