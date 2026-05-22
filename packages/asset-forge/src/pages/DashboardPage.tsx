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
  },
  {
    route: ROUTES.GENERATION,
    label: "Generate Assets",
    description:
      "Create 3D models, textures, sprites, and VFX through the AI generation pipeline.",
    icon: Wand2,
    hint: "Create with AI",
  },
  {
    route: ROUTES.ASSETS,
    label: "Asset Library",
    description:
      "Browse, organize, and re-deploy every asset, prefab, and pack in your library.",
    icon: Database,
    hint: "Browse library",
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

const CAPABILITIES: { label: string; value: string }[] = [
  { label: "Renderer", value: "WebGPU + TSL" },
  { label: "Engine", value: "Three.js + PhysX" },
  { label: "Worlds", value: "Procedural" },
  { label: "Authoring", value: "AI-assisted" },
];

// =============================================================================
// Subcomponents
// =============================================================================

function MarqueeCardView({ card }: { card: MarqueeCard }) {
  return (
    <Link
      to={card.route}
      className="group relative flex flex-col gap-6 p-7 rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/50 transition-colors duration-500 ease-out overflow-hidden"
    >
      {/* Earned Gold left-edge on hover */}
      <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

      {/* Subtle radial atmosphere — only visible on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(212,175,55,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between">
        <card.icon
          size={28}
          strokeWidth={1.25}
          className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
        />
        <ArrowUpRight
          size={16}
          strokeWidth={1.5}
          className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out"
        />
      </div>

      <div className="relative">
        <h2 className="font-display text-xl font-medium text-text-primary tracking-tight mb-2">
          {card.label}
        </h2>
        <p className="text-sm text-text-tertiary leading-relaxed">
          {card.description}
        </p>
      </div>

      <div className="relative mt-auto pt-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
        {card.hint}
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

// =============================================================================
// Page
// =============================================================================

export function DashboardPage() {
  const auth = useForgeAuth();

  const displayName =
    auth.user?.email?.address?.split("@")[0] ||
    auth.user?.wallet?.address?.slice(0, 8) ||
    null;

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      {/* Atmospheric hero backdrop — radial Graphite + Gold horizon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(28,30,34,0.7) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[280px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(212,175,55,0.18), transparent)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-8 py-16">
        {/* ============== HERO ============== */}
        <header className="mb-16 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
          <ForgeLogo size={72} />
          <div>
            <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.18em] mb-3">
              HyperForge
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.1] mb-3">
              {displayName ? (
                <>
                  Welcome back,{" "}
                  <span className="text-primary">{displayName}</span>
                </>
              ) : (
                <>The engine beneath infinite worlds.</>
              )}
            </h1>
            <p className="text-base text-text-tertiary max-w-xl leading-relaxed">
              AI-driven authoring, procedural worldbuilding, and a unified asset
              pipeline — all rendered on WebGPU.
            </p>
          </div>
        </header>

        {/* ============== MARQUEE — three primary workflows ============== */}
        <section className="mb-20">
          <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-border-primary">
            <h2 className="font-display text-sm font-medium text-text-primary tracking-tight">
              Start
            </h2>
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              Primary workflows
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MARQUEE.map((card) => (
              <MarqueeCardView key={card.route} card={card} />
            ))}
          </div>
        </section>

        {/* ============== TOOL MATRIX ============== */}
        <div className="space-y-14">
          <ToolGrid title="World & Environment" tools={WORLD_TOOLS} />
          <ToolGrid title="Nature & Vegetation" tools={NATURE_TOOLS} />
          <ToolGrid title="Asset Pipeline" tools={PIPELINE_TOOLS} />
          <ToolGrid title="Data & Configuration" tools={DATA_TOOLS} />
        </div>

        {/* ============== CAPABILITY FOOTER ============== */}
        <footer className="mt-20 pt-10 border-t border-border-primary">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {CAPABILITIES.map((cap) => (
              <div key={cap.label}>
                <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-2">
                  {cap.label}
                </p>
                <p className="font-display text-sm font-medium text-text-primary tracking-tight">
                  {cap.value}
                </p>
              </div>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
