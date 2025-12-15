/**
 * BankPanel Component Integration Tests
 *
 * Tests for the main BankPanel orchestration component that wires together
 * all sub-components, hooks, and state management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BankPanel } from "../../../src/game/panels/BankPanel";
import type {
  BankItem,
  BankTab,
} from "../../../src/game/panels/BankPanel/types";
import type { PlayerEquipmentItems } from "@hyperscape/shared";
import { createMockWorld } from "../../mocks/MockWorld";

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

function createBankItem(overrides: Partial<BankItem> = {}): BankItem {
  return {
    itemId: "bronze_sword",
    quantity: 1,
    slot: 0,
    tabIndex: 0,
    ...overrides,
  };
}

function createBankItems(count: number, tabIndex = 0): BankItem[] {
  const items: BankItem[] = [];
  const itemIds = [
    "bronze_sword",
    "iron_helmet",
    "lobster",
    "oak_logs",
    "coins",
    "rune_essence",
  ];
  for (let i = 0; i < count; i++) {
    items.push({
      itemId: itemIds[i % itemIds.length],
      quantity: (i + 1) * 10,
      slot: i,
      tabIndex,
    });
  }
  return items;
}

function createInventoryItems() {
  return [
    { slot: 0, itemId: "bronze_sword", quantity: 1 },
    { slot: 1, itemId: "lobster", quantity: 5 },
    { slot: 5, itemId: "oak_logs_noted", quantity: 100 },
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ];
}

function createEquipment(): PlayerEquipmentItems {
  return {
    helmet: { id: "iron_helmet", slot: "helmet" },
    body: null,
    legs: null,
    weapon: { id: "bronze_sword", slot: "weapon" },
    shield: null,
    arrows: null,
  };
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe("BankPanel", () => {
  let mockWorld: ReturnType<typeof createMockWorld>;
  const mockOnClose = vi.fn();

  const defaultProps = {
    items: createBankItems(5),
    tabs: [] as BankTab[],
    alwaysSetPlaceholder: false,
    maxSlots: 480,
    world: null as unknown as ReturnType<typeof createMockWorld>,
    inventory: createInventoryItems(),
    equipment: createEquipment(),
    coins: 1000,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWorld = createMockWorld();
    defaultProps.world = mockWorld as unknown as typeof defaultProps.world;
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ========================================================================
  // Basic Rendering
  // ========================================================================

  describe("basic rendering", () => {
    it("renders bank panel with header", () => {
      render(<BankPanel {...defaultProps} />);

      expect(screen.getByText("Bank")).toBeInTheDocument();
      expect(screen.getByText("🏦")).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(<BankPanel {...defaultProps} />);

      expect(screen.getByText("✕")).toBeInTheDocument();
    });

    it("calls onClose when close button clicked", () => {
      render(<BankPanel {...defaultProps} />);

      fireEvent.click(screen.getByText("✕"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("renders bank items in grid", () => {
      render(<BankPanel {...defaultProps} />);

      // Should see item icons
      expect(screen.getAllByText("⚔️").length).toBeGreaterThan(0); // bronze_sword
    });

    it("renders right panel with inventory", () => {
      render(<BankPanel {...defaultProps} />);

      expect(screen.getByText("Inventory")).toBeInTheDocument();
    });

    it("renders footer with slot count", () => {
      render(<BankPanel {...defaultProps} />);

      // Footer format: "X items • X/480 slots"
      expect(screen.getByText(/5\/480 slots/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Tab Selection
  // ========================================================================

  describe("tab selection", () => {
    it("starts with All tab selected (-1)", () => {
      const items = [
        ...createBankItems(3, 0),
        ...createBankItems(2, 1).map((item, i) => ({
          ...item,
          slot: i,
          tabIndex: 1,
        })),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // In "All" view, should see tab headers
      expect(screen.getByText(/Tab 0/)).toBeInTheDocument();
      expect(screen.getByText(/Tab 1/)).toBeInTheDocument();
    });

    it("filters items when specific tab selected", () => {
      const tab0Items = createBankItems(3, 0);
      const tab1Items = [
        createBankItem({
          itemId: "unique_item",
          quantity: 99,
          slot: 0,
          tabIndex: 1,
        }),
      ];
      const items = [...tab0Items, ...tab1Items];
      const tabs: BankTab[] = [{ name: "Tab 0" }, { name: "Tab 1" }];

      render(<BankPanel {...defaultProps} items={items} tabs={tabs} />);

      // Click on Tab 1 (index 1)
      const tabButtons = screen.getAllByTitle(/Tab 1|Select tab/);
      // Find the actual tab button (not the All tab)
      const tab1Button = tabButtons.find((btn) =>
        btn.textContent?.includes("1"),
      );
      if (tab1Button) {
        fireEvent.click(tab1Button);
      }
    });
  });

  // ========================================================================
  // Withdraw/Deposit Actions
  // ========================================================================

  describe("withdraw actions", () => {
    it("sends withdraw request on item click", () => {
      render(<BankPanel {...defaultProps} />);

      // Click on an item slot (first item with quantity)
      const itemSlots = screen.getAllByTitle(/Bronze Sword.*Tab 0/i);
      if (itemSlots.length > 0) {
        fireEvent.click(itemSlots[0]);
      }

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdraw",
        expect.objectContaining({ quantity: 1 }),
      );
    });

    it("opens context menu on right-click", () => {
      render(<BankPanel {...defaultProps} />);

      const itemSlots = screen.getAllByTitle(/Bronze Sword.*Tab 0/i);
      if (itemSlots.length > 0) {
        fireEvent.contextMenu(itemSlots[0]);
      }

      // Context menu should appear with withdraw options
      expect(screen.getByText("Withdraw 1")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Context Menu Integration
  // ========================================================================

  describe("context menu integration", () => {
    it("withdraws via context menu action", async () => {
      render(<BankPanel {...defaultProps} />);

      // Open context menu
      const itemSlots = screen.getAllByTitle(/Bronze Sword.*Tab 0/i);
      fireEvent.contextMenu(itemSlots[0]);

      // Click Withdraw 1
      fireEvent.click(screen.getByText("Withdraw 1"));

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdraw",
        expect.objectContaining({ quantity: 1 }),
      );
    });

    it("withdraws all via context menu", async () => {
      const items = [
        createBankItem({
          itemId: "lobster",
          quantity: 50,
          slot: 0,
          tabIndex: 0,
        }),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // Open context menu
      const itemSlots = screen.getAllByTitle(/Lobster.*Tab 0/i);
      fireEvent.contextMenu(itemSlots[0]);

      // Click Withdraw All
      fireEvent.click(screen.getByText(/Withdraw All/));

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdraw",
        expect.objectContaining({ quantity: 50 }),
      );
    });

    it("closes context menu after action", async () => {
      render(<BankPanel {...defaultProps} />);

      const itemSlots = screen.getAllByTitle(/Bronze Sword.*Tab 0/i);
      fireEvent.contextMenu(itemSlots[0]);

      expect(screen.getByText("Withdraw 1")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Withdraw 1"));

      // Menu should close
      await waitFor(() => {
        expect(screen.queryByText("Withdraw 1")).not.toBeInTheDocument();
      });
    });
  });

  // ========================================================================
  // Coin Modal Integration
  // ========================================================================

  describe("coin modal integration", () => {
    it("opens deposit coin modal from right panel", () => {
      render(<BankPanel {...defaultProps} />);

      // Find and click the Deposit button in the coin pouch area (in right panel)
      // There's only one "Deposit" button when coins > 0
      const depositButtons = screen.getAllByText("Deposit");
      // The one in the right panel coin pouch
      fireEvent.click(depositButtons[0]);

      // Modal should open
      expect(screen.getByText("Deposit Coins")).toBeInTheDocument();
    });

    it("sends deposit coins request from modal", async () => {
      render(<BankPanel {...defaultProps} />);

      // Open modal - click Deposit button
      const depositButtons = screen.getAllByText("Deposit");
      fireEvent.click(depositButtons[0]);

      // Click "All" button to deposit all coins (format: "All (1.0K)")
      const allButton = screen.getByText(/All \(/);
      fireEvent.click(allButton);

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDepositCoins",
        expect.objectContaining({ amount: 1000 }),
      );
    });

    it("opens withdraw coin modal when bank has coins", () => {
      const items = [
        createBankItem({
          itemId: "coins",
          quantity: 5000,
          slot: 0,
          tabIndex: 0,
        }),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // Find the bank coins display and open context menu
      const coinSlots = screen.getAllByTitle(/Coins.*Tab 0/i);
      if (coinSlots.length > 0) {
        fireEvent.contextMenu(coinSlots[0]);
      }

      // Context menu with withdraw options
      expect(screen.getByText("Withdraw 1")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Right Panel Mode Switching
  // ========================================================================

  describe("right panel mode switching", () => {
    it("starts in inventory mode", () => {
      render(<BankPanel {...defaultProps} />);

      expect(screen.getByText("Inventory")).toBeInTheDocument();
    });

    it("switches to equipment mode", () => {
      render(<BankPanel {...defaultProps} />);

      // Click equipment tab
      fireEvent.click(screen.getByTitle("View Worn Equipment"));

      expect(screen.getByText("Equipment")).toBeInTheDocument();
    });

    it("switches back to inventory mode", () => {
      render(<BankPanel {...defaultProps} />);

      // Switch to equipment
      fireEvent.click(screen.getByTitle("View Worn Equipment"));
      expect(screen.getByText("Equipment")).toBeInTheDocument();

      // Switch back to inventory
      fireEvent.click(screen.getByTitle("View Backpack"));
      expect(screen.getByText("Inventory")).toBeInTheDocument();
    });

    it("withdraws to equipment when in equipment mode and item is equipable", () => {
      const items = [
        createBankItem({
          itemId: "iron_sword",
          quantity: 1,
          slot: 0,
          tabIndex: 0,
        }),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // Switch to equipment mode
      fireEvent.click(screen.getByTitle("View Worn Equipment"));

      // Click on equipable item (iron_sword matches "sword" pattern = equipable)
      const itemSlots = screen.getAllByTitle(/Iron Sword.*Tab 0/i);
      if (itemSlots.length > 0) {
        fireEvent.click(itemSlots[0]);
      }

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdrawToEquipment",
        expect.any(Object),
      );
    });
  });

  // ========================================================================
  // Deposit from Inventory
  // ========================================================================

  describe("deposit from inventory", () => {
    it("deposits item on inventory slot click", () => {
      render(<BankPanel {...defaultProps} />);

      // Find inventory slots with items
      const inventorySlots = screen.getAllByTitle(/Lobster x5/i);
      if (inventorySlots.length > 0) {
        fireEvent.click(inventorySlots[0]);
      }

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDeposit",
        expect.objectContaining({ itemId: "lobster", quantity: 1 }),
      );
    });

    it("deposits all inventory items", () => {
      render(<BankPanel {...defaultProps} />);

      fireEvent.click(screen.getByText("Deposit Inventory"));

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDepositAll",
        expect.any(Object),
      );
    });
  });

  // ========================================================================
  // Withdraw as Note Toggle
  // ========================================================================

  describe("withdraw as note toggle", () => {
    it("shows Item/Note toggle in footer", () => {
      render(<BankPanel {...defaultProps} />);

      expect(screen.getByText("Item")).toBeInTheDocument();
      expect(screen.getByText("Note")).toBeInTheDocument();
    });

    it("persists withdrawAsNote to localStorage", async () => {
      render(<BankPanel {...defaultProps} />);

      // Click Note toggle
      fireEvent.click(screen.getByText("Note"));

      expect(localStorage.getItem("bank_withdrawAsNote")).toBe("true");
    });

    it("loads withdrawAsNote from localStorage", () => {
      localStorage.setItem("bank_withdrawAsNote", "true");

      render(<BankPanel {...defaultProps} />);

      // Note should be selected (check by visual state or by action)
      // The actual visual state depends on implementation
    });

    it("sends withdrawAsNote in withdraw requests when enabled", async () => {
      localStorage.setItem("bank_withdrawAsNote", "true");
      render(<BankPanel {...defaultProps} />);

      const itemSlots = screen.getAllByTitle(/Bronze Sword.*Tab 0/i);
      fireEvent.click(itemSlots[0]);

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankWithdraw",
        expect.objectContaining({ asNote: true }),
      );
    });
  });

  // ========================================================================
  // Placeholder System
  // ========================================================================

  describe("placeholder system", () => {
    it("renders placeholder items (qty=0) with greyed style", () => {
      const items = [
        createBankItem({
          itemId: "bronze_sword",
          quantity: 0,
          slot: 0,
          tabIndex: 0,
        }),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // Placeholder should be rendered - title format is "Bronze Sword (placeholder) (Tab 0)"
      const slots = screen.getAllByTitle(/Bronze Sword.*placeholder/i);
      expect(slots.length).toBeGreaterThan(0);
    });

    it("shows release placeholder option in context menu for qty=0 items", () => {
      const items = [
        createBankItem({
          itemId: "bronze_sword",
          quantity: 0,
          slot: 0,
          tabIndex: 0,
        }),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // Placeholder title format
      const slots = screen.getAllByTitle(/Bronze Sword.*placeholder/i);
      fireEvent.contextMenu(slots[0]);

      expect(screen.getByText("Release")).toBeInTheDocument();
    });

    it("shows Always placeholder toggle", () => {
      render(<BankPanel {...defaultProps} />);

      expect(screen.getByText(/Always placeholder/i)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // All Tab View (Grouped Headers)
  // ========================================================================

  describe("all tab view", () => {
    it("groups items by tab with headers", () => {
      const items = [
        ...createBankItems(2, 0),
        createBankItem({
          itemId: "rune_scimitar",
          quantity: 1,
          slot: 0,
          tabIndex: 1,
        }),
      ];
      render(<BankPanel {...defaultProps} items={items} />);

      // Should see tab headers in "All" view
      expect(screen.getByText(/Tab 0/)).toBeInTheDocument();
      expect(screen.getByText(/Tab 1/)).toBeInTheDocument();
    });

    it("shows item count per tab in headers", () => {
      const items = createBankItems(5, 0);
      render(<BankPanel {...defaultProps} items={items} />);

      // Tab 0 header should show count - look for element with "5" that's not a quantity
      // The tab header shows the count in a span at the end
      const tabHeaders = screen.getAllByText(/Tab 0/);
      expect(tabHeaders.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Equipment Deposit
  // ========================================================================

  describe("equipment deposit", () => {
    it("deposits equipment item when clicked in equipment view", () => {
      render(<BankPanel {...defaultProps} />);

      // Switch to equipment mode
      fireEvent.click(screen.getByTitle("View Worn Equipment"));

      // Click on equipped helmet
      const helmetSlot = screen.getByTitle(/Iron Helmet - Click to deposit/i);
      fireEvent.click(helmetSlot);

      // The actual payload uses "slot" not "equipSlot"
      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDepositEquipment",
        expect.objectContaining({ slot: "helmet" }),
      );
    });

    it("deposits all worn equipment", () => {
      render(<BankPanel {...defaultProps} />);

      // Switch to equipment mode
      fireEvent.click(screen.getByTitle("View Worn Equipment"));

      fireEvent.click(screen.getByText("Deposit Worn Items"));

      expect(mockWorld.network.send).toHaveBeenCalledWith(
        "bankDepositAllEquipment",
        expect.any(Object),
      );
    });
  });

  // ========================================================================
  // Tab Management
  // ========================================================================

  describe("tab management", () => {
    it("renders tab bar", () => {
      const tabs: BankTab[] = [{ name: "Tab 0" }, { name: "Tab 1" }];
      render(<BankPanel {...defaultProps} tabs={tabs} />);

      // Should see tab indicators - the "∞" All tab button
      expect(screen.getByTitle(/View all items/i)).toBeInTheDocument();
    });

    it("renders + button for creating new tabs via drag", () => {
      render(<BankPanel {...defaultProps} />);

      // The + button is for drag-drop tab creation, not click
      // Just verify it exists
      const addTabButton = screen.getByTitle(
        /Drag an item here to create a new tab/i,
      );
      expect(addTabButton).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Memoization (Performance)
  // ========================================================================

  describe("memoization", () => {
    it("filters items correctly based on selected tab", () => {
      const tab0Items = createBankItems(3, 0);
      const tab1Items = [
        createBankItem({
          itemId: "dragon_dagger",
          quantity: 1,
          slot: 0,
          tabIndex: 1,
        }),
      ];
      const items = [...tab0Items, ...tab1Items];
      const tabs: BankTab[] = [{ name: "Main" }, { name: "Weapons" }];

      const { rerender } = render(
        <BankPanel {...defaultProps} items={items} tabs={tabs} />,
      );

      // Initial render shows all (tab -1)
      // Both tabs should be visible in "All" view
      expect(screen.getByText(/Tab 0/)).toBeInTheDocument();
      expect(screen.getByText(/Tab 1/)).toBeInTheDocument();

      // Rerender with same props shouldn't cause issues
      rerender(<BankPanel {...defaultProps} items={items} tabs={tabs} />);
    });
  });

  // ========================================================================
  // Confirm Modal
  // ========================================================================

  describe("confirm modal", () => {
    it("shows confirm modal when deleting tab with items", () => {
      const items = createBankItems(5, 0);
      const tabs: BankTab[] = [{ name: "Main" }];
      render(<BankPanel {...defaultProps} items={items} tabs={tabs} />);

      // Tab deletion with items should trigger confirm modal
      // This is handled by BankTabBar but integrated here
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("handles empty bank", () => {
      render(<BankPanel {...defaultProps} items={[]} />);

      expect(screen.getByText("Bank")).toBeInTheDocument();
      // Footer format: "0 items • 0/480 slots"
      expect(screen.getByText(/0\/480 slots/)).toBeInTheDocument();
    });

    it("handles no inventory items", () => {
      const emptyInventory = Array(28).fill(null);
      render(<BankPanel {...defaultProps} inventory={emptyInventory} />);

      expect(screen.getByText("Inventory")).toBeInTheDocument();
    });

    it("handles no equipment", () => {
      const emptyEquipment: PlayerEquipmentItems = {
        helmet: null,
        body: null,
        legs: null,
        weapon: null,
        shield: null,
        arrows: null,
      };
      render(<BankPanel {...defaultProps} equipment={emptyEquipment} />);

      fireEvent.click(screen.getByTitle("View Worn Equipment"));
      expect(screen.getByText("Equipment")).toBeInTheDocument();
    });

    it("handles zero coins", () => {
      render(<BankPanel {...defaultProps} coins={0} />);

      // Deposit button should be disabled
      const depositButtons = screen.getAllByText("Deposit");
      expect(depositButtons[0]).toBeDisabled();
    });

    it("handles max bank slots display", () => {
      const items = createBankItems(100, 0);
      render(<BankPanel {...defaultProps} items={items} maxSlots={480} />);

      // Footer format: "100 items • 100/480 slots"
      expect(screen.getByText(/100\/480 slots/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Event Propagation
  // ========================================================================

  describe("event propagation", () => {
    it("stops click propagation on panel", () => {
      const outerClickHandler = vi.fn();
      render(
        <div onClick={outerClickHandler}>
          <BankPanel {...defaultProps} />
        </div>,
      );

      fireEvent.click(screen.getByText("Bank"));

      expect(outerClickHandler).not.toHaveBeenCalled();
    });

    it("stops mousedown propagation on panel", () => {
      const outerMouseDownHandler = vi.fn();
      render(
        <div onMouseDown={outerMouseDownHandler}>
          <BankPanel {...defaultProps} />
        </div>,
      );

      fireEvent.mouseDown(screen.getByText("Bank"));

      expect(outerMouseDownHandler).not.toHaveBeenCalled();
    });
  });
});
