/**
 * Combat Bonuses Display
 *
 * Renders HP bar, combat level, target health bar, and stat row (ATK/STR/DEF).
 */

import React from "react";
import { getHpPercent } from "@hyperscape/shared";
import { useThemeStore } from "@/ui";
import { StatIcon } from "./StyleIcons";
import type { CombatBonusesDisplayProps } from "./types";

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

/** HP bar, combat level, target health, and stat row */
export const CombatBonusesDisplay = React.memo(function CombatBonusesDisplay({
  health,
  combatLevel,
  inCombat,
  attackLevel,
  strengthLevel,
  defenseLevel,
  targetName,
  targetHealth,
  compactPanel,
  ultraCompactPanel,
  isMobile,
  innerPadding,
  theme,
}: CombatBonusesDisplayProps) {
  const healthPercent = getHpPercent(health.current, health.max);
  const targetHealthPercent = targetHealth
    ? getHpPercent(targetHealth.current, targetHealth.max)
    : 0;

  return (
    <>
      {/* HP + Combat Level */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: `${innerPadding}px`,
          marginTop: compactPanel ? 16 : 22,
          background:
            theme.name === "hyperscape"
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

      {/* Target health -- only when in combat */}
      {targetName && targetHealth && !ultraCompactPanel && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: `${innerPadding - 1}px ${innerPadding}px`,
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
        isMobile={isMobile}
      />
    </>
  );
});
