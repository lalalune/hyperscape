/**
 * StatusBars - HP and Prayer Display
 *
 * Displays player health and prayer points with dual display modes:
 * - "bars" - Horizontal bars with orb icons
 * - "orbs" - Circular orbs with drain fill
 *
 * Features:
 * - Draggable and resizable in edit mode
 * - Horizontal/vertical orientation options (orb mode)
 * - Size presets (compact, normal, large)
 * - Settings panel integration for configuration
 *
 * @packageDocumentation
 */

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  useEditMode,
  useSnap,
  useThemeStore,
  useMobileLayout,
  StatusOrb,
} from "@/ui";
import { getHudClusterSurfaceStyle } from "@/ui/theme/themes";
import type { PlayerStats } from "../../types";
import { HUD_FRAME, HUD_LAYERS } from "./layout";

export const STATUSBAR_CONFIG_STORAGE_KEY = "statusbar-config";
export const STATUSBAR_CONFIG_CHANGED_EVENT =
  "hyperia:statusbar-config:changed";

/** Display mode type */
export type DisplayMode = "bars" | "orbs";

/** Orientation type */
export type Orientation = "horizontal" | "vertical";

/** Size preset type */
export type SizePreset = "compact" | "normal" | "large";

/** Status bar configuration */
export interface StatusBarsConfig {
  displayMode: DisplayMode;
  orientation: Orientation;
  sizePreset: SizePreset;
  showLabels: boolean;
}

/** Status bar storage keys */
const STORAGE_KEYS = {
  position: "statusbar-position",
  size: "statusbar-size",
  config: STATUSBAR_CONFIG_STORAGE_KEY,
} as const;

/** Default configuration */
const DEFAULT_CONFIG: StatusBarsConfig = {
  displayMode: "bars",
  orientation: "horizontal",
  sizePreset: "normal",
  showLabels: true,
};

/** Size presets for bar mode - compact sizing */
const BAR_SIZE_PRESETS: Record<SizePreset, { width: number; height: number }> =
  {
    compact: { width: 140, height: 32 },
    normal: { width: 180, height: 38 },
    large: { width: 240, height: 50 },
  };

/** Size presets for orb mode - compact sizing */
const ORB_SIZE_PRESETS: Record<SizePreset, number> = {
  compact: 28,
  normal: 34,
  large: 44,
};

/** Min/max dimensions */
const MIN_SIZE = { width: 100, height: 32 };
const MAX_SIZE = { width: 350, height: 100 };

const parseConfig = (value: string | null): StatusBarsConfig | null => {
  if (!value) return null;
  try {
    return {
      ...DEFAULT_CONFIG,
      ...JSON.parse(value),
    } as StatusBarsConfig;
  } catch {
    return null;
  }
};

const isStatusBarsConfigEqual = (
  a: StatusBarsConfig,
  b: StatusBarsConfig,
): boolean =>
  a.displayMode === b.displayMode &&
  a.orientation === b.orientation &&
  a.sizePreset === b.sizePreset &&
  a.showLabels === b.showLabels;

interface StatusBarsProps {
  /** Player stats containing health and prayerPoints */
  stats: PlayerStats | null;
}

