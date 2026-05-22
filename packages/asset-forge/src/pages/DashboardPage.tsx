import {
  Wand2,
  Database,
  Map,
  Globe,
  Gamepad2,
  FileJson,
  Wrench,
  Shield,
  Hand,
  Shuffle,
  Image,
  Sparkles,
  Building2,
  Mountain,
  TreePine,
  Flower2,
  Route,
  Sprout,
  Anchor,
  BrickWall,
  Landmark,
  ArrowUpRight,
  Package,
  Cpu,
  Activity,
  Clock,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import { ForgeLogo } from "../components/shared/ForgeLogo";
import { ROUTES } from "../constants";

// =============================================================================
// Data
// =============================================================================

interface MarqueeCard {
  route: string;
  label: string;
  description: string;
  icon: LucideIcon;
  hint: string;
  stat?: string;
  statLabel?: string;
}

interface ToolCard {
  route: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

/** Top-row primary workflows — the three things users start here for. */
const MARQUEE: MarqueeCard[] = [
  {
    route: ROUTES.WORLD_STUDIO,
    label: "World Studio",
    description:
      "Compose worlds — terrain, biomes, structures, quests, mobs — with AI-assisted authoring.",
    icon: Map,
    hint: "Build a world",
    stat: "Procedural",
    statLabel: "Authoring",
  },
  {
    route: ROUTES.GENERATION,
    label: "Generate Assets",
    description:
      "Create 3D models, textures, sprites, and VFX through the AI generation pipeline.",
    icon: Wand2,
    hint: "Create with AI",
    stat: "GPT-4 · Meshy",
    statLabel: "Pipeline",
  },
  {
    route: ROUTES.ASSETS,
    label: "Asset Library",
    description:
      "Browse, organize, and re-deploy every asset, prefab, and pack in your library.",
    icon: Database,
    hint: "Browse library",
    stat: "Team-shared",
    statLabel: "Scope",
  },
];

const WORLD_TOOLS: ToolCard[] = [
  {
    route: ROUTES.WORLD_BUILDER,
    label: "World Builder",
    desc: "Legacy editor",
    icon: Globe,
  },
  {
    route: ROUTES.WORLD_EDITOR,
    label: "World Editor",
    desc: "Game systems",
    icon: Gamepad2,
  },
  {
    route: ROUTES.TERRAIN_GEN,
    label: "Terrain",
    desc: "Heightmaps & erosion",
    icon: Mountain,
  },
  {
    route: ROUTES.BUILDING_GEN,
    label: "Buildings",
    desc: "Towns & structures",
    icon: Building2,
  },
  {
    route: ROUTES.ROADS_GEN,
    label: "Roads",
    desc: "Path networks",
    icon: Route,
  },
  {
    route: ROUTES.LANDMARK_GEN,
    label: "Landmarks",
    desc: "Points of interest",
    icon: Landmark,
  },
  {
    route: ROUTES.DOCK_GEN,
    label: "Docks",
    desc: "Harbor structures",
    icon: Anchor,
  },
  {
    route: ROUTES.BRIDGE_GEN,
    label: "Bridges",
    desc: "River crossings",
    icon: BrickWall,
  },
];

const NATURE_TOOLS: ToolCard[] = [
  {
    route: ROUTES.TREE_GEN,
    label: "Trees",
    desc: "Procedural trees",
    icon: TreePine,
  },
  {
    route: ROUTES.PLANT_GEN,
    label: "Plants",
    desc: "Foliage & bushes",
    icon: Flower2,
  },
  {
    route: ROUTES.VEGETATION_GEN,
    label: "Vegetation",
    desc: "Grass & flowers",
    icon: Sprout,
  },
];

const PIPELINE_TOOLS: ToolCard[] = [
  {
    route: ROUTES.EQUIPMENT,
    label: "Equipment",
    desc: "Manage gear",
    icon: Wrench,
  },
  {
    route: ROUTES.ARMOR_FITTING,
    label: "Armor Fitting",
    desc: "Fit to avatar",
    icon: Shield,
  },
  {
    route: ROUTES.HAND_RIGGING,
    label: "Hand Rigging",
    desc: "Weapon grips",
    icon: Hand,
  },
  {
    route: ROUTES.RETARGET_ANIMATE,
    label: "Retarget",
    desc: "Animation retarget",
    icon: Shuffle,
  },
  {
    route: ROUTES.BATCH_SPRITES,
    label: "Sprites",
    desc: "Sprite sheets",
    icon: Image,
  },
  { route: ROUTES.VFX, label: "VFX", desc: "Visual effects", icon: Sparkles },
];

const DATA_TOOLS: ToolCard[] = [
  {
    route: ROUTES.MANIFESTS,
    label: "Manifests",
    desc: "Game data",
    icon: FileJson,
  },
  {
    route: ROUTES.ASSET_PACKS,
    label: "Asset Packs",
    desc: "Pack composition",
    icon: Package,
  },
];

const SYSTEM_STATS = [
  { label: "Renderer", value: "WebGPU + TSL", indicator: "online" as const },
  { label: "Physics", value: "PhysX WASM", indicator: "online" as const },
  {
    label: "Generation",
    value: "GPT-4 · Meshy AI",
    indicator: "ready" as const,
  },
  { label: "Build", value: "feat/world-studio", indicator: "active" as const },
];

// =============================================================================
// Time-aware greeting
// =============================================================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night build";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late night build";
}

// =============================================================================
// Subcomponents
// =============================================================================

/**
 * Atmospheric backdrop — drifting Graphite monoliths + Forge Gold horizon.
 * Pure CSS, no JS animation cost.
 */
function AtmosphericScene() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Volumetric Graphite ellipse anchored to top */}
      <div
        className="absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(28,30,34,0.75) 0%, transparent 75%)",
        }}
      />

      {/* Architectural monoliths — distant silhouettes */}
      <div
        className="absolute inset-y-0 left-[6%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.6) 30%, rgba(28,30,34,0.6) 70%, transparent 100%)",
          animation: "drift-y 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-y-0 left-[14%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.85) 35%, rgba(28,30,34,0.85) 65%, transparent 100%)",
          animation: "drift-y 22s ease-in-out infinite",
          animationDelay: "-7s",
        }}
      />
      <div
        className="absolute inset-y-0 right-[18%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.7) 32%, rgba(28,30,34,0.7) 68%, transparent 100%)",
          animation: "drift-y 25s ease-in-out infinite",
          animationDelay: "-12s",
        }}
      />
      <div
        className="absolute inset-y-0 right-[8%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.5) 38%, rgba(28,30,34,0.5) 62%, transparent 100%)",
          animation: "drift-y 20s ease-in-out infinite",
          animationDelay: "-3s",
        }}
      />

      {/* Forge Gold horizon — celestial light, slow pulse */}
      <div
        className="absolute inset-x-0 top-[420px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.22) 50%, transparent 95%)",
          animation: "celestial-pulse 8s ease-in-out infinite",
        }}
      />

      {/* Secondary horizon — softer, lower, offset */}
      <div
        className="absolute inset-x-0 top-[680px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 20%, rgba(212,175,55,0.08) 50%, transparent 80%)",
          animation: "celestial-pulse 14s ease-in-out infinite",
          animationDelay: "-4s",
        }}
      />
    </div>
  );
}

