/**
 * AssetPacksPage — top-level HyperForge tool for browsing the
 * marketplace + managing your team's asset packs.
 *
 * Mounts the existing `AssetPackBrowserPanel` in `mode="manage"`
 * so the entire create/add-entry/publish/unpublish flow works
 * WITHOUT requiring a project to be loaded in World Studio.
 *
 * The team to scope to is the first team the authenticated user
 * is a member of. Multi-team users get a picker; single-team
 * users (most everyone) skip it.
 */

import { Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AssetPackBrowserPanel } from "../components/WorldStudio/panels/AssetPackBrowserPanel";
import { EmptyHero, ErrorBanner, StatusDot } from "../components/shared/page";
import { ROUTES } from "../constants";
import {
  fetchCurrentUser,
  type AuthTeamMembership,
} from "../utils/worldProjectApi";

const TEAM_LS_KEY = "assetForge.assetPacksPage.activeTeamId";

interface FetchState {
  loading: boolean;
  error: string | null;
  teams: AuthTeamMembership[];
}

export function AssetPacksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: true,
    error: null,
    teams: [],
  });
  const [activeTeamId, setActiveTeamId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TEAM_LS_KEY);
  });

  // Snapshot the celebration params on mount so we can pass them
  // through to the panel as initialFlash/autoExpand. We then strip
  // them from the URL so a refresh doesn't re-fire the toast.
  // Captured once via useState lazy init — useEffect-with-no-deps
  // would cause a render loop on the searchParams reference change.
  const [celebration] = useState(() => {
    const justAdded = searchParams.get("justAdded");
    const addedAssetName = searchParams.get("addedAssetName");
    if (!justAdded) return null;
    return { manifestId: justAdded, assetName: addedAssetName };
  });

  useEffect(() => {
    if (!celebration) return;
    const next = new URLSearchParams(searchParams);
    next.delete("justAdded");
    next.delete("addedAssetName");
    setSearchParams(next, { replace: true });
    // Run once after celebration capture; subsequent searchParams
    // changes (e.g. user navigating in-page) shouldn't re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebration]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchCurrentUser();
        if (cancelled) return;
        setFetchState({ loading: false, error: null, teams: me.teams });
        // Pick the first team if none stashed (or stashed one no
        // longer matches a current membership).
        const stashedValid =
          activeTeamId && me.teams.some((t) => t.teamId === activeTeamId);
        if (!stashedValid && me.teams.length > 0) {
          setActiveTeamId(me.teams[0].teamId);
        }
      } catch (err) {
        if (cancelled) return;
        setFetchState({
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          teams: [],
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only run once on mount; activeTeamId is read but not a dep
    // (we don't want to re-fetch /me when the user picks a team).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTeamId) window.localStorage.setItem(TEAM_LS_KEY, activeTeamId);
  }, [activeTeamId]);

  const activeTeam = useMemo(
    () => fetchState.teams.find((t) => t.teamId === activeTeamId) ?? null,
    [fetchState.teams, activeTeamId],
  );

  const isLoading = fetchState.loading;
  const isReady =
    !fetchState.loading && !fetchState.error && fetchState.teams.length > 0;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Editorial page header */}
      <header className="px-6 py-6 border-b border-border-primary">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                00
              </span>
              <span className="font-display text-base font-medium text-text-primary tracking-tight">
                Library
              </span>
              <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                <StatusDot tone={isReady ? "ready" : "idle"} />
                {isLoading
                  ? "Loading"
                  : isReady
                    ? `${fetchState.teams.length} team${fetchState.teams.length === 1 ? "" : "s"}`
                    : "No teams"}
              </span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-medium text-text-primary tracking-tight leading-[1.05]">
              Asset <span className="text-primary">packs</span>
            </h1>
            <p className="text-sm text-text-tertiary leading-relaxed mt-2 max-w-2xl">
              Bundle 3D assets into reusable packs. Install on any team project,
              or publish to the marketplace.
            </p>
          </div>

          {fetchState.teams.length > 1 && (
            <div className="flex-shrink-0 min-w-[200px]">
              <label className="block text-[10px] text-text-tertiary uppercase tracking-[0.14em] mb-1.5">
                Team
              </label>
              <select
                value={activeTeamId ?? ""}
                onChange={(e) => setActiveTeamId(e.target.value)}
                className="input"
              >
                {fetchState.teams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.teamName} ({t.role})
                  </option>
                ))}
              </select>
            </div>
          )}
          {fetchState.teams.length === 1 && activeTeam && (
            <div className="flex-shrink-0">
              <p className="text-[10px] text-text-tertiary uppercase tracking-[0.14em] mb-1.5">
                Team
              </p>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary text-[11px] text-text-secondary uppercase tracking-[0.12em]">
                <Users size={11} strokeWidth={1.5} />
                {activeTeam.teamName}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {fetchState.loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <Loader2
              size={14}
              strokeWidth={1.5}
              className="animate-spin text-text-tertiary"
            />
            <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              Loading teams
            </span>
          </div>
        )}

        {!fetchState.loading && fetchState.error && (
          <div className="px-6 py-8">
            <ErrorBanner
              message={`Failed to load teams: ${fetchState.error}`}
            />
          </div>
        )}

        {!fetchState.loading &&
          !fetchState.error &&
          fetchState.teams.length === 0 && (
            <div className="flex items-center justify-center px-6 py-16">
              <div className="w-full max-w-md">
                <EmptyHero
                  message="No team memberships"
                  subtitle="Asset packs are scoped to teams. Create or join a team to start authoring packs."
                  ctaLabel="Create a team"
                  ctaTo={ROUTES.TEAMS}
                />
              </div>
            </div>
          )}

        {isReady && activeTeamId && (
          <AssetPackBrowserPanel
            mode="manage"
            teamId={activeTeamId}
            teamName={activeTeam?.teamName ?? null}
            initialFlash={
              celebration
                ? celebration.assetName
                  ? `Added ${celebration.assetName} to your pack.`
                  : "Added to your pack."
                : null
            }
            autoExpandPackId={celebration?.manifestId ?? null}
          />
        )}
      </div>
    </div>
  );
}

export default AssetPacksPage;
