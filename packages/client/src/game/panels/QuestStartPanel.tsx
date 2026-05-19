/**
 * QuestStartPanel - tile-based-MMORPG-style quest accept overlay
 *
 * Features:
 * - Shows quest name, description, requirements
 * - Displays rewards (items, XP, quest points)
 * - Accept/Decline buttons
 * - Shown when player accepts quest via dialogue
 */

import React, { useEffect } from "react";
import { useThemeStore } from "@/ui";
import {
  getInteractiveTileStyle,
  getPanelInsetStyle,
  getPanelSurfaceStyle,
  getShellControlButtonStyle,
} from "@/ui/theme/themes";
import { UI } from "@/ui/core";

interface QuestRequirements {
  quests: string[];
  skills: Record<string, number>;
  items: string[];
}

interface QuestRewards {
  questPoints: number;
  items: Array<{ itemId: string; quantity: number }>;
  xp: Record<string, number>;
}

interface QuestStartPanelProps {
  visible: boolean;
  questId: string;
  questName: string;
  description: string;
  difficulty: string;
  requirements: QuestRequirements;
  rewards: QuestRewards;
  onAccept: () => void;
  onDecline: () => void;
}

// Skill name formatting
const formatSkillName = (skill: string): string => {
  return skill.charAt(0).toUpperCase() + skill.slice(1);
};

