/**
 * ActiveTeamContext — global active-team selection.
 *
 * The user may belong to multiple teams. Most pages need ONE "current"
 * team to drive their data loading (Dashboard, World Studio, etc.).
 * This context owns that selection and persists it to localStorage
 * so it survives reloads.
 *
 * Behavior:
 *   - On mount, hydrate from localStorage (if previous selection exists)
 *     OR fall back to the first team from /api/auth/me.
 *   - Validate the stored selection against the user's current
 *     memberships — if the user lost access (or the team was deleted),
 *     fall back to the first team.
 *   - Expose `activeTeam` (the AuthTeamMembership) and `setActiveTeam`
 *     (selects a new active team by id; persists immediately).
 *   - `teams` reflects the full membership list so consumers can render
 *     a switcher without re-fetching.
 *
 * If the user has zero teams, `activeTeam` is null and `teams` is empty
 * — pages should render an empty / onboarding state in that case.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useForgeAuth } from "../auth/ForgeAuthProvider";
import {
  fetchCurrentUser,
  type AuthMeResponse,
  type AuthTeamMembership,
} from "../utils/worldProjectApi";

const STORAGE_KEY = "hyperforge:active-team-id";

interface ActiveTeamContextValue {
  /** All teams the current user belongs to. */
  teams: AuthTeamMembership[];
  /** Currently active team, or null when the user has no teams. */
  activeTeam: AuthTeamMembership | null;
  /** Server-side user record (for downstream consumers that need id/email). */
  me: AuthMeResponse | null;
  /** Loading state — true while fetching /api/auth/me. */
  loading: boolean;
  /** Error message if the fetch failed. */
  error: string | null;
  /** Select a team by id. Persists to localStorage. */
  setActiveTeamId: (teamId: string) => void;
  /** Force a refetch (e.g. after creating a new team). */
  refresh: () => Promise<void>;
}

const ActiveTeamContext = createContext<ActiveTeamContextValue | null>(null);

export function useActiveTeam(): ActiveTeamContextValue {
  const ctx = useContext(ActiveTeamContext);
  if (!ctx) {
    throw new Error(
      "useActiveTeam must be used within ActiveTeamProvider — wrap your app in <ActiveTeamProvider>.",
    );
  }
  return ctx;
}

function readStoredTeamId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTeamId(teamId: string | null) {
  try {
    if (teamId) localStorage.setItem(STORAGE_KEY, teamId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be disabled — silently fall back to in-memory only
  }
}

export function ActiveTeamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useForgeAuth();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [activeTeamId, setActiveTeamIdInternal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.authenticated) {
      setMe(null);
      setActiveTeamIdInternal(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const meData = await fetchCurrentUser();
      setMe(meData);

      // Resolve active team: stored > first team > null
      const stored = readStoredTeamId();
      const exists = stored
        ? meData.teams.find((t) => t.teamId === stored)
        : null;
      if (exists) {
        setActiveTeamIdInternal(exists.teamId);
      } else if (meData.teams.length > 0) {
        const first = meData.teams[0].teamId;
        setActiveTeamIdInternal(first);
        writeStoredTeamId(first);
      } else {
        setActiveTeamIdInternal(null);
        writeStoredTeamId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [auth.authenticated]);

  useEffect(() => {
    if (auth.ready && auth.authenticated) {
      load();
    }
  }, [auth.ready, auth.authenticated, load]);

  const setActiveTeamId = useCallback((teamId: string) => {
    setActiveTeamIdInternal(teamId);
    writeStoredTeamId(teamId);
  }, []);

  const activeTeam = useMemo(() => {
    if (!me || !activeTeamId) return null;
    return me.teams.find((t) => t.teamId === activeTeamId) ?? null;
  }, [me, activeTeamId]);

  const value = useMemo<ActiveTeamContextValue>(
    () => ({
      teams: me?.teams ?? [],
      activeTeam,
      me,
      loading,
      error,
      setActiveTeamId,
      refresh: load,
    }),
    [me, activeTeam, loading, error, setActiveTeamId, load],
  );

  return (
    <ActiveTeamContext.Provider value={value}>
      {children}
    </ActiveTeamContext.Provider>
  );
}
