/**
 * WorldPickerPage — Project list with game selector
 *
 * Shown at /world-studio when no projectId is in the URL.
 * Lists saved world projects, allows creating new ones.
 *
 * When not authenticated, shows a login prompt.
 */

import {
  Plus,
  Globe,
  Loader2,
  AlertTriangle,
  Lock,
  Trash2,
  LogIn,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { useForgeAuth } from "../../auth/ForgeAuthProvider";
import { ROUTES } from "../../constants";
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Privy not ready yet
  if (!auth.ready) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated — show login
  if (!auth.authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <Globe size={48} className="text-text-tertiary/50 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            World Studio
          </h2>
          <p className="text-sm text-text-tertiary mb-6">
            Sign in to create and manage world projects.
          </p>
          <button
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors ease-out"
            onClick={auth.login}
          >
            <LogIn size={16} />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Loading user data
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-6">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No teams
  if (!user || user.teams.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-6">
          <Globe size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-sm text-text-secondary mb-1">No teams found</p>
          <p className="text-xs text-text-tertiary">
            Create or join a team to start building worlds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 bg-bg-secondary"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          borderTop: "1px solid var(--surface-highlight)",
        }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-text-primary">
            World Studio
          </h1>

          {/* Team selector */}
          {user.teams.length > 1 && (
            <select
              className="px-2 py-1.5 text-xs rounded-[3px] text-text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                boxShadow: "var(--input-shadow)",
              }}
              value={selectedTeamId ?? ""}
              onChange={(e) => handleTeamChange(e.target.value)}
            >
              {user.teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          )}

          {/* Game selector */}
          {games.length > 1 && (
            <select
              className="px-2 py-1.5 text-xs rounded-[3px] text-text-primary focus:outline-none focus:border-primary/50 cursor-pointer"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                boxShadow: "var(--input-shadow)",
              }}
              value={selectedGameId ?? ""}
              onChange={(e) => setSelectedGameId(e.target.value)}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 ease-out"
          onClick={() => setShowNewDialog(true)}
          disabled={!selectedTeamId || !selectedGameId}
        >
          <Plus size={16} />
          New World
        </button>
      </div>

      {/* Project grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {projects.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <Globe size={48} className="text-text-tertiary/50 mx-auto mb-4" />
              <p className="text-sm text-text-secondary mb-1">No worlds yet</p>
              <p className="text-xs text-text-tertiary mb-4">
                Create your first world to get started.
              </p>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors ease-out"
                onClick={() => setShowNewDialog(true)}
              >
                <Plus size={16} />
                New World
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative bg-bg-secondary border border-border-secondary rounded-lg overflow-hidden hover:border-primary/40 transition-all duration-300 cursor-pointer ease-out"
                style={{ borderTop: "1px solid var(--surface-highlight)" }}
                onClick={() => navigate(`${ROUTES.WORLD_STUDIO}/${project.id}`)}
              >
                {/* Thumbnail placeholder */}
                <div className="h-32 bg-gradient-to-br from-bg-tertiary to-bg-primary flex items-center justify-center">
                  <Globe size={32} className="text-text-tertiary/30" />
                </div>

                {/* Info */}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {project.name}
                    </h3>
                    {project.lockedBy && (
                      <Lock
                        size={12}
                        className="text-amber-400 flex-shrink-0"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                    <span>v{project.version}</span>
                    <span>{formatDate(project.updatedAt)}</span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-text-tertiary truncate">
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Delete button (hover) */}
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-bg-secondary/80 text-text-tertiary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ease-out"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                  disabled={deletingId === project.id}
                  title="Delete project"
                >
                  {deletingId === project.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
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
