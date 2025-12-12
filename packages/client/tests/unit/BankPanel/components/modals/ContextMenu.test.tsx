/**
 * ContextMenu Component Unit Tests
 *
 * Tests for bank item context menu with withdraw/deposit options.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextMenu } from "../../../../../src/game/panels/BankPanel/components/modals/ContextMenu";
import type { ContextMenuState } from "../../../../../src/game/panels/BankPanel/types";

describe("ContextMenu", () => {
  const mockOnAction = vi.fn();
  const mockOnClose = vi.fn();

  const defaultBankMenu: ContextMenuState = {
    visible: true,
    x: 100,
    y: 100,
    itemId: "bronze_sword",
    quantity: 50,
    type: "bank",
    tabIndex: 0,
    slot: 5,
  };

  const defaultInventoryMenu: ContextMenuState = {
    visible: true,
    x: 100,
    y: 100,
    itemId: "lobster",
    quantity: 25,
    type: "inventory",
  };

  const defaultProps = {
    menu: defaultBankMenu,
    onAction: mockOnAction,
    onClose: mockOnClose,
    rightPanelMode: "inventory" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Visibility
  // ========================================================================

  describe("visibility", () => {
    it("renders nothing when not visible", () => {
      const menu = { ...defaultBankMenu, visible: false };
      const { container } = render(
        <ContextMenu {...defaultProps} menu={menu} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders menu when visible", () => {
      render(<ContextMenu {...defaultProps} />);

      expect(screen.getByText("Withdraw 1")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Placeholder Menu
  // ========================================================================

  describe("placeholder menu (qty === 0)", () => {
    it("shows only Release option for placeholders", () => {
      const placeholderMenu: ContextMenuState = {
        ...defaultBankMenu,
        quantity: 0,
      };
      render(<ContextMenu {...defaultProps} menu={placeholderMenu} />);

      expect(screen.getByText("Release")).toBeInTheDocument();
      expect(screen.queryByText("Withdraw 1")).not.toBeInTheDocument();
    });

    it("calls onAction with releasePlaceholder on Release click", () => {
      const placeholderMenu: ContextMenuState = {
        ...defaultBankMenu,
        quantity: 0,
      };
      render(<ContextMenu {...defaultProps} menu={placeholderMenu} />);

      fireEvent.click(screen.getByText("Release"));

      expect(mockOnAction).toHaveBeenCalledWith("releasePlaceholder", 0);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Bank Menu Options
  // ========================================================================

  describe("bank menu options", () => {
    it("shows standard withdraw options", () => {
      render(<ContextMenu {...defaultProps} />);

      expect(screen.getByText("Withdraw 1")).toBeInTheDocument();
      expect(screen.getByText("Withdraw 5")).toBeInTheDocument();
      expect(screen.getByText("Withdraw 10")).toBeInTheDocument();
      expect(screen.getByText("Withdraw All")).toBeInTheDocument();
      expect(screen.getByText("Withdraw X")).toBeInTheDocument();
    });

    it("shows Withdraw-Placeholder option for bank items", () => {
      render(<ContextMenu {...defaultProps} />);

      expect(screen.getByText("Withdraw-Placeholder")).toBeInTheDocument();
    });

    it("calls onAction with withdraw on Withdraw 1 click", () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw 1"));

      expect(mockOnAction).toHaveBeenCalledWith("withdraw", 1);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onAction with full quantity on Withdraw All click", () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw All"));

      expect(mockOnAction).toHaveBeenCalledWith("withdraw", 50);
    });

    it("calls onAction with withdrawPlaceholder", () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw-Placeholder"));

      expect(mockOnAction).toHaveBeenCalledWith("withdrawPlaceholder", 50);
    });
  });

  // ========================================================================
  // Inventory Menu Options
  // ========================================================================

  describe("inventory menu options", () => {
    it("shows deposit options for inventory items", () => {
      render(<ContextMenu {...defaultProps} menu={defaultInventoryMenu} />);

      expect(screen.getByText("Deposit 1")).toBeInTheDocument();
      expect(screen.getByText("Deposit 5")).toBeInTheDocument();
      expect(screen.getByText("Deposit 10")).toBeInTheDocument();
      expect(screen.getByText("Deposit All")).toBeInTheDocument();
      expect(screen.getByText("Deposit X")).toBeInTheDocument();
    });

    it("does not show Withdraw-Placeholder for inventory items", () => {
      render(<ContextMenu {...defaultProps} menu={defaultInventoryMenu} />);

      expect(
        screen.queryByText("Withdraw-Placeholder"),
      ).not.toBeInTheDocument();
    });

    it("calls onAction with deposit on Deposit 1 click", () => {
      render(<ContextMenu {...defaultProps} menu={defaultInventoryMenu} />);

      fireEvent.click(screen.getByText("Deposit 1"));

      expect(mockOnAction).toHaveBeenCalledWith("deposit", 1);
    });
  });

  // ========================================================================
  // Equip Option
  // ========================================================================

  describe("equip option", () => {
    it("shows Equip at bottom when inventory tab open for equipable items", () => {
      render(<ContextMenu {...defaultProps} rightPanelMode="inventory" />);

      // Equip should be present (bronze_sword is equipable)
      expect(screen.getByText("Equip")).toBeInTheDocument();
    });

    it("shows Equip at top when equipment tab open", () => {
      render(<ContextMenu {...defaultProps} rightPanelMode="equipment" />);

      expect(screen.getByText("Equip")).toBeInTheDocument();
    });

    it("calls onAction with equip on Equip click", () => {
      render(<ContextMenu {...defaultProps} rightPanelMode="equipment" />);

      fireEvent.click(screen.getByText("Equip"));

      expect(mockOnAction).toHaveBeenCalledWith("equip", 1);
    });

    it("does not show Equip for non-equipable items", () => {
      const lobsterMenu: ContextMenuState = {
        ...defaultBankMenu,
        itemId: "lobster",
      };
      render(<ContextMenu {...defaultProps} menu={lobsterMenu} />);

      expect(screen.queryByText("Equip")).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Custom Amount Input (X)
  // ========================================================================

  describe("custom amount input", () => {
    it("shows input field when Withdraw X clicked", async () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw X"));

      expect(screen.getByPlaceholderText("1-50")).toBeInTheDocument();
    });

    it("shows OK and Cancel buttons in input mode", async () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw X"));

      expect(screen.getByText("OK")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("calls onAction with custom amount on OK click", async () => {
      const user = userEvent.setup();
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw X"));

      const input = screen.getByPlaceholderText("1-50");
      await user.type(input, "25");
      fireEvent.click(screen.getByText("OK"));

      expect(mockOnAction).toHaveBeenCalledWith("withdraw", 25);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose on Cancel click", () => {
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw X"));
      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("submits on Enter key", async () => {
      const user = userEvent.setup();
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw X"));

      const input = screen.getByPlaceholderText("1-50");
      await user.type(input, "15");
      await user.keyboard("{Enter}");

      expect(mockOnAction).toHaveBeenCalledWith("withdraw", 15);
    });

    it("closes on Escape key", async () => {
      const user = userEvent.setup();
      render(<ContextMenu {...defaultProps} />);

      fireEvent.click(screen.getByText("Withdraw X"));

      const input = screen.getByPlaceholderText("1-50");
      await user.keyboard("{Escape}");

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Quantity Capping
  // ========================================================================

  describe("quantity capping", () => {
    it("caps quantity to available amount", () => {
      const smallQtyMenu: ContextMenuState = {
        ...defaultBankMenu,
        quantity: 3,
      };
      render(<ContextMenu {...defaultProps} menu={smallQtyMenu} />);

      // Click Withdraw 5 but only 3 available
      fireEvent.click(screen.getByText("Withdraw 5"));

      expect(mockOnAction).toHaveBeenCalledWith("withdraw", 3);
    });

    it("caps Withdraw 10 to available quantity", () => {
      const smallQtyMenu: ContextMenuState = {
        ...defaultBankMenu,
        quantity: 7,
      };
      render(<ContextMenu {...defaultProps} menu={smallQtyMenu} />);

      fireEvent.click(screen.getByText("Withdraw 10"));

      expect(mockOnAction).toHaveBeenCalledWith("withdraw", 7);
    });
  });
});
