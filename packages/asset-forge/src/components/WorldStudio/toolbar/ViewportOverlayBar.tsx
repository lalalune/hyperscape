/**
 * ViewportOverlayBar — Floating toolbar for viewport overlay toggles.
 *
 * Positioned top-right below the Player Preview / ViewMode bar.
 * Uses frosted-glass styling consistent with other viewport overlays.
 *
 * Only shows overlays that are actually wired to rendering:
 * - Biome color overlay (useAreaBoundaryOverlay)
 * - Difficulty zone boundaries (useAreaBoundaryOverlay)
 * - Zone color overlay (useZonePainting)
 * - Day/Night time slider (TileBasedTerrain lighting)
 */

import {
  TreePine,
  Shield,
  Map,
  Sun,
  Moon,
  Lightbulb,
  Sparkles,
  CloudFog,
  CloudSun,
  Sprout,
} from "lucide-react";
import React, { useCallback } from "react";

import type { StudioViewportOverlays } from "../WorldStudioContext";
import { useWorldStudio } from "../WorldStudioContext";

interface OverlayToggle {
  key: keyof StudioViewportOverlays;
  icon: typeof TreePine;
  label: string;
  color: string;
}

const OVERLAY_TOGGLES: OverlayToggle[] = [
  {
    key: "biomeOverlay",
    icon: TreePine,
    label: "Biome Colors",
    color: "text-green-400",
  },
  {
    key: "difficultyOverlay",
    icon: Shield,
    label: "Difficulty Zones",
    color: "text-rose-400",
  },
  {
    key: "zoneOverlay",
    icon: Map,
    label: "Zone Colors",
    color: "text-cyan-400",
  },
];

/** Phase 6: Visual parity toggles */
const VISUAL_TOGGLES: OverlayToggle[] = [
  {
    key: "sky",
    icon: CloudSun,
    label: "Sky & Clouds",
    color: "text-blue-400",
  },
  {
    key: "grass",
    icon: Sprout,
    label: "Grass",
    color: "text-lime-400",
  },
  {
    key: "shadows",
    icon: Lightbulb,
    label: "Shadows",
    color: "text-amber-400",
  },
  {
    key: "bloom",
    icon: Sparkles,
    label: "Bloom",
    color: "text-purple-400",
  },
  {
    key: "gameFog",
    icon: CloudFog,
    label: "Game Fog",
    color: "text-sky-400",
  },
];

export function ViewportOverlayBar() {
  const { state, actions } = useWorldStudio();
  const overlays = state.overlays;

  const toggleOverlay = useCallback(
    (key: keyof StudioViewportOverlays) => {
      const current = overlays[key];
      if (typeof current === "boolean") {
        actions.setOverlay({ [key]: !current });
      }
    },
    [overlays, actions],
  );

  const setTimeOfDay = useCallback(
    (hours: number | null) => {
      actions.setOverlay({ timeOfDay: hours });
    },
    [actions],
  );

  return (
    <div className="absolute top-[44px] right-2 z-10 flex flex-col gap-1.5">
      {/* Overlay toggles */}
      <div className="bg-[rgba(8,9,14,0.78)] border border-border-primary rounded-[5px] p-1 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
        {OVERLAY_TOGGLES.map(({ key, icon: Icon, label, color }) => {
          const active = overlays[key] === true;
          return (
            <button
              key={key}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[10px] transition-all duration-120 ${
                active
                  ? `${color} bg-bg-tertiary/60`
                  : "text-white/40 hover:text-white/70 hover:bg-bg-tertiary/40"
              }`}
              onClick={() => toggleOverlay(key)}
              title={label}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Visual parity toggles (Phase 6) */}
      <div className="bg-[rgba(8,9,14,0.78)] border border-border-primary rounded-[5px] p-1 flex flex-col gap-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
        {VISUAL_TOGGLES.map(({ key, icon: Icon, label, color }) => {
          const active = overlays[key] === true;
          return (
            <button
              key={key}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-[3px] text-[10px] transition-all duration-120 ${
                active
                  ? `${color} bg-bg-tertiary/60`
                  : "text-white/40 hover:text-white/70 hover:bg-bg-tertiary/40"
              }`}
              onClick={() => toggleOverlay(key)}
              title={label}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Day/Night slider */}
      <div className="bg-[rgba(8,9,14,0.78)] border border-border-primary rounded-[5px] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/40 flex items-center gap-1">
            {overlays.timeOfDay != null ? (
              overlays.timeOfDay < 6 || overlays.timeOfDay > 18 ? (
                <Moon size={10} />
              ) : (
                <Sun size={10} />
              )
            ) : (
              <Sun size={10} />
            )}
            <span className="text-white/70">
              {overlays.timeOfDay != null
                ? `${Math.floor(overlays.timeOfDay)}:${String(Math.round((overlays.timeOfDay % 1) * 60)).padStart(2, "0")}`
                : "Default"}
            </span>
          </span>
          {overlays.timeOfDay != null && (
            <button
              className="text-[9px] text-white/40 hover:text-white/80 transition-colors"
              onClick={() => setTimeOfDay(null)}
            >
              Reset
            </button>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={24}
          step={0.5}
          value={overlays.timeOfDay ?? 12}
          onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
          className="w-full h-1 accent-primary"
          title="Time of Day"
        />
        <div className="flex justify-between text-[8px] text-white/30 mt-0.5">
          <span>0:00</span>
          <span>6:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>
    </div>
  );
}
