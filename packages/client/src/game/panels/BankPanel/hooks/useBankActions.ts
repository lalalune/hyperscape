/**
 * useBankActions Hook
 *
 * Encapsulates all bank network communication handlers.
 * Server-authoritative: these are fire-and-forget operations.
 * The server responds with updated bank state via props.
 */

import { useCallback } from "react";
import type { ClientWorld } from "../../../../types";
import { TAB_INDEX_ALL } from "../constants";

interface UseBankActionsConfig {
  world: ClientWorld;
  selectedTab: number;
  withdrawAsNote: boolean;
}

interface BankActions {
  // Core operations
  handleWithdraw: (itemId: string, quantity: number) => void;
  handleDeposit: (itemId: string, quantity: number) => void;
  handleDepositAll: () => void;

  // Coin operations
  handleDepositCoins: (amount: number) => void;
  handleWithdrawCoins: (amount: number) => void;

  // Reorganization
  handleBankMove: (
    fromSlot: number,
    toSlot: number,
    mode: "swap" | "insert",
    tabIndex: number,
  ) => void;

  // Tab management
  handleCreateTab: (
    fromSlot: number,
    fromTabIndex: number,
    newTabIndex: number,
  ) => void;
  handleDeleteTab: (tabIndex: number) => void;
  handleMoveToTab: (
    fromSlot: number,
    fromTabIndex: number,
    toTabIndex: number,
    toSlot?: number,
  ) => void;

  // Placeholder operations (RS3-style)
  handleWithdrawPlaceholder: (itemId: string) => void;
  handleReleasePlaceholder: (tabIndex: number, slot: number) => void;
  handleReleaseAllPlaceholders: () => void;
  handleToggleAlwaysPlaceholder: () => void;

  // Equipment operations (RS3-style)
  handleWithdrawToEquipment: (
    itemId: string,
    tabIndex: number,
    slot: number,
  ) => void;
  handleDepositEquipment: (slot: string) => void;
  handleDepositAllEquipment: () => void;
}

export function useBankActions({
  world,
  selectedTab,
  withdrawAsNote,
}: UseBankActionsConfig): BankActions {
  // ========== CORE OPERATIONS ==========

  const handleWithdraw = useCallback(
    (itemId: string, quantity: number) => {
      if (world.network?.send) {
        // BANK NOTE SYSTEM: Include asNote flag for noted withdrawal
        world.network.send("bankWithdraw", {
          itemId,
          quantity,
          asNote: withdrawAsNote,
        });
      }
    },
    [world.network, withdrawAsNote],
  );

  const handleDeposit = useCallback(
    (itemId: string, quantity: number) => {
      if (world.network?.send) {
        // RS3-style: New items go to currently viewed tab (or tab 0 if viewing All)
        const targetTab = selectedTab === TAB_INDEX_ALL ? 0 : selectedTab;
        world.network.send("bankDeposit", {
          itemId,
          quantity,
          targetTabIndex: targetTab,
        });
      }
    },
    [world.network, selectedTab],
  );

  const handleDepositAll = useCallback(() => {
    if (world.network?.send) {
      // RS3-style: New items go to currently viewed tab (or tab 0 if viewing All)
      const targetTab = selectedTab === TAB_INDEX_ALL ? 0 : selectedTab;
      world.network.send("bankDepositAll", { targetTabIndex: targetTab });
    }
  }, [world.network, selectedTab]);

  // ========== COIN OPERATIONS ==========

  const handleDepositCoins = useCallback(
    (amount: number) => {
      if (world.network?.send && amount > 0) {
        world.network.send("bankDepositCoins", { amount });
      }
    },
    [world.network],
  );

  const handleWithdrawCoins = useCallback(
    (amount: number) => {
      if (world.network?.send && amount > 0) {
        world.network.send("bankWithdrawCoins", { amount });
      }
    },
    [world.network],
  );

  // ========== REORGANIZATION ==========

  const handleBankMove = useCallback(
    (
      fromSlot: number,
      toSlot: number,
      mode: "swap" | "insert",
      tabIndex: number,
    ) => {
      if (world.network?.send && fromSlot !== toSlot) {
        world.network.send("bankMove", { fromSlot, toSlot, mode, tabIndex });
      }
    },
    [world.network],
  );

  // ========== TAB MANAGEMENT ==========

  const handleCreateTab = useCallback(
    (fromSlot: number, fromTabIndex: number, newTabIndex: number) => {
      if (world.network?.send) {
        world.network.send("bankCreateTab", {
          fromSlot,
          fromTabIndex,
          newTabIndex,
        });
      }
    },
    [world.network],
  );

  const handleDeleteTab = useCallback(
    (tabIndex: number) => {
      if (world.network?.send && tabIndex > 0) {
        world.network.send("bankDeleteTab", { tabIndex });
      }
    },
    [world.network],
  );

  const handleMoveToTab = useCallback(
    (
      fromSlot: number,
      fromTabIndex: number,
      toTabIndex: number,
      toSlot?: number,
    ) => {
      if (world.network?.send && fromTabIndex !== toTabIndex) {
        world.network.send("bankMoveToTab", {
          fromSlot,
          fromTabIndex,
          toTabIndex,
          toSlot,
        });
      }
    },
    [world.network],
  );

  // ========== PLACEHOLDER OPERATIONS (RS3-style) ==========

  const handleWithdrawPlaceholder = useCallback(
    (itemId: string) => {
      if (world.network?.send) {
        world.network.send("bankWithdrawPlaceholder", { itemId });
      }
    },
    [world.network],
  );

  const handleReleasePlaceholder = useCallback(
    (tabIndex: number, slot: number) => {
      if (world.network?.send) {
        world.network.send("bankReleasePlaceholder", { tabIndex, slot });
      }
    },
    [world.network],
  );

  const handleReleaseAllPlaceholders = useCallback(() => {
    if (world.network?.send) {
      world.network.send("bankReleaseAllPlaceholders", {});
    }
  }, [world.network]);

  const handleToggleAlwaysPlaceholder = useCallback(() => {
    if (world.network?.send) {
      world.network.send("bankToggleAlwaysPlaceholder", {});
    }
  }, [world.network]);

  // ========== EQUIPMENT OPERATIONS (RS3-style) ==========

  const handleWithdrawToEquipment = useCallback(
    (itemId: string, tabIndex: number, slot: number) => {
      if (world.network?.send) {
        world.network.send("bankWithdrawToEquipment", {
          itemId,
          tabIndex,
          slot,
        });
      }
    },
    [world.network],
  );

  const handleDepositEquipment = useCallback(
    (slot: string) => {
      if (world.network?.send) {
        world.network.send("bankDepositEquipment", { slot });
      }
    },
    [world.network],
  );

  const handleDepositAllEquipment = useCallback(() => {
    if (world.network?.send) {
      world.network.send("bankDepositAllEquipment", {});
    }
  }, [world.network]);

  return {
    handleWithdraw,
    handleDeposit,
    handleDepositAll,
    handleDepositCoins,
    handleWithdrawCoins,
    handleBankMove,
    handleCreateTab,
    handleDeleteTab,
    handleMoveToTab,
    handleWithdrawPlaceholder,
    handleReleasePlaceholder,
    handleReleaseAllPlaceholders,
    handleToggleAlwaysPlaceholder,
    handleWithdrawToEquipment,
    handleDepositEquipment,
    handleDepositAllEquipment,
  };
}
