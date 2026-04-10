/**
 * Stats Panel - OSRS-style Equipment Stats Display
 *
 * Shows equipment bonuses from all worn items, grouped by:
 * - Attack bonuses: Stab, Slash, Crush, Magic, Ranged
 * - Defence bonuses: Stab, Slash, Crush, Magic, Ranged
 * - Other bonuses: Melee Strength, Ranged Strength, Magic Damage, Prayer
 *
 * Matches the RuneScape "Equipment Stats" screen layout.
 */

import { useMemo } from "react";
import { useThemeStore } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import {
  calculateCombatLevel,
  normalizeCombatSkills,
} from "@hyperscape/shared";
import type { PlayerEquipmentItems, PlayerStats } from "../../types";

// ============================================================================
// BONUS ROW - Single stat line (e.g. "Stab   +12")
// ============================================================================

interface BonusRowProps {
  label: string;
  value: number;
}

function BonusRow({ label, value }: BonusRowProps) {
  const theme = useThemeStore((s) => s.theme);
  const color =
    value > 0
      ? theme.colors.state.success
      : value < 0
        ? theme.colors.state.danger
        : theme.colors.text.muted;
  const prefix = value > 0 ? "+" : "";

  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "1px 4px",
        fontSize: theme.typography.fontSize.xs,
      }}
    >
      <span style={{ color: theme.colors.text.secondary }}>{label}</span>
      <span
        style={{
          color,
          fontWeight: theme.typography.fontWeight.semibold,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {prefix}
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({ label }: { label: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <div
      style={{
        fontSize: theme.typography.fontSize.xs,
        fontWeight: theme.typography.fontWeight.bold,
        color: theme.colors.accent.primary,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        padding: "4px 4px 2px",
        borderBottom: `1px solid ${theme.colors.border.default}`,
        marginBottom: "2px",
      }}
    >
      {label}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface StatsPanelProps {
  stats?: PlayerStats | null;
  equipment?: PlayerEquipmentItems | null;
  showSilhouette?: boolean;
}

export function StatsPanel({
  stats,
  equipment,
  showSilhouette = false,
}: StatsPanelProps) {
  const theme = useThemeStore((s) => s.theme);

  // Sum all equipment bonuses across all slots
  const totals = useMemo(() => {
    const t = {
      // Attack bonuses
      attackStab: 0,
      attackSlash: 0,
      attackCrush: 0,
      attackMagic: 0,
      attackRanged: 0,
      // Defence bonuses
      defenseStab: 0,
      defenseSlash: 0,
      defenseCrush: 0,
      defenseMagic: 0,
      defenseRanged: 0,
      // Other bonuses
      meleeStrength: 0,
      rangedStrength: 0,
      magicDamage: 0,
      prayer: 0,
    };

    if (!equipment) return t;

    const slots = [
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.weapon,
      equipment.shield,
      equipment.boots,
      equipment.gloves,
      equipment.cape,
      equipment.amulet,
      equipment.ring,
      equipment.arrows,
    ];

    for (const item of slots) {
      if (!item?.bonuses) continue;
      const b = item.bonuses;

      // Attack bonuses — per-style with fallback to generic attack
      t.attackStab += b.attackStab ?? b.attack ?? 0;
      t.attackSlash += b.attackSlash ?? b.attack ?? 0;
      t.attackCrush += b.attackCrush ?? b.attack ?? 0;
      t.attackMagic += b.attackMagic ?? 0;
      t.attackRanged += b.attackRanged ?? b.ranged ?? 0;

      // Defence bonuses — per-style with fallback to generic defense
      t.defenseStab += b.defenseStab ?? b.defense ?? 0;
      t.defenseSlash += b.defenseSlash ?? b.defense ?? 0;
      t.defenseCrush += b.defenseCrush ?? b.defense ?? 0;
      t.defenseMagic += b.defenseMagic ?? 0;
      t.defenseRanged += b.defenseRanged ?? 0;

      // Other bonuses
      t.meleeStrength += b.meleeStrength ?? b.strength ?? 0;
      t.rangedStrength += b.rangedStrength ?? 0;
      t.magicDamage += b.magicDamage ?? 0;
      t.prayer += b.prayer ?? b.prayerBonus ?? 0;
    }

    return t;
  }, [equipment]);

  // Weight
  const totalWeight = useMemo(() => {
    if (!equipment) return 0;
    const slots = [
      equipment.helmet,
      equipment.body,
      equipment.legs,
      equipment.weapon,
      equipment.shield,
      equipment.boots,
      equipment.gloves,
      equipment.cape,
      equipment.amulet,
      equipment.ring,
    ];
    return slots.reduce(
      (sum, item) => sum + (item?.weight || 0) * (item?.quantity || 1),
      0,
    );
  }, [equipment]);

  // Combat level from stats
  const combatLevel = useMemo(() => {
    const skills = stats?.skills;
    if (!skills) return 1;
    return calculateCombatLevel(
      normalizeCombatSkills({
        attack: skills.attack?.level,
        strength: skills.strength?.level,
        defense: skills.defense?.level,
        constitution: skills.constitution?.level,
        ranged: skills.ranged?.level,
        magic: skills.magic?.level,
        prayer: skills.prayer?.level,
      }),
    );
  }, [stats]);

  const panelStyle = {
    background:
      theme.name === "hyperscape"
        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.14) 100%)"
        : theme.colors.background.panelSecondary,
    borderRadius: `${theme.borderRadius.md}px`,
    border: `1px solid ${theme.colors.border.default}40`,
    padding: `${theme.spacing.xs}px`,
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  };

  const content = (
    <div
      style={{
        ...(!showSilhouette
          ? getPanelSurfaceStyle(theme, { emphasis: "normal" })
          : {}),
        display: "flex",
        flexDirection: "column" as const,
        gap: "6px",
        padding: showSilhouette ? "0" : "6px",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header — Combat Level & Weight */}
      <div
        style={{
          ...panelStyle,
          padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
        }}
      >
        <div className="flex items-center justify-between">
          <span
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.muted,
            }}
          >
            Combat Level{" "}
            <span
              style={{
                color: theme.colors.state.danger,
                fontWeight: theme.typography.fontWeight.bold,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {combatLevel}
            </span>
          </span>
          <span
            style={{
              fontSize: theme.typography.fontSize.xs,
              color:
                totalWeight > 30
                  ? theme.colors.state.danger
                  : theme.colors.text.muted,
              fontWeight: theme.typography.fontWeight.medium,
            }}
          >
            {totalWeight.toFixed(1)} kg
          </span>
        </div>
      </div>

      {/* Equipment Bonuses */}
      <div className="flex-1 overflow-y-auto noscrollbar" style={panelStyle}>
        {/* Attack bonuses */}
        <SectionHeader label="Attack Bonuses" />
        <BonusRow label="Stab" value={totals.attackStab} />
        <BonusRow label="Slash" value={totals.attackSlash} />
        <BonusRow label="Crush" value={totals.attackCrush} />
        <BonusRow label="Magic" value={totals.attackMagic} />
        <BonusRow label="Ranged" value={totals.attackRanged} />

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${theme.colors.border.default} 50%, transparent)`,
            margin: `${theme.spacing.xs}px 0`,
          }}
        />

        {/* Defence bonuses */}
        <SectionHeader label="Defence Bonuses" />
        <BonusRow label="Stab" value={totals.defenseStab} />
        <BonusRow label="Slash" value={totals.defenseSlash} />
        <BonusRow label="Crush" value={totals.defenseCrush} />
        <BonusRow label="Magic" value={totals.defenseMagic} />
        <BonusRow label="Ranged" value={totals.defenseRanged} />

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${theme.colors.border.default} 50%, transparent)`,
            margin: `${theme.spacing.xs}px 0`,
          }}
        />

        {/* Other bonuses */}
        <SectionHeader label="Other Bonuses" />
        <BonusRow label="Melee Strength" value={totals.meleeStrength} />
        <BonusRow label="Ranged Strength" value={totals.rangedStrength} />
        <BonusRow label="Magic Damage" value={totals.magicDamage} />
        <BonusRow label="Prayer" value={totals.prayer} />
      </div>
    </div>
  );

  if (showSilhouette) {
    return (
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "6px",
          height: "100%",
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>{content}</div>
      </div>
    );
  }

  return content;
}
