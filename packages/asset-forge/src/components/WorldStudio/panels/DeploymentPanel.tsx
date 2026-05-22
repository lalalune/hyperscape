/**
 * DeploymentPanel — Staging → Production deployment pipeline UI
 *
 * Shows:
 * - Push to Staging button with compilation status
 * - Diff view (staging vs production changes)
 * - Promote to Production with approval flow
 * - Deployment history with rollback
 */

import {
  Upload,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileJson,
  ExternalLink,
  Circle,
} from "lucide-react";
import React, { useState, useCallback, useEffect } from "react";

import type {
  DeploymentRecord,
  ManifestDiffEntry,
  ManifestCategory,
} from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import { useManifestCompiler } from "../hooks/useManifestCompiler";
import { applyVegetationPaintStrokes } from "../utils/brushApplication";

// Category display configuration
const CATEGORY_LABELS: Record<ManifestCategory, string> = {
  world: "World",
  entities: "Entities",
  items: "Items",
  combat: "Combat",
  progression: "Progression",
  recipes: "Recipes",
  gathering: "Gathering",
  audio: "Audio",
  config: "Config",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle2 size={12} className="text-green-400" />,
  failed: <XCircle size={12} className="text-red-400" />,
  "rolled-back": <RotateCcw size={12} className="text-amber-400" />,
  deploying: <Loader2 size={12} className="text-blue-400 animate-spin" />,
  pending: <Clock size={12} className="text-text-tertiary" />,
};

