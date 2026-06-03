import React, { useEffect, useState, useMemo, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useThemeStore, useMobileLayout, useWindowStore } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { EventType, getAvailableStyles, WeaponType } from "@hyperforge/shared";
import {
  PANEL_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_GRID_GAP,
} from "../../constants/panelLayout";
import type {
  ClientWorld,
  PlayerStats,
  PlayerEquipmentItems,
  PlayerHealth,
} from "../../types";

/** SVG Icons for attack styles - clean vector icons */
const StyleIcon = ({
  style,
  size = 16,
  color = "currentColor",
}: {
  style: string;
  size?: number;
  color?: string;
}) => {
  switch (style) {
    case "accurate":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "aggressive":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 4l7.5 7.5-7.5 7.5" />
          <path d="M5.5 4l7.5 7.5-7.5 7.5" />
        </svg>
      );
    case "defensive":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "controlled":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="2" x2="12" y2="22" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "rapid":
      // Lightning bolt for rapid fire
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "longrange":
      // Telescope/distance icon for longrange
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12h-8" />
          <path d="m3 12 4-4v8l-4-4z" />
          <path d="M11 8h2" />
          <path d="M11 16h2" />
          <path d="M16 12v.01" />
        </svg>
      );
    case "autocast":
      // Magic wand/star icon for autocast
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      );
    default:
      return null;
  }
};

/** Stat icons as SVG */
const StatIcon = ({
  stat,
  size = 14,
  color = "currentColor",
}: {
  stat: "attack" | "strength" | "defense";
  size?: number;
  color?: string;
}) => {
  switch (stat) {
    case "attack":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" />
          <path d="m16 16 6-6" />
          <path d="m8 8 6-6" />
          <path d="m9 7 8 8" />
          <path d="m21 11-8-8" />
        </svg>
      );
    case "strength":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18.36 2.64a9 9 0 0 1 3 3" />
          <path d="M15 6.5v11" />
          <path d="M9 6.5v11" />
          <path d="M4 11a9 9 0 0 1 3-3" />
          <path d="M2.64 18.36a9 9 0 0 0 3 3" />
          <path d="M20 13a9 9 0 0 1-3 3" />
          <path d="M21.36 5.64a9 9 0 0 0-3 3" />
          <path d="M4 13a9 9 0 0 0 3 3" />
        </svg>
      );
    case "defense":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
  }
};

/** Individual combat style info */
interface CombatStyleInfo {
  id: string;
  label: string;
  xp: string;
  color: string;
}

/** Short XP labels for compact banner display */
const XP_SHORT_LABELS: Record<string, string> = {
  Attack: "+ATK",
  Strength: "+STR",
  Defense: "+DEF",
  All: "+ALL",
  Ranged: "+RNG",
  "Rng+Def": "+R/D",
  Magic: "+MAG",
};

