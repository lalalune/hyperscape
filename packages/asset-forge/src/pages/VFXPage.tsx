import {
  ChevronDown,
  Droplets,
  Flame,
  Layers,
  Palette,
  Sliders,
  Sparkles,
  Sword,
  Target,
  Trophy,
  Waves,
  Zap,
} from "lucide-react";
import { useMemo, useState, type FC, type ReactNode } from "react";

import {
  ColorSwatchRow,
  LayerBreakdown,
  ParameterTable,
  PhaseTimeline,
  TeleportComponents,
  VariantsPanel,
} from "../components/VFX/EffectDetailPanel";
import { VFXPreview } from "../components/VFX/VFXPreview";
import { EmptyHero, FilterInput } from "../components/shared/page";
import type {
  CombatHudEffect,
  EffectCategory,
  GlowEffect,
  TeleportEffect,
  VFXEffect,
} from "../data/vfx-catalog";
import { VFX_CATEGORIES } from "../data/vfx-catalog";

// ---------------------------------------------------------------------------
// Category icons — one icon per category; spells and teleport stay distinct
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<EffectCategory, FC<{ size?: number }>> = {
  spells: Sparkles,
  arrows: Target,
  glow: Flame,
  fishing: Waves,
  teleport: Zap,
  combatHud: Sword,
};

// ---------------------------------------------------------------------------
// Sidebar — searchable category catalog
// ---------------------------------------------------------------------------

interface SidebarProps {
  selected: VFXEffect | null;
  onSelect: (effect: VFXEffect) => void;
}

