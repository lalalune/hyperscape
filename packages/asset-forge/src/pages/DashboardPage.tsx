/**
 * DashboardPage — HyperForge project hub.
 *
 * Architecture:
 *   00 / HERO        — brand identity + greeting + AI compose prompt
 *   01 / CONTINUE    — recent world projects
 *   02 / WORKSPACE   — activity feed + library counts + engine status + sparkline
 *   03 / TOOLCHAIN   — full module index
 *
 * Composition system:
 *   Content max-width: 1200px
 *   Horizontal padding: px-10
 *   Vertical section rhythm: mb-24 between major sections
 *   Card padding scale: p-6 / p-7
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
  ArrowRight,
  Package,
  Plus,
  ChevronRight,
  Box,
  BookOpen,
  MessageCircle,
  Layers,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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

/** Compose-prompt suggestion chips — give users a sense of what they can ask for. */
const PROMPT_SUGGESTIONS = [
  "a Norse fishing village",
  "a desert oasis with palms",
  "a crystal forest biome",
  "a viking longship",
  "a magic crystal staff",
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

/** Bucket assets by day of week (last 7 days) for the sparkline. */
function buildActivitySparkline(assets: { generatedAt: string }[]): number[] {
  const days = 7;
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  for (const a of assets) {
    const t = new Date(a.generatedAt).getTime();
    const ageDays = Math.floor((now - t) / dayMs);
    if (ageDays >= 0 && ageDays < days) {
      buckets[days - 1 - ageDays] += 1;
    }
  }
  return buckets;
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

/** Background scene — monoliths flank the content as architectural columns. */
function AtmosphericScene() {
  const halfContent = 600;
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
      {/* Volumetric Graphite ellipse — anchored to top */}
      <div
        className="absolute inset-x-0 top-0 h-[720px]"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(28,30,34,0.8) 0%, transparent 75%)",
        }}
      />

      {/* Architectural monoliths */}
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

      {/* Horizon lines — celestial light, breathing */}
      <div
        className="absolute inset-x-0 top-[560px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.22) 50%, transparent 95%)",
          animation: "celestial-pulse 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-x-0 top-[1320px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 15%, rgba(212,175,55,0.10) 50%, transparent 85%)",
          animation: "celestial-pulse 14s ease-in-out infinite",
          animationDelay: "-4s",
        }}
      />
    </div>
  );
}

