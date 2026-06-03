/**
 * Radial Minimap Menu
 *
 * A 3-layer round minimap with radial menu buttons for mobile UI.
 * Features:
 * - Layer 1: Back panel for depth/shadow effect
 * - Layer 2: Round minimap canvas
 * - Layer 3: Beveled ring overlay (Figma-style design)
 * - 5 radial menu buttons positioned around the circumference
 *
 * @packageDocumentation
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type CSSProperties,
} from "react";
import { useMobileLayout, useThemeStore } from "@/ui";
import {
  Backpack,
  Swords,
  Star,
  MessageSquare,
  Shirt,
  Sparkles,
  Settings,
  ScrollText,
  Users,
} from "lucide-react";
import { THREE } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import {
  getMobileUISizes,
  type MobileUISizes,
} from "../interface/mobileUISizes";
import { zIndex, shadows, borderRadius } from "../../constants";
import { Minimap } from "./Minimap";
import { MinimapStaminaOrb } from "./MinimapStaminaBar";
import { MinimapHomeTeleportOrb } from "./MinimapHomeTeleportOrb";

/** Pre-allocated vector for compass yaw calculation - avoids GC pressure in RAF loop */
const _tempCompassForward = new THREE.Vector3();

/** Radial button configuration */
interface RadialButtonConfig {
  id: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  panel: string;
}

/** Radial menu buttons - core gameplay panels accessible from minimap */
const RADIAL_BUTTONS: RadialButtonConfig[] = [
  { id: "inventory", icon: Backpack, label: "Inv", panel: "inventory" },
  { id: "equipment", icon: Shirt, label: "Equip", panel: "equipment" },
  { id: "combat", icon: Swords, label: "Combat", panel: "combat" },
  { id: "skills", icon: Star, label: "Skills", panel: "skills" },
  { id: "prayer", icon: Sparkles, label: "Prayer", panel: "prayer" },
  { id: "quests", icon: ScrollText, label: "Quests", panel: "quests" },
  { id: "friends", icon: Users, label: "Friends", panel: "friends" },
  { id: "settings", icon: Settings, label: "Settings", panel: "settings" },
  { id: "chat", icon: MessageSquare, label: "Chat", panel: "chat" },
];

interface RadialMinimapMenuProps {
  /** Game world instance */
  world: ClientWorld;
  /** Callback when a menu button is clicked */
  onButtonClick: (panelId: string) => void;
  /** Currently active panel (for highlighting) */
  activePanel?: string | null;
  /** Whether chat is visible (for highlighting chat button) */
  chatVisible?: boolean;
}

/**
 * Calculate button position in radial layout
 */
function getButtonPosition(
  index: number,
  total: number,
  sizes: MobileUISizes,
): { x: number; y: number } {
  const { minimap, radial } = sizes;

  // Arc spans from arcStart to arcEnd (degrees)
  const arcSpan = radial.arcEnd - radial.arcStart;
  const angleStep = arcSpan / (total - 1);
  const angleDeg = radial.arcStart + index * angleStep;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Distance from minimap center to button center
  const distance =
    minimap.diameter / 2 + radial.buttonOffset + minimap.buttonSize / 2;

  return {
    x: Math.cos(angleRad) * distance,
    y: Math.sin(angleRad) * distance,
  };
}

/**
 * Radial button component
 */
function RadialButton({
  config,
  position,
  size,
  isActive,
  onClick,
}: {
  config: RadialButtonConfig;
  position: { x: number; y: number };
  size: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const Icon = config.icon;

  const buttonStyle: CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
    width: size,
    height: size,
    borderRadius: borderRadius.full,
    border: `2px solid ${isActive ? theme.colors.accent.primary : theme.colors.border.default}`,
    backgroundColor: isActive
      ? `${theme.colors.accent.primary}33`
      : theme.colors.background.overlay,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
    boxShadow: isActive
      ? `0 0 12px ${theme.colors.accent.primary}66`
      : shadows.md,
    transition: "all 0.15s ease",
    zIndex: zIndex.raised,
  };

  return (
    <button onClick={onClick} style={buttonStyle} aria-label={config.label}>
      <Icon
        size={Math.round(size * 0.55)}
        color={
          isActive ? theme.colors.accent.primary : theme.colors.text.secondary
        }
      />
    </button>
  );
}

