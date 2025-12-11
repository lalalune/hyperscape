/**
 * Bank Tabs Handler Integration Tests
 *
 * Tests the bank tab management handler flows with mocked dependencies.
 * These tests verify handler behavior at the integration boundary.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { SessionType } from "@hyperscape/shared";

// Mock the common utilities
vi.mock("../../../src/systems/ServerNetwork/handlers/common", () => ({
  validateTransactionRequest: vi.fn(),
  executeSecureTransaction: vi.fn(),
  sendErrorToast: vi.fn(),
}));

// Mock the bank utils
vi.mock("../../../src/systems/ServerNetwork/handlers/bank/utils", () => ({
  rateLimiter: { check: vi.fn().mockReturnValue(true) },
  compactBankSlots: vi.fn(),
  sendBankStateWithTabs: vi.fn(),
}));

// Mock the services
vi.mock("../../../src/systems/ServerNetwork/services", () => ({
  isValidBankSlot: vi.fn().mockReturnValue(true),
  isValidBankTabIndex: vi.fn().mockReturnValue(true),
  isValidCustomBankTabIndex: vi.fn().mockReturnValue(true),
}));

import {
  handleBankCreateTab,
  handleBankDeleteTab,
  handleBankMoveToTab,
} from "../../../src/systems/ServerNetwork/handlers/bank";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendErrorToast,
} from "../../../src/systems/ServerNetwork/handlers/common";

import { sendBankStateWithTabs } from "../../../src/systems/ServerNetwork/handlers/bank/utils";

import {
  isValidBankSlot,
  isValidBankTabIndex,
  isValidCustomBankTabIndex,
} from "../../../src/systems/ServerNetwork/services";

import {
  createMockSocket,
  createMockWorld,
  createMockContext,
  createMockValidationFailure,
  type MockSocket,
  type MockWorld,
} from "./helpers";

describe("Bank Create Tab Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankCreateTab", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankCreateTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, newTabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid source slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(false);

      await handleBankCreateTab(
        mockSocket as never,
        { fromSlot: -1, fromTabIndex: 0, newTabIndex: 1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid slot");
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid source tab", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(false);

      await handleBankCreateTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: -1, newTabIndex: 1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid source tab",
      );
    });

    it("sends error toast for invalid new tab index", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidCustomBankTabIndex as Mock).mockReturnValue(false);

      await handleBankCreateTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, newTabIndex: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid new tab index",
      );
    });

    it("executes transaction for valid create tab request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidCustomBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankCreateTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, newTabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful tab creation", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidCustomBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankCreateTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, newTabIndex: 1 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });
  });
});

describe("Bank Delete Tab Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankDeleteTab", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankDeleteTab(
        mockSocket as never,
        { tabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast when trying to delete main tab", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidCustomBankTabIndex as Mock).mockReturnValue(false);

      await handleBankDeleteTab(
        mockSocket as never,
        { tabIndex: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Cannot delete main tab",
      );
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes transaction for valid delete tab request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidCustomBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankDeleteTab(
        mockSocket as never,
        { tabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful tab deletion", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidCustomBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankDeleteTab(
        mockSocket as never,
        { tabIndex: 1 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });
  });
});

describe("Bank Move To Tab Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankMoveToTab", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, toTabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(false);

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: -1, fromTabIndex: 0, toTabIndex: 1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid slot");
    });

    it("sends error toast for invalid source tab", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValueOnce(false);

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: -1, toTabIndex: 1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid source tab",
      );
    });

    it("sends error toast for invalid destination tab", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock)
        .mockReturnValueOnce(true) // fromTabIndex
        .mockReturnValueOnce(false); // toTabIndex

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, toTabIndex: -1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid destination tab",
      );
    });

    it("returns early when moving to same tab (no-op)", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 1, toTabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes transaction for valid move request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, toTabIndex: 1 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("supports toSlot parameter for specific positioning", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, toTabIndex: 1, toSlot: 5 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful move", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankMoveToTab(
        mockSocket as never,
        { fromSlot: 0, fromTabIndex: 0, toTabIndex: 1 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });
  });
});
