/**
 * Duel Panel
 *
 * Main duel interface that manages screen transitions based on duel state.
 * Displays the appropriate screen (Rules, Stakes, Confirm) based on
 * the current session state received from the server.
 *
 * Screen Flow:
 * 1. RULES - Both players negotiate rules and equipment
 * 2. STAKES - Both players add/remove staked items
 * 3. CONFIRMING - Final read-only review before combat
 * 4. COUNTDOWN - 3-2-1-FIGHT overlay (not shown in panel)
 * 5. FIGHTING - Panel closes, combat begins
 */

import { useCallback, type CSSProperties } from "react";
import { ModalWindow, useThemeStore } from "@/ui";
import { getPanelSurfaceStyle } from "@/ui/theme/themes";
import { RulesScreen } from "./RulesScreen";
import { StakesScreen } from "./StakesScreen";
import { ConfirmScreen } from "./ConfirmScreen";
import type {
  DuelRules,
  DuelEquipmentSlot,
  EquipmentRestrictions,
  StakedItem,
} from "@hyperforge/shared";

// ============================================================================
// Types
// ============================================================================

export type DuelScreenState = "RULES" | "STAKES" | "CONFIRMING";

export interface DuelPanelState {
  visible: boolean;
  duelId: string | null;
  screenState: DuelScreenState;
  opponentId: string;
  opponentName: string;
  isChallenger: boolean;

  // Rules screen
  rules: DuelRules;
  equipmentRestrictions: EquipmentRestrictions;
  myAccepted: boolean;
  opponentAccepted: boolean;

  // Stakes screen (Phase 4)
  myStakes: StakedItem[];
  opponentStakes: StakedItem[];
  myStakeValue: number;
  opponentStakeValue: number;
  /** Flag indicating opponent just modified their stakes (anti-scam) */
  opponentModifiedStakes: boolean;
}

interface InventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
}

interface DuelPanelProps {
  state: DuelPanelState;
  inventory: InventoryItem[];
  onToggleRule: (rule: keyof DuelRules) => void;
  onToggleEquipment: (slot: DuelEquipmentSlot) => void;
  onAcceptRules: () => void;
  onAddStake: (inventorySlot: number, quantity: number) => void;
  onRemoveStake: (stakeIndex: number) => void;
  onAcceptStakes: () => void;
  onAcceptFinal?: () => void;
  onCancel: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DuelPanel({
  state,
  inventory,
  onToggleRule,
  onToggleEquipment,
  onAcceptRules,
  onAddStake,
  onRemoveStake,
  onAcceptStakes,
  onAcceptFinal,
  onCancel,
}: DuelPanelProps) {
  const theme = useThemeStore((s) => s.theme);

  const handleClose = useCallback(() => {
    onCancel();
  }, [onCancel]);

  if (!state.visible || !state.duelId) return null;

  // Get title based on current screen
  const getTitle = (): string => {
    switch (state.screenState) {
      case "RULES":
        return `Duel with ${state.opponentName} - Rules`;
      case "STAKES":
        return `Duel with ${state.opponentName} - Stakes`;
      case "CONFIRMING":
        return `Duel with ${state.opponentName} - Confirm`;
      default:
        return `Duel with ${state.opponentName}`;
    }
  };

  const contentStyle: CSSProperties = {
    ...getPanelSurfaceStyle(theme, { emphasis: "normal" }),
    padding: theme.spacing.sm,
    minHeight: 400,
    display: "flex",
    flexDirection: "column",
  };

  // Render the appropriate screen based on state
  const renderScreen = () => {
    switch (state.screenState) {
      case "RULES":
        return (
          <RulesScreen
            rules={state.rules}
            equipmentRestrictions={state.equipmentRestrictions}
            myAccepted={state.myAccepted}
            opponentAccepted={state.opponentAccepted}
            opponentName={state.opponentName}
            onToggleRule={onToggleRule}
            onToggleEquipment={onToggleEquipment}
            onAccept={onAcceptRules}
            onCancel={onCancel}
          />
        );

      case "STAKES":
        return (
          <StakesScreen
            myStakes={state.myStakes}
            opponentStakes={state.opponentStakes}
            inventory={inventory}
            myAccepted={state.myAccepted}
            opponentAccepted={state.opponentAccepted}
            opponentName={state.opponentName}
            opponentModifiedStakes={state.opponentModifiedStakes}
            onAddStake={onAddStake}
            onRemoveStake={onRemoveStake}
            onAccept={onAcceptStakes}
            onCancel={onCancel}
          />
        );

      case "CONFIRMING":
        return (
          <ConfirmScreen
            rules={state.rules}
            equipmentRestrictions={state.equipmentRestrictions}
            myStakes={state.myStakes}
            opponentStakes={state.opponentStakes}
            myAccepted={state.myAccepted}
            opponentAccepted={state.opponentAccepted}
            opponentName={state.opponentName}
            onAccept={onAcceptFinal || (() => {})}
            onCancel={onCancel}
          />
        );

      default:
        return null;
    }
  };

  // Stakes screen needs more width for three panels, confirm screen for two columns
  const modalWidth =
    state.screenState === "STAKES"
      ? 650
      : state.screenState === "CONFIRMING"
        ? 520
        : 450;

  return (
    <ModalWindow
      visible={state.visible}
      onClose={handleClose}
      title={getTitle()}
      width={modalWidth}
      showCloseButton={false}
    >
      <div style={contentStyle}>{renderScreen()}</div>
    </ModalWindow>
  );
}

// ============================================================================
// Default State Factory
// ============================================================================

export function createDefaultDuelPanelState(): DuelPanelState {
  return {
    visible: false,
    duelId: null,
    screenState: "RULES",
    opponentId: "",
    opponentName: "",
    isChallenger: false,
    rules: {
      noRanged: false,
      noMelee: false,
      noMagic: false,
      noSpecialAttack: false,
      noPrayer: false,
      noPotions: false,
      noFood: false,
      noForfeit: false,
      noMovement: false,
      funWeapons: false,
    },
    equipmentRestrictions: {
      head: false,
      cape: false,
      amulet: false,
      weapon: false,
      body: false,
      shield: false,
      legs: false,
      gloves: false,
      boots: false,
      ring: false,
      ammo: false,
    },
    myAccepted: false,
    opponentAccepted: false,
    myStakes: [],
    opponentStakes: [],
    myStakeValue: 0,
    opponentStakeValue: 0,
    opponentModifiedStakes: false,
  };
}
