/**
 * Status Bar Components
 *
 * RS3-style status bars for HP, prayer, adrenaline, energy.
 * Supports both horizontal bar and orb variants.
 *
 * @packageDocumentation
 */

import React, { memo, type CSSProperties } from "react";
import { getHpColor } from "@hyperscape/shared";
import { useTheme } from "../stores/themeStore";

/** Status type */
export type StatusType = "hp" | "prayer" | "adrenaline" | "energy";

/** Status bar props */
export interface StatusBarProps {
  /** Status type (determines color scheme) */
  type: StatusType;
  /** Current value */
  current: number;
  /** Maximum value */
  max: number;
  /** Width of the bar (default: 100%) */
  width?: number | string;
  /** Height of the bar (default: 20) */
  height?: number;
  /** Show text label */
  showLabel?: boolean;
  /** Custom label format */
  labelFormat?: (current: number, max: number) => string;
  /** Click handler */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Status Bar Component (horizontal bar variant)
 *
 * @example
 * ```tsx
 * function HealthBar() {
 *   return (
 *     <StatusBar
 *       type="hp"
 *       current={850}
 *       max={990}
 *       showLabel
 *     />
 *   );
 * }
 * ```
 */
export const StatusBar = memo(function StatusBar({
  type,
  current,
  max,
  width = "100%",
  height = 20,
  showLabel = true,
  labelFormat,
  onClick,
  className,
  style,
}: StatusBarProps): React.ReactElement {
  const theme = useTheme();

  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const bgKey = `${type}Background` as const;

  const containerStyle: CSSProperties = {
    width,
    height,
    position: "relative",
    backgroundColor: theme.colors.status[bgKey],
    borderRadius: 0,
    border: `1px solid ${theme.colors.border.default}`,
    overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    ...style,
  };

  const fillStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    width: `${percent}%`,
    backgroundColor: theme.colors.status[type],
    transition: "width 0.3s ease-out",
    // Add gradient sheen
    backgroundImage: `linear-gradient(to bottom, 
      rgba(255,255,255,0.15) 0%, 
      rgba(255,255,255,0) 50%, 
      rgba(0,0,0,0.1) 100%)`,
  };

  const labelStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: height * 0.6,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
    zIndex: 1,
  };

  const label = labelFormat ? labelFormat(current, max) : `${current}/${max}`;

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={`${type.charAt(0).toUpperCase() + type.slice(1)}: ${label}`}
    >
      <div style={fillStyle} />
      {showLabel && <div style={labelStyle}>{label}</div>}
    </div>
  );
});

/** Status effect type for visual indicators */
export type StatusEffect = "none" | "poison" | "venom" | "disease";