/** Small live status dot — slow pulse, brand-restrained. */
function StatusDot({ tone }: { tone: "online" | "ready" | "active" }) {
  const colorMap = {
    online: "bg-success",
    ready: "bg-primary",
    active: "bg-accent-aether",
  };
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${colorMap[tone]}`}
      style={{ animation: "status-pulse 2.4s ease-in-out infinite" }}
    />
  );
}

function MarqueeCardView({
  card,
  variant,
}: {
  card: MarqueeCard;
  variant: "featured" | "standard";
}) {
  const isFeatured = variant === "featured";
  return (
    <Link
      to={card.route}
      className={`group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/50 transition-colors duration-500 ease-out overflow-hidden ${
        isFeatured ? "p-8 gap-7 min-h-[280px]" : "p-6 gap-5 min-h-[240px]"
      }`}
    >
      {/* Earned Gold left-edge on hover */}
      <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

      {/* Subtle radial atmosphere — only visible on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          background: isFeatured
            ? "radial-gradient(ellipse 70% 80% at 30% 100%, rgba(212,175,55,0.06) 0%, transparent 65%)"
            : "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(212,175,55,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between">
        <card.icon
          size={isFeatured ? 36 : 28}
          strokeWidth={1.25}
          className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
        />
        <ArrowUpRight
          size={isFeatured ? 18 : 16}
          strokeWidth={1.5}
          className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out"
        />
      </div>

      <div className="relative">
        <h2
          className={`font-display font-medium text-text-primary tracking-tight mb-2 ${
            isFeatured ? "text-2xl" : "text-xl"
          }`}
        >
          {card.label}
        </h2>
        <p
          className={`text-text-tertiary leading-relaxed ${
            isFeatured ? "text-base" : "text-sm"
          }`}
        >
          {card.description}
        </p>
      </div>

      <div className="relative mt-auto pt-3 border-t border-border-primary flex items-baseline justify-between">
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          {card.hint}
        </span>
        {card.stat && (
          <span className="text-[11px] text-text-secondary font-mono tabular-nums">
            {card.stat}
          </span>
        )}
      </div>
    </Link>
  );
}

function ToolGrid({ title, tools }: { title: string; tools: ToolCard[] }) {
  return (
    <section>
      <header className="flex items-baseline justify-between mb-5 pb-3 border-b border-border-primary">
        <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
          {title}
        </h3>
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] tabular-nums">
          {tools.length.toString().padStart(2, "0")}
        </span>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {tools.map((tool) => (
          <Link
            key={tool.route}
            to={tool.route}
            className="group relative flex items-center gap-3 px-4 py-3.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/30 transition-colors duration-500 ease-out"
          >
            <span className="pointer-events-none absolute left-0 top-3 bottom-3 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />
            <tool.icon
              size={16}
              strokeWidth={1.5}
              className="text-text-tertiary group-hover:text-primary transition-colors duration-500 flex-shrink-0 ease-out"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {tool.label}
              </p>
              <p className="text-[10px] text-text-tertiary truncate">
                {tool.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Engine telemetry strip — live status of subsystems. Reads as the
 * console-tail of a real engine, not as Web analytics.
 */
function EngineTelemetry() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <aside className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
      <header className="flex items-baseline justify-between px-5 py-4 border-b border-border-primary">
        <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
          Engine
        </h3>
        <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em] tabular-nums">
          <StatusDot tone="online" />
          {timeStr} UTC
        </span>
      </header>

      <div className="divide-y divide-border-primary">
        {SYSTEM_STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between px-5 py-3.5"
          >
            <div className="flex items-center gap-3">
              <StatusDot tone={stat.indicator} />
              <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.1em]">
                {stat.label}
              </span>
            </div>
            <span className="text-xs text-text-primary font-mono tabular-nums">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

// =============================================================================
// Page
// =============================================================================

export function DashboardPage() {
  const auth = useForgeAuth();

  const displayName =
    auth.user?.email?.address?.split("@")[0] ||
    auth.user?.wallet?.address?.slice(0, 8) ||
    null;

  const greeting = getGreeting();

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene />

      <div className="relative max-w-6xl mx-auto px-8 py-16">
        {/* ====================================================================
            HERO BAND
            ==================================================================== */}
        <header className="mb-16 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12 items-start">
          {/* Hero copy */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-7 items-center">
            <ForgeLogo size={80} />
            <div>
              <p className="flex items-center gap-3 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.18em] mb-3">
                <span className="inline-flex items-center gap-1.5">
                  <StatusDot tone="online" />
                  HyperForge
                </span>
                <span className="text-text-tertiary/40">·</span>
                <span className="font-mono tabular-nums normal-case tracking-normal">
                  v0.1.0
                </span>
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-4">
                {displayName ? (
                  <>
                    {greeting},{" "}
                    <span className="text-primary">{displayName}</span>
                  </>
                ) : (
                  <>The engine beneath infinite worlds.</>
                )}
              </h1>
              <p className="text-base text-text-tertiary max-w-xl leading-relaxed">
                AI-driven authoring, procedural worldbuilding, and a unified
                asset pipeline — all rendered on WebGPU.
              </p>
            </div>
          </div>

          {/* Engine telemetry — desktop only on the right */}
          <div className="hidden lg:block">
            <EngineTelemetry />
          </div>
        </header>

        {/* Engine telemetry — mobile shows below hero */}
        <div className="lg:hidden mb-16">
          <EngineTelemetry />
        </div>

        {/* ====================================================================
            START — featured + secondary marquee
            ==================================================================== */}
        <section className="mb-20">
          <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-border-primary">
            <h2 className="font-display text-sm font-medium text-text-primary tracking-tight">
              Start
            </h2>
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] flex items-center gap-2">
              <Activity size={11} strokeWidth={1.5} />
              Primary workflows
            </span>
          </div>
          {/* Asymmetric grid — featured card spans 2 cols on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
            <MarqueeCardView card={MARQUEE[0]} variant="featured" />
            <MarqueeCardView card={MARQUEE[1]} variant="standard" />
            <MarqueeCardView card={MARQUEE[2]} variant="standard" />
          </div>
        </section>

        {/* ====================================================================
            QUICK STATS — small visual indicators between sections
            ==================================================================== */}
        <section className="mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Toolchain", value: "19", icon: Wrench, sub: "Modules" },
              {
                label: "Pipelines",
                value: "06",
                icon: Sparkles,
                sub: "Active",
              },
              {
                label: "Renderers",
                value: "WebGPU",
                icon: Cpu,
                sub: "TSL shaders",
              },
              {
                label: "Source",
                value: "Branch",
                icon: GitBranch,
                sub: "feat/world-studio",
              },
            ].map((m) => (
              <div
                key={m.label}
                className="relative rounded-lg bg-bg-tertiary border border-border-primary p-5 overflow-hidden"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-[0.04]"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(212,175,55,1) 0%, transparent 70%)",
                  }}
                />
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
                    {m.label}
                  </span>
                  <m.icon
                    size={14}
                    strokeWidth={1.5}
                    className="text-text-tertiary"
                  />
                </div>
                <p className="font-display text-2xl font-medium text-text-primary tracking-tight mb-1 tabular-nums">
                  {m.value}
                </p>
                <p className="text-[10px] text-text-tertiary uppercase tracking-[0.1em]">
                  {m.sub}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ====================================================================
            TOOL MATRIX
            ==================================================================== */}
        <div className="space-y-14">
          <ToolGrid title="World & Environment" tools={WORLD_TOOLS} />
          <ToolGrid title="Nature & Vegetation" tools={NATURE_TOOLS} />
          <ToolGrid title="Asset Pipeline" tools={PIPELINE_TOOLS} />
          <ToolGrid title="Data & Configuration" tools={DATA_TOOLS} />
        </div>

        {/* ====================================================================
            FOOTER — engineering credentials, restrained
            ==================================================================== */}
        <footer className="mt-20 pt-10 border-t border-border-primary">
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <div className="flex items-center gap-3">
              <ForgeLogo size={20} />
              <span className="font-display text-sm font-medium text-text-secondary tracking-tight">
                HyperForge
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                The engine beneath infinite worlds
              </span>
            </div>
            <div className="flex items-center gap-6 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <span className="flex items-center gap-1.5">
                <Clock size={11} strokeWidth={1.5} />
                {new Date().toLocaleDateString([], {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <StatusDot tone="online" />
                All systems operational
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
