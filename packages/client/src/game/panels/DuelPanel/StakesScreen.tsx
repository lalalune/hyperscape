/**
 * Duel Stakes Screen
 *
 * Screen where both players stake items for the duel.
 * Similar to trade panel but for duel stakes.
 *
 * OSRS-style features:
 * - Left-click inventory item: stake 1
 * - Right-click: context menu for quantity options
 * - Both players must accept for duel to proceed
 * - Anti-scam: resets acceptance when stakes change
 */

import { useState, useCallback, useMemo, type CSSProperties } from "react";
import { useThemeStore, type Theme } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import type { StakedItem, SlotNumber } from "@hyperforge/shared";
import { formatGoldValue, calculateTotalValue } from "./utils";
import { StakeGrid, StakeInventoryPanel, StakeContextMenu } from "./components";

// ============================================================================
// Types
// ============================================================================

interface InventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
}

interface StakesScreenProps {
  myStakes: StakedItem[];
  opponentStakes: StakedItem[];
  inventory: InventoryItem[];
  myAccepted: boolean;
  opponentAccepted: boolean;
  opponentName: string;
  /** Shows warning when opponent modifies their stakes */
  opponentModifiedStakes?: boolean;
  onAddStake: (inventorySlot: number, quantity: number) => void;
  onRemoveStake: (stakeIndex: number) => void;
  onAccept: () => void;
  onCancel: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STAKE_GRID_COLS = 4;
const STAKE_GRID_ROWS = 7;
const STAKE_SLOTS = STAKE_GRID_COLS * STAKE_GRID_ROWS;
const INVENTORY_COLS = 4;
const INVENTORY_ROWS = 7;

// ============================================================================
// Memoized Styles Hook
// ============================================================================

function useStakesScreenStyles(theme: Theme, myAccepted: boolean) {
  return useMemo(() => {
    const containerStyle: CSSProperties = {
      display: "flex",
      gap: theme.spacing.md,
      height: "100%",
    };

    const panelStyle: CSSProperties = {
      flex: 1,
      minWidth: 0,
      ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    };

    const headerStyle: CSSProperties = {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.xs,
      textAlign: "center",
      borderBottom: `1px solid ${theme.colors.border.default}`,
      paddingBottom: theme.spacing.xs,
    };

    const gridStyle: CSSProperties = {
      display: "grid",
      gridTemplateColumns: `repeat(${STAKE_GRID_COLS}, 1fr)`,
      gap: 2,
      flex: 1,
      overflow: "hidden",
    };

    const quantityStyle: CSSProperties = {
      position: "absolute",
      bottom: 2,
      right: 2,
      fontSize: "10px",
      color: theme.colors.text.secondary,
      textShadow: "0 0 2px black",
    };

    const valueStyle: CSSProperties = {
      textAlign: "center",
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.accent.gold,
      marginTop: theme.spacing.xs,
      fontWeight: theme.typography.fontWeight.bold,
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
      background: `${theme.colors.state.warning}33`,
      border: `1px solid ${theme.colors.state.warning}`,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.state.warning,
      fontWeight: theme.typography.fontWeight.bold,
    };

    const inventoryPanelStyle: CSSProperties = {
      ...panelStyle,
      width: 160,
      minWidth: 160,
      maxWidth: 160,
      overflow: "hidden",
    };

    const inventoryGridStyle: CSSProperties = {
      display: "grid",
      gridTemplateColumns: `repeat(${INVENTORY_COLS}, 1fr)`,
      gap: 2,
      flex: 1,
      overflow: "hidden",
    };

    const contextMenuStyle: CSSProperties = {
      background:
        theme.name === "hyperia"
          ? "linear-gradient(180deg, rgba(44, 36, 24, 0.98) 0%, rgba(18, 15, 11, 0.98) 100%)"
          : theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.default}`,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.xs,
      zIndex: theme.zIndex.popover,
      boxShadow: `${theme.shadows.lg}, inset 0 1px 0 rgba(255,255,255,0.04)`,
    };

    const contextMenuItemStyle: CSSProperties = {
      padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
      cursor: "pointer",
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.text.primary,
    };

    return {
      containerStyle,
      panelStyle,
      headerStyle,
      gridStyle,
      quantityStyle,
      valueStyle,
      acceptanceStyle,
      buttonContainerStyle,
      acceptButtonStyle,
      cancelButtonStyle,
      warningBannerStyle,
      inventoryPanelStyle,
      inventoryGridStyle,
      contextMenuStyle,
      contextMenuItemStyle,
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

export function StakesScreen({
  myStakes,
  opponentStakes,
  inventory,
  myAccepted,
  opponentAccepted,
  opponentName,
  opponentModifiedStakes,
  onAddStake,
  onRemoveStake,
  onAccept,
  onCancel,
}: StakesScreenProps) {
  const theme = useThemeStore((s) => s.theme);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: InventoryItem;
  } | null>(null);

  // Memoized styles - only recalculated when theme or myAccepted changes
  const styles = useStakesScreenStyles(theme, myAccepted);

  // Calculate total values
  const myTotalValue = useMemo(() => calculateTotalValue(myStakes), [myStakes]);
  const opponentTotalValue = useMemo(
    () => calculateTotalValue(opponentStakes),
    [opponentStakes],
  );

  // Check for significant value imbalance (anti-scam)
  const valueImbalanceWarning = useMemo(() => {
    if (myTotalValue === 0 && opponentTotalValue === 0) return null;
    const difference = myTotalValue - opponentTotalValue;
    const percentDiff =
      Math.abs(difference) / Math.max(myTotalValue, opponentTotalValue, 1);
    // Warn if difference is > 50% and > 10k gp
    if (percentDiff > 0.5 && Math.abs(difference) > 10000) {
      if (difference > 0) {
        return `You are risking ${formatGoldValue(difference)} gp more than ${opponentName}!`;
      }
    }
    return null;
  }, [myTotalValue, opponentTotalValue, opponentName]);

  // Get staked inventory slots
  const stakedSlots = useMemo(
    () => new Set(myStakes.map((s) => s.inventorySlot)),
    [myStakes],
  );

  // Handle inventory left-click (stake 1)
  const handleInventoryClick = useCallback(
    (item: InventoryItem) => {
      if (!stakedSlots.has(item.slot as SlotNumber)) {
        onAddStake(item.slot, 1);
      }
    },
    [onAddStake, stakedSlots],
  );

  // Handle inventory right-click (show menu)
  const handleInventoryRightClick = useCallback(
    (e: React.MouseEvent, item: InventoryItem) => {
      e.preventDefault();
      if (!stakedSlots.has(item.slot as SlotNumber)) {
        setContextMenu({ x: e.clientX, y: e.clientY, item });
      }
    },
    [stakedSlots],
  );

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle context menu option
  const handleContextOption = useCallback(
    (quantity: number | "all") => {
      if (!contextMenu) return;
      const item = contextMenu.item;
      const qty =
        quantity === "all" ? item.quantity : Math.min(quantity, item.quantity);
      onAddStake(item.slot, qty);
      closeContextMenu();
    },
    [contextMenu, onAddStake, closeContextMenu],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Anti-scam warning banners */}
      {opponentModifiedStakes && (
        <div style={styles.warningBannerStyle}>
          Warning: {opponentName} has modified their stakes!
        </div>
      )}
      {valueImbalanceWarning && (
        <div style={styles.warningBannerStyle}>{valueImbalanceWarning}</div>
      )}

      <div style={styles.containerStyle}>
        {/* My Stakes */}
        <StakeGrid
          title="Your Stakes"
          stakes={myStakes}
          allStakes={myStakes}
          isMine={true}
          totalValue={myTotalValue}
          totalSlots={STAKE_SLOTS}
          theme={theme}
          panelStyle={styles.panelStyle}
          headerStyle={styles.headerStyle}
          gridStyle={styles.gridStyle}
          valueStyle={styles.valueStyle}
          quantityStyle={styles.quantityStyle}
          onRemoveStake={onRemoveStake}
        />

        {/* Opponent Stakes */}
        <StakeGrid
          title={`${opponentName}'s Stakes`}
          stakes={opponentStakes}
          allStakes={opponentStakes}
          isMine={false}
          totalValue={opponentTotalValue}
          totalSlots={STAKE_SLOTS}
          theme={theme}
          panelStyle={styles.panelStyle}
          headerStyle={styles.headerStyle}
          gridStyle={styles.gridStyle}
          valueStyle={styles.valueStyle}
          quantityStyle={styles.quantityStyle}
        />

        {/* Inventory */}
        <StakeInventoryPanel
          inventory={inventory}
          stakedSlots={stakedSlots}
          totalSlots={INVENTORY_COLS * INVENTORY_ROWS}
          theme={theme}
          panelStyle={styles.inventoryPanelStyle}
          headerStyle={styles.headerStyle}
          gridStyle={styles.inventoryGridStyle}
          quantityStyle={styles.quantityStyle}
          onItemClick={handleInventoryClick}
          onItemRightClick={handleInventoryRightClick}
        />
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
          {myAccepted ? "Waiting..." : "Accept Stakes"}
        </button>
        <button onClick={onCancel} style={styles.cancelButtonStyle}>
          Cancel
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <StakeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          theme={theme}
          menuStyle={styles.contextMenuStyle}
          menuItemStyle={styles.contextMenuItemStyle}
          onSelect={handleContextOption}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
