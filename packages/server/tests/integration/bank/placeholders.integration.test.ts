/**
 * Bank Placeholders Handler Integration Tests
 *
 * Tests the RS3-style placeholder handler flows with mocked dependencies.
 * These tests verify handler behavior at the integration boundary.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { SessionType } from "@hyperscape/shared";

// Mock the common utilities
vi.mock("../../../src/systems/ServerNetwork/handlers/common", () => ({
  validateTransactionRequest: vi.fn(),
  executeSecureTransaction: vi.fn(),
  executeInventoryTransaction: vi.fn(),
  sendToSocket: vi.fn(),
  sendErrorToast: vi.fn(),
  getPlayerId: vi.fn(),
  getDatabase: vi.fn(),
}));

// Mock the bank utils
vi.mock("../../../src/systems/ServerNetwork/handlers/bank/utils", () => ({
  rateLimiter: { check: vi.fn().mockReturnValue(true) },
  isValidGameItem: vi.fn().mockReturnValue(true),
  compactBankSlots: vi.fn(),
  sendBankStateWithTabs: vi.fn(),
  MAX_INVENTORY_SLOTS: 28,
}));

// Mock the services
vi.mock("../../../src/systems/ServerNetwork/services", () => ({
  isValidItemId: vi.fn().mockReturnValue(true),
  isValidBankTabIndex: vi.fn().mockReturnValue(true),
  isValidBankSlot: vi.fn().mockReturnValue(true),
}));

import {
  handleBankWithdrawPlaceholder,
  handleBankReleasePlaceholder,
  handleBankReleaseAllPlaceholders,
  handleBankToggleAlwaysPlaceholder,
} from "../../../src/systems/ServerNetwork/handlers/bank";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  executeInventoryTransaction,
  sendToSocket,
  sendErrorToast,
  getPlayerId,
  getDatabase,
} from "../../../src/systems/ServerNetwork/handlers/common";

import {
  isValidGameItem,
  sendBankStateWithTabs,
} from "../../../src/systems/ServerNetwork/handlers/bank/utils";

import {
  isValidItemId,
  isValidBankTabIndex,
  isValidBankSlot,
} from "../../../src/systems/ServerNetwork/services";

import {
  createMockSocket,
  createMockWorld,
  createMockContext,
  createMockValidationFailure,
  createMockDatabase,
  type MockSocket,
  type MockWorld,
} from "./helpers";

describe("Bank Withdraw Placeholder Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankWithdrawPlaceholder", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankWithdrawPlaceholder(
        mockSocket as never,
        { itemId: "logs" },
        mockWorld as never,
      );

      expect(executeInventoryTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid item ID", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(false);

      await handleBankWithdrawPlaceholder(
        mockSocket as never,
        { itemId: "" },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid item");
      expect(executeInventoryTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for unknown game item", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(false);

      await handleBankWithdrawPlaceholder(
        mockSocket as never,
        { itemId: "fake_item" },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "This item no longer exists",
      );
    });

    it("executes transaction for valid request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (executeInventoryTransaction as Mock).mockResolvedValue({
        withdrawnQty: 5,
      });

      await handleBankWithdrawPlaceholder(
        mockSocket as never,
        { itemId: "logs" },
        mockWorld as never,
      );

      expect(executeInventoryTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful operation", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (executeInventoryTransaction as Mock).mockResolvedValue({
        withdrawnQty: 5,
      });

      await handleBankWithdrawPlaceholder(
        mockSocket as never,
        { itemId: "logs" },
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

describe("Bank Release Placeholder Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankReleasePlaceholder", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankReleasePlaceholder(
        mockSocket as never,
        { tabIndex: 0, slot: 5 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid tab index", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankTabIndex as Mock).mockReturnValue(false);

      await handleBankReleasePlaceholder(
        mockSocket as never,
        { tabIndex: -1, slot: 5 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid tab");
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(false);

      await handleBankReleasePlaceholder(
        mockSocket as never,
        { tabIndex: 0, slot: -1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid slot");
    });

    it("executes transaction for valid request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankReleasePlaceholder(
        mockSocket as never,
        { tabIndex: 0, slot: 5 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful release", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankReleasePlaceholder(
        mockSocket as never,
        { tabIndex: 0, slot: 5 },
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

describe("Bank Release All Placeholders Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankReleaseAllPlaceholders", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankReleaseAllPlaceholders(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes transaction for valid request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        success: true,
        count: 3,
      });

      await handleBankReleaseAllPlaceholders(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful release", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        success: true,
        count: 3,
      });

      await handleBankReleaseAllPlaceholders(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });

    it("sends success toast after release", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        success: true,
        count: 5,
      });

      await handleBankReleaseAllPlaceholders(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "All placeholders released",
        type: "success",
      });
    });
  });
});

describe("Bank Toggle Always Placeholder Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankToggleAlwaysPlaceholder", () => {
    it("returns early when no player on socket", async () => {
      (getPlayerId as Mock).mockReturnValue(null);

      await handleBankToggleAlwaysPlaceholder(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(getDatabase).not.toHaveBeenCalled();
    });

    it("sends error toast when database unavailable", async () => {
      (getPlayerId as Mock).mockReturnValue("player-123");
      (getDatabase as Mock).mockReturnValue(null);

      await handleBankToggleAlwaysPlaceholder(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Server error - please try again",
      );
    });

    it("queries current setting and toggles it", async () => {
      const mockDb = createMockDatabase();
      const mockDrizzle = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ alwaysSetPlaceholder: 0 }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
      };
      mockDb.drizzle = mockDrizzle as never;

      (getPlayerId as Mock).mockReturnValue("player-123");
      (getDatabase as Mock).mockReturnValue(mockDb);

      await handleBankToggleAlwaysPlaceholder(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(mockDrizzle.select).toHaveBeenCalled();
    });
  });
});
