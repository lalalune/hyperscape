/**
 * GameSettingsDialog — GameMode picker for the current game.
 *
 * Phase 6.1 of the GameMode plan. Four dropdowns let a non-technical user
 * swap between click-to-walk + orbit (Hyperia default), WASD + first-
 * person (FPS), or click-to-move + fixed-angle (top-down) without touching
 * code. Save PUTs to `/api/teams/:teamId/games/:gameId` and dispatches
 * `setGameMode` so PIE's next Play tick picks up the new manifest.
 *
 * The option lists here mirror the server-side allowlist in
 * `asset-forge/server/utils/gameModeRegistry.ts` and the client-side
 * registry seeded by `registerHyperiaGameMode` +
 * `registerAlternateGameModes`. If those change, update this file too.
 */

import { X, Gamepad2, Save, Loader2, AlertTriangle } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

import type { GameModeManifest } from "@hyperforge/shared/runtime";

import { updateGame } from "../../../utils/worldProjectApi";
import { useWorldStudio } from "../WorldStudioContext";

interface GameSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

// --- Option lists (mirror server allowlist) --------------------------------

const PLAYER_CONTROLLER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "click-to-walk", label: "Click-to-walk (Hyperia)" },
  { value: "wasd", label: "WASD keyboard" },
  { value: "top-down", label: "Top-down click-to-move" },
];

const CAMERA_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "orbit", label: "Orbit (third-person)" },
  { value: "first-person", label: "First-person" },
  { value: "fixed-angle", label: "Fixed-angle (Diablo-style)" },
];

const INPUT_CONTEXT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "hyperia-default", label: "Hyperia default" },
  { value: "wasd-default", label: "WASD" },
  { value: "fps-default", label: "FPS (WASD + mouse-look)" },
  { value: "topdown-default", label: "Top-down" },
];

const PAWN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "humanoid-rpg", label: "Humanoid (RPG)" },
  { value: "humanoid-kinematic", label: "Humanoid (kinematic)" },
  { value: "cursor-avatar", label: "Cursor avatar" },
];

const DEFAULT_MANIFEST: GameModeManifest = {
  playerController: "click-to-walk",
  camera: "orbit",
  inputContext: "hyperia-default",
  pawn: "humanoid-rpg",
};

// --- Component -------------------------------------------------------------

export function GameSettingsDialog({ open, onClose }: GameSettingsDialogProps) {
  const { state, actions } = useWorldStudio();
  const teamId = state.project.currentTeamId;
  const gameId = state.project.currentGameId;
  const current = state.project.gameMode ?? DEFAULT_MANIFEST;

  const [manifest, setManifest] = useState<GameModeManifest>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form when the dialog re-opens or the source manifest changes.
  useEffect(() => {
    if (open) {
      setManifest(state.project.gameMode ?? DEFAULT_MANIFEST);
      setError(null);
    }
  }, [open, state.project.gameMode]);

  const handleSave = useCallback(async () => {
    if (!teamId || !gameId) {
      setError("No game loaded.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateGame(teamId, gameId, { gameMode: manifest });
      actions.setGameMode(manifest);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [teamId, gameId, manifest, actions, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-primary border border-border-primary rounded-lg shadow-2xl w-[520px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-primary">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-bg-tertiary border border-border-primary flex items-center justify-center">
              <Gamepad2 size={14} className="text-sky-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-text-primary">
                GameMode Settings
              </span>
              <p className="text-[10px] text-text-tertiary">
                Choose the controller, camera, and input for this game
              </p>
            </div>
          </div>
          <button
            className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
            onClick={onClose}
            disabled={saving}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <Dropdown
            label="Player Controller"
            value={manifest.playerController}
            options={PLAYER_CONTROLLER_OPTIONS}
            onChange={(v) =>
              setManifest((m) => ({ ...m, playerController: v }))
            }
          />
          <Dropdown
            label="Camera"
            value={manifest.camera}
            options={CAMERA_OPTIONS}
            onChange={(v) => setManifest((m) => ({ ...m, camera: v }))}
          />
          <Dropdown
            label="Input Context"
            value={manifest.inputContext}
            options={INPUT_CONTEXT_OPTIONS}
            onChange={(v) => setManifest((m) => ({ ...m, inputContext: v }))}
          />
          <Dropdown
            label="Pawn"
            value={manifest.pawn}
            options={PAWN_OPTIONS}
            onChange={(v) => setManifest((m) => ({ ...m, pawn: v }))}
          />

          {error && (
            <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/30">
              <AlertTriangle
                size={14}
                className="text-red-400 flex-shrink-0 mt-0.5"
              />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border-primary">
          <button
            className="px-3 py-1.5 text-xs rounded-md text-text-secondary hover:bg-bg-tertiary disabled:opacity-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Dropdown helper -------------------------------------------------------

interface DropdownProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function Dropdown({ label, value, options, onChange }: DropdownProps) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <select
        className="w-full px-3 py-2 text-sm rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--input-border)",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
