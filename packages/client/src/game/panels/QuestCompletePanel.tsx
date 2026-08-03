/**
 * QuestCompletePanel - classic MMORPG-style quest completion overlay
 *
 * Features:
 * - Scroll/parchment style modal
 * - Congratulations message with quest name
 * - Rewards display (quest points, items)
 * - Click anywhere or press space to dismiss
 * - Fanfare sound effect on display
 */

import React, { useEffect, useCallback } from "react";
import { useThemeStore } from "@/ui";
import { getPanelInsetStyle, getPanelSurfaceStyle } from "@/ui/theme/themes";
import { UI } from "@/ui/core";
import type { ClientWorld } from "../../types";

interface QuestRewards {
  questPoints: number;
  items: Array<{ itemId: string; quantity: number }>;
  xp: Record<string, number>;
}

interface QuestCompletePanelProps {
  visible: boolean;
  questName: string;
  rewards: QuestRewards;
  world: ClientWorld;
  onClose: () => void;
}

// Item ID to display name mapping (basic)
const ITEM_NAMES: Record<string, string> = {
  xp_lamp_1000: "XP Lamp (1000 XP)",
  bronze_shortsword: "Bronze Sword",
  coins: "Coins",
};

export function QuestCompletePanel({
  visible,
  questName,
  rewards,
  world,
  onClose,
}: QuestCompletePanelProps) {
  const theme = useThemeStore((s) => s.theme);
  // Handle keyboard dismiss
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!visible) return;

    // Play fanfare sound
    try {
      // Use world's audio system if available
      const audioSystem = world.getSystem?.("audio") as {
        playSound?: (soundId: string) => void;
      } | null;
      if (audioSystem?.playSound) {
        audioSystem.playSound("quest_complete");
      }
    } catch {
      // Sound system not available, silently ignore
    }

    // Add keyboard listener
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, world, handleKeyDown]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        backgroundColor: "rgba(7, 9, 12, 0.8)",
        zIndex: UI.Z_INDEX.MODAL,
      }}
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Parchment/Scroll Style Container */}
      <div
        className="relative text-center"
        style={{
          width: "24rem",
          maxWidth: "90vw",
          padding: "2rem 2.5rem",
          ...getPanelSurfaceStyle(theme, { emphasis: "strong" }),
          borderRadius: theme.borderRadius.xl,
          boxShadow: `${theme.shadows.xl}, inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 0 28px rgba(92, 103, 118, 0.08)`,
          // Parchment texture effect via gradient
          backgroundImage: `
            linear-gradient(180deg, rgba(255, 249, 239, 0.055) 0%, rgba(0, 0, 0, 0.1) 100%),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(255, 248, 236, 0.015) 2px,
              rgba(255, 248, 236, 0.015) 4px
            )
          `,
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

        {/* Congratulations Header */}
        <h2
          className="m-0 mb-4 text-2xl font-bold"
          style={{
            color: theme.colors.text.accent,
            textShadow: "0 1px 2px rgba(0, 0, 0, 0.35)",
            fontFamily: theme.typography.fontFamily.heading,
            letterSpacing: "0.02em",
          }}
        >
          Congratulations!
        </h2>

        {/* Quest Complete Message */}
        <p
          className="m-0 mb-6 text-lg"
          style={{
            color: theme.colors.text.secondary,
            fontFamily: theme.typography.fontFamily.body,
          }}
        >
          You have completed the
          <br />
          <strong
            style={{
              color: theme.colors.text.primary,
              fontSize: "1.25rem",
            }}
          >
            {questName}
          </strong>
          <br />
          quest!
        </p>

        {/* Divider */}
        <div
          className="mx-auto mb-4"
          style={{
            width: "60%",
            height: "2px",
            background: `linear-gradient(to right, transparent, ${theme.colors.border.hover}, transparent)`,
          }}
        />

        {/* Rewards Section */}
        <div className="space-y-2">
          {/* Quest Points */}
          {rewards.questPoints > 0 && (
            <div
              className="text-lg font-bold"
              style={{
                ...getPanelInsetStyle(theme, {
                  emphasis: "strong",
                  radius: theme.borderRadius.md,
                  padding: "0.5rem 0.75rem",
                }),
                color: theme.colors.state.success,
              }}
            >
              {rewards.questPoints} Quest Point
              {rewards.questPoints !== 1 ? "s" : ""}
            </div>
          )}

          {/* Items */}
          {rewards.items.map((item, index) => (
            <div
              key={index}
              className="text-base"
              style={{
                ...getPanelInsetStyle(theme, {
                  radius: theme.borderRadius.md,
                  padding: "0.45rem 0.75rem",
                }),
                color: theme.colors.text.secondary,
              }}
            >
              {item.quantity > 1 ? `${item.quantity}x ` : ""}
              {ITEM_NAMES[item.itemId] || item.itemId}
            </div>
          ))}

          {/* XP Rewards */}
          {Object.entries(rewards.xp).map(([skill, amount]) => (
            <div
              key={skill}
              className="text-base"
              style={{
                ...getPanelInsetStyle(theme, {
                  radius: theme.borderRadius.md,
                  padding: "0.45rem 0.75rem",
                }),
                color: theme.colors.text.secondary,
              }}
            >
              {amount.toLocaleString()}{" "}
              {skill.charAt(0).toUpperCase() + skill.slice(1)} XP
            </div>
          ))}
        </div>

        {/* Dismiss Hint */}
        <p
          className="m-0 mt-6 text-sm"
          style={{ color: theme.colors.text.muted }}
        >
          Click anywhere to continue
        </p>

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
