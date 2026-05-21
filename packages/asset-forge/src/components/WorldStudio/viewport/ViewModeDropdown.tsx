/**
 * ViewModeDropdown — Viewport overlay for switching rendering modes.
 *
 * Positioned in the top-right corner of the viewport.
 * Uses explicit white-opacity colors for guaranteed readability
 * against the 3D viewport background.
 */

import { Eye, Grid3x3, Palette, ChevronDown } from "lucide-react";
import React, { useState, useCallback, useRef, useEffect } from "react";

import type { ViewMode } from "../../WorldBuilder/TileBasedTerrain";

interface ViewModeOption {
  mode: ViewMode;
  label: string;
  icon: typeof Eye;
  description: string;
}

const VIEW_MODES: ViewModeOption[] = [
  {
    mode: "lit",
    label: "Lit",
    icon: Eye,
    description: "Default shaded rendering",
  },
  {
    mode: "wireframe",
    label: "Wireframe",
    icon: Grid3x3,
    description: "Wireframe overlay",
  },
  {
    mode: "biomeColors",
    label: "Biome Colors",
    icon: Palette,
    description: "Flat biome-colored terrain",
  },
];

interface ViewModeDropdownProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function ViewModeDropdown({
  currentMode,
  onModeChange,
}: ViewModeDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const current =
    VIEW_MODES.find((m) => m.mode === currentMode) ?? VIEW_MODES[0];

  const handleSelect = useCallback(
    (mode: ViewMode) => {
      onModeChange(mode);
      setOpen(false);
    },
    [onModeChange],
  );

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const CurrentIcon = current.icon;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs font-medium transition-all duration-120 border ${
          open
            ? "bg-[rgba(99,102,241,0.12)] text-primary border-primary/40 shadow-[0_0_8px_rgba(99,102,241,0.15)]"
            : "bg-[#141416] text-white/60 hover:text-white/80 border-[#1C1E22] hover:bg-[#1e1f28]"
        } ease-out`}
        onClick={() => setOpen((v) => !v)}
        title="View Mode"
      >
        <CurrentIcon size={12} />
        <span>{current.label}</span>
        <ChevronDown
          size={10}
          className={`transition-transform ${open ? "rotate-180" : ""} ease-out`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-50 bg-[rgba(10,11,16,0.95)] border border-[#1C1E22] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.6)] py-1 min-w-[180px] ws-dropdown"
          style={{ borderTop: "1px solid var(--surface-highlight-strong)" }}
        >
          {VIEW_MODES.map((option) => {
            const Icon = option.icon;
            const isActive = currentMode === option.mode;
            return (
              <button
                key={option.mode}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all duration-120 ${
                  isActive
                    ? "text-primary bg-primary/[0.12]"
                    : "text-white/60 hover:text-white/90 hover:bg-bg-tertiary/40"
                } ease-out`}
                onClick={() => handleSelect(option.mode)}
              >
                <Icon size={12} className="flex-shrink-0" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-[10px] text-white/40">
                    {option.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
