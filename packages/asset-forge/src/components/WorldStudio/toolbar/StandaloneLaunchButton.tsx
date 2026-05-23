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

import { ExternalLink, Loader2, Rocket, Square } from "lucide-react";
import React from "react";

import { useWorldStudio } from "../WorldStudioContext";
import { useStandaloneLauncher } from "../hooks/useStandaloneLauncher";

export function StandaloneLaunchButton() {
  const { state: studio } = useWorldStudio();
  const { state, lastError, launch, stop } = useStandaloneLauncher();
  const projectId = studio.project.currentProjectId;
  const projectDirty = studio.builder.editing.hasUnsavedChanges;

  const launchDisabled = !projectId;

  if (state.kind === "ready") {
    // Two buttons in this state: an "Open" link that the user can
    // click to (re-)launch the game tab (a real user-gesture click,
    // not blocked by popup blockers like a setInterval window.open
    // would be), and a Stop button to tear down the session.
    return (
      <>
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-500/25 transition-all ease-out"
          onClick={() => {
            window.open(state.url, "_blank", "noopener,noreferrer");
          }}
          title={`Open game tab (${state.url})`}
        >
          <ExternalLink size={12} />
          <span className="hidden sm:inline">Open</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-400/30 hover:bg-red-500/25 transition-all ease-out"
          onClick={() => void stop()}
          title={`Stop Standalone (PID ${state.pid}, port ${state.port})`}
        >
          <Square size={12} />
          <span className="hidden sm:inline">Stop</span>
        </button>
      </>
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
