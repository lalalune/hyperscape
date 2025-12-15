/**
 * Bank Move Handler Integration Tests
 *
 * Tests the bank move/rearrange handler flows with mocked dependencies.
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
  sendBankStateWithTabs: vi.fn(),
}));

// Mock the services
vi.mock("../../../src/systems/ServerNetwork/services", () => ({
  isValidBankSlot: vi.fn().mockReturnValue(true),
  isValidBankMoveMode: vi.fn().mockReturnValue(true),
  isValidBankTabIndex: vi.fn().mockReturnValue(true),
}));

import { handleBankMove } from "../../../src/systems/ServerNetwork/handlers/bank";

import {
  validateTransactionRequest,
  executeSecureTransaction,
  sendErrorToast,
} from "../../../src/systems/ServerNetwork/handlers/common";

import { sendBankStateWithTabs } from "../../../src/systems/ServerNetwork/handlers/bank/utils";

import {
  isValidBankSlot,
  isValidBankMoveMode,
  isValidBankTabIndex,
} from "../../../src/systems/ServerNetwork/services";

import {
  createMockSocket,
  createMockWorld,
  createMockContext,
  createMockValidationFailure,
  type MockSocket,
  type MockWorld,
} from "./helpers";

describe("Bank Move Handler Integration", () => {
  let mockSocket: MockSocket;
  let mockWorld: MockWorld;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    mockWorld = createMockWorld();
  });

  describe("handleBankMove", () => {
    it("returns early when validation fails", async () => {
      (validateTransactionRequest as Mock).mockReturnValue(
        createMockValidationFailure(),
      );

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1, mode: "swap", tabIndex: 0 },
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
      (isValidBankSlot as Mock).mockReturnValueOnce(false);

      await handleBankMove(
        mockSocket as never,
        { fromSlot: -1, toSlot: 1, mode: "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid source slot",
      );
      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("sends error toast for invalid destination slot", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock)
        .mockReturnValueOnce(true) // fromSlot
        .mockReturnValueOnce(false); // toSlot

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1000, mode: "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid destination slot",
      );
    });

    it("sends error toast for invalid move mode", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankMoveMode as Mock).mockReturnValue(false);

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1, mode: "invalid" as "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(
        mockSocket,
        "Invalid move mode",
      );
    });

    it("sends error toast for invalid tab index", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankMoveMode as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(false);

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1, mode: "swap", tabIndex: 15 },
        mockWorld as never,
      );

      expect(sendErrorToast).toHaveBeenCalledWith(mockSocket, "Invalid tab");
    });

    it("returns early when fromSlot equals toSlot (no-op)", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankMoveMode as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 5, toSlot: 5, mode: "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).not.toHaveBeenCalled();
    });

    it("executes swap mode transaction", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankMoveMode as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1, mode: "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(executeSecureTransaction).toHaveBeenCalled();
    });

    it("executes insert mode transaction", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankMoveMode as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 5, toSlot: 2, mode: "insert", tabIndex: 0 },
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
      (isValidBankMoveMode as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue({ success: true });

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1, mode: "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).toHaveBeenCalledWith(
        mockSocket,
        mockContext.playerId,
        mockContext.db,
      );
    });

    it("does not send state when transaction returns null", async () => {
      const mockContext = createMockContext();
      (validateTransactionRequest as Mock).mockReturnValue({
        success: true,
        context: mockContext,
      });
      (isValidBankSlot as Mock).mockReturnValue(true);
      (isValidBankMoveMode as Mock).mockReturnValue(true);
      (isValidBankTabIndex as Mock).mockReturnValue(true);
      (executeSecureTransaction as Mock).mockResolvedValue(null);

      await handleBankMove(
        mockSocket as never,
        { fromSlot: 0, toSlot: 1, mode: "swap", tabIndex: 0 },
        mockWorld as never,
      );

      expect(sendBankStateWithTabs).not.toHaveBeenCalled();
    });
  });
});