/** Filled game-style icons for combat banners — bold, solid fills for fantasy UI */
const BannerStyleIcon = ({
  style,
  size = 24,
  color = "currentColor",
  muted = false,
}: {
  style: string;
  size?: number;
  color?: string;
  muted?: boolean;
}) => {
  const fo = muted ? 0.25 : 0.55;
  const so = muted ? 0.45 : 1;

  switch (style) {
    case "accurate":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10.5"
            fill={color}
            fillOpacity={fo * 0.35}
            stroke={color}
            strokeWidth="1.4"
            strokeOpacity={so}
          />
          <circle
            cx="12"
            cy="12"
            r="7"
            fill={color}
            fillOpacity={fo * 0.55}
            stroke={color}
            strokeWidth="1.1"
            strokeOpacity={so * 0.85}
          />
          <circle
            cx="12"
            cy="12"
            r="3.5"
            fill={color}
            fillOpacity={fo * 0.85}
            stroke={color}
            strokeWidth="0.9"
            strokeOpacity={so * 0.9}
          />
          <circle
            cx="12"
            cy="12"
            r="1.3"
            fill={color}
            fillOpacity={muted ? 0.4 : 0.95}
          />
        </svg>
      );
    case "aggressive":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M5 4l12 8-12 8Z"
            fill={color}
            fillOpacity={fo * 0.6}
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeOpacity={so}
          />
          <path
            d="M11 7l8 5-8 5Z"
            fill={color}
            fillOpacity={fo * 0.35}
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeOpacity={so * 0.7}
          />
        </svg>
      );
    case "defensive":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            fill={color}
            fillOpacity={fo * 0.55}
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeOpacity={so}
          />
          <path
            d="M12 18.5s5.5-2.5 5.5-7V6.5L12 4.5 6.5 6.5V11.5c0 4.5 5.5 7 5.5 7z"
            fill={color}
            fillOpacity={fo * 0.3}
            stroke={color}
            strokeWidth="0.7"
            strokeOpacity={so * 0.5}
          />
        </svg>
      );
    case "controlled":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={color}
            fillOpacity={fo * 0.2}
            stroke={color}
            strokeWidth="1.4"
            strokeOpacity={so}
          />
          <line
            x1="12"
            y1="3"
            x2="12"
            y2="21"
            stroke={color}
            strokeWidth="1.4"
            strokeOpacity={so}
          />
          <line
            x1="3"
            y1="12"
            x2="21"
            y2="12"
            stroke={color}
            strokeWidth="1.4"
            strokeOpacity={so}
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            fill={color}
            fillOpacity={fo * 0.6}
            stroke={color}
            strokeWidth="1"
            strokeOpacity={so * 0.85}
          />
        </svg>
      );
    case "rapid":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <polygon
            points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
            fill={color}
            fillOpacity={fo * 0.65}
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeOpacity={so}
          />
        </svg>
      );
    case "longrange":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={color}
            fillOpacity={fo * 0.12}
            stroke={color}
            strokeWidth="1.2"
            strokeOpacity={so * 0.5}
          />
          <path
            d="m3 12 5-4v8l-5-4z"
            fill={color}
            fillOpacity={fo * 0.55}
            stroke={color}
            strokeWidth="1.2"
            strokeOpacity={so}
          />
          <path
            d="M10 12h11"
            stroke={color}
            strokeWidth="2"
            strokeOpacity={so}
            strokeLinecap="round"
          />
          <path
            d="M17 8l4 4-4 4"
            stroke={color}
            strokeWidth="1.5"
            strokeOpacity={so}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "autocast":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24">
          <path
            d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
            fill={color}
            fillOpacity={fo * 0.6}
            stroke={color}
            strokeWidth="1.3"
            strokeOpacity={so}
          />
        </svg>
      );
    default:
      return null;
  }
};

// Shield/crest SVG paths for combat banners
const SHIELD_OUTER =
  "M 5 0 L 95 0 Q 100 0 100 5 L 100 82 Q 100 102 50 128 Q 0 102 0 82 L 0 5 Q 0 0 5 0 Z";
const SHIELD_INNER =
  "M 8 3 L 92 3 Q 97 3 97 7 L 97 80 Q 97 99 50 123 Q 3 99 3 80 L 3 7 Q 3 3 8 3 Z";

