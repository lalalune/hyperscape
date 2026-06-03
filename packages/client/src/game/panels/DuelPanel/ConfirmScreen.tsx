/**
 * Duel Confirmation Screen
 *
 * Final read-only review before duel combat begins.
 * Shows summary of rules, equipment restrictions, and stakes.
 *
 * OSRS-style features:
 * - Cannot modify settings on this screen
 * - Both players must accept for duel to begin
 * - Clear display of what each player risks
 */

import { useMemo, type CSSProperties } from "react";
import { useThemeStore, type Theme } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import {
  getItem,
  type DuelRules,
  type EquipmentRestrictions,
  type StakedItem,
  DUEL_RULE_LABELS,
  EQUIPMENT_SLOT_LABELS,
} from "@hyperforge/shared";
import { formatQuantity, formatGoldValue, calculateTotalValue } from "./utils";

// ============================================================================
// Types
// ============================================================================

interface ConfirmScreenProps {
  rules: DuelRules;
  equipmentRestrictions: EquipmentRestrictions;
  myStakes: StakedItem[];
  opponentStakes: StakedItem[];
  myAccepted: boolean;
  opponentAccepted: boolean;
  opponentName: string;
  onAccept: () => void;
  onCancel: () => void;
}

// ============================================================================
// Memoized Styles Hook
// ============================================================================

