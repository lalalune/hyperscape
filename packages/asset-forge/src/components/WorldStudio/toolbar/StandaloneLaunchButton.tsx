/**
 * StandaloneLaunchButton — UE5-parity "Launch in Standalone" button for
 * the WorldStudio top toolbar.
 *
 * Three visual states map to the launcher's state machine:
 *   - idle       → "Launch" (Forge Gold accent), opens a Standalone
 *                  session on click
 *   - starting   → "Booting…" with spinner, disabled
 *   - ready      → "Standalone" green pill + Stop button, click Stop
 *                  to tear down
 *   - error      → red pill with inline message, click to dismiss /
 *                  retry
 *
 * Save-before-Launch gate: if the project has unsaved changes
 * (`state.persistence.isDirty`), the click warns instead of launching.
 *
 * Phase 2.3 of PLAN_AAA_UE5_PARITY.
 */

import { Loader2, Rocket, Square } from "lucide-react";
import React, { useEffect, useRef } from "react";

import { useWorldStudio } from "../WorldStudioContext";
import { useStandaloneLauncher } from "../hooks/useStandaloneLauncher";

export function StandaloneLaunchButton() {
  const { state: studio } = useWorldStudio();
  const { state, lastError, launch, stop } = useStandaloneLauncher();
  const projectId = studio.project.currentProjectId;
  const projectDirty = studio.builder.editing.hasUnsavedChanges;

  // When the launcher transitions to `ready`, pop the game window open
  // exactly once. Re-running this effect on every poll would spawn
  // duplicate tabs; pin the open to a single "ready" id boundary.
  const openedForReadyKey = useRef<string | null>(null);
  useEffect(() => {
    if (state.kind === "ready") {
      const key = `${state.projectId}:${state.readyAt}`;
      if (openedForReadyKey.current !== key) {
        openedForReadyKey.current = key;
        // Match the backend's clientUrl default (localhost:3333). Future:
        // include a session token in the URL so the client knows which
        // server to connect to in multi-session mode (Phase 4).
        window.open(state.url, "_blank", "noopener,noreferrer");
      }
    } else if (state.kind === "idle") {
      openedForReadyKey.current = null;
    }
  }, [state]);

  const launchDisabled = !projectId;

  if (state.kind === "ready") {
    return (
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/30 hover:bg-accent-green/25 transition-all ease-out"
        onClick={() => void stop()}
        title={`Stop Standalone (PID ${state.pid}, port ${state.port})`}
      >
        <Square size={12} />
        <span className="hidden sm:inline">Standalone</span>
      </button>
    );
  }

  if (state.kind === "starting") {
    return (
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-text-tertiary cursor-wait border border-border-primary"
        disabled
        title={`Booting Standalone for ${state.projectId}…`}
      >
        <Loader2 size={12} className="animate-spin" />
        <span className="hidden sm:inline">Booting…</span>
      </button>
    );
  }

  if (state.kind === "stopping") {
    return (
      <button
        type="button"
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-text-tertiary cursor-wait border border-border-primary"
        disabled
        title="Stopping Standalone…"
      >
        <Loader2 size={12} className="animate-spin" />
        <span className="hidden sm:inline">Stopping…</span>
      </button>
    );
  }

  // error or idle — both render the Launch button. Error message shows
  // inline as a tooltip; clicking retries.
  const errorMessage =
    state.kind === "error" ? state.message : (lastError ?? null);

  return (
    <button
      type="button"
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
        launchDisabled
          ? "text-text-tertiary/30 cursor-not-allowed border border-border-primary"
          : errorMessage
            ? "bg-accent-red/15 text-accent-red border border-accent-red/30 hover:bg-accent-red/25"
            : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
      } ease-out`}
      onClick={() => {
        if (!projectId) return;
        if (projectDirty) {
          // Save-before-Launch gate. Phase 2 MVP just refuses; a later
          // commit can offer a quick-save action via the toast / a
          // confirmation modal.
          const proceed = window.confirm(
            "Project has unsaved changes. Save first to ensure Standalone plays the latest data.\n\nLaunch anyway?",
          );
          if (!proceed) return;
        }
        void launch(projectId);
      }}
      disabled={launchDisabled}
      title={
        launchDisabled
          ? "Open a project first"
          : errorMessage
            ? `Launch failed: ${errorMessage}. Click to retry.`
            : "Launch in Standalone — boots a real game server in a separate process"
      }
    >
      <Rocket size={12} />
      <span className="hidden sm:inline">
        {errorMessage ? "Retry Launch" : "Launch"}
      </span>
    </button>
  );
}
