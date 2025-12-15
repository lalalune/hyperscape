/**
 * BankTabBar Component Unit Tests
 *
 * Tests for tab navigation, selection, drag-drop to tabs, and tab management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankTabBar } from "../../../../src/game/panels/BankPanel/components/BankTabBar";
import type {
  BankItem,
  BankTab,
} from "../../../../src/game/panels/BankPanel/types";
import type { DragState } from "../../../../src/game/panels/BankPanel/hooks";
import { TAB_INDEX_ALL } from "../../../../src/game/panels/BankPanel/constants";

describe("BankTabBar", () => {
  const mockOnSelectTab = vi.fn();
  const mockSetDraggedSlot = vi.fn();
  const mockSetDraggedTabIndex = vi.fn();
  const mockSetHoveredTabIndex = vi.fn();
  const mockHandleMoveToTab = vi.fn();
  const mockHandleCreateTab = vi.fn();
  const mockHandleDeleteTab = vi.fn();
  const mockSetConfirmModal = vi.fn();

  const defaultDragState: DragState = {
    draggedSlot: null,
    draggedTabIndex: null,
    dropMode: null,
    insertPosition: null,
    hoveredSlot: null,
    hoveredTabIndex: null,
  };

  const defaultItems: BankItem[] = [
    { itemId: "bronze_sword", quantity: 10, slot: 0, tabIndex: 0 },
    { itemId: "iron_helmet", quantity: 5, slot: 1, tabIndex: 0 },
    { itemId: "oak_logs", quantity: 100, slot: 0, tabIndex: 1 },
  ];

  const defaultTabs: BankTab[] = [{ tabIndex: 1, iconItemId: "oak_logs" }];

  const defaultProps = {
    tabs: defaultTabs,
    items: defaultItems,
    selectedTab: TAB_INDEX_ALL,
    onSelectTab: mockOnSelectTab,
    dragState: defaultDragState,
    setDraggedSlot: mockSetDraggedSlot,
    setDraggedTabIndex: mockSetDraggedTabIndex,
    setHoveredTabIndex: mockSetHoveredTabIndex,
    handleMoveToTab: mockHandleMoveToTab,
    handleCreateTab: mockHandleCreateTab,
    handleDeleteTab: mockHandleDeleteTab,
    setConfirmModal: mockSetConfirmModal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Tab Rendering
  // ========================================================================

  describe("tab rendering", () => {
    it("renders the All tab (∞)", () => {
      render(<BankTabBar {...defaultProps} />);

      expect(screen.getByText("∞")).toBeInTheDocument();
    });

    it("renders tab 0 with icon from first item", () => {
      render(<BankTabBar {...defaultProps} />);

      // Bronze sword icon for tab 0
      expect(screen.getByText("⚔️")).toBeInTheDocument();
    });

    it("renders custom tabs with icons", () => {
      render(<BankTabBar {...defaultProps} />);

      // Oak logs icon for tab 1
      expect(screen.getByText("🪵")).toBeInTheDocument();
    });

    it("renders + button when tabs are available", () => {
      render(<BankTabBar {...defaultProps} />);

      expect(screen.getByText("+")).toBeInTheDocument();
    });

    it("does not render + button when max tabs reached", () => {
      const maxTabs: BankTab[] = Array.from({ length: 9 }, (_, i) => ({
        tabIndex: i + 1,
        iconItemId: `item_${i}`,
      }));

      render(<BankTabBar {...defaultProps} tabs={maxTabs} />);

      expect(screen.queryByText("+")).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Tab Selection
  // ========================================================================

  describe("tab selection", () => {
    it("calls onSelectTab with TAB_INDEX_ALL when All tab is clicked", () => {
      render(<BankTabBar {...defaultProps} />);

      fireEvent.click(screen.getByText("∞"));

      expect(mockOnSelectTab).toHaveBeenCalledWith(TAB_INDEX_ALL);
    });

    it("calls onSelectTab with tab index when tab is clicked", () => {
      render(<BankTabBar {...defaultProps} />);

      // Click on tab 0 (sword icon)
      fireEvent.click(screen.getByText("⚔️"));

      expect(mockOnSelectTab).toHaveBeenCalledWith(0);
    });

    it("highlights selected All tab", () => {
      const { container } = render(
        <BankTabBar {...defaultProps} selectedTab={TAB_INDEX_ALL} />,
      );

      const allTab = screen.getByText("∞").closest("button");
      // Selected tab should have specific background gradient
      expect(allTab?.style.background).toContain("rgba(139, 69, 19");
    });

    it("highlights selected numbered tab", () => {
      render(<BankTabBar {...defaultProps} selectedTab={0} />);

      const tab0 = screen.getByText("⚔️").closest("button");
      expect(tab0?.style.background).toContain("rgba(139, 69, 19");
    });
  });

  // ========================================================================
  // Tab Icons
  // ========================================================================

  describe("tab icons", () => {
    it("shows first real item icon for tab", () => {
      render(<BankTabBar {...defaultProps} />);

      // Tab 0 should show bronze_sword icon (⚔️)
      expect(screen.getByText("⚔️")).toBeInTheDocument();
    });

    it("shows placeholder icon when tab only has placeholders", () => {
      const placeholderItems: BankItem[] = [
        { itemId: "bronze_sword", quantity: 0, slot: 0, tabIndex: 0 },
      ];

      render(<BankTabBar {...defaultProps} items={placeholderItems} />);

      // Should still show the icon but with reduced opacity
      const tab = screen.getByText("⚔️").closest("button");
      expect(tab?.style.opacity).toBe("0.6");
    });

    it("shows tab number when tab is empty", () => {
      const emptyItems: BankItem[] = [];
      const emptyTabs: BankTab[] = [{ tabIndex: 1, iconItemId: null }];

      render(
        <BankTabBar {...defaultProps} items={emptyItems} tabs={emptyTabs} />,
      );

      // Tab 0 should show "0" when empty
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Tab Deletion
  // ========================================================================

  describe("tab deletion", () => {
    it("shows confirm modal on right-click of deletable tab", () => {
      render(<BankTabBar {...defaultProps} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.contextMenu(tab1!);

      expect(mockSetConfirmModal).toHaveBeenCalledWith(
        expect.objectContaining({
          visible: true,
          title: "Delete Tab",
        }),
      );
    });

    it("does not show confirm modal for tab 0 (protected)", () => {
      render(<BankTabBar {...defaultProps} />);

      const tab0 = screen.getByText("⚔️").closest("button");
      fireEvent.contextMenu(tab0!);

      // Tab 0 cannot be deleted - modal should not be shown
      expect(mockSetConfirmModal).not.toHaveBeenCalled();
    });

    it("calls handleDeleteTab when confirm is executed", () => {
      render(<BankTabBar {...defaultProps} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.contextMenu(tab1!);

      // Get the onConfirm callback from the modal call
      const modalCall = mockSetConfirmModal.mock.calls[0][0];
      modalCall.onConfirm();

      expect(mockHandleDeleteTab).toHaveBeenCalledWith(1);
    });
  });

  // ========================================================================
  // Drag-Drop to Tabs
  // ========================================================================

  describe("drag-drop to tabs", () => {
    it("sets hovered tab index on drag over", () => {
      const dragState = {
        ...defaultDragState,
        draggedSlot: 5,
        draggedTabIndex: 0,
      };
      render(<BankTabBar {...defaultProps} dragState={dragState} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.dragOver(tab1!);

      expect(mockSetHoveredTabIndex).toHaveBeenCalledWith(1);
    });

    it("clears hovered tab index on drag leave", () => {
      render(<BankTabBar {...defaultProps} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.dragLeave(tab1!);

      expect(mockSetHoveredTabIndex).toHaveBeenCalledWith(null);
    });

    it("calls handleMoveToTab on drop to different tab", () => {
      const dragState = {
        ...defaultDragState,
        draggedSlot: 5,
        draggedTabIndex: 0,
      };
      render(<BankTabBar {...defaultProps} dragState={dragState} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.drop(tab1!);

      expect(mockHandleMoveToTab).toHaveBeenCalledWith(5, 0, 1);
    });

    it("does not call handleMoveToTab on drop to same tab", () => {
      const dragState = {
        ...defaultDragState,
        draggedSlot: 5,
        draggedTabIndex: 1,
      };
      render(<BankTabBar {...defaultProps} dragState={dragState} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.drop(tab1!);

      expect(mockHandleMoveToTab).not.toHaveBeenCalled();
    });

    it("resets drag state after drop", () => {
      const dragState = {
        ...defaultDragState,
        draggedSlot: 5,
        draggedTabIndex: 0,
      };
      render(<BankTabBar {...defaultProps} dragState={dragState} />);

      const tab1 = screen.getByText("🪵").closest("button");
      fireEvent.drop(tab1!);

      expect(mockSetDraggedSlot).toHaveBeenCalledWith(null);
      expect(mockSetDraggedTabIndex).toHaveBeenCalledWith(null);
      expect(mockSetHoveredTabIndex).toHaveBeenCalledWith(null);
    });
  });

  // ========================================================================
  // New Tab Creation
  // ========================================================================

  describe("new tab creation", () => {
    it("calls handleCreateTab when item dropped on + button", () => {
      const dragState = {
        ...defaultDragState,
        draggedSlot: 5,
        draggedTabIndex: 0,
      };
      render(<BankTabBar {...defaultProps} dragState={dragState} />);

      const plusButton = screen.getByText("+").closest("button");
      fireEvent.drop(plusButton!);

      // Next available tab would be 2 (0 exists, 1 exists)
      expect(mockHandleCreateTab).toHaveBeenCalledWith(5, 0, 2);
    });

    it("highlights + button when hovered during drag", () => {
      const dragState = {
        ...defaultDragState,
        draggedSlot: 5,
        draggedTabIndex: 0,
        hoveredTabIndex: -2, // TAB_INDEX_NEW_TAB_HOVER
      };
      render(<BankTabBar {...defaultProps} dragState={dragState} />);

      const plusButton = screen.getByText("+").closest("button");
      expect(plusButton?.style.background).toContain("100, 255, 100");
    });
  });

  // ========================================================================
  // Tab Title Tooltips
  // ========================================================================

  describe("tab tooltips", () => {
    it("shows item name in tab tooltip", () => {
      render(<BankTabBar {...defaultProps} />);

      const tab0 = screen.getByTitle(/Bronze Sword/);
      expect(tab0).toBeInTheDocument();
    });

    it("shows 'empty' indicator for placeholder-only tabs", () => {
      const placeholderItems: BankItem[] = [
        { itemId: "bronze_sword", quantity: 0, slot: 0, tabIndex: 0 },
      ];

      render(<BankTabBar {...defaultProps} items={placeholderItems} />);

      const tab = screen.getByTitle(/empty/);
      expect(tab).toBeInTheDocument();
    });

    it("shows right-click hint for deletable tabs", () => {
      render(<BankTabBar {...defaultProps} />);

      // Tab 1 should show delete hint
      const tab1 = screen.getByTitle(/Right-click to delete/);
      expect(tab1).toBeInTheDocument();
    });
  });
});