/** Combat style banner — heraldic shield using theme colors */
const CombatStyleBanner = ({
  style: styleInfo,
  isActive,
  disabled,
  isMobile,
  onClick,
  theme,
}: {
  style: CombatStyleInfo;
  isActive: boolean;
  disabled: boolean;
  isMobile: boolean;
  onClick: () => void;
  theme: ReturnType<typeof useThemeStore.getState>["theme"];
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `combatstyle-${styleInfo.id}`,
    data: {
      combatStyle: {
        id: styleInfo.id,
        label: styleInfo.label,
        color: styleInfo.color,
      },
      source: "combatstyle",
    },
    disabled,
  });

  const shortXp =
    XP_SHORT_LABELS[styleInfo.xp] ||
    `+${styleInfo.xp.slice(0, 3).toUpperCase()}`;
  const baseGradId = `banner-base-${styleInfo.id}`;
  const tintGradId = `banner-tint-${styleInfo.id}`;

  // Theme-derived colors
  const bgDark = theme.colors.background.primary;
  const bgMid = theme.colors.background.secondary;
  const bgLight = theme.colors.background.tertiary;
  const accentGold = theme.colors.accent.primary;
  const borderClr = theme.colors.border.default;
  const textMuted = theme.colors.text.muted;
  const textPrimary = theme.colors.text.primary;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        flex: "0 0 calc((100% - 3 * (var(--banner-gap))) / 4)",
        maxWidth: "calc((100% - 3 * (var(--banner-gap))) / 4)",
        minWidth: 0,
        position: "relative",
        opacity: disabled ? 0.5 : isDragging ? 0.6 : 1,
        transform: isDragging ? "scale(0.95)" : "scale(1)",
        transition: "opacity 0.15s ease, transform 0.15s ease",
        touchAction: "none",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onClick();
        }}
        disabled={disabled}
        aria-pressed={isActive}
        className="combat-banner focus-visible:outline-none"
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: isMobile ? "0.58" : "0.52",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          touchAction: "manipulation",
        }}
      >
        {/* SVG shield / crest shape */}
        <svg
          viewBox="0 0 100 130"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            filter: isActive
              ? `drop-shadow(0 3px 8px ${styleInfo.color}35) drop-shadow(0 1px 2px rgba(0,0,0,0.6))`
              : "drop-shadow(0 2px 5px rgba(0,0,0,0.5))",
            transition: "filter 0.2s ease",
          }}
        >
          <defs>
            {/* Theme base gradient */}
            <linearGradient id={baseGradId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isActive ? bgLight : bgMid}
                stopOpacity={1}
              />
              <stop
                offset="50%"
                stopColor={isActive ? bgMid : bgDark}
                stopOpacity={1}
              />
              <stop offset="100%" stopColor={bgDark} stopOpacity={1} />
            </linearGradient>
            {/* Color tint overlay for active state */}
            {isActive && (
              <linearGradient id={tintGradId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={styleInfo.color}
                  stopOpacity={0.28}
                />
                <stop
                  offset="55%"
                  stopColor={styleInfo.color}
                  stopOpacity={0.1}
                />
                <stop
                  offset="100%"
                  stopColor={styleInfo.color}
                  stopOpacity={0.03}
                />
              </linearGradient>
            )}
          </defs>

          {/* Outer shadow edge */}
          <path
            d={SHIELD_OUTER}
            fill="none"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={3.5}
          />
          {/* Base fill */}
          <path d={SHIELD_OUTER} fill={`url(#${baseGradId})`} />
          {/* Active color tint overlay */}
          {isActive && <path d={SHIELD_OUTER} fill={`url(#${tintGradId})`} />}
          {/* Border stroke — gold accent inactive, style color active */}
          <path
            d={SHIELD_OUTER}
            fill="none"
            stroke={isActive ? `${styleInfo.color}aa` : `${borderClr}`}
            strokeWidth={isActive ? 1.8 : 1.2}
          />
          {/* Top edge highlight */}
          <line
            x1="10"
            y1="1.2"
            x2="90"
            y2="1.2"
            stroke={isActive ? `${styleInfo.color}44` : `${accentGold}18`}
            strokeWidth={0.8}
            strokeLinecap="round"
          />
          {/* Inner bevel for depth */}
          <path
            d={SHIELD_INNER}
            fill="none"
            stroke={
              isActive ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.025)"
            }
            strokeWidth={0.6}
          />
        </svg>

        {/* Icon protruding from top of shield */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: isMobile ? 28 : 34,
            height: isMobile ? 28 : 34,
            borderRadius: "50%",
            background: isActive
              ? `radial-gradient(circle, ${bgLight} 40%, ${bgMid} 100%)`
              : `radial-gradient(circle, ${bgMid} 40%, ${bgDark} 100%)`,
            border: isActive
              ? `1.5px solid ${styleInfo.color}88`
              : `1px solid ${borderClr}`,
            boxShadow: isActive
              ? `0 2px 6px ${styleInfo.color}30, 0 1px 3px rgba(0,0,0,0.4)`
              : "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          <BannerStyleIcon
            style={styleInfo.id}
            size={isMobile ? 16 : 20}
            color={isActive ? styleInfo.color : accentGold}
            muted={!isActive}
          />
        </div>

        {/* Content overlay */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingTop: isMobile ? "16px" : "20px",
            paddingBottom: isMobile ? "18px" : "22px",
            gap: isMobile ? "2px" : "3px",
          }}
        >
          {/* Style name */}
          <span
            style={{
              fontSize: isMobile ? "8.5px" : "10px",
              fontWeight: 700,
              color: isActive ? textPrimary : textMuted,
              lineHeight: 1.15,
              textAlign: "center",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
              textShadow: isActive
                ? `0 1px 3px rgba(0,0,0,0.7), 0 0 8px ${styleInfo.color}25`
                : "0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            {styleInfo.label}
          </span>

          {/* XP bonus label */}
          <span
            style={{
              fontSize: isMobile ? "8.5px" : "10px",
              fontWeight: 700,
              color: isActive ? styleInfo.color : `${accentGold}88`,
              lineHeight: 1,
              textAlign: "center",
              letterSpacing: "0.05em",
              textShadow: isActive ? `0 0 6px ${styleInfo.color}35` : "none",
            }}
          >
            {shortXp}
          </span>
        </div>
      </button>
    </div>
  );
};