export function StatusBars({
  stats,
}: StatusBarsProps): React.ReactElement | null {
  const theme = useThemeStore((s) => s.theme);
  const { isUnlocked } = useEditMode();
  const { snap, snapEnabled } = useSnap();
  const layout = useMobileLayout();

  // Derive health and prayer from stats prop (same pattern as StatsPanel/CombatPanel)
  const health = stats?.health ?? { current: 0, max: 1 };
  const prayerPoints = stats?.prayerPoints ?? { current: 0, max: 1 };

  // Configuration with localStorage persistence
  const [config, setConfig] = useState<StatusBarsConfig>(() => {
    if (typeof window !== "undefined") {
      const savedConfig = parseConfig(
        localStorage.getItem(STORAGE_KEYS.config),
      );
      if (savedConfig) {
        return savedConfig;
      }
    }
    return DEFAULT_CONFIG;
  });

  // Position and size with localStorage persistence
  const [position, setPosition] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.position);
      if (saved) {
        try {
          return JSON.parse(saved) as { x: number; y: number };
        } catch {
          // Use default
        }
      }
    }
    return { x: 0, y: 0 };
  });

  const [size, setSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEYS.size);
      if (saved) {
        try {
          return JSON.parse(saved) as { width: number; height: number };
        } catch {
          // Use default
        }
      }
    }
    return BAR_SIZE_PRESETS.normal;
  });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{
    x: number;
    y: number;
    posX: number;
    posY: number;
  } | null>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  const resizeStart = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    posX: number;
    posY: number;
  } | null>(null);

  // Persist configuration
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
    }
  }, [config]);

  // Listen for config changes from Settings panel
  useEffect(() => {
    const applyConfig = (next: StatusBarsConfig | null) => {
      if (!next) return;
      setConfig((current) =>
        isStatusBarsConfigEqual(current, next) ? current : next,
      );
    };

    const handleStorageChange = (e: globalThis.StorageEvent) => {
      if (e.key !== STORAGE_KEYS.config) return;
      if (e.newValue === null) return;
      applyConfig(parseConfig(e.newValue));
    };

    const handleInternalConfigChange = (event: Event) => {
      const detail = (event as CustomEvent<{ config: StatusBarsConfig }>).detail
        ?.config;
      applyConfig(detail ?? null);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      STATUSBAR_CONFIG_CHANGED_EVENT,
      handleInternalConfigChange,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        STATUSBAR_CONFIG_CHANGED_EVENT,
        handleInternalConfigChange,
      );
    };
  }, []);

  // Persist position
  useEffect(() => {
    if (typeof window !== "undefined" && !isDragging) {
      localStorage.setItem(STORAGE_KEYS.position, JSON.stringify(position));
    }
  }, [position, isDragging]);

  // Persist size
  useEffect(() => {
    if (typeof window !== "undefined" && !isResizing) {
      localStorage.setItem(STORAGE_KEYS.size, JSON.stringify(size));
    }
  }, [size, isResizing]);

  // Handle resize
  const handleResize = useCallback((dir: string, e: React.PointerEvent) => {
    if (!resizeStart.current) return;

    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;

    let newWidth = resizeStart.current.width;
    let newHeight = resizeStart.current.height;
    let newX = resizeStart.current.posX;
    let newY = resizeStart.current.posY;

    // Handle horizontal resize
    if (dir.includes("e")) {
      newWidth = Math.max(
        MIN_SIZE.width,
        Math.min(MAX_SIZE.width, resizeStart.current.width + dx),
      );
    }
    if (dir.includes("w")) {
      const proposedWidth = resizeStart.current.width - dx;
      newWidth = Math.max(
        MIN_SIZE.width,
        Math.min(MAX_SIZE.width, proposedWidth),
      );
      newX = resizeStart.current.posX + (resizeStart.current.width - newWidth);
    }

    // Handle vertical resize
    if (dir.includes("s")) {
      newHeight = Math.max(
        MIN_SIZE.height,
        Math.min(MAX_SIZE.height, resizeStart.current.height + dy),
      );
    }
    if (dir.includes("n")) {
      const proposedHeight = resizeStart.current.height - dy;
      newHeight = Math.max(
        MIN_SIZE.height,
        Math.min(MAX_SIZE.height, proposedHeight),
      );
      newY =
        resizeStart.current.posY + (resizeStart.current.height - newHeight);
    }

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  }, []);

  // Toggle display mode
  const toggleDisplayMode = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      displayMode: prev.displayMode === "bars" ? "orbs" : "bars",
    }));
  }, []);

  // Resize handles
  const resizeHandles = useMemo(
    () => [
      { dir: "e", style: { top: 4, right: 0, width: 6, bottom: 4 } },
      { dir: "s", style: { left: 4, bottom: 0, height: 6, right: 4 } },
      { dir: "se", style: { bottom: 0, right: 0, width: 10, height: 10 } },
    ],
    [],
  );

  // Hide on mobile - CompactStatusHUD handles mobile status display
  // IMPORTANT: This must come AFTER all hooks to follow React's rules of hooks
  if (layout.isMobile || layout.isTablet) {
    return null;
  }

  // Cursor map for resize handles
  const cursorMap: Record<string, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
    sw: "nesw-resize",
  };

  // Calculate bar data
  const hpPercent = Math.round((health.current / health.max) * 100);
  const prayerPercent = Math.round(
    (prayerPoints.current / Math.max(1, prayerPoints.max)) * 100,
  );

  // Orb size based on container
  const orbSize = ORB_SIZE_PRESETS[config.sizePreset];

  // Render orb mode - using shared StatusOrb from @/ui
  const renderOrbMode = () => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: config.orientation === "horizontal" ? "row" : "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <StatusOrb
          type="hp"
          current={health.current}
          max={health.max}
          size={orbSize}
          icon="♥"
          showValue={config.showLabels}
          dynamicLabelColor
        />
        <StatusOrb
          type="prayer"
          current={prayerPoints.current}
          max={prayerPoints.max}
          size={orbSize}
          icon="✦"
          showValue={config.showLabels}
        />
      </div>
    );
  };

  // Render bar mode - compact orbs with progress bars
  const renderBarMode = () => {
    // Orb size for bar mode - compact
    const barOrbSize = Math.max(26, Math.min(32, size.height * 0.45));

    // Orb configurations
    const orbs = [
      {
        id: "hp",
        value: health.current,
        max: health.max,
        percent: hpPercent,
        fillColor: "#dc2626",
        darkColor: "#7f1d1d",
        icon: "♥",
        title: `Hitpoints: ${health.current}/${health.max}`,
      },
      {
        id: "prayer",
        value: prayerPoints.current,
        max: prayerPoints.max,
        percent: prayerPercent,
        fillColor: "#0ea5e9",
        darkColor: "#0c4a6e",
        icon: "✦",
        title: `Prayer: ${prayerPoints.current}/${prayerPoints.max}`,
      },
    ];

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          alignItems: "center",
        }}
      >
        {orbs.map((orb) => (
          <div
            key={orb.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
            }}
            title={orb.title}
          >
            {/* Orb */}
            <div
              style={{
                width: barOrbSize,
                height: barOrbSize,
                borderRadius: "50%",
                background: theme.colors.slot.filled,
                padding: 1,
                boxShadow: `0 1px 3px rgba(0, 0, 0, 0.4)`,
                position: "relative",
                zIndex: 2,
                flexShrink: 0,
              }}
            >
              {/* Inner orb */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  position: "relative",
                  background: theme.colors.slot.empty,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${theme.colors.border.default}30`,
                  boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
                }}
              >
                {/* Fill from bottom */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${orb.percent}%`,
                    background: `linear-gradient(to top, ${orb.fillColor} 0%, ${orb.darkColor} 100%)`,
                    transition: "height 0.2s ease-out",
                  }}
                />
                {/* Value number inside orb */}
                <span
                  style={{
                    fontSize: barOrbSize * 0.38,
                    color: "#fff",
                    textShadow: `0 0 3px rgba(0, 0, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.8)`,
                    zIndex: 1,
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  {orb.value}
                </span>
              </div>
            </div>

            {/* Progress bar extending from orb */}
            <div
              style={{
                width: size.width - barOrbSize - 32,
                height: 8,
                marginLeft: -barOrbSize * 0.2,
                background: theme.colors.slot.empty,
                borderRadius: 0,
                overflow: "hidden",
                border: `1px solid ${theme.colors.border.default}30`,
                borderLeft: "none",
                position: "relative",
                zIndex: 1,
                boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.3)",
              }}
            >
              {/* Fill */}
              <div
                style={{
                  width: `${orb.percent}%`,
                  height: "100%",
                  background: orb.fillColor,
                  borderRadius: 0,
                  transition: "width 0.2s ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Calculate container size based on mode - compact sizing
  // Fixed: 2 orbs (HP + Prayer) - Stamina is shown in minimap area
  const orbCount = 2;
  const compactGap = 4;
  const compactPadding = 3;

  // Orb size for bar mode - compact
  const barOrbSizeCalc = Math.max(26, Math.min(32, size.height * 0.45));

  const containerWidth =
    config.displayMode === "orbs"
      ? config.orientation === "horizontal"
        ? orbSize * orbCount + compactGap * (orbCount - 1) + compactPadding * 2
        : orbSize + compactPadding * 2
      : size.width;

  // For bar mode: 2 orb rows with gap + padding - compact
  const barModeHeight = barOrbSizeCalc * 2 + 3 + 8; // 2 orbs + gap + padding

  const containerHeight =
    config.displayMode === "orbs"
      ? config.orientation === "vertical"
        ? orbSize * orbCount + compactGap * (orbCount - 1) + compactPadding * 2
        : orbSize + compactPadding * 2
      : Math.max(size.height, barModeHeight);

  return (
    <div
      style={{
        position: "fixed",
        left: `calc(${HUD_FRAME.left} + ${position.x}px)`,
        top: `calc(${HUD_FRAME.top} + ${position.y}px)`,
        width: containerWidth,
        height: containerHeight,
        zIndex: HUD_LAYERS.cluster,
        display: "flex",
        flexDirection: config.displayMode === "bars" ? "column" : "row",
        alignItems: config.displayMode === "bars" ? "stretch" : "center",
        justifyContent: config.displayMode === "bars" ? "center" : "flex-start",
        gap: config.displayMode === "bars" ? 0 : compactGap,
        padding: config.displayMode === "bars" ? "4px 6px" : compactPadding,
        ...getHudClusterSurfaceStyle(theme, {
          active: isUnlocked,
          radius: config.displayMode === "bars" ? 6 : 8,
        }),
        cursor: isUnlocked ? "move" : "default",
        userSelect: "none",
        pointerEvents: "auto",
        overflow: "visible",
      }}
      onPointerDown={(e) => {
        if (!isUnlocked) return;
        const target = e.target as HTMLElement;
        if (target.dataset.resize || target.dataset.toggle) return;
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = {
          x: e.clientX,
          y: e.clientY,
          posX: position.x,
          posY: position.y,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!isDragging || !dragStart.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const rawPos = {
          x: Math.max(
            0,
            Math.min(window.innerWidth - 100, dragStart.current.posX + dx),
          ),
          y: Math.max(
            0,
            Math.min(window.innerHeight - 50, dragStart.current.posY + dy),
          ),
        };
        if (snapEnabled) {
          const snapped = snap(
            rawPos,
            { width: containerWidth, height: containerHeight },
            {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          );
          setPosition(snapped.position);
        } else {
          setPosition(rawPos);
        }
      }}
      onPointerUp={(e) => {
        if (isDragging) {
          if (snapEnabled) {
            const snapped = snap(
              position,
              { width: containerWidth, height: containerHeight },
              {
                width: window.innerWidth,
                height: window.innerHeight,
              },
            );
            setPosition(snapped.position);
          }
          setIsDragging(false);
          dragStart.current = null;
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => {
        setIsDragging(false);
        dragStart.current = null;
      }}
      onContextMenu={(e) => {
        // Right-click to toggle mode in edit mode
        if (isUnlocked) {
          e.preventDefault();
          toggleDisplayMode();
        }
      }}
    >
      {/* Mode toggle button (visible in edit mode) */}
      {isUnlocked && (
        <div
          data-toggle="mode"
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            width: 14,
            height: 14,
            borderRadius: theme.borderRadius.sm,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(18,22,28,0.94) 100%)",
            border: `1px solid ${theme.colors.border.default}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            cursor: "pointer",
            zIndex: 20,
            color: theme.colors.text.secondary,
            backdropFilter: `blur(${Math.max(4, theme.glass.blur - 3)}px)`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            toggleDisplayMode();
          }}
          title={`Switch to ${config.displayMode === "bars" ? "orbs" : "bars"} mode`}
        >
          {config.displayMode === "bars" ? "⚪" : "▬"}
        </div>
      )}

      {/* Render based on display mode */}
      {config.displayMode === "orbs" ? renderOrbMode() : renderBarMode()}

      {/* Resize handles - edit mode only, bar mode only */}
      {isUnlocked &&
        config.displayMode === "bars" &&
        resizeHandles.map(({ dir, style: handleStyle }) => (
          <div
            key={dir}
            data-resize={dir}
            style={{
              position: "absolute",
              ...handleStyle,
              cursor: cursorMap[dir],
              zIndex: 10,
              background:
                isResizing && resizeDir === dir
                  ? `${theme.colors.accent.secondary}26`
                  : "transparent",
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsResizing(true);
              setResizeDir(dir);
              resizeStart.current = {
                x: e.clientX,
                y: e.clientY,
                width: size.width,
                height: size.height,
                posX: position.x,
                posY: position.y,
              };
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!isResizing || resizeDir !== dir) return;
              handleResize(dir, e);
            }}
            onPointerUp={(e) => {
              if (isResizing && resizeDir === dir) {
                setIsResizing(false);
                setResizeDir(null);
                resizeStart.current = null;
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={() => {
              setIsResizing(false);
              setResizeDir(null);
              resizeStart.current = null;
            }}
          />
        ))}
    </div>
  );
}
