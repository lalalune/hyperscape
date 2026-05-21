/**
 * TooltipOverlay
 *
 * HTML overlay for showing tooltips when hovering over world elements.
 */

import {
  Mountain,
  Building2,
  MapPin,
  User,
  Skull,
  Zap,
  Globe,
} from "lucide-react";
import React from "react";

import type { HoverInfo } from "../types";

// ============== ICON MAPPING ==============

const TYPE_ICONS: Record<string, React.ReactNode> = {
  biome: <Mountain className="w-4 h-4 text-emerald-400" />,
  tile: <Globe className="w-4 h-4 text-gray-400" />,
  town: <MapPin className="w-4 h-4 text-orange-400" />,
  building: <Building2 className="w-4 h-4 text-yellow-400" />,
  npc: <User className="w-4 h-4 text-cyan-400" />,
  boss: <Skull className="w-4 h-4 text-red-400" />,
  event: <Zap className="w-4 h-4 text-yellow-400" />,
};

const TYPE_LABELS: Record<string, string> = {
  biome: "Biome",
  tile: "Tile",
  town: "Town",
  building: "Building",
  npc: "NPC",
  boss: "Boss",
  event: "Event",
};

// ============== MAIN COMPONENT ==============

interface TooltipOverlayProps {
  /** Hover information to display */
  hoverInfo: HoverInfo | null;
  /** Screen position (from mouse coordinates) */
  screenPosition: { x: number; y: number } | null;
}

export const TooltipOverlay: React.FC<TooltipOverlayProps> = ({
  hoverInfo,
  screenPosition,
}) => {
  if (!hoverInfo || !screenPosition) return null;

  const icon = TYPE_ICONS[hoverInfo.type] || <Globe className="w-4 h-4" />;
  const typeLabel = TYPE_LABELS[hoverInfo.type] || hoverInfo.type;

  // Position tooltip to avoid going off screen
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    left: screenPosition.x + 15,
    top: screenPosition.y + 15,
    zIndex: 1000,
    pointerEvents: "none",
  };

  // Adjust if would go off right edge
  if (screenPosition.x > window.innerWidth - 200) {
    tooltipStyle.left = screenPosition.x - 185;
  }

  // Adjust if would go off bottom edge
  if (screenPosition.y > window.innerHeight - 150) {
    tooltipStyle.top = screenPosition.y - 100;
  }

  return (
    <div
      style={tooltipStyle}
      className="bg-bg-secondary/95 border border-border-primary rounded-lg shadow-lg px-5 py-4 min-w-[160px] max-w-[240px] "
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-text-muted uppercase tracking-[0.12em]">
          {typeLabel}
        </span>
      </div>

      {/* Name */}
      <div className="text-sm font-medium text-text-primary truncate">
        {hoverInfo.name}
      </div>

      {/* ID */}
      <div className="text-xs text-text-muted font-mono truncate">
        {hoverInfo.id}
      </div>

      {/* Position */}
      <div className="text-xs text-text-muted mt-1">
        Position: {hoverInfo.position.x.toFixed(0)},{" "}
        {hoverInfo.position.z.toFixed(0)}
      </div>

      {/* Additional info */}
      {hoverInfo.additionalInfo &&
        Object.keys(hoverInfo.additionalInfo).length > 0 && (
          <div className="mt-2 pt-2 border-t border-border-primary space-y-0.5">
            {Object.entries(hoverInfo.additionalInfo).map(([key, value]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="text-text-muted capitalize">
                  {key.replace(/_/g, " ")}:
                </span>
                <span className="text-text-secondary">{value}</span>
              </div>
            ))}
          </div>
        )}

      {/* Click hint */}
      <div className="text-xs text-text-muted mt-2 pt-1 border-t border-border-primary">
        Click to select
      </div>
    </div>
  );
};

// ============== SELECTION INFO PANEL ==============

interface SelectionInfoPanelProps {
  /** Type of selected element */
  type: string;
  /** Name of selected element */
  name: string;
  /** ID of selected element */
  id: string;
  /** Position callback */
  onFocusPosition?: () => void;
  /** Deselect callback */
  onDeselect?: () => void;
}

export const SelectionInfoPanel: React.FC<SelectionInfoPanelProps> = ({
  type,
  name,
  id,
  onFocusPosition,
  onDeselect,
}) => {
  const icon = TYPE_ICONS[type] || <Globe className="w-4 h-4" />;
  const typeLabel = TYPE_LABELS[type] || type;

  return (
    <div className="absolute bottom-4 left-4 bg-bg-secondary/95 border border-border-primary rounded-lg shadow-lg px-5 py-4 min-w-[200px] z-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-text-muted uppercase tracking-[0.12em]">
            Selected {typeLabel}
          </span>
        </div>
        {onDeselect && (
          <button
            onClick={onDeselect}
            className="text-text-muted hover:text-text-primary text-xs"
          >
            ×
          </button>
        )}
      </div>

      {/* Name */}
      <div className="text-sm font-medium text-text-primary truncate">
        {name}
      </div>

      {/* ID */}
      <div className="text-xs text-text-muted font-mono truncate mb-2">
        {id}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onFocusPosition && (
          <button
            onClick={onFocusPosition}
            className="text-xs text-primary hover:text-primary-light"
          >
            Focus Camera
          </button>
        )}
      </div>
    </div>
  );
};

export default TooltipOverlay;
