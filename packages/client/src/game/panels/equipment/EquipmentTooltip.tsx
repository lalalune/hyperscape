import React from "react";
import { TOOLTIP_SIZE_ESTIMATES, useThemeStore, CursorTooltip } from "@/ui";
import {
  getTooltipBodyStyle,
  getTooltipDividerStyle,
  getTooltipMetaStyle,
  getTooltipStatusStyle,
  getTooltipTitleStyle,
} from "@/ui/core/tooltip/tooltipStyles";
import { getItem } from "@hyperforge/shared";
import type { Item } from "../../../types";

/** Rarity colors shared across equipment UI */
export const RARITY_COLORS: Record<string, string> = {
  common: "#9d9d9d",
  uncommon: "#1eff00",
  rare: "#0070dd",
  epic: "#a335ee",
  legendary: "#ff8000",
  mythic: "#e6cc80",
};

export interface EquipmentSlotData {
  key: string;
  label: string;
  icon: React.ReactNode;
  item: Item | null;
}

export interface EquipmentHoverState {
  slot: EquipmentSlotData;
  position: { x: number; y: number };
}

interface EquipmentTooltipProps {
  hoverState: EquipmentHoverState | null;
}

/**
 * Enhanced equipment hover tooltip component.
 * Shows item stats, rarity, requirements, and hints.
 * Uses a portal to render at cursor position with edge detection.
 */
