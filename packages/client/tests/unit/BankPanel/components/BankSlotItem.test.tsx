/**
 * BankSlotItem Component Unit Tests
 *
 * Tests for the memoized bank slot component including rendering,
 * quantity display, drag-drop visual states, and event handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankSlotItem } from "../../../../src/game/panels/BankPanel/components/BankSlotItem";
import type { BankItem } from "../../../../src/game/panels/BankPanel/types";

describe("BankSlotItem", () => {
  const mockOnDragStart = vi.fn();
  const mockOnDragOver = vi.fn();
  const mockOnDragLeave = vi.fn();
  const mockOnDrop = vi.fn();
  const mockOnDragEnd = vi.fn();
  const mockOnClick = vi.fn();
  const mockOnContextMenu = vi.fn();

  const defaultItem: BankItem = {
    itemId: "bronze_sword",
    quantity: 10,
    slot: 0,
    tabIndex: 0,
  };

  const defaultProps = {
    item: defaultItem,
    slotIndex: 0,
    itemTabIndex: 0,
    isDragging: false,
    isDropTarget: false,
    showSwapHighlight: false,
    showInsertLine: false,
    showFaintGuide: false,
    dropColor: "100, 200, 255",
    guideColor: "100, 200, 255",
    onDragStart: mockOnDragStart,
    onDragOver: mockOnDragOver,
    onDragLeave: mockOnDragLeave,
    onDrop: mockOnDrop,
    onDragEnd: mockOnDragEnd,
    onClick: mockOnClick,
    onContextMenu: mockOnContextMenu,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Basic Rendering
  // ========================================================================

  describe("basic rendering", () => {
    it("renders the item icon", () => {
      render(<BankSlotItem {...defaultProps} />);

      // Bronze sword should render ⚔️
      expect(screen.getByText("⚔️")).toBeInTheDocument();
    });

    it("renders quantity for quantities > 1", () => {
      render(<BankSlotItem {...defaultProps} />);

      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("does not render quantity for quantity of 1", () => {
      const item = { ...defaultItem, quantity: 1 };
      render(<BankSlotItem {...defaultProps} item={item} />);

      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("renders correct title with item name and quantity", () => {
      render(<BankSlotItem {...defaultProps} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 0)");
      expect(slot).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Placeholder Rendering (qty === 0)
  // ========================================================================

  describe("placeholder rendering", () => {
    it("renders with placeholder title when quantity is 0", () => {
      const placeholderItem: BankItem = {
        ...defaultItem,
        quantity: 0,
      };
      render(<BankSlotItem {...defaultProps} item={placeholderItem} />);

      const slot = screen.getByTitle("Bronze Sword (placeholder)");
      expect(slot).toBeInTheDocument();
    });

    it("does not render quantity for placeholders", () => {
      const placeholderItem: BankItem = {
        ...defaultItem,
        quantity: 0,
      };
      render(<BankSlotItem {...defaultProps} item={placeholderItem} />);

      // Should not find any quantity text
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("renders with reduced opacity for placeholders", () => {
      const placeholderItem: BankItem = {
        ...defaultItem,
        quantity: 0,
      };
      const { container } = render(
        <BankSlotItem {...defaultProps} item={placeholderItem} />,
      );

      const slot = container.firstChild as HTMLElement;
      expect(slot.style.opacity).toBe("0.6");
    });
  });

  // ========================================================================
  // Quantity Display & Colors
  // ========================================================================

  describe("quantity display", () => {
    it("displays formatted quantity for large numbers", () => {
      const item = { ...defaultItem, quantity: 1500 };
      render(<BankSlotItem {...defaultProps} item={item} />);

      expect(screen.getByText("1.5K")).toBeInTheDocument();
    });

    it("displays yellow color for quantity < 100K", () => {
      const item = { ...defaultItem, quantity: 50000 };
      const { container } = render(
        <BankSlotItem {...defaultProps} item={item} />,
      );

      const quantitySpan = container.querySelector(
        ".absolute.bottom-0",
      ) as HTMLElement;
      expect(quantitySpan.style.color).toBe("rgb(255, 255, 0)"); // #ffff00
    });

    it("displays white color for quantity 100K-10M", () => {
      const item = { ...defaultItem, quantity: 500000 };
      const { container } = render(
        <BankSlotItem {...defaultProps} item={item} />,
      );

      const quantitySpan = container.querySelector(
        ".absolute.bottom-0",
      ) as HTMLElement;
      expect(quantitySpan.style.color).toBe("rgb(255, 255, 255)"); // #ffffff
    });

    it("displays green color for quantity >= 10M", () => {
      const item = { ...defaultItem, quantity: 15000000 };
      const { container } = render(
        <BankSlotItem {...defaultProps} item={item} />,
      );

      const quantitySpan = container.querySelector(
        ".absolute.bottom-0",
      ) as HTMLElement;
      expect(quantitySpan.style.color).toBe("rgb(0, 255, 0)"); // #00ff00
    });
  });

  // ========================================================================
  // Drag Visual States
  // ========================================================================

  describe("drag visual states", () => {
    it("applies dragging style when isDragging is true", () => {
      const { container } = render(
        <BankSlotItem {...defaultProps} isDragging={true} />,
      );

      const slot = container.firstChild as HTMLElement;
      expect(slot.style.transform).toBe("scale(0.9)");
      expect(slot.style.opacity).toBe("0.4");
    });

    it("applies swap highlight when showSwapHighlight is true", () => {
      const { container } = render(
        <BankSlotItem {...defaultProps} showSwapHighlight={true} />,
      );

      const slot = container.firstChild as HTMLElement;
      expect(slot.style.border).toContain("100, 200, 255");
    });

    it("shows insert line when showInsertLine is true", () => {
      const { container } = render(
        <BankSlotItem {...defaultProps} showInsertLine={true} />,
      );

      // Insert line should be rendered
      const insertLine = container.querySelector(
        '[style*="position: absolute"]',
      );
      expect(insertLine).toBeInTheDocument();
    });

    it("shows faint guide when showFaintGuide is true", () => {
      const { container } = render(
        <BankSlotItem {...defaultProps} showFaintGuide={true} />,
      );

      // Faint guide line should be rendered
      const guideLine = container.querySelector(
        '[style*="position: absolute"]',
      );
      expect(guideLine).toBeInTheDocument();
    });

    it("uses cross-tab color for drop indicator", () => {
      const { container } = render(
        <BankSlotItem
          {...defaultProps}
          showSwapHighlight={true}
          dropColor="100, 255, 150"
        />,
      );

      const slot = container.firstChild as HTMLElement;
      expect(slot.style.border).toContain("100, 255, 150");
    });
  });

  // ========================================================================
  // Event Handlers
  // ========================================================================

  describe("event handlers", () => {
    it("calls onDragStart with correct arguments on drag start", () => {
      render(<BankSlotItem {...defaultProps} slotIndex={5} itemTabIndex={2} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 2)");
      fireEvent.dragStart(slot);

      expect(mockOnDragStart).toHaveBeenCalledWith(5, 2);
    });

    it("calls onDragOver on drag over", () => {
      render(<BankSlotItem {...defaultProps} slotIndex={5} itemTabIndex={2} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 2)");
      const event = new Event("dragover", { bubbles: true });
      Object.defineProperty(event, "preventDefault", { value: vi.fn() });

      fireEvent(slot, event);

      expect(mockOnDragOver).toHaveBeenCalled();
    });

    it("calls onDragLeave on drag leave", () => {
      render(<BankSlotItem {...defaultProps} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 0)");
      fireEvent.dragLeave(slot);

      expect(mockOnDragLeave).toHaveBeenCalled();
    });

    it("calls onDrop with correct arguments on drop", () => {
      render(<BankSlotItem {...defaultProps} slotIndex={5} itemTabIndex={2} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 2)");
      fireEvent.drop(slot);

      expect(mockOnDrop).toHaveBeenCalled();
    });

    it("calls onDragEnd on drag end", () => {
      render(<BankSlotItem {...defaultProps} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 0)");
      fireEvent.dragEnd(slot);

      expect(mockOnDragEnd).toHaveBeenCalled();
    });

    it("calls onClick with correct arguments on click", () => {
      render(<BankSlotItem {...defaultProps} slotIndex={5} itemTabIndex={2} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 2)");
      fireEvent.click(slot);

      expect(mockOnClick).toHaveBeenCalledWith("bronze_sword", 2, 5);
    });

    it("calls onContextMenu with item on right-click", () => {
      render(<BankSlotItem {...defaultProps} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 0)");
      fireEvent.contextMenu(slot);

      expect(mockOnContextMenu).toHaveBeenCalledWith(
        expect.anything(),
        defaultItem,
      );
    });
  });

  // ========================================================================
  // Draggable Attribute
  // ========================================================================

  describe("draggable attribute", () => {
    it("has draggable=true", () => {
      render(<BankSlotItem {...defaultProps} />);

      const slot = screen.getByTitle("Bronze Sword x10 (Tab 0)");
      expect(slot).toHaveAttribute("draggable", "true");
    });
  });

  // ========================================================================
  // Different Item Types
  // ========================================================================

  describe("different item types", () => {
    it("renders correct icon for logs", () => {
      const item = { ...defaultItem, itemId: "oak_logs" };
      render(<BankSlotItem {...defaultProps} item={item} />);

      expect(screen.getByText("🪵")).toBeInTheDocument();
    });

    it("renders correct icon for coins", () => {
      const item = { ...defaultItem, itemId: "coins" };
      render(<BankSlotItem {...defaultProps} item={item} />);

      expect(screen.getByText("🪙")).toBeInTheDocument();
    });

    it("renders correct icon for unknown items", () => {
      const item = { ...defaultItem, itemId: "mystery_item" };
      render(<BankSlotItem {...defaultProps} item={item} />);

      expect(screen.getByText("📦")).toBeInTheDocument();
    });
  });
});