/** Status orb props */
export interface StatusOrbProps {
  /** Status type (determines color scheme) */
  type: StatusType;
  /** Current value */
  current: number;
  /** Maximum value */
  max: number;
  /** Size of the orb (default: 40) */
  size?: number;
  /** Icon to display in center */
  icon?: string | React.ReactNode;
  /** Show percentage text */
  showPercent?: boolean;
  /** Show current value as number */
  showValue?: boolean;
  /** Active status effect (changes background color) */
  statusEffect?: StatusEffect;
  /** Enable dynamic label color based on HP percentage (OSRS-style) */
  dynamicLabelColor?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Right-click handler */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Get status effect background color
 */
function getStatusEffectColor(effect: StatusEffect): string | null {
  switch (effect) {
    case "poison":
      return "rgba(34, 197, 94, 0.3)"; // Green tint
    case "venom":
      return "rgba(20, 184, 166, 0.4)"; // Dark teal tint
    case "disease":
      return "rgba(234, 179, 8, 0.3)"; // Yellow tint
    default:
      return null;
  }
}

/**
 * Status Orb Component (Dark fantasy themed variant)
 *
 * Features:
 * - Dark themed orbs that match the UI aesthetic
 * - Circular fill that drains from bottom as value decreases
 * - Dynamic label color for HP (green → yellow → red)
 * - Status effect background colors (poison, venom, disease)
 * - Click and right-click handlers
 *
 * @example
 * ```tsx
 * function PrayerOrb() {
 *   return (
 *     <StatusOrb
 *       type="prayer"
 *       current={500}
 *       max={990}
 *       icon="🙏"
 *       onClick={() => toggleQuickPrayers()}
 *     />
 *   );
 * }
 *
 * function HPOrb() {
 *   return (
 *     <StatusOrb
 *       type="hp"
 *       current={25}
 *       max={99}
 *       showValue
 *       dynamicLabelColor
 *       statusEffect="poison"
 *       onClick={() => useCure()}
 *     />
 *   );
 * }
 * ```
 */
export const StatusOrb = memo(function StatusOrb({
  type,
  current,
  max,
  size = 40,
  icon,
  showPercent = false,
  showValue = false,
  statusEffect = "none",
  dynamicLabelColor = false,
  onClick,
  onContextMenu,
  className,
  style,
}: StatusOrbProps): React.ReactElement {
  const theme = useTheme();

  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const statusEffectBg = getStatusEffectColor(statusEffect);

  // Determine label color
  const labelColor =
    dynamicLabelColor && type === "hp"
      ? getHpColor(percent)
      : theme.colors.text.primary;

  // Use muted, darker versions of status colors for the fill
  const fillColors: Record<StatusType, { fill: string; dark: string }> = {
    hp: { fill: "#b91c1c", dark: "#7f1d1d" }, // Darker red
    prayer: { fill: "#0284c7", dark: "#0c4a6e" }, // Darker blue
    adrenaline: { fill: "#b45309", dark: "#78350f" }, // Darker amber
    energy: { fill: "#15803d", dark: "#14532d" }, // Darker green
  };

  const colors = fillColors[type];

  // Outer container - dark themed ring
  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    position: "relative",
    borderRadius: "50%",
    padding: 2,
    background: `linear-gradient(145deg, ${theme.colors.background.tertiary} 0%, ${theme.colors.background.primary} 100%)`,
    border: `1px solid ${theme.colors.border.default}`,
    boxShadow: `
      0 2px 8px rgba(0, 0, 0, 0.5),
      inset 0 1px 1px rgba(255, 255, 255, 0.05)
    `,
    cursor: onClick ? "pointer" : "default",
    ...style,
  };

  // Inner orb container
  const innerOrbStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    position: "relative",
    overflow: "hidden",
    background: statusEffectBg || theme.colors.background.primary,
    border: `1px solid rgba(0, 0, 0, 0.4)`,
    boxShadow: `inset 0 2px 6px rgba(0, 0, 0, 0.6)`,
  };

  // Drain fill (fills from bottom)
  const fillStyle: CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: `${percent}%`,
    background: `linear-gradient(to top, ${colors.fill} 0%, ${colors.dark} 100%)`,
    transition: "height 0.3s ease-out",
    boxShadow: `inset 0 1px 2px rgba(255, 255, 255, 0.15)`,
  };

  // Determine what to display
  const showValueLabel = showValue && icon;

  // Icon/content layer - positioned higher when value label is also shown
  const iconStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: showValueLabel ? "flex-start" : "center",
    justifyContent: "center",
    paddingTop: showValueLabel ? size * 0.18 : 0,
    fontSize: size * 0.32,
    zIndex: 1,
    pointerEvents: "none",
    filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))",
  };

  // Value label (number display)
  const valueStyle: CSSProperties = {
    position: "absolute",
    bottom: size * 0.08,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    fontSize: size * 0.26,
    fontWeight: theme.typography.fontWeight.bold,
    color: labelColor,
    textShadow: `
      0 0 4px rgba(0, 0, 0, 1),
      1px 1px 2px rgba(0, 0, 0, 0.9),
      -1px -1px 1px rgba(0, 0, 0, 0.5)
    `,
    zIndex: 2,
    pointerEvents: "none",
  };

  // Determine what to display
  const displayContent = showPercent
    ? `${Math.round(percent)}%`
    : showValue
      ? current.toString()
      : icon;

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role={onClick ? "button" : undefined}
      title={`${type.charAt(0).toUpperCase() + type.slice(1)}: ${current}/${max}`}
    >
      <div style={innerOrbStyle}>
        {/* Drain fill */}
        <div style={fillStyle} />

        {/* Icon or main content */}
        <div style={iconStyle}>{showValueLabel ? icon : displayContent}</div>

        {/* Value label below icon (when both icon and value are shown) */}
        {showValueLabel && <div style={valueStyle}>{current}</div>}
      </div>
    </div>
  );
});

