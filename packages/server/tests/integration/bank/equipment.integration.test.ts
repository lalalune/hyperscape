/**
 * Bank Equipment Handler Integration Tests
 *
 * Tests the RS3-style equipment tab handler flows with mocked dependencies.
 * These tests verify handler behavior at the integration boundary.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { SessionType } from "@hyperscape/shared";

// Mock the common utilities
vi.mock("../../../src/systems/ServerNetwork/handlers/common", () => ({
  validateTransactionRequest: vi.fn(),
  executeSecureTransaction: vi.fn(),
  sendToSocket: vi.fn(),
  sendErrorToast: vi.fn(),
}));

// Mock the bank utils
vi.mock("../../../src/systems/ServerNetwork/handlers/bank/utils", () => ({
  rateLimiter: { check: vi.fn().mockReturnValue(true) },
  isValidGameItem: vi.fn().mockReturnValue(true),
  compactBankSlots: vi.fn(),
  sendBankStateWithTabs: vi.fn(),
  MAX_BANK_SLOTS: 800,
}));

// Mock the services
vi.mock("../../../src/systems/ServerNetwork/services", () => ({
  isValidItemId: vi.fn().mockReturnValue(true),
  isValidBankTabIndex: vi.fn().mockReturnValue(true),
  isValidBankSlot: vi.fn().mockReturnValue(true),
}));

import {
  handleBankWithdrawToEquipment,
  handleBankDepositEquipment,
  handleBankDepositAllEquipment,
} from "../../../src/systems/ServerNetwork/handlers/bank";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendToSocket,
  sendErrorToast,
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
  createMockEquipmentSystem,
  type MockSocket,
  type MockWorld,
} from "./helpers";

describe("Bank Withdraw To Equipment Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankWithdrawToEquipment", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "bronze_sword", tabIndex: 0, slot: 0 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid item ID", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(false);

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "", tabIndex: 0, slot: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid item");
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for unknown game item", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(false);

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "fake_item", tabIndex: 0, slot: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "This item no longer exists",
      );
    });

    it("sends error toast for invalid tab index", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(false);

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "bronze_sword", tabIndex: -1, slot: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid tab");
    });

    it("sends error toast for invalid slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(false);

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "bronze_sword", tabIndex: 0, slot: -1 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid slot");
    });

    it("sends error toast when equipment system unavailable", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);

      const worldWithoutEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(null),
      };

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "bronze_sword", tabIndex: 0, slot: 0 },
        worldWithoutEquipment as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Equipment system unavailable",
      );
    });

    it("sends error toast when item is not equipable", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);

      const equipSystem = createMockEquipmentSystem({
        getEquipmentSlotForItem: vi.fn().mockReturnValue(null),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "logs", tabIndex: 0, slot: 0 },
        worldWithEquipment as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "This item cannot be equipped",
      );
    });

    it("sends error toast when player does not meet requirements", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);

      const equipSystem = createMockEquipmentSystem({
        getEquipmentSlotForItem: vi.fn().mockReturnValue("weapon"),
        canPlayerEquipItem: vi.fn().mockReturnValue(false),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "rune_sword", tabIndex: 0, slot: 0 },
        worldWithEquipment as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "You don't meet the requirements for this item",
      );
    });

    it("executes transaction when all validations pass", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        equippedSlot: "weapon",
      });

      const equipSystem = createMockEquipmentSystem();

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "bronze_sword", tabIndex: 0, slot: 0 },
        worldWithEquipment as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful operation", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidItemId as Mock).mockReturnValue(true);
      (isValidGameItem as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (isValidBankSlot as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        equippedSlot: "weapon",
      });

      const equipSystem = createMockEquipmentSystem();

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankWithdrawToEquipment(
        mockSocket as never,
        { itemId: "bronze_sword", tabIndex: 0, slot: 0 },
        worldWithEquipment as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });
  });
});

describe("Bank Deposit Equipment Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankDepositEquipment", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankDepositEquipment(
        mockSocket as never,
        { slot: "weapon" },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid equipment slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });

      await handleBankDepositEquipment(
        mockSocket as never,
        { slot: "invalid_slot" },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid equipment slot",
      );
    });

    it("sends error toast when equipment system unavailable", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });

      const worldWithoutEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(null),
      };

      await handleBankDepositEquipment(
        mockSocket as never,
        { slot: "weapon" },
        worldWithoutEquipment as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Equipment system unavailable",
      );
    });

    it("executes transaction for valid equipment slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedItemId: "bronze_sword",
      });

      const equipSystem = createMockEquipmentSystem();

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositEquipment(
        mockSocket as never,
        { slot: "weapon" },
        worldWithEquipment as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful deposit", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedItemId: "bronze_sword",
      });

      const equipSystem = createMockEquipmentSystem();

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositEquipment(
        mockSocket as never,
        { slot: "weapon" },
        worldWithEquipment as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });

    it("sends success toast after deposit", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedItemId: "bronze_sword",
      });

      const equipSystem = createMockEquipmentSystem();

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositEquipment(
        mockSocket as never,
        { slot: "weapon" },
        worldWithEquipment as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "Deposited equipment to bank",
        type: "success",
      });
    });
  });
});

describe("Bank Deposit All Equipment Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankDepositAllEquipment", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast when equipment system unavailable", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });

      const worldWithoutEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(null),
      };

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        worldWithoutEquipment as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Equipment system unavailable",
      );
    });

    it("sends info toast when nothing equipped", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });

      const equipSystem = createMockEquipmentSystem({
        getAllEquippedItems: vi.fn().mockReturnValue([]),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        worldWithEquipment as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "Nothing equipped to deposit",
        type: "info",
      });
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes transaction when player has equipped items", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedCount: 3,
      });

      const equipSystem = createMockEquipmentSystem({
        getAllEquippedItems: vi.fn().mockReturnValue([
          { slot: "weapon", itemId: "bronze_sword" },
          { slot: "helmet", itemId: "bronze_helm" },
          { slot: "body", itemId: "bronze_platebody" },
        ]),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        worldWithEquipment as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful deposit", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedCount: 2,
      });

      const equipSystem = createMockEquipmentSystem({
        getAllEquippedItems: vi.fn().mockReturnValue([
          { slot: "weapon", itemId: "bronze_sword" },
          { slot: "shield", itemId: "wooden_shield" },
        ]),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        worldWithEquipment as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });

    it("sends success toast with correct item count", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedCount: 4,
      });

      const equipSystem = createMockEquipmentSystem({
        getAllEquippedItems: vi.fn().mockReturnValue([
          { slot: "weapon", itemId: "bronze_sword" },
          { slot: "shield", itemId: "wooden_shield" },
          { slot: "helmet", itemId: "bronze_helm" },
          { slot: "body", itemId: "bronze_platebody" },
        ]),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        worldWithEquipment as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "Deposited 4 equipped items to bank",
        type: "success",
      });
    });

    it("uses singular form for single item deposit", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (executeSecureTransaction as Mock).mockResolvedValue({
        depositedCount: 1,
      });

      const equipSystem = createMockEquipmentSystem({
        getAllEquippedItems: vi
          .fn()
          .mockReturnValue([{ slot: "weapon", itemId: "bronze_sword" }]),
      });

      const worldWithEquipment = {
        ...mockWorld,
        getSystem: vi.fn().mockReturnValue(equipSystem),
      };

      await handleBankDepositAllEquipment(
        mockSocket as never,
        {},
        worldWithEquipment as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "Deposited 1 equipped item to bank",
        type: "success",
      });
    });
  });
});