export function QuestStartPanel({
  visible,
  questName,
  description,
  difficulty,
  requirements,
  rewards,
  onAccept,
  onDecline,
}: QuestStartPanelProps) {
  const theme = useThemeStore((s) => s.theme);
  // Inject themed scrollbar styles
  useEffect(() => {
    const styleId = "quest-start-scrollbar-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .quest-parchment-scroll::-webkit-scrollbar {
        width: 10px;
      }
      .quest-parchment-scroll::-webkit-scrollbar-track {
        background: rgba(36, 41, 49, 0.3);
        border-radius: 4px;
      }
      .quest-parchment-scroll::-webkit-scrollbar-thumb {
        background: linear-gradient(to bottom, #5d6672, #434b56);
        border-radius: 4px;
        border: 1px solid rgba(56, 63, 73, 0.32);
      }
      .quest-parchment-scroll::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(to bottom, #6b7581, #4f5965);
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!visible) return null;

  // Check if player meets requirements (for display purposes)
  const hasRequirements =
    requirements.quests.length === 0 &&
    Object.keys(requirements.skills).length === 0 &&
    requirements.items.length === 0;
  const declineButtonStyle = getShellControlButtonStyle(theme, "danger");

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        backgroundColor: "rgba(7, 9, 12, 0.8)",
        zIndex: UI.Z_INDEX.MODAL,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Parchment Style Container */}
      <div
        className="relative quest-parchment-scroll"
        style={{
          width: "26rem",
          maxWidth: "90vw",
          maxHeight: "85vh",
          padding: "1.5rem 2rem",
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          borderRadius: theme.borderRadius.xl,
          boxShadow: `${theme.shadows.xl}, inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 0 28px rgba(92, 103, 118, 0.08)`,
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Border */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "60%",
            height: "4px",
            background: `linear-gradient(to right, transparent, ${theme.colors.accent.gold}, transparent)`,
          }}
        />

        {/* Header */}
        <div className="text-center mb-4">
          <h2
            className="m-0 text-xl font-bold"
            style={{
              color: theme.colors.text.accent,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
              fontFamily: theme.typography.fontFamily.heading,
              letterSpacing: "0.02em",
            }}
          >
            New Quest
          </h2>
        </div>

        {/* Quest Name */}
        <div
          className="text-center mb-3 py-2"
          style={{
            ...getPanelInsetStyle(theme, {
              emphasis: "strong",
              radius: theme.borderRadius.md,
              padding: "0.5rem 0.75rem",
            }),
          }}
        >
          <h3
            className="m-0 text-lg font-bold"
            style={{
              color: theme.colors.text.primary,
              fontFamily: theme.typography.fontFamily.heading,
            }}
          >
            {questName}
          </h3>
          <span
            className="text-sm"
            style={{ color: theme.colors.text.secondary }}
          >
            Difficulty: {difficulty}
          </span>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p
            className="m-0 text-sm leading-relaxed"
            style={{
              color: theme.colors.text.secondary,
              fontFamily: theme.typography.fontFamily.body,
              ...getPanelInsetStyle(theme, {
                emphasis: "normal",
                radius: theme.borderRadius.md,
                padding: "0.85rem 1rem",
              }),
            }}
          >
            {description}
          </p>
        </div>

        {/* Divider */}
        <div
          className="mx-auto mb-3"
          style={{
            width: "80%",
            height: "2px",
            background: `linear-gradient(to right, transparent, ${theme.colors.border.hover}, transparent)`,
          }}
        />

        {/* Requirements Section */}
        {!hasRequirements && (
          <div className="mb-4">
            <h4
              className="m-0 mb-2 text-sm font-bold"
              style={{ color: theme.colors.text.accent }}
            >
              Requirements:
            </h4>
            <div
              className="space-y-1 pl-2"
              style={{
                ...getPanelInsetStyle(theme, {
                  emphasis: "normal",
                  radius: theme.borderRadius.md,
                  padding: "0.75rem 0.9rem",
                }),
              }}
            >
              {requirements.quests.map((quest, i) => (
                <div
                  key={i}
                  className="text-sm"
                  style={{ color: theme.colors.text.secondary }}
                >
                  • Complete: {quest}
                </div>
              ))}
              {Object.entries(requirements.skills).map(([skill, level]) => (
                <div
                  key={skill}
                  className="text-sm"
                  style={{ color: theme.colors.text.secondary }}
                >
                  • {formatSkillName(skill)} Level {level}
                </div>
              ))}
              {requirements.items.map((item, i) => (
                <div
                  key={i}
                  className="text-sm"
                  style={{ color: theme.colors.text.secondary }}
                >
                  • Bring: {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rewards Section */}
        <div className="mb-4">
          <h4
            className="m-0 mb-2 text-sm font-bold"
            style={{ color: theme.colors.text.accent }}
          >
            Rewards:
          </h4>
          <div
            className="space-y-1 pl-2"
            style={{
              ...getPanelInsetStyle(theme, {
                emphasis: "normal",
                radius: theme.borderRadius.md,
                padding: "0.75rem 0.9rem",
              }),
            }}
          >
            {rewards.questPoints > 0 && (
              <div
                className="text-sm font-medium"
                style={{ color: theme.colors.state.success }}
              >
                • {rewards.questPoints} Quest Point
                {rewards.questPoints !== 1 ? "s" : ""}
              </div>
            )}
            {rewards.items.length > 0 && (
              <div
                className="text-sm"
                style={{ color: theme.colors.text.secondary }}
              >
                • Item rewards
              </div>
            )}
            {Object.keys(rewards.xp).length > 0 && (
              <div
                className="text-sm"
                style={{ color: theme.colors.text.secondary }}
              >
                • XP rewards
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div
          className="mx-auto mb-4"
          style={{
            width: "80%",
            height: "2px",
            background: `linear-gradient(to right, transparent, ${theme.colors.border.hover}, transparent)`,
          }}
        />

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onAccept}
            className="px-6 py-2 rounded cursor-pointer transition-all font-bold"
            style={{
              ...getInteractiveTileStyle(theme, {
                active: true,
                accentColor: theme.colors.state.success,
                radius: theme.borderRadius.md,
              }),
              color: theme.colors.text.primary,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(180deg, rgba(245, 252, 246, 0.08) 0%, ${theme.colors.state.success}26 22%, rgba(20, 42, 24, 0.98) 100%)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(180deg, rgba(245, 252, 246, 0.06) 0%, ${theme.colors.state.success}1c 20%, rgba(22, 36, 25, 0.98) 100%)`;
            }}
          >
            Accept Quest
          </button>
          <button
            onClick={onDecline}
            className="px-6 py-2 rounded cursor-pointer transition-all font-bold"
            style={{
              ...declineButtonStyle,
              width: "auto",
              height: "auto",
              padding: "0.5rem 1.5rem",
              fontSize: theme.typography.fontSize.base,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = String(
                declineButtonStyle["--shell-button-hover-bg"],
              );
              e.currentTarget.style.color = String(
                declineButtonStyle["--shell-button-hover-fg"],
              );
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = String(
                declineButtonStyle.background,
              );
              e.currentTarget.style.color = String(declineButtonStyle.color);
            }}
          >
            Not Now
          </button>
        </div>

        {/* Decorative Bottom Border */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"
          style={{
            width: "60%",
            height: "4px",
            background: `linear-gradient(to right, transparent, ${theme.colors.accent.gold}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}
