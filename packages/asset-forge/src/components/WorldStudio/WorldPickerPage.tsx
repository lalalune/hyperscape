/**
 * WorldPickerPage — Project list with game selector
 *
 * Shown at /world-studio when no projectId is in the URL.
 * Lists saved world projects, allows creating new ones.
 *
 * When not authenticated, shows a login prompt.
 */

import { Plus, Globe, Loader2, Lock, Trash2, LogIn } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useForgeAuth } from "../../auth/ForgeAuthProvider";
import { ROUTES } from "../../constants";
import {
  AtmosphericScene,
  EmptyHero,
  ErrorBanner,
  StatusDot,
} from "../shared/page";
import { ForgeLogo } from "../shared/ForgeLogo";
import { formatDateTime } from "../../utils/formatters";
import {
  fetchCurrentUser,
  fetchTeamGames,
  listWorldProjects,
  deleteWorldProject,
  type AuthMeResponse,
  type GameResponse,
  type WorldProjectSummary,
} from "../../utils/worldProjectApi";
import { NewWorldDialog } from "./NewWorldDialog";

export function WorldPickerPage() {
  const navigate = useNavigate();
  const auth = useForgeAuth();
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [games, setGames] = useState<GameResponse[]>([]);
  const [projects, setProjects] = useState<WorldProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load user + teams once authenticated
  useEffect(() => {
    if (!auth.ready || !auth.authenticated) return;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const me = await fetchCurrentUser();
        if (cancelled) return;
        setUser(me);

        if (me.teams.length > 0) {
          const teamId = me.teams[0].teamId;
          setSelectedTeamId(teamId);
          const teamGames = await fetchTeamGames(teamId);
          if (cancelled) return;
          setGames(teamGames);
          if (teamGames.length > 0) {
            setSelectedGameId(teamGames[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load user data",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [auth.ready, auth.authenticated]);

  // Load projects when team+game selected
  useEffect(() => {
    if (!selectedTeamId || !selectedGameId) return;
    let cancelled = false;
    async function loadProjects() {
      try {
        const list = await listWorldProjects(selectedTeamId!, selectedGameId!);
        if (!cancelled) setProjects(list);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load projects",
          );
        }
      }
    }
    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, selectedGameId]);

  const handleTeamChange = useCallback(async (teamId: string) => {
    setSelectedTeamId(teamId);
    setSelectedGameId(null);
    setGames([]);
    setProjects([]);
    try {
      const teamGames = await fetchTeamGames(teamId);
      setGames(teamGames);
      if (teamGames.length > 0) {
        setSelectedGameId(teamGames[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load games");
    }
  }, []);

  const handleDelete = useCallback(async (projectId: string) => {
    if (!confirm("Delete this world project? This cannot be undone.")) return;
    try {
      setDeletingId(projectId);
      await deleteWorldProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleProjectCreated = useCallback(
    (projectId: string) => {
      navigate(`${ROUTES.WORLD_STUDIO}/${projectId}`);
    },
    [navigate],
  );

  // ─── Pre-content states ────────────────────────────────────────

  if (!auth.ready) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <Loader2
          size={20}
          strokeWidth={1.5}
          className="animate-spin text-text-tertiary"
        />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="relative min-h-full bg-bg-primary overflow-hidden">
        <AtmosphericScene topEllipseHeight={520} horizonY={360} />
        <div className="relative flex items-center justify-center min-h-[calc(100vh-44px)] px-10">
          <div className="text-center max-w-md">
            <ForgeLogo size={56} className="mx-auto mb-6 opacity-60" />
            <div className="flex items-baseline gap-3 justify-center mb-3">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                00 / Studio
              </span>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                Sign-in required
              </span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-medium text-text-primary tracking-tight leading-[1.05] mb-3">
              World <span className="text-primary">studio</span>
            </h1>
            <p className="text-sm text-text-tertiary leading-relaxed mb-7">
              Sign in to create and manage world projects across your team.
            </p>
            <button type="button" className="btn-primary" onClick={auth.login}>
              <LogIn size={14} strokeWidth={1.5} />
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-3 bg-bg-primary">
        <Loader2
          size={14}
          strokeWidth={1.5}
          className="animate-spin text-text-tertiary"
        />
        <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          Loading worlds
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-bg-primary px-10 py-16">
        <div className="max-w-2xl mx-auto">
          <ErrorBanner variant="page" message={error} />
          <div className="text-center mt-6">
            <button
              type="button"
              className="text-[11px] text-text-tertiary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.teams.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary px-10 py-12">
        <div className="w-full max-w-md">
          <EmptyHero
            message="No team memberships"
            subtitle="World projects are scoped to teams. Create or join a team to start building worlds."
            ctaLabel="Manage teams"
            ctaTo={ROUTES.TEAMS}
          />
        </div>
      </div>
    );
  }

  // ─── Main view ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-44px)] bg-bg-primary">
      {/* Slim editorial top strip */}
      <header className="px-6 py-3 border-b border-border-primary flex-shrink-0 flex items-center gap-4 flex-wrap">
        <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
          00 / Studio
        </span>
        <span className="text-text-tertiary/40">·</span>
        <span className="font-display text-sm font-medium text-text-primary tracking-tight">
          World <span className="text-primary">studio</span>
        </span>
        <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
          <StatusDot tone={projects.length > 0 ? "ready" : "idle"} />
          <span className="font-mono normal-case tracking-normal tabular-nums">
            {projects.length}
          </span>
          {projects.length === 1 ? "world" : "worlds"}
        </span>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {user.teams.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
                Team
              </span>
              <select
                className="input py-1.5 text-xs"
                value={selectedTeamId ?? ""}
                onChange={(e) => handleTeamChange(e.target.value)}
              >
                {user.teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {games.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary uppercase tracking-[0.14em]">
                Game
              </span>
              <select
                className="input py-1.5 text-xs"
                value={selectedGameId ?? ""}
                onChange={(e) => setSelectedGameId(e.target.value)}
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            className="btn-primary"
            onClick={() => setShowNewDialog(true)}
            disabled={!selectedTeamId || !selectedGameId}
          >
            <Plus size={13} strokeWidth={1.5} />
            New world
          </button>
        </div>
      </header>

      {/* Project grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-full max-w-md">
              <EmptyHero
                message="No worlds yet"
                subtitle="Create your first world to start building. Each world is a separate procedural scene with its own terrain, biomes, and entities."
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-[1400px] mx-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`${ROUTES.WORLD_STUDIO}/${project.id}`)}
                className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out overflow-hidden text-left"
              >
                {/* Forge Gold left-edge on hover */}
                <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

                {/* Thumbnail placeholder — flat brand surface */}
                <div className="aspect-[16/9] bg-bg-primary border-b border-border-primary flex items-center justify-center">
                  <Globe
                    size={28}
                    strokeWidth={1.25}
                    className="text-text-tertiary/40 group-hover:text-primary/40 transition-colors duration-500 ease-out"
                  />
                </div>

                {/* Info */}
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[13px] font-medium text-text-primary tracking-tight leading-tight line-clamp-1 flex-1">
                      {project.name}
                    </h3>
                    {project.lockedBy && (
                      <Lock
                        size={11}
                        strokeWidth={1.5}
                        className="text-warning flex-shrink-0 mt-0.5"
                        aria-label="Locked"
                      />
                    )}
                  </div>
                  {project.description && (
                    <p className="text-[11px] text-text-tertiary leading-relaxed line-clamp-2 flex-1">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-text-tertiary uppercase tracking-[0.1em] pt-2 border-t border-border-primary mt-auto">
                    <span className="font-mono tabular-nums normal-case tracking-normal">
                      v{project.version}
                    </span>
                    <span className="font-mono normal-case tracking-normal truncate ml-2">
                      {formatDateTime(project.updatedAt)}
                    </span>
                  </div>
                </div>

                {/* Delete (hover) — error-tone affordance */}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Delete project"
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-bg-primary/80 text-text-tertiary hover:text-error opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deletingId !== project.id) handleDelete(project.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (deletingId !== project.id) handleDelete(project.id);
                    }
                  }}
                >
                  {deletingId === project.id ? (
                    <Loader2
                      size={12}
                      strokeWidth={1.5}
                      className="animate-spin"
                    />
                  ) : (
                    <Trash2 size={12} strokeWidth={1.5} />
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New World Dialog */}
      {showNewDialog && selectedTeamId && selectedGameId && (
        <NewWorldDialog
          teamId={selectedTeamId}
          gameId={selectedGameId}
          onClose={() => setShowNewDialog(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
