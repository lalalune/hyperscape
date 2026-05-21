/**
 * ModeToggle
 *
 * Toggle component for switching between Creation and Editing modes.
 * Shows visual indication of current mode and handles mode transitions.
 */

import { Wand2, Edit3, AlertTriangle } from "lucide-react";
import React from "react";

import { useWorldBuilder } from "../WorldBuilderContext";
import type { WorldBuilderMode } from "../types";

interface ModeToggleProps {
  /** Optional callback when mode changes */
  onModeChange?: (mode: WorldBuilderMode) => void;
  /** Whether to show a warning when switching from editing with unsaved changes */
  warnOnUnsavedChanges?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
  onModeChange,
  warnOnUnsavedChanges = true,
}) => {
  const { state, actions } = useWorldBuilder();
  const { mode } = state;
  const { hasUnsavedChanges, world } = state.editing;

  const handleModeChange = (newMode: WorldBuilderMode) => {
    if (newMode === mode) return;

    // Warn if switching from editing with unsaved changes
    if (
      warnOnUnsavedChanges &&
      mode === "editing" &&
      hasUnsavedChanges &&
      newMode === "creation"
    ) {
      const confirmed = window.confirm(
        "You have unsaved changes. Switching to Creation mode will discard them. Continue?",
      );
      if (!confirmed) return;
    }

    // Warn if switching to creation when a world is loaded
    if (newMode === "creation" && world !== null) {
      const confirmed = window.confirm(
        "Switching to Creation mode will allow you to generate a new world. " +
          "Your current world will remain saved, but creating a new world will replace it. Continue?",
      );
      if (!confirmed) return;
    }

    actions.setMode(newMode);
    onModeChange?.(newMode);
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-bg-tertiary rounded-lg">
      {/* Creation Mode Button */}
      <button
        onClick={() => handleModeChange("creation")}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === "creation"
            ? "bg-primary text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
        } ease-out`}
      >
        <Wand2 className="w-4 h-4" />
        <span>Create</span>
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-border-primary" />

      {/* Editing Mode Button */}
      <button
        onClick={() => handleModeChange("editing")}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
          mode === "editing"
            ? "bg-primary text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
        } ease-out`}
      >
        <Edit3 className="w-4 h-4" />
        <span>Edit</span>
        {hasUnsavedChanges && mode === "editing" && (
          <span
            className="w-2 h-2 bg-yellow-400 rounded-full"
            title="Unsaved changes"
          />
        )}
      </button>
    </div>
  );
};

/**
 * Compact mode indicator for tight spaces
 */
export const ModeIndicator: React.FC = () => {
  const { state } = useWorldBuilder();
  const { mode } = state;
  const { hasUnsavedChanges, world } = state.editing;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
          mode === "creation"
            ? "bg-purple-500/20 text-purple-400"
            : "bg-blue-500/20 text-blue-400"
        }`}
      >
        {mode === "creation" ? (
          <>
            <Wand2 className="w-3 h-3" />
            <span>Creating</span>
          </>
        ) : (
          <>
            <Edit3 className="w-3 h-3" />
            <span>Editing</span>
          </>
        )}
      </div>

      {mode === "editing" && world && (
        <span className="text-xs text-text-muted truncate max-w-32">
          {world.name}
        </span>
      )}

      {hasUnsavedChanges && (
        <span
          className="flex items-center gap-1 text-xs text-yellow-400"
          title="Unsaved changes"
        >
          <AlertTriangle className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};

/**
 * Full mode banner with description
 */
export const ModeBanner: React.FC = () => {
  const { state, actions } = useWorldBuilder();
  const { mode } = state;
  const { hasPreview, isGenerating } = state.creation;
  const { world, hasUnsavedChanges } = state.editing;

  if (mode === "creation") {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-purple-500/10 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-400">
            Creation Mode
          </span>
          <span className="text-xs text-text-muted">
            {isGenerating
              ? "Generating world preview..."
              : hasPreview
                ? "Preview ready - Click 'Apply & Lock' to finalize"
                : "Configure terrain, towns, and roads below"}
          </span>
        </div>
        {hasPreview && !isGenerating && (
          <span className="text-xs text-purple-400/60 italic">
            Use the panel on the left to apply changes
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
      <div className="flex items-center gap-2">
        <Edit3 className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-blue-400">Editing Mode</span>
        {world ? (
          <span className="text-xs text-text-muted">
            Editing &quot;{world.name}&quot;
            {hasUnsavedChanges && (
              <span className="text-yellow-400 ml-1">(unsaved changes)</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-text-muted">
            No world loaded - create or import a world first
          </span>
        )}
      </div>
      <button
        onClick={actions.switchToCreation}
        className="text-xs text-blue-400 hover:text-blue-300 underline"
      >
        ← Create new world
      </button>
    </div>
  );
};

export default ModeToggle;
