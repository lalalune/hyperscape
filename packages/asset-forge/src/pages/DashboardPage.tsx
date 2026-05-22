/**
 * DashboardPage — HyperForge project hub.
 *
 * Composition system:
 *   Content max-width: 1200px (max-w-[1200px])
 *   Horizontal padding: px-10
 *   Vertical section rhythm: mb-20 between major sections
 *   Card padding scale: p-6 (compact) / p-8 (featured)
 *   Card heights: explicit min-h within each row for uniform baseline
 *
 * Background composition:
 *   Two architectural monoliths positioned at the CONTENT edges
 *   (not viewport edges) — framing the content like classical columns.
 *   Radial Graphite ellipse anchored to top.
 *   Two Forge Gold horizon lines breathing on different cycles.
 *
 * Data sources:
 *   - fetchCurrentUser → user.teams
 *   - fetchTeamGames(teamId) → games
 *   - listWorldProjects(teamId, gameId) → world projects
 *   - AssetService.listAssets → asset library
 */

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
  Image as ImageIcon,
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
  Plus,
  ChevronRight,
  Box,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import { ForgeLogo } from "../components/shared/ForgeLogo";
import { ROUTES } from "../constants";
import { useAssets } from "../hooks/useAssets";
import {
  fetchCurrentUser,
  fetchTeamGames,
  listWorldProjects,
  type WorldProjectSummary,
} from "../utils/worldProjectApi";

// =============================================================================
// Types & constants
// =============================================================================

interface ToolCard {
  route: string;
  label: string;
  icon: LucideIcon;
}

const TOOLS: { title: string; tools: ToolCard[] }[] = [
  {
    title: "World & Environment",
    tools: [
      { route: ROUTES.WORLD_BUILDER, label: "World Builder", icon: Globe },
      { route: ROUTES.WORLD_EDITOR, label: "World Editor", icon: Gamepad2 },
      { route: ROUTES.TERRAIN_GEN, label: "Terrain", icon: Mountain },
      { route: ROUTES.BUILDING_GEN, label: "Buildings", icon: Building2 },
      { route: ROUTES.ROADS_GEN, label: "Roads", icon: Route },
      { route: ROUTES.LANDMARK_GEN, label: "Landmarks", icon: Landmark },
      { route: ROUTES.DOCK_GEN, label: "Docks", icon: Anchor },
      { route: ROUTES.BRIDGE_GEN, label: "Bridges", icon: BrickWall },
    ],
  },
  {
    title: "Nature",
    tools: [
      { route: ROUTES.TREE_GEN, label: "Trees", icon: TreePine },
      { route: ROUTES.PLANT_GEN, label: "Plants", icon: Flower2 },
      { route: ROUTES.VEGETATION_GEN, label: "Vegetation", icon: Sprout },
    ],
  },
  {
    title: "Asset Pipeline",
    tools: [
      { route: ROUTES.EQUIPMENT, label: "Equipment", icon: Wrench },
      { route: ROUTES.ARMOR_FITTING, label: "Armor Fitting", icon: Shield },
      { route: ROUTES.HAND_RIGGING, label: "Hand Rigging", icon: Hand },
      { route: ROUTES.RETARGET_ANIMATE, label: "Retarget", icon: Shuffle },
      { route: ROUTES.BATCH_SPRITES, label: "Sprites", icon: ImageIcon },
      { route: ROUTES.VFX, label: "VFX", icon: Sparkles },
    ],
  },
  {
    title: "Data",
    tools: [
      { route: ROUTES.MANIFESTS, label: "Manifests", icon: FileJson },
      { route: ROUTES.ASSET_PACKS, label: "Asset Packs", icon: Package },
    ],
  },
];

// =============================================================================
// Utilities
// =============================================================================

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night build";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late night build";
}

// =============================================================================
// Primitives
// =============================================================================

