/**
 * Skills Panel
 * Hyperscape-themed skills interface (Prayer is now in separate PrayerPanel)
 * Uses project theme colors (gold #f2d08a, brown borders)
 * Supports drag-drop to action bar
 * Uses shared SKILL_DEFINITIONS for data-driven skill display
 */

import React, { useState, useRef, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import {
  calculateCursorTooltipPosition,
  useThemeStore,
  useMobileLayout,
} from "@/ui";
import { zIndex, MOBILE_SKILLS } from "../../constants";
import { useTooltipSize } from "../../hooks";
import type { PlayerStats, Skills } from "../../types";
import { SKILL_DEFINITIONS, type SkillDefinition } from "@hyperscape/shared";

interface SkillsPanelProps {
  stats: PlayerStats | null;
}

interface Skill {
  key: string;
  label: string;
  icon: string;
  level: number;
  xp: number;
}

function calculateXPForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(total / 4);
}

/** Calculate combat level from skill stats */
function calculateCombatLevel(stats: Partial<Skills>): number {
  const attack = stats.attack?.level ?? 1;
  const strength = stats.strength?.level ?? 1;
  const defense = stats.defense?.level ?? 1;
  const constitution = stats.constitution?.level ?? 10;
  return Math.floor(
    0.25 * (defense + constitution) + 0.325 * (attack + strength),
  );
}

/** Draggable skill card component for action bar drag-drop */
// Memoized to prevent re-renders of all skill cards when any changes
const DraggableSkillCard = memo(function DraggableSkillCard({
  skill,
  isHovered,
  isMobile,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: {
  skill: Skill;
  isHovered: boolean;
  isMobile: boolean;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  // Make skill draggable for action bar
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `skill-${skill.key}`,
    data: {
      skill: {
        id: skill.key,
        name: skill.label,
        icon: skill.icon,
        level: skill.level,
      },
      source: "skill",
    },
  });

  // Memoize card style to prevent recreation on every render - compact styling
  const cardStyle = useMemo(
    (): React.CSSProperties => ({
      background: isHovered
        ? theme.colors.slot.hover
        : theme.colors.slot.filled,
      border: `1px solid ${isHovered ? `${theme.colors.border.hover}50` : `${theme.colors.border.default}30`}`,
      borderRadius: "3px",
      padding: isMobile ? "4px 6px" : "3px 6px",
      minHeight: isMobile ? MOBILE_SKILLS.cardHeight : 28,
      cursor: isDragging ? "grabbing" : "grab",
      transition: "all 0.1s ease",
      display: "flex",
      alignItems: "center",
      flexDirection: "row" as const,
      touchAction: "none",
      opacity: isDragging ? 0.5 : 1,
    }),
    [isHovered, isDragging, theme, isMobile],
  );

  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={cardStyle}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...attributes}
      {...listeners}
    >
      {/* Unified layout: Icon + Level inline - compact but readable */}
      <div className="flex items-center justify-center gap-1 w-full">
        <span
          style={{
            fontSize: isMobile ? "14px" : "13px",
            filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.4))",
            lineHeight: 1,
          }}
        >
          {skill.icon}
        </span>
        {/* RuneScape-style slanted level display: current↗/↘base */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            height: "16px",
          }}
        >
          {/* Current level - shifted up */}
          <span
            style={{
              fontSize: isMobile ? "11px" : "10px",
              fontWeight: 700,
              color:
                skill.level >= 99
                  ? theme.colors.state.success
                  : theme.colors.text.accent,
              lineHeight: 1,
              position: "relative",
              top: "-2px",
              textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
            }}
          >
            {skill.level}
          </span>
          {/* Slanted separator */}
          <span
            style={{
              fontSize: isMobile ? "10px" : "9px",
              fontWeight: 400,
              color: theme.colors.text.disabled,
              lineHeight: 1,
              margin: "0 1px",
              transform: "rotate(-20deg)",
              display: "inline-block",
            }}
          >
            /
          </span>
          {/* Base level - shifted down */}
          <span
            style={{
              fontSize: isMobile ? "11px" : "10px",
              fontWeight: 700,
              color:
                skill.level >= 99
                  ? theme.colors.state.success
                  : theme.colors.text.accent,
              lineHeight: 1,
              position: "relative",
              top: "2px",
              textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
            }}
          >
            {skill.level}
          </span>
        </div>
      </div>
    </div>
  );
});