function useConfirmScreenStyles(theme: Theme, myAccepted: boolean) {
  return useMemo(() => {
    const sectionStyle: CSSProperties = {
      ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    };

    const sectionHeaderStyle: CSSProperties = {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
      borderBottom: `1px solid ${theme.colors.border.default}`,
      paddingBottom: theme.spacing.xs,
    };

    const listStyle: CSSProperties = {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.secondary,
      lineHeight: 1.6,
    };

    const warningStyle: CSSProperties = {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.state.warning,
      fontStyle: "italic",
    };

    const stakeRowStyle: CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.text.secondary,
      padding: `${theme.spacing.xs / 2}px 0`,
    };

    const totalStyle: CSSProperties = {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.accent.gold,
      textAlign: "right",
      marginTop: theme.spacing.xs,
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
      marginTop: theme.spacing.sm,
      border: `1px solid ${theme.colors.border.default}40`,
    };

    const buttonContainerStyle: CSSProperties = {
      display: "flex",
      gap: theme.spacing.md,
      marginTop: theme.spacing.sm,
    };

    const baseButtonStyle: CSSProperties = {
      flex: 1,
      padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
      borderRadius: theme.borderRadius.md,
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      cursor: "pointer",
      transition: "all 0.2s ease",
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

    const warningBannerStyle: CSSProperties = {
      background: `${theme.colors.state.warning}22`,
      border: `1px solid ${theme.colors.state.warning}`,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.state.warning,
      fontWeight: theme.typography.fontWeight.bold,
    };

    const columnsContainerStyle: CSSProperties = {
      display: "flex",
      gap: theme.spacing.sm,
      flex: 1,
    };

    return {
      sectionStyle,
      sectionHeaderStyle,
      listStyle,
      warningStyle,
      stakeRowStyle,
      totalStyle,
      acceptanceStyle,
      buttonContainerStyle,
      acceptButtonStyle,
      cancelButtonStyle,
      warningBannerStyle,
      columnsContainerStyle,
    };
  }, [theme, myAccepted]);
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

export function ConfirmScreen({
  rules,
  equipmentRestrictions,
  myStakes,
  opponentStakes,
  myAccepted,
  opponentAccepted,
  opponentName,
  onAccept,
  onCancel,
}: ConfirmScreenProps) {
  const theme = useThemeStore((s) => s.theme);

  // Memoized styles - only recalculated when theme or myAccepted changes
  const styles = useConfirmScreenStyles(theme, myAccepted);

  // Get active rules
  const activeRules = useMemo(() => {
    return (Object.keys(rules) as Array<keyof DuelRules>).filter(
      (key) => rules[key],
    );
  }, [rules]);

  // Get disabled equipment
  const disabledEquipment = useMemo(() => {
    return (
      Object.keys(equipmentRestrictions) as Array<keyof EquipmentRestrictions>
    ).filter((key) => equipmentRestrictions[key]);
  }, [equipmentRestrictions]);

  // Calculate totals
  const myTotalValue = useMemo(() => calculateTotalValue(myStakes), [myStakes]);
  const opponentTotalValue = useMemo(
    () => calculateTotalValue(opponentStakes),
    [opponentStakes],
  );

  // Render stake item
  const renderStakeItem = (item: StakedItem) => {
    const itemData = getItem(item.itemId);
    const displayName = itemData?.name || item.itemId;

    return (
      <div key={item.inventorySlot} style={styles.stakeRowStyle}>
        <span>
          {displayName}
          {item.quantity > 1 && ` x${formatQuantity(item.quantity)}`}
        </span>
        <span>{formatGoldValue(item.value)} gp</span>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Warning Banner */}
      <div style={styles.warningBannerStyle}>
        This is your final chance to review before the duel begins!
      </div>

      <div style={styles.columnsContainerStyle}>
        {/* Left Column - Rules & Equipment */}
        <div style={{ flex: 1 }}>
          {/* Active Rules */}
          <div style={styles.sectionStyle}>
            <div style={styles.sectionHeaderStyle}>Active Rules</div>
            {activeRules.length === 0 ? (
              <div style={styles.listStyle}>No combat restrictions</div>
            ) : (
              <div style={styles.listStyle}>
                {activeRules.map((rule) => (
                  <div key={rule}>• {DUEL_RULE_LABELS[rule]}</div>
                ))}
              </div>
            )}
          </div>

          {/* Disabled Equipment */}
          <div style={styles.sectionStyle}>
            <div style={styles.sectionHeaderStyle}>Disabled Equipment</div>
            {disabledEquipment.length === 0 ? (
              <div style={styles.listStyle}>All equipment allowed</div>
            ) : (
              <div style={styles.listStyle}>
                {disabledEquipment.map((slot) => (
                  <div key={slot}>• {EQUIPMENT_SLOT_LABELS[slot]}</div>
                ))}
              </div>
            )}
            {disabledEquipment.length > 0 && (
              <div style={styles.warningStyle}>
                Items in these slots will be unequipped before the duel.
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Stakes */}
        <div style={{ flex: 1 }}>
          {/* You receive if you win */}
          <div style={styles.sectionStyle}>
            <div style={styles.sectionHeaderStyle}>
              If You Win, You Receive:
            </div>
            {opponentStakes.length === 0 ? (
              <div style={styles.listStyle}>Nothing staked</div>
            ) : (
              <>
                {opponentStakes.map(renderStakeItem)}
                <div style={styles.totalStyle}>
                  Total: {formatGoldValue(opponentTotalValue)} gp
                </div>
              </>
            )}
          </div>

          {/* They receive if you lose */}
          <div style={styles.sectionStyle}>
            <div style={styles.sectionHeaderStyle}>
              If You Lose, They Receive:
            </div>
            {myStakes.length === 0 ? (
              <div style={styles.listStyle}>Nothing staked</div>
            ) : (
              <>
                {myStakes.map(renderStakeItem)}
                <div style={styles.totalStyle}>
                  Total: {formatGoldValue(myTotalValue)} gp
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Acceptance Status */}
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

      {/* Buttons */}
      <div style={styles.buttonContainerStyle}>
        <button
          onClick={onAccept}
          style={styles.acceptButtonStyle}
          disabled={myAccepted}
        >
          {myAccepted ? "Waiting for opponent..." : "Accept & Start Duel"}
        </button>
        <button onClick={onCancel} style={styles.cancelButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}