function StatusDot({
  tone = "online",
}: {
  tone?: "online" | "ready" | "active" | "idle";
}) {
  const map = {
    online: "bg-success",
    ready: "bg-primary",
    active: "bg-accent-aether",
    idle: "bg-text-tertiary",
  };
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${map[tone]}`}
      style={{ animation: "status-pulse 2.4s ease-in-out infinite" }}
    />
  );
}

/**
 * Atmospheric scene — composed RELATIVE TO CONTENT, not viewport.
 *
 * Content max-width: 1200px. We position monoliths at the content
 * edges using calc() so they read as architectural columns framing
 * the content area, regardless of viewport width.
 *
 * Outer columns sit just outside the content (-24px), inner columns
 * sit on the content edges. Two horizon lines breathe at different
 * cycles for layered depth.
 */
function AtmosphericScene() {
  // Distance from viewport center to each monolith line, based on
  // 1200px content width.
  const halfContent = 600; // 1200 / 2
  const monoliths = [
    {
      side: "left" as const,
      offset: halfContent + 80,
      opacity: 0.45,
      dur: 22,
      delay: 0,
    },
    {
      side: "left" as const,
      offset: halfContent + 8,
      opacity: 0.75,
      dur: 18,
      delay: -7,
    },
    {
      side: "right" as const,
      offset: halfContent + 8,
      opacity: 0.75,
      dur: 20,
      delay: -12,
    },
    {
      side: "right" as const,
      offset: halfContent + 80,
      opacity: 0.45,
      dur: 24,
      delay: -3,
    },
  ];

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

      {/* Architectural monoliths — flank the content as classical columns.
          Each side uses calc(50% ± offset) so they track content edges
          (not viewport edges) at every breakpoint. */}
      {monoliths.map((m, i) => (
        <div
          key={i}
          className="absolute inset-y-0 w-px"
          style={{
            [m.side]: `calc(50% - ${m.offset}px)`,
            background: `linear-gradient(180deg, transparent 0%, rgba(28,30,34,${m.opacity}) 30%, rgba(28,30,34,${m.opacity}) 70%, transparent 100%)`,
            animation: `drift-y ${m.dur}s ease-in-out infinite`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}

      {/* Primary celestial horizon — anchored to the hero/continue band */}
      <div
        className="absolute inset-x-0 top-[420px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.22) 50%, transparent 95%)",
          animation: "celestial-pulse 8s ease-in-out infinite",
        }}
      />

      {/* Secondary horizon — softer, lower, longer cycle */}
      <div
        className="absolute inset-x-0 top-[1080px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 15%, rgba(212,175,55,0.08) 50%, transparent 85%)",
          animation: "celestial-pulse 14s ease-in-out infinite",
          animationDelay: "-4s",
        }}
      />
    </div>
  );
}

function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-baseline justify-between mb-8 pb-4 border-b border-border-primary">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-sm font-medium text-text-primary tracking-tight">
          {title}
        </h2>
        {meta && (
          <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
            {meta}
          </span>
        )}
      </div>
      {action}
    </header>
  );
}

// =============================================================================
// Continue — recent world projects
// =============================================================================

function ProjectCard({
  project,
  teamId,
}: {
  project: WorldProjectSummary;
  teamId: string;
}) {
  const lastEdited = timeAgo(project.updatedAt);
  return (
    <Link
      to={`${ROUTES.WORLD_STUDIO}/${project.id}`}
      state={{ teamId, gameId: project.gameId }}
      className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/50 transition-colors duration-500 ease-out overflow-hidden h-[320px]"
    >
      {/* Earned Gold left-edge on hover */}
      <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out z-10" />

      {/* Project preview pane — fixed 160px height */}
      <div
        className="relative h-40 border-b border-border-primary overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 30% 100%, rgba(212,175,55,0.06) 0%, transparent 60%), linear-gradient(180deg, rgba(11,11,13,0.4) 0%, rgba(28,30,34,0.6) 100%)",
        }}
      >
        {/* Horizon inside the preview */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-3/4 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(212,175,55,0.18), transparent)",
          }}
        />
        {/* Architectural silhouettes */}
        <span
          aria-hidden
          className="absolute inset-y-4 left-[25%] w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(28,30,34,0.9) 40%, rgba(28,30,34,0.9) 60%, transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-y-6 left-[40%] w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(28,30,34,0.6) 40%, rgba(28,30,34,0.6) 60%, transparent)",
          }}
        />
        <span
          aria-hidden
          className="absolute inset-y-3 right-[28%] w-px"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(28,30,34,0.8) 35%, rgba(28,30,34,0.8) 65%, transparent)",
          }}
        />

        {/* Version tag */}
        <div className="absolute top-3 right-3 inline-flex items-center px-2 py-1 rounded bg-bg-primary/80 border border-border-primary">
          <span className="text-[10px] font-mono text-text-tertiary tabular-nums leading-none">
            v{project.version}
          </span>
        </div>

        {/* Lock indicator */}
        {project.lockedBy && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary/80 border border-border-primary">
            <StatusDot tone="active" />
            <span className="text-[10px] text-text-tertiary uppercase tracking-[0.1em] leading-none">
              In session
            </span>
          </div>
        )}
      </div>

      {/* Text content — fills remaining height */}
      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-display text-base font-medium text-text-primary tracking-tight line-clamp-1">
            {project.name}
          </h3>
          <ArrowUpRight
            size={14}
            strokeWidth={1.5}
            className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out flex-shrink-0 mt-1"
          />
        </div>
        <p className="text-xs text-text-tertiary leading-relaxed line-clamp-2 mb-auto">
          {project.description || (
            <span className="italic text-text-tertiary/60">No description</span>
          )}
        </p>
        <div className="flex items-center justify-between pt-4 text-[11px] text-text-tertiary uppercase tracking-[0.1em]">
          <span>Edited {lastEdited}</span>
          {project.assetPacks.length > 0 && (
            <span className="flex items-center gap-1.5 normal-case tracking-normal">
              <Package size={11} strokeWidth={1.5} />
              <span className="font-mono tabular-nums">
                {project.assetPacks.length}
              </span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ContinueSection({
  projects,
  loading,
  error,
  teamId,
}: {
  projects: WorldProjectSummary[];
  loading: boolean;
  error: string | null;
  teamId: string | null;
}) {
  const recent = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 3),
    [projects],
  );

  return (
    <section className="mb-20">
      <SectionHeader
        title="Continue"
        meta={
          loading
            ? "Loading"
            : recent.length > 0
              ? `${recent.length} of ${projects.length} world${projects.length === 1 ? "" : "s"}`
              : null
        }
        action={
          projects.length > 0 && (
            <Link
              to={ROUTES.WORLD_STUDIO}
              className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
            >
              All worlds
              <ChevronRight size={12} strokeWidth={1.5} />
            </Link>
          )
        }
      />

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[320px] rounded-lg bg-bg-tertiary border border-border-primary"
              style={{
                animation: "celestial-pulse 2.4s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg bg-bg-tertiary border border-border-primary p-8 text-center">
          <p className="text-sm text-text-tertiary">{error}</p>
        </div>
      )}

      {!loading && !error && recent.length === 0 && teamId && (
        <EmptyHero
          message="No worlds yet"
          subtitle="Start building your first procedural world — terrain, biomes, structures — with AI-assisted authoring."
          ctaLabel="Start a new world"
          ctaTo={ROUTES.WORLD_STUDIO}
        />
      )}

      {!loading && !error && !teamId && (
        <EmptyHero
          message="No team selected"
          subtitle="Sign in or create a team to begin building worlds in HyperForge."
        />
      )}

      {!loading && !error && recent.length > 0 && teamId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {recent.map((p) => (
            <ProjectCard key={p.id} project={p} teamId={teamId} />
          ))}
        </div>
      )}
    </section>
  );
}

// =============================================================================
// Empty state hero
// =============================================================================

function EmptyHero({
  message,
  subtitle,
  ctaLabel,
  ctaTo,
}: {
  message: string;
  subtitle: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  return (
    <div className="relative rounded-lg bg-bg-tertiary border border-border-primary p-16 text-center overflow-hidden h-[320px] flex flex-col items-center justify-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(212,175,55,0.05) 0%, transparent 70%)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(212,175,55,0.12), transparent)",
        }}
      />
      <div className="relative">
        <ForgeLogo size={48} className="mx-auto mb-6 opacity-60" />
        <h3 className="font-display text-xl font-medium text-text-primary tracking-tight mb-3">
          {message}
        </h3>
        <p className="text-sm text-text-tertiary max-w-md mx-auto leading-relaxed mb-6">
          {subtitle}
        </p>
        {ctaLabel && ctaTo && (
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-500 ease-out"
          >
            <Plus size={14} strokeWidth={2} />
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Quick start — three uniform primary actions
// =============================================================================

function QuickStartSection() {
  const actions = [
    {
      route: ROUTES.WORLD_STUDIO,
      label: "New World",
      desc: "Compose terrain, biomes, structures, and quests with AI-assisted authoring.",
      icon: Map,
    },
    {
      route: ROUTES.GENERATION,
      label: "Generate Asset",
      desc: "3D models, textures, sprites, VFX through the AI pipeline.",
      icon: Wand2,
    },
    {
      route: ROUTES.ASSETS,
      label: "Asset Library",
      desc: "Browse, organize, and re-deploy every asset and prefab.",
      icon: Database,
    },
  ];

  return (
    <section className="mb-20">
      <SectionHeader title="Quick start" meta="Primary workflows" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.route}
              to={a.route}
              className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/50 transition-colors duration-500 ease-out overflow-hidden h-[200px] p-7"
            >
              <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
                style={{
                  background:
                    "radial-gradient(ellipse 70% 80% at 30% 100%, rgba(212,175,55,0.05) 0%, transparent 65%)",
                }}
              />
              <div className="relative flex items-start justify-between mb-5">
                <Icon
                  size={26}
                  strokeWidth={1.25}
                  className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
                />
                <ArrowUpRight
                  size={15}
                  strokeWidth={1.5}
                  className="text-text-tertiary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out"
                />
              </div>
              <h3 className="relative font-display text-xl font-medium text-text-primary tracking-tight mb-2">
                {a.label}
              </h3>
              <p className="relative text-sm text-text-tertiary leading-relaxed mt-auto">
                {a.desc}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// =============================================================================
// Activity + Telemetry
// =============================================================================

interface Asset {
  id: string;
  name: string;
  type: string;
  generatedAt: string;
  hasModel: boolean;
}

function ActivityList({
  assets,
  loading,
}: {
  assets: Asset[];
  loading: boolean;
}) {
  const recent = useMemo(
    () =>
      [...assets]
        .sort(
          (a, b) =>
            new Date(b.generatedAt).getTime() -
            new Date(a.generatedAt).getTime(),
        )
        .slice(0, 8),
    [assets],
  );

  return (
    <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden flex flex-col h-full">
      <header className="flex items-baseline justify-between px-6 py-4 border-b border-border-primary">
        <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
          Recent generation
        </h3>
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] tabular-nums">
          {assets.length.toString().padStart(2, "0")} total
        </span>
      </header>

      {loading && (
        <div className="divide-y divide-border-primary flex-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded bg-bg-secondary"
                style={{
                  animation: "celestial-pulse 2.4s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
              <div
                className="h-3 bg-bg-secondary rounded flex-1"
                style={{
                  maxWidth: `${50 + i * 8}%`,
                  animation: "celestial-pulse 2.4s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            </div>
          ))}
        </div>
      )}

      {!loading && recent.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
          <Box
            size={28}
            strokeWidth={1.25}
            className="text-text-tertiary/60 mb-4"
          />
          <p className="text-sm text-text-tertiary mb-4">
            No assets generated yet.
          </p>
          <Link
            to={ROUTES.GENERATION}
            className="inline-flex items-center gap-1.5 text-[11px] text-primary uppercase tracking-[0.12em] hover:text-primary-light transition-colors duration-300 ease-out"
          >
            Generate your first asset
            <ChevronRight size={12} strokeWidth={1.5} />
          </Link>
        </div>
      )}

      {!loading && recent.length > 0 && (
        <ul className="divide-y divide-border-primary flex-1">
          {recent.map((asset) => (
            <li key={asset.id}>
              <Link
                to={ROUTES.ASSETS}
                className="group flex items-center gap-3 px-6 py-3 hover:bg-bg-secondary transition-colors duration-300 ease-out"
              >
                <div className="w-8 h-8 rounded bg-bg-primary border border-border-primary flex items-center justify-center flex-shrink-0">
                  <Box
                    size={13}
                    strokeWidth={1.5}
                    className="text-text-tertiary group-hover:text-primary transition-colors duration-300 ease-out"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate font-medium">
                    {asset.name}
                  </p>
                  <p className="text-[10px] text-text-tertiary uppercase tracking-[0.1em]">
                    {asset.type}
                  </p>
                </div>
                <span className="text-[10px] text-text-tertiary font-mono tabular-nums flex-shrink-0">
                  {timeAgo(asset.generatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && recent.length > 0 && (
        <Link
          to={ROUTES.ASSETS}
          className="block px-6 py-3 border-t border-border-primary text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
        >
          View all assets →
        </Link>
      )}
    </div>
  );
}

function TelemetryRail({
  assetCount,
  projectCount,
  loading,
}: {
  assetCount: number;
  projectCount: number;
  loading: boolean;
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const libraryStats = [
    { label: "Assets", value: assetCount },
    { label: "Worlds", value: projectCount },
  ];

  const systemStats = [
    { label: "Renderer", value: "WebGPU + TSL", indicator: "online" as const },
    { label: "Physics", value: "PhysX WASM", indicator: "online" as const },
    {
      label: "Generation",
      value: "GPT-4 · Meshy",
      indicator: "ready" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Library */}
      <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
        <header className="px-6 py-4 border-b border-border-primary">
          <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
            Your library
          </h3>
        </header>
        <div className="grid grid-cols-2 divide-x divide-border-primary">
          {libraryStats.map((s) => (
            <div key={s.label} className="px-6 py-6">
              <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-3">
                {s.label}
              </p>
              <p className="font-display text-3xl font-medium text-text-primary tracking-tight tabular-nums leading-none">
                {loading ? (
                  <span
                    className="inline-block w-12 h-7 bg-bg-secondary rounded"
                    style={{
                      animation: "celestial-pulse 2.4s ease-in-out infinite",
                    }}
                  />
                ) : (
                  s.value.toString().padStart(2, "0")
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Engine */}
      <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden flex-1">
        <header className="flex items-baseline justify-between px-6 py-4 border-b border-border-primary">
          <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
            Engine
          </h3>
          <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em] tabular-nums">
            <StatusDot tone="online" />
            {timeStr}
          </span>
        </header>
        <div className="divide-y divide-border-primary">
          {systemStats.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between px-6 py-3.5"
            >
              <div className="flex items-center gap-3">
                <StatusDot tone={s.indicator} />
                <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.1em]">
                  {s.label}
                </span>
              </div>
              <span className="text-xs text-text-primary font-mono tabular-nums">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Toolchain index — secondary nav
// =============================================================================

function ToolIndex() {
  return (
    <section className="mb-20">
      <SectionHeader title="Toolchain" meta="All modules" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {TOOLS.map((group) => (
          <div key={group.title}>
            <h4 className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-4 pb-3 border-b border-border-primary/60">
              {group.title}
            </h4>
            <ul className="space-y-0.5">
              {group.tools.map((t) => (
                <li key={t.route}>
                  <Link
                    to={t.route}
                    className="group flex items-center gap-3 px-2 py-2 -mx-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors duration-300 ease-out"
                  >
                    <t.icon
                      size={14}
                      strokeWidth={1.5}
                      className="text-text-tertiary group-hover:text-primary transition-colors duration-300 ease-out flex-shrink-0"
                    />
                    <span className="text-[13px]">{t.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
  const { assets, loading: assetsLoading } = useAssets();

  const [teamId, setTeamId] = useState<string | null>(null);
  const [_gameId, setGameId] = useState<string | null>(null);
  const [projects, setProjects] = useState<WorldProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.ready || !auth.authenticated) {
      setProjectsLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setProjectsLoading(true);
        setProjectsError(null);

        const me = await fetchCurrentUser();
        if (cancelled || me.teams.length === 0) return;

        const firstTeam = me.teams[0].teamId;
        const games = await fetchTeamGames(firstTeam);
        if (cancelled || games.length === 0) {
          if (!cancelled) setTeamId(firstTeam);
          return;
        }

        const firstGame = games[0].id;
        const list = await listWorldProjects(firstTeam, firstGame);
        if (cancelled) return;

        setTeamId(firstTeam);
        setGameId(firstGame);
        setProjects(list);
      } catch (err) {
        if (!cancelled) {
          setProjectsError(
            err instanceof Error ? err.message : "Failed to load projects",
          );
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, auth.authenticated]);

  const displayName =
    auth.user?.email?.address?.split("@")[0] ||
    auth.user?.wallet?.address?.slice(0, 8) ||
    null;

  const greeting = getGreeting();

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene />

      <div className="relative max-w-[1200px] mx-auto px-10 py-16">
        {/* ============== HERO BAND ==============
            Single column, left-aligned. Logo above text — vertical
            rhythm reads as architectural masthead. */}
        <header className="mb-20">
          <div className="flex flex-col gap-7 max-w-3xl">
            <div className="flex items-center gap-4">
              <ForgeLogo size={56} />
              <div className="flex items-center gap-3">
                <p className="flex items-center gap-2 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.18em]">
                  <StatusDot tone="online" />
                  HyperForge
                </p>
                <span className="text-text-tertiary/40">·</span>
                <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                  v0.1.0
                </span>
              </div>
            </div>
            <div>
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
              <p className="text-base text-text-tertiary leading-relaxed">
                AI-driven authoring, procedural worldbuilding, and a unified
                asset pipeline — all rendered on WebGPU.
              </p>
            </div>
          </div>
        </header>

        {/* ============== CONTINUE ============== */}
        <ContinueSection
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          teamId={teamId}
        />

        {/* ============== QUICK START ============== */}
        <QuickStartSection />

        {/* ============== ACTIVITY + TELEMETRY ============== */}
        <section className="mb-20">
          <SectionHeader title="Workspace" meta="Activity & telemetry" />
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5 min-h-[480px]">
            <ActivityList assets={assets} loading={assetsLoading} />
            <TelemetryRail
              assetCount={assets.length}
              projectCount={projects.length}
              loading={assetsLoading || projectsLoading}
            />
          </div>
        </section>

        {/* ============== TOOLCHAIN ============== */}
        <ToolIndex />

        {/* ============== FOOTER ============== */}
        <footer className="pt-10 border-t border-border-primary">
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <div className="flex items-center gap-3">
              <ForgeLogo size={18} />
              <span className="font-display text-sm font-medium text-text-secondary tracking-tight">
                HyperForge
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                The engine beneath infinite worlds
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <span className="flex items-center gap-1.5">
                <Cpu size={11} strokeWidth={1.5} />
                WebGPU
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="flex items-center gap-1.5">
                <StatusDot tone="online" />
                Operational
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