export function SkillsPanel({ stats }: SkillsPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  const { shouldUseMobileUI } = useMobileLayout();
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const skillTooltipRef = useRef<HTMLDivElement>(null);

  const skillTooltipSize = useTooltipSize(hoveredSkill, skillTooltipRef, {
    width: 180,
    height: 90,
  });

  const s: Partial<Skills> = stats?.skills ?? {};

  // Build skills array from shared SKILL_DEFINITIONS
  // This ensures all skills including Agility are displayed and metadata stays in sync
  const skills: Skill[] = SKILL_DEFINITIONS.map((def: SkillDefinition) => {
    const skillData = s[def.key];
    return {
      key: def.key,
      label: def.label,
      icon: def.icon,
      level: skillData?.level ?? def.defaultLevel,
      xp: skillData?.xp ?? 0,
    };
  });

  const totalLevel = skills.reduce((sum, skill) => sum + skill.level, 0);
  const combatLevel = calculateCombatLevel(s);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ padding: shouldUseMobileUI ? "4px" : "3px" }}
    >
      {/* Content */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        style={{
          background: "transparent",
          padding: shouldUseMobileUI ? "4px" : "3px",
        }}
      >
        {/* Skills Grid - Mobile: 2 columns with names, Desktop: 3 columns compact */}
        <div
          className="grid flex-1"
          style={{
            gridTemplateColumns: shouldUseMobileUI
              ? `repeat(${MOBILE_SKILLS.columns}, 1fr)`
              : "repeat(3, 1fr)",
            gap: shouldUseMobileUI ? `${MOBILE_SKILLS.gap}px` : "3px",
          }}
        >
          {skills.map((skill) => (
            <DraggableSkillCard
              key={skill.key}
              skill={skill}
              isHovered={hoveredSkill?.key === skill.key}
              isMobile={shouldUseMobileUI}
              onMouseEnter={(e) => {
                setHoveredSkill(skill);
                setMousePos({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => {
                setHoveredSkill(null);
              }}
            />
          ))}
        </div>

        {/* Total Level & Combat Level - Compact */}
        <div
          className="flex justify-between"
          style={{
            marginTop: shouldUseMobileUI ? "4px" : "3px",
            background: theme.colors.slot.filled,
            border: `1px solid ${theme.colors.border.default}30`,
            borderRadius: "3px",
            padding: shouldUseMobileUI ? "6px 8px" : "4px 6px",
            flexShrink: 0,
          }}
        >
          <div className="text-center flex-1">
            <div
              style={{
                fontSize: shouldUseMobileUI ? "8px" : "7px",
                color: theme.colors.text.muted,
                textTransform: "uppercase",
                letterSpacing: "0.3px",
                marginBottom: "1px",
              }}
            >
              Total Level
            </div>
            <span
              style={{
                fontSize: shouldUseMobileUI ? "14px" : "12px",
                fontWeight: 600,
                color: theme.colors.text.accent,
              }}
            >
              {totalLevel}
            </span>
          </div>
          <div
            style={{
              width: "1px",
              background: `${theme.colors.border.default}30`,
              margin: "0 4px",
            }}
          />
          <div className="text-center flex-1">
            <div
              style={{
                fontSize: shouldUseMobileUI ? "8px" : "7px",
                color: theme.colors.text.muted,
                textTransform: "uppercase",
                letterSpacing: "0.3px",
                marginBottom: "1px",
              }}
            >
              Combat Level
            </div>
            <span
              style={{
                fontSize: shouldUseMobileUI ? "14px" : "12px",
                fontWeight: 600,
                color: theme.colors.state.danger,
              }}
            >
              {combatLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Skill Tooltip */}
      {hoveredSkill &&
        createPortal(
          (() => {
            const currentLevelXP = calculateXPForLevel(hoveredSkill.level);
            const nextLevelXP = calculateXPForLevel(hoveredSkill.level + 1);
            const xpRemaining = nextLevelXP - hoveredSkill.xp;
            const xpIntoLevel = hoveredSkill.xp - currentLevelXP;
            const xpForThisLevel = nextLevelXP - currentLevelXP;
            const progress = Math.min(
              100,
              Math.max(0, (xpIntoLevel / xpForThisLevel) * 100),
            );

            const tooltipSize = {
              width: skillTooltipSize.width || 180,
              height: skillTooltipSize.height || 90,
            };
            const { left, top } = calculateCursorTooltipPosition(
              mousePos,
              tooltipSize,
            );

            return (
              <div
                ref={skillTooltipRef}
                className="fixed pointer-events-none"
                style={{
                  left,
                  top,
                  zIndex: zIndex.tooltip,
                  background: theme.colors.slot.filled,
                  border: `1px solid ${theme.colors.border.default}40`,
                  borderRadius: "3px",
                  padding: "6px 8px",
                  minWidth: "140px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ fontSize: "14px" }}>{hoveredSkill.icon}</span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: theme.colors.text.accent,
                    }}
                  >
                    {hoveredSkill.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "10px",
                      fontWeight: 600,
                      color:
                        hoveredSkill.level >= 99
                          ? theme.colors.state.success
                          : theme.colors.text.accent,
                    }}
                  >
                    Lvl {hoveredSkill.level}
                  </span>
                </div>

                {/* XP Info */}
                <div
                  style={{
                    fontSize: "9px",
                    color: theme.colors.text.secondary,
                    marginBottom: "2px",
                  }}
                >
                  XP: {hoveredSkill.xp.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: theme.colors.text.muted,
                    marginBottom: "4px",
                  }}
                >
                  {hoveredSkill.level >= 99
                    ? "Max level reached!"
                    : `${xpRemaining.toLocaleString()} XP to level ${hoveredSkill.level + 1}`}
                </div>

                {/* Progress bar */}
                {hoveredSkill.level < 99 && (
                  <div
                    style={{
                      height: "3px",
                      background: theme.colors.slot.empty,
                      borderRadius: "1px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: theme.colors.accent.secondary,
                        borderRadius: "1px",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })(),
          document.body,
        )}
    </div>
  );
}
