/**
 * Combat Style SVG Icons
 *
 * Contains all SVG icon components used in the combat panel:
 * - StyleIcon: Outline icons for general use
 * - StatIcon: Compact stat icons (attack/strength/defense)
 * - BannerStyleIcon: Filled heraldic-style icons for combat banners
 * - SHIELD_OUTER / SHIELD_INNER: SVG paths for shield crest shapes
 */

import React from "react";

/** SVG outline icons for attack styles */
export const StyleIcon = ({
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

/** Stat icons as SVG for attack/strength/defense */
export const StatIcon = ({
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

/** Filled game-style icons for combat banners -- bold, solid fills for fantasy UI */
export const BannerStyleIcon = ({
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

/** Shield/crest SVG paths for combat banners */
export const SHIELD_OUTER =
  "M 5 0 L 95 0 Q 100 0 100 5 L 100 82 Q 100 102 50 128 Q 0 102 0 82 L 0 5 Q 0 0 5 0 Z";
export const SHIELD_INNER =
  "M 8 3 L 92 3 Q 97 3 97 7 L 97 80 Q 97 99 50 123 Q 3 99 3 80 L 3 7 Q 3 3 8 3 Z";

/** Short XP labels for compact banner display */
export const XP_SHORT_LABELS: Record<string, string> = {
  Attack: "+ATK",
  Strength: "+STR",
  Defense: "+DEF",
  All: "+ALL",
  Ranged: "+RNG",
  "Rng+Def": "+R/D",
  Magic: "+MAG",
};
