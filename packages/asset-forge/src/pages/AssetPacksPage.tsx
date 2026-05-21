/**
 * AssetPacksPage — top-level Asset Forge tool for browsing the
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

import { Loader2, Package, Users } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AssetPackBrowserPanel } from "../components/WorldStudio/panels/AssetPackBrowserPanel";
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

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Page header — friendlier title + subtitle */}
      <div className="px-6 py-5 border-b border-border-primary">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 flex-shrink-0">
              <Package size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-text-primary leading-tight">
                Asset Packs
              </h1>
              <p className="text-xs text-text-tertiary leading-relaxed mt-1 max-w-xl">
                Bundle 3D assets — characters, props, weapons, vehicles — into
                reusable packs your team can install on any project, or publish
                to the marketplace for anyone to use.
              </p>
            </div>
          </div>

          {fetchState.teams.length > 1 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Users size={11} className="text-text-tertiary" />
              <select
                value={activeTeamId ?? ""}
                onChange={(e) => setActiveTeamId(e.target.value)}
                className="px-2 py-1 text-xs bg-bg-tertiary/40 border border-border-primary rounded text-text-primary focus:outline-none focus:border-primary/40"
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
            <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary flex-shrink-0">
              <Users size={11} />
              {activeTeam.teamName}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {fetchState.loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {!fetchState.loading && fetchState.error && (
          <div className="px-4 py-8 text-center text-xs text-red-400">
            Failed to load teams: {fetchState.error}
          </div>
        )}

        {!fetchState.loading &&
          !fetchState.error &&
          fetchState.teams.length === 0 && (
            <div className="px-4 py-12 text-center space-y-2">
              <Users size={20} className="mx-auto text-text-tertiary/60" />
              <p className="text-xs text-text-tertiary">
                You're not a member of any team yet.
              </p>
              <p className="text-[11px] text-text-tertiary/70 max-w-md mx-auto leading-relaxed">
                Asset packs are scoped to teams — create or join a team to start
                authoring packs.
              </p>
            </div>
          )}

        {!fetchState.loading &&
          !fetchState.error &&
          activeTeamId &&
          fetchState.teams.length > 0 && (
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