/**
 * Collapse Button - Top right corner to collapse/expand minimap
 */
function CollapseButton({
  size,
  isCollapsed,
  onClick,
}: {
  size: number;
  isCollapsed: boolean;
  onClick: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  const buttonStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: borderRadius.full,
    border: `2px solid ${theme.colors.border.default}`,
    backgroundColor: theme.colors.background.overlay,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
    boxShadow: shadows.md,
    pointerEvents: "auto",
  };

  return (
    <button
      onClick={onClick}
      style={buttonStyle}
      aria-label={isCollapsed ? "Expand minimap" : "Collapse minimap"}
      title={isCollapsed ? "Expand minimap" : "Collapse minimap"}
    >
      <span
        style={{ fontSize: size * 0.5, color: theme.colors.text.secondary }}
      >
        {isCollapsed ? "+" : "−"}
      </span>
    </button>
  );
}

/**
 * Top Compass Component
 * Positioned at top center (north position) of minimap
 * Rotates with camera, clicking recenters to north
 */
function TopCompass({
  size,
  yawDeg,
  onNorthClick,
}: {
  size: number;
  yawDeg: number;
  onNorthClick: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const innerSize = Math.round(size * 0.75);
  const fontSize = Math.max(8, Math.round(size * 0.22));
  const nFontSize = Math.max(9, Math.round(size * 0.28));

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: borderRadius.full,
    border: `2px solid ${theme.colors.border.default}`,
    backgroundColor: theme.colors.background.overlay,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
    boxShadow: `${shadows.md}, ${shadows.inner}`,
    pointerEvents: "auto",
  };

  const ringStyle: CSSProperties = {
    position: "relative",
    width: innerSize,
    height: innerSize,
    transform: `rotate(${yawDeg}deg)`,
    transition: "transform 0.1s ease-out",
    pointerEvents: "none",
  };

  const ringBorderStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: borderRadius.full,
    border: `1px solid ${theme.colors.text.muted}`,
    pointerEvents: "none",
  };

  const directionBase: CSSProperties = {
    position: "absolute",
    fontWeight: 600,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
    pointerEvents: "none",
  };

  return (
    <button
      onClick={onNorthClick}
      style={containerStyle}
      aria-label="Click to face North"
      title="Click to face North"
    >
      <div style={ringStyle}>
        <div style={ringBorderStyle} />
        <div
          style={{
            ...directionBase,
            left: "50%",
            top: 1,
            transform: "translateX(-50%)",
            fontSize: nFontSize,
            color: theme.colors.state.danger,
          }}
        >
          N
        </div>
        <div
          style={{
            ...directionBase,
            left: "50%",
            bottom: 1,
            transform: "translateX(-50%)",
            fontSize,
            color: theme.colors.text.muted,
          }}
        >
          S
        </div>
        <div
          style={{
            ...directionBase,
            top: "50%",
            left: 2,
            transform: "translateY(-50%)",
            fontSize,
            color: theme.colors.text.muted,
          }}
        >
          W
        </div>
        <div
          style={{
            ...directionBase,
            top: "50%",
            right: 2,
            transform: "translateY(-50%)",
            fontSize,
            color: theme.colors.text.muted,
          }}
        >
          E
        </div>
      </div>
    </button>
  );
}

/**
 * Radial Minimap Menu Component
 *
 * 3-layer design:
 * - Layer 1: Back panel (shadow/depth)
 * - Layer 2: Minimap canvas
 * - Layer 3: Beveled ring overlay
 * Plus 5 radial menu buttons around the circumference
 * Compass button in top-right to collapse/expand
 */