const Sidebar: FC<SidebarProps> = ({ selected, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalEffects = useMemo(
    () => VFX_CATEGORIES.reduce((n, c) => n + c.effects.length, 0),
    [],
  );

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return VFX_CATEGORIES;
    return VFX_CATEGORIES.map((cat) => ({
      ...cat,
      effects: cat.effects.filter(
        (fx) =>
          fx.name.toLowerCase().includes(q) ||
          fx.id.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.effects.length > 0);
  }, [query]);

  const matchCount = useMemo(
    () => filteredCategories.reduce((n, c) => n + c.effects.length, 0),
    [filteredCategories],
  );

  // Filter overrides per-category collapse — searching should reveal results
  const isQuerying = query.trim().length > 0;

  return (
    <aside className="w-[320px] shrink-0 border-r border-border-primary bg-bg-primary overflow-y-auto scrollbar-thin flex flex-col">
      {/* Editorial header */}
      <header className="px-5 pt-6 pb-5 border-b border-border-primary flex-shrink-0">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-display text-base font-medium text-text-primary tracking-tight">
            Catalog
          </span>
          <span className="ml-auto text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono tabular-nums normal-case">
            {isQuerying ? `${matchCount} / ${totalEffects}` : totalEffects}
          </span>
        </div>
        <FilterInput
          value={query}
          onChange={setQuery}
          placeholder="Search effects…"
        />
        {isQuerying && matchCount > 0 && (
          <p className="mt-2.5 text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
            {matchCount} result{matchCount === 1 ? "" : "s"} across{" "}
            {filteredCategories.length} categor
            {filteredCategories.length === 1 ? "y" : "ies"}
          </p>
        )}
      </header>

      <div className="flex-1 py-1">
        {filteredCategories.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-xs text-text-tertiary mb-1">No effects match</p>
            <p className="text-[11px] text-text-tertiary font-mono normal-case truncate">
              &ldquo;{query}&rdquo;
            </p>
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            const isExpanded = isQuerying || !(collapsed[cat.id] ?? false);
            const containsActive =
              selected !== null &&
              cat.effects.some((fx) => fx.id === selected.id);

            return (
              <div
                key={cat.id}
                className="border-t border-border-primary first:border-t-0"
              >
                {/* Category header */}
                <button
                  type="button"
                  className="group w-full flex items-center gap-2.5 px-5 py-3.5 hover:bg-bg-tertiary/60 transition-colors duration-300 ease-out"
                  onClick={() => toggle(cat.id)}
                >
                  <Icon size={12} />
                  <span className="flex-1 text-left text-[11px] text-text-secondary uppercase tracking-[0.16em] font-medium">
                    {cat.label}
                  </span>
                  {containsActive && (
                    <span
                      aria-hidden
                      className="inline-block w-1 h-1 rounded-full bg-primary flex-shrink-0"
                    />
                  )}
                  <span className="text-[10px] text-text-tertiary font-mono tabular-nums w-6 text-right">
                    {cat.effects.length}
                  </span>
                  <ChevronDown
                    size={11}
                    strokeWidth={1.5}
                    className={`text-text-tertiary transition-transform duration-300 ease-out ${
                      isExpanded ? "" : "-rotate-90"
                    }`}
                  />
                </button>

                {/* Effects */}
                {isExpanded && (
                  <ul className="pb-2">
                    {cat.effects.map((fx) => {
                      const isActive = selected?.id === fx.id;
                      return (
                        <li key={fx.id}>
                          <button
                            type="button"
                            className={`group relative w-full text-left pl-8 pr-5 py-2 text-[13px] transition-colors duration-300 ease-out flex items-center ${
                              isActive
                                ? "text-primary bg-bg-tertiary/40"
                                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/40"
                            }`}
                            onClick={() => onSelect(fx)}
                          >
                            <span
                              aria-hidden
                              className={`absolute left-0 top-1.5 bottom-1.5 w-px bg-primary transition-opacity duration-300 ease-out ${
                                isActive
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-50"
                              }`}
                            />
                            <span className="truncate">{fx.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

// ---------------------------------------------------------------------------
// Detail panel — editorial brand layout
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

interface DetailSectionProps {
  number: string;
  title: string;
  icon?: ReactNode;
  meta?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

const DetailSection: FC<DetailSectionProps> = ({
  number,
  title,
  icon,
  meta,
  fullWidth,
  children,
}) => (
  <section
    className={`rounded-lg bg-bg-tertiary border border-border-primary p-6 ${
      fullWidth ? "lg:col-span-2" : ""
    }`}
  >
    <header className="flex items-baseline gap-3 pb-4 mb-4 border-b border-border-primary">
      <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
        {number}
      </span>
      <span className="inline-flex items-center gap-1.5 font-display text-base font-medium text-text-primary tracking-tight">
        {icon}
        {title}
      </span>
      {meta && (
        <span className="ml-auto text-[10px] text-text-tertiary uppercase tracking-[0.14em] font-mono normal-case">
          {meta}
        </span>
      )}
    </header>
    {children}
  </section>
);

const DetailPanel: FC<{ effect: VFXEffect }> = ({ effect }) => {
  const categoryLabel =
    VFX_CATEGORIES.find((c) => c.id === effect.category)?.label ?? "";

  // Build section list lazily so numbering is contiguous
  const sections: { node: ReactNode; key: string }[] = [];

  if ("colors" in effect && effect.colors.length > 0) {
    sections.push({
      key: "colors",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Colors"
          icon={<Palette size={14} strokeWidth={1.5} />}
          meta={`${effect.colors.length}`}
        >
          <ColorSwatchRow colors={effect.colors} />
        </DetailSection>
      ),
    });
  }

  if ("params" in effect && effect.params.length > 0) {
    sections.push({
      key: "params",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Parameters"
          icon={<Sliders size={14} strokeWidth={1.5} />}
          meta={`${effect.params.length}`}
        >
          <ParameterTable params={effect.params} />
        </DetailSection>
      ),
    });
  }

  if (isGlow(effect)) {
    sections.push({
      key: "layers",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Layers"
          icon={<Layers size={14} strokeWidth={1.5} />}
          meta={`${effect.layers.length}`}
        >
          <LayerBreakdown effect={effect} />
        </DetailSection>
      ),
    });
    sections.push({
      key: "palette",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Palette"
          icon={<Palette size={14} strokeWidth={1.5} />}
          meta={`${effect.palette.length}`}
        >
          <ColorSwatchRow colors={effect.palette} />
        </DetailSection>
      ),
    });
  }

  if (isTeleport(effect)) {
    sections.push({
      key: "timeline",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Phase timeline"
          icon={<Trophy size={14} strokeWidth={1.5} />}
          meta={`${effect.duration}s`}
        >
          <PhaseTimeline effect={effect} />
        </DetailSection>
      ),
    });
    sections.push({
      key: "components",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Components"
          icon={<Droplets size={14} strokeWidth={1.5} />}
          meta={`${effect.components.length}`}
          fullWidth
        >
          <TeleportComponents effect={effect} />
        </DetailSection>
      ),
    });
  }

  if (isCombatHud(effect) && effect.variants) {
    sections.push({
      key: "variants",
      node: (
        <DetailSection
          number={String(sections.length + 2).padStart(2, "0")}
          title="Variants"
          icon={<Layers size={14} strokeWidth={1.5} />}
          meta={`${effect.variants.length}`}
        >
          <VariantsPanel effect={effect} />
        </DetailSection>
      ),
    });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary relative">
      {/* Subtle atmospheric backdrop — top-anchored Graphite radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(28,30,34,0.6) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-10 py-12">
        {/* HERO */}
        <header className="mb-10">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-[11px] text-primary uppercase tracking-[0.14em]">
              {categoryLabel}
            </span>
            <span className="text-text-tertiary/40">·</span>
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case">
              {effect.id}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05]">
            {effect.name}
          </h1>
        </header>

        {/* 01 / PREVIEW */}
        <section className="mb-8 rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
          <header className="flex items-baseline gap-3 px-6 pt-5 pb-4 border-b border-border-primary">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              01
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              Live preview
            </span>
            <span className="ml-auto text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
              WebGPU
            </span>
          </header>
          <VFXPreview effect={effect} />
        </section>

        {/* Numbered detail sections (02+) */}
        {sections.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {sections.map((s) => (
              <div key={s.key}>{s.node}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState: FC = () => (
  <div className="flex-1 flex items-center justify-center bg-bg-primary px-10 relative overflow-hidden">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
      style={{
        background:
          "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(28,30,34,0.5) 0%, transparent 70%)",
      }}
    />
    <div className="relative w-full max-w-md">
      <EmptyHero
        message="Pick an effect"
        subtitle="Choose a VFX from the catalog on the left to preview it and inspect colors, parameters, and timing."
      />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function VFXPage() {
  const [selected, setSelected] = useState<VFXEffect | null>(null);

  return (
    <div className="flex h-[calc(100vh-44px)] bg-bg-primary">
      <Sidebar selected={selected} onSelect={setSelected} />
      {selected ? <DetailPanel effect={selected} /> : <EmptyState />}
    </div>
  );
}

export default VFXPage;
