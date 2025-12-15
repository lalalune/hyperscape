/**
 * Bank Coins Handler Integration Tests
 *
 * Tests the coin deposit/withdraw handler flows with mocked dependencies.
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
  emitInventorySyncEvents: vi.fn(),
}));

// Mock the bank utils
vi.mock("../../../src/systems/ServerNetwork/handlers/bank/utils", () => ({
  rateLimiter: { check: vi.fn().mockReturnValue(true) },
  compactBankSlots: vi.fn(),
  sendBankStateWithTabs: vi.fn(),
  MAX_BANK_SLOTS: 800,
  AUDIT_COIN_THRESHOLD: 1_000_000,
}));

// Mock the services
vi.mock("../../../src/systems/ServerNetwork/services", () => ({
  isValidQuantity: vi.fn().mockReturnValue(true),
  wouldOverflow: vi.fn().mockReturnValue(false),
}));

import {
  handleBankDepositCoins,
  handleBankWithdrawCoins,
} from "../../../src/systems/ServerNetwork/handlers/bank";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendToSocket,
  sendErrorToast,
  emitInventorySyncEvents,
} from "../../../src/systems/ServerNetwork/handlers/common";

import { sendBankStateWithTabs } from "../../../src/systems/ServerNetwork/handlers/bank/utils";

import { isValidQuantity } from "../../../src/systems/ServerNetwork/services";

import {
  createMockSocket,
  createMockWorld,
  createMockContext,
  createMockValidationFailure,
  type MockSocket,
  type MockWorld,
} from "./helpers";

describe("Bank Deposit Coins Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankDepositCoins", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid amount", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(false);

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: -100 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid amount");
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes transaction for valid deposit request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 500,
      });

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful deposit", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 500,
      });

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });

    it("emits inventory sync events with new balance", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 500,
      });

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(emitInventorySyncEvents).toHaveBeenCalledWith(mockContext, {
        newCoinBalance: 500,
      });
    });

    it("sends success toast after deposit", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 0,
      });

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: 5000 },
        mockWorld as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "Deposited 5,000 coins",
        type: "success",
      });
    });

    it("does not proceed when transaction returns null", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue(null);

      await handleBankDepositCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).not.toHaveBeenCalled();
      expect(emitInventorySyncEvents).not.toHaveBeenCalled();
    });
  });
});

describe("Bank Withdraw Coins Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankWithdrawCoins", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid amount", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(false);

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid amount");
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes transaction for valid withdraw request", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 1500,
      });

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("sends bank state update after successful withdraw", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 1500,
      });

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });

    it("emits inventory sync events with new balance", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 1500,
      });

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(emitInventorySyncEvents).toHaveBeenCalledWith(mockContext, {
        newCoinBalance: 1500,
      });
    });

    it("sends success toast after withdraw", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({
        newPouchBalance: 2000000,
      });

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 1000000 },
        mockWorld as never,
      );

      expect(sendToSocket).toHaveBeenCalledWith(mockSocket, "showToast", {
        message: "Withdrew 1,000,000 coins",
        type: "success",
      });
    });

    it("does not proceed when transaction returns null", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidQuantity as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue(null);

      await handleBankWithdrawCoins(
        mockSocket as never,
        { amount: 1000 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).not.toHaveBeenCalled();
      expect(emitInventorySyncEvents).not.toHaveBeenCalled();
    });
  });
});