/** Editorial numbered section header — "01 / Continue". */
function SectionHeader({
  number,
  title,
  meta,
  action,
}: {
  number: string;
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 pb-4 border-b border-border-primary flex items-baseline justify-between gap-6">
      <div className="flex items-baseline gap-4 min-w-0">
        <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em] flex-shrink-0">
          {number}
        </span>
        <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
          {title}
        </h2>
        {meta && (
          <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] truncate">
            {meta}
          </span>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}

// =============================================================================
// 00 / HERO with AI compose prompt
// =============================================================================

function ComposePrompt() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      navigate(ROUTES.GENERATION);
      return;
    }
    // Pass intent forward as a URL param — Generation page can read it later.
    navigate(`${ROUTES.GENERATION}?prompt=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="relative">
      <form
        onSubmit={handleSubmit}
        className="group relative flex items-center gap-4 rounded-lg bg-bg-tertiary border border-border-primary focus-within:border-primary/60 transition-colors duration-500 ease-out overflow-hidden"
      >
        {/* Earned Gold left-edge on focus */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-3 bottom-3 w-px bg-primary opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 ease-out"
        />
        {/* Subtle radial atmosphere on focus */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 ease-out"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="pl-5 flex-shrink-0 relative">
          <Sparkles
            size={18}
            strokeWidth={1.5}
            className="text-text-tertiary group-focus-within:text-primary transition-colors duration-500 ease-out"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe a world or asset to generate…"
          className="relative flex-1 bg-transparent border-none py-5 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <button
          type="submit"
          className="relative mr-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-bg-primary text-sm font-medium hover:bg-primary-dark transition-colors duration-500 ease-out flex-shrink-0"
        >
          Generate
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </form>

      {/* Suggestion chips — small affordance for what's possible */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] mr-1">
          Try
        </span>
        {PROMPT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setValue(s);
            }}
            className="px-3 py-1 rounded-full bg-bg-tertiary border border-border-primary text-xs text-text-secondary hover:text-text-primary hover:border-primary/40 transition-colors duration-300 ease-out"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// 01 / CONTINUE — project cards with varied preview compositions
// =============================================================================

/** Deterministic preview composition variant per project (so each card differs). */
function previewVariant(seed: string): {
  monoliths: { x: string; inset: string; opacity: number }[];
  horizonY: string;
} {
  // Simple hash to choose from a small set of compositions
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const v = Math.abs(h) % 4;
  const variants = [
    {
      monoliths: [
        { x: "left-[18%]", inset: "inset-y-4", opacity: 0.85 },
        { x: "left-[34%]", inset: "inset-y-6", opacity: 0.55 },
        { x: "right-[24%]", inset: "inset-y-3", opacity: 0.75 },
      ],
      horizonY: "top-2/3",
    },
    {
      monoliths: [
        { x: "left-[12%]", inset: "inset-y-6", opacity: 0.55 },
        { x: "left-[42%]", inset: "inset-y-3", opacity: 0.85 },
        { x: "right-[18%]", inset: "inset-y-5", opacity: 0.7 },
        { x: "right-[30%]", inset: "inset-y-8", opacity: 0.4 },
      ],
      horizonY: "top-3/4",
    },
    {
      monoliths: [
        { x: "left-[22%]", inset: "inset-y-5", opacity: 0.65 },
        { x: "right-[36%]", inset: "inset-y-7", opacity: 0.5 },
        { x: "right-[16%]", inset: "inset-y-4", opacity: 0.9 },
      ],
      horizonY: "top-1/2",
    },
    {
      monoliths: [
        { x: "left-[8%]", inset: "inset-y-7", opacity: 0.45 },
        { x: "left-[28%]", inset: "inset-y-4", opacity: 0.8 },
        { x: "left-[48%]", inset: "inset-y-9", opacity: 0.35 },
        { x: "right-[20%]", inset: "inset-y-5", opacity: 0.7 },
      ],
      horizonY: "top-3/5",
    },
  ];
  return variants[v];
}

function ProjectCard({
  project,
  teamId,
}: {
  project: WorldProjectSummary;
  teamId: string;
}) {
  const variant = useMemo(() => previewVariant(project.id), [project.id]);
  return (
    <Link
      to={`${ROUTES.WORLD_STUDIO}/${project.id}`}
      state={{ teamId, gameId: project.gameId }}
      className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/50 transition-colors duration-500 ease-out overflow-hidden h-[320px]"
    >
      <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out z-10" />

      {/* Preview pane — composition varies per project */}
      <div
        className="relative h-40 border-b border-border-primary overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 30% 100%, rgba(212,175,55,0.06) 0%, transparent 60%), linear-gradient(180deg, rgba(11,11,13,0.4) 0%, rgba(28,30,34,0.6) 100%)",
        }}
      >
        <span
          aria-hidden
          className={`absolute inset-x-0 ${variant.horizonY} h-px`}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(212,175,55,0.20), transparent)",
          }}
        />
        {variant.monoliths.map((m, i) => (
          <span
            key={i}
            aria-hidden
            className={`absolute ${m.inset} ${m.x} w-px`}
            style={{
              background: `linear-gradient(180deg, transparent, rgba(28,30,34,${m.opacity}) 35%, rgba(28,30,34,${m.opacity}) 65%, transparent)`,
            }}
          />
        ))}

        <div className="absolute top-3 right-3 inline-flex items-center px-2 py-1 rounded bg-bg-primary/80 border border-border-primary">
          <span className="text-[10px] font-mono text-text-tertiary tabular-nums leading-none">
            v{project.version}
          </span>
        </div>
        {project.lockedBy && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-bg-primary/80 border border-border-primary">
            <StatusDot tone="active" />
            <span className="text-[10px] text-text-tertiary uppercase tracking-[0.1em] leading-none">
              In session
            </span>
          </div>
        )}
      </div>

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
          <span>Edited {timeAgo(project.updatedAt)}</span>
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
    <section className="mb-24">
      <SectionHeader
        number="01"
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
// 02 / WORKSPACE — activity + sparkline + telemetry
// =============================================================================

interface Asset {
  id: string;
  name: string;
  type: string;
  generatedAt: string;
  hasModel: boolean;
}

/**
 * Tiny 7-day sparkline of generation activity. SVG, no library.
 * Each bar is one day; the rightmost bar is today.
 */
function ActivitySparkline({ data }: { data: number[] }) {
  const w = 200;
  const h = 48;
  const padX = 2;
  const padY = 6;
  const barW = (w - padX * 2) / data.length;
  const max = Math.max(1, ...data);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-12"
      role="img"
      aria-label={`7-day activity: ${data.join(", ")} generations`}
    >
      <title>7-day activity</title>
      {/* Baseline */}
      <line
        x1={padX}
        y1={h - padY}
        x2={w - padX}
        y2={h - padY}
        stroke="rgba(28,30,34,0.9)"
        strokeWidth={1}
      />
      {data.map((v, i) => {
        const x = padX + i * barW + barW * 0.2;
        const bw = barW * 0.6;
        const bh = ((v / max) * (h - padY * 2)) | 0;
        const y = h - padY - bh;
        const isToday = i === data.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={bw}
            height={Math.max(1, bh)}
            fill={
              v === 0
                ? "rgba(58,61,69,0.6)"
                : isToday
                  ? "#D4AF37"
                  : "rgba(212,175,55,0.45)"
            }
          />
        );
      })}
    </svg>
  );
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
  sparkline,
}: {
  assetCount: number;
  projectCount: number;
  loading: boolean;
  sparkline: number[];
}) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const weekTotal = sparkline.reduce((a, b) => a + b, 0);

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
      {/* Activity sparkline + week total */}
      <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
        <header className="flex items-baseline justify-between px-6 py-4 border-b border-border-primary">
          <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
            This week
          </h3>
          <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
            7-day activity
          </span>
        </header>
        <div className="p-6">
          <div className="flex items-baseline justify-between mb-4">
            <p className="font-display text-3xl font-medium text-text-primary tracking-tight tabular-nums leading-none">
              {loading ? "—" : weekTotal.toString().padStart(2, "0")}
            </p>
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
              Generated
            </p>
          </div>
          <ActivitySparkline data={sparkline} />
          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-text-tertiary tabular-nums">
            <span>7d ago</span>
            <span className="text-primary">Today</span>
          </div>
        </div>
      </div>

      {/* Library totals */}
      <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
        <header className="px-6 py-4 border-b border-border-primary">
          <h3 className="font-display text-sm font-medium text-text-primary tracking-tight">
            Library
          </h3>
        </header>
        <div className="grid grid-cols-2 divide-x divide-border-primary">
          <div className="px-6 py-5">
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-2">
              Assets
            </p>
            <p className="font-display text-2xl font-medium text-text-primary tracking-tight tabular-nums leading-none">
              {loading ? "—" : assetCount.toString().padStart(2, "0")}
            </p>
          </div>
          <div className="px-6 py-5">
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-2">
              Worlds
            </p>
            <p className="font-display text-2xl font-medium text-text-primary tracking-tight tabular-nums leading-none">
              {loading ? "—" : projectCount.toString().padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>

      {/* Engine subsystem status */}
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
// 03 / TOOLCHAIN — full module index
// =============================================================================

function ToolIndex() {
  return (
    <section className="mb-24">
      <SectionHeader number="03" title="Toolchain" meta="All modules" />
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
  const sparkline = useMemo(() => buildActivitySparkline(assets), [assets]);

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene />

      <div className="relative max-w-[1200px] mx-auto px-10 py-16">
        {/* ====================================================================
            00 / HERO — brand identity + AI compose prompt
            ==================================================================== */}
        <header className="mb-24">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              HyperForge
            </span>
            <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot tone="online" />
              v0.1.0
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-center mb-10">
            <ForgeLogo size={96} />
            <div>
              <h1 className="font-display text-5xl md:text-6xl font-medium text-text-primary tracking-tight leading-[1.02] mb-4">
                {displayName ? (
                  <>
                    {greeting},
                    <br />
                    <span className="text-primary">{displayName}</span>
                  </>
                ) : (
                  <>
                    The engine beneath
                    <br />
                    <span className="text-primary">infinite worlds.</span>
                  </>
                )}
              </h1>
              <p className="text-base text-text-tertiary leading-relaxed max-w-xl">
                AI-driven authoring, procedural worldbuilding, and a unified
                asset pipeline — all rendered on WebGPU.
              </p>
            </div>
          </div>

          {/* AI compose prompt — the signature moment */}
          <ComposePrompt />
        </header>

        {/* ====================================================================
            01 / CONTINUE — recent world projects
            ==================================================================== */}
        <ContinueSection
          projects={projects}
          loading={projectsLoading}
          error={projectsError}
          teamId={teamId}
        />

        {/* ====================================================================
            02 / WORKSPACE — activity feed + telemetry
            ==================================================================== */}
        <section className="mb-24">
          <SectionHeader
            number="02"
            title="Workspace"
            meta="Activity & telemetry"
          />
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-5 min-h-[560px]">
            <ActivityList assets={assets} loading={assetsLoading} />
            <TelemetryRail
              assetCount={assets.length}
              projectCount={projects.length}
              loading={assetsLoading || projectsLoading}
              sparkline={sparkline}
            />
          </div>
        </section>

        {/* ====================================================================
            03 / TOOLCHAIN
            ==================================================================== */}
        <ToolIndex />

        {/* ====================================================================
            FOOTER — film-credits closing
            ==================================================================== */}
        <DashboardFooter />
      </div>
    </div>
  );
}

// =============================================================================
// Footer
// =============================================================================

/**
 * Footer link columns. Deliberately omits a "Product" / "Tools" column —
 * the Toolchain section (03) already serves as the authoritative tool
 * index, and the sidebar drawer carries the global nav. The footer's
 * role is the OTHER stuff: docs, engine internals, community.
 */
const FOOTER_LINKS: {
  title: string;
  icon: LucideIcon;
  items: { label: string; href: string; external?: boolean }[];
}[] = [
  {
    title: "Resources",
    icon: BookOpen,
    items: [
      { label: "Documentation", href: "#docs" },
      { label: "API Reference", href: "#api" },
      { label: "Changelog", href: "#changelog" },
      { label: "Roadmap", href: "#roadmap" },
      { label: "Brand", href: "#brand" },
    ],
  },
  {
    title: "Engine",
    icon: Layers,
    items: [
      { label: "Architecture", href: "#architecture" },
      { label: "Plugin System", href: "#plugins" },
      { label: "ECS", href: "#ecs" },
      { label: "Networking", href: "#networking" },
      { label: "Status", href: "#status" },
    ],
  },
  {
    title: "Community",
    icon: MessageCircle,
    items: [
      {
        label: "GitHub",
        href: "https://github.com/hyperforge",
        external: true,
      },
      { label: "Discord", href: "#discord", external: true },
      { label: "Twitter", href: "#twitter", external: true },
      { label: "Blog", href: "#blog", external: true },
      { label: "Support", href: "#support" },
    ],
  },
];

function DashboardFooter() {
  const buildId = "feat/world-studio";
  const buildDate = new Date().toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <footer className="relative mt-12">
      {/* Cap horizon — a final Gold line that closes the page like a frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.28) 50%, transparent 95%)",
          animation: "celestial-pulse 10s ease-in-out infinite",
        }}
      />

      {/* ============== Main band: brand identity + 3 link columns ============== */}
      <div className="pt-12 pb-12 border-t border-border-primary grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12">
        {/* Brand block — concise. Hero already carries the tagline + brand
            statement; the footer just signs the page. */}
        <div className="flex flex-col gap-4 max-w-sm">
          <div className="flex items-center gap-3">
            <ForgeLogo size={28} />
            <span className="font-display text-lg font-medium text-text-primary tracking-tight">
              HyperForge
            </span>
          </div>
          <p className="text-sm text-text-tertiary leading-relaxed">
            A WebGPU metaverse engine with AI-driven authoring, procedural
            worldbuilding, and a unified asset pipeline.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
            <StatusDot tone="online" />
            All systems operational
          </div>
        </div>

        {/* Link columns — Resources / Engine / Community.
            Tools live in the Toolchain section above; the sidebar drawer
            carries global nav. The footer is for everything else. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <h4 className="flex items-center gap-2 text-[11px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-4 pb-3 border-b border-border-primary/60">
                <col.icon
                  size={11}
                  strokeWidth={1.5}
                  className="text-text-tertiary"
                />
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.items.map((item) => {
                  const isInternal = item.href.startsWith("/");
                  const linkClass =
                    "group inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-primary transition-colors duration-300 ease-out";
                  return (
                    <li key={item.label}>
                      {isInternal ? (
                        <Link to={item.href} className={linkClass}>
                          {item.label}
                        </Link>
                      ) : (
                        <a
                          href={item.href}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noreferrer" : undefined}
                          className={linkClass}
                        >
                          {item.label}
                          {item.external && (
                            <ArrowUpRight
                              size={11}
                              strokeWidth={1.5}
                              className="text-text-tertiary/60 group-hover:text-primary transition-colors duration-300 ease-out"
                            />
                          )}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ============== Release strip — copyright + version + build ============== */}
      <div className="pt-6 pb-2 border-t border-border-primary flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-3 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          <span className="font-mono normal-case tracking-normal text-text-tertiary/80">
            © {new Date().getFullYear()}
          </span>
          <span>HyperForge</span>
          <span className="text-text-tertiary/40">·</span>
          <span>All rights reserved</span>
        </div>
        <div className="flex flex-wrap items-baseline gap-3 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5">
            <ScrollText size={11} strokeWidth={1.5} />
            <span className="font-mono normal-case tracking-normal">
              v0.1.0
            </span>
          </span>
          <span className="text-text-tertiary/40">·</span>
          <span className="font-mono normal-case tracking-normal">
            {buildId}
          </span>
          <span className="text-text-tertiary/40">·</span>
          <span className="font-mono normal-case tracking-normal">
            {buildDate}
          </span>
        </div>
      </div>
    </footer>
  );
}
