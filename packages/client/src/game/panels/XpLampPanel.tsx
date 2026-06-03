/**
 * XpLampPanel - Panel for selecting a skill to apply XP to (e.g., XP Lamp)
 *
 * Features:
 * - Displays all trainable skills in a grid
 * - Shows current level for each skill
 * - Allows player to select which skill receives XP
 * - OSRS-style appearance
 */

import React from "react";
import { useThemeStore } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelHeaderStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
} from "@/ui/theme/themes";
import type { ClientWorld, PlayerStats } from "../../types";
import { EventType } from "@hyperforge/shared";
import { UI } from "@/ui/core";

interface XpLampPanelProps {
  visible: boolean;
  world: ClientWorld;
  stats: PlayerStats | null;
  xpAmount: number;
  itemId: string;
  slot: number;
  onClose: () => void;
}

interface SkillInfo {
  id: string;
  label: string;
  icon: string;
}

// All trainable skills with their display info
const SKILLS: SkillInfo[] = [
  { id: "attack", label: "Attack", icon: "⚔️" },
  { id: "strength", label: "Strength", icon: "💪" },
  { id: "defense", label: "Defense", icon: "🛡️" },
  { id: "constitution", label: "Constitution", icon: "❤️" },
  { id: "ranged", label: "Ranged", icon: "🏹" },
  { id: "prayer", label: "Prayer", icon: "🙏" },
  { id: "mining", label: "Mining", icon: "⛏️" },
  { id: "smithing", label: "Smithing", icon: "🔨" },
  { id: "fishing", label: "Fishing", icon: "🎣" },
  { id: "cooking", label: "Cooking", icon: "🍳" },
  { id: "firemaking", label: "Firemaking", icon: "🔥" },
  { id: "woodcutting", label: "Woodcutting", icon: "🪓" },
  { id: "agility", label: "Agility", icon: "🏃" },
  { id: "crafting", label: "Crafting", icon: "🧵" },
  { id: "fletching", label: "Fletching", icon: "🏹" },
  { id: "runecrafting", label: "Runecrafting", icon: "🔮" },
];

export function XpLampPanel({
  visible,
  world,
  stats,
  xpAmount,
  itemId,
  slot,
  onClose,
}: XpLampPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  if (!visible) return null;
  const closeButtonStyle = getShellControlButtonStyle(theme, "danger");

  const handleSkillSelect = (skillId: string) => {
    const localPlayer = world.getPlayer();
    if (!localPlayer) return;

    // Send skill selection to server
    if (world.network?.send) {
      world.network.send("xpLampUse", {
        itemId,
        slot,
        skillId,
        xpAmount,
      });
    }

    // Also emit local event for any listeners
    world.emit(EventType.XP_LAMP_SKILL_SELECTED, {
      playerId: localPlayer.id,
      itemId,
      slot,
      skillId,
      xpAmount,
    });

    onClose();
  };

  const getSkillLevel = (skillId: string): number => {
    if (!stats?.skills) return 1;
    const skillData = stats.skills[skillId as keyof typeof stats.skills];
    return skillData?.level ?? 1;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: UI.Z_INDEX.MODAL,
      }}
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="relative"
        style={{
          width: "24rem",
          maxWidth: "90vw",
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          borderRadius: theme.borderRadius.xl,
          padding: "1.5rem",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center mb-4 pb-2"
          style={{
            ...getPanelHeaderStyle(theme),
            margin: "-1.5rem -1.5rem 1rem",
            padding: "0.75rem 1rem",
          }}
        >
          <h3
            className="m-0 text-lg font-bold"
            style={{ color: theme.colors.text.accent }}
          >
            Choose a Skill
          </h3>
          <button
            onClick={onClose}
            className="cursor-pointer text-xl leading-none"
            style={{ ...closeButtonStyle, width: 28, height: 28, fontSize: 18 }}
            title="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = String(
                closeButtonStyle["--shell-button-hover-bg"],
              );
              e.currentTarget.style.color = String(
                closeButtonStyle["--shell-button-hover-fg"],
              );
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = String(
                closeButtonStyle.background,
              );
              e.currentTarget.style.color = String(closeButtonStyle.color);
            }}
          >
            ×
          </button>
        </div>

        {/* XP Amount Info */}
        <div
          className="text-center mb-4 py-2"
          style={{
            color: theme.colors.state.success,
            ...getPanelInsetStyle(theme, {
              emphasis: "strong",
              radius: theme.borderRadius.md,
              padding: "0.5rem 0.75rem",
            }),
          }}
        >
          Grant <strong>{xpAmount.toLocaleString()} XP</strong> to:
        </div>

        {/* Skills Grid */}
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
          }}
        >
          {SKILLS.map((skill) => {
            const level = getSkillLevel(skill.id);
            return (
              <button
                key={skill.id}
                onClick={() => handleSkillSelect(skill.id)}
                className="flex flex-col items-center p-2 transition-all duration-150"
                style={{
                  ...getInteractiveTileStyle(theme, {
                    radius: theme.borderRadius.md,
                    accentColor: theme.colors.accent.primary,
                  }),
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    theme.colors.accent.primary;
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${theme.colors.border.default}40`;
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <span className="text-xl mb-1">{skill.icon}</span>
                <span
                  className="text-xs font-medium"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {skill.label}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{
                    color:
                      level >= 99
                        ? theme.colors.state.warning
                        : theme.colors.text.accent,
                  }}
                >
                  Lv. {level}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cancel Button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              ...getInteractiveTileStyle(theme, {
                radius: theme.borderRadius.md,
              }),
              color: theme.colors.text.secondary,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                theme.name === "hyperia"
                  ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(0, 0, 0, 0.2) 100%)"
                  : theme.colors.background.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                theme.name === "hyperia"
                  ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.16) 100%)"
                  : theme.colors.background.tertiary;
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
