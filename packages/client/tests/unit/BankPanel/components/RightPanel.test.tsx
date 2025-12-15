/**
 * RightPanel Component Unit Tests
 *
 * Tests for the right-side panel with inventory and equipment views.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RightPanel } from "../../../../src/game/panels/BankPanel/components/RightPanel";
import type { InventorySlotViewItem } from "../../../../src/game/panels/BankPanel/types";
import type { PlayerEquipmentItems } from "@hyperscape/shared";

describe("RightPanel", () => {
  const mockOnChangeMode = vi.fn();
  const mockOnDeposit = vi.fn();
  const mockOnDepositAll = vi.fn();
  const mockOnOpenCoinModal = vi.fn();
  const mockOnContextMenu = vi.fn();
  const mockOnDepositEquipment = vi.fn();
  const mockOnDepositAllEquipment = vi.fn();

  const defaultInventory: InventorySlotViewItem[] = [
    { slot: 0, itemId: "bronze_sword", quantity: 1 },
    { slot: 1, itemId: "lobster", quantity: 5 },
    { slot: 5, itemId: "oak_logs_noted", quantity: 100 },
  ];

  const defaultEquipment: PlayerEquipmentItems = {
    helmet: { id: "iron_helmet", slot: "helmet" },
    body: null,
    legs: null,
    weapon: { id: "bronze_sword", slot: "weapon" },
    shield: null,
    arrows: null,
  };

  const defaultProps = {
    mode: "inventory" as const,
    onChangeMode: mockOnChangeMode,
    inventory: defaultInventory,
    coins: 1000,
    equipment: defaultEquipment,
    onDeposit: mockOnDeposit,
    onDepositAll: mockOnDepositAll,
    onOpenCoinModal: mockOnOpenCoinModal,
    onContextMenu: mockOnContextMenu,
    onDepositEquipment: mockOnDepositEquipment,
    onDepositAllEquipment: mockOnDepositAllEquipment,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Mode Switching
  // ========================================================================

  describe("mode switching", () => {
    it("renders inventory and equipment tab buttons", () => {
      render(<RightPanel {...defaultProps} />);

      expect(screen.getByTitle("View Backpack")).toBeInTheDocument();
      expect(screen.getByTitle("View Worn Equipment")).toBeInTheDocument();
    });

    it("shows Inventory label when in inventory mode", () => {
      render(<RightPanel {...defaultProps} mode="inventory" />);

      expect(screen.getByText("Inventory")).toBeInTheDocument();
    });

    it("shows Equipment label when in equipment mode", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      expect(screen.getByText("Equipment")).toBeInTheDocument();
    });

    it("calls onChangeMode when inventory tab clicked", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      fireEvent.click(screen.getByText("🎒"));

      expect(mockOnChangeMode).toHaveBeenCalledWith("inventory");
    });

    it("calls onChangeMode when equipment tab clicked", () => {
      render(<RightPanel {...defaultProps} mode="inventory" />);

      fireEvent.click(screen.getByTitle("View Worn Equipment"));

      expect(mockOnChangeMode).toHaveBeenCalledWith("equipment");
    });

    it("highlights selected mode tab", () => {
      render(<RightPanel {...defaultProps} mode="inventory" />);

      const inventoryTab = screen.getByTitle("View Backpack");
      expect(inventoryTab.style.background).toContain("139, 69, 19");
    });
  });

  // ========================================================================
  // Inventory View
  // ========================================================================

  describe("inventory view", () => {
    it("renders 28 inventory slots", () => {
      const { container } = render(<RightPanel {...defaultProps} />);

      // 4 columns x 7 rows = 28 slots
      const grid = container.querySelector(".grid");
      expect(grid?.children.length).toBe(28);
    });

    it("renders items in correct slots", () => {
      render(<RightPanel {...defaultProps} />);

      // Bronze sword should be visible
      expect(screen.getAllByText("⚔️").length).toBeGreaterThan(0);
      // Lobster should be visible
      expect(screen.getByText("🐟")).toBeInTheDocument();
    });

    it("shows quantity for stackable items", () => {
      render(<RightPanel {...defaultProps} />);

      expect(screen.getByText("5")).toBeInTheDocument(); // lobster quantity
      expect(screen.getByText("100")).toBeInTheDocument(); // noted logs quantity
    });

    it("shows N badge for noted items", () => {
      render(<RightPanel {...defaultProps} />);

      expect(screen.getByText("N")).toBeInTheDocument();
    });

    it("calls onDeposit when item slot clicked", () => {
      render(<RightPanel {...defaultProps} />);

      // Click on the lobster slot
      const lobsterSlot = screen.getByTitle(/Lobster x5/);
      fireEvent.click(lobsterSlot);

      expect(mockOnDeposit).toHaveBeenCalledWith("lobster", 1);
    });

    it("calls onContextMenu on right-click", () => {
      render(<RightPanel {...defaultProps} />);

      const lobsterSlot = screen.getByTitle(/Lobster x5/);
      fireEvent.contextMenu(lobsterSlot);

      expect(mockOnContextMenu).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Coin Pouch
  // ========================================================================

  describe("coin pouch", () => {
    it("displays coin amount", () => {
      render(<RightPanel {...defaultProps} />);

      expect(screen.getByText("1,000")).toBeInTheDocument();
    });

    it("shows Deposit button", () => {
      render(<RightPanel {...defaultProps} />);

      expect(screen.getByText("Deposit")).toBeInTheDocument();
    });

    it("calls onOpenCoinModal when Deposit clicked", () => {
      render(<RightPanel {...defaultProps} />);

      fireEvent.click(screen.getByText("Deposit"));

      expect(mockOnOpenCoinModal).toHaveBeenCalledWith("deposit");
    });

    it("disables Deposit button when coins is 0", () => {
      render(<RightPanel {...defaultProps} coins={0} />);

      const depositButton = screen.getByText("Deposit");
      expect(depositButton).toBeDisabled();
    });
  });

  // ========================================================================
  // Deposit All Button
  // ========================================================================

  describe("deposit all button", () => {
    it("shows Deposit Inventory button in inventory mode", () => {
      render(<RightPanel {...defaultProps} />);

      expect(screen.getByText("Deposit Inventory")).toBeInTheDocument();
    });

    it("calls onDepositAll when clicked", () => {
      render(<RightPanel {...defaultProps} />);

      fireEvent.click(screen.getByText("Deposit Inventory"));

      expect(mockOnDepositAll).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Equipment View
  // ========================================================================

  describe("equipment view", () => {
    it("renders paperdoll layout with equipment slots", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      // Should see slot labels
      expect(screen.getByText("Head")).toBeInTheDocument();
      expect(screen.getByText("Weapon")).toBeInTheDocument();
      expect(screen.getByText("Body")).toBeInTheDocument();
      expect(screen.getByText("Shield")).toBeInTheDocument();
      expect(screen.getByText("Legs")).toBeInTheDocument();
      expect(screen.getByText("Ammo")).toBeInTheDocument();
    });

    it("shows equipped items with icons", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      // Helmet and weapon should show icons
      expect(screen.getByText("⛑️")).toBeInTheDocument();
      // Multiple sword icons - one in the slot
      expect(screen.getAllByText("⚔️").length).toBeGreaterThan(0);
    });

    it("shows greyed placeholder icons for empty slots", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      // Body slot shows greyed icon
      const bodySlot = screen.getByTitle("Body (empty)");
      expect(bodySlot).toBeInTheDocument();
    });

    it("calls onDepositEquipment when equipped item clicked", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      const helmetSlot = screen.getByTitle(/Iron Helmet - Click to deposit/);
      fireEvent.click(helmetSlot);

      expect(mockOnDepositEquipment).toHaveBeenCalledWith("helmet");
    });

    it("does not call onDepositEquipment for empty slots", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      const bodySlot = screen.getByTitle("Body (empty)");
      fireEvent.click(bodySlot);

      expect(mockOnDepositEquipment).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Deposit Worn Items Button
  // ========================================================================

  describe("deposit worn items button", () => {
    it("shows Deposit Worn Items button in equipment mode", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      expect(screen.getByText("Deposit Worn Items")).toBeInTheDocument();
    });

    it("calls onDepositAllEquipment when clicked", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      fireEvent.click(screen.getByText("Deposit Worn Items"));

      expect(mockOnDepositAllEquipment).toHaveBeenCalled();
    });

    it("disables button when no equipment is worn", () => {
      const emptyEquipment: PlayerEquipmentItems = {
        helmet: null,
        body: null,
        legs: null,
        weapon: null,
        shield: null,
        arrows: null,
      };

      render(
        <RightPanel
          {...defaultProps}
          mode="equipment"
          equipment={emptyEquipment}
        />,
      );

      const button = screen.getByText("Deposit Worn Items");
      expect(button).toBeDisabled();
    });
  });
});
