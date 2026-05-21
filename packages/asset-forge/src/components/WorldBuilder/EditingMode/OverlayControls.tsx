/**
 * OverlayControls
 *
 * Toolbar controls for toggling viewport overlays.
 */

import {
  Eye,
  EyeOff,
  Mountain,
  MapPin,
  Route,
  User,
  Skull,
  Shield,
  ChevronDown,
} from "lucide-react";
import React, { useCallback } from "react";

import { useWorldBuilder } from "../WorldBuilderContext";
import type { ViewportOverlays } from "../types";

// ============== OVERLAY TOGGLE BUTTON ==============

interface OverlayToggleProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onToggle: () => void;
}

const OverlayToggle: React.FC<OverlayToggleProps> = ({
  label,
  icon,
  active,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
      active
        ? "bg-primary/20 text-primary"
        : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
    } ease-out`}
    title={`${active ? "Hide" : "Show"} ${label}`}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

// ============== MAIN COMPONENT ==============

interface OverlayControlsProps {
  /** Compact mode - show only icons */
  compact?: boolean;
}

export const OverlayControls: React.FC<OverlayControlsProps> = ({
  compact = false,
}) => {
  const { state, actions } = useWorldBuilder();
  const { overlays } = state.viewport;

  const handleToggle = useCallback(
    (overlay: keyof ViewportOverlays) => {
      actions.toggleOverlay(overlay);
    },
    [actions],
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleToggle("biomes")}
          className={`p-1.5 rounded ${
            overlays.biomes ? "text-emerald-400" : "text-text-muted"
          } hover:bg-bg-tertiary`}
          title="Toggle biome boundaries"
        >
          <Mountain className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleToggle("towns")}
          className={`p-1.5 rounded ${
            overlays.towns ? "text-orange-400" : "text-text-muted"
          } hover:bg-bg-tertiary`}
          title="Toggle town markers"
        >
          <MapPin className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleToggle("roads")}
          className={`p-1.5 rounded ${
            overlays.roads ? "text-yellow-400" : "text-text-muted"
          } hover:bg-bg-tertiary`}
          title="Toggle road paths"
        >
          <Route className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleToggle("npcs")}
          className={`p-1.5 rounded ${
            overlays.npcs ? "text-cyan-400" : "text-text-muted"
          } hover:bg-bg-tertiary`}
          title="Toggle NPC markers"
        >
          <User className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleToggle("bosses")}
          className={`p-1.5 rounded ${
            overlays.bosses ? "text-red-400" : "text-text-muted"
          } hover:bg-bg-tertiary`}
          title="Toggle boss markers"
        >
          <Skull className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-xs text-text-muted mr-1">Show:</span>
      <OverlayToggle
        label="Biomes"
        icon={<Mountain className="w-3 h-3" />}
        active={overlays.biomes}
        onToggle={() => handleToggle("biomes")}
      />
      <OverlayToggle
        label="Towns"
        icon={<MapPin className="w-3 h-3" />}
        active={overlays.towns}
        onToggle={() => handleToggle("towns")}
      />
      <OverlayToggle
        label="Roads"
        icon={<Route className="w-3 h-3" />}
        active={overlays.roads}
        onToggle={() => handleToggle("roads")}
      />
      <OverlayToggle
        label="NPCs"
        icon={<User className="w-3 h-3" />}
        active={overlays.npcs}
        onToggle={() => handleToggle("npcs")}
      />
      <OverlayToggle
        label="Bosses"
        icon={<Skull className="w-3 h-3" />}
        active={overlays.bosses}
        onToggle={() => handleToggle("bosses")}
      />
      <OverlayToggle
        label="Difficulty"
        icon={<Shield className="w-3 h-3" />}
        active={overlays.difficultyZones}
        onToggle={() => handleToggle("difficultyZones")}
      />
    </div>
  );
};

// ============== DROPDOWN VERSION ==============

interface OverlayDropdownProps {
  className?: string;
}

export const OverlayDropdown: React.FC<OverlayDropdownProps> = ({
  className = "",
}) => {
  const { state, actions } = useWorldBuilder();
  const { overlays } = state.viewport;
  const [isOpen, setIsOpen] = React.useState(false);

  const activeCount = Object.values(overlays).filter(Boolean).length;

  const handleToggle = useCallback(
    (overlay: keyof ViewportOverlays) => {
      actions.toggleOverlay(overlay);
    },
    [actions],
  );

  const toggleAll = useCallback(
    (show: boolean) => {
      actions.setOverlays({
        biomes: show,
        towns: show,
        roads: show,
        npcs: show,
        bosses: show,
        difficultyZones: show,
      });
    },
    [actions],
  );

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary rounded text-sm text-text-secondary hover:text-text-primary transition-colors ease-out"
      >
        <Eye className="w-4 h-4" />
        <span>Overlays</span>
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""} ease-out`}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-1 w-48 bg-bg-secondary border border-border-primary rounded-lg shadow-lg z-50 py-1">
            {/* Quick actions */}
            <div className="px-2 py-1 flex gap-1 border-b border-border-primary">
              <button
                onClick={() => toggleAll(true)}
                className="flex-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded"
              >
                Show All
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="flex-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded"
              >
                Hide All
              </button>
            </div>

            {/* Individual toggles */}
            <div className="py-1">
              <DropdownItem
                label="Biome Boundaries"
                icon={<Mountain className="w-4 h-4 text-emerald-400" />}
                active={overlays.biomes}
                onToggle={() => handleToggle("biomes")}
              />
              <DropdownItem
                label="Town Markers"
                icon={<MapPin className="w-4 h-4 text-orange-400" />}
                active={overlays.towns}
                onToggle={() => handleToggle("towns")}
              />
              <DropdownItem
                label="Road Paths"
                icon={<Route className="w-4 h-4 text-yellow-400" />}
                active={overlays.roads}
                onToggle={() => handleToggle("roads")}
              />
              <DropdownItem
                label="NPC Markers"
                icon={<User className="w-4 h-4 text-cyan-400" />}
                active={overlays.npcs}
                onToggle={() => handleToggle("npcs")}
              />
              <DropdownItem
                label="Boss Arenas"
                icon={<Skull className="w-4 h-4 text-red-400" />}
                active={overlays.bosses}
                onToggle={() => handleToggle("bosses")}
              />
              <DropdownItem
                label="Difficulty Zones"
                icon={<Shield className="w-4 h-4 text-purple-400" />}
                active={overlays.difficultyZones}
                onToggle={() => handleToggle("difficultyZones")}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============== DROPDOWN ITEM ==============

interface DropdownItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onToggle: () => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({
  label,
  icon,
  active,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-bg-tertiary transition-colors ease-out"
  >
    {icon}
    <span className="flex-1 text-left text-text-secondary">{label}</span>
    {active ? (
      <Eye className="w-4 h-4 text-primary" />
    ) : (
      <EyeOff className="w-4 h-4 text-text-muted" />
    )}
  </button>
);

export default OverlayControls;
