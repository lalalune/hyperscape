/**
 * Duel Rules Screen
 *
 * Screen where both players negotiate duel rules and equipment restrictions.
 * Both players must accept for the duel to proceed to the Stakes screen.
 *
 * OSRS-style features:
 * - 10 rule toggles (combat restrictions)
 * - 11 equipment slot toggles
 * - Accept button that shows opponent's acceptance status
 * - Rules reset when either player modifies
 */

import { useCallback, useMemo, type CSSProperties } from "react";
import { useThemeStore, type Theme } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import {
  type DuelRules,
  type DuelEquipmentSlot,
  type EquipmentRestrictions,
  DUEL_RULE_DEFINITIONS,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS_ORDERED,
} from "@hyperforge/shared";

// ============================================================================
// Types
// ============================================================================

interface RulesScreenProps {
  rules: DuelRules;
  equipmentRestrictions: EquipmentRestrictions;
  myAccepted: boolean;
  opponentAccepted: boolean;
  opponentName: string;
  onToggleRule: (rule: keyof DuelRules) => void;
  onToggleEquipment: (slot: DuelEquipmentSlot) => void;
  onAccept: () => void;
  onCancel: () => void;
}

// ============================================================================
// Rule Definitions - Now imported from @hyperforge/shared/data/duel-manifest
// ============================================================================

// ============================================================================
// Memoized Styles Hook
// ============================================================================

function useRulesScreenStyles(theme: Theme, myAccepted: boolean) {
  return useMemo(() => {
    const containerStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing.md,
      height: "100%",
    };

    const sectionStyle: CSSProperties = {
      ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
    };

    const sectionTitleStyle: CSSProperties = {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.sm,
      borderBottom: `1px solid ${theme.colors.border.default}`,
      paddingBottom: theme.spacing.xs,
    };

    const gridStyle: CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: theme.spacing.xs,
    };

    const acceptanceStyle: CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.sm,
      background:
        theme.name === "hyperia"
          ? "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.14) 100%)"
          : theme.colors.background.secondary,
      borderRadius: theme.borderRadius.sm,
      fontSize: theme.typography.fontSize.sm,
      border: `1px solid ${theme.colors.border.default}40`,
    };

    const buttonContainerStyle: CSSProperties = {
      display: "flex",
      gap: theme.spacing.md,
      marginTop: "auto",
    };

    const baseButtonStyle: CSSProperties = {
      flex: 1,
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      cursor: "pointer",
      transition: "all 0.2s ease",
      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
    };

    const acceptButtonStyle: CSSProperties = {
      ...baseButtonStyle,
      background: myAccepted
        ? `linear-gradient(135deg, ${theme.colors.state.success}88 0%, ${theme.colors.state.success}66 100%)`
        : `linear-gradient(135deg, ${theme.colors.state.success}CC 0%, ${theme.colors.state.success}AA 100%)`,
      color: "#fff",
      border: `1px solid ${theme.colors.state.success}`,
      opacity: myAccepted ? 0.7 : 1,
    };

    const cancelButtonStyle: CSSProperties = {
      ...baseButtonStyle,
      background: `linear-gradient(135deg, ${theme.colors.state.danger}CC 0%, ${theme.colors.state.danger}AA 100%)`,
      color: "#fff",
      border: `1px solid ${theme.colors.state.danger}`,
    };

    return {
      containerStyle,
      sectionStyle,
      sectionTitleStyle,
      gridStyle,
      acceptanceStyle,
      buttonContainerStyle,
      acceptButtonStyle,
      cancelButtonStyle,
    };
  }, [theme, myAccepted]);
}

/**
 * Get checkbox style based on checked state (called per item, but simple object)
 */
function getCheckboxStyle(theme: Theme, checked: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    background: checked
      ? `${theme.colors.accent.primary}33`
      : theme.colors.background.secondary,
    border: `1px solid ${checked ? theme.colors.accent.primary : theme.colors.border.default}`,
    borderRadius: theme.borderRadius.sm,
    cursor: "pointer",
    fontSize: theme.typography.fontSize.xs,
    color: checked ? theme.colors.accent.primary : theme.colors.text.secondary,
    transition: "all 0.15s ease",
  };
}

/**
 * Get status dot style based on accepted state
 */
function getStatusDotStyle(theme: Theme, accepted: boolean): CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: accepted
      ? theme.colors.state.success
      : theme.colors.state.danger,
    marginRight: theme.spacing.xs,
    display: "inline-block",
  };
}

// ============================================================================
// Component
// ============================================================================

export function RulesScreen({
  rules,
  equipmentRestrictions,
  myAccepted,
  opponentAccepted,
  opponentName,
  onToggleRule,
  onToggleEquipment,
  onAccept,
  onCancel,
}: RulesScreenProps) {
  const theme = useThemeStore((s) => s.theme);

  // Memoized styles - only recalculated when theme or myAccepted changes
  const styles = useRulesScreenStyles(theme, myAccepted);

  const handleRuleToggle = useCallback(
    (rule: keyof DuelRules) => {
      onToggleRule(rule);
    },
    [onToggleRule],
  );

  const handleEquipmentToggle = useCallback(
    (slot: DuelEquipmentSlot) => {
      onToggleEquipment(slot);
    },
    [onToggleEquipment],
  );

  return (
    <div style={styles.containerStyle}>
      {/* Combat Rules */}
      <div style={styles.sectionStyle}>
        <div style={styles.sectionTitleStyle}>Combat Rules</div>
        <div style={styles.gridStyle}>
          {(Object.keys(DUEL_RULE_DEFINITIONS) as Array<keyof DuelRules>).map(
            (rule) => (
              <div
                key={rule}
                style={getCheckboxStyle(theme, rules[rule])}
                onClick={() => handleRuleToggle(rule)}
                title={DUEL_RULE_DEFINITIONS[rule].description}
              >
                <input
                  type="checkbox"
                  checked={rules[rule]}
                  onChange={() => {}}
                  style={{ cursor: "pointer" }}
                />
                <span>{DUEL_RULE_DEFINITIONS[rule].label}</span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Equipment Restrictions */}
      <div style={styles.sectionStyle}>
        <div style={styles.sectionTitleStyle}>Disabled Equipment</div>
        <div style={styles.gridStyle}>
          {EQUIPMENT_SLOTS_ORDERED.map((slot: DuelEquipmentSlot) => (
            <div
              key={slot}
              style={getCheckboxStyle(theme, equipmentRestrictions[slot])}
              onClick={() => handleEquipmentToggle(slot)}
            >
              <input
                type="checkbox"
                checked={equipmentRestrictions[slot]}
                onChange={() => {}}
                style={{ cursor: "pointer" }}
              />
              <span>No {EQUIPMENT_SLOT_LABELS[slot]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Acceptance Status */}
      <div style={styles.sectionStyle}>
        <div style={styles.acceptanceStyle}>
          <span>
            <span style={getStatusDotStyle(theme, myAccepted)} />
            You: {myAccepted ? "Accepted" : "Not accepted"}
          </span>
          <span>
            <span style={getStatusDotStyle(theme, opponentAccepted)} />
            {opponentName}: {opponentAccepted ? "Accepted" : "Not accepted"}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div style={styles.buttonContainerStyle}>
        <button
          onClick={onAccept}
          style={styles.acceptButtonStyle}
          disabled={myAccepted}
        >
          {myAccepted ? "Waiting..." : "Accept Rules"}
        </button>
        <button onClick={onCancel} style={styles.cancelButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}
