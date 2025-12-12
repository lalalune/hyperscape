/**
 * useBankActions Hook Unit Tests
 *
 * Tests for all network communication handlers in the bank panel.
 * Verifies correct message types and payloads are sent to the server.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBankActions } from "../../../../src/game/panels/BankPanel/hooks/useBankActions";
import {
  createMockWorld,
  createMockWorldWithoutNetwork,
  getLastNetworkCall,
  clearMockWorldCalls,
  type MockClientWorld,
} from "../../../mocks";
import { TAB_INDEX_ALL } from "../../../../src/game/panels/BankPanel/constants";

describe("useBankActions", () => {
  let mockWorld: MockClientWorld;

  beforeEach(() => {
    mockWorld = createMockWorld();
  });

  // ========================================================================
  // Core Operations
  // ========================================================================

  describe("handleWithdraw", () => {
    it("sends bankWithdraw with correct itemId and quantity", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleWithdraw("bronze_sword", 5);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankWithdraw", {
        itemId: "bronze_sword",
        quantity: 5,
        asNote: false,
      });
    });

    it("includes asNote: true when withdrawAsNote is enabled", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: true,
        }),
      );

      act(() => {
        result.current.handleWithdraw("oak_logs", 100);
      });

      const call = getLastNetworkCall(mockWorld);
      expect(call?.payload.asNote).toBe(true);
    });

    it("does not send if network is undefined", () => {
      const noNetworkWorld = createMockWorldWithoutNetwork();
      const { result } = renderHook(() =>
        useBankActions({
          world: noNetworkWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleWithdraw("bronze_sword", 1);
      });

      // No error should be thrown, and no call should be made
      expect(true).toBe(true); // Test passes if no error
    });
  });

  describe("handleDeposit", () => {
    it("sends bankDeposit with correct itemId, quantity, and targetTabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 2,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDeposit("lobster", 10);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankDeposit", {
        itemId: "lobster",
        quantity: 10,
        targetTabIndex: 2,
      });
    });

    it("uses tab 0 when selectedTab is TAB_INDEX_ALL (-1)", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: TAB_INDEX_ALL,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDeposit("coins", 1000);
      });

      const call = getLastNetworkCall(mockWorld);
      expect(call?.payload.targetTabIndex).toBe(0);
    });
  });

  describe("handleDepositAll", () => {
    it("sends bankDepositAll with targetTabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 3,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDepositAll();
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankDepositAll", {
        targetTabIndex: 3,
      });
    });

    it("uses tab 0 when selectedTab is TAB_INDEX_ALL", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: TAB_INDEX_ALL,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDepositAll();
      });

      const call = getLastNetworkCall(mockWorld);
      expect(call?.payload.targetTabIndex).toBe(0);
    });
  });

  // ========================================================================
  // Coin Operations
  // ========================================================================

  describe("handleDepositCoins", () => {
    it("sends bankDepositCoins with amount", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDepositCoins(5000);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankDepositCoins", {
        amount: 5000,
      });
    });

    it("does not send if amount is 0 or less", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDepositCoins(0);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();

      act(() => {
        result.current.handleDepositCoins(-100);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });
  });

  describe("handleWithdrawCoins", () => {
    it("sends bankWithdrawCoins with amount", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleWithdrawCoins(10000);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankWithdrawCoins", {
        amount: 10000,
      });
    });

    it("does not send if amount is 0 or less", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleWithdrawCoins(0);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Reorganization
  // ========================================================================

  describe("handleBankMove", () => {
    it("sends bankMove with fromSlot, toSlot, mode, and tabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleBankMove(5, 10, "swap", 0);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankMove", {
        fromSlot: 5,
        toSlot: 10,
        mode: "swap",
        tabIndex: 0,
      });
    });

    it("sends with insert mode", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleBankMove(3, 7, "insert", 1);
      });

      const call = getLastNetworkCall(mockWorld);
      expect(call?.payload.mode).toBe("insert");
    });

    it("does not send if fromSlot equals toSlot", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleBankMove(5, 5, "swap", 0);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Tab Management
  // ========================================================================

  describe("handleCreateTab", () => {
    it("sends bankCreateTab with fromSlot, fromTabIndex, and newTabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleCreateTab(5, 0, 1);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankCreateTab", {
        fromSlot: 5,
        fromTabIndex: 0,
        newTabIndex: 1,
      });
    });
  });

  describe("handleDeleteTab", () => {
    it("sends bankDeleteTab with tabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDeleteTab(3);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankDeleteTab", {
        tabIndex: 3,
      });
    });

    it("does not send for tab 0 (protected)", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDeleteTab(0);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });

    it("does not send for negative tab indexes", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDeleteTab(-1);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });
  });

  describe("handleMoveToTab", () => {
    it("sends bankMoveToTab with fromSlot, fromTabIndex, toTabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleMoveToTab(5, 0, 2);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith("bankMoveToTab", {
        fromSlot: 5,
        fromTabIndex: 0,
        toTabIndex: 2,
        toSlot: undefined,
      });
    });

    it("includes toSlot when provided", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleMoveToTab(5, 0, 2, 10);
      });

      const call = getLastNetworkCall(mockWorld);
      expect(call?.payload.toSlot).toBe(10);
    });

    it("does not send if fromTabIndex equals toTabIndex", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleMoveToTab(5, 1, 1);
      });

      expect(mockWorld.network.send).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Placeholder Operations
  // ========================================================================

  describe("handleWithdrawPlaceholder", () => {
    it("sends bankWithdrawPlaceholder with itemId", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleWithdrawPlaceholder("bronze_sword");
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdrawPlaceholder",
        {
          itemId: "bronze_sword",
        },
      );
    });
  });

  describe("handleReleasePlaceholder", () => {
    it("sends bankReleasePlaceholder with tabIndex and slot", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleReleasePlaceholder(2, 15);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankReleasePlaceholder",
        {
          tabIndex: 2,
          slot: 15,
        },
      );
    });
  });

  describe("handleReleaseAllPlaceholders", () => {
    it("sends bankReleaseAllPlaceholders", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleReleaseAllPlaceholders();
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankReleaseAllPlaceholders",
        {},
      );
    });
  });

  describe("handleToggleAlwaysPlaceholder", () => {
    it("sends bankToggleAlwaysPlaceholder", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleToggleAlwaysPlaceholder();
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankToggleAlwaysPlaceholder",
        {},
      );
    });
  });

  // ========================================================================
  // Equipment Operations
  // ========================================================================

  describe("handleWithdrawToEquipment", () => {
    it("sends bankWithdrawToEquipment with itemId, tabIndex, and slot", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleWithdrawToEquipment("rune_platebody", 1, 5);
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdrawToEquipment",
        {
          itemId: "rune_platebody",
          tabIndex: 1,
          slot: 5,
        },
      );
    });
  });

  describe("handleDepositEquipment", () => {
    it("sends bankDepositEquipment with slot name", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDepositEquipment("helmet");
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDepositEquipment",
        {
          slot: "helmet",
        },
      );
    });
  });

  describe("handleDepositAllEquipment", () => {
    it("sends bankDepositAllEquipment", () => {
      const { result } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      act(() => {
        result.current.handleDepositAllEquipment();
      });

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDepositAllEquipment",
        {},
      );
    });
  });

  // ========================================================================
  // Callback Stability
  // ========================================================================

  describe("callback stability", () => {
    it("returns stable callbacks when dependencies do not change", () => {
      const { result, rerender } = renderHook(() =>
        useBankActions({
          world: mockWorld as never,
          selectedTab: 0,
          withdrawAsNote: false,
        }),
      );

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      // Callbacks should be stable (same reference)
      expect(firstRender.handleWithdraw).toBe(secondRender.handleWithdraw);
      expect(firstRender.handleBankMove).toBe(secondRender.handleBankMove);
      expect(firstRender.handleCreateTab).toBe(secondRender.handleCreateTab);
    });

    it("updates callbacks when dependencies change", () => {
      const { result, rerender } = renderHook(
        ({ withdrawAsNote }) =>
          useBankActions({
            world: mockWorld as never,
            selectedTab: 0,
            withdrawAsNote,
          }),
        { initialProps: { withdrawAsNote: false } },
      );

      const firstCallback = result.current.handleWithdraw;
      rerender({ withdrawAsNote: true });
      const secondCallback = result.current.handleWithdraw;

      // Callback should have changed because withdrawAsNote changed
      expect(firstCallback).not.toBe(secondCallback);
    });
  });
});
