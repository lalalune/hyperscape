/**
 * RightPanel Component Unit Tests
 *
 * Tests for the right-side panel with inventory and equipment views.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RightPanel } from "../../../../src/game/panels/BankPanel/components/RightPanel";
import type { InventorySlotViewItem } from "../../../../src/game/panels/BankPanel/types";
import type { PlayerEquipmentItems, Item } from "@hyperforge/shared";
import { ITEMS } from "@hyperforge/shared";

// Helper to create a mock Item for testing
function createMockItem(
  id: string,
  name: string,
  equipSlot?: Item["equipSlot"],
): Item {
  return {
    id,
    name,
    type: "weapon" as Item["type"],
    description: `A ${name}`,
    examine: `Examine ${name}`,
    tradeable: true,
    rarity: "common" as Item["rarity"],
    modelPath: null,
    iconPath: `/items/${id}.png`,
    equipSlot,
  };
}

describe("RightPanel", () => {
  const mockOnChangeMode = vi.fn();
  const mockOnDeposit = vi.fn();
  const mockOnDepositAll = vi.fn();
  const mockOnOpenCoinModal = vi.fn();
  const mockOnContextMenu = vi.fn();
  const mockOnDepositEquipment = vi.fn();
  const mockOnDepositAllEquipment = vi.fn();

  const defaultInventory: InventorySlotViewItem[] = [
    { slot: 0, itemId: "bronze_shortsword", quantity: 1 },
    { slot: 1, itemId: "lobster", quantity: 5 },
    { slot: 5, itemId: "oak_logs_noted", quantity: 100 },
  ];

  const defaultEquipment: PlayerEquipmentItems = {
    helmet: createMockItem(
      "iron_helmet",
      "Iron Helmet",
      "helmet" as unknown as Item["equipSlot"],
    ),
    body: null,
    legs: null,
    boots: null,
    gloves: null,
    cape: null,
    amulet: null,
    ring: null,
    weapon: createMockItem(
      "bronze_shortsword",
      "Bronze Sword",
      "right_hand" as unknown as Item["equipSlot"],
    ),
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
    ITEMS.clear();
    ITEMS.set(
      "bronze_shortsword",
      createMockItem(
        "bronze_shortsword",
        "Bronze Sword",
        "weapon" as unknown as Item["equipSlot"],
      ),
    );
    ITEMS.set(
      "iron_helmet",
      createMockItem(
        "iron_helmet",
        "Iron Helmet",
        "helmet" as unknown as Item["equipSlot"],
      ),
    );
    const lobster: Item = {
      id: "lobster",
      name: "Lobster",
      type: "consumable" as Item["type"],
      description: "A juicy lobster.",
      examine: "It smells delicious.",
      tradeable: true,
      rarity: "common" as Item["rarity"],
      modelPath: null,
      iconPath: "asset://icons/lobster.png",
    };
    const oakLogsNoted: Item = {
      id: "oak_logs_noted",
      name: "Oak Logs (noted)",
      type: "resource" as Item["type"],
      description: "A bank note for oak logs.",
      examine: "A note for oak logs.",
      tradeable: true,
      rarity: "common" as Item["rarity"],
      modelPath: null,
      iconPath: "asset://icons/oak-logs.png",
      stackable: true,
      maxStackSize: 10000,
      isNoted: true,
      baseItemId: "oak_logs",
    };
    ITEMS.set(lobster.id, lobster);
    ITEMS.set(oakLogsNoted.id, oakLogsNoted);
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
      expect(inventoryTab.style.background).toContain("168, 148, 115");
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
      expect(screen.getAllByAltText("Bronze Sword").length).toBeGreaterThan(0);
      // Lobster should be visible
      expect(screen.getByAltText("Lobster")).toBeInTheDocument();
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

      const slots = screen.getAllByTestId("inventory-slot");
      fireEvent.click(slots[1]!);

      expect(mockOnDeposit).toHaveBeenCalledWith("lobster", 1);
    });

    it("calls onContextMenu on right-click", () => {
      render(<RightPanel {...defaultProps} />);

      const slots = screen.getAllByTestId("inventory-slot");
      fireEvent.contextMenu(slots[1]!);

      expect(mockOnContextMenu).toHaveBeenCalledWith(
        expect.any(Object),
        "lobster",
        5,
        "inventory",
      );
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

      expect(screen.getByTitle("Iron Helmet (Head)")).toBeInTheDocument();
      expect(screen.getByTitle("Bronze Sword (Weapon)")).toBeInTheDocument();
      expect(screen.getByTitle("Body (empty)")).toBeInTheDocument();
      expect(screen.getByTitle("Shield (empty)")).toBeInTheDocument();
      expect(screen.getByTitle("Legs (empty)")).toBeInTheDocument();
    });

    it("shows equipped items with icons", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      // Helmet and weapon should show icons
      expect(screen.getByAltText("Iron Helmet")).toBeInTheDocument();
      expect(screen.getAllByAltText("Bronze Sword").length).toBeGreaterThan(0);
    });

    it("shows greyed placeholder icons for empty slots", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      // Body slot shows greyed icon
      const bodySlot = screen.getByLabelText("Empty Body slot");
      expect(bodySlot).toBeInTheDocument();
    });

    it("calls onDepositEquipment when equipped item clicked", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      const helmetSlot = screen.getByLabelText(
        "Iron Helmet equipped in Head slot",
      );
      fireEvent.click(helmetSlot);

      expect(mockOnDepositEquipment).toHaveBeenCalledWith("helmet");
    });

    it("does not call onDepositEquipment for empty slots", () => {
      render(<RightPanel {...defaultProps} mode="equipment" />);

      const bodySlot = screen.getByLabelText("Empty Body slot");
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
        boots: null,
        gloves: null,
        cape: null,
        amulet: null,
        ring: null,
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
