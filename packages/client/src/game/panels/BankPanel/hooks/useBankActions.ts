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

/**
 * Log network errors for debugging
 * In production, this could emit events for UI toast notifications
 */
function logNetworkError(action: string, error?: unknown): void {
  if (error) {
    console.error(`[BankActions] ${action} failed:`, error);
  } else {
    console.warn(`[BankActions] ${action}: Network unavailable`);
  }
}

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
      if (!world.network?.send) {
        logNetworkError("Withdraw");
        return;
      }
      try {
        // BANK NOTE SYSTEM: Include asNote flag for noted withdrawal
        world.network.send("bankWithdraw", {
          itemId,
          quantity,
          asNote: withdrawAsNote,
        });
      } catch (error) {
        logNetworkError("Withdraw", error);
      }
    },
    [world.network, withdrawAsNote],
  );

  const handleDeposit = useCallback(
    (itemId: string, quantity: number) => {
      if (!world.network?.send) {
        logNetworkError("Deposit");
        return;
      }
      try {
        // RS3-style: New items go to currently viewed tab (or tab 0 if viewing All)
        const targetTab = selectedTab === TAB_INDEX_ALL ? 0 : selectedTab;
        world.network.send("bankDeposit", {
          itemId,
          quantity,
          targetTabIndex: targetTab,
        });
      } catch (error) {
        logNetworkError("Deposit", error);
      }
    },
    [world.network, selectedTab],
  );

  const handleDepositAll = useCallback(() => {
    if (!world.network?.send) {
      logNetworkError("DepositAll");
      return;
    }
    try {
      // RS3-style: New items go to currently viewed tab (or tab 0 if viewing All)
      const targetTab = selectedTab === TAB_INDEX_ALL ? 0 : selectedTab;
      world.network.send("bankDepositAll", { targetTabIndex: targetTab });
    } catch (error) {
      logNetworkError("DepositAll", error);
    }
  }, [world.network, selectedTab]);

  // ========== COIN OPERATIONS ==========

  const handleDepositCoins = useCallback(
    (amount: number) => {
      if (!world.network?.send) {
        logNetworkError("DepositCoins");
        return;
      }
      if (amount <= 0) return;
      try {
        world.network.send("bankDepositCoins", { amount });
      } catch (error) {
        logNetworkError("DepositCoins", error);
      }
    },
    [world.network],
  );

  const handleWithdrawCoins = useCallback(
    (amount: number) => {
      if (!world.network?.send) {
        logNetworkError("WithdrawCoins");
        return;
      }
      if (amount <= 0) return;
      try {
        world.network.send("bankWithdrawCoins", { amount });
      } catch (error) {
        logNetworkError("WithdrawCoins", error);
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
      if (!world.network?.send) {
        logNetworkError("BankMove");
        return;
      }
      if (fromSlot === toSlot) return;
      try {
        world.network.send("bankMove", { fromSlot, toSlot, mode, tabIndex });
      } catch (error) {
        logNetworkError("BankMove", error);
      }
    },
    [world.network],
  );

  // ========== TAB MANAGEMENT ==========

  const handleCreateTab = useCallback(
    (fromSlot: number, fromTabIndex: number, newTabIndex: number) => {
      if (!world.network?.send) {
        logNetworkError("CreateTab");
        return;
      }
      try {
        world.network.send("bankCreateTab", {
          fromSlot,
          fromTabIndex,
          newTabIndex,
        });
      } catch (error) {
        logNetworkError("CreateTab", error);
      }
    },
    [world.network],
  );

  const handleDeleteTab = useCallback(
    (tabIndex: number) => {
      if (!world.network?.send) {
        logNetworkError("DeleteTab");
        return;
      }
      if (tabIndex <= 0) return;
      try {
        world.network.send("bankDeleteTab", { tabIndex });
      } catch (error) {
        logNetworkError("DeleteTab", error);
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
      if (!world.network?.send) {
        logNetworkError("MoveToTab");
        return;
      }
      if (fromTabIndex === toTabIndex) return;
      try {
        world.network.send("bankMoveToTab", {
          fromSlot,
          fromTabIndex,
          toTabIndex,
          toSlot,
        });
      } catch (error) {
        logNetworkError("MoveToTab", error);
      }
    },
    [world.network],
  );

  // ========== PLACEHOLDER OPERATIONS (RS3-style) ==========

  const handleWithdrawPlaceholder = useCallback(
    (itemId: string) => {
      if (!world.network?.send) {
        logNetworkError("WithdrawPlaceholder");
        return;
      }
      try {
        world.network.send("bankWithdrawPlaceholder", { itemId });
      } catch (error) {
        logNetworkError("WithdrawPlaceholder", error);
      }
    },
    [world.network],
  );

  const handleReleasePlaceholder = useCallback(
    (tabIndex: number, slot: number) => {
      if (!world.network?.send) {
        logNetworkError("ReleasePlaceholder");
        return;
      }
      try {
        world.network.send("bankReleasePlaceholder", { tabIndex, slot });
      } catch (error) {
        logNetworkError("ReleasePlaceholder", error);
      }
    },
    [world.network],
  );

  const handleReleaseAllPlaceholders = useCallback(() => {
    if (!world.network?.send) {
      logNetworkError("ReleaseAllPlaceholders");
      return;
    }
    try {
      world.network.send("bankReleaseAllPlaceholders", {});
    } catch (error) {
      logNetworkError("ReleaseAllPlaceholders", error);
    }
  }, [world.network]);

  const handleToggleAlwaysPlaceholder = useCallback(() => {
    if (!world.network?.send) {
      logNetworkError("ToggleAlwaysPlaceholder");
      return;
    }
    try {
      world.network.send("bankToggleAlwaysPlaceholder", {});
    } catch (error) {
      logNetworkError("ToggleAlwaysPlaceholder", error);
    }
  }, [world.network]);

  // ========== EQUIPMENT OPERATIONS (RS3-style) ==========

  const handleWithdrawToEquipment = useCallback(
    (itemId: string, tabIndex: number, slot: number) => {
      if (!world.network?.send) {
        logNetworkError("WithdrawToEquipment");
        return;
      }
      try {
        world.network.send("bankWithdrawToEquipment", {
          itemId,
          tabIndex,
          slot,
        });
      } catch (error) {
        logNetworkError("WithdrawToEquipment", error);
      }
    },
    [world.network],
  );

  const handleDepositEquipment = useCallback(
    (slot: string) => {
      if (!world.network?.send) {
        logNetworkError("DepositEquipment");
        return;
      }
      try {
        world.network.send("bankDepositEquipment", { slot });
      } catch (error) {
        logNetworkError("DepositEquipment", error);
      }
    },
    [world.network],
  );

  const handleDepositAllEquipment = useCallback(() => {
    if (!world.network?.send) {
      logNetworkError("DepositAllEquipment");
      return;
    }
    try {
      world.network.send("bankDepositAllEquipment", {});
    } catch (error) {
      logNetworkError("DepositAllEquipment", error);
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
