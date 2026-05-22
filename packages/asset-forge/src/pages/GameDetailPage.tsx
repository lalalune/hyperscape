/**
 * GameDetailPage — /teams/:teamId/games/:gameId
 *
 * Shows a single game (project) within a team:
 *   - Game identity (name, slug, description, module)
 *   - Live runtime URLs (staging / production) with status
 *   - Worlds within the game (project list)
 *   - GameMode manifest (controller / camera / input / pawn)
 *   - Active UI layout id
 *
 * Data sources:
 *   - fetchGame(teamId, gameId)            — game metadata
 *   - listWorldProjects(teamId, gameId)    — worlds inside the game
 *   - fetchCurrentUser() (for role check)
 */

import {
  ArrowLeft,
  Gamepad2,
  Map,
  Loader2,
  ChevronRight,
  Globe,
  Layers,
  ExternalLink,
  Server,
  Plus,
  Package,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import {
  AtmosphericScene,
  ErrorBanner,
  PageFooter,
  SectionHeader,
  StatCard,
  StatusDot,
} from "../components/shared/page";
import { ROUTES, buildTeamDetailPath } from "../constants";
import { timeAgo } from "../utils/timeAgo";
import {
  fetchCurrentUser,
  fetchGame,
  listWorldProjects,
  type GameResponse,
  type WorldProjectSummary,
} from "../utils/worldProjectApi";

// =============================================================================
// Page
// =============================================================================

export function GameDetailPage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>();
  const auth = useForgeAuth();

  const [game, setGame] = useState<GameResponse | null>(null);
  const [worlds, setWorlds] = useState<WorldProjectSummary[]>([]);
  const [viewerRole, setViewerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !gameId || !auth.ready || !auth.authenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [meRes, gameRes, worldsRes] = await Promise.all([
          fetchCurrentUser(),
          fetchGame(teamId!, gameId!),
          listWorldProjects(teamId!, gameId!),
        ]);
        if (cancelled) return;
        const myMembership = meRes.teams.find((t) => t.teamId === teamId);
        setViewerRole(myMembership?.role ?? null);
        setGame(gameRes);
        setWorlds(worldsRes);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load game");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [teamId, gameId, auth.ready, auth.authenticated]);

  const canEdit = useMemo(() => {
    const r = (viewerRole ?? "").toLowerCase();
    return r === "owner" || r === "admin" || r === "editor";
  }, [viewerRole]);

  if (!auth.ready || loading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-bg-primary">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !game || !teamId) {
    return (
      <div className="relative min-h-full bg-bg-primary overflow-hidden">
        <AtmosphericScene />
        <div className="relative max-w-[1200px] mx-auto px-10 py-16">
          {teamId && (
            <Link
              to={buildTeamDetailPath(teamId)}
              className="inline-flex items-center gap-2 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] mb-8 transition-colors duration-300 ease-out"
            >
              <ArrowLeft size={12} strokeWidth={1.5} />
              Back to team
            </Link>
          )}
          <ErrorBanner
            variant="page"
            message={error || "Game not found"}
            meta={gameId}
          />
        </div>
      </div>
    );
  }

  const recentWorlds = [...worlds].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="relative min-h-full bg-bg-primary overflow-hidden">
      <AtmosphericScene />

      <div className="relative max-w-[1200px] mx-auto px-10 py-16">
        {/* BACK */}
        <Link
          to={buildTeamDetailPath(teamId)}
          className="inline-flex items-center gap-2 text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] mb-8 transition-colors duration-300 ease-out"
        >
          <ArrowLeft size={12} strokeWidth={1.5} />
          Back to team
        </Link>

        {/* HERO */}
        <header className="mb-16">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              Game
            </span>
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case">
              {game.slug}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-lg bg-bg-tertiary border border-border-primary flex items-center justify-center flex-shrink-0">
              <Gamepad2 size={32} strokeWidth={1.25} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-4xl md:text-5xl font-medium text-text-primary tracking-tight leading-[1.05] mb-2">
                {game.name}
              </h1>
              {game.description && (
                <p className="text-base text-text-tertiary leading-relaxed">
                  {game.description}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* OVERVIEW STATS */}
        <section className="mb-20">
          <SectionHeader number="01" title="Overview" meta="Project status" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Worlds"
              value={worlds.length.toString().padStart(2, "0")}
              sub={worlds.length === 1 ? "world" : "worlds"}
            />
            <StatCard
              label="Module"
              value={game.moduleId || "—"}
              sub="Game module"
              valueMono={false}
              truncateValue
            />
            <StatCard
              label="Created"
              value={timeAgo(game.createdAt)}
              sub={new Date(game.createdAt).toLocaleDateString()}
            />
            <StatCard
              label="Layout"
              value={game.activeUiLayoutId ? "Custom" : "Default"}
              sub={game.activeUiLayoutId ? "Active UI" : "Built-in UI"}
              valueMono={false}
            />
          </div>
        </section>

        {/* WORLDS */}
        <section className="mb-20">
          <SectionHeader
            number="02"
            title="Worlds"
            meta={`${worlds.length} ${worlds.length === 1 ? "project" : "projects"}`}
            action={
              canEdit && (
                <Link
                  to={ROUTES.WORLD_STUDIO}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
                >
                  <Plus size={11} strokeWidth={2} />
                  New world
                </Link>
              )
            }
          />

          {worlds.length === 0 ? (
            <div className="rounded-lg bg-bg-tertiary border border-border-primary p-12 text-center">
              <Map
                size={28}
                strokeWidth={1.25}
                className="text-text-tertiary/60 mx-auto mb-4"
              />
              <p className="text-sm text-text-tertiary mb-4">
                No worlds in this game yet.
              </p>
              {canEdit && (
                <Link
                  to={ROUTES.WORLD_STUDIO}
                  className="inline-flex items-center gap-1.5 text-[11px] text-primary uppercase tracking-[0.12em] hover:text-primary-light transition-colors duration-300 ease-out"
                >
                  Create the first world
                  <ChevronRight size={12} strokeWidth={1.5} />
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentWorlds.map((w) => (
                <Link
                  key={w.id}
                  to={`${ROUTES.WORLD_STUDIO}/${w.id}`}
                  state={{ teamId, gameId }}
                  className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out overflow-hidden p-6"
                >
                  <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded bg-bg-primary border border-border-primary flex items-center justify-center">
                      <Map
                        size={14}
                        strokeWidth={1.5}
                        className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                      v{w.version}
                    </span>
                  </div>

                  <h3 className="font-display text-base font-medium text-text-primary tracking-tight mb-2 truncate">
                    {w.name}
                  </h3>
                  <p className="text-xs text-text-tertiary leading-relaxed line-clamp-2 mb-auto">
                    {w.description || (
                      <span className="italic text-text-tertiary/60">
                        No description
                      </span>
                    )}
                  </p>

                  <div className="flex items-center justify-between pt-4 text-[11px] text-text-tertiary uppercase tracking-[0.1em]">
                    <span>Edited {timeAgo(w.updatedAt)}</span>
                    {w.assetPacks.length > 0 && (
                      <span className="flex items-center gap-1.5 normal-case tracking-normal">
                        <Package size={11} strokeWidth={1.5} />
                        <span className="font-mono tabular-nums">
                          {w.assetPacks.length}
                        </span>
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* RUNTIME — server URLs */}
        <section className="mb-20">
          <SectionHeader
            number="03"
            title="Runtime"
            meta="Deployment endpoints"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ServerCard
              label="Staging"
              url={game.stagingServerUrl}
              tone="ready"
            />
            <ServerCard
              label="Production"
              url={game.productionServerUrl}
              tone="online"
            />
          </div>
        </section>

        {/* GAME MODE */}
        <section className="mb-20">
          <SectionHeader
            number="04"
            title="Game mode"
            meta="Controller manifest"
          />
          <div className="rounded-lg bg-bg-tertiary border border-border-primary overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border-primary">
              <GameModeField
                label="Controller"
                value={game.gameMode.playerController}
                icon={Gamepad2}
              />
              <GameModeField
                label="Camera"
                value={game.gameMode.camera}
                icon={Globe}
              />
              <GameModeField
                label="Input"
                value={game.gameMode.inputContext}
                icon={Layers}
              />
              <GameModeField
                label="Pawn"
                value={game.gameMode.pawn}
                icon={Gamepad2}
              />
            </div>
          </div>
        </section>

        <PageFooter
          subtitle={
            <>
              <Link
                to={ROUTES.TEAMS}
                className="text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.14em] transition-colors duration-300 ease-out"
              >
                Teams
              </Link>
              <ChevronRight
                size={11}
                strokeWidth={1.5}
                className="text-text-tertiary/40"
              />
              <Link
                to={buildTeamDetailPath(teamId)}
                className="text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.14em] transition-colors duration-300 ease-out"
              >
                Team
              </Link>
              <ChevronRight
                size={11}
                strokeWidth={1.5}
                className="text-text-tertiary/40"
              />
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                {game.name}
              </span>
            </>
          }
          right={
            <div className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal">
              {game.id}
            </div>
          }
        />
      </div>
    </div>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

function ServerCard({
  label,
  url,
  tone,
}: {
  label: string;
  url: string | null;
  tone: "online" | "ready";
}) {
  const isLive = !!url;
  return (
    <div className="rounded-lg bg-bg-tertiary border border-border-primary p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={14} strokeWidth={1.5} className="text-text-tertiary" />
          <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
            {label}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          <StatusDot tone={isLive ? tone : "idle"} />
          {isLive ? "Active" : "Not deployed"}
        </span>
      </div>
      {isLive ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex items-center gap-2 text-sm font-mono text-text-primary hover:text-primary tabular-nums transition-colors duration-300 ease-out truncate"
        >
          <span className="truncate">{url}</span>
          <ExternalLink
            size={12}
            strokeWidth={1.5}
            className="text-text-tertiary group-hover:text-primary transition-colors duration-300 ease-out flex-shrink-0"
          />
        </a>
      ) : (
        <p className="text-sm text-text-tertiary italic">
          No endpoint configured
        </p>
      )}
    </div>
  );
}

function GameModeField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Gamepad2;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} strokeWidth={1.5} className="text-text-tertiary" />
        <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em]">
          {label}
        </p>
      </div>
      <p className="font-display text-sm font-medium text-text-primary tracking-tight truncate">
        {value || (
          <span className="text-text-tertiary italic font-normal">—</span>
        )}
      </p>
    </div>
  );
}