export function RadialMinimapMenu({
  world,
  onButtonClick,
  activePanel,
  chatVisible = false,
}: RadialMinimapMenuProps): React.ReactElement {
  const layout = useMobileLayout();
  const theme = useThemeStore((s) => s.theme);
  const sizes = useMemo(() => getMobileUISizes(layout), [layout]);

  // Collapsed state - when true, only show compass button
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Camera yaw for compass rotation
  const [yawDeg, setYawDeg] = useState(0);

  // Track camera rotation for compass
  useEffect(() => {
    if (!world?.camera) return;

    let animationId: number;

    const updateYaw = () => {
      if (world.camera) {
        // Reuse pre-allocated vector to avoid GC pressure in RAF loop
        world.camera.getWorldDirection(_tempCompassForward);
        _tempCompassForward.y = 0;
        if (_tempCompassForward.lengthSq() > 0.0001) {
          _tempCompassForward.normalize();
          const yaw = Math.atan2(_tempCompassForward.x, _tempCompassForward.z);
          const newYawDeg = THREE.MathUtils.radToDeg(yaw);
          setYawDeg((prev) =>
            Math.abs(prev - newYawDeg) > 0.5 ? newYawDeg : prev,
          );
        }
      }
      animationId = requestAnimationFrame(updateYaw);
    };

    updateYaw();
    return () => cancelAnimationFrame(animationId);
  }, [world?.camera]);

  const handleCollapseClick = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Recenter camera to face north (like normal minimap behavior)
  const handleNorthClick = useCallback(() => {
    // Reset camera to face north using camera system
    const camSys = world.getSystem("client-camera-system") as {
      resetCamera?: () => void;
    } | null;
    camSys?.resetCamera?.();
  }, [world]);

  const { diameter, buttonSize } = sizes.minimap;

  // Compass button size - slightly smaller than menu buttons
  const compassSize = Math.round(buttonSize * 0.85);

  // Calculate container size - minimap at top, buttons extend down and left
  const buttonExtent = sizes.radial.buttonOffset + buttonSize;
  const containerWidth = diameter + buttonExtent + 4;
  const containerHeight = diameter + buttonExtent + 4;

  // Collapsed container is just the compass button size
  const collapsedSize = compassSize + 16;

  // Container style - responsive positioning based on layout mode
  const containerStyle: CSSProperties = (() => {
    const pos = sizes.minimap.position;
    const baseStyle: CSSProperties = {
      position: "fixed",
      width: isCollapsed ? collapsedSize : containerWidth,
      height: isCollapsed ? collapsedSize : containerHeight,
      pointerEvents: "none",
      zIndex: zIndex.mobileMinimap,
      transition: "width 0.2s ease, height 0.2s ease",
    };

    // Add extra offset to accommodate compass/buttons extending beyond minimap
    const edgeOffset = compassSize / 2 + 8;

    if (pos === "top-right") {
      // Landscape mobile: top-right corner
      return {
        ...baseStyle,
        top: layout.safeAreaInsets.top + edgeOffset,
        right: layout.safeAreaInsets.right + edgeOffset,
      };
    }
    if (pos === "bottom-left") {
      // Alternative: bottom-left
      return {
        ...baseStyle,
        bottom: layout.safeAreaInsets.bottom + edgeOffset,
        left: layout.safeAreaInsets.left + edgeOffset,
      };
    }
    // Default: bottom-right (portrait)
    return {
      ...baseStyle,
      top: layout.safeAreaInsets.top + edgeOffset,
      right: layout.safeAreaInsets.right + edgeOffset,
    };
  })();

  // Minimap wrapper - positioned to top-right of container
  const minimapWrapperStyle: CSSProperties = {
    position: "absolute",
    right: 0,
    top: 0,
    width: diameter,
    height: diameter,
    pointerEvents: "auto",
    opacity: isCollapsed ? 0 : 1,
    transform: isCollapsed ? "scale(0.5)" : "scale(1)",
    transformOrigin: "top right",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  };

  // Minimap container with dark border (matches desktop style)
  const minimapContainerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: borderRadius.full,
    overflow: "hidden",
    border: `2px solid ${theme.colors.border.default}`,
    boxSizing: "border-box",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const orbSize = Math.round(compassSize * 0.75);
  const collapseSize = Math.round(compassSize * 0.9); // Larger than other orbs

  // When collapsed, show only collapse button
  if (isCollapsed) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: collapsedSize,
            height: collapsedSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <CollapseButton
            size={compassSize}
            isCollapsed={isCollapsed}
            onClick={handleCollapseClick}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Minimap */}
      <div style={minimapWrapperStyle}>
        {/* Minimap canvas - size accounts for container border */}
        {/* Use a larger canvas that will be clipped to circle - this ensures the minimap fills the radial container */}
        {/* Zoom is reduced to ~20 so content fills the circular view (compensates for corner clipping) */}
        <div style={minimapContainerStyle}>
          <Minimap
            world={world}
            width={diameter}
            height={diameter}
            zoom={20}
            embedded={true}
            resizable={false}
            isVisible={true}
            collapsible={false}
            onCompassClick={handleNorthClick}
          />
        </div>

        {/* Compass - top center (north position), click to recenter */}
        <div
          style={{
            position: "absolute",
            top: -compassSize / 2 - 2,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: zIndex.raised,
            pointerEvents: "auto",
          }}
        >
          <TopCompass
            size={compassSize}
            yawDeg={yawDeg}
            onNorthClick={handleNorthClick}
          />
        </div>

        {/* Utility buttons curved around top-right of minimap */}
        {(() => {
          // Tighter arc in top-right: collapse at corner, teleport and stamina beside it
          const utilityButtons = [
            { id: "teleport", angle: -63 }, // Upper (toward top)
            { id: "collapse", angle: -45 }, // Top-right corner
            { id: "stamina", angle: -27 }, // Right side (slightly down from corner)
          ];
          const distance =
            diameter / 2 + sizes.radial.buttonOffset + orbSize / 2;

          return utilityButtons.map((btn) => {
            const angleRad = (btn.angle * Math.PI) / 180;
            const x = Math.cos(angleRad) * distance;
            const y = Math.sin(angleRad) * distance;

            return (
              <div
                key={btn.id}
                style={{
                  position: "absolute",
                  left: diameter / 2 + x - orbSize / 2,
                  top: diameter / 2 + y - orbSize / 2,
                  zIndex: zIndex.raised,
                  pointerEvents: "auto",
                }}
              >
                {btn.id === "teleport" && (
                  <MinimapHomeTeleportOrb world={world} size={orbSize} />
                )}
                {btn.id === "collapse" && (
                  <CollapseButton
                    size={collapseSize}
                    isCollapsed={isCollapsed}
                    onClick={handleCollapseClick}
                  />
                )}
                {btn.id === "stamina" && (
                  <MinimapStaminaOrb world={world} size={orbSize} />
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Radial menu buttons - positioned relative to minimap center */}
      {RADIAL_BUTTONS.map((button, index) => {
        const position = getButtonPosition(index, RADIAL_BUTTONS.length, sizes);
        const isActive =
          activePanel === button.panel || (button.id === "chat" && chatVisible);

        // Minimap center is at top-right of container
        const minimapCenterX = containerWidth - diameter / 2;
        const minimapCenterY = diameter / 2;

        return (
          <div
            key={button.id}
            style={{
              position: "absolute",
              left: minimapCenterX,
              top: minimapCenterY,
              pointerEvents: "auto",
            }}
          >
            <RadialButton
              config={button}
              position={position}
              size={buttonSize}
              isActive={isActive}
              onClick={() => onButtonClick(button.panel)}
            />
          </div>
        );
      })}
    </div>
  );
}
