/**
 * UnlocksSection - Displays what content is unlocked at a skill level
 *
 * Shows OSRS-style unlock information in the level-up popup:
 * - New items that can be equipped/used
 * - New abilities unlocked
 * - New areas accessible
 * - New activities available
 *
 * Uses theme system for consistent styling.
 */

import { useThemeStore } from "@/ui";
import { getUnlocksAtLevel } from "@hyperforge/shared";
import type { SkillUnlock, UnlockType } from "@hyperforge/shared";
import type { CSSProperties } from "react";

// === ICONS FOR UNLOCK TYPES ===

const UNLOCK_TYPE_ICONS: Record<UnlockType, string> = {
  item: "📦",
  ability: "⚡",
  area: "🗺️",
  quest: "📜",
  activity: "🎯",
};

// === COMPONENT ===

interface UnlocksSectionProps {
  skill: string;
  level: number;
  /** Optional accent color override (defaults to theme accent) */
  accentColor?: string;
}

export function UnlocksSection({
  skill,
  level,
  accentColor,
}: UnlocksSectionProps) {
  const theme = useThemeStore((s) => s.theme);
  const unlocks = getUnlocksAtLevel(skill, level);

  // Don't render if no unlocks at this level
  if (unlocks.length === 0) {
    return null;
  }

  const accent = accentColor || theme.colors.accent.primary;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${accent}40`,
    width: "100%",
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.xs,
    color: `${accent}cc`,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: theme.spacing.xs,
  };

  const listStyle: CSSProperties = {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing.xs,
    width: "100%",
  };

  const itemStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.primary,
    background: theme.colors.background.tertiary,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    borderRadius: theme.borderRadius.sm,
    borderLeft: `3px solid ${theme.colors.state.info}`,
  };

  const iconStyle: CSSProperties = {
    fontSize: theme.typography.fontSize.base,
  };

  const textStyle: CSSProperties = {
    flex: 1,
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>New Unlocks</div>
      <ul style={listStyle}>
        {unlocks.map((unlock: SkillUnlock, index: number) => (
          <li key={`${unlock.level}-${index}`} style={itemStyle}>
            <span style={iconStyle}>{UNLOCK_TYPE_ICONS[unlock.type]}</span>
            <span style={textStyle}>{unlock.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
