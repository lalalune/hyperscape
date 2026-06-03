/**
 * Skill Guide Panel
 * OSRS-style popup showing skill unlocks at each level
 *
 * Uses ModalWindow for consistent styling and behavior.
 */

import React, { useMemo } from "react";
import { ModalWindow, useThemeStore } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import type { SkillUnlock } from "@hyperforge/shared";
import type { CSSProperties } from "react";

interface SkillGuidePanelProps {
  visible: boolean;
  skillLabel: string;
  skillIcon: string;
  playerLevel: number;
  unlocks: readonly SkillUnlock[];
  isLoading: boolean;
  onClose: () => void;
}

interface UnlockRowProps {
  unlock: SkillUnlock;
  isUnlocked: boolean;
  isNext: boolean;
}

function UnlockRow({ unlock, isUnlocked, isNext }: UnlockRowProps) {
  const theme = useThemeStore((s) => s.theme);

  const rowStyle: CSSProperties = useMemo(() => {
    if (isUnlocked) {
      return {
        background: `${theme.colors.state.success}15`,
        border: `1px solid ${theme.colors.state.success}50`,
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        opacity: 1,
      };
    }
    if (isNext) {
      return {
        background: `${theme.colors.state.warning}25`,
        border: `1px solid ${theme.colors.state.warning}80`,
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        opacity: 1,
      };
    }
    return {
      background:
        theme.name === "hyperia"
          ? "linear-gradient(180deg, rgba(255, 255, 255, 0.025) 0%, rgba(0, 0, 0, 0.08) 100%)"
          : theme.colors.background.panelSecondary,
      border: `1px solid ${theme.colors.border.default}2a`,
      opacity: 0.6,
    };
  }, [isUnlocked, isNext, theme]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.borderRadius.md,
        transition: `all ${theme.transitions.fast}`,
        ...rowStyle,
      }}
    >
      {/* Status Icon */}
      <span
        style={{
          color: isUnlocked
            ? theme.colors.state.success
            : isNext
              ? theme.colors.state.warning
              : theme.colors.text.muted,
          fontSize: theme.typography.fontSize.sm,
          width: 16,
          textAlign: "center",
        }}
      >
        {isUnlocked ? "✓" : isNext ? "➤" : "🔒"}
      </span>

      {/* Level Badge */}
      <span
        style={{
          width: 48,
          textAlign: "center",
          fontSize: theme.typography.fontSize.xs,
          fontWeight: theme.typography.fontWeight.bold,
          color: isUnlocked
            ? theme.colors.accent.primary
            : isNext
              ? theme.colors.state.warning
              : theme.colors.text.muted,
        }}
      >
        Lvl {unlock.level}
      </span>

      {/* Description */}
      <span
        style={{
          flex: 1,
          fontSize: theme.typography.fontSize.xs,
          color: isUnlocked
            ? theme.colors.text.primary
            : isNext
              ? theme.colors.text.secondary
              : theme.colors.text.muted,
        }}
      >
        {unlock.description}
      </span>

      {/* Next Badge */}
      {isNext && (
        <span
          style={{
            fontSize: 9,
            padding: "2px 4px",
            borderRadius: theme.borderRadius.sm,
            background: `${theme.colors.state.warning}40`,
            color: theme.colors.text.primary,
            fontWeight: theme.typography.fontWeight.bold,
          }}
        >
          NEXT
        </span>
      )}

      {/* Type Badge */}
      <span
        style={{
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: theme.borderRadius.sm,
          background:
            unlock.type === "item"
              ? `${theme.colors.state.info}40`
              : `${theme.colors.accent.secondary}40`,
          color:
            unlock.type === "item"
              ? theme.colors.state.info
              : theme.colors.accent.secondary,
        }}
      >
        {unlock.type}
      </span>
    </div>
  );
}

export function SkillGuidePanel({
  visible,
  skillLabel,
  skillIcon,
  playerLevel,
  unlocks,
  isLoading,
  onClose,
}: SkillGuidePanelProps) {
  const theme = useThemeStore((s) => s.theme);

  const sortedUnlocks = useMemo(
    () => [...unlocks].sort((a, b) => a.level - b.level),
    [unlocks],
  );

  const unlockedCount = useMemo(
    () => unlocks.filter((u) => u.level <= playerLevel).length,
    [unlocks, playerLevel],
  );

  // Find the next unlock (first one above player's level)
  const nextUnlock = useMemo(
    () => sortedUnlocks.find((u) => u.level > playerLevel),
    [sortedUnlocks, playerLevel],
  );

  const levelsToNext = nextUnlock ? nextUnlock.level - playerLevel : 0;

  return (
    <ModalWindow
      visible={visible}
      onClose={onClose}
      title={`${skillIcon} ${skillLabel} Guide`}
      width={400}
      maxHeight="500px"
    >
      <div
        style={{
          ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Current Level */}
        <div
          style={{
            padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.secondary,
            borderBottom: `1px solid ${theme.colors.border.default}40`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            Your Level:{" "}
            <span
              style={{
                color: theme.colors.accent.primary,
                fontWeight: theme.typography.fontWeight.bold,
              }}
            >
              {playerLevel}
            </span>
          </span>
          <span style={{ fontSize: 11, color: theme.colors.text.muted }}>
            {unlockedCount}/{unlocks.length} unlocked
          </span>
        </div>

        {/* Next Unlock Info */}
        {nextUnlock && (
          <div
            style={{
              padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
              fontSize: 11,
              background: `${theme.colors.state.warning}12`,
              borderBottom: `1px solid ${theme.colors.border.default}40`,
              color: theme.colors.state.warning,
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.xs,
            }}
          >
            <span>➤</span>
            <span>
              {levelsToNext} more level{levelsToNext !== 1 ? "s" : ""} to
              unlock:{" "}
              <span style={{ color: theme.colors.text.secondary }}>
                {nextUnlock.description}
              </span>
            </span>
          </div>
        )}

        {/* Unlocks List */}
        <div
          style={{
            maxHeight: 320,
            overflowY: "auto",
            padding: theme.spacing.sm,
            display: "flex",
            flexDirection: "column",
            gap: theme.spacing.xs,
            background:
              theme.name === "hyperia"
                ? "linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0%, rgba(0, 0, 0, 0.12) 100%)"
                : "transparent",
          }}
        >
          {isLoading ? (
            <div
              style={{
                textAlign: "center",
                color: theme.colors.text.secondary,
                padding: theme.spacing.xl,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 20,
                  border: `2px solid ${theme.colors.border.default}`,
                  borderTopColor: theme.colors.accent.primary,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <div style={{ marginTop: theme.spacing.sm }}>
                Loading unlocks...
              </div>
            </div>
          ) : sortedUnlocks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: theme.colors.text.muted,
                padding: theme.spacing.lg,
                fontSize: theme.typography.fontSize.xs,
              }}
            >
              No unlock data available for this skill.
            </div>
          ) : (
            sortedUnlocks.map((unlock, idx) => (
              <UnlockRow
                key={idx}
                unlock={unlock}
                isUnlocked={playerLevel >= unlock.level}
                isNext={nextUnlock?.level === unlock.level}
              />
            ))
          )}
        </div>
      </div>
    </ModalWindow>
  );
}
