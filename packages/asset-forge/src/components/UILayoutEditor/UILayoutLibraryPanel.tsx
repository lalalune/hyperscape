/**
 * UILayoutLibraryPanel — list / create / open UI layout assets.
 *
 * Acts as the "home" view for the UI Layout Editor. Lists layouts
 * visible to the current team, and offers Create + Open flows.
 *
 * Pattern mirrors the UE5 "UMG Widget Blueprint" library-then-editor
 * flow — clicking a row navigates to `/ui-layout/:teamId/:layoutId`,
 * which is the asset-scoped editor route.
 */

import { FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  UILayoutManifestSchema,
  type UILayoutManifest,
} from "@hyperforge/ui-framework";

import { buildUILayoutEditorPath } from "../../constants";
import {
  fetchCurrentUser,
  type AuthTeamMembership,
} from "../../utils/worldProjectApi";
import {
  createUILayout,
  listTeamUILayouts,
  type UILayoutSummary,
} from "../../utils/uiLayoutApi";

// ---------- Starter manifest ----------

/**
 * A freshly-created layout starts from this template. We go through
 * the Zod schema `.parse` so any drift between this inline literal
 * and the canonical schema fails loudly at author-time rather than
 * at server-validation time.
 */
function makeStarterLayout(name: string, id: string): UILayoutManifest {
  return UILayoutManifestSchema.parse({
    id,
    name,
    grid: { columns: 24, rows: 16 },
    instances: [],
  });
}

// ---------- State machine types ----------

type TeamsLoadStatus =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | {
      kind: "ready";
      teams: AuthTeamMembership[];
      selectedTeamId: string;
    };

type LayoutsLoadStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; layouts: UILayoutSummary[] };

// ---------- Component ----------

export function UILayoutLibraryPanel() {
  const navigate = useNavigate();

  const [teamsStatus, setTeamsStatus] = useState<TeamsLoadStatus>({
    kind: "loading",
  });
  const [layoutsStatus, setLayoutsStatus] = useState<LayoutsLoadStatus>({
    kind: "idle",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Resolve which team's library we're browsing.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((me) => {
        if (cancelled) return;
        if (me.teams.length === 0) {
          setTeamsStatus({ kind: "empty" });
          return;
        }
        setTeamsStatus({
          kind: "ready",
          teams: me.teams,
          selectedTeamId: me.teams[0].teamId,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTeamsStatus({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTeamId =
    teamsStatus.kind === "ready" ? teamsStatus.selectedTeamId : null;

  const reloadLayouts = useCallback((teamId: string) => {
    setLayoutsStatus({ kind: "loading" });
    listTeamUILayouts(teamId)
      .then((layouts) => {
        setLayoutsStatus({ kind: "ready", layouts });
      })
      .catch((err: unknown) => {
        setLayoutsStatus({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }, []);

  useEffect(() => {
    if (!selectedTeamId) return;
    reloadLayouts(selectedTeamId);
  }, [selectedTeamId, reloadLayouts]);

  const handleCreate = async () => {
    if (!selectedTeamId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      // Derive a unique manifest id from the current timestamp so the
      // client-side seed doesn't collide if the user creates multiple
      // layouts quickly. The server will overwrite this with its own
      // row id regardless; the manifest-internal id is purely for
      // display inside the manifest.
      const ts = Date.now();
      const manifestId = `layout_${ts}`;
      const displayName = `New Layout ${new Date(ts).toLocaleTimeString()}`;
      const manifest = makeStarterLayout(displayName, manifestId);

      const created = await createUILayout(selectedTeamId, {
        name: displayName,
        manifestData: manifest,
      });
      navigate(buildUILayoutEditorPath(selectedTeamId, created.id));
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const sortedLayouts = useMemo(() => {
    if (layoutsStatus.kind !== "ready") return [];
    return [...layoutsStatus.layouts].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [layoutsStatus]);

  // ---------- Shells for non-ready states ----------

  if (teamsStatus.kind === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-primary">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  if (teamsStatus.kind === "error") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-primary">
        <p className="text-sm text-red-400">
          Failed to load teams: {teamsStatus.message}
        </p>
      </div>
    );
  }

  if (teamsStatus.kind === "empty") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-primary">
        <p className="text-sm text-text-secondary">
          You must belong to a team to author UI layouts.
        </p>
      </div>
    );
  }

  // ---------- Main render ----------

  return (
    <div className="flex h-full w-full flex-col bg-bg-primary">
      <header className="flex items-center justify-between border-b border-bg-tertiary px-4 py-2">
        <div>
          <h1 className="text-sm font-semibold text-text-primary">
            UI Layout Library
          </h1>
          <p className="text-[10px] text-text-tertiary">
            Team:{" "}
            {teamsStatus.teams.find(
              (t) => t.teamId === teamsStatus.selectedTeamId,
            )?.teamName ?? teamsStatus.selectedTeamId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {teamsStatus.teams.length > 1 && (
            <select
              value={teamsStatus.selectedTeamId}
              onChange={(e) =>
                setTeamsStatus({
                  ...teamsStatus,
                  selectedTeamId: e.target.value,
                })
              }
              className="rounded-md border border-bg-tertiary bg-bg-secondary px-2 py-1 text-xs text-text-secondary"
            >
              {teamsStatus.teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() =>
              teamsStatus.kind === "ready" &&
              reloadLayouts(teamsStatus.selectedTeamId)
            }
            className="flex items-center gap-1 rounded-md border border-bg-tertiary bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:border-primary/50 hover:text-primary"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            New Layout
          </button>
        </div>
      </header>

      {createError && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          Failed to create layout: {createError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {layoutsStatus.kind === "loading" && (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        )}

        {layoutsStatus.kind === "error" && (
          <p className="text-sm text-red-400">
            Failed to load layouts: {layoutsStatus.message}
          </p>
        )}

        {layoutsStatus.kind === "ready" && sortedLayouts.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <FileText size={28} className="text-text-tertiary" />
            <p className="text-sm text-text-secondary">No UI layouts yet.</p>
            <p className="text-xs text-text-tertiary">
              Click &quot;New Layout&quot; to create one.
            </p>
          </div>
        )}

        {layoutsStatus.kind === "ready" && sortedLayouts.length > 0 && (
          <ul className="flex flex-col gap-1">
            {sortedLayouts.map((layout) => (
              <li key={layout.id}>
                <button
                  onClick={() =>
                    selectedTeamId &&
                    navigate(buildUILayoutEditorPath(selectedTeamId, layout.id))
                  }
                  className="flex w-full items-center gap-3 rounded-md border border-bg-tertiary bg-bg-secondary px-5 py-4 text-left hover:border-primary/40 hover:bg-bg-tertiary"
                >
                  <FileText size={14} className="text-primary/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {layout.name}
                      {layout.isTemplate && (
                        <span className="ml-2 rounded bg-primary/15 px-1 py-0.5 text-[9px] text-primary">
                          TEMPLATE
                        </span>
                      )}
                      {layout.isPublic && (
                        <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] text-amber-400">
                          PUBLIC
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-text-tertiary">
                      {layout.slug} · v{layout.version} · updated{" "}
                      {new Date(layout.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
