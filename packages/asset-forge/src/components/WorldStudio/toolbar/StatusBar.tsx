/**
 * StatusBar — Bottom bar with project info, selection state, entity counts,
 * validation summary, save status with auto-save countdown, and undo depth.
 */

import {
  Clock,
  Lock,
  AlertTriangle,
  Rocket,
  Save,
  MousePointer,
  Layers,
  Circle,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";

import { commandHistory } from "../../../editor/commands";
import { useWorldStudio } from "../WorldStudioContext";
import { useManifestValidation } from "../hooks/useManifestValidation";
import { formatShortRelative } from "../../../utils/formatters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusBar() {
  const { state, computed } = useWorldStudio();
  const { project, persistence, tools } = state;
  const builder = state.builder;
  const extendedLayers = state.extendedLayers;
  const validationIssues = useManifestValidation();
  const errorCount = validationIssues.filter(
    (i) => i.severity === "error",
  ).length;
  const warnCount = validationIssues.filter(
    (i) => i.severity === "warning",
  ).length;

  // Auto-update "saved X ago" text every 10s
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  // Track undo count
  const [undoCount, setUndoCount] = useState(0);
  useEffect(() => {
    return commandHistory.subscribe(() => {
      setUndoCount(commandHistory.undoCount);
    });
  }, []);

  // Entity count
  const worldLayers = builder.editing.world?.layers;
  const entityCount =
    (extendedLayers.spawnPoints?.length ?? 0) +
    (extendedLayers.teleports?.length ?? 0) +
    (extendedLayers.mobSpawns?.length ?? 0) +
    (extendedLayers.resources?.length ?? 0) +
    (extendedLayers.stations?.length ?? 0) +
    (extendedLayers.pois?.length ?? 0) +
    (extendedLayers.waterBodies?.length ?? 0) +
    (worldLayers?.npcs.length ?? 0) +
    (worldLayers?.quests.length ?? 0) +
    (worldLayers?.bosses.length ?? 0);

  const selection = builder.editing.selection;

  return (
    <div className="h-6 flex items-center justify-between px-3 bg-bg-secondary border-t border-border-primary text-[11px] text-text-tertiary flex-shrink-0 select-none tracking-tight">
      {/* ====== LEFT: Project info ====== */}
      <div className="flex items-center gap-2.5 min-w-0">
        {project.projectName ? (
          <>
            <span className="font-medium text-text-secondary truncate max-w-[120px]">
              {project.projectName}
            </span>
            <span className="tabular-nums">v{project.projectVersion}</span>
            {project.lockedBy && (
              <span className="flex items-center gap-0.5 text-amber-400">
                <Lock size={9} />
                Locked
              </span>
            )}
          </>
        ) : (
          <span>No project</span>
        )}
      </div>

      {/* ====== CENTER: Tool + Selection + Entity count ====== */}
      <div className="flex items-center gap-3">
        {/* Active tool */}
        <span className="flex items-center gap-1">
          <MousePointer size={9} />
          {tools.activeTool}
          {tools.activeTool === "brush" && (
            <span className="text-text-tertiary">
              ({tools.brushSettings.brushType})
            </span>
          )}
        </span>

        {/* Selection info */}
        {selection && (
          <span className="flex items-center gap-1 text-primary">
            <StatusDot color="var(--color-primary)" />
            {selection.type}
          </span>
        )}

        {/* Entity count */}
        <span className="flex items-center gap-1">
          <Layers size={9} />
          {entityCount} entities
        </span>

        {/* Undo depth */}
        {undoCount > 0 && (
          <span className="tabular-nums">
            {undoCount} undo{undoCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ====== RIGHT: Validation + Save status ====== */}
      <div className="flex items-center gap-2.5">
        {/* Deploy status */}
        {state.deployment.stagingStatus !== "idle" &&
          state.deployment.stagingStatus !== "success" && (
            <span className="flex items-center gap-1 text-blue-400">
              <Rocket size={9} />
              {state.deployment.stagingStatus === "compiling" && "Compiling..."}
              {state.deployment.stagingStatus === "pushing" && "Pushing..."}
              {state.deployment.stagingStatus === "reloading" && "Reloading..."}
              {state.deployment.stagingStatus === "error" && "Deploy failed"}
            </span>
          )}

        {/* Validation summary */}
        {(errorCount > 0 || warnCount > 0) && (
          <span
            className={`flex items-center gap-1 cursor-pointer ${
              errorCount > 0 ? "text-red-400" : "text-amber-400"
            }`}
            title={`${errorCount} errors, ${warnCount} warnings — click bottom panel to view`}
          >
            <AlertTriangle size={9} />
            {errorCount > 0 && <span>{errorCount}E</span>}
            {warnCount > 0 && <span>{warnCount}W</span>}
          </span>
        )}

        {/* Auto-save indicator */}
        {persistence.autoSaveEnabled && computed.hasProject && (
          <span className="flex items-center gap-1" title="Auto-save enabled">
            <Save size={9} />
            Auto
          </span>
        )}

        {/* Save status */}
        {persistence.lastSavedAt ? (
          <span className="flex items-center gap-1 tabular-nums">
            <Clock size={9} />
            {formatShortRelative(persistence.lastSavedAt)}
          </span>
        ) : null}

        {persistence.saveError && (
          <span className="text-red-400">Save failed</span>
        )}

        {/* Unsaved indicator */}
        {computed.hasUnsavedChanges && (
          <span className="flex items-center gap-1 text-amber-400">
            <StatusDot color="#FF9933" />
            Unsaved
          </span>
        )}
      </div>
    </div>
  );
}
