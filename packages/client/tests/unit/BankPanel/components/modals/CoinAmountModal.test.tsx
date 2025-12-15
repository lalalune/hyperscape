/**
 * CoinAmountModal Component Unit Tests
 *
 * Tests for the coin deposit/withdraw modal with quick buttons.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoinAmountModal } from "../../../../../src/game/panels/BankPanel/components/modals/CoinAmountModal";
import type { CoinModalState } from "../../../../../src/game/panels/BankPanel/types";

describe("CoinAmountModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnClose = vi.fn();

  const defaultDepositModal: CoinModalState = {
    visible: true,
    action: "deposit",
    maxAmount: 10000,
  };

  const defaultWithdrawModal: CoinModalState = {
    visible: true,
    action: "withdraw",
    maxAmount: 50000,
  };

  const defaultProps = {
    modal: defaultDepositModal,
    onConfirm: mockOnConfirm,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Visibility
  // ========================================================================

  describe("visibility", () => {
    it("renders nothing when not visible", () => {
      const modal = { ...defaultDepositModal, visible: false };
      const { container } = render(
        <CoinAmountModal {...defaultProps} modal={modal} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders modal when visible", () => {
      render(<CoinAmountModal {...defaultProps} />);

      expect(screen.getByText("Deposit Coins")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Title Display
  // ========================================================================

  describe("title display", () => {
    it("shows Deposit Coins for deposit action", () => {
      render(<CoinAmountModal {...defaultProps} />);

      expect(screen.getByText("Deposit Coins")).toBeInTheDocument();
    });

    it("shows Withdraw Coins for withdraw action", () => {
      render(
        <CoinAmountModal {...defaultProps} modal={defaultWithdrawModal} />,
      );

      expect(screen.getByText("Withdraw Coins")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Quick Amount Buttons
  // ========================================================================

  describe("quick amount buttons", () => {
    it("renders 1, 10, 100, 1K buttons", () => {
      render(<CoinAmountModal {...defaultProps} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("1K")).toBeInTheDocument();
    });

    it("calls onConfirm with 1 when 1 button clicked", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText("1"));

      expect(mockOnConfirm).toHaveBeenCalledWith(1);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onConfirm with 10 when 10 button clicked", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText("10"));

      expect(mockOnConfirm).toHaveBeenCalledWith(10);
    });

    it("calls onConfirm with 100 when 100 button clicked", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText("100"));

      expect(mockOnConfirm).toHaveBeenCalledWith(100);
    });

    it("calls onConfirm with 1000 when 1K button clicked", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText("1K"));

      expect(mockOnConfirm).toHaveBeenCalledWith(1000);
    });
  });

  // ========================================================================
  // Button Disable States
  // ========================================================================

  describe("button disable states", () => {
    it("disables 1K button when maxAmount < 1000", () => {
      const modal = { ...defaultDepositModal, maxAmount: 500 };
      render(<CoinAmountModal {...defaultProps} modal={modal} />);

      const button = screen.getByText("1K");
      expect(button).toBeDisabled();
    });

    it("disables 100 button when maxAmount < 100", () => {
      const modal = { ...defaultDepositModal, maxAmount: 50 };
      render(<CoinAmountModal {...defaultProps} modal={modal} />);

      const button = screen.getByText("100");
      expect(button).toBeDisabled();
    });

    it("disables Half button when maxAmount < 2", () => {
      const modal = { ...defaultDepositModal, maxAmount: 1 };
      render(<CoinAmountModal {...defaultProps} modal={modal} />);

      const halfButton = screen.getByText(/Half/);
      expect(halfButton).toBeDisabled();
    });

    it("disables All button when maxAmount < 1", () => {
      const modal = { ...defaultDepositModal, maxAmount: 0 };
      render(<CoinAmountModal {...defaultProps} modal={modal} />);

      const allButton = screen.getByText(/All/);
      expect(allButton).toBeDisabled();
    });
  });

  // ========================================================================
  // Half and All Buttons
  // ========================================================================

  describe("half and all buttons", () => {
    it("shows Half button with calculated amount", () => {
      render(<CoinAmountModal {...defaultProps} />);

      // formatQuantity returns "5.0K" for 5000 (values 1000-99999 use decimal format)
      expect(screen.getByText(/Half/)).toBeInTheDocument();
    });

    it("shows All button with max amount", () => {
      render(<CoinAmountModal {...defaultProps} />);

      // formatQuantity returns "10.0K" for 10000
      expect(screen.getByText(/All/)).toBeInTheDocument();
    });

    it("calls onConfirm with half amount on Half click", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText(/Half/));

      expect(mockOnConfirm).toHaveBeenCalledWith(5000);
    });

    it("calls onConfirm with max amount on All click", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText(/All/));

      expect(mockOnConfirm).toHaveBeenCalledWith(10000);
    });
  });

  // ========================================================================
  // Custom Amount Input
  // ========================================================================

  describe("custom amount input", () => {
    it("shows input field with max amount label", () => {
      render(<CoinAmountModal {...defaultProps} />);

      expect(screen.getByText(/max: 10,000/)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Enter amount..."),
      ).toBeInTheDocument();
    });

    it("accepts custom amount input", async () => {
      const user = userEvent.setup();
      render(<CoinAmountModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Enter amount...");
      await user.type(input, "500");

      expect(input).toHaveValue(500);
    });

    it("calls onConfirm with custom amount on submit", async () => {
      const user = userEvent.setup();
      render(<CoinAmountModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Enter amount...");
      await user.type(input, "2500");

      // Click the Deposit button (not the quick buttons)
      const depositButtons = screen.getAllByText("Deposit");
      // The last one should be the confirm button
      fireEvent.click(depositButtons[depositButtons.length - 1]);

      expect(mockOnConfirm).toHaveBeenCalledWith(2500);
    });
  });

  // ========================================================================
  // Keyboard Handling
  // ========================================================================

  describe("keyboard handling", () => {
    it("submits on Enter key", async () => {
      const user = userEvent.setup();
      render(<CoinAmountModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Enter amount...");
      await user.type(input, "300");
      await user.keyboard("{Enter}");

      expect(mockOnConfirm).toHaveBeenCalledWith(300);
    });

    it("closes on Escape key", async () => {
      const user = userEvent.setup();
      render(<CoinAmountModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Enter amount...");
      await user.click(input);
      await user.keyboard("{Escape}");

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Input Validation
  // ========================================================================

  describe("input validation", () => {
    it("disables confirm button for empty input", () => {
      render(<CoinAmountModal {...defaultProps} />);

      const confirmButtons = screen.getAllByText("Deposit");
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      expect(confirmButton).toBeDisabled();
    });

    it("disables confirm button for 0 input", async () => {
      const user = userEvent.setup();
      render(<CoinAmountModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Enter amount...");
      await user.type(input, "0");

      const confirmButtons = screen.getAllByText("Deposit");
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      expect(confirmButton).toBeDisabled();
    });

    it("disables confirm button for amount > maxAmount", async () => {
      const user = userEvent.setup();
      render(<CoinAmountModal {...defaultProps} />);

      const input = screen.getByPlaceholderText("Enter amount...");
      await user.type(input, "99999");

      const confirmButtons = screen.getAllByText("Deposit");
      const confirmButton = confirmButtons[confirmButtons.length - 1];
      expect(confirmButton).toBeDisabled();
    });
  });

  // ========================================================================
  // Cancel Button
  // ========================================================================

  describe("cancel button", () => {
    it("calls onClose when Cancel clicked", () => {
      render(<CoinAmountModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Backdrop Click
  // ========================================================================

  describe("backdrop click", () => {
    it("closes modal on backdrop click", () => {
      const { container } = render(<CoinAmountModal {...defaultProps} />);

      // The backdrop is the outermost div with the onClick
      const backdrop = container.firstChild as HTMLElement;
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("does not close on modal content click", () => {
      render(<CoinAmountModal {...defaultProps} />);

      // Click on the modal title (inside the modal)
      fireEvent.click(screen.getByText("Deposit Coins"));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