/** Special Attack Orb Props */
export interface SpecialAttackOrbProps {
  /** Current special attack energy (0-100) */
  energy: number;
  /** Size of the orb (default: 40) */
  size?: number;
  /** Whether a special attack weapon is equipped */
  hasSpecWeapon?: boolean;
  /** Click handler to activate special attack */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Special Attack Orb Component (OSRS-style)
 *
 * Shows special attack energy with visual feedback:
 * - Light blue fill when spec weapon equipped
 * - Gray when no spec weapon
 * - Click to activate special attack
 *
 * @example
 * ```tsx
 * function SpecOrb() {
 *   return (
 *     <SpecialAttackOrb
 *       energy={75}
 *       hasSpecWeapon={true}
 *       onClick={() => activateSpecial()}
 *     />
 *   );
 * }
 * ```
 */
export const SpecialAttackOrb = memo(function SpecialAttackOrb({
  energy,
  size = 40,
  hasSpecWeapon = false,
  onClick,
  className,
  style,
}: SpecialAttackOrbProps): React.ReactElement {
  const theme = useTheme();

  const percent = Math.max(0, Math.min(100, energy));

  // Colors based on whether spec weapon is equipped
  const fillColor = hasSpecWeapon ? "#38bdf8" : "#6b7280"; // Light blue or gray
  const borderColor = hasSpecWeapon ? "#0ea5e9" : "#4b5563";
  const bgColor = hasSpecWeapon
    ? "rgba(56, 189, 248, 0.15)"
    : "rgba(107, 114, 128, 0.15)";

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    position: "relative",
    borderRadius: "50%",
    backgroundColor: bgColor,
    border: `2px solid ${borderColor}`,
    overflow: "hidden",
    cursor: hasSpecWeapon && onClick ? "pointer" : "default",
    boxShadow: theme.shadows.sm,
    opacity: hasSpecWeapon ? 1 : 0.6,
    transition: "all 0.3s ease-out",
    ...style,
  };

  const fillStyle: CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: `${percent}%`,
    backgroundColor: fillColor,
    opacity: 0.8,
    transition: "height 0.3s ease-out",
    backgroundImage: `linear-gradient(to top, ${fillColor} 0%, ${fillColor}dd 60%, ${fillColor}aa 100%)`,
  };

  const iconStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.4,
    zIndex: 1,
    pointerEvents: "none",
  };

  const valueStyle: CSSProperties = {
    position: "absolute",
    bottom: 2,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    fontSize: size * 0.26,
    fontWeight: theme.typography.fontWeight.bold,
    color: hasSpecWeapon ? "#38bdf8" : "#9ca3af",
    textShadow: "1px 1px 2px rgba(0,0,0,0.9)",
    zIndex: 2,
    pointerEvents: "none",
  };

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={hasSpecWeapon ? onClick : undefined}
      role={hasSpecWeapon && onClick ? "button" : undefined}
      title={`Special Attack: ${percent}%${!hasSpecWeapon ? " (no special weapon equipped)" : ""}`}
    >
      <div style={fillStyle} />
      <div style={iconStyle}>⚔️</div>
      <div style={valueStyle}>{Math.round(percent)}</div>
    </div>
  );
});