function DiffCategoryGroup({
  category,
  entries,
}: {
  category: ManifestCategory;
  entries: ManifestDiffEntry[];
}) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const totalChanges = entries.reduce(
    (sum, e) => sum + e.entriesAdded + e.entriesModified + e.entriesRemoved,
    0,
  );

  return (
    <div className="border-b border-border-primary/30 last:border-0">
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs hover:bg-bg-tertiary transition-colors ease-out"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="font-medium text-text-primary">
          {CATEGORY_LABELS[category]}
        </span>
        <span className="text-text-tertiary ml-auto">
          {totalChanges} change{totalChanges !== 1 ? "s" : ""}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-0.5">
          {entries.map((entry) => (
            <div
              key={entry.filename}
              className="flex items-center gap-1.5 text-[10px] pl-4"
            >
              <FileJson
                size={10}
                className="text-text-tertiary flex-shrink-0"
              />
              <span className="text-text-secondary truncate flex-1">
                {entry.filename}
              </span>
              <span
                className={
                  entry.changeType === "added"
                    ? "text-green-400"
                    : entry.changeType === "removed"
                      ? "text-red-400"
                      : "text-amber-400"
                }
              >
                {entry.summary}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeploymentHistoryEntry({ record }: { record: DeploymentRecord }) {
  const { actions } = useWorldStudio();
  const [expanded, setExpanded] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const date = new Date(record.deployedAt);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  // Phase 5.2: Wire rollback to game server endpoint
  const handleRollback = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsRollingBack(true);

      const serverUrl =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_GAME_SERVER_URL ||
        "http://localhost:5555";
      const adminCode = import.meta.env.VITE_ADMIN_CODE ?? "hyperia-admin";

      try {
        const resp = await fetch(
          `${serverUrl}/api/deploy/rollback/${record.id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-code": adminCode,
            },
          },
        );

        if (resp.ok) {
          console.log(`[Deploy] Rolled back to deployment ${record.id}`);
          actions.deployRollback(record.id);
        } else {
          const body = (await resp.json().catch(() => ({}))) as {
            error?: string;
          };
          console.error(
            `[Deploy] Rollback failed: ${body.error ?? resp.status}`,
          );
        }
      } catch {
        console.error("[Deploy] Rollback failed — server unreachable");
      } finally {
        setIsRollingBack(false);
      }
    },
    [record.id, actions],
  );

  return (
    <div className="border-b border-border-primary/30 last:border-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bg-tertiary transition-colors ease-out"
        onClick={() => setExpanded(!expanded)}
      >
        {STATUS_ICONS[record.status] ?? <Clock size={12} />}
        <div className="flex-1 text-left">
          <div className="text-text-primary">
            {record.target === "staging" ? "Staging" : "Production"} push
          </div>
          <div className="text-[10px] text-text-tertiary">
            {dateStr} {timeStr} · {record.diff.totalAdded} added,{" "}
            {record.diff.totalModified} modified
          </div>
        </div>
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          <div className="text-[10px] text-text-tertiary">
            Version: {record.worldVersion}
          </div>
          {record.approvedBy && (
            <div className="text-[10px] text-text-tertiary">
              Approved by: {record.approvedBy}
            </div>
          )}
          {record.error && (
            <div className="text-[10px] text-red-400">{record.error}</div>
          )}
          {record.status === "success" && record.target === "production" && (
            <button
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-400 hover:bg-amber-400/10 rounded transition-colors disabled:opacity-40 ease-out"
              disabled={isRollingBack}
              onClick={handleRollback}
            >
              {isRollingBack ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <RotateCcw size={10} />
              )}
              {isRollingBack ? "Rolling back..." : "Rollback to previous"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface StagingStatus {
  hasFiles: boolean;
  fileCount: number;
  files: string[];
  lastDeployedAt: string | null;
  lastDeployedBy: string | null;
}

export function DeploymentPanel() {
  const { state, actions, viewportRef } = useWorldStudio();
  const { compile, diff } = useManifestCompiler();
  const deployment = state.deployment;

  const [activeTab, setActiveTab] = useState<"deploy" | "history">("deploy");
  const [stagingStatus, setStagingStatus] = useState<StagingStatus | null>(
    null,
  );

  // Fetch staging status and deployment history on mount and after successful push
  useEffect(() => {
    const controller = new AbortController();
    const serverUrl =
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_GAME_SERVER_URL ||
      "http://localhost:5555";

    const fetchStatus = async () => {
      try {
        const resp = await fetch(`${serverUrl}/api/deploy/staging/status`, {
          signal: controller.signal,
        });
        if (resp.ok) {
          setStagingStatus((await resp.json()) as StagingStatus);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          // Server not reachable — leave status null
        }
      }
    };

    // Phase 5.1: Load deployment history from game server on mount
    const fetchHistory = async () => {
      try {
        const resp = await fetch(`${serverUrl}/api/deploy/history`, {
          signal: controller.signal,
        });
        if (resp.ok) {
          const data = (await resp.json()) as {
            deployments: Array<{
              id: string;
              target: "staging" | "production";
              deployedBy: string;
              deployedAt: string;
              manifestCount: number;
              status: string;
              diffSummary: { added: number; modified: number; removed: number };
            }>;
          };
          // Convert game server records to client format
          if (data.deployments.length > 0 && deployment.history.length === 0) {
            const records: DeploymentRecord[] = data.deployments.map((d) => ({
              id: d.id,
              target: d.target,
              deployedBy: d.deployedBy,
              deployedAt: d.deployedAt,
              worldVersion: "unknown",
              diff: {
                manifests: [],
                assetChanges: [],
                totalAdded: d.diffSummary?.added ?? 0,
                totalModified: d.diffSummary?.modified ?? 0,
                totalRemoved: d.diffSummary?.removed ?? 0,
              },
              status:
                d.status === "active"
                  ? "success"
                  : (d.status as DeploymentRecord["status"]),
              manifestCount: d.manifestCount,
            }));
            actions.deployHistoryLoad(records);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          // Server not reachable — history stays empty
        }
      }
    };

    void fetchStatus();
    void fetchHistory();

    return () => controller.abort();
  }, [deployment.stagingStatus]);

  const world = state.builder.editing.world;
  const canPushStaging =
    (world !== null && deployment.stagingStatus === "idle") ||
    deployment.stagingStatus === "success" ||
    deployment.stagingStatus === "error";

  const handlePushStaging = useCallback(async () => {
    if (!world) return;

    actions.deployStagingStart();

    try {
      // Step 1: Compile — apply vegetation paint strokes to trees before export
      let treesForExport = viewportRef.current?.vegetationTrees;
      const vegPaints = state.brushOverlays.vegetationPaints;
      const biomeQuerier = viewportRef.current?.queryBiome;
      if (treesForExport && vegPaints.length > 0 && biomeQuerier) {
        treesForExport = applyVegetationPaintStrokes(
          treesForExport,
          vegPaints,
          (wx, wz) => biomeQuerier(wx, wz).height,
        );
      }
      const compiled = compile(
        world,
        state.extendedLayers,
        state.audioLayers,
        state.manifests,
        state.brushOverlays,
        treesForExport,
      );

      actions.deployStagingStatus("pushing");

      // Step 2: Push to game server staging endpoint
      // The deploy routes live on the game server (default port 5555), not the HyperForge UI
      const serverUrl =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_GAME_SERVER_URL ||
        "http://localhost:5555";
      const adminCode = import.meta.env.VITE_ADMIN_CODE ?? "hyperia-admin";

      // Convert Map to plain object for JSON serialization
      const manifestsObj: Record<string, unknown> = {};
      for (const [key, value] of compiled.files) {
        manifestsObj[key] = value;
      }

      let resp: Response;
      try {
        resp = await fetch(`${serverUrl}/api/deploy/staging`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-code": adminCode,
          },
          body: JSON.stringify({
            manifests: manifestsObj,
            worldJson: compiled.worldJson,
            deployedBy: state.project.currentTeamId ?? "local",
          }),
        });
      } catch {
        actions.deployStagingStatus(
          "error",
          `Game server unreachable at ${serverUrl}. Is \`bun run dev\` running?`,
        );
        return;
      }

      if (!resp.ok) {
        let errorDetail = `Server returned ${resp.status}`;
        try {
          const body = (await resp.json()) as {
            error?: string;
            details?: string[];
          };
          if (body.error) errorDetail = body.error;
          if (body.details?.length)
            errorDetail += `: ${body.details.join(", ")}`;
        } catch {
          // Could not parse error body
        }
        if (resp.status === 401) {
          errorDetail +=
            ". Set VITE_ADMIN_CODE in asset-forge/.env to match the server's ADMIN_CODE";
        }
        actions.deployStagingStatus("error", errorDetail);
        return;
      }

      const data = (await resp.json()) as {
        deploymentId?: string;
        manifestCount?: number;
        diff?: { added: string[]; modified: string[]; removed: string[] };
      };
      const serverDeploymentId = data.deploymentId;
      const manifestCount = data.manifestCount ?? compiled.files.size;
      console.log(
        `[Deploy] Pushed ${manifestCount} manifests to server staging: ${serverDeploymentId}`,
      );

      // Persist deployment record to HyperForge database (Phase 5.1)
      try {
        const projectId = state.project.currentProjectId;
        const gameId = state.project.currentGameId;
        if (projectId && gameId) {
          await fetch("/api/world/deployments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              gameId,
              target: "staging",
              version: state.project.projectVersion,
              deployedBy: state.project.currentTeamId ?? "local",
              manifestDiff: data.diff,
            }),
          });

          // Save manifest snapshot (Phase 5.4)
          const snapshotObj: Record<string, unknown> = {};
          for (const [key, value] of compiled.files) {
            snapshotObj[key] = value;
          }
          await fetch(`/api/world/deployments/project/${projectId}/snapshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ manifestSnapshot: snapshotObj }),
          });
        }
      } catch {
        // DB persistence is best-effort — don't fail the deployment
        console.warn(
          "[Deploy] Could not persist deployment record to database",
        );
      }

      // Step 3: Verify staging files are accessible
      actions.deployStagingStatus("reloading");
      try {
        const verifyResp = await fetch(
          `${serverUrl}/game-assets/staging/manifests/world-config.json`,
        );
        if (!verifyResp.ok) {
          console.warn(
            "[Deploy] Push reported success but staging files not accessible (verification GET returned " +
              verifyResp.status +
              ")",
          );
        }
      } catch {
        console.warn("[Deploy] Could not verify staging files after push");
      }

      // Step 4: Compute diff against empty (first push) or deployed state
      const deployedState =
        deployment.history.length > 0
          ? Object.fromEntries(
              deployment.history[0].diff.manifests.map((m) => [
                m.filename,
                null,
              ]),
            )
          : {};
      const diffResult = diff(compiled, deployedState);

      // Step 5: Create deployment record
      const record: DeploymentRecord = {
        id: serverDeploymentId ?? `deploy-${Date.now()}`,
        target: "staging",
        deployedBy: state.project.currentTeamId ?? "local",
        deployedAt: new Date().toISOString(),
        worldVersion: `v${state.project.projectVersion}`,
        diff: diffResult,
        status: "success",
        manifestCount,
      };

      actions.deployStagingComplete(record);
      actions.deployDiffComplete(diffResult);
    } catch (err) {
      actions.deployStagingStatus(
        "error",
        err instanceof Error ? err.message : "Compilation failed",
      );
    }
  }, [world, actions, compile, diff, state, deployment.history]);

  const handleRequestPromotion = useCallback(async () => {
    if (!deployment.currentDiff) return;

    // Phase 5.3: Production requires approval — enter pending state first
    actions.deployPromotionRequest(
      `promo-${Date.now()}`,
      state.project.currentTeamId ?? "local",
      deployment.currentDiff,
    );
  }, [actions, deployment.currentDiff, state.project.currentTeamId]);

  // Phase 5.3: Handle approval — promotes staging to production on the game server
  const handleApprovePromotion = useCallback(
    async (approvedBy: string) => {
      if (!deployment.pendingPromotion) return;

      const requestedBy = deployment.pendingPromotion.requestedBy;
      if (approvedBy === requestedBy) {
        console.warn("[Deploy] Approver must be different from requester");
        return;
      }

      actions.deployPromotionApprove(approvedBy);

      const serverUrl =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_GAME_SERVER_URL ||
        "http://localhost:5555";
      const adminCode = import.meta.env.VITE_ADMIN_CODE ?? "hyperia-admin";

      try {
        const resp = await fetch(`${serverUrl}/api/deploy/production`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-code": adminCode,
          },
          body: JSON.stringify({ deployedBy: requestedBy }),
        });

        if (resp.ok) {
          console.log("[Deploy] Production promotion succeeded on server");

          // Persist to HyperForge DB (Phase 5.1)
          const projectId = state.project.currentProjectId;
          const gameId = state.project.currentGameId;
          if (projectId && gameId) {
            await fetch("/api/world/deployments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId,
                gameId,
                target: "production",
                version: state.project.projectVersion,
                deployedBy: requestedBy,
                approvedBy,
              }),
            }).catch(() => {
              console.warn(
                "[Deploy] Could not persist production deployment to DB",
              );
            });
          }

          const record: DeploymentRecord = {
            id: deployment.pendingPromotion.id,
            target: "production",
            deployedBy: requestedBy,
            approvedBy,
            deployedAt: new Date().toISOString(),
            worldVersion: `v${state.project.projectVersion}`,
            diff: deployment.pendingPromotion.diff,
            status: "success",
          };
          actions.deployStagingComplete(record);
        } else {
          console.warn("[Deploy] Server promotion failed");
        }
      } catch {
        console.warn("[Deploy] Server unreachable for promotion");
      }
    },
    [actions, deployment.pendingPromotion, state.project],
  );

  // Group diff entries by category
  const diffByCategory = deployment.currentDiff?.manifests.reduce(
    (acc, entry) => {
      if (!acc[entry.category]) acc[entry.category] = [];
      acc[entry.category].push(entry);
      return acc;
    },
    {} as Record<ManifestCategory, ManifestDiffEntry[]>,
  );

  const isStagingBusy =
    deployment.stagingStatus === "compiling" ||
    deployment.stagingStatus === "pushing" ||
    deployment.stagingStatus === "reloading";

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Deployment
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-primary">
        <button
          className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
            activeTab === "deploy"
              ? "text-primary border-b-2 border-primary"
              : "text-text-tertiary hover:text-text-primary"
          } ease-out`}
          onClick={() => setActiveTab("deploy")}
        >
          Deploy
        </button>
        <button
          className={`flex-1 px-3 py-1.5 text-xs transition-colors ${
            activeTab === "history"
              ? "text-primary border-b-2 border-primary"
              : "text-text-tertiary hover:text-text-primary"
          } ease-out`}
          onClick={() => setActiveTab("history")}
        >
          History ({deployment.history.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === "deploy" ? (
          <div className="p-3 space-y-3">
            {/* Push to Staging */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-text-secondary">
                Staging
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ease-out"
                disabled={!canPushStaging || isStagingBusy}
                onClick={handlePushStaging}
              >
                {isStagingBusy ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {deployment.stagingStatus === "compiling" && "Compiling..."}
                    {deployment.stagingStatus === "pushing" && "Pushing..."}
                    {deployment.stagingStatus === "reloading" && "Reloading..."}
                  </>
                ) : (
                  <>
                    <Upload size={12} />
                    Push to Staging
                  </>
                )}
              </button>
              {deployment.stagingStatus === "success" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-green-400">
                    <CheckCircle2 size={10} />
                    Pushed{" "}
                    {deployment.history[0]?.manifestCount ??
                      stagingStatus?.fileCount ??
                      ""}{" "}
                    manifest files to staging
                  </div>
                  <a
                    href="http://localhost:3333?staging=true"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded transition-colors ease-out"
                  >
                    <ExternalLink size={10} />
                    Preview in Game Client
                  </a>
                </div>
              )}
              {deployment.stagingStatus === "error" && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                  <XCircle size={10} />
                  {deployment.error ?? "Push failed"}
                </div>
              )}
              {/* Staging status indicator */}
              {stagingStatus && !isStagingBusy && (
                <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary mt-1">
                  <Circle
                    size={8}
                    className={
                      stagingStatus.hasFiles
                        ? "text-green-400 fill-green-400"
                        : "text-text-tertiary fill-text-tertiary"
                    }
                  />
                  {stagingStatus.hasFiles
                    ? `${stagingStatus.fileCount} files staged`
                    : "Empty"}
                  {stagingStatus.lastDeployedAt && (
                    <span className="ml-auto">
                      {new Date(
                        stagingStatus.lastDeployedAt,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}
              {stagingStatus?.hasFiles && !isStagingBusy && (
                <details className="text-[10px] text-text-tertiary">
                  <summary className="cursor-pointer hover:text-text-secondary">
                    Staged files
                  </summary>
                  <ul className="pl-3 mt-0.5 space-y-0.5">
                    {stagingStatus.files.map((f) => (
                      <li key={f} className="flex items-center gap-1">
                        <FileJson size={8} className="flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Diff View */}
            {deployment.currentDiff && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-text-secondary">
                    Changes
                  </span>
                  <span className="text-[10px] text-text-tertiary">
                    +{deployment.currentDiff.totalAdded} ~
                    {deployment.currentDiff.totalModified} -
                    {deployment.currentDiff.totalRemoved}
                  </span>
                </div>
                <div className="border border-border-primary rounded overflow-hidden">
                  {Object.entries(CATEGORY_LABELS).map(([cat]) => {
                    const entries =
                      diffByCategory?.[cat as ManifestCategory] ?? [];
                    if (entries.length === 0) return null;
                    return (
                      <DiffCategoryGroup
                        key={cat}
                        category={cat as ManifestCategory}
                        entries={entries}
                      />
                    );
                  })}
                </div>
                {deployment.currentDiff.manifests.length === 0 && (
                  <div className="text-[10px] text-text-tertiary italic text-center py-4">
                    No changes detected
                  </div>
                )}
              </div>
            )}

            {/* Promote to Production */}
            <div className="space-y-2 pt-2 border-t border-border-primary">
              <div className="text-xs font-medium text-text-secondary">
                Production
              </div>
              {deployment.pendingPromotion ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <Clock size={10} />
                    Pending approval
                  </div>
                  <div className="text-[10px] text-text-tertiary">
                    Requested by {deployment.pendingPromotion.requestedBy}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded transition-colors ease-out"
                      onClick={() =>
                        handleApprovePromotion(
                          state.project.currentTeamId ?? "local",
                        )
                      }
                    >
                      <CheckCircle2 size={10} />
                      Approve
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors ease-out"
                      onClick={() => actions.deployPromotionReject()}
                    >
                      <XCircle size={10} />
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ease-out"
                    disabled={
                      !deployment.currentDiff ||
                      deployment.productionStatus === "deploying"
                    }
                    onClick={handleRequestPromotion}
                  >
                    <ArrowRight size={12} />
                    Publish to Production
                  </button>
                  <div className="text-[10px] text-text-tertiary flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Requires approval from a second team member
                  </div>
                </>
              )}
              {deployment.productionStatus === "success" && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-400">
                  <CheckCircle2 size={10} />
                  Production deployment complete
                </div>
              )}
              {deployment.productionStatus === "error" && (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                  <XCircle size={10} />
                  {deployment.error ?? "Deployment failed"}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* History Tab */
          <div>
            {deployment.history.length > 0 ? (
              deployment.history.map((record) => (
                <DeploymentHistoryEntry key={record.id} record={record} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-text-tertiary text-xs">
                <Clock size={16} className="mb-2 opacity-40" />
                No deployments yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
