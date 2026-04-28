/**
 * Skills Panel
 * Hyperscape-themed skills interface (Prayer is now in separate PrayerPanel)
 * Uses project theme colors (gold #f2d08a, brown borders)
 * Supports drag-drop to action bar
 * Uses shared SKILL_DEFINITIONS for data-driven skill display
 */

import React, { useState, useRef, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { useDraggable } from "@dnd-kit/core";
import { CursorTooltip, useThemeStore, useMobileLayout } from "@/ui";
import {
  getTooltipMetaStyle,
  getTooltipStatusStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import {
  getInteractiveTileStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
} from "@/ui/theme/themes";
import { zIndex, MOBILE_SKILLS } from "../../constants";
import {
  PANEL_PADDING,
  PANEL_MOBILE_PADDING,
  PANEL_GRID_GAP,
  PANEL_SLOT_RADIUS,
} from "../../constants/panelLayout";
import type { PlayerStats, Skills } from "../../types";
import {
  SKILL_DEFINITIONS,
  getUnlocksForSkill,
  calculateCombatLevel,
  normalizeCombatSkills,
  getXPForLevel,
  type SkillDefinition,
} from "@hyperscape/shared";
import { SkillGuidePanel } from "./SkillGuidePanel";

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

/** Draggable skill card component for action bar drag-drop */
// Memoized to prevent re-renders of all skill cards when any changes
const DraggableSkillCard = memo(function DraggableSkillCard({
  skill,
  isHovered,
  isMobile,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: {
  skill: Skill;
  isHovered: boolean;
  isMobile: boolean;
  onClick: (skill: Skill) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);

  // Track pointer position to distinguish clicks from drags
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStart.current) return;
      const dx = e.clientX - pointerStart.current.x;
      const dy = e.clientY - pointerStart.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      pointerStart.current = null;
      // Only treat as click if pointer barely moved (not a drag)
      if (distance < 5) {
        onClick(skill);
      }
    },
    [onClick, skill],
  );

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
      ...getInteractiveTileStyle(theme, {
        hovered: isHovered,
        radius: 4,
      }),
      padding: isMobile ? "4px 6px" : `${PANEL_PADDING - 2}px 4px`,
      minHeight: isMobile ? MOBILE_SKILLS.cardHeight : 24,
      cursor: isDragging ? "grabbing" : "grab",
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
      onPointerDownCapture={handlePointerDown}
      onPointerUpCapture={handlePointerUp}
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
            fontSize: isMobile ? "14px" : "11px",
            filter: "drop-shadow(1px 1px 1px rgba(0,0,0,0.4))",
            lineHeight: 1,
          }}
        >
          {skill.icon}
        </span>
        {/* OSRS-style slanted level display: current↗/↘base */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            height: "13px",
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
              fontSize: isMobile ? "10px" : "8px",
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
  const [hoveredTotalLevel, setHoveredTotalLevel] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [guideSkill, setGuideSkill] = useState<Skill | null>(null);

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
  const totalXP = skills.reduce((sum, skill) => sum + skill.xp, 0);
  const combatLevel = calculateCombatLevel(
    normalizeCombatSkills({
      attack: s.attack?.level,
      strength: s.strength?.level,
      defense: s.defense?.level,
      constitution: s.constitution?.level,
      ranged: s.ranged?.level,
      magic: s.magic?.level,
      prayer: s.prayer?.level,
    }),
  );

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
        padding: shouldUseMobileUI ? PANEL_MOBILE_PADDING : PANEL_PADDING,
      }}
    >
      {/* Compact header — matches Prayer/Spell panel pattern */}
      <div
        style={{
          ...getPanelInsetStyle(theme, { emphasis: "normal", radius: 4 }),
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: shouldUseMobileUI ? "4px 6px" : "3px 6px",
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        {/* Left: icon + label */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: shouldUseMobileUI ? 16 : 14 }}>⚔️</span>
          <div
            style={{
              fontSize: shouldUseMobileUI ? 9 : 8,
              color: theme.colors.text.muted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Skills
          </div>
        </div>

        {/* Right: Total / Combat with OSRS-style angled split */}
        <div
          style={{ textAlign: "center", cursor: "default" }}
          onMouseEnter={(e) => {
            setHoveredTotalLevel(true);
            setMousePos({ x: e.clientX, y: e.clientY });
          }}
          onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHoveredTotalLevel(false)}
        >
          <div
            style={{
              fontSize: 7,
              color: theme.colors.text.muted,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              lineHeight: 1,
              marginBottom: 2,
              display: "flex",
              gap: 6,
              justifyContent: "center",
            }}
          >
            <span>Total</span>
            <span>Combat</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              position: "relative",
              height: 14,
            }}
          >
            <span
              style={{
                fontSize: shouldUseMobileUI ? 12 : 10,
                fontWeight: 700,
                color: theme.colors.text.accent,
                lineHeight: 1,
                position: "relative",
                top: -2,
                textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
              }}
            >
              {totalLevel}
            </span>
            <span
              style={{
                fontSize: shouldUseMobileUI ? 10 : 9,
                fontWeight: 400,
                color: theme.colors.text.disabled,
                lineHeight: 1,
                margin: "0 2px",
                transform: "rotate(-20deg)",
                display: "inline-block",
              }}
            >
              /
            </span>
            <span
              style={{
                fontSize: shouldUseMobileUI ? 12 : 10,
                fontWeight: 700,
                color: theme.colors.state.danger,
                lineHeight: 1,
                position: "relative",
                top: 2,
                textShadow: "1px 1px 1px rgba(0,0,0,0.5)",
              }}
            >
              {combatLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Skills Grid - Mobile: 2 columns with names, Desktop: 3 columns compact */}
      <div
        className="grid flex-1 overflow-hidden"
        style={{
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: 4,
          }),
          padding: shouldUseMobileUI ? MOBILE_SKILLS.gap : PANEL_PADDING,
          gridTemplateColumns: shouldUseMobileUI
            ? `repeat(${MOBILE_SKILLS.columns}, 1fr)`
            : "repeat(3, 1fr)",
          gap: shouldUseMobileUI
            ? `${MOBILE_SKILLS.gap}px`
            : `${PANEL_GRID_GAP}px`,
        }}
      >
        {skills.map((skill) => (
          <DraggableSkillCard
            key={skill.key}
            skill={skill}
            isHovered={hoveredSkill?.key === skill.key}
            isMobile={shouldUseMobileUI}
            onClick={setGuideSkill}
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

      {/* Skill Tooltip */}
      {hoveredSkill &&
        (() => {
          const currentLevelXP = getXPForLevel(hoveredSkill.level);
          const nextLevelXP = getXPForLevel(hoveredSkill.level + 1);
          const xpRemaining = nextLevelXP - hoveredSkill.xp;
          const xpIntoLevel = hoveredSkill.xp - currentLevelXP;
          const xpForThisLevel = nextLevelXP - currentLevelXP;
          const progress = Math.min(
            100,
            Math.max(0, (xpIntoLevel / xpForThisLevel) * 100),
          );

          return (
            <CursorTooltip
              visible={!!hoveredSkill}
              position={mousePos}
              estimatedSize={{ width: 140, height: 90 }}
              style={{
                minWidth: "140px",
                zIndex: zIndex.tooltip,
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span style={{ fontSize: "14px" }}>{hoveredSkill.icon}</span>
                <span
                  style={{
                    ...getTooltipTitleStyle(theme),
                    fontSize: "11px",
                  }}
                >
                  {hoveredSkill.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    ...getTooltipMetaStyle(theme),
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
                  ...getTooltipMetaStyle(theme),
                  marginBottom: "2px",
                }}
              >
                XP: {hoveredSkill.xp.toLocaleString()}
              </div>
              <div
                style={{
                  ...getTooltipMetaStyle(theme),
                  marginBottom: "4px",
                }}
              >
                {hoveredSkill.level >= 99
                  ? "Max level reached!"
                  : `${xpRemaining.toLocaleString()} XP to level ${hoveredSkill.level + 1}`}
              </div>

              {/* Progress bar */}
              {hoveredSkill.level < 99 ? (
                <div
                  style={{
                    height: "3px",
                    background: theme.colors.slot.empty,
                    borderRadius: theme.borderRadius.sm,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: theme.colors.accent.secondary,
                      borderRadius: theme.borderRadius.sm,
                    }}
                  />
                </div>
              ) : (
                <div style={getTooltipStatusStyle(theme, "success")}>
                  Max level reached
                </div>
              )}
            </CursorTooltip>
          );
        })()}

      {/* Total Level XP Tooltip */}
      {hoveredTotalLevel && (
        <CursorTooltip
          visible={true}
          position={mousePos}
          estimatedSize={{ width: 120, height: 50 }}
          style={{
            minWidth: "120px",
            zIndex: zIndex.tooltip,
          }}
        >
          <div
            style={{
              ...getTooltipMetaStyle(theme),
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              marginBottom: "2px",
            }}
          >
            Total XP
          </div>
          <div
            style={{
              ...getTooltipTitleStyle(theme),
              fontSize: "11px",
            }}
          >
            {totalXP.toLocaleString()}
          </div>
        </CursorTooltip>
      )}

      {/* Skill Guide Modal — portaled to body so it renders center-screen */}
      {guideSkill &&
        createPortal(
          <SkillGuidePanel
            visible={true}
            skillLabel={guideSkill.label}
            skillIcon={guideSkill.icon}
            playerLevel={guideSkill.level}
            unlocks={getUnlocksForSkill(guideSkill.key)}
            isLoading={false}
            onClose={() => setGuideSkill(null)}
          />,
          document.body,
        )}
    </div>
  );
}