/** Run Energy Orb Props */
export interface RunEnergyOrbProps {
  /** Current run energy (0-100) */
  energy: number;
  /** Size of the orb (default: 40) */
  size?: number;
  /** Whether running is enabled */
  isRunning?: boolean;
  /** Click handler to toggle run */
  onClick?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Run Energy Orb Component (OSRS-style)
 *
 * Shows run energy with toggle functionality:
 * - Amber/orange fill for energy level
 * - Icon changes based on running state
 * - Click to toggle run on/off
 *
 * @example
 * ```tsx
 * function RunOrb() {
 *   return (
 *     <RunEnergyOrb
 *       energy={85}
 *       isRunning={true}
 *       onClick={() => toggleRun()}
 *     />
 *   );
 * }
 * ```
 */
export const RunEnergyOrb = memo(function RunEnergyOrb({
  energy,
  size = 40,
  isRunning = false,
  onClick,
  className,
  style,
}: RunEnergyOrbProps): React.ReactElement {
  const theme = useTheme();

  const percent = Math.max(0, Math.min(100, energy));

  // Amber/orange colors for energy
  const fillColor = isRunning ? "#f59e0b" : "#d97706";
  const borderColor = isRunning ? "#fbbf24" : "#b45309";
  const bgColor = "rgba(245, 158, 11, 0.15)";

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    position: "relative",
    borderRadius: "50%",
    backgroundColor: bgColor,
    border: `2px solid ${borderColor}`,
    overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    boxShadow: theme.shadows.sm,
    transition: "all 0.3s ease-out",
    ...style,
  };

  const fillStyle: CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: `${percent}%`,
    backgroundColor: fillColor,
    opacity: 0.8,
    transition: "height 0.3s ease-out",
    backgroundImage: `linear-gradient(to top, ${fillColor} 0%, ${fillColor}dd 60%, ${fillColor}aa 100%)`,
  };

  const iconStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.35,
    zIndex: 1,
    pointerEvents: "none",
  };

  const valueStyle: CSSProperties = {
    position: "absolute",
    bottom: 2,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    fontSize: size * 0.26,
    fontWeight: theme.typography.fontWeight.bold,
    color: "#fbbf24",
    textShadow: "1px 1px 2px rgba(0,0,0,0.9)",
    zIndex: 2,
    pointerEvents: "none",
  };

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      title={`Run Energy: ${percent}% (${isRunning ? "Running" : "Walking"})`}
    >
      <div style={fillStyle} />
      <div style={iconStyle}>{isRunning ? "🏃" : "🚶"}</div>
      <div style={valueStyle}>{Math.round(percent)}</div>
    </div>
  );
});

/** Status bars group props */
export interface StatusBarsGroupProps {
  /** HP status */
  hp: { current: number; max: number };
  /** Prayer status */
  prayer?: { current: number; max: number };
  /** Adrenaline status */
  adrenaline?: { current: number; max: number };
  /** Orientation */
  orientation?: "horizontal" | "vertical";
  /** Bar variant */
  variant?: "bar" | "orb";
  /** Custom class name */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Status Bars Group Component
 *
 * @example
 * ```tsx
 * function PlayerStatus() {
 *   return (
 *     <StatusBarsGroup
 *       hp={{ current: 850, max: 990 }}
 *       prayer={{ current: 500, max: 990 }}
 *       adrenaline={{ current: 75, max: 100 }}
 *     />
 *   );
 * }
 * ```
 */
export const StatusBarsGroup = memo(function StatusBarsGroup({
  hp,
  prayer,
  adrenaline,
  orientation = "horizontal",
  variant = "bar",
  className,
  style,
}: StatusBarsGroupProps): React.ReactElement {
  const theme = useTheme();

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: orientation === "horizontal" ? "row" : "column",
    gap: theme.spacing.sm,
    alignItems: "center",
    ...style,
  };

  if (variant === "orb") {
    return (
      <div className={className} style={containerStyle}>
        <StatusOrb type="hp" {...hp} icon="❤️" />
        {prayer && <StatusOrb type="prayer" {...prayer} icon="🙏" />}
        {adrenaline && (
          <StatusOrb type="adrenaline" {...adrenaline} showPercent />
        )}
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <StatusBar type="hp" {...hp} width={120} />
      {prayer && <StatusBar type="prayer" {...prayer} width={120} />}
      {adrenaline && <StatusBar type="adrenaline" {...adrenaline} width={80} />}
    </div>
  );
});

export default StatusBar;