/** Combat stats row with SVG icons - compact */
const CombatStatsRow = React.memo(function CombatStatsRow({
  attackLevel,
  strengthLevel,
  defenseLevel,
  isMobile,
}: {
  attackLevel: number;
  strengthLevel: number;
  defenseLevel: number;
  isMobile: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const stats: Array<{
    key: "attack" | "strength" | "defense";
    value: number;
    color: string;
  }> = [
    { key: "attack", value: attackLevel, color: "#ef4444" },
    { key: "strength", value: strengthLevel, color: "#22c55e" },
    { key: "defense", value: defenseLevel, color: "#3b82f6" },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "2px 0",
      }}
    >
      {stats.map((stat, index) => (
        <React.Fragment key={stat.key}>
          {index > 0 && (
            <div
              style={{
                width: "1px",
                height: "10px",
                background: `${theme.colors.border.default}25`,
              }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <StatIcon
              stat={stat.key}
              size={isMobile ? 11 : 10}
              color={stat.color}
            />
            <span
              style={{
                fontSize: isMobile ? "11px" : "10px",
                color: stat.color,
                fontWeight: 700,
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              {stat.value}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
});

// Event data interfaces for type-safe event handling
interface StyleUpdateEvent {
  playerId: string;
  currentStyle: { id: string };
}

interface TargetChangedEvent {
  targetId: string | null;
  targetName?: string;
  targetHealth?: PlayerHealth;
}

interface TargetHealthEvent {
  targetId: string;
  health: PlayerHealth;
}

interface AutoRetaliateEvent {
  playerId: string;
  enabled: boolean;
}

// Type guards for runtime validation
function isStyleUpdateEvent(data: unknown): data is StyleUpdateEvent {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.playerId === "string" &&
    typeof d.currentStyle === "object" &&
    d.currentStyle !== null &&
    typeof (d.currentStyle as Record<string, unknown>).id === "string"
  );
}

function isTargetChangedEvent(data: unknown): data is TargetChangedEvent {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.targetId === null || typeof d.targetId === "string";
}

function isTargetHealthEvent(data: unknown): data is TargetHealthEvent {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.targetId === "string" &&
    typeof d.health === "object" &&
    d.health !== null
  );
}

function isAutoRetaliateEvent(data: unknown): data is AutoRetaliateEvent {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.playerId === "string" && typeof d.enabled === "boolean";
}

interface CombatPanelProps {
  world: ClientWorld;
  stats: PlayerStats | null;
  equipment: PlayerEquipmentItems | null;
}

// Client-side cache for combat style state (persists across panel opens/closes)
// This enables instant display when reopening panel (RuneScape pattern)
const combatStyleCache = new Map<string, string>();
const autoRetaliateCache = new Map<string, boolean>();
const VALID_WEAPON_TYPES = new Set<string>(Object.values(WeaponType));

export function CombatPanel({ world, stats, equipment }: CombatPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 280, height: 360 });
  // Initialize from cache if available, otherwise default to "accurate"
  // Check order: module cache > network cache > default
  const [style, setStyle] = useState<string>(() => {
    const playerId = world.entities?.player?.id;
    // 1. Check module cache (for instant display on panel reopen)
    if (playerId && combatStyleCache.has(playerId)) {
      return combatStyleCache.get(playerId)!;
    }
    // 2. Check network cache (for fresh page loads - packet arrived before UI mounted)
    const networkCache =
      world.network?.lastAttackStyleByPlayerId?.[playerId || ""];
    if (networkCache?.currentStyle?.id) {
      // Also update module cache for future panel reopens
      if (playerId) {
        combatStyleCache.set(playerId, networkCache.currentStyle.id);
      }
      return networkCache.currentStyle.id;
    }
    return "accurate";
  });
  const [cooldown, setCooldown] = useState<number>(0);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [targetHealth, setTargetHealth] = useState<PlayerHealth | null>(null);
  // Auto-retaliate state (OSRS default is ON)
  const [autoRetaliate, setAutoRetaliate] = useState<boolean>(() => {
    const player = world.entities?.player;
    const playerId = player?.id;
    // First check cache (for instant display on panel reopen)
    if (playerId && autoRetaliateCache.has(playerId)) {
      return autoRetaliateCache.get(playerId)!;
    }
    // Read directly from player entity (set from server data during entity creation)
    const playerCombat = (player as { combat?: { autoRetaliate?: boolean } })
      ?.combat;
    if (typeof playerCombat?.autoRetaliate === "boolean") {
      return playerCombat.autoRetaliate;
    }
    return true; // OSRS default: ON
  });
  const playerId = world.entities?.player?.id ?? null;
  const previousPlayerIdRef = useRef<string | null>(null);

  // Calculate combat level using OSRS formula (melee-only MVP)
  const combatLevel = stats?.skills
    ? (() => {
        const s = stats.skills;
        const base =
          0.25 * ((s.defense?.level || 1) + (s.constitution?.level || 10));
        const melee =
          0.325 * ((s.attack?.level || 1) + (s.strength?.level || 1));
        return Math.floor(base + melee);
      })()
    : 1;
  const inCombat = stats?.inCombat || false;
  const health = stats?.health || { current: 100, max: 100 };
  const attackLevel = stats?.skills?.attack?.level || 1;
  const strengthLevel = stats?.skills?.strength?.level || 1;
  const defenseLevel = stats?.skills?.defense?.level || 1;

  useEffect(() => {
    if (!playerId) return;

    // Immediately sync from network cache (handles fresh page loads)
    // The packet may have arrived before this component mounted
    const networkCache = world.network?.lastAttackStyleByPlayerId?.[playerId];
    if (networkCache?.currentStyle?.id) {
      combatStyleCache.set(playerId, networkCache.currentStyle.id);
      setStyle(networkCache.currentStyle.id);
    }

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        getAttackStyleInfo?: (
          id: string,
          cb: (info: { style: string; cooldown?: number }) => void,
        ) => void;
        changeAttackStyle?: (id: string, style: string) => void;
        getAutoRetaliate?: (id: string, cb: (enabled: boolean) => void) => void;
        setAutoRetaliate?: (id: string, enabled: boolean) => void;
      };
    } | null;

    actions?.actionMethods?.getAttackStyleInfo?.(
      playerId,
      (info: { style: string; cooldown?: number }) => {
        if (info) {
          // Update cache for instant display on panel reopen
          combatStyleCache.set(playerId, info.style);
          setStyle(info.style);
          setCooldown(info.cooldown || 0);
        }
      },
    );

    // Initialize auto-retaliate state from server
    actions?.actionMethods?.getAutoRetaliate?.(playerId, (enabled: boolean) => {
      autoRetaliateCache.set(playerId, enabled);
      setAutoRetaliate(enabled);
    });

    const onUpdate = (data: unknown) => {
      if (!isStyleUpdateEvent(data)) return;
      if (data.playerId !== playerId) return;
      // Update cache for instant display on panel reopen
      combatStyleCache.set(playerId, data.currentStyle.id);
      setStyle(data.currentStyle.id);
    };
    const onChanged = (data: unknown) => {
      if (!isStyleUpdateEvent(data)) return;
      if (data.playerId !== playerId) return;
      // Update cache for instant display on panel reopen
      combatStyleCache.set(playerId, data.currentStyle.id);
      setStyle(data.currentStyle.id);
    };

    // Listen for combat target updates
    const onTargetChanged = (data: unknown) => {
      if (!isTargetChangedEvent(data)) return;
      if (data.targetId) {
        setTargetName(data.targetName || data.targetId);
        setTargetHealth(data.targetHealth || null);
      } else {
        setTargetName(null);
        setTargetHealth(null);
      }
    };

    const onTargetHealthUpdate = (data: unknown) => {
      if (!isTargetHealthEvent(data)) return;
      if (data.targetId && targetName) {
        setTargetHealth(data.health);
      }
    };

    // Listen for auto-retaliate changes from server
    const onAutoRetaliateChanged = (data: unknown) => {
      if (!isAutoRetaliateEvent(data)) return;
      if (data.playerId !== playerId) return;
      autoRetaliateCache.set(playerId, data.enabled);
      setAutoRetaliate(data.enabled);
    };

    world.on(EventType.UI_ATTACK_STYLE_UPDATE, onUpdate, undefined);
    world.on(EventType.UI_ATTACK_STYLE_CHANGED, onChanged, undefined);
    world.on(
      EventType.UI_AUTO_RETALIATE_CHANGED,
      onAutoRetaliateChanged,
      undefined,
    );
    world.on(EventType.UI_COMBAT_TARGET_CHANGED, onTargetChanged, undefined);
    world.on(
      EventType.UI_COMBAT_TARGET_HEALTH,
      onTargetHealthUpdate,
      undefined,
    );

    return () => {
      world.off(
        EventType.UI_ATTACK_STYLE_UPDATE,
        onUpdate,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_ATTACK_STYLE_CHANGED,
        onChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_AUTO_RETALIATE_CHANGED,
        onAutoRetaliateChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_COMBAT_TARGET_CHANGED,
        onTargetChanged,
        undefined,
        undefined,
      );
      world.off(
        EventType.UI_COMBAT_TARGET_HEALTH,
        onTargetHealthUpdate,
        undefined,
        undefined,
      );
    };
  }, [playerId, targetName, world]);

  useEffect(() => {
    const previousPlayerId = previousPlayerIdRef.current;
    if (previousPlayerId && previousPlayerId !== playerId) {
      combatStyleCache.delete(previousPlayerId);
      autoRetaliateCache.delete(previousPlayerId);
    }
    previousPlayerIdRef.current = playerId;
  }, [playerId]);

  const changeStyle = (next: string) => {
    const playerId = world.entities?.player?.id;
    if (!playerId) return;

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        changeAttackStyle?: (id: string, style: string) => void;
      };
    } | null;

    if (!actions?.actionMethods?.changeAttackStyle) return;

    // Optimistic: update UI instantly (OSRS has zero visible delay)
    combatStyleCache.set(playerId, next);
    setStyle(next);

    // Send to server — server confirms via attackStyleChanged packet,
    // which will overwrite our optimistic value with the authoritative one
    actions.actionMethods.changeAttackStyle(playerId, next);

    // OSRS-accurate: selecting autocast opens the spells panel for spell selection
    if (next === "autocast") {
      const store = useWindowStore.getState();
      const windows = Array.from(store.windows.values());
      const existing = windows.find((w) =>
        w.tabs.some((t) => t.content === "spells"),
      );
      if (existing) {
        const tabIndex = existing.tabs.findIndex((t) => t.content === "spells");
        if (tabIndex >= 0) {
          store.updateWindow(existing.id, {
            activeTabIndex: tabIndex,
            visible: true,
          });
          store.bringToFront(existing.id);
        }
      } else {
        store.createWindow({
          id: `panel-spells-${Date.now()}`,
          position: {
            x: Math.max(100, window.innerWidth / 2 - 200),
            y: Math.max(100, window.innerHeight / 2 - 150),
          },
          size: { width: 400, height: 350 },
          minSize: { width: 250, height: 200 },
          tabs: [
            {
              id: "spells",
              label: "Spells",
              content: "spells",
              closeable: true,
            },
          ],
        });
      }
    }
  };

  const toggleAutoRetaliate = () => {
    const playerId = world.entities?.player?.id;
    if (!playerId) return;

    const actions = world.getSystem("actions") as {
      actionMethods?: {
        setAutoRetaliate?: (id: string, enabled: boolean) => void;
      };
    } | null;

    if (!actions?.actionMethods?.setAutoRetaliate) return;

    const newValue = !autoRetaliate;

    // Optimistic: update UI instantly (OSRS has zero visible delay)
    autoRetaliateCache.set(playerId, newValue);
    setAutoRetaliate(newValue);

    // Send to server — server confirms via autoRetaliateChanged packet,
    // which will overwrite our optimistic value with the authoritative one
    actions.actionMethods.setAutoRetaliate(playerId, newValue);
  };

  // All possible combat styles with their XP training info and colors
  // Includes melee, ranged, and magic styles (OSRS-accurate)
  const allStyles: Array<{
    id: string;
    label: string;
    xp: string;
    color: string;
  }> = [
    // Melee styles
    {
      id: "accurate",
      label: "Accurate",
      xp: "Attack",
      color: "#ef4444",
    },
    {
      id: "aggressive",
      label: "Aggressive",
      xp: "Strength",
      color: "#22c55e",
    },
    {
      id: "defensive",
      label: "Defensive",
      xp: "Defense",
      color: "#3b82f6",
    },
    {
      id: "controlled",
      label: "Controlled",
      xp: "All",
      color: "#a855f7",
    },
    // Ranged styles
    {
      id: "rapid",
      label: "Rapid",
      xp: "Ranged",
      color: "#f59e0b",
    },
    {
      id: "longrange",
      label: "Longrange",
      xp: "Rng+Def",
      color: "#06b6d4",
    },
    // Magic styles
    {
      id: "autocast",
      label: "Autocast",
      xp: "Magic",
      color: "#8b5cf6",
    },
  ];

  // Filter styles based on equipped weapon (OSRS-accurate restrictions)
  const styles = useMemo(() => {
    const normalizedWeaponType = equipment?.weapon?.weaponType?.toLowerCase();
    const weaponType = normalizedWeaponType
      ? VALID_WEAPON_TYPES.has(normalizedWeaponType)
        ? (normalizedWeaponType as WeaponType)
        : WeaponType.NONE
      : WeaponType.NONE;
    const availableStyleIds = getAvailableStyles(weaponType);
    return allStyles.filter((s) =>
      (availableStyleIds as readonly string[]).includes(s.id),
    );
  }, [equipment?.weapon?.weaponType]);

  const healthPercent = Math.round((health.current / health.max) * 100);
  const targetHealthPercent = targetHealth
    ? Math.round((targetHealth.current / targetHealth.max) * 100)
    : 0;

  useEffect(() => {
    const element = panelRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      setPanelSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Responsive padding/sizing — built from shared panelLayout constants
  // compact = mobile or small panel; outer/inner/gap scale accordingly
  const compactPanel =
    shouldUseMobileUI || panelSize.height < 330 || panelSize.width < 250;
  const ultraCompactPanel = panelSize.height < 290 || panelSize.width < 220;
  const p = compactPanel
    ? {
        outer: PANEL_MOBILE_PADDING,
        inner: PANEL_PADDING,
        gap: PANEL_MOBILE_PADDING,
      }
    : { outer: PANEL_PADDING, inner: PANEL_PADDING + 2, gap: PANEL_GRID_GAP };
  // ultraCompactPanel is available for future use if needed (currently unused)
  void ultraCompactPanel;
  return (
    <div
      ref={panelRef}
      className="flex flex-col h-full overflow-hidden"
      style={{
        ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
        padding: `${p.outer}px`,
        gap: `${p.gap}px`,
      }}
    >
      {/* Inline CSS animations */}
      <style>{`
        @keyframes combat-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .combat-pulse { animation: combat-pulse 1.5s ease-in-out infinite; }
        .combat-banner { transition: transform 0.15s ease, filter 0.15s ease; }
        .combat-banner:hover:not(:disabled) { transform: translateY(-2px) scale(1.03); filter: brightness(1.15) contrast(1.05); }
        .combat-banner:active:not(:disabled) { transform: translateY(0) scale(0.98); filter: brightness(0.9); }
      `}</style>

      {/* Attack Styles — Banner Grid (top) */}
      <div
        style={{
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: 4,
            padding: `${p.inner}px`,
          }),
          display: "flex",
          flexDirection: "column",
          overflow: "visible",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: compactPanel ? 6 : 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "9px",
              lineHeight: 1,
              color: theme.colors.text.muted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}
          >
            Combat Styles
          </span>
          {style === "autocast" && (
            <span
              style={{
                padding: "2px 5px",
                borderRadius: 4,
                background: "#8b5cf618",
                border: "1px solid #8b5cf633",
                fontSize: "8px",
                fontWeight: 700,
                color: "#c4b5fd",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Autocast
            </span>
          )}
        </div>
        <div
          style={
            {
              display: "flex",
              gap: compactPanel ? "4px" : "6px",
              width: "100%",
              marginTop: compactPanel ? 14 : 17,
              justifyContent: "center",
              "--banner-gap": compactPanel ? "4px" : "6px",
            } as React.CSSProperties
          }
        >
          {styles.map((s) => (
            <CombatStyleBanner
              key={s.id}
              style={s}
              isActive={style === s.id}
              disabled={cooldown > 0}
              isMobile={compactPanel}
              onClick={() => changeStyle(s.id)}
              theme={theme}
            />
          ))}
        </div>

        {cooldown > 0 && (
          <div
            style={{
              textAlign: "center",
              fontSize: "9px",
              color: theme.colors.state.warning,
              background: `${theme.colors.state.warning}10`,
              padding: "2px 5px",
              borderRadius: 4,
              border: `1px solid ${theme.colors.state.warning}25`,
              marginTop: compactPanel ? 4 : 6,
            }}
          >
            Style change in {Math.ceil(cooldown / 1000)}s
          </div>
        )}

        {/* HP + Combat Level */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: `${p.inner}px`,
            marginTop: compactPanel ? 16 : 22,
            background:
              theme.name === "hyperia"
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.12) 100%)"
                : theme.colors.slot.filled,
            border: inCombat
              ? `1px solid ${theme.colors.state.danger}50`
              : `1px solid ${theme.colors.border.default}35`,
            borderRadius: 4,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="#ef4444">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          {/* HP bar inline */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: "100%",
                height: "5px",
                background: theme.colors.background.panelPrimary,
                borderRadius: 3,
                overflow: "hidden",
                border: `1px solid ${theme.colors.border.default}30`,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${healthPercent}%`,
                  borderRadius: 3,
                  transition: "width 0.2s ease",
                  background: "linear-gradient(180deg, #f87171, #dc2626)",
                }}
              />
            </div>
          </div>
          <span
            style={{
              fontSize: "11px",
              color: theme.colors.text.primary,
              fontWeight: 700,
              fontFamily: "var(--font-mono, monospace)",
              whiteSpace: "nowrap",
            }}
          >
            {health.current}/{health.max}
          </span>
          {inCombat && (
            <span
              className="combat-pulse"
              style={{
                fontSize: "9px",
                color: theme.colors.state.danger,
                fontWeight: 600,
              }}
            >
              ⚔
            </span>
          )}
          <span
            style={{
              borderLeft: `1px solid ${theme.colors.border.default}25`,
              paddingLeft: "6px",
              fontSize: "10px",
              color: theme.colors.text.muted,
              whiteSpace: "nowrap",
            }}
          >
            Lvl{" "}
            <span
              style={{
                color: "#f59e0b",
                fontWeight: 700,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "12px",
              }}
            >
              {combatLevel}
            </span>
          </span>
        </div>

        {/* Target health — only when in combat */}
        {targetName && targetHealth && !ultraCompactPanel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: `${p.inner - 1}px ${p.inner}px`,
              marginTop: compactPanel ? 3 : 4,
              background: `${theme.colors.state.danger}08`,
              border: `1px solid ${theme.colors.state.danger}30`,
              borderRadius: 4,
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: theme.colors.state.danger,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "80px",
              }}
            >
              🎯 {targetName}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: theme.colors.background.panelPrimary,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${targetHealthPercent}%`,
                    borderRadius: 2,
                    background: "linear-gradient(180deg, #f87171, #dc2626)",
                  }}
                />
              </div>
            </div>
            <span
              style={{
                fontSize: "10px",
                color: theme.colors.state.danger,
                fontWeight: 700,
                fontFamily: "var(--font-mono, monospace)",
                whiteSpace: "nowrap",
              }}
            >
              {targetHealth.current}/{targetHealth.max}
            </span>
          </div>
        )}

        {/* Stats Row */}
        <CombatStatsRow
          attackLevel={attackLevel}
          strengthLevel={strengthLevel}
          defenseLevel={defenseLevel}
          isMobile={shouldUseMobileUI}
        />
      </div>

      {/* Spacer to push auto-retaliate to bottom */}
      <div style={{ flex: 1 }} />

      {/* Auto Retaliate — pinned to bottom */}
      <button
        onClick={toggleAutoRetaliate}
        aria-pressed={autoRetaliate}
        className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/50"
        style={{
          padding: `${PANEL_PADDING}px 6px`,
          cursor: "pointer",
          transition: "all 0.1s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          touchAction: "manipulation",
          borderRadius: 4,
          ...getInteractiveTileStyle(theme, {
            active: autoRetaliate,
            radius: 4,
            accentColor: autoRetaliate
              ? theme.colors.state.success
              : theme.colors.accent.secondary,
          }),
          color: autoRetaliate
            ? theme.colors.state.success
            : theme.colors.text.muted,
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke={autoRetaliate ? "#22c55e" : theme.colors.text.muted}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {autoRetaliate ? (
              <>
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </>
            )}
          </svg>
          <span
            style={{
              fontWeight: 600,
              color: theme.colors.text.primary,
              fontSize: "10px",
              lineHeight: 1,
            }}
          >
            Auto-retaliate
          </span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "1px",
            padding: "1px",
            borderRadius: "4px",
            fontSize: "9px",
            fontWeight: 700,
            background: "rgba(0,0,0,0.18)",
            border: `1px solid ${theme.colors.border.default}30`,
          }}
        >
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "3px",
              background: autoRetaliate
                ? "rgba(34, 197, 94, 0.18)"
                : "transparent",
              color: autoRetaliate ? "#22c55e" : theme.colors.text.muted,
            }}
          >
            On
          </span>
          <span
            style={{
              padding: "2px 6px",
              borderRadius: "3px",
              background: !autoRetaliate
                ? "rgba(239, 68, 68, 0.12)"
                : "transparent",
              color: !autoRetaliate ? "#ef4444" : theme.colors.text.muted,
            }}
          >
            Off
          </span>
        </span>
      </button>
    </div>
  );
}