export const EquipmentTooltip = React.memo(function EquipmentTooltip({
  hoverState,
}: EquipmentTooltipProps) {
  const theme = useThemeStore((s) => s.theme);

  if (!hoverState) return null;
  const item = hoverState.slot.item;

  if (!item) {
    return (
      <CursorTooltip
        visible={true}
        position={hoverState.position}
        estimatedSize={{ width: 80, height: 32 }}
        className="text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap !p-[6px_10px]"
        style={{
          background: "rgba(18, 21, 25, 0.98)",
          color: theme.colors.text.primary,
        }}
      >
        {hoverState.slot.label}
      </CursorTooltip>
    );
  }

  // Get full item data for additional info
  const itemData = getItem(item.id);
  const rarity = itemData?.rarity || "common";
  const equipSlot = itemData?.equipSlot || hoverState.slot.label;

  const rarityColor = RARITY_COLORS[rarity] || theme.colors.accent.primary;

  const hasBonuses =
    item.bonuses &&
    ((item.bonuses.attack !== undefined && item.bonuses.attack !== 0) ||
      (item.bonuses.defense !== undefined && item.bonuses.defense !== 0) ||
      (item.bonuses.strength !== undefined && item.bonuses.strength !== 0));

  // Check for per-style bonuses (armor system)
  const b = item.bonuses ?? {};
  const hasPerStyleDefence =
    b.defenseStab !== undefined ||
    b.defenseSlash !== undefined ||
    b.defenseCrush !== undefined;
  const hasPerStyleAttack =
    b.attackStab !== undefined ||
    b.attackSlash !== undefined ||
    b.attackCrush !== undefined;
  const hasMagicBonuses =
    (b.attackMagic !== undefined && b.attackMagic !== 0) ||
    (b.defenseMagic !== undefined && b.defenseMagic !== 0);
  const hasRangedBonuses =
    (b.attackRanged !== undefined && b.attackRanged !== 0) ||
    (b.defenseRanged !== undefined && b.defenseRanged !== 0);
  const hasDetailedBonuses =
    hasPerStyleDefence ||
    hasPerStyleAttack ||
    hasMagicBonuses ||
    hasRangedBonuses;

  return (
    <CursorTooltip
      visible={true}
      position={hoverState.position}
      estimatedSize={TOOLTIP_SIZE_ESTIMATES.xlarge}
      style={{
        minWidth: "160px",
        maxWidth: "240px",
        zIndex: theme.zIndex.tooltip,
      }}
    >
      {/* Item name with rarity color */}
      <div
        style={{
          ...getTooltipTitleStyle(theme, rarityColor),
          fontSize: theme.typography.fontSize.sm,
          marginBottom: "2px",
        }}
      >
        {item.name}
      </div>

      {/* Item type and rarity */}
      <div
        style={{
          ...getTooltipMetaStyle(theme),
          marginBottom: hasBonuses ? "8px" : "0",
          textTransform: "capitalize",
        }}
      >
        {equipSlot} • {rarity}
      </div>

      {/* Stat bonuses — detailed per-style for armor, simple for weapons */}
      {hasDetailedBonuses ? (
        <div
          style={{
            ...getTooltipDividerStyle(theme, rarityColor),
            fontSize: "11px",
            marginBottom: "6px",
          }}
        >
          {hasPerStyleDefence && (
            <div
              style={{
                ...getTooltipBodyStyle(theme),
                marginBottom: "3px",
              }}
            >
              <div style={{ marginBottom: "1px" }}>
                <span style={{ color: theme.colors.text.muted }}>
                  Defence:{" "}
                </span>
                {[
                  b.defenseStab !== undefined &&
                    `${b.defenseStab >= 0 ? "+" : ""}${b.defenseStab} stab`,
                  b.defenseSlash !== undefined &&
                    `${b.defenseSlash >= 0 ? "+" : ""}${b.defenseSlash} slash`,
                  b.defenseCrush !== undefined &&
                    `${b.defenseCrush >= 0 ? "+" : ""}${b.defenseCrush} crush`,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </div>
              <div>
                <span style={{ color: theme.colors.text.muted }}>
                  {"         "}
                </span>
                {[
                  b.defenseMagic !== undefined && b.defenseMagic !== 0 && (
                    <span
                      key="mdef"
                      style={{
                        color:
                          b.defenseMagic < 0
                            ? theme.colors.state.danger
                            : theme.colors.state.success,
                      }}
                    >
                      {b.defenseMagic >= 0 ? "+" : ""}
                      {b.defenseMagic} magic
                    </span>
                  ),
                  b.defenseRanged !== undefined && (
                    <span key="rdef">
                      {b.defenseRanged >= 0 ? "+" : ""}
                      {b.defenseRanged} ranged
                    </span>
                  ),
                ]
                  .filter(Boolean)
                  .map((el, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && " / "}
                      {el}
                    </React.Fragment>
                  ))}
              </div>
            </div>
          )}
          {(hasMagicBonuses || hasRangedBonuses || hasPerStyleAttack) && (
            <div style={getTooltipBodyStyle(theme)}>
              <span style={{ color: theme.colors.text.muted }}>Attack: </span>
              {[
                hasPerStyleAttack &&
                  b.attackStab !== undefined &&
                  b.attackStab !== 0 &&
                  `${b.attackStab >= 0 ? "+" : ""}${b.attackStab} stab`,
                hasPerStyleAttack &&
                  b.attackSlash !== undefined &&
                  b.attackSlash !== 0 &&
                  `${b.attackSlash >= 0 ? "+" : ""}${b.attackSlash} slash`,
                hasPerStyleAttack &&
                  b.attackCrush !== undefined &&
                  b.attackCrush !== 0 &&
                  `${b.attackCrush >= 0 ? "+" : ""}${b.attackCrush} crush`,
                b.attackMagic !== undefined && b.attackMagic !== 0 && (
                  <span
                    key="matk"
                    style={{
                      color:
                        b.attackMagic < 0
                          ? theme.colors.state.danger
                          : theme.colors.state.success,
                    }}
                  >
                    {b.attackMagic >= 0 ? "+" : ""}
                    {b.attackMagic} magic
                  </span>
                ),
                b.attackRanged !== undefined && b.attackRanged !== 0 && (
                  <span
                    key="ratk"
                    style={{
                      color:
                        b.attackRanged < 0
                          ? theme.colors.state.danger
                          : theme.colors.state.success,
                    }}
                  >
                    {b.attackRanged >= 0 ? "+" : ""}
                    {b.attackRanged} ranged
                  </span>
                ),
              ]
                .filter(Boolean)
                .map((el, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && " / "}
                    {el}
                  </React.Fragment>
                ))}
            </div>
          )}
        </div>
      ) : hasBonuses ? (
        <div
          style={{
            ...getTooltipDividerStyle(theme, rarityColor),
            fontSize: "11px",
            marginBottom: "6px",
          }}
        >
          {item.bonuses!.attack !== undefined && item.bonuses!.attack !== 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                ...getTooltipBodyStyle(theme),
                marginBottom: "2px",
              }}
            >
              <span>Attack</span>
              <span style={{ color: theme.colors.state.success }}>
                +{item.bonuses!.attack}
              </span>
            </div>
          )}
          {item.bonuses!.defense !== undefined &&
            item.bonuses!.defense !== 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  ...getTooltipBodyStyle(theme),
                  marginBottom: "2px",
                }}
              >
                <span>Defense</span>
                <span style={{ color: theme.colors.state.success }}>
                  +{item.bonuses!.defense}
                </span>
              </div>
            )}
          {item.bonuses!.strength !== undefined &&
            item.bonuses!.strength !== 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  ...getTooltipBodyStyle(theme),
                }}
              >
                <span>Strength</span>
                <span style={{ color: theme.colors.state.success }}>
                  +{item.bonuses!.strength}
                </span>
              </div>
            )}
        </div>
      ) : null}

      {/* Level requirements */}
      {itemData?.requirements?.level && (
        <div
          style={{
            ...getTooltipMetaStyle(theme),
            marginBottom: "4px",
          }}
        >
          Requires Level {itemData.requirements.level}
        </div>
      )}
      {itemData?.requirements?.skills && !itemData?.requirements?.level && (
        <div
          style={{
            ...getTooltipMetaStyle(theme),
            marginBottom: "4px",
          }}
        >
          Requires{" "}
          {Object.entries(
            itemData.requirements.skills as Record<string, number>,
          )
            .filter(([, lvl]) => lvl > 1)
            .map(
              ([skill, lvl]) =>
                `${lvl} ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
            )
            .join(", ")}
        </div>
      )}

      {/* Click hint */}
      <div
        style={{
          ...getTooltipStatusStyle(theme, "default"),
          opacity: 0.85,
        }}
      >
        Right-click for options
      </div>
    </CursorTooltip>
  );
});
