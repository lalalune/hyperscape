/**
 * HistoryPanel — project revision history (G1.b).
 *
 * Lists `world_project_revisions` for the active project, newest
 * first. Each entry shows author + reason + version + timestamp.
 * Clicking "Restore" writes the revision's snapshot back into the
 * project (the current state is captured into a new revision
 * first so the restore itself is reversible).
 *
 * The viewport doesn't auto-refresh post-restore; the user has to
 * reload to see the rolled-back content. That's a follow-up — for
 * now the explicit reload is the source of truth.
 */

import { History, Loader2, RotateCcw, Sparkles, User } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { useWorldStudio } from "../WorldStudioContext";
import {
  listProjectRevisions,
  restoreProjectRevision,
  type ProjectRevisionSummary,
} from "../../../utils/worldProjectApi";

export function HistoryPanel() {
  const { state } = useWorldStudio();
  const projectId = state.project.currentProjectId;

  if (!projectId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center px-6 py-8 gap-2 text-text-tertiary text-xs">
        <History size={20} className="text-primary/60" />
        <div>Save the project to view its revision history.</div>
      </div>
    );
  }

  return <HistoryInner projectId={projectId} />;
}

function HistoryInner({ projectId }: { projectId: string }) {
  const [revisions, setRevisions] = useState<
    ReadonlyArray<ProjectRevisionSummary>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listProjectRevisions(projectId, { limit: 50 });
      setRevisions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRestore = useCallback(
    async (revisionId: string) => {
      const proceed = window.confirm(
        "Restore this revision? The current project state will be saved as a new revision first, so this is reversible.",
      );
      if (!proceed) return;
      setRestoringId(revisionId);
      try {
        await restoreProjectRevision(projectId, revisionId);
        await refresh();
        // The viewport reads from agentWorldContent which doesn't
        // auto-refresh on a server-side restore. Force a page
        // reload so the user sees the rolled-back state.
        window.location.reload();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[HistoryPanel] restore failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setRestoringId(null);
      }
    },
    [projectId, refresh],
  );

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-b from-bg-secondary to-bg-secondary/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30">
            <History size={11} className="text-primary" />
          </div>
          <span className="text-[12px] font-semibold text-text-primary">
            History
          </span>
          {!loading && revisions.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary">
              {revisions.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RotateCcw size={10} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading && revisions.length === 0 ? (
          <div className="flex items-center gap-2 text-[11px] text-text-tertiary py-4">
            <Loader2 size={12} className="animate-spin" />
            Loading revisions…
          </div>
        ) : error ? (
          <div className="text-[11px] text-red-400 px-2 py-2 bg-red-500/10 rounded-md ring-1 ring-red-500/25 leading-relaxed">
            {error}
          </div>
        ) : revisions.length === 0 ? (
          <div className="text-[11px] text-text-tertiary py-6 text-center leading-relaxed">
            No revisions yet.
            <br />
            They'll appear as you (or the agent) edit the project.
          </div>
        ) : (
          revisions.map((rev) => (
            <RevisionCard
              key={rev.id}
              revision={rev}
              isRestoring={restoringId === rev.id}
              disabled={restoringId !== null}
              onRestore={() => void handleRestore(rev.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RevisionCardProps {
  revision: ProjectRevisionSummary;
  isRestoring: boolean;
  disabled: boolean;
  onRestore: () => void;
}

function RevisionCard({
  revision,
  isRestoring,
  disabled,
  onRestore,
}: RevisionCardProps) {
  const isAgent = revision.author === "agent";
  const wc = (revision.worldContent ?? {}) as {
    npcs?: unknown[];
    spawns?: unknown[];
    quests?: unknown[];
    zones?: unknown[];
    uiPack?: unknown;
  };
  const counts: Array<[string, number]> = [
    ["npcs", Array.isArray(wc.npcs) ? wc.npcs.length : 0],
    ["mobs", Array.isArray(wc.spawns) ? wc.spawns.length : 0],
    ["quests", Array.isArray(wc.quests) ? wc.quests.length : 0],
    ["zones", Array.isArray(wc.zones) ? wc.zones.length : 0],
  ];
  const nonZero = counts.filter(([, n]) => n > 0);

  return (
    <div className="bg-bg-tertiary rounded-lg ring-1 ring-white/[0.06] p-2.5 group hover:ring-primary/30 transition-all">
      <div className="flex items-start gap-2">
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ring-1 ${
            isAgent
              ? "bg-primary/15 text-primary ring-primary/30"
              : "bg-bg-secondary/60 text-text-tertiary ring-white/[0.05]"
          }`}
        >
          {isAgent ? <Sparkles size={11} /> : <User size={11} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-text-primary capitalize">
              {revision.author}
            </span>
            <span className="text-text-tertiary font-mono text-[10px]">
              v{revision.version}
            </span>
            <span className="text-text-tertiary text-[10px]">
              · {formatRelativeTime(revision.createdAt)}
            </span>
          </div>
          {revision.changeReason && (
            <div className="text-[11px] text-text-tertiary mt-0.5 truncate">
              {revision.changeReason}
            </div>
          )}
          {nonZero.length > 0 && (
            <div className="text-[10px] text-text-tertiary mt-1 font-mono">
              {nonZero.map(([k, n]) => `${n} ${k}`).join(" · ")}
            </div>
          )}
          <button
            type="button"
            onClick={onRestore}
            disabled={disabled}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRestoring ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                Restoring…
              </>
            ) : (
              <>
                <RotateCcw size={10} />
                Restore this version
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
